import SwiftUI

struct MobileRequestsScreen: View {
  @ObservedObject var viewModel: VectorMobileViewModel
  @State private var searchText = ""
  @State private var isCreating = false

  private var filteredRequests: [VectorRequestRow] {
    let query = searchText.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    guard !query.isEmpty else { return viewModel.requests }
    return viewModel.requests.filter {
      $0.key.lowercased().contains(query)
        || $0.title.lowercased().contains(query)
        || $0.expectedOutput.lowercased().contains(query)
    }
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
        List(filteredRequests) { request in
          NavigationLink {
            MobileRequestDetailScreen(request: request, viewModel: viewModel)
          } label: {
            MobileRequestRow(request: request)
          }
          .listRowInsets(.init(top: 9, leading: 16, bottom: 9, trailing: 12))
        }
        .listStyle(.plain)
        .refreshable { viewModel.refreshRequests() }
      }
    }
    .navigationTitle("Requests")
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
      ToolbarItem(placement: .primaryAction) {
        Button { isCreating = true } label: { Image(systemName: "plus") }
          .accessibilityLabel("Create request")
      }
    }
    .sheet(isPresented: $isCreating) {
      MobileCreateRequestSheet(viewModel: viewModel, isPresented: $isCreating)
    }
  }
}

private struct MobileRequestRow: View {
  let request: VectorRequestRow

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

  var body: some View {
    Group {
      if let detail = viewModel.selectedRequest, detail.id == request.id {
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
            LabeledContent("Owner", value: detail.owner?.displayName ?? "Unassigned")
            LabeledContent("Requester", value: detail.requester?.displayName ?? "Unknown")
            if detail.recipients.count > 1 {
              LabeledContent("Recipients", value: detail.recipients.compactMap(\.user?.displayName).joined(separator: ", "))
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

          Section {
            if detail.owner == nil {
              Button("Take request") {
                Task { _ = await viewModel.claimRequest(detail.id) }
              }
            }
            if detail.status == .readyForReview || detail.status == .changesRequested {
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
        .listStyle(.plain)
      } else {
        MobileWorkModelDetailSkeleton()
      }
    }
    .navigationTitle(request.key)
    .vectorInlineNavigationTitle()
    .task { viewModel.loadRequest(request) }
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

  private var canSubmit: Bool {
    !title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
      && !expectedOutput.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
      && !viewModel.pendingWorkModelActions.contains("create-request")
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
      }
      .navigationTitle("New request")
      .vectorInlineNavigationTitle()
      .toolbar {
        ToolbarItem(placement: .cancellationAction) { Button("Cancel") { isPresented = false } }
        ToolbarItem(placement: .confirmationAction) {
          Button("Create") {
            Task {
              let created = await viewModel.createRequest(
                title: title,
                description: context.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty,
                expectedOutput: expectedOutput,
                reviewGuidance: reviewGuidance.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty
              )
              if created { isPresented = false }
            }
          }
          .disabled(!canSubmit)
        }
      }
    }
  }
}

struct MobileWorkScreen: View {
  @ObservedObject var viewModel: VectorMobileViewModel
  @State private var searchText = ""

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

  var body: some View {
    Group {
      if let detail = viewModel.selectedWork, detail.id == work.id {
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
                Text(description).font(.subheadline).foregroundStyle(.secondary).textSelection(.enabled)
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
            if ![.readyForReview, .completed, .canceled].contains(detail.workStatus) {
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
            if detail.tasks.isEmpty {
              Text("No Tasks yet").foregroundStyle(.secondary)
            } else {
              ForEach(detail.tasks) { task in
                HStack(spacing: 10) {
                  Menu {
                    ForEach(VectorTaskStatus.allCases) { status in
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
                .disabled(viewModel.pendingWorkModelActions.contains("task:\(task.id):status"))
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

          if !detail.executions.isEmpty {
            Section("Agent executions") {
              ForEach(detail.executions) { execution in
                VStack(alignment: .leading, spacing: 3) {
                  HStack {
                    Circle().fill(executionStatusColor(execution.status)).frame(width: 7, height: 7)
                    Text(execution.title).font(.subheadline.weight(.medium))
                    Spacer()
                    Text(execution.provider.replacingOccurrences(of: "_", with: " ").capitalized)
                      .font(.caption2).foregroundStyle(.secondary)
                  }
                  if let summary = execution.latestSummary {
                    Text(summary).font(.caption).foregroundStyle(.secondary).lineLimit(3)
                  }
                }
              }
            }
          }

          let pendingHandoffs = detail.handoffs.filter { $0.status == "pending" && $0.isRecipient }
          if !pendingHandoffs.isEmpty {
            Section("Handoff waiting for you") {
              ForEach(pendingHandoffs) { handoff in
                VStack(alignment: .leading, spacing: 8) {
                  Text(handoff.summary).font(.subheadline)
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
      } else {
        MobileWorkModelDetailSkeleton()
      }
    }
    .navigationTitle(work.key)
    .vectorInlineNavigationTitle()
    .task { viewModel.loadWork(work) }
  }

  private func canStart(_ detail: VectorWorkDetail) -> Bool {
    detail.owner == nil || detail.owner?.id == viewModel.currentUser?.id
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

private func requestStatusColor(_ status: VectorRequestStatus) -> Color {
  switch status {
  case .readyForReview: .purple
  case .changesRequested: .orange
  case .completed: .green
  case .declined, .duplicate: .secondary
  case .inDelivery: .blue
  case .new, .routed, .planned: VectorTheme.accent
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
  }
}

private func taskStatusImage(_ status: VectorTaskStatus) -> String {
  switch status {
  case .todo: "circle"
  case .inProgress: "circle.lefthalf.filled"
  case .blocked: "exclamationmark.circle"
  case .done: "checkmark.circle.fill"
  case .canceled: "xmark.circle"
  }
}

private func taskStatusColor(_ status: VectorTaskStatus) -> Color {
  switch status {
  case .todo, .canceled: .secondary
  case .inProgress: .blue
  case .blocked: .orange
  case .done: .green
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
