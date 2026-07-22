import SwiftUI

struct MobileRequestsScreen: View {
  @ObservedObject var viewModel: VectorMobileViewModel
  @ObservedObject var sessionController: VectorMobileSessionController
  @State private var searchText = ""
  @State private var isCreating = false
  @State private var groupMode = VectorRequestGroupMode.none

  private var filteredRequests: [VectorRequestRow] {
    let query = searchText.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    guard !query.isEmpty else { return viewModel.requests }
    return viewModel.requests.filter {
      $0.key.lowercased().contains(query)
        || $0.title.lowercased().contains(query)
        || $0.expectedOutput.lowercased().contains(query)
    }
  }

  private var priorities: [VectorPriority] {
    viewModel.workspaceOptions?.issuePriorities ?? []
  }

  private var requestGroups: [MobileRequestGroup] {
    guard groupMode != .none else { return [] }
    let priorityById = Dictionary(uniqueKeysWithValues: priorities.map { ($0.id, $0) })
    let noPriority = priorities.first {
      $0.weight == 0 || $0.name.lowercased() == "no priority"
    }
    let statusOrder: [VectorRequestStatus] = [
      .new, .routed, .planned, .inDelivery, .readyForReview,
      .changesRequested, .completed, .declined, .duplicate, .unknown,
    ]
    var groups: [String: MobileRequestGroup] = [:]

    for request in filteredRequests {
      let key: String
      let label: String
      let sortValue: Double
      if groupMode == .status {
        key = request.status.rawValue
        label = request.status.label
        sortValue = Double(statusOrder.firstIndex(of: request.status) ?? statusOrder.count)
      } else {
        key = request.priorityId ?? noPriority?.id ?? "__none__"
        let priority = priorityById[key]
        label = priority?.name ?? "No priority"
        sortValue = -(priority?.weight ?? 0)
      }
      var group = groups[key] ?? MobileRequestGroup(
        id: key,
        label: label,
        sortValue: sortValue,
        requests: []
      )
      group.requests.append(request)
      groups[key] = group
    }

    return groups.values.sorted {
      $0.sortValue == $1.sortValue
        ? $0.label.localizedCaseInsensitiveCompare($1.label) == .orderedAscending
        : $0.sortValue < $1.sortValue
    }
  }

  private func priority(for request: VectorRequestRow) -> VectorPriority? {
    guard let priorityId = request.priorityId else { return nil }
    return priorities.first { $0.id == priorityId }
  }

  @ViewBuilder
  private func requestLink(_ request: VectorRequestRow) -> some View {
    NavigationLink {
      MobileRequestDetailScreen(request: request, viewModel: viewModel)
    } label: {
      MobileRequestRow(request: request, priority: priority(for: request))
    }
    .listRowInsets(.init(top: 9, leading: 16, bottom: 9, trailing: 12))
  }

  var body: some View {
    Group {
      if viewModel.isLoadingRequests && viewModel.requests.isEmpty {
        MobileWorkModelSkeleton(rowCount: 8)
      } else if filteredRequests.isEmpty {
        ContentUnavailableView(
          searchText.isEmpty ? "No requests" : "No matching requests",
          systemImage: "tray",
          description: Text(searchText.isEmpty ? "Incoming requests and review decisions will appear here." : "Try a request key, title, or expected output.")
        )
      } else {
        List {
          if groupMode == .none {
            ForEach(filteredRequests) { request in
              requestLink(request)
            }
          } else {
            ForEach(requestGroups) { group in
              Section {
                ForEach(group.requests) { request in
                  requestLink(request)
                }
              } header: {
                HStack(spacing: 6) {
                  Text(group.label)
                  Text("\(group.requests.count)")
                    .foregroundStyle(.tertiary)
                }
              }
            }
          }
        }
        .listStyle(.plain)
        .refreshable { viewModel.refreshRequests() }
      }
    }
    .navigationTitle("Requests")
    .vectorInlineNavigationTitle()
    .searchable(text: $searchText, prompt: "Request key, title, or output")
    .safeAreaInset(edge: .top, spacing: 0) {
      Picker("Request scope", selection: $viewModel.requestScope) {
        ForEach(VectorRequestScope.allCases) { scope in
          Text(scope.label).tag(scope)
        }
      }
      .pickerStyle(.segmented)
      .padding(.horizontal, 12)
      .padding(.vertical, 8)
      .background(.bar)
      .onChange(of: viewModel.requestScope) { _, _ in viewModel.refreshRequests() }
    }
    .toolbar {
      #if os(iOS)
      ToolbarItem(placement: .topBarLeading) {
        WorkspaceToolbarMenu(
          sessionController: sessionController,
          currentOrgSlug: viewModel.configuration.orgSlug,
          webBaseURL: viewModel.configuration.webBaseURL,
          issuesURL: viewModel.configuration.webURL(path: "/\(viewModel.configuration.orgSlug)/requests"),
          webLabel: "Open requests on web"
        )
      }
      #else
      ToolbarItem(placement: .automatic) {
        WorkspaceToolbarMenu(
          sessionController: sessionController,
          currentOrgSlug: viewModel.configuration.orgSlug,
          webBaseURL: viewModel.configuration.webBaseURL,
          issuesURL: viewModel.configuration.webURL(path: "/\(viewModel.configuration.orgSlug)/requests"),
          webLabel: "Open requests on web"
        )
      }
      #endif
      ToolbarItemGroup(placement: .primaryAction) {
        Menu {
          Picker("Group requests", selection: $groupMode) {
            ForEach(VectorRequestGroupMode.allCases) { mode in
              Text(mode.label).tag(mode)
            }
          }
        } label: {
          Image(systemName: groupMode == .none ? "rectangle.3.group" : "rectangle.3.group.fill")
        }
        .accessibilityLabel("Group requests")

        Button { isCreating = true } label: { Image(systemName: "plus") }
          .accessibilityLabel("Create request")
      }
    }
    .sheet(isPresented: $isCreating) {
      MobileCreateRequestSheet(viewModel: viewModel, isPresented: $isCreating)
    }
  }
}

private struct MobileRequestGroup: Identifiable {
  let id: String
  let label: String
  let sortValue: Double
  var requests: [VectorRequestRow]
}

private struct MobileRequestRow: View {
  let request: VectorRequestRow
  let priority: VectorPriority?

  var body: some View {
    VStack(alignment: .leading, spacing: 5) {
      HStack(spacing: 7) {
        Circle()
          .fill(requestStatusColor(request.status))
          .frame(width: 7, height: 7)
        Text(request.key)
          .font(.caption2.monospaced())
          .foregroundStyle(.secondary)
        Text(request.title)
          .font(.subheadline.weight(.medium))
          .lineLimit(1)
        Spacer(minLength: 4)
        if let priority {
          Label(priority.name, systemImage: vectorSystemImage(for: priority.icon))
            .font(.caption2)
            .foregroundStyle(Color(vectorHex: priority.color))
            .lineLimit(1)
        }
        Text(request.status.label)
          .font(.caption2.weight(.medium))
          .foregroundStyle(requestStatusColor(request.status))
      }
      Text(request.expectedOutput)
        .font(.caption)
        .foregroundStyle(.secondary)
        .lineLimit(2)
      HStack(spacing: 10) {
        Label(request.owner?.displayName ?? "Unassigned", systemImage: "person")
        if request.linkedWorkCount > 0 {
          Label("\(Int(request.linkedWorkCount)) Work", systemImage: "link")
        }
        Spacer()
        Text(relativeWorkModelTimestamp(request.updatedAt))
      }
      .font(.caption2)
      .foregroundStyle(.tertiary)
    }
  }
}

