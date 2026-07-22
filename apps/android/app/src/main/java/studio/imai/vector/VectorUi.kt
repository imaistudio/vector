package studio.imai.vector

import androidx.activity.compose.BackHandler
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.asPaddingValues
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.selection.SelectionContainer
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.ArrowUpward
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Description
import androidx.compose.material.icons.filled.Folder
import androidx.compose.material.icons.filled.GroupWork
import androidx.compose.material.icons.filled.Inbox
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.SwapHoriz
import androidx.compose.material.icons.filled.Workspaces
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.AssistChip
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Divider
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.ViewModelStore
import androidx.lifecycle.ViewModelStoreOwner
import androidx.lifecycle.viewmodel.compose.viewModel
import kotlinx.coroutines.launch

private enum class RootTab(val label: String, val icon: ImageVector) {
  Requests("Requests", Icons.Default.Inbox),
  Work("Work", Icons.Default.GroupWork),
  Workspace("Workspace", Icons.Default.Workspaces),
  Inbox("Inbox", Icons.Default.Notifications),
  Settings("Settings", Icons.Default.Settings),
}

@Composable
fun VectorRoot(state: SessionState, error: String?, busy: Boolean, controller: VectorSessionController) {
  when (state) {
    SessionState.Restoring -> RestoreSkeleton()
    SessionState.SignedOut -> SetupScreen(error, busy, controller)
    is SessionState.SignedIn -> key(state.instanceId, state.session.orgSlug) {
      val owner = remember(state.instanceId, state.session.orgSlug) { AuthenticatedViewModelOwner() }
      DisposableEffect(owner) { onDispose { owner.viewModelStore.clear() } }
      val model: VectorViewModel = viewModel(
        viewModelStoreOwner = owner,
        factory = VectorViewModel.Factory(requireNotNull(state.session.orgSlug), state.repository, state.preferences),
      )
      SignedInShell(state, model, controller)
    }
  }
}

private class AuthenticatedViewModelOwner : ViewModelStoreOwner {
  override val viewModelStore = ViewModelStore()
}

@Composable
private fun RestoreSkeleton() {
  Column(Modifier.fillMaxSize().padding(WindowInsets.safeDrawing.asPaddingValues()).padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
    repeat(6) { Skeleton(Modifier.fillMaxWidth().height(if (it == 0) 34.dp else 58.dp)) }
  }
}

