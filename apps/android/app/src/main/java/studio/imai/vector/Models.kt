package studio.imai.vector

import dev.convex.android.ConvexNum
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

typealias VectorId = String

@Serializable
data class VectorUser(
  @SerialName("_id") val id: VectorId = "",
  val name: String? = null,
  val username: String? = null,
  val email: String? = null,
  val image: String? = null,
) {
  val displayName: String get() = name ?: username ?: email ?: "Unknown"
}

@Serializable
data class AuthenticatedUser(
  val id: String? = null,
  val email: String? = null,
  val name: String? = null,
  val username: String? = null,
  val image: String? = null,
) {
  val displayName: String get() = name ?: username ?: email ?: "Signed in"
}

@Serializable
data class Organization(
  @SerialName("_id") val id: VectorId,
  val name: String,
  val slug: String,
  val logo: String? = null,
)

@Serializable
data class Priority(
  @SerialName("_id") val id: VectorId,
  val name: String,
  val icon: String? = null,
  val color: String? = null,
  @ConvexNum val weight: Double = 0.0,
)

@Serializable
data class WorkspaceMember(
  @SerialName("_id") val id: VectorId = "",
  val userId: VectorId? = null,
  val user: VectorUser? = null,
) {
  val displayName: String get() = user?.displayName ?: "Member"
}

@Serializable
data class WorkspaceOptions(
  val members: List<WorkspaceMember> = emptyList(),
  val issuePriorities: List<Priority> = emptyList(),
)

enum class RequestScope(val wire: String, val label: String) {
  Inbox("inbox", "Inbox"), Mine("mine", "To me"), Requested("requested", "By me"), All("all", "All")
}

enum class RequestGroup(val wire: String, val label: String) {
  None("none", "No grouping"), Priority("priority", "Priority"), Status("status", "Status")
}

@Serializable
data class RequestRow(
  @SerialName("_id") val id: VectorId,
  val key: String,
  val title: String,
  val description: String? = null,
  val expectedOutput: String = "",
  val reviewGuidance: String? = null,
  val status: String = "new",
  val priorityId: VectorId? = null,
  val owner: VectorUser? = null,
  val requester: VectorUser? = null,
  val dueDate: String? = null,
  val canDelete: Boolean = false,
  @ConvexNum val linkedWorkCount: Double = 0.0,
  @ConvexNum val recipientCount: Double = 0.0,
  @ConvexNum val createdAt: Double = 0.0,
  @ConvexNum val updatedAt: Double = 0.0,
)

@Serializable
data class LinkedWork(
  @SerialName("_id") val id: VectorId,
  val key: String,
  val title: String,
  val workStatus: String? = null,
)

@Serializable
data class RequestDetail(
  @SerialName("_id") val id: VectorId,
  val key: String,
  val title: String,
  val description: String? = null,
  val expectedOutput: String = "",
  val reviewGuidance: String? = null,
  val status: String = "new",
  val priorityId: VectorId? = null,
  val owner: VectorUser? = null,
  val requester: VectorUser? = null,
  val linkedWork: List<LinkedWork> = emptyList(),
  val canEdit: Boolean = false,
  val canDelete: Boolean = false,
)

@Serializable data class CreateRequestResult(val requestId: VectorId, val requestKey: String)
@Serializable data class MutationResponse(val success: Boolean = true)

enum class WorkScope(val wire: String, val label: String) {
  Active("active", "Active"), Mine("mine", "Mine"), Attention("attention", "Attention"), All("all", "All")
}

@Serializable
data class TaskProgress(@ConvexNum val total: Double = 0.0, @ConvexNum val done: Double = 0.0)

@Serializable
data class WorkRow(
  @SerialName("_id") val id: VectorId,
  val key: String,
  val title: String,
  val description: String? = null,
  val workStatus: String = "planned",
  val owner: VectorUser? = null,
  val effort: String? = null,
  val taskProgress: TaskProgress = TaskProgress(),
  @ConvexNum val activeExecutionCount: Double = 0.0,
  @ConvexNum val openAttentionCount: Double = 0.0,
  @ConvexNum val lastMeaningfulActivityAt: Double = 0.0,
)

@Serializable
data class WorkTask(
  @SerialName("_id") val id: VectorId,
  val title: String,
  val status: String = "todo",
  val assignee: VectorUser? = null,
)

@Serializable
data class WorkDetail(
  @SerialName("_id") val id: VectorId,
  val key: String,
  val title: String,
  val description: String? = null,
  val workStatus: String = "planned",
  val owner: VectorUser? = null,
  val tasks: List<WorkTask> = emptyList(),
  val canEdit: Boolean = false,
)

@Serializable
data class WorkSessionInfo(
  @SerialName("_id") val id: VectorId,
  val title: String? = null,
  val agentProvider: String? = null,
  val cwd: String? = null,
  val branch: String? = null,
  val canInteract: Boolean = false,
)