struct MobileRequestDetailScreen: View {
  let request: VectorRequestRow
  @ObservedObject var viewModel: VectorMobileViewModel
  @State private var changesNote = ""
  @State private var isRequestingChanges = false
  @State private var isCreatingWork = false

  var body: some View {
    Group {
      if let detail = viewModel.selectedRequest, detail.id == request.id || detail.key == request.key {
        List {
          Section {
            VStack(alignment: .leading, spacing: 10) {
              HStack {
                Text(detail.key).font(.caption.monospaced()).foregroundStyle(.secondary)
                Spacer()
                MobileStatusPill(label: detail.status.label, color: requestStatusColor(detail.status))
              }
              Text(detail.title).font(.title3.weight(.semibold))
              if let description = detail.description, !description.isEmpty {
                Text(description).font(.subheadline).foregroundStyle(.secondary)
              }
            }
            .padding(.vertical, 4)
          }

          Section("Expected output") {
            Text(detail.expectedOutput)
              .font(.body)
              .textSelection(.enabled)
            if let guidance = detail.reviewGuidance, !guidance.isEmpty {
              LabeledContent("Review guidance") { Text(guidance).multilineTextAlignment(.trailing) }
            }
          }

          Section("Routing") {
            if let priorityId = detail.priorityId,
               let priority = viewModel.workspaceOptions?.issuePriorities.first(where: { $0.id == priorityId })
            {
              LabeledContent("Priority", value: priority.name)
            }
            LabeledContent("Owner", value: detail.owner?.displayName ?? "Unassigned")
            LabeledContent("Requester", value: detail.requester?.displayName ?? "Unknown")
            if detail.recipients.count > 1 {
              LabeledContent("Recipients", value: detail.recipients.compactMap(\.user?.displayName).joined(separator: ", "))
            }
          }


          if detail.canEdit {
            Section {
              Button { isCreatingWork = true } label: {
                Label("Create linked Work", systemImage: "scope")
              }
            }
          }

          if !detail.linkedWork.isEmpty {
            Section("Work") {
              ForEach(detail.linkedWork) { work in
                VStack(alignment: .leading, spacing: 3) {
                  HStack {
                    Text(work.key).font(.caption.monospaced()).foregroundStyle(.secondary)
                    Text(work.title).font(.subheadline.weight(.medium)).lineLimit(1)
                    Spacer()
                    if let status = work.workStatus {
                      Text(status.label).font(.caption2).foregroundStyle(workStatusColor(status))
                    }
                  }
                  if let relation = work.relation {
                    Text(relation.capitalized).font(.caption2).foregroundStyle(.tertiary)
                  }
                }
              }
            }
          }

          if (detail.owner == nil && detail.status.isClaimable) || detail.canEdit {
            Section {
              if detail.owner == nil && detail.status.isClaimable {
                Button("Take request") {
                  Task { _ = await viewModel.claimRequest(detail.id) }
                }
              }
              if detail.canEdit
                && (detail.status == .readyForReview || detail.status == .changesRequested)
              {
                Button("Approve and complete") {
                  Task { _ = await viewModel.completeRequest(detail.id) }
                }
                .foregroundStyle(.green)
                Button("Request changes") { isRequestingChanges = true }
                  .foregroundStyle(.orange)
              }
            }
            .disabled(viewModel.pendingWorkModelActions.contains { $0.contains(detail.id) })
          }
        }
        .listStyle(.plain)
      } else if let error = viewModel.selectedRequestError {
        MobileWorkModelErrorView(message: error) {
          viewModel.loadRequest(request)
        }
      } else {
        MobileWorkModelDetailSkeleton()
      }
    }
    .navigationTitle(request.key)
    .vectorInlineNavigationTitle()
    .task { viewModel.loadRequest(request) }
    .sheet(isPresented: $isCreatingWork) {
      MobileCreateWorkSheet(
        viewModel: viewModel,
        isPresented: $isCreatingWork,
        defaultTitle: request.title,
        requestId: request.id
      )
    }
    .alert("Request changes", isPresented: $isRequestingChanges) {
      TextField("What needs to change?", text: $changesNote, axis: .vertical)
      Button("Cancel", role: .cancel) {}
      Button("Send") {
        let note = changesNote.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !note.isEmpty else { return }
        Task { _ = await viewModel.requestChanges(request.id, note: note) }
      }
    } message: {
      Text("This note is sent back to the people doing the Work and reopens the review loop.")
    }
  }
}

private struct MobileCreateRequestSheet: View {
  @ObservedObject var viewModel: VectorMobileViewModel
  @Binding var isPresented: Bool
  @State private var title = ""
  @State private var context = ""
  @State private var expectedOutput = ""
  @State private var reviewGuidance = ""
  @State private var priorityId: VectorID?
  @State private var submissionTask: Task<Void, Never>?

  private var canSubmit: Bool {
    !title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
      && !expectedOutput.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
      && !viewModel.pendingWorkModelActions.contains("create-request")
  }

  private var isCreating: Bool {
    viewModel.pendingWorkModelActions.contains("create-request")
  }

  var body: some View {
    NavigationStack {
      Form {
        Section("Request") {
          TextField("What do you need?", text: $title)
          TextField("Context and constraints", text: $context, axis: .vertical)
            .lineLimit(3...8)
        }
        Section("Required output") {
          TextField("Describe the result you expect", text: $expectedOutput, axis: .vertical)
            .lineLimit(3...8)
          TextField("How should it be reviewed?", text: $reviewGuidance, axis: .vertical)
            .lineLimit(2...6)
        }
        Section("Priority") {
          Picker("Priority", selection: $priorityId) {
            Text("No priority").tag(Optional<VectorID>.none)
            ForEach(
              (viewModel.workspaceOptions?.issuePriorities ?? [])
                .filter { $0.weight > 0 && $0.name.lowercased() != "no priority" }
                .sorted { $0.weight > $1.weight }
            ) { priority in
              Label(priority.name, systemImage: vectorSystemImage(for: priority.icon))
                .tag(Optional(priority.id))
            }
          }
        }
      }
      .disabled(isCreating)
      .navigationTitle("New request")
      .vectorInlineNavigationTitle()
      .toolbar {
        ToolbarItem(placement: .cancellationAction) {
          Button(isCreating ? "Stop" : "Cancel") {
            if isCreating {
              submissionTask?.cancel()
              submissionTask = nil
            } else {
              isPresented = false
            }
          }
        }
        ToolbarItem(placement: .confirmationAction) {
          Button {
            submissionTask = Task {
              let created = await viewModel.createRequest(
                title: title.trimmingCharacters(in: .whitespacesAndNewlines),
                description: context.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty,
                expectedOutput: expectedOutput.trimmingCharacters(in: .whitespacesAndNewlines),
                reviewGuidance: reviewGuidance.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty,
                priorityId: priorityId
              )
              guard !Task.isCancelled else { return }
              submissionTask = nil
              if created {
                isPresented = false
              }
            }
          } label: {
            if isCreating {
              ProgressView().controlSize(.small).accessibilityLabel("Creating request")
            } else {
              Text("Create")
            }
          }
          .disabled(!canSubmit)
        }
      }
      .interactiveDismissDisabled(isCreating)
      .alert("Could not create request", isPresented: Binding(
        get: { viewModel.workModelActionError != nil },
        set: { if !$0 { viewModel.clearWorkModelActionError() } }
      )) {
        Button("OK") { viewModel.clearWorkModelActionError() }
      } message: {
        Text(viewModel.workModelActionError ?? "Please try again.")
      }
      .onDisappear {
        submissionTask?.cancel()
        submissionTask = nil
      }
    }
  }
}

struct MobileWorkScreen: View {
  @ObservedObject var viewModel: VectorMobileViewModel
  @ObservedObject var sessionController: VectorMobileSessionController
  @State private var searchText = ""
  @State private var isCreating = false

