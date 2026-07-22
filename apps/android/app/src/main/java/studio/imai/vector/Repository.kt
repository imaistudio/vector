package studio.imai.vector

import dev.convex.android.ConvexClient
import kotlinx.coroutines.flow.Flow

object VectorFunctions {
  const val Organizations = "users:getOrganizations"
  const val Requests = "requests/queries:list"
  const val Request = "requests/queries:getByKey"
  const val RequestByClientId = "requests/queries:getByClientRequestId"
  const val CreateRequest = "requests/mutations:create"
  const val DeleteRequest = "requests/mutations:remove"
  const val ClaimRequest = "requests/mutations:claim"
  const val CompleteRequest = "requests/mutations:complete"
  const val RequestChanges = "requests/mutations:requestChanges"
  const val Work = "work/queries:list"
  const val WorkDetail = "work/queries:getByKey"
  const val WorkSessions = "agentBridge/queries:listIssueLiveActivities"
  const val AgentSession = "agentBridge/queries:getAgentSessionSnapshot"
  const val SendAgentMessage = "agentBridge/mutations:appendLiveMessage"
  const val Documents = "documents/queries:listPage"
  const val Document = "documents/queries:getById"
  const val DocumentChunks = "documents/content:listChunks"
  const val Projects = "projects/queries:listPage"
  const val Teams = "teams/queries:listPage"
  const val WorkspaceOptions = "organizations/queries:getWorkspaceOptions"
  const val Inbox = "notifications/queries:listInbox"
}

interface VectorRepository {
  fun requests(orgSlug: String, scope: RequestScope, search: String?, cursor: String? = null): Flow<Result<Page<RequestRow>>>
  fun request(orgSlug: String, key: String): Flow<Result<RequestDetail?>>
  fun requestByClientId(orgSlug: String, clientRequestId: String): Flow<Result<CreateRequestResult?>>
  suspend fun createRequest(orgSlug: String, title: String, description: String?, output: String, review: String?, priorityId: String?, clientRequestId: String): CreateRequestResult
  suspend fun deleteRequest(requestId: VectorId)
  suspend fun claimRequest(requestId: VectorId)
  suspend fun completeRequest(requestId: VectorId)
  suspend fun requestChanges(requestId: VectorId, note: String)
  fun work(orgSlug: String, scope: WorkScope, cursor: String? = null): Flow<Result<Page<WorkRow>>>
  fun workDetail(orgSlug: String, key: String): Flow<Result<WorkDetail?>>
  fun workSessions(issueId: VectorId): Flow<Result<List<WorkSession>>>
  fun agentSession(liveActivityId: VectorId): Flow<Result<AgentSessionSnapshot?>>
  suspend fun sendAgentMessage(liveActivityId: VectorId, body: String)
  fun documents(orgSlug: String, cursor: String? = null): Flow<Result<Page<Document>>>
  fun document(documentId: VectorId): Flow<Result<Document?>>
  fun documentChunks(documentId: VectorId, version: String, cursor: String? = null): Flow<Result<Page<DocumentChunk>>>
  fun projects(orgSlug: String, cursor: String? = null): Flow<Result<Page<EntitySummary>>>
  fun teams(orgSlug: String, cursor: String? = null): Flow<Result<Page<EntitySummary>>>
  fun workspaceOptions(orgSlug: String): Flow<Result<WorkspaceOptions>>
  fun inbox(orgSlug: String, cursor: String? = null): Flow<Result<Page<InboxNotification>>>
}

class ConvexVectorRepository(private val client: ConvexClient) : VectorRepository {
  private fun pagination(cursor: String?, size: Int = 30): Map<String, Any?> = mapOf("numItems" to size.toDouble(), "cursor" to cursor)

  override fun requests(orgSlug: String, scope: RequestScope, search: String?, cursor: String?): Flow<Result<Page<RequestRow>>> {
    val args = mutableMapOf<String, Any?>(
      "orgSlug" to orgSlug,
      "scope" to scope.wire,
      "paginationOpts" to pagination(cursor, 40),
    )
    search?.takeIf { it.isNotBlank() }?.let { args["search"] = it }
    return client.subscribe(VectorFunctions.Requests, args)
  }

  override fun request(orgSlug: String, key: String): Flow<Result<RequestDetail?>> =
    client.subscribe(VectorFunctions.Request, mapOf("orgSlug" to orgSlug, "requestKey" to key))

  override fun requestByClientId(orgSlug: String, clientRequestId: String): Flow<Result<CreateRequestResult?>> =
    client.subscribe(VectorFunctions.RequestByClientId, mapOf("orgSlug" to orgSlug, "clientRequestId" to clientRequestId))