@Composable
private fun SetupScreen(error: String?, busy: Boolean, controller: VectorSessionController) {
  var appUrl by rememberSaveable { mutableStateOf("imai.tech") }
  var identifier by rememberSaveable { mutableStateOf("") }
  var password by remember { mutableStateOf("") }
  var workspace by rememberSaveable { mutableStateOf("") }
  Column(
    Modifier.fillMaxSize().testTag("setup-screen").padding(WindowInsets.safeDrawing.asPaddingValues()).padding(24.dp).verticalScroll(rememberScrollState()),
    verticalArrangement = Arrangement.Center,
  ) {
    Surface(color = Color(0xFF111827), shape = RoundedCornerShape(10.dp), modifier = Modifier.size(44.dp)) {
      Box(contentAlignment = Alignment.Center) { Text("V", color = Color.White, style = MaterialTheme.typography.titleLarge) }
    }
    Spacer(Modifier.height(18.dp))
    Text("Vector", style = MaterialTheme.typography.titleLarge)
    Text("Sign in to your workspace", color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium)
    Spacer(Modifier.height(20.dp))
    OutlinedTextField(appUrl, { appUrl = it }, label = { Text("Vector domain") }, singleLine = true, enabled = !busy, modifier = Modifier.fillMaxWidth())
    OutlinedTextField(identifier, { identifier = it }, label = { Text("Email or username") }, singleLine = true, enabled = !busy, modifier = Modifier.fillMaxWidth())
    OutlinedTextField(
      password,
      { password = it },
      label = { Text("Password") },
      singleLine = true,
      enabled = !busy,
      visualTransformation = PasswordVisualTransformation(),
      keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
      modifier = Modifier.fillMaxWidth(),
    )
    OutlinedTextField(workspace, { workspace = it }, label = { Text("Workspace slug (optional)") }, singleLine = true, enabled = !busy, modifier = Modifier.fillMaxWidth())
    if (error != null) Text(error, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall, modifier = Modifier.padding(top = 8.dp))
    Button(
      onClick = {
        val submittedPassword = password
        password = ""
        controller.signIn(appUrl, identifier, submittedPassword, workspace.takeIf { it.isNotBlank() })
      },
      enabled = !busy && appUrl.isNotBlank() && identifier.isNotBlank() && password.isNotBlank(),
      modifier = Modifier.fillMaxWidth().padding(top = 14.dp),
    ) {
      if (busy) CircularProgressIndicator(Modifier.size(18.dp), strokeWidth = 2.dp) else Text("Sign in")
    }
    Text("Your password is used only for sign-in and is never stored.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(top = 10.dp))
  }
}

@Composable
private fun SignedInShell(session: SessionState.SignedIn, model: VectorViewModel, controller: VectorSessionController) {
  var tab by rememberSaveable { mutableStateOf(RootTab.Work) }
  Scaffold(
    contentWindowInsets = WindowInsets.safeDrawing,
    bottomBar = {
      NavigationBar(containerColor = MaterialTheme.colorScheme.surface) {
        RootTab.entries.forEach { item ->
          NavigationBarItem(selected = tab == item, onClick = { tab = item }, icon = { Icon(item.icon, item.label) }, label = { Text(item.label, maxLines = 1) })
        }
      }
    },
  ) { padding ->
    Box(Modifier.fillMaxSize().padding(padding)) {
      when (tab) {
        RootTab.Requests -> RequestsScreen(model)
        RootTab.Work -> WorkScreen(model)
        RootTab.Workspace -> WorkspaceScreen(model)
        RootTab.Inbox -> InboxScreen(model)
        RootTab.Settings -> SettingsScreen(session, controller)
      }
    }
  }
}

@Composable private fun ScreenHeader(title: String, actions: @Composable RowScope.() -> Unit = {}) {
  Row(Modifier.fillMaxWidth().height(48.dp).padding(horizontal = 12.dp), verticalAlignment = Alignment.CenterVertically) {
    Text(title, style = MaterialTheme.typography.titleMedium, modifier = Modifier.weight(1f))
    actions()
  }
  HorizontalDivider()
}

@OptIn(ExperimentalMaterial3Api::class, ExperimentalFoundationApi::class)
@Composable
private fun RequestsScreen(model: VectorViewModel) {
  val state by model.requests.collectAsStateWithLifecycle()
  val scope by model.requestScope.collectAsStateWithLifecycle()
  val group by model.requestGroup.collectAsStateWithLifecycle()
  val priorities by model.options.collectAsStateWithLifecycle()
  val nextCursor by model.requestsNext.collectAsStateWithLifecycle()
  val pending by model.pending.collectAsStateWithLifecycle()
  val actionError by model.actionError.collectAsStateWithLifecycle()
  var selected by remember { mutableStateOf<RequestRow?>(null) }
  var creating by remember { mutableStateOf(false) }
  var groupMenu by remember { mutableStateOf(false) }
  if (selected != null) {
    RequestDetailScreen(selected!!, model) { selected = null }
    return
  }
  val requests = state.value
  Column(Modifier.fillMaxSize()) {
    ScreenHeader("Requests") {
      Box {
        IconButton({ groupMenu = true }) { Icon(Icons.Default.MoreVert, "Group requests") }
        DropdownMenu(groupMenu, { groupMenu = false }) {
          RequestGroup.entries.forEach { option -> DropdownMenuItem({ Text(option.label) }, { model.setRequestGroup(option); groupMenu = false }) }
        }
      }
      IconButton({ creating = true }) { Icon(Icons.Default.Add, "Create request") }
    }
    SearchField("Search title, description, or output", model.requestSearch.collectAsStateWithLifecycle().value) { model.requestSearch.value = it }
    ScopeRow(RequestScope.entries, scope, { it.label }) { model.requestScope.value = it }
    actionError?.let { InlineError(it) }
    when {
      state.loading && requests == null -> ListSkeleton()
      state.error != null -> ErrorState(state.error!!)
      requests.isNullOrEmpty() -> EmptyState("No requests", "Requests in this view will appear here.")
      group == RequestGroup.None -> LazyColumn(Modifier.fillMaxSize()) {
        items(requests, key = { it.id }) { RequestRowView(it, priorities.issuePriorities) { selected = it } }
        if (nextCursor != null) item { LoadMoreButton("requests-more" in pending, model::loadMoreRequests) }
      }
      else -> {
        val sections = groupRequests(requests, group, priorities.issuePriorities)
        LazyColumn(Modifier.fillMaxSize()) {
          sections.forEach { section ->
            stickyHeader { GroupHeader(section.label, section.requests.size) }
            items(section.requests, key = { it.id }) { RequestRowView(it, priorities.issuePriorities) { selected = it } }
          }
          if (nextCursor != null) item { LoadMoreButton("requests-more" in pending, model::loadMoreRequests) }
        }
      }
    }
  }
  if (creating) CreateRequestSheet(model) { creating = false }
}

@Composable private fun RequestRowView(row: RequestRow, priorities: List<Priority>, onClick: () -> Unit) {
  val priority = priorities.firstOrNull { it.id == row.priorityId }
  Column(Modifier.fillMaxWidth().clickable(onClick = onClick).padding(horizontal = 14.dp, vertical = 9.dp)) {
    Row(verticalAlignment = Alignment.CenterVertically) {
      StatusDot(row.status)
      Text(row.key, style = MonoStyle, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(horizontal = 7.dp))
      Text(row.title, style = MaterialTheme.typography.titleSmall, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f))
      priority?.let { Text(it.name, style = MaterialTheme.typography.labelSmall, color = VectorAccent) }
    }
    Text(row.expectedOutput, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 2, overflow = TextOverflow.Ellipsis, modifier = Modifier.padding(start = 14.dp, top = 3.dp))
  }
  HorizontalDivider()
}