  private var filteredWork: [VectorWorkRow] {
    let query = searchText.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    guard !query.isEmpty else { return viewModel.work }
    return viewModel.work.filter { $0.key.lowercased().contains(query) || $0.title.lowercased().contains(query) }
  }

  var body: some View {
    Group {
      if viewModel.isLoadingWork && viewModel.work.isEmpty {
        MobileWorkModelSkeleton(rowCount: 8)
      } else if filteredWork.isEmpty {
        ContentUnavailableView(
          searchText.isEmpty ? "No Work in this view" : "No matching Work",
          systemImage: "scope",
          description: Text("Active Work, review, blockers, and agent execution will surface here.")
        )
      } else {
        List(filteredWork) { work in
          NavigationLink {
            MobileWorkDetailScreen(work: work, viewModel: viewModel)
          } label: {
            MobileWorkRow(work: work)
          }
          .listRowInsets(.init(top: 9, leading: 16, bottom: 9, trailing: 12))
        }
        .listStyle(.plain)
        .refreshable { viewModel.refreshWork() }
      }
    }
    .navigationTitle("Work")
    .vectorInlineNavigationTitle()
    .searchable(text: $searchText, prompt: "Work key or title")
    .safeAreaInset(edge: .top, spacing: 0) {
      Picker("Work scope", selection: $viewModel.workScope) {
        ForEach(VectorWorkScope.allCases) { scope in Text(scope.label).tag(scope) }
      }
      .pickerStyle(.segmented)
      .padding(.horizontal, 12)
      .padding(.vertical, 8)
      .background(.bar)
      .onChange(of: viewModel.workScope) { _, _ in viewModel.refreshWork() }
    }
    .toolbar {
      #if os(iOS)
      ToolbarItem(placement: .topBarLeading) {
        WorkspaceToolbarMenu(
          sessionController: sessionController,
          currentOrgSlug: viewModel.configuration.orgSlug,
          webBaseURL: viewModel.configuration.webBaseURL,
          issuesURL: viewModel.configuration.webURL(path: "/\(viewModel.configuration.orgSlug)/work"),
          webLabel: "Open Work on web"
        )
      }
      #else
      ToolbarItem(placement: .automatic) {
        WorkspaceToolbarMenu(
          sessionController: sessionController,
          currentOrgSlug: viewModel.configuration.orgSlug,
          webBaseURL: viewModel.configuration.webBaseURL,
          issuesURL: viewModel.configuration.webURL(path: "/\(viewModel.configuration.orgSlug)/work"),
          webLabel: "Open Work on web"
        )
      }
      #endif
      ToolbarItem(placement: .primaryAction) {
        Button { isCreating = true } label: { Image(systemName: "plus") }
          .accessibilityLabel("Create Work")
      }
    }
    .sheet(isPresented: $isCreating) {
      MobileCreateWorkSheet(viewModel: viewModel, isPresented: $isCreating)
    }
  }
}

private struct MobileCreateWorkSheet: View {
  @ObservedObject var viewModel: VectorMobileViewModel
  @Binding var isPresented: Bool
  var defaultTitle = ""
  var requestId: VectorID?
  @State private var title: String
  @State private var context = ""
  @State private var ownerId: VectorID?

  private var isCreating: Bool {
    viewModel.pendingWorkModelActions.contains("create-work")
  }

  init(viewModel: VectorMobileViewModel, isPresented: Binding<Bool>, defaultTitle: String = "", requestId: VectorID? = nil) {
    self.viewModel = viewModel
    _isPresented = isPresented
    self.defaultTitle = defaultTitle
    self.requestId = requestId
    _title = State(initialValue: defaultTitle)
  }

  var body: some View {
    NavigationStack {
      Form {
        Section("Outcome") {
          TextField("What outcome will this Work deliver?", text: $title)
          TextField("Notes, approach, or context", text: $context, axis: .vertical).lineLimit(3...10)
        }
        Section("Ownership") {
          Picker("Owner", selection: $ownerId) {
            Text("Unassigned").tag(nil as VectorID?)
            ForEach(viewModel.workspaceOptions?.members ?? []) { member in
              if let userId = member.userId ?? member.user?.id {
                Text(member.displayName).tag(userId as VectorID?)
              }
            }
          }
          Text("Work stays planned until its owner explicitly starts it.").font(.caption).foregroundStyle(.secondary)
        }
      }
      .navigationTitle(requestId == nil ? "New Work" : "Linked Work")
      .vectorInlineNavigationTitle()
      .toolbar {
        ToolbarItem(placement: .cancellationAction) { Button("Cancel") { isPresented = false } }
        ToolbarItem(placement: .confirmationAction) {
          Button {
            Task {
              let created = await viewModel.createWork(
                title: title.trimmingCharacters(in: .whitespacesAndNewlines),
                description: context.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty,
                ownerId: ownerId,
                requestIds: requestId.map { [$0] }
              )
              if created { isPresented = false }
            }
          } label: {
            if isCreating {
              ProgressView().controlSize(.small).accessibilityLabel("Creating Work")
            } else {
              Text("Create")
            }
          }
          .disabled(title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || viewModel.pendingWorkModelActions.contains("create-work"))
        }
      }
      .interactiveDismissDisabled(isCreating)
      .alert("Could not create Work", isPresented: Binding(
        get: { viewModel.workModelActionError != nil },
        set: { if !$0 { viewModel.clearWorkModelActionError() } }
      )) {
        Button("OK") { viewModel.clearWorkModelActionError() }
      } message: {
        Text(viewModel.workModelActionError ?? "Please try again.")
      }
      .task {
        viewModel.loadWorkspaceOptions()
      }
    }
  }
}

private struct MobileWorkRow: View {
  let work: VectorWorkRow

  var body: some View {
    VStack(alignment: .leading, spacing: 6) {
      HStack(spacing: 7) {
        Circle().fill(workStatusColor(work.workStatus)).frame(width: 7, height: 7)
        Text(work.key).font(.caption2.monospaced()).foregroundStyle(.secondary)
        Text(work.title).font(.subheadline.weight(.medium)).lineLimit(1)
        Spacer(minLength: 4)
        if let effort = work.effort, effort != "unknown" {
          Text(effort.uppercased()).font(.caption2.monospaced().weight(.semibold)).foregroundStyle(.secondary)
        }
      }
      HStack(spacing: 10) {
        MobileStatusPill(label: work.workStatus.label, color: workStatusColor(work.workStatus))
        if work.taskProgress.total > 0 {
          Label("\(Int(work.taskProgress.done))/\(Int(work.taskProgress.total))", systemImage: "checkmark.circle")
        }
        if work.activeExecutionCount > 0 {
          Label("\(Int(work.activeExecutionCount)) live", systemImage: "bolt.horizontal")
            .foregroundStyle(.blue)
        }
        if work.openAttentionCount > 0 {
          Label("\(Int(work.openAttentionCount))", systemImage: "exclamationmark.bubble")
            .foregroundStyle(.orange)
        }
        Spacer()
      }
      .font(.caption2)
      HStack {
        Label(work.owner?.displayName ?? "Unassigned", systemImage: "person")
        Spacer()
        Text(relativeWorkModelTimestamp(work.lastMeaningfulActivityAt))
      }
      .font(.caption2)
      .foregroundStyle(.tertiary)
    }
  }
}

struct MobileWorkDetailScreen: View {
  let work: VectorWorkRow
  @ObservedObject var viewModel: VectorMobileViewModel
  @State private var isCreatingTask = false
  @State private var isHandingOff = false
  @State private var isRaisingAttention = false
  @State private var isDelegatingSession = false