  override suspend fun createRequest(
    orgSlug: String,
    title: String,
    description: String?,
    output: String,
    review: String?,
    priorityId: String?,
    clientRequestId: String,
  ): CreateRequestResult {
    val data = mutableMapOf<String, Any?>(
      "title" to title,
      "expectedOutput" to output,
      "visibility" to "organization",
      "clientRequestId" to clientRequestId,
    )
    description?.let { data["description"] = it }
    review?.let { data["reviewGuidance"] = it }
    priorityId?.let { data["priorityId"] = it }
    return client.mutation<CreateRequestResult>(VectorFunctions.CreateRequest, mapOf("orgSlug" to orgSlug, "data" to data))
  }

  override suspend fun deleteRequest(requestId: VectorId) { client.mutation<MutationResponse>(VectorFunctions.DeleteRequest, mapOf("requestId" to requestId)) }
  override suspend fun claimRequest(requestId: VectorId) { client.mutation<MutationResponse>(VectorFunctions.ClaimRequest, mapOf("requestId" to requestId)) }
  override suspend fun completeRequest(requestId: VectorId) { client.mutation<MutationResponse>(VectorFunctions.CompleteRequest, mapOf("requestId" to requestId)) }
  override suspend fun requestChanges(requestId: VectorId, note: String) { client.mutation<MutationResponse>(VectorFunctions.RequestChanges, mapOf("requestId" to requestId, "note" to note)) }

  override fun work(orgSlug: String, scope: WorkScope, cursor: String?): Flow<Result<Page<WorkRow>>> =
    client.subscribe(VectorFunctions.Work, mapOf("orgSlug" to orgSlug, "scope" to scope.wire, "paginationOpts" to pagination(cursor)))

  override fun workDetail(orgSlug: String, key: String): Flow<Result<WorkDetail?>> =
    client.subscribe(VectorFunctions.WorkDetail, mapOf("orgSlug" to orgSlug, "workKey" to key))

  override fun workSessions(issueId: VectorId): Flow<Result<List<WorkSession>>> =
    client.subscribe(VectorFunctions.WorkSessions, mapOf("issueId" to issueId))

  override fun agentSession(liveActivityId: VectorId): Flow<Result<AgentSessionSnapshot?>> =
    client.subscribe(VectorFunctions.AgentSession, mapOf("liveActivityId" to liveActivityId))

  override suspend fun sendAgentMessage(liveActivityId: VectorId, body: String) {
    client.mutation<VectorId>(
      VectorFunctions.SendAgentMessage,
      mapOf("liveActivityId" to liveActivityId, "direction" to "vector_to_agent", "role" to "user", "body" to body),
    )
  }

  override fun documents(orgSlug: String, cursor: String?): Flow<Result<Page<Document>>> =
    client.subscribe(
      VectorFunctions.Documents,
      mapOf("orgSlug" to orgSlug, "scope" to "all", "paginationOpts" to pagination(cursor)),
    )

  override fun document(documentId: VectorId): Flow<Result<Document?>> =
    client.subscribe(VectorFunctions.Document, mapOf("documentId" to documentId))

  override fun documentChunks(documentId: VectorId, version: String, cursor: String?): Flow<Result<Page<DocumentChunk>>> =
    client.subscribe(
      VectorFunctions.DocumentChunks,
      mapOf("documentId" to documentId, "version" to version, "paginationOpts" to pagination(cursor, 3)),
    )

  override fun projects(orgSlug: String, cursor: String?): Flow<Result<Page<EntitySummary>>> =
    client.subscribe(VectorFunctions.Projects, mapOf("orgSlug" to orgSlug, "scope" to "mine", "paginationOpts" to pagination(cursor)))

  override fun teams(orgSlug: String, cursor: String?): Flow<Result<Page<EntitySummary>>> =
    client.subscribe(VectorFunctions.Teams, mapOf("orgSlug" to orgSlug, "scope" to "mine", "paginationOpts" to pagination(cursor)))

  override fun workspaceOptions(orgSlug: String): Flow<Result<WorkspaceOptions>> =
    client.subscribe(VectorFunctions.WorkspaceOptions, mapOf("orgSlug" to orgSlug))

  override fun inbox(orgSlug: String, cursor: String?): Flow<Result<Page<InboxNotification>>> =
    client.subscribe(VectorFunctions.Inbox, mapOf("orgSlug" to orgSlug, "filter" to "all", "paginationOpts" to pagination(cursor)))
}
