package studio.imai.vector

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import dev.convex.android.AuthProvider
import java.net.URI
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import okhttp3.Cookie
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.HttpUrl.Companion.toHttpUrl

@Serializable
data class StoredSession(
  val appUrl: String,
  val convexUrl: String,
  val orgSlug: String? = null,
  val cookies: Map<String, String> = emptyMap(),
  val user: AuthenticatedUser? = null,
)

@Serializable data class AppConfig(val convexUrl: String = "", val tunnelHost: String? = null)
@Serializable private data class AuthSessionEnvelope(val user: AuthenticatedUser? = null)
@Serializable private data class ConvexTokenEnvelope(val token: String? = null)
data class BetterAuthData(val session: StoredSession, val token: String)

class AuthenticationRejectedException(message: String) : IllegalStateException(message)

class EncryptedSessionStore(context: Context) {
  private val preferences = context.getSharedPreferences("vector_secure_session", Context.MODE_PRIVATE)
  private val json = Json { ignoreUnknownKeys = true }
  private val alias = "vector.session.aes"

  fun load(): StoredSession? = runCatching {
    val encoded = preferences.getString("payload", null) ?: return null
    val bytes = Base64.decode(encoded, Base64.NO_WRAP)
    require(bytes.size > 12)
    val iv = bytes.copyOfRange(0, 12)
    val ciphertext = bytes.copyOfRange(12, bytes.size)
    val cipher = Cipher.getInstance("AES/GCM/NoPadding")
    cipher.init(Cipher.DECRYPT_MODE, key(), GCMParameterSpec(128, iv))
    json.decodeFromString<StoredSession>(cipher.doFinal(ciphertext).decodeToString())
  }.getOrNull()

  fun save(session: StoredSession) {
    val cipher = Cipher.getInstance("AES/GCM/NoPadding")
    cipher.init(Cipher.ENCRYPT_MODE, key())
    val ciphertext = cipher.doFinal(json.encodeToString(session).encodeToByteArray())
    val payload = cipher.iv + ciphertext
    check(preferences.edit().putString("payload", Base64.encodeToString(payload, Base64.NO_WRAP)).commit())
  }

  fun clear() {
    preferences.edit().remove("payload").apply()
  }