  var body: some View {
    Group {
      if let detail = viewModel.selectedWork, detail.id == work.id || detail.key == work.key {
        List {
          Section {
            VStack(alignment: .leading, spacing: 10) {
              HStack {
                Text(detail.key).font(.caption.monospaced()).foregroundStyle(.secondary)
                Spacer()
                MobileStatusPill(label: detail.workStatus.label, color: workStatusColor(detail.workStatus))
              }
              Text(detail.title).font(.title3.weight(.semibold))
              if let description = detail.description, !description.isEmpty {
                MarkdownDocumentView(markdown: description)
                  .textSelection(.enabled)
              }
            }
            .padding(.vertical, 4)
          }

          Section("Execution") {
            LabeledContent("Owner", value: detail.owner?.displayName ?? "Unassigned")
            if detail.ownerStartedAt == nil && canStart(detail) {
              Button {
                Task { _ = await viewModel.startWork(detail.id) }
              } label: {
                Label("Start this Work now", systemImage: "play.fill")
              }
              .buttonStyle(.borderedProminent)
              .tint(VectorTheme.accent)
            } else if let startedAt = detail.ownerStartedAt {
              LabeledContent("Current owner started", value: relativeWorkModelTimestamp(startedAt))
            }

            if detail.canEdit {
              if detail.workStatus == .active || detail.workStatus == .waiting || detail.workStatus == .blocked {
                Picker("State", selection: Binding(
                  get: { detail.workStatus },
                  set: { status in Task { _ = await viewModel.setWorkStatus(detail.id, status: status) } }
                )) {
                  Text("Active").tag(VectorWorkStatus.active)
                  Text("Waiting").tag(VectorWorkStatus.waiting)
                  Text("Blocked").tag(VectorWorkStatus.blocked)
                }
              }
              if detail.ownerStartedAt != nil && [.active, .waiting, .blocked].contains(detail.workStatus) {
                Button("Raise for human review") {
                  Task { _ = await viewModel.readyWorkForReview(detail.id) }
                }
                .foregroundStyle(.purple)
              }
              if detail.workStatus == .readyForReview {
                Button("Mark Work complete") {
                  Task { _ = await viewModel.completeWork(detail.id) }
                }
                .foregroundStyle(.green)
              }
            }
          }
          .disabled(viewModel.pendingWorkModelActions.contains { $0.contains(detail.id) })

          if !detail.linkedRequests.isEmpty {
            Section("Requests this Work fulfills") {
              ForEach(detail.linkedRequests) { request in
                VStack(alignment: .leading, spacing: 3) {
                  HStack {
                    Text(request.key).font(.caption.monospaced()).foregroundStyle(.secondary)
                    Text(request.title).font(.subheadline.weight(.medium))
                    Spacer()
                    Text(request.status.label).font(.caption2).foregroundStyle(requestStatusColor(request.status))
                  }
                  Text(request.expectedOutput).font(.caption).foregroundStyle(.secondary).lineLimit(2)
                  if request.status == .changesRequested, let note = request.latestReviewNote {
                    Label(note, systemImage: "arrow.uturn.backward.circle")
                      .font(.caption)
                      .foregroundStyle(.orange)
                  }
                }
              }
            }
          }

          Section("Tasks") {
            if detail.canEdit {
              Button { isCreatingTask = true } label: { Label("Add Task", systemImage: "plus") }
            }
            if detail.tasks.isEmpty {
              Text("No Tasks yet").foregroundStyle(.secondary)
            } else {
              ForEach(detail.tasks) { task in
                HStack(spacing: 10) {
                  Menu {
                    ForEach(VectorTaskStatus.allCases.filter { $0 != .unknown }) { status in
                      Button(status.label) { Task { _ = await viewModel.setTaskStatus(task.id, status: status) } }
                    }
                  } label: {
                    Image(systemName: taskStatusImage(task.status))
                      .foregroundStyle(taskStatusColor(task.status))
                  }
                  VStack(alignment: .leading, spacing: 2) {
                    Text(task.title).font(.subheadline).strikethrough(task.status == .done)
                    HStack {
                      Text("T\(Int(task.number))")
                      if let assignee = task.assignee { Text("· \(assignee.displayName)") }
                    }
                    .font(.caption2)
                    .foregroundStyle(.tertiary)
                  }
                }
                .disabled(
                  task.canUpdateStatus != true ||
                    viewModel.pendingWorkModelActions.contains("task:\(task.id):status")
                )
              }
            }
          }

          let openAttention = detail.attention.filter { $0.status == "open" }
          if !openAttention.isEmpty {
            Section("Needs attention") {
              ForEach(openAttention) { attention in
                Label(attention.prompt, systemImage: "exclamationmark.bubble")
                  .foregroundStyle(.orange)
              }
            }
          }

          if detail.canEdit {
            Section("Coordination") {
              Button { isHandingOff = true } label: { Label("Hand off Work", systemImage: "person.2") }
              Button { isRaisingAttention = true } label: { Label("Ask for attention", systemImage: "exclamationmark.bubble") }
            }
          }

          Section {
            if detail.canEdit {
              Button { isDelegatingSession = true } label: {
                Label("Delegate a new session", systemImage: "desktopcomputer.and.arrow.down")
              }
            }

            if viewModel.workSessions.isEmpty {
              VStack(alignment: .leading, spacing: 4) {
                Text("No agent sessions yet")
                  .font(.subheadline.weight(.medium))
                Text("Attach the current CLI session or delegate this Work to an online machine.")
                  .font(.caption)
                  .foregroundStyle(.secondary)
              }
              .padding(.vertical, 2)
            } else {
              ForEach(viewModel.workSessions) { session in
                NavigationLink {
                  MobileWorkSessionScreen(session: session, viewModel: viewModel)
                } label: {
                  MobileWorkSessionRow(session: session)
                }
              }
            }

            if let error = viewModel.workSessionError, !error.isEmpty {
              Label(error, systemImage: "exclamationmark.triangle")
                .font(.caption)
                .foregroundStyle(.orange)
            }
          } header: {
            Text("Work sessions")
          } footer: {
            Text("A Work item can have multiple agent sessions across different machines.")
          }

          let pendingHandoffs = detail.handoffs.filter { $0.status == "pending" && $0.isRecipient }
          if !pendingHandoffs.isEmpty {
            Section("Handoff waiting for you") {
              ForEach(pendingHandoffs) { handoff in
                VStack(alignment: .leading, spacing: 8) {
                  Text(handoff.summary ?? "Review the previous owner's context before accepting.")
                    .font(.subheadline)
                  Text("From \(handoff.fromOwner?.displayName ?? "previous owner")")
                    .font(.caption).foregroundStyle(.secondary)
                  HStack {
                    Button("Decline", role: .destructive) {
                      Task { _ = await viewModel.respondToHandoff(handoff.id, accept: false) }
                    }
                    Button("Accept") {
                      Task { _ = await viewModel.respondToHandoff(handoff.id, accept: true) }
                    }
                    .buttonStyle(.borderedProminent)
                  }
                }
              }
            }
          }

          if !detail.ownershipPeriods.isEmpty {
            Section("Ownership history") {
              ForEach(detail.ownershipPeriods) { period in
                VStack(alignment: .leading, spacing: 3) {
                  Text(period.owner?.displayName ?? "Unknown owner").font(.subheadline.weight(.medium))
                  Text(ownershipPeriodLabel(period)).font(.caption).foregroundStyle(.secondary)
                  if let summary = period.summary { Text(summary).font(.caption).foregroundStyle(.secondary) }
                }
              }
            }
          }
        }
        .listStyle(.plain)
      } else if let error = viewModel.selectedWorkError {
        MobileWorkModelErrorView(message: error) {
          viewModel.loadWork(work)
        }
      } else {
        MobileWorkModelDetailSkeleton()
      }
    }
    .navigationTitle(work.key)
    .vectorInlineNavigationTitle()
    .task { viewModel.loadWork(work) }
    .sheet(isPresented: $isCreatingTask) {
      MobileCreateTaskSheet(viewModel: viewModel, workId: work.id, isPresented: $isCreatingTask)
    }
    .sheet(isPresented: $isHandingOff) {
      MobileHandoffSheet(viewModel: viewModel, workId: work.id, isPresented: $isHandingOff)
    }
    .sheet(isPresented: $isRaisingAttention) {
      MobileAttentionSheet(viewModel: viewModel, workId: work.id, isPresented: $isRaisingAttention)
    }
    .sheet(isPresented: $isDelegatingSession) {
      MobileDelegateSessionSheet(
        viewModel: viewModel,
        workId: work.id,
        isPresented: $isDelegatingSession
      )
    }
  }