@Composable private fun RequestDetailScreen(row: RequestRow, model: VectorViewModel, back: () -> Unit) {
  val state by model.requestDetail.collectAsStateWithLifecycle()
  val pending by model.pending.collectAsStateWithLifecycle()
  val actionError by model.actionError.collectAsStateWithLifecycle()
  val coroutine = rememberCoroutineScope()
  var confirmDelete by remember { mutableStateOf(false) }
  var requestChanges by remember { mutableStateOf(false) }
  var changesNote by remember { mutableStateOf("") }
  val detail = state.value
  BackHandler(onBack = back)
  LaunchedEffect(row.key) { model.clearActionError(); model.loadRequest(row.key) }
  Column(Modifier.fillMaxSize()) {
    DetailHeader(row.key, back)
    when {
      state.loading -> ListSkeleton(4)
      state.error != null -> ErrorState(state.error!!)
      detail != null -> {
        Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
          Row(verticalAlignment = Alignment.CenterVertically) { Text(detail.title, style = MaterialTheme.typography.titleLarge, modifier = Modifier.weight(1f)); StatusPill(requestStatusLabel(detail.status)) }
          detail.description?.takeIf { it.isNotBlank() }?.let { Text(it, color = MaterialTheme.colorScheme.onSurfaceVariant) }
          Section("Expected output") { SelectionContainer { Text(detail.expectedOutput) } }
          detail.reviewGuidance?.takeIf { it.isNotBlank() }?.let { Section("Review guidance") { Text(it) } }
          Section("Routing") { Text("Owner: ${detail.owner?.displayName ?: "Unassigned"}"); Text("Requester: ${detail.requester?.displayName ?: "Unknown"}") }
          actionError?.let { Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall) }
          if (detail.owner == null) ActionButton("Take request", "claim-${detail.id}" in pending) { coroutine.launch { model.claimRequest(detail.id) } }
          if (detail.status in setOf("ready_for_review", "changes_requested")) ActionButton("Approve and complete", "complete-${detail.id}" in pending) { coroutine.launch { model.completeRequest(detail.id) } }
          if (detail.status == "ready_for_review") OutlinedButton({ requestChanges = true }, enabled = "changes-${detail.id}" !in pending) { Text("Request changes") }
          if (detail.canDelete) OutlinedButton({ confirmDelete = true }, enabled = "delete-${detail.id}" !in pending, border = BorderStroke(1.dp, MaterialTheme.colorScheme.error)) { Icon(Icons.Default.Delete, null, tint = MaterialTheme.colorScheme.error); Spacer(Modifier.width(6.dp)); Text("Delete request", color = MaterialTheme.colorScheme.error) }
        }
        val deleteBusy = "delete-${detail.id}" in pending
        if (confirmDelete) AlertDialog(
          onDismissRequest = { if (!deleteBusy) confirmDelete = false },
          title = { Text("Delete request?") },
          text = { Text(if (detail.linkedWork.isEmpty()) "This cannot be undone." else "The request will be detached from linked Work. The Work itself will remain.") },
          dismissButton = { TextButton({ confirmDelete = false }, enabled = !deleteBusy) { Text("Cancel") } },
          confirmButton = { TextButton({ coroutine.launch { if (model.deleteRequest(detail.id)) { confirmDelete = false; back() } } }, enabled = !deleteBusy) { if (deleteBusy) CircularProgressIndicator(Modifier.size(18.dp), strokeWidth = 2.dp) else Text("Delete", color = MaterialTheme.colorScheme.error) } },
        )
        val changesBusy = "changes-${detail.id}" in pending
        if (requestChanges) AlertDialog(
          onDismissRequest = { if (!changesBusy) requestChanges = false },
          title = { Text("Request changes") },
          text = { OutlinedTextField(changesNote, { changesNote = it }, label = { Text("What needs to change?") }, minLines = 3, enabled = !changesBusy, modifier = Modifier.fillMaxWidth()) },
          dismissButton = { TextButton({ requestChanges = false }, enabled = !changesBusy) { Text("Cancel") } },
          confirmButton = { TextButton({ coroutine.launch { if (model.requestChanges(detail.id, changesNote.trim())) requestChanges = false } }, enabled = changesNote.isNotBlank() && !changesBusy) { if (changesBusy) CircularProgressIndicator(Modifier.size(18.dp), strokeWidth = 2.dp) else Text("Send") } },
        )
      }
    }
  }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable private fun CreateRequestSheet(model: VectorViewModel, dismiss: () -> Unit) {
  val priorities by model.options.collectAsStateWithLifecycle()
  val prioritiesError by model.optionsError.collectAsStateWithLifecycle()
  val pending by model.pending.collectAsStateWithLifecycle()
  val error by model.actionError.collectAsStateWithLifecycle()
  val coroutine = rememberCoroutineScope()
  var title by remember { mutableStateOf("") }; var description by remember { mutableStateOf("") }; var output by remember { mutableStateOf("") }; var review by remember { mutableStateOf("") }
  var priority by remember { mutableStateOf<Priority?>(null) }; var menu by remember { mutableStateOf(false) }
  val busy = "create-request" in pending
  ModalBottomSheet(onDismissRequest = { if (!busy) dismiss() }) {
    Column(Modifier.fillMaxWidth().imePadding().padding(16.dp).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(10.dp)) {
      Text("New request", style = MaterialTheme.typography.titleMedium)
      OutlinedTextField(title, { title = it }, label = { Text("What do you need?") }, enabled = !busy, modifier = Modifier.fillMaxWidth())
      OutlinedTextField(description, { description = it }, label = { Text("Context and constraints") }, minLines = 2, enabled = !busy, modifier = Modifier.fillMaxWidth())
      OutlinedTextField(output, { output = it }, label = { Text("Required output") }, minLines = 2, enabled = !busy, modifier = Modifier.fillMaxWidth())
      OutlinedTextField(review, { review = it }, label = { Text("Review guidance") }, minLines = 2, enabled = !busy, modifier = Modifier.fillMaxWidth())
      Box { OutlinedButton({ menu = true }, enabled = !busy) { Text(priority?.name ?: "No priority") }; DropdownMenu(menu, { menu = false }) { DropdownMenuItem({ Text("No priority") }, { priority = null; menu = false }); priorities.issuePriorities.filter { it.weight > 0 }.sortedByDescending { it.weight }.forEach { p -> DropdownMenuItem({ Text(p.name) }, { priority = p; menu = false }) } } }
      prioritiesError?.let { Text("Priorities could not be loaded: $it", color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall) }
      error?.let { Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall) }
      Button(
        { coroutine.launch { if (model.createRequest(title.trim(), description.trim().takeIf { it.isNotEmpty() }, output.trim(), review.trim().takeIf { it.isNotEmpty() }, priority?.id)) dismiss() } },
        enabled = !busy && title.isNotBlank() && output.isNotBlank(), modifier = Modifier.fillMaxWidth(),
      ) { if (busy) CircularProgressIndicator(Modifier.size(18.dp), strokeWidth = 2.dp) else Text("Create request") }
      Spacer(Modifier.height(12.dp))
    }
  }
}

