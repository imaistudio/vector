package studio.imai.vector

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import java.util.UUID
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Job
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.debounce
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withTimeout
import kotlinx.coroutines.selects.select

data class LoadState<T>(val value: T? = null, val loading: Boolean = true, val error: String? = null)

@OptIn(kotlinx.coroutines.FlowPreview::class, kotlinx.coroutines.ExperimentalCoroutinesApi::class)
class VectorViewModel(
  val orgSlug: String,
  private val repository: VectorRepository,
  private val preferences: VectorPreferenceStore,
) : ViewModel() {
  val requestScope = MutableStateFlow(RequestScope.Inbox)
  val requestSearch = MutableStateFlow("")
  val requestGroup = MutableStateFlow(RequestGroup.None)
  val workScope = MutableStateFlow(WorkScope.Active)

  private val mutableRequests = MutableStateFlow(LoadState<List<RequestRow>>())
  val requests: StateFlow<LoadState<List<RequestRow>>> = mutableRequests
  private val mutableRequestsNext = MutableStateFlow<String?>(null)
  val requestsNext: StateFlow<String?> = mutableRequestsNext
  private val mutableWork = MutableStateFlow(LoadState<List<WorkRow>>())
  val work: StateFlow<LoadState<List<WorkRow>>> = mutableWork
  private val mutableWorkNext = MutableStateFlow<String?>(null)
  val workNext: StateFlow<String?> = mutableWorkNext
  private val mutableDocuments = MutableStateFlow(LoadState<List<Document>>())
  val documents: StateFlow<LoadState<List<Document>>> = mutableDocuments
  private val mutableDocumentsNext = MutableStateFlow<String?>(null)
  val documentsNext: StateFlow<String?> = mutableDocumentsNext
  private val mutableProjects = MutableStateFlow(LoadState<List<EntitySummary>>())
  val projects: StateFlow<LoadState<List<EntitySummary>>> = mutableProjects
  private val mutableProjectsNext = MutableStateFlow<String?>(null)
  val projectsNext: StateFlow<String?> = mutableProjectsNext
  private val mutableTeams = MutableStateFlow(LoadState<List<EntitySummary>>())
  val teams: StateFlow<LoadState<List<EntitySummary>>> = mutableTeams
  private val mutableTeamsNext = MutableStateFlow<String?>(null)
  val teamsNext: StateFlow<String?> = mutableTeamsNext
  private val mutableInbox = MutableStateFlow(LoadState<List<InboxNotification>>())
  val inbox: StateFlow<LoadState<List<InboxNotification>>> = mutableInbox
  private val mutableInboxNext = MutableStateFlow<String?>(null)
  val inboxNext: StateFlow<String?> = mutableInboxNext
  private val mutableOptions = MutableStateFlow(WorkspaceOptions())
  val options: StateFlow<WorkspaceOptions> = mutableOptions
  private val mutableOptionsError = MutableStateFlow<String?>(null)
  val optionsError: StateFlow<String?> = mutableOptionsError

  private val mutableRequestDetail = MutableStateFlow(LoadState<RequestDetail>(loading = false))
  val requestDetail: StateFlow<LoadState<RequestDetail>> = mutableRequestDetail
  private val mutableWorkDetail = MutableStateFlow(LoadState<WorkDetail>(loading = false))
  val workDetail: StateFlow<LoadState<WorkDetail>> = mutableWorkDetail
  private val mutableSessions = MutableStateFlow(LoadState<List<WorkSession>>(loading = false))
  val sessions: StateFlow<LoadState<List<WorkSession>>> = mutableSessions
  private val mutableAgent = MutableStateFlow(LoadState<AgentSessionSnapshot>(loading = false))
  val agent: StateFlow<LoadState<AgentSessionSnapshot>> = mutableAgent
  private val mutableDocument = MutableStateFlow(LoadState<DocumentContent>(loading = false))
  val document: StateFlow<LoadState<DocumentContent>> = mutableDocument

  private val mutablePending = MutableStateFlow<Set<String>>(emptySet())
  val pending: StateFlow<Set<String>> = mutablePending
  private val mutableActionError = MutableStateFlow<String?>(null)
  val actionError: StateFlow<String?> = mutableActionError

  private var detailJob: Job? = null
  private var sessionsJob: Job? = null
  private var agentJob: Job? = null
  private var documentJob: Job? = null
  private var selectedDocumentId: VectorId? = null
  private var documentGeneration = 0L
  private var retryClientId: Pair<String, String>? = null
  private var currentRequestQuery: Pair<RequestScope, String?> = requestScope.value to null
  private var requestHead = emptyList<RequestRow>()
  private var requestTail = emptyList<RequestRow>()
  private var requestHeadNext: String? = null
  private var currentWorkScope: WorkScope = workScope.value
  private var workHead = emptyList<WorkRow>()
  private var workTail = emptyList<WorkRow>()
  private var documentHead = emptyList<Document>()
  private var documentTail = emptyList<Document>()
  private var projectHead = emptyList<EntitySummary>()
  private var projectTail = emptyList<EntitySummary>()
  private var teamHead = emptyList<EntitySummary>()
  private var teamTail = emptyList<EntitySummary>()
  private var inboxHead = emptyList<InboxNotification>()
  private var inboxTail = emptyList<InboxNotification>()

  init {
    viewModelScope.launch { preferences.requestGroup(orgSlug).collect { requestGroup.value = it } }
    viewModelScope.launch {
      combine(requestScope, requestSearch.debounce(200)) { scope, search -> scope to search.trim().takeIf { it.isNotEmpty() } }
        .flatMapLatest { query ->
          currentRequestQuery = query
          requestHead = emptyList()
          requestTail = emptyList()
          requestHeadNext = null
          mutableRequestsNext.value = null
          mutableRequests.value = LoadState(loading = true)
          repository.requests(orgSlug, query.first, query.second).map { query to it }
        }
        .collect { (query, result) ->
          if (query == currentRequestQuery) result.fold(
            onSuccess = { page ->
              requestHead = page.page
              requestTail = emptyList()
              requestHeadNext = page.nextCursor
              mutableRequestsNext.value = requestHeadNext
              mutableRequests.value = LoadState(mergeRequests(requestHead, requestTail), loading = false)
            },
            onFailure = { mutableRequests.value = LoadState(loading = false, error = it.readable()) },
          )
        }
    }
    viewModelScope.launch {
      workScope.flatMapLatest { scope ->
        currentWorkScope = scope
        workHead = emptyList()
        workTail = emptyList()
        mutableWorkNext.value = null
        mutableWork.value = LoadState(loading = true)
        repository.work(orgSlug, scope).map { scope to it }
      }.collect { (scope, result) ->
        if (scope == currentWorkScope) result.fold(
          onSuccess = { page ->
            workHead = page.page
            workTail = emptyList()
            mutableWorkNext.value = page.nextCursor
            mutableWork.value = LoadState(mergeWork(workHead, workTail), loading = false)
            if (workHead.isEmpty() && page.nextCursor != null) loadMoreWork()
          },
          onFailure = { mutableWork.value = LoadState(loading = false, error = it.readable()) },
        )
      }
    }
    viewModelScope.launch {
      repository.documents(orgSlug).collect { result -> result.fold(
        onSuccess = { page ->
          documentHead = page.page
          documentTail = emptyList()
          mutableDocumentsNext.value = page.nextCursor
          mutableDocuments.value = LoadState(mergeDocuments(documentHead, documentTail), loading = false)
        },
        onFailure = { mutableDocuments.value = LoadState(loading = false, error = it.readable()) },
      ) }
    }
    viewModelScope.launch {
      repository.projects(orgSlug).collect { result -> result.fold(
        onSuccess = { page ->
          projectHead = page.page
          projectTail = emptyList()
          mutableProjectsNext.value = page.nextCursor
          mutableProjects.value = LoadState(mergeEntities(projectHead, projectTail), loading = false)
        },
        onFailure = { mutableProjects.value = LoadState(loading = false, error = it.readable()) },
      ) }
    }
    viewModelScope.launch {
      repository.teams(orgSlug).collect { result -> result.fold(
        onSuccess = { page ->
          teamHead = page.page
          teamTail = emptyList()
          mutableTeamsNext.value = page.nextCursor
          mutableTeams.value = LoadState(mergeEntities(teamHead, teamTail), loading = false)
        },
        onFailure = { mutableTeams.value = LoadState(loading = false, error = it.readable()) },
      ) }
    }
    viewModelScope.launch {
      repository.inbox(orgSlug).collect { result -> result.fold(
        onSuccess = { page ->
          inboxHead = page.page
          inboxTail = emptyList()
          mutableInboxNext.value = page.nextCursor
          mutableInbox.value = LoadState(mergeInbox(inboxHead, inboxTail), loading = false)
        },
        onFailure = { mutableInbox.value = LoadState(loading = false, error = it.readable()) },
      ) }
    }
    viewModelScope.launch {
      repository.workspaceOptions(orgSlug).collect { result -> result.fold(
        onSuccess = {
          mutableOptions.value = it
          mutableOptionsError.value = null
        },
        onFailure = { mutableOptionsError.value = it.readable() },
      ) }
    }
  }

  fun setRequestGroup(group: RequestGroup) {
    requestGroup.value = group
    viewModelScope.launch { preferences.setRequestGroup(orgSlug, group) }
  }

  fun loadMoreRequests() {
    val cursor = mutableRequestsNext.value ?: return
    if ("requests-more" in mutablePending.value) return
    val query = currentRequestQuery
    viewModelScope.launch {
      action("requests-more") {
        val page = repository.requests(orgSlug, query.first, query.second, cursor).first().getOrThrow()
        if (query == currentRequestQuery && cursor == mutableRequestsNext.value) {
          requestTail = mergeRequests(requestTail, page.page)
          mutableRequestsNext.value = page.nextCursor
          mutableRequests.value = LoadState(mergeRequests(requestHead, requestTail), loading = false)
        }
      }
    }
  }

  fun loadMoreDocuments() {
    val cursor = mutableDocumentsNext.value ?: return
    if ("documents-more" in mutablePending.value) return
    viewModelScope.launch {
      action("documents-more") {
        val page = repository.documents(orgSlug, cursor).first().getOrThrow()
        if (cursor == mutableDocumentsNext.value) {
          documentTail = mergeDocuments(documentTail, page.page)
          mutableDocumentsNext.value = page.nextCursor
          mutableDocuments.value = LoadState(mergeDocuments(documentHead, documentTail), loading = false)
        }
      }
    }
  }

  fun loadMoreWork() {
    val startingCursor = mutableWorkNext.value ?: return
    if ("work-more" in mutablePending.value) return
    val scope = currentWorkScope
    viewModelScope.launch {
      action("work-more") {
        val initialSize = mergeWork(workHead, workTail).size
        var cursor: String? = startingCursor
        while (cursor != null && scope == currentWorkScope && mergeWork(workHead, workTail).size == initialSize) {
          val requestedCursor = cursor
          val page = repository.work(orgSlug, scope, requestedCursor).first().getOrThrow()
          if (requestedCursor != mutableWorkNext.value) return@action
          workTail = mergeWork(workTail, page.page)
          cursor = page.nextCursor
          if (cursor != null && cursor == requestedCursor) error("Work pagination did not advance.")
          mutableWorkNext.value = cursor
          mutableWork.value = LoadState(mergeWork(workHead, workTail), loading = false)
        }
      }
    }
  }

  fun loadMoreProjects() {
    val cursor = mutableProjectsNext.value ?: return
    if ("projects-more" in mutablePending.value) return
    viewModelScope.launch {
      action("projects-more") {
        val page = repository.projects(orgSlug, cursor).first().getOrThrow()
        if (cursor == mutableProjectsNext.value) {
          projectTail = mergeEntities(projectTail, page.page)
          mutableProjectsNext.value = page.nextCursor
          mutableProjects.value = LoadState(mergeEntities(projectHead, projectTail), loading = false)
        }
      }
    }
  }

  fun loadMoreTeams() {
    val cursor = mutableTeamsNext.value ?: return
    if ("teams-more" in mutablePending.value) return
    viewModelScope.launch {
      action("teams-more") {
        val page = repository.teams(orgSlug, cursor).first().getOrThrow()
        if (cursor == mutableTeamsNext.value) {
          teamTail = mergeEntities(teamTail, page.page)
          mutableTeamsNext.value = page.nextCursor
          mutableTeams.value = LoadState(mergeEntities(teamHead, teamTail), loading = false)
        }
      }
    }
  }

  fun loadMoreInbox() {
    val cursor = mutableInboxNext.value ?: return
    if ("inbox-more" in mutablePending.value) return
    viewModelScope.launch {
      action("inbox-more") {
        val page = repository.inbox(orgSlug, cursor).first().getOrThrow()
        if (cursor == mutableInboxNext.value) {
          inboxTail = mergeInbox(inboxTail, page.page)
          mutableInboxNext.value = page.nextCursor
          mutableInbox.value = LoadState(mergeInbox(inboxHead, inboxTail), loading = false)
        }
      }
    }
  }

  fun loadRequest(key: String) {
    detailJob?.cancel()
    mutableRequestDetail.value = LoadState(loading = true)
    detailJob = viewModelScope.launch {
      repository.request(orgSlug, key).collect { result ->
        mutableRequestDetail.value = result.fold(
          onSuccess = { LoadState(it, loading = false, error = if (it == null) "Request not found." else null) },
          onFailure = { LoadState(loading = false, error = it.readable()) },
        )
      }
    }
  }

  fun loadWork(row: WorkRow) {
    detailJob?.cancel()
    sessionsJob?.cancel()
    mutableWorkDetail.value = LoadState(loading = true)
    mutableSessions.value = LoadState(loading = true)
    detailJob = viewModelScope.launch {
      repository.workDetail(orgSlug, row.key).collect { result ->
        mutableWorkDetail.value = result.fold(
          onSuccess = { LoadState(it, false, if (it == null) "Work not found." else null) },
          onFailure = { LoadState(loading = false, error = it.readable()) },
        )
      }
    }
    sessionsJob = viewModelScope.launch {
      repository.workSessions(row.id).collectResult(mutableSessions) { it }
    }
  }

  fun loadAgent(session: WorkSession) {
    agentJob?.cancel()
    mutableActionError.value = null
    mutableAgent.value = LoadState(loading = true)
    agentJob = viewModelScope.launch {
      repository.agentSession(session.id).collect { result ->
        mutableAgent.value = result.fold(
          onSuccess = { LoadState(it, false, if (it == null) "Session unavailable." else null) },
          onFailure = { LoadState(loading = false, error = it.readable()) },
        )
      }
    }
  }

  fun loadDocument(row: Document) {
    documentJob?.cancel()
    selectedDocumentId = row.id
    val generation = ++documentGeneration
    mutableDocument.value = LoadState(loading = true)
    documentJob = viewModelScope.launch {
      val requestedId = row.id
      fun isCurrentSelection() = selectedDocumentId == requestedId && documentGeneration == generation
      try {
        val fresh = repository.document(row.id).first().getOrThrow() ?: error("Document not found.")
        if (fresh.content != null || fresh.contentVersion == null) {
          val segments = fresh.content?.let(::segmentDocumentText).orEmpty()
          if (isCurrentSelection()) {
            mutableDocument.value = LoadState(DocumentContent(fresh, segments, chunked = false, isComplete = true), loading = false)
          }
        } else {
          val version = fresh.contentVersion
          val seenChunks = mutableSetOf<VectorId>()
          var segments = emptyList<String>()
          var cursor: String? = null
          do {
            val page = repository.documentChunks(fresh.id, version, cursor).first().getOrThrow()
            val incoming = mergeDocumentChunks(emptyList(), page.page, fresh.id, version)
              .filter { seenChunks.add(it.id) }
            segments = segments + incoming.flatMap { segmentDocumentText(it.content) }
            val nextCursor = page.nextCursor
            if (nextCursor != null && nextCursor == cursor) error("Document pagination did not advance.")
            cursor = nextCursor
            if (isCurrentSelection()) {
              mutableDocument.value = LoadState(
                DocumentContent(fresh, segments, chunked = true, isComplete = cursor == null),
                loading = false,
              )
            }
          } while (cursor != null && isCurrentSelection())
        }
      } catch (cancelled: CancellationException) {
        throw cancelled
      } catch (failure: Throwable) {
        if (isCurrentSelection()) mutableDocument.value = LoadState(loading = false, error = failure.readable())
      }
    }
  }

  suspend fun createRequest(title: String, description: String?, output: String, review: String?, priorityId: String?): Boolean {
    if ("create-request" in mutablePending.value) return false
    val fingerprint = listOf(title, description, output, review, priorityId).joinToString("\u0000")
    val clientId = retryClientId?.takeIf { it.first == fingerprint }?.second ?: UUID.randomUUID().toString()
    retryClientId = fingerprint to clientId
    return action("create-request") {
      coroutineScope {
        withTimeout(20_000) {
          val confirmation = async {
            repository.requestByClientId(orgSlug, clientId)
              .first { result -> result.getOrNull() != null }
              .getOrThrow()
          }
          val mutation = async {
            repository.createRequest(orgSlug, title, description, output, review, priorityId, clientId)
          }
          try {
            select<CreateRequestResult> {
              confirmation.onAwait { requireNotNull(it) }
              mutation.onAwait { it }
            }
          } finally {
            confirmation.cancel()
            mutation.cancel()
          }
        }
      }
      retryClientId = null
    }
  }

  suspend fun deleteRequest(id: VectorId): Boolean = action("delete-$id") { repository.deleteRequest(id) }.also { success ->
    if (success) {
      requestHead = requestHead.filterNot { it.id == id }
      requestTail = requestTail.filterNot { it.id == id }
      mutableRequests.value = LoadState(mergeRequests(requestHead, requestTail), loading = false)
    }
  }
  suspend fun claimRequest(id: VectorId): Boolean = action("claim-$id") { repository.claimRequest(id) }.also { if (it) invalidateRequestTail() }
  suspend fun completeRequest(id: VectorId): Boolean = action("complete-$id") { repository.completeRequest(id) }.also { if (it) invalidateRequestTail() }
  suspend fun requestChanges(id: VectorId, note: String): Boolean = action("changes-$id") { repository.requestChanges(id, note) }.also { if (it) invalidateRequestTail() }
  suspend fun sendMessage(session: WorkSession, body: String): Boolean = action("send-${session.id}") { repository.sendAgentMessage(session.id, body.trim()) }
  fun clearActionError() { mutableActionError.value = null }

  private fun invalidateRequestTail() {
    requestTail = emptyList()
    mutableRequestsNext.value = requestHeadNext
    mutableRequests.value = LoadState(requestHead, loading = false)
  }

  private suspend fun <S, T> kotlinx.coroutines.flow.Flow<Result<S>>.collectResult(target: MutableStateFlow<LoadState<T>>, map: (S) -> T) {
    catch { target.value = LoadState(loading = false, error = it.readable()) }.collect { result ->
      target.value = result.fold(
        onSuccess = { LoadState(map(it), loading = false) },
        onFailure = { LoadState(loading = false, error = it.readable()) },
      )
    }
  }

  private suspend fun action(key: String, block: suspend () -> Unit): Boolean {
    mutablePending.update { it + key }
    mutableActionError.value = null
    return runCatching { block() }.fold(
      onSuccess = { true },
      onFailure = { mutableActionError.value = it.readable(); false },
    ).also { mutablePending.update { it - key } }
  }

  class Factory(
    private val orgSlug: String,
    private val repository: VectorRepository,
    private val preferences: VectorPreferenceStore,
  ) : ViewModelProvider.Factory {
    @Suppress("UNCHECKED_CAST")
    override fun <T : ViewModel> create(modelClass: Class<T>): T = VectorViewModel(orgSlug, repository, preferences) as T
  }
}

private fun Throwable.readable(): String = message?.lineSequence()?.firstOrNull()?.take(220) ?: "Something went wrong."

private fun mergeRequests(first: List<RequestRow>, second: List<RequestRow>): List<RequestRow> =
  (first + second).distinctBy { it.id }

private fun mergeDocuments(first: List<Document>, second: List<Document>): List<Document> =
  (first + second).distinctBy { it.id }

private fun mergeWork(first: List<WorkRow>, second: List<WorkRow>): List<WorkRow> =
  (first + second).distinctBy { it.id }

private fun mergeInbox(first: List<InboxNotification>, second: List<InboxNotification>): List<InboxNotification> =
  (first + second).distinctBy { it.id }

private fun mergeEntities(first: List<EntitySummary>, second: List<EntitySummary>): List<EntitySummary> =
  (first + second).distinctBy { it.id }