  private func canStart(_ detail: VectorWorkDetail) -> Bool {
    detail.canEdit && (detail.owner == nil || detail.owner?.id == viewModel.currentUser?.id)
  }
}

private struct MobileWorkSessionRow: View {
  let session: VectorWorkSession

  var body: some View {
    VStack(alignment: .leading, spacing: 5) {
      HStack(spacing: 7) {
        Circle()
          .fill(executionStatusColor(session.status))
          .frame(width: 7, height: 7)
        Text(session.displayTitle)
          .font(.subheadline.weight(.medium))
          .lineLimit(1)
        Spacer()
        Text(session.providerLabel)
          .font(.caption2)
          .foregroundStyle(.secondary)
      }
      HStack(spacing: 4) {
        Label(session.deviceName, systemImage: "desktopcomputer")
        Text("·")
        Text(relativeWorkModelTimestamp(session.lastEventAt))
      }
      .font(.caption2)
      .foregroundStyle(.tertiary)
      if let summary = session.latestSummary, !summary.isEmpty {
        Text(summary)
          .font(.caption)
          .foregroundStyle(.secondary)
          .lineLimit(2)
      }
    }
    .padding(.vertical, 2)
  }
}

private struct MobileDelegateSessionSheet: View {
  @ObservedObject var viewModel: VectorMobileViewModel
  let workId: VectorID
  @Binding var isPresented: Bool
  @State private var deviceId: VectorID?
  @State private var workspaceId: VectorID?
  @State private var provider = "codex"

  private let providers: [(id: String, label: String)] = [
    ("codex", "Codex"),
    ("claude_code", "Claude Code"),
    ("cursor", "Cursor"),
    ("copilot", "GitHub Copilot"),
    ("opencode", "OpenCode"),
    ("pi", "Pi"),
  ]

  private var selectedTarget: VectorDelegationTarget? {
    viewModel.delegationTargets.first { $0.id == deviceId }
  }

  var body: some View {
    NavigationStack {
      Form {
        Section("Agent") {
          Picker("Provider", selection: $provider) {
            ForEach(providers, id: \.id) { item in
              Text(item.label).tag(item.id)
            }
          }
        }

        Section("Machine") {
          if viewModel.delegationTargets.isEmpty {
            VStack(alignment: .leading, spacing: 6) {
              Text("No online machines")
                .font(.subheadline.weight(.medium))
              Text("On a machine, run `vcli service start` and allow delegation for a workspace. It will then appear here.")
                .font(.caption)
                .foregroundStyle(.secondary)
                .textSelection(.enabled)
            }
          } else {
            Picker("Device", selection: $deviceId) {
              Text("Choose a machine").tag(nil as VectorID?)
              ForEach(viewModel.delegationTargets) { target in
                Text(target.device.displayName).tag(target.id as VectorID?)
              }
            }

            Picker("Workspace", selection: $workspaceId) {
              Text("Choose a workspace").tag(nil as VectorID?)
              ForEach(selectedTarget?.workspaces ?? []) { workspace in
                Text(workspace.label).tag(workspace.id as VectorID?)
              }
            }
            .disabled(deviceId == nil)
          }
        }

        if let error = viewModel.workSessionError, !error.isEmpty {
          Section {
            Label(error, systemImage: "exclamationmark.triangle")
              .font(.caption)
              .foregroundStyle(.orange)
          }
        }
      }
      .navigationTitle("Delegate Work")
      .vectorInlineNavigationTitle()
      .onChange(of: deviceId) { _, _ in
        workspaceId = nil
      }
      .task {
        viewModel.loadDelegationTargets()
      }
      .toolbar {
        ToolbarItem(placement: .cancellationAction) {
          Button("Cancel") { isPresented = false }
        }
        ToolbarItem(placement: .confirmationAction) {
          Button("Start") {
            guard let deviceId, let workspaceId else { return }
            Task {
              if await viewModel.delegateWorkSession(
                issueId: workId,
                deviceId: deviceId,
                workspaceId: workspaceId,
                provider: provider
              ) {
                isPresented = false
              }
            }
          }
          .disabled(deviceId == nil || workspaceId == nil || viewModel.isDelegatingWorkSession)
        }
      }
    }
  }
}

private struct MobileWorkSessionScreen: View {
  let session: VectorWorkSession
  @ObservedObject var viewModel: VectorMobileViewModel
  @State private var draft = ""
  @State private var isFollowingLatest = true
  @State private var scrollToLatestRequest = 0
  @FocusState private var isComposerFocused: Bool
  @Environment(\.accessibilityReduceMotion) private var reduceMotion

  private let bottomAnchor = "agent-session-bottom"

  private var currentSession: VectorAgentSessionSnapshot? {
    guard viewModel.selectedAgentSession?.liveActivityId == session.id else { return nil }
    return viewModel.selectedAgentSession
  }

  private var displayTitle: String {
    if let title = currentSession?.title.trimmingCharacters(in: .whitespacesAndNewlines),
       !title.isEmpty
    {
      return title
    }
    return session.displayTitle
  }

  private var effectiveStatus: String {
    currentSession?.status ?? session.status
  }

  private var availability: VectorAgentSessionMessagingAvailability {
    session.messagingAvailability(effectiveStatus: effectiveStatus)
  }

  private var loadError: String? {
    viewModel.agentSessionLoadError(for: session.id)
  }

  private var canSend: Bool {
    availability == .available && loadError == nil
  }

  private var isSending: Bool {
    viewModel.sendingAgentSessionId == session.id
  }

  private var composerPlaceholder: String {
    if loadError != nil { return "Session connection lost" }
    switch availability {
    case .available:
      return "Message \(session.providerLabel)"
    case .readOnly:
      return "You have view-only access"
    case .offline:
      return "\(session.deviceName) is offline"
    case .ended:
      return "This session has ended"
    }
  }

  private var unavailableMessage: String? {
    if let loadError {
      return "Live updates stopped: \(loadError)"
    }
    switch availability {
    case .available:
      return nil
    case .readOnly:
      return "You can follow this transcript, but you do not have permission to message this session."
    case .offline:
      return "This machine is offline. Messaging will be available when the Vector service reconnects."
    case .ended:
      let status = effectiveStatus.replacingOccurrences(of: "_", with: " ")
      return "This session is \(status). Its transcript remains available."
    }
  }

  private var emptySessionTitle: String {
    switch availability {
    case .available:
      "Session is ready"
    case .readOnly:
      "No messages yet"
    case .offline:
      "Session is offline"
    case .ended:
      "Session has ended"
    }
  }

  private var transcriptUpdateKey: String {
    guard let lastMessage = currentSession?.messages.last else { return "empty" }
    return "\(currentSession?.messages.count ?? 0):\(lastMessage.id):\(lastMessage.text.count):\(lastMessage.status ?? "")"
  }

