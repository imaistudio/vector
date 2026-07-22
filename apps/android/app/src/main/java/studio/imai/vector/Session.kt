package studio.imai.vector

import android.app.Application
import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import dev.convex.android.ConvexClientWithAuth
import java.io.Closeable
import java.util.UUID
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch

private val Context.vectorPreferences by preferencesDataStore("vector_preferences")

class VectorPreferenceStore(private val context: Context) {
  fun requestGroup(orgSlug: String): Flow<RequestGroup> = context.vectorPreferences.data.map { values ->
    val raw = values[stringPreferencesKey("requests_group_$orgSlug")]
    RequestGroup.entries.firstOrNull { it.wire == raw } ?: RequestGroup.None
  }

  suspend fun setRequestGroup(orgSlug: String, group: RequestGroup) {
    context.vectorPreferences.edit { it[stringPreferencesKey("requests_group_$orgSlug")] = group.wire }
  }
}

sealed interface SessionState {
  data object Restoring : SessionState
  data object SignedOut : SessionState
  data class SignedIn(
    val session: StoredSession,
    val organizations: List<Organization>,
    val repository: VectorRepository,
    val preferences: VectorPreferenceStore,
    val instanceId: String = UUID.randomUUID().toString(),
  ) : SessionState
}

class VectorSessionController(private val context: Context) : Closeable {
  private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
  private val authApi = VectorAuthApi()
  private val sessionStore = EncryptedSessionStore(context)
  private val preferences = VectorPreferenceStore(context)
  private var authProvider: VectorBetterAuthProvider? = null
  private var client: ConvexClientWithAuth<BetterAuthData>? = null
  private var clientScope: CoroutineScope? = null

  private val mutableState = MutableStateFlow<SessionState>(SessionState.Restoring)
  val state: StateFlow<SessionState> = mutableState
  private val mutableError = MutableStateFlow<String?>(null)
  val error: StateFlow<String?> = mutableError
  private val mutableBusy = MutableStateFlow(false)
  val busy: StateFlow<Boolean> = mutableBusy

  init {
    scope.launch {
      val stored = runCatching { sessionStore.load() }
        .onFailure { mutableError.value = "Your saved session could not be read. Sign in again." }
        .getOrNull()
      if (stored == null) mutableState.value = SessionState.SignedOut
      else runCatching { activate(stored, allowFallback = true) }
        .onFailure { failure ->
          if (failure is AuthenticationRejectedException) sessionStore.clear()
          else mutableError.value = "Your saved session could not be restored. Sign in again or retry when the service is available."
          mutableState.value = SessionState.SignedOut
        }
    }
  }

  fun signIn(appUrl: String, identifier: String, password: String, orgSlug: String?) {
    if (mutableBusy.value) return
    scope.launch {
      mutableBusy.value = true
      mutableError.value = null
      runCatching {
        val signedIn = authApi.signIn(appUrl, identifier, password)
        activate(signedIn.copy(orgSlug = orgSlug?.trim()?.takeIf { it.isNotEmpty() }))
      }.onFailure { mutableError.value = it.message ?: "Unable to sign in." }
      mutableBusy.value = false
    }
  }

  fun switchWorkspace(organization: Organization) {
    val current = mutableState.value as? SessionState.SignedIn ?: return
    if (current.session.orgSlug == organization.slug) return
    authProvider?.selectWorkspace(organization.slug)
    mutableState.value = current.copy(session = current.session.copy(orgSlug = organization.slug))
  }

  fun signOut() {
    val remoteSession = authProvider?.snapshot()
    val previousClientScope = clientScope
    runCatching { sessionStore.clear() }
    client = null
    clientScope = null
    authProvider = null
    mutableState.value = SessionState.SignedOut
    mutableBusy.value = false
    previousClientScope?.cancel()
    if (remoteSession != null) scope.launch { runCatching { authApi.signOut(remoteSession) } }
  }

  fun clearError() { mutableError.value = null }

  private suspend fun activate(initial: StoredSession, allowFallback: Boolean = false) {
    val provider = VectorBetterAuthProvider(initial, authApi, sessionStore)
    val nextClientScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    val convex = ConvexClientWithAuth(initial.convexUrl, provider, nextClientScope)
    try {
      convex.loginFromCache().getOrThrow()
      val organizations = convex.subscribe<List<Organization>>(VectorFunctions.Organizations).first().getOrThrow()
      require(organizations.isNotEmpty()) { "This account does not belong to a Vector workspace." }
      val selected = initial.orgSlug?.let { slug -> organizations.firstOrNull { it.slug == slug } }
        ?: if (initial.orgSlug == null || allowFallback) organizations.first() else error("Workspace not found.")
      provider.selectWorkspace(selected.slug)
      val session = provider.snapshot()
      clientScope?.cancel()
      authProvider = provider
      client = convex
      clientScope = nextClientScope
      mutableState.value = SessionState.SignedIn(session, organizations, ConvexVectorRepository(convex), preferences)
    } catch (failure: Throwable) {
      nextClientScope.cancel()
      throw failure
    }
  }

  override fun close() {
    clientScope?.cancel()
    client = null
    clientScope = null
    authProvider = null
  }
}

open class VectorApplication : Application() {
  lateinit var sessionController: VectorSessionController
    private set

  override fun onCreate() {
    super.onCreate()
    sessionController = VectorSessionController(this)
  }
}