@Serializable
data class WorkSession(
  @SerialName("_id") val id: VectorId,
  val provider: String = "codex",
  val providerLabel: String = "Codex",
  val title: String? = null,
  val status: String = "unknown",
  val latestSummary: String? = null,
  val deviceName: String = "Machine",
  val canInteract: Boolean = false,
  val workSession: WorkSessionInfo? = null,
  @ConvexNum val lastEventAt: Double = 0.0,
) {
  val displayTitle: String get() = workSession?.title ?: title ?: latestSummary ?: "Agent session"
  val canSend: Boolean get() = canInteract && status.lowercase() !in setOf("offline", "disconnected", "completed", "failed", "canceled", "cancelled")
}

@Serializable
data class AgentMessage(
  val id: String,
  val role: String = "assistant",
  val text: String = "",
  val status: String? = null,
  val direction: String = "agent_to_vector",
  val deliveryStatus: String = "delivered",
  @ConvexNum val createdAt: Double = 0.0,
)

@Serializable
data class AgentSessionSnapshot(
  val liveActivityId: VectorId,
  val workSessionId: VectorId? = null,
  val agent: String = "codex",
  val title: String = "Agent session",
  val status: String = "unknown",
  val cwd: String? = null,
  val messages: List<AgentMessage> = emptyList(),
)

@Serializable
data class DocumentFolder(
  @SerialName("_id") val id: VectorId,
  val name: String,
)

@Serializable
data class EntitySummary(
  @SerialName("_id") val id: VectorId,
  val key: String = "",
  val name: String,
  val description: String? = null,
  val icon: String? = null,
  val color: String? = null,
)

@Serializable
data class Document(
  @SerialName("_id") val id: VectorId,
  val title: String,
  val content: String? = null,
  val contentVersion: String? = null,
  val icon: String? = null,
  val color: String? = null,
  val visibility: String? = null,
  @ConvexNum @SerialName("_creationTime") val creationTime: Double = 0.0,
  @ConvexNum val lastEditedAt: Double? = null,
)

@Serializable
data class DocumentChunk(
  @SerialName("_id") val id: VectorId,
  val documentId: VectorId,
  val version: String,
  @ConvexNum val chunkIndex: Double,
  val content: String,
)

data class DocumentContent(
  val document: Document,
  val segments: List<String>,
  val chunked: Boolean,
  val isComplete: Boolean,
)

@Serializable
data class InboxNotification(
  @SerialName("_id") val id: VectorId,
  val category: String = "unknown",
  val title: String,
  val body: String = "",
  val href: String? = null,
  val isRead: Boolean = false,
  @ConvexNum val createdAt: Double = 0.0,
)

@Serializable
data class Page<T>(
  val page: List<T>,
  val continueCursor: String = "",
  val isDone: Boolean,
) {
  val nextCursor: String? get() = continueCursor.takeUnless { isDone || it.isBlank() }
}

data class RequestGroupSection(val key: String, val label: String, val requests: List<RequestRow>)

fun groupRequests(requests: List<RequestRow>, mode: RequestGroup, priorities: List<Priority>): List<RequestGroupSection> {
  if (mode == RequestGroup.None) return emptyList()
  val byId = priorities.associateBy { it.id }
  return requests.groupBy { request ->
    if (mode == RequestGroup.Status) request.status else request.priorityId ?: "__none__"
  }.map { (key, values) ->
    RequestGroupSection(
      key = key,
      label = if (mode == RequestGroup.Status) requestStatusLabel(key) else byId[key]?.name ?: "No priority",
      requests = values,
    )
  }.sortedWith(
    if (mode == RequestGroup.Priority) compareByDescending { byId[it.key]?.weight ?: 0.0 }
    else compareBy { requestStatusOrder(it.key) }
  )
}

fun mergeDocumentChunks(
  existing: List<DocumentChunk>,
  incoming: List<DocumentChunk>,
  documentId: VectorId,
  version: String,
): List<DocumentChunk> = (existing + incoming)
  .asSequence()
  .filter { it.documentId == documentId && it.version == version }
  .distinctBy { it.id }
  .sortedBy { it.chunkIndex }
  .toList()

fun segmentDocumentText(text: String, maxChars: Int = 16 * 1024): List<String> {
  require(maxChars >= 2)
  if (text.isEmpty()) return emptyList()
  val segments = ArrayList<String>((text.length + maxChars - 1) / maxChars)
  var start = 0
  while (start < text.length) {
    var end = minOf(start + maxChars, text.length)
    if (end < text.length) {
      val newline = text.lastIndexOf('\n', end - 1)
      if (newline >= start + maxChars / 2) end = newline + 1
      if (Character.isHighSurrogate(text[end - 1]) && Character.isLowSurrogate(text[end])) end--
    }
    segments += text.substring(start, end)
    start = end
  }
  return segments
}

fun requestStatusLabel(value: String): String = when (value) {
  "new" -> "Needs routing"
  "in_delivery" -> "In delivery"
  "ready_for_review" -> "Ready for review"
  "changes_requested" -> "Changes requested"
  else -> value.replace('_', ' ').replaceFirstChar { it.uppercase() }
}

private fun requestStatusOrder(value: String): Int = listOf(
  "new", "routed", "planned", "in_delivery", "ready_for_review", "changes_requested", "completed", "declined", "duplicate"
).indexOf(value).let { if (it < 0) Int.MAX_VALUE else it }