  var body: some View {
    ScrollViewReader { scrollProxy in
      Group {
        if let snapshot = currentSession {
          ScrollView {
            LazyVStack(alignment: .leading, spacing: 18) {
              MobileAgentSessionContext(
                session: session,
                snapshot: snapshot,
                effectiveStatus: effectiveStatus
              )

              if let loadError {
                MobileAgentSessionConnectionBanner(message: loadError) {
                  viewModel.loadAgentSession(liveActivityId: session.id)
                }
              }

              if snapshot.messages.isEmpty {
                ContentUnavailableView(
                  emptySessionTitle,
                  systemImage: "bubble.left.and.bubble.right",
                  description: Text(
                    canSend
                      ? "Send a message to continue this agent session. Output will appear here in real time."
                      : (unavailableMessage ?? "Agent output will appear here in real time.")
                  )
                )
                .frame(maxWidth: .infinity)
                .padding(.vertical, 54)
              } else {
                ForEach(snapshot.messages) { message in
                  MobileAgentSessionMessageRow(
                    message: message
                  )
                }
              }

              Color.clear
                .frame(height: 1)
                .id(bottomAnchor)
            }
            .frame(maxWidth: 720)
            .padding(.horizontal, 16)
            .padding(.top, 12)
            .padding(.bottom, 14)
            .frame(maxWidth: .infinity)
          }
          .defaultScrollAnchor(.bottom)
          .trackAgentSessionScroll($isFollowingLatest)
          .onAppear { scrollToLatest(using: scrollProxy, animated: false) }
          .onChange(of: transcriptUpdateKey) { _, _ in
            guard isFollowingLatest else { return }
            scrollToLatest(using: scrollProxy, animated: true)
          }
          .onChange(of: isComposerFocused) { _, isFocused in
            guard isFocused else { return }
            isFollowingLatest = true
            scrollToLatest(using: scrollProxy, animated: true, delay: 0.12)
          }
          .onChange(of: scrollToLatestRequest) { _, _ in
            scrollToLatest(using: scrollProxy, animated: true)
          }
        } else if let error = loadError {
          MobileWorkModelErrorView(message: error) {
            viewModel.loadAgentSession(liveActivityId: session.id)
          }
        } else {
          MobileWorkModelDetailSkeleton()
        }
      }
    }
    .background(VectorTheme.groupedBackground.opacity(0.32))
    .navigationTitle(displayTitle)
    .vectorInlineNavigationTitle()
    .task(id: session.id) {
      viewModel.loadAgentSession(liveActivityId: session.id)
    }
    .safeAreaInset(edge: .bottom, spacing: 0) {
      MobileAgentSessionComposer(
        draft: $draft,
        isFocused: $isComposerFocused,
        placeholder: composerPlaceholder,
        unavailableMessage: unavailableMessage,
        errorMessage: currentSession == nil ? nil : viewModel.agentSessionSendError(for: session.id),
        canSend: canSend,
        isSending: isSending,
        isMessagingBusy: viewModel.isSendingAgentMessage,
        onSend: sendMessage
      )
    }
    #if os(iOS)
    .toolbar {
      ToolbarItemGroup(placement: .keyboard) {
        Spacer()
        Button("Done") { isComposerFocused = false }
      }
    }
    #endif
  }

  private func sendMessage() {
    let body = draft
    isFollowingLatest = true
    scrollToLatestRequest += 1
    Task {
      if await viewModel.sendAgentSessionMessage(liveActivityId: session.id, body: body) {
        draft = ""
      }
    }
  }

  private func scrollToLatest(
    using proxy: ScrollViewProxy,
    animated: Bool,
    delay: Double = 0
  ) {
    DispatchQueue.main.asyncAfter(deadline: .now() + delay) {
      if animated && !reduceMotion {
        withAnimation(.easeOut(duration: 0.22)) {
          proxy.scrollTo(bottomAnchor, anchor: .bottom)
        }
      } else {
        proxy.scrollTo(bottomAnchor, anchor: .bottom)
      }
    }
  }
}

private extension View {
  @ViewBuilder
  func trackAgentSessionScroll(_ isFollowingLatest: Binding<Bool>) -> some View {
    #if os(macOS)
    if #available(macOS 15.0, *) {
      agentSessionScrollGeometry(isFollowingLatest)
    } else {
      self
    }
    #else
    agentSessionScrollGeometry(isFollowingLatest)
    #endif
  }

  @available(macOS 15.0, *)
  func agentSessionScrollGeometry(_ isFollowingLatest: Binding<Bool>) -> some View {
    onScrollGeometryChange(for: Bool.self) { geometry in
      let distanceFromBottom =
        geometry.contentSize.height - geometry.contentOffset.y - geometry.containerSize.height
      return distanceFromBottom < 120
    } action: { _, isNearBottom in
      isFollowingLatest.wrappedValue = isNearBottom
    }
  }
}

private struct MobileAgentSessionContext: View {
  let session: VectorWorkSession
  let snapshot: VectorAgentSessionSnapshot
  let effectiveStatus: String

  var body: some View {
    HStack(spacing: 10) {
      ZStack(alignment: .bottomTrailing) {
        RoundedRectangle(cornerRadius: 10, style: .continuous)
          .fill(VectorTheme.inputBackground)
          .frame(width: 38, height: 38)
          .overlay {
            Image(systemName: "sparkles")
              .font(.system(size: 16, weight: .semibold))
              .foregroundStyle(VectorTheme.accent)
          }
        Circle()
          .fill(executionStatusColor(effectiveStatus))
          .frame(width: 9, height: 9)
          .overlay(Circle().stroke(VectorTheme.groupedBackground, lineWidth: 2))
          .offset(x: 1, y: 1)
      }

      VStack(alignment: .leading, spacing: 2) {
        Text(session.providerLabel)
          .font(.subheadline.weight(.semibold))
        HStack(spacing: 4) {
          Text(session.deviceName)
          if let cwd = snapshot.cwd, !cwd.isEmpty {
            Text("·")
            Text(URL(fileURLWithPath: cwd).lastPathComponent)
          }
        }
        .font(.caption)
        .foregroundStyle(.secondary)
        .lineLimit(1)
      }

      Spacer(minLength: 8)

      MobileStatusPill(
        label: effectiveStatus.replacingOccurrences(of: "_", with: " ").capitalized,
        color: executionStatusColor(effectiveStatus)
      )
    }
    .padding(10)
    .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
    .overlay {
      RoundedRectangle(cornerRadius: 14, style: .continuous)
        .stroke(VectorTheme.border.opacity(0.4), lineWidth: 0.5)
    }
    .accessibilityElement(children: .combine)
    .accessibilityLabel("\(session.providerLabel) on \(session.deviceName), \(effectiveStatus.replacingOccurrences(of: "_", with: " "))")
  }
}

private struct MobileAgentSessionConnectionBanner: View {
  let message: String
  let onReconnect: () -> Void

  var body: some View {
    HStack(alignment: .firstTextBaseline, spacing: 9) {
      Image(systemName: "wifi.exclamationmark")
        .foregroundStyle(.orange)
      VStack(alignment: .leading, spacing: 2) {
        Text("Live connection lost")
          .font(.caption.weight(.semibold))
        Text(message)
          .font(.caption)
          .foregroundStyle(.secondary)
      }
      Spacer(minLength: 8)
      Button("Reconnect", action: onReconnect)
        .font(.caption.weight(.semibold))
    }
    .padding(10)
    .background(Color.orange.opacity(0.09), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
  }
}

private struct MobileAgentSessionComposer: View {
  @Binding var draft: String
  var isFocused: FocusState<Bool>.Binding
  let placeholder: String
  let unavailableMessage: String?
  let errorMessage: String?
  let canSend: Bool
  let isSending: Bool
  let isMessagingBusy: Bool
  let onSend: () -> Void