@Composable private fun WorkScreen(model: VectorViewModel) {
  val state by model.work.collectAsStateWithLifecycle(); val scope by model.workScope.collectAsStateWithLifecycle()
  val nextCursor by model.workNext.collectAsStateWithLifecycle(); val pending by model.pending.collectAsStateWithLifecycle()
  val actionError by model.actionError.collectAsStateWithLifecycle()
  var selected by remember { mutableStateOf<WorkRow?>(null) }
  if (selected != null) { WorkDetailScreen(selected!!, model) { selected = null }; return }
  val work = state.value
  Column(Modifier.fillMaxSize()) {
    ScreenHeader("Work")
    ScopeRow(WorkScope.entries, scope, { it.label }) { model.workScope.value = it }
    actionError?.let { InlineError(it) }
    when { state.loading || (work.isNullOrEmpty() && "work-more" in pending) -> ListSkeleton(); state.error != null -> ErrorState(state.error!!); work.isNullOrEmpty() -> EmptyState("No Work", "Active Work and reviews will appear here."); else -> LazyColumn(Modifier.fillMaxSize()) {
      items(work, key = { it.id }) { row ->
        Column(Modifier.fillMaxWidth().clickable { selected = row }.padding(horizontal = 14.dp, vertical = 9.dp)) {
          Row(verticalAlignment = Alignment.CenterVertically) { StatusDot(row.workStatus); Text(row.key, style = MonoStyle, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(horizontal = 7.dp)); Text(row.title, style = MaterialTheme.typography.titleSmall, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f)); StatusPill(row.workStatus.replace('_', ' ')) }
          Text("${row.owner?.displayName ?: "Unassigned"}  ·  ${row.taskProgress.done.toInt()}/${row.taskProgress.total.toInt()} tasks", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(start = 14.dp, top = 4.dp))
        }
        HorizontalDivider()
      }
      if (nextCursor != null) item { LoadMoreButton("work-more" in pending, model::loadMoreWork) }
    } }
  }
}