  private fun key(): SecretKey {
    val keyStore = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
    (keyStore.getKey(alias, null) as? SecretKey)?.let { return it }
    val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore")
    generator.init(
      KeyGenParameterSpec.Builder(alias, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
        .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
        .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
        .setKeySize(256)
        .build()
    )
    return generator.generateKey()
  }
}

class VectorAuthApi(
  private val http: OkHttpClient = OkHttpClient.Builder()
    .followRedirects(true)
    .followSslRedirects(false)
    .build(),
) {
  private val json = Json { ignoreUnknownKeys = true }

  suspend fun signIn(appUrlInput: String, identifier: String, password: String): StoredSession {
    val appUrl = resolveAppUrl(appUrlInput)
    val config = fetchConfig(appUrl)
    require(config.convexUrl.isNotBlank()) { "This Vector instance did not return a Convex deployment URL." }
    var session = StoredSession(appUrl = appUrl, convexUrl = config.convexUrl)
    val isEmail = identifier.trim().contains('@')
    val field = if (isEmail) "email" else "username"
    val body = "{\"$field\":${json.encodeToString(identifier.trim())},\"password\":${json.encodeToString(password)}}"
    session = request(
      session,
      if (isEmail) "/api/auth/sign-in/email" else "/api/auth/sign-in/username",
      "POST",
      body,
    ).second
    val (sessionData, refreshed) = request(session, "/api/auth/get-session")
    return refreshed.copy(user = json.decodeFromString<AuthSessionEnvelope>(sessionData).user)
  }

  suspend fun resolveAppUrl(raw: String): String = withContext(Dispatchers.IO) {
    val normalized = normalizeAppUrl(raw)
    runCatching {
      http.newCall(Request.Builder().url(normalized).head().build()).execute().use { response ->
        val url = response.request.url
        normalizeAppUrl(url.newBuilder().encodedPath("/").query(null).fragment(null).build().toString())
      }
    }.getOrDefault(normalized)
  }

  suspend fun fetchConfig(appUrl: String): AppConfig {
    val request = Request.Builder().url(appUrl.trimEnd('/') + "/api/config").get().build()
    val data = execute(request)
    return json.decodeFromString(data)
  }

  suspend fun fetchToken(session: StoredSession): BetterAuthData {
    val (data, refreshed) = request(session, "/api/auth/convex/token")
    val token = json.decodeFromString<ConvexTokenEnvelope>(data).token
    require(!token.isNullOrBlank()) { "Missing Convex token." }
    return BetterAuthData(refreshed, token)
  }

  suspend fun signOut(session: StoredSession) {
    request(session, "/api/auth/sign-out", "POST", "{}")
  }

  private suspend fun request(
    session: StoredSession,
    path: String,
    method: String = "GET",
    body: String? = null,
  ): Pair<String, StoredSession> = withContext(Dispatchers.IO) {
    val url = (session.appUrl.trimEnd('/') + path).toHttpUrl()
    val builder = Request.Builder()
      .url(url)
      .header("Origin", session.appUrl.trimEnd('/'))
      .header("Referer", session.appUrl.trimEnd('/') + "/")
    if (session.cookies.isNotEmpty()) {
      builder.header("Cookie", session.cookies.toSortedMap().entries.joinToString("; ") { "${it.key}=${it.value}" })
    }
    if (body == null) builder.get()
    else builder.method(method, body.toRequestBody("application/json".toMediaType()))

    http.newCall(builder.build()).execute().use { response ->
      requireSecureUrl(response.request.url.scheme, response.request.url.host)
      val data = response.body?.string().orEmpty()
      if (!response.isSuccessful) {
        val message = when (response.code) {
          401 -> "The account or password is incorrect."
          429 -> "Too many sign-in attempts. Wait a moment and try again."
          in 500..599 -> "This Vector instance is temporarily unavailable."
          else -> "Request failed (${response.code})."
        }
        if (response.code == 401) throw AuthenticationRejectedException(message)
        error(message)
      }
      val cookies = session.cookies.toMutableMap()
      Cookie.parseAll(url, response.headers).forEach { cookie ->
        if (cookie.expiresAt < System.currentTimeMillis() || cookie.value.isEmpty()) cookies.remove(cookie.name)
        else cookies[cookie.name] = cookie.value
      }
      data to session.copy(cookies = cookies)
    }
  }

  private suspend fun execute(request: Request): String = withContext(Dispatchers.IO) {
    http.newCall(request).execute().use { response ->
      requireSecureUrl(response.request.url.scheme, response.request.url.host)
      val data = response.body?.string().orEmpty()
      check(response.isSuccessful) { "Request failed (${response.code})." }
      data
    }
  }

  companion object {
    fun normalizeAppUrl(raw: String): String {
      var value = raw.trim().trimEnd('/')
      require(value.isNotEmpty()) { "Enter a valid Vector app URL." }
      if (!value.startsWith("http://", true) && !value.startsWith("https://", true)) {
        val local = value.startsWith("localhost") || value.startsWith("127.0.0.1") || value.startsWith("[::1]")
        value = (if (local) "http://" else "https://") + value
      }
      val uri = URI(value)
      require(uri.host != null) { "Enter a valid Vector app URL." }
      requireSecureUrl(requireNotNull(uri.scheme), uri.host)
      return URI(uri.scheme, uri.userInfo, uri.host, uri.port, null, null, null).toString().trimEnd('/')
    }

    private fun requireSecureUrl(scheme: String, host: String) {
      val loopback = host.equals("localhost", true) || host == "127.0.0.1" || host == "::1" || host == "[::1]"
      require(scheme.equals("https", true) || (scheme.equals("http", true) && loopback)) {
        "Vector app URLs must use HTTPS (HTTP is only allowed for local development)."
      }
    }
  }
}

class VectorBetterAuthProvider(
  initialSession: StoredSession,
  private val api: VectorAuthApi,
  private val store: EncryptedSessionStore,
) : AuthProvider<BetterAuthData> {
  @Volatile private var session: StoredSession = initialSession

  override suspend fun login(context: Context, onIdToken: (String?) -> Unit): Result<BetterAuthData> =
    loginFromCache(onIdToken)

  override suspend fun loginFromCache(onIdToken: (String?) -> Unit): Result<BetterAuthData> = runCatching {
    api.fetchToken(session).also {
      session = it.session
      store.save(session)
      onIdToken(it.token)
    }
  }.onFailure { onIdToken(null) }

  override suspend fun logout(context: Context): Result<Void?> = runCatching {
    api.signOut(session)
    store.clear()
    null
  }

  override fun extractIdToken(authResult: BetterAuthData): String = authResult.token

  fun selectWorkspace(orgSlug: String) {
    session = session.copy(orgSlug = orgSlug)
    store.save(session)
  }

  fun snapshot(): StoredSession = session
}