  private var isSendDisabled: Bool {
    !canSend || isMessagingBusy || draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
  }

  var body: some View {
    VStack(spacing: 7) {
      if let errorMessage, !errorMessage.isEmpty {
        Label(errorMessage, systemImage: "exclamationmark.circle.fill")
          .font(.caption)
          .foregroundStyle(.red)
          .frame(maxWidth: .infinity, alignment: .leading)
          .padding(.horizontal, 4)
          .accessibilityLabel("Message failed. \(errorMessage)")
      } else if let unavailableMessage {
        Label(unavailableMessage, systemImage: canSend ? "info.circle" : "lock.fill")
          .font(.caption)
          .foregroundStyle(.secondary)
          .frame(maxWidth: .infinity, alignment: .leading)
          .padding(.horizontal, 4)
      }

      HStack(alignment: .bottom, spacing: 8) {
        TextField(placeholder, text: $draft, axis: .vertical)
          .focused(isFocused)
          .lineLimit(1...6)
          .textFieldStyle(.plain)
          .font(.body)
          .padding(.horizontal, 7)
          .padding(.vertical, 7)
          .submitLabel(.send)
          .onSubmit {
            guard !isSendDisabled else { return }
            onSend()
          }
          .disabled(!canSend || isMessagingBusy)
          .accessibilityHint(canSend ? "Enter a message for this agent session" : placeholder)

        Button(action: onSend) {
          Group {
            if isSending {
              ProgressView()
                .controlSize(.small)
                .tint(.white)
            } else {
              Image(systemName: "arrow.up")
                .font(.system(size: 15, weight: .bold))
            }
          }
          .frame(width: 16, height: 16)
        }
        .buttonStyle(.borderedProminent)
        .buttonBorderShape(.circle)
        .tint(VectorTheme.accent)
        .controlSize(.regular)
        .disabled(isSendDisabled)
        .accessibilityLabel(isSending ? "Sending message" : "Send message")
      }
      .padding(.leading, 7)
      .padding(.trailing, 7)
      .padding(.vertical, 7)
      .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
      .overlay {
        RoundedRectangle(cornerRadius: 18, style: .continuous)
          .stroke(VectorTheme.border.opacity(0.48), lineWidth: 0.5)
      }
      .shadow(color: Color.black.opacity(0.07), radius: 12, x: 0, y: 4)
    }
    .padding(.horizontal, 12)
    .padding(.top, 8)
    .padding(.bottom, 9)
    .background(.bar)
  }
}

private struct MobileAgentSessionMessageRow: View {
  let message: VectorAgentSessionMessage

  private var isUserMessage: Bool {
    message.direction == "vector_to_agent" || message.role == "user"
  }

  private var isActivityMessage: Bool {
    ["status", "system", "compaction", "auth_request"].contains(message.role)
  }

  private var isExecutionDetail: Bool {
    ["reasoning", "tool"].contains(message.role)
  }

  private var isErrorMessage: Bool {
    message.role == "error" || message.deliveryStatus == "failed"
  }

  private var userAccessibilityLabel: String {
    var parts = [
      "Sent from Vector",
      message.text,
      relativeWorkModelTimestamp(message.createdAt),
    ]
    switch message.deliveryStatus {
    case "pending":
      parts.append("Sending")
    case "failed":
      parts.append("Delivery failed")
    default:
      break
    }
    return parts.joined(separator: ", ")
  }

  var body: some View {
    Group {
      if isActivityMessage {
        MobileAgentSessionActivityRow(message: message)
      } else if isExecutionDetail {
        MobileAgentSessionExecutionDetailRow(message: message)
      } else if isUserMessage {
        HStack(alignment: .top) {
          Spacer(minLength: 44)
          VStack(alignment: .trailing, spacing: 6) {
            HStack(spacing: 6) {
              Text("Sent from Vector")
                .fontWeight(.medium)
              Text(relativeWorkModelTimestamp(message.createdAt))
              Image(systemName: "arrow.up.right.circle.fill")
                .accessibilityHidden(true)
            }
            .font(.caption2)
            .foregroundStyle(.secondary)

            Text(message.text)
              .font(.subheadline)
              .foregroundStyle(Color.white)
              .multilineTextAlignment(.leading)
              .textSelection(.enabled)
              .padding(.horizontal, 13)
              .padding(.vertical, 10)
              .background(VectorTheme.accent, in: RoundedRectangle(cornerRadius: 14, style: .continuous))

            deliveryStatus
          }
          .frame(maxWidth: 560, alignment: .trailing)
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel(userAccessibilityLabel)
      } else if isErrorMessage {
        Label {
          VStack(alignment: .leading, spacing: 4) {
            Text(message.text)
              .font(.subheadline)
              .textSelection(.enabled)
            Text(relativeWorkModelTimestamp(message.createdAt))
              .font(.caption2)
              .foregroundStyle(.secondary)
          }
        } icon: {
          Image(systemName: "exclamationmark.triangle.fill")
            .foregroundStyle(.orange)
        }
        .padding(11)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.orange.opacity(0.09), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
      } else {
        VStack(alignment: .leading, spacing: 7) {
          Text(relativeWorkModelTimestamp(message.createdAt))
            .font(.caption2)
            .foregroundStyle(.tertiary)
          MarkdownDocumentView(markdown: message.text)
            .font(.subheadline)
            .textSelection(.enabled)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
      }
    }
  }

  @ViewBuilder private var deliveryStatus: some View {
    switch message.deliveryStatus {
    case "pending":
      Label("Sending", systemImage: "clock")
        .font(.caption2)
        .foregroundStyle(.secondary)
    case "sent":
      EmptyView()
    case "failed":
      Label("Delivery failed", systemImage: "exclamationmark.circle.fill")
        .font(.caption2)
        .foregroundStyle(.red)
    default:
      EmptyView()
    }
  }
}

private struct MobileAgentSessionExecutionDetailRow: View {
  let message: VectorAgentSessionMessage
  @State private var isExpanded = false

  private var title: String {
    message.role == "tool" ? "Tool activity" : "Agent reasoning"
  }

  private var icon: String {
    message.role == "tool" ? "wrench.and.screwdriver" : "brain.head.profile"
  }

  var body: some View {
    DisclosureGroup(isExpanded: $isExpanded) {
      Text(message.text)
        .font(message.role == "tool" ? .caption.monospaced() : .caption)
        .foregroundStyle(.secondary)
        .textSelection(.enabled)
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.top, 7)
    } label: {
      HStack(spacing: 7) {
        Label(title, systemImage: icon)
          .font(.caption.weight(.medium))
        Spacer(minLength: 6)
        Text(relativeWorkModelTimestamp(message.createdAt))
          .font(.caption2)
          .foregroundStyle(.tertiary)
      }
    }
    .tint(.secondary)
    .padding(10)
    .background(VectorTheme.inputBackground.opacity(0.7), in: RoundedRectangle(cornerRadius: 11, style: .continuous))
  }
}

private struct MobileAgentSessionActivityRow: View {
  let message: VectorAgentSessionMessage

  private var icon: String {
    switch message.role {
    case "auth_request": "lock.shield"
    case "compaction": "arrow.triangle.2.circlepath"
    case "status": "circle.dotted"
    default: "info.circle"
    }
  }

  var body: some View {
    HStack(alignment: .firstTextBaseline, spacing: 7) {
      Image(systemName: icon)
        .frame(width: 14)
      Text(message.text)
        .italic()
        .fixedSize(horizontal: false, vertical: true)
      Spacer(minLength: 6)
      Text(relativeWorkModelTimestamp(message.createdAt))
        .lineLimit(1)
    }
    .font(.caption)
    .foregroundStyle(.secondary)
    .padding(.vertical, 2)
  }
}

private struct MobileCreateTaskSheet: View {
  @ObservedObject var viewModel: VectorMobileViewModel
  let workId: VectorID
  @Binding var isPresented: Bool
  @State private var title = ""
  @State private var assigneeId: VectorID?