@Composable private fun WorkDetailScreen(row: WorkRow, model: VectorViewModel, back: () -> Unit) {
  val state by model.workDetail.collectAsStateWithLifecycle(); val sessions by model.sessions.collectAsStateWithLifecycle()
  var selectedSession by remember { mutableStateOf<WorkSession?>(null) }
  if (selectedSession != null) { AgentSessionScreen(selectedSession!!, model) { selectedSession = null }; return }
  val detail = state.value
  BackHandler(onBack = back); LaunchedEffect(row.id) { model.loadWork(row) }
  Column(Modifier.fillMaxSize()) { DetailHeader(row.key, back); when { state.loading -> ListSkeleton(4); state.error != null -> ErrorState(state.error!!); detail != null -> LazyColumn(Modifier.fillMaxSize()) {
    item { Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) { Row { Text(detail.title, style = MaterialTheme.typography.titleLarge, modifier = Modifier.weight(1f)); StatusPill(detail.workStatus.replace('_', ' ')) }; detail.description?.let { Text(it, color = MaterialTheme.colorScheme.onSurfaceVariant) } } }
    item { GroupHeader("Work sessions", sessions.value?.size ?: 0) }
    if (sessions.loading) items(3) { Skeleton(Modifier.fillMaxWidth().height(56.dp).padding(8.dp)) }
    else if (sessions.error != null) item { InlineError("Work sessions could not be loaded: ${sessions.error}") }
    else items(sessions.value.orEmpty(), key = { it.id }) { session -> Column(Modifier.fillMaxWidth().clickable { selectedSession = session }.padding(14.dp)) { Text(session.displayTitle, style = MaterialTheme.typography.titleSmall, maxLines = 1); Text("${session.providerLabel} · ${session.deviceName} · ${session.status.replace('_', ' ')}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant) }; HorizontalDivider() }
    item { GroupHeader("Tasks", detail.tasks.size) }
    items(detail.tasks, key = { it.id }) { task -> Row(Modifier.fillMaxWidth().padding(14.dp)) { StatusDot(task.status); Text(task.title, modifier = Modifier.padding(start = 8.dp).weight(1f)); Text(task.status.replace('_', ' '), style = MaterialTheme.typography.labelSmall) } }
  } } }
}

@Composable private fun AgentSessionScreen(session: WorkSession, model: VectorViewModel, back: () -> Unit) {
  val state by model.agent.collectAsStateWithLifecycle(); val pending by model.pending.collectAsStateWithLifecycle(); val coroutine = rememberCoroutineScope(); var draft by remember { mutableStateOf("") }
  val actionError by model.actionError.collectAsStateWithLifecycle()
  val agent = state.value
  val messageListState = rememberLazyListState()
  LaunchedEffect(agent?.messages?.lastOrNull()?.id) {
    val lastMessage = agent?.messages?.lastIndex ?: -1
    if (lastMessage >= 0) messageListState.animateScrollToItem(lastMessage)
  }
  BackHandler(onBack = back); LaunchedEffect(session.id) { model.loadAgent(session) }
  Column(Modifier.fillMaxSize()) {
    DetailHeader(agent?.title?.takeIf { it.isNotBlank() } ?: session.displayTitle, back)
    when { state.loading -> ListSkeleton(5); state.error != null -> ErrorState(state.error!!); agent != null -> {
      LazyColumn(Modifier.weight(1f).padding(horizontal = 12.dp), state = messageListState, contentPadding = PaddingValues(vertical = 10.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        items(agent.messages, key = { it.id }) { message -> MessageRow(message) }
      }
      val canSend = session.canSend && agent.status.lowercase() !in setOf("offline", "disconnected", "completed", "failed", "canceled")
      actionError?.let { Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall, modifier = Modifier.padding(horizontal = 12.dp)) }
      Row(Modifier.fillMaxWidth().imePadding().padding(10.dp), verticalAlignment = Alignment.Bottom) {
        OutlinedTextField(draft, { draft = it }, placeholder = { Text(if (canSend) "Message ${session.providerLabel}" else "Session unavailable") }, enabled = canSend && "send-${session.id}" !in pending, maxLines = 5, modifier = Modifier.weight(1f))
        IconButton({ val body = draft.trim(); coroutine.launch { if (model.sendMessage(session, body)) draft = "" } }, enabled = canSend && draft.isNotBlank() && "send-${session.id}" !in pending) { if ("send-${session.id}" in pending) CircularProgressIndicator(Modifier.size(18.dp), strokeWidth = 2.dp) else Icon(Icons.Default.ArrowUpward, "Send") }
      }
    } }
  }
}

@Composable private fun MessageRow(message: AgentMessage) {
  val user = message.direction == "vector_to_agent" || message.role == "user"
  if (message.role in setOf("status", "system", "compaction")) Text(message.text, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(6.dp))
  else Surface(shape = RoundedCornerShape(10.dp), border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline), color = if (user) MaterialTheme.colorScheme.surfaceVariant else MaterialTheme.colorScheme.surface, modifier = Modifier.fillMaxWidth()) {
    Column(Modifier.padding(10.dp)) { if (user) Text("You", style = MaterialTheme.typography.labelSmall, color = VectorAccent); SelectionContainer { Text(message.text, style = MaterialTheme.typography.bodyMedium) } }
  }
}

private enum class WorkspaceSection { Docs, Projects, Teams }

@Composable private fun WorkspaceScreen(model: VectorViewModel) {
  var section by rememberSaveable { mutableStateOf(WorkspaceSection.Docs) }; var document by remember { mutableStateOf<Document?>(null) }
  if (document != null) { DocumentDetailScreen(document!!, model) { document = null }; return }
  val docs by model.documents.collectAsStateWithLifecycle(); val projects by model.projects.collectAsStateWithLifecycle(); val teams by model.teams.collectAsStateWithLifecycle()
  val projectsNext by model.projectsNext.collectAsStateWithLifecycle(); val teamsNext by model.teamsNext.collectAsStateWithLifecycle(); val pending by model.pending.collectAsStateWithLifecycle()
  val actionError by model.actionError.collectAsStateWithLifecycle()
  Column(Modifier.fillMaxSize()) { ScreenHeader("Workspace"); ScopeRow(WorkspaceSection.entries, section, { it.name }) { section = it }; actionError?.let { InlineError(it) }; when (section) {
    WorkspaceSection.Docs -> PaginatedDocuments(docs, model) { document = it }
    WorkspaceSection.Projects -> PaginatedEntities(projects, projectsNext, "projects-more" in pending, model::loadMoreProjects, "No projects")
    WorkspaceSection.Teams -> PaginatedEntities(teams, teamsNext, "teams-more" in pending, model::loadMoreTeams, "No teams")
  } }
}

@Composable private fun PaginatedDocuments(state: LoadState<List<Document>>, model: VectorViewModel, select: (Document) -> Unit) {
  val nextCursor by model.documentsNext.collectAsStateWithLifecycle()
  val pending by model.pending.collectAsStateWithLifecycle()
  val documents = state.value
  when {
    state.loading && documents == null -> ListSkeleton()
    state.error != null -> ErrorState(state.error!!)
    documents.isNullOrEmpty() -> EmptyState("No documents", "Workspace documents will appear here.")
    else -> LazyColumn(Modifier.fillMaxSize()) {
      items(documents, key = { it.id }) { row ->
        Column(Modifier.fillMaxWidth().clickable { select(row) }.padding(14.dp)) {
          Text(row.title, style = MaterialTheme.typography.titleSmall)
          Text(row.visibility ?: "Workspace", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        HorizontalDivider()
      }
      if (nextCursor != null) item { LoadMoreButton("documents-more" in pending, model::loadMoreDocuments) }
    }
  }
}

@Composable private fun DocumentDetailScreen(row: Document, model: VectorViewModel, back: () -> Unit) {
  val state by model.document.collectAsStateWithLifecycle(); BackHandler(onBack = back); LaunchedEffect(row.id) { model.loadDocument(row) }
  val content = state.value
  Column(Modifier.fillMaxSize()) {
    DetailHeader(row.title, back)
    when {
      state.loading && content == null -> ListSkeleton(6)
      state.error != null -> ErrorState(state.error!!)
      content != null -> {
        if (content.segments.isEmpty() && content.isComplete) EmptyState("Empty document", "This document has no content.")
        else SelectionContainer {
          LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(18.dp)) {
            items(content.segments) { segment -> Text(segment, style = MaterialTheme.typography.bodyLarge) }
            if (!content.isComplete) item { Skeleton(Modifier.fillMaxWidth().height(72.dp)) }
          }
        }
      }
    }
  }
}

@Composable private fun InboxScreen(model: VectorViewModel) {
  val state by model.inbox.collectAsStateWithLifecycle(); val inbox = state.value
  val nextCursor by model.inboxNext.collectAsStateWithLifecycle(); val pending by model.pending.collectAsStateWithLifecycle()
  val actionError by model.actionError.collectAsStateWithLifecycle()
  Column(Modifier.fillMaxSize()) { ScreenHeader("Inbox"); actionError?.let { InlineError(it) }; when { state.loading -> ListSkeleton(); state.error != null -> ErrorState(state.error!!); inbox.isNullOrEmpty() -> EmptyState("Inbox clear", "Notifications and activity will appear here."); else -> LazyColumn(Modifier.fillMaxSize()) {
    items(inbox, key = { it.id }) { item -> Column(Modifier.fillMaxWidth().padding(14.dp)) { Text(item.title, style = MaterialTheme.typography.titleSmall); Text(item.body, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 2) }; HorizontalDivider() }
    if (nextCursor != null) item { LoadMoreButton("inbox-more" in pending, model::loadMoreInbox) }
  } } }
}

@Composable private fun SettingsScreen(session: SessionState.SignedIn, controller: VectorSessionController) {
  var workspaceMenu by remember { mutableStateOf(false) }
  Column(Modifier.fillMaxSize()) {
    ScreenHeader("Settings")
    Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
      Section("Signed in") { Text(session.session.user?.displayName ?: "Vector account"); Text(session.session.user?.email.orEmpty(), style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant) }
      Section("Workspace") {
        Box { OutlinedButton({ workspaceMenu = true }) { Icon(Icons.Default.SwapHoriz, null); Spacer(Modifier.width(6.dp)); Text(session.organizations.firstOrNull { it.slug == session.session.orgSlug }?.name ?: session.session.orgSlug.orEmpty()) }; DropdownMenu(workspaceMenu, { workspaceMenu = false }) { session.organizations.forEach { org -> DropdownMenuItem({ Text(org.name) }, { controller.switchWorkspace(org); workspaceMenu = false }) } } }
      }
      Section("Instance") { Text(session.session.appUrl); Text("Session cookies are encrypted with Android Keystore.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant) }
      OutlinedButton({ controller.signOut() }) { Text("Sign out") }
    }
  }
}

@Composable private fun <T> ScopeRow(options: List<T>, selected: T, label: (T) -> String, choose: (T) -> Unit) {
  Row(Modifier.fillMaxWidth().padding(horizontal = 10.dp, vertical = 7.dp), horizontalArrangement = Arrangement.spacedBy(6.dp)) { options.forEach { FilterChip(selected == it, { choose(it) }, { Text(label(it)) }) } }
  HorizontalDivider()
}

@Composable private fun SearchField(placeholder: String, value: String, changed: (String) -> Unit) {
  OutlinedTextField(value, changed, placeholder = { Text(placeholder) }, leadingIcon = { Icon(Icons.Default.Search, null) }, trailingIcon = { if (value.isNotEmpty()) IconButton({ changed("") }) { Icon(Icons.Default.Close, "Clear") } }, singleLine = true, modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 7.dp))
}

@Composable private fun DetailHeader(title: String, back: () -> Unit) { Row(Modifier.fillMaxWidth().height(48.dp), verticalAlignment = Alignment.CenterVertically) { IconButton(back) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back") }; Text(title, style = MaterialTheme.typography.titleSmall, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f).padding(end = 12.dp)) }; HorizontalDivider() }
@Composable private fun GroupHeader(label: String, count: Int) { Row(Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 8.dp).clip(RoundedCornerShape(6.dp))) { Text(label, style = MaterialTheme.typography.labelLarge); Text("  $count", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant) } }
@Composable private fun Section(label: String, content: @Composable ColumnScope.() -> Unit) { Column(verticalArrangement = Arrangement.spacedBy(5.dp)) { Text(label.uppercase(), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant); content() } }
@Composable private fun StatusPill(label: String) { Surface(shape = RoundedCornerShape(10.dp), color = MaterialTheme.colorScheme.surfaceVariant) { Text(label, style = MaterialTheme.typography.labelSmall, modifier = Modifier.padding(horizontal = 7.dp, vertical = 3.dp)) } }
@Composable private fun StatusDot(status: String) { val color = when { status in setOf("completed", "done") -> Color(0xFF10B981); status in setOf("blocked", "changes_requested") -> Color(0xFFF59E0B); status in setOf("failed", "canceled") -> Color(0xFFEF4444); else -> VectorAccent }; Surface(color = color, shape = CircleShape, modifier = Modifier.size(7.dp)) {} }
@Composable private fun Skeleton(modifier: Modifier) {
  val transition = rememberInfiniteTransition(label = "skeleton")
  val opacity by transition.animateFloat(
    initialValue = 0.45f,
    targetValue = 1f,
    animationSpec = infiniteRepeatable(animation = tween(850), repeatMode = RepeatMode.Reverse),
    label = "skeleton-opacity",
  )
  Box(modifier.alpha(opacity).clip(RoundedCornerShape(6.dp)).background(MaterialTheme.colorScheme.surfaceVariant))
}
@Composable private fun ListSkeleton(rows: Int = 8) { Column(Modifier.fillMaxSize().padding(12.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) { repeat(rows) { Skeleton(Modifier.fillMaxWidth().height(52.dp)) } } }
@Composable private fun ErrorState(message: String) { Column(Modifier.fillMaxSize(), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) { Text("Could not load", style = MaterialTheme.typography.titleMedium); Text(message, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(12.dp)) } }
@Composable private fun EmptyState(title: String, message: String) { Column(Modifier.fillMaxSize(), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) { Text(title, style = MaterialTheme.typography.titleMedium); Text(message, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant) } }
@Composable private fun LoadMoreButton(busy: Boolean, load: () -> Unit) {
  TextButton(load, enabled = !busy, modifier = Modifier.fillMaxWidth().height(44.dp)) {
    if (busy) CircularProgressIndicator(Modifier.size(18.dp), strokeWidth = 2.dp) else Text("Load more")
  }
}
@Composable private fun EntityRow(item: EntitySummary) { Column(Modifier.fillMaxWidth().padding(14.dp)) { Text(item.name, style = MaterialTheme.typography.titleSmall); Text(item.key, style = MonoStyle, color = MaterialTheme.colorScheme.onSurfaceVariant) }; HorizontalDivider() }
@Composable private fun PaginatedEntities(state: LoadState<List<EntitySummary>>, nextCursor: String?, busy: Boolean, load: () -> Unit, empty: String) {
  val entities = state.value
  when {
    state.loading -> ListSkeleton()
    state.error != null -> ErrorState(state.error)
    entities.isNullOrEmpty() -> EmptyState(empty, "Workspace content will appear here.")
    else -> LazyColumn(Modifier.fillMaxSize()) {
      items(entities, key = { it.id }) { EntityRow(it) }
      if (nextCursor != null) item { LoadMoreButton(busy, load) }
    }
  }
}
@Composable private fun InlineError(message: String) { Text(message, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall, modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 6.dp)) }
@Composable private fun ActionButton(label: String, busy: Boolean, action: () -> Unit) { Button(action, enabled = !busy) { if (busy) CircularProgressIndicator(Modifier.size(18.dp), strokeWidth = 2.dp) else Text(label) } }