  var body: some View {
    NavigationStack {
      Form {
        TextField("Task", text: $title)
        Picker("Assignee", selection: $assigneeId) {
          Text("Unassigned").tag(nil as VectorID?)
          ForEach(viewModel.workspaceOptions?.members ?? []) { member in
            if let userId = member.userId ?? member.user?.id { Text(member.displayName).tag(userId as VectorID?) }
          }
        }
      }
      .navigationTitle("New Task").vectorInlineNavigationTitle()
      .toolbar {
        ToolbarItem(placement: .cancellationAction) { Button("Cancel") { isPresented = false } }
        ToolbarItem(placement: .confirmationAction) {
          Button("Create") { Task { if await viewModel.createTask(workId, title: title, assigneeId: assigneeId) { isPresented = false } } }
            .disabled(title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
        }
      }
    }
  }
}

private struct MobileHandoffSheet: View {
  @ObservedObject var viewModel: VectorMobileViewModel
  let workId: VectorID
  @Binding var isPresented: Bool
  @State private var recipientId: VectorID?
  @State private var summary = ""
  @State private var note = ""

  var body: some View {
    NavigationStack {
      Form {
        Picker("New owner", selection: $recipientId) {
          Text("Choose a person").tag(nil as VectorID?)
          ForEach(viewModel.workspaceOptions?.members ?? []) { member in
            if let userId = member.userId ?? member.user?.id { Text(member.displayName).tag(userId as VectorID?) }
          }
        }
        TextField("What has been done so far?", text: $summary, axis: .vertical).lineLimit(3...8)
        TextField("Optional note", text: $note, axis: .vertical).lineLimit(2...6)
        Text("You remain accountable until the new owner accepts.").font(.caption).foregroundStyle(.secondary)
      }
      .navigationTitle("Hand off Work").vectorInlineNavigationTitle()
      .toolbar {
        ToolbarItem(placement: .cancellationAction) { Button("Cancel") { isPresented = false } }
        ToolbarItem(placement: .confirmationAction) {
          Button("Send") {
            guard let recipientId else { return }
            Task { if await viewModel.proposeHandoff(workId, toOwnerId: recipientId, summary: summary, note: note.nilIfEmpty) { isPresented = false } }
          }
          .disabled(recipientId == nil || summary.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
        }
      }
    }
  }
}

private struct MobileAttentionSheet: View {
  @ObservedObject var viewModel: VectorMobileViewModel
  let workId: VectorID
  @Binding var isPresented: Bool
  @State private var title = ""
  @State private var details = ""

  var body: some View {
    NavigationStack {
      Form {
        TextField("What needs human attention?", text: $title)
        TextField("Details or decision needed", text: $details, axis: .vertical).lineLimit(3...8)
      }
      .navigationTitle("Ask for attention").vectorInlineNavigationTitle()
      .toolbar {
        ToolbarItem(placement: .cancellationAction) { Button("Cancel") { isPresented = false } }
        ToolbarItem(placement: .confirmationAction) {
          Button("Raise") { Task { if await viewModel.raiseAttention(workId, title: title, details: details.nilIfEmpty) { isPresented = false } } }
            .disabled(title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
        }
      }
    }
  }
}

private struct MobileStatusPill: View {
  let label: String
  let color: Color

  var body: some View {
    Text(label)
      .font(.caption2.weight(.semibold))
      .foregroundStyle(color)
      .padding(.horizontal, 7)
      .padding(.vertical, 3)
      .background(color.opacity(0.12), in: Capsule())
  }
}

private struct MobileWorkModelSkeleton: View {
  let rowCount: Int

  var body: some View {
    List(0..<rowCount, id: \.self) { _ in
      VStack(alignment: .leading, spacing: 8) {
        RoundedRectangle(cornerRadius: 3).fill(.quaternary).frame(height: 13)
        RoundedRectangle(cornerRadius: 3).fill(.quaternary).frame(width: 230, height: 10)
        RoundedRectangle(cornerRadius: 3).fill(.quaternary).frame(width: 140, height: 9)
      }
      .redacted(reason: .placeholder)
      .listRowInsets(.init(top: 11, leading: 16, bottom: 11, trailing: 16))
    }
    .listStyle(.plain)
  }
}

private struct MobileWorkModelDetailSkeleton: View {
  var body: some View {
    List {
      ForEach(0..<4, id: \.self) { _ in
        Section {
          RoundedRectangle(cornerRadius: 4).fill(.quaternary).frame(height: 18)
          RoundedRectangle(cornerRadius: 4).fill(.quaternary).frame(height: 12)
        }
      }
    }
    .redacted(reason: .placeholder)
  }
}

private struct MobileWorkModelErrorView: View {
  let message: String
  let retry: () -> Void

  var body: some View {
    ContentUnavailableView {
      Label("Could not load this item", systemImage: "exclamationmark.triangle")
    } description: {
      Text(message)
    } actions: {
      Button("Try again", action: retry)
        .buttonStyle(.borderedProminent)
    }
  }
}

private func requestStatusColor(_ status: VectorRequestStatus) -> Color {
  switch status {
  case .readyForReview: .purple
  case .changesRequested: .orange
  case .completed: .green
  case .declined, .duplicate: .secondary
  case .inDelivery: .blue
  case .new, .routed, .planned: VectorTheme.accent
  case .unknown: .secondary
  }
}

private func workStatusColor(_ status: VectorWorkStatus) -> Color {
  switch status {
  case .active: .blue
  case .waiting: .yellow
  case .blocked: .orange
  case .readyForReview: .purple
  case .completed: .green
  case .canceled: .secondary
  case .planned: VectorTheme.accent
  case .unknown: .secondary
  }
}

private func taskStatusImage(_ status: VectorTaskStatus) -> String {
  switch status {
  case .todo: "circle"
  case .inProgress: "circle.lefthalf.filled"
  case .waiting: "clock"
  case .blocked: "exclamationmark.circle"
  case .done: "checkmark.circle.fill"
  case .canceled: "xmark.circle"
  case .unknown: "questionmark.circle"
  }
}

private func taskStatusColor(_ status: VectorTaskStatus) -> Color {
  switch status {
  case .todo, .canceled: .secondary
  case .inProgress: .blue
  case .waiting: .yellow
  case .blocked: .orange
  case .done: .green
  case .unknown: .secondary
  }
}

private func executionStatusColor(_ status: String) -> Color {
  switch status {
  case "active": .green
  case "waiting_for_input": .orange
  case "paused": .yellow
  case "completed": .blue
  case "failed": .red
  default: .secondary
  }
}

private func ownershipPeriodLabel(_ period: VectorWorkOwnershipPeriod) -> String {
  let accepted = "Accepted \(relativeWorkModelTimestamp(period.startedAt))"
  let started = period.executionStartedAt.map { "started \(relativeWorkModelTimestamp($0))" } ?? "execution not started"
  let ended = period.endedAt.map { " · ended \(relativeWorkModelTimestamp($0))" } ?? ""
  return "\(accepted) · \(started)\(ended)"
}

private func relativeWorkModelTimestamp(_ milliseconds: Double) -> String {
  let date = Date(timeIntervalSince1970: milliseconds / 1000)
  let formatter = RelativeDateTimeFormatter()
  formatter.unitsStyle = .abbreviated
  return formatter.localizedString(for: date, relativeTo: Date())
}

private extension String {
  var nilIfEmpty: String? { isEmpty ? nil : self }
}
