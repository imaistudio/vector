import SwiftUI

public struct VectorMobileRootView: View {
  @StateObject private var viewModel: VectorMobileViewModel

  public init(viewModel: VectorMobileViewModel = VectorMobileViewModel()) {
    self._viewModel = StateObject(wrappedValue: viewModel)
  }

  public var body: some View {
    TabView {
      NavigationStack {
        IssuesScreen(viewModel: viewModel)
      }
      .tabItem {
        Label("Issues", systemImage: "checklist")
      }

      NavigationStack {
        ProjectsScreen(viewModel: viewModel)
      }
      .tabItem {
        Label("Projects", systemImage: "folder")
      }

      NavigationStack {
        TeamsScreen(viewModel: viewModel)
      }
      .tabItem {
        Label("Teams", systemImage: "person.3")
      }

      NavigationStack {
        MobileSettingsScreen(viewModel: viewModel)
      }
      .tabItem {
        Label("Settings", systemImage: "gearshape")
      }
    }
    .tint(VectorTheme.accent)
  }
}

struct IssuesScreen: View {
  @ObservedObject var viewModel: VectorMobileViewModel
  @State private var searchText = ""

  private var filteredIssues: [VectorIssueRow] {
    guard !searchText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
      return viewModel.issues
    }
    return viewModel.issues.filter {
      $0.key.localizedCaseInsensitiveContains(searchText)
        || $0.title.localizedCaseInsensitiveContains(searchText)
    }
  }

  var body: some View {
    VStack(spacing: 0) {
      Picker("Scope", selection: $viewModel.issueScope) {
        ForEach(VectorIssueScope.allCases) { scope in
          Text(scope.label).tag(scope)
        }
      }
      .pickerStyle(.segmented)
      .padding([.horizontal, .top], 12)
      .onChange(of: viewModel.issueScope) {
        viewModel.refresh()
      }

      Picker("Layout", selection: $viewModel.issueLayoutMode) {
        ForEach(VectorIssueLayoutMode.allCases) { mode in
          Text(mode.label).tag(mode)
        }
      }
      .pickerStyle(.segmented)
      .padding(12)

      content
    }
    .background(VectorTheme.groupedBackground)
    .navigationTitle("Issues")
    .toolbar {
      ToolbarItem(placement: .primaryAction) {
        Link(destination: viewModel.configuration.webURL(path: "/\(viewModel.configuration.orgSlug)/issues")) {
          Image(systemName: "safari")
        }
        .accessibilityLabel("Open issues on web")
      }
    }
    .searchable(text: $searchText, prompt: "Search issues")
  }

  @ViewBuilder private var content: some View {
    if viewModel.isLoading && filteredIssues.isEmpty {
      SkeletonIssueList()
    } else if let error = viewModel.errorMessage {
      ContentUnavailableView("Unable to load issues", systemImage: "wifi.exclamationmark", description: Text(error))
    } else {
      switch viewModel.issueLayoutMode {
      case .list:
        IssueList(issues: filteredIssues, viewModel: viewModel)
      case .board:
        IssueBoard(issues: filteredIssues, viewModel: viewModel)
      case .timeline:
        IssueTimeline(issues: filteredIssues, viewModel: viewModel)
      }
    }
  }
}

struct IssueList: View {
  let issues: [VectorIssueRow]
  @ObservedObject var viewModel: VectorMobileViewModel

  var body: some View {
    List(issues, id: \.rowId) { issue in
      NavigationLink {
        IssueDetailScreen(issue: issue, viewModel: viewModel)
      } label: {
        IssueRowView(issue: issue)
      }
      .listRowInsets(EdgeInsets(top: 8, leading: 12, bottom: 8, trailing: 12))
    }
    .listStyle(.plain)
  }
}

struct IssueBoard: View {
  let issues: [VectorIssueRow]
  @ObservedObject var viewModel: VectorMobileViewModel

  private var groups: [(String, [VectorIssueRow])] {
    Dictionary(grouping: issues, by: { $0.workflowStateName ?? "No status" })
      .map { ($0.key, $0.value.sorted { $0.updatedAt > $1.updatedAt }) }
      .sorted { $0.0 < $1.0 }
  }

  var body: some View {
    ScrollView(.horizontal) {
      HStack(alignment: .top, spacing: 12) {
        ForEach(groups, id: \.0) { group in
          VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 6) {
              Text(group.0)
                .font(.subheadline.weight(.semibold))
              Text("\(group.1.count)")
                .font(.caption)
                .foregroundStyle(.secondary)
            }

            ForEach(group.1, id: \.rowId) { issue in
              NavigationLink {
                IssueDetailScreen(issue: issue, viewModel: viewModel)
              } label: {
                IssueBoardCard(issue: issue)
              }
              .buttonStyle(.plain)
            }
          }
          .frame(width: 280, alignment: .topLeading)
        }
      }
      .padding(12)
    }
  }
}

struct IssueTimeline: View {
  let issues: [VectorIssueRow]
  @ObservedObject var viewModel: VectorMobileViewModel

  private var groups: [(String, [VectorIssueRow])] {
    let sorted = issues.sorted { $0.updatedAt > $1.updatedAt }
    let grouped = Dictionary(grouping: sorted) { issue in
      let age = Date().timeIntervalSince1970 * 1000 - issue.updatedAt
      return age < 86_400_000 ? "Today" : "Earlier"
    }
    return ["Today", "Earlier"].compactMap { key in
      guard let rows = grouped[key], !rows.isEmpty else { return nil }
      return (key, rows)
    }
  }

  var body: some View {
    List {
      ForEach(groups, id: \.0) { group in
        Section(group.0) {
          ForEach(group.1, id: \.rowId) { issue in
            NavigationLink {
              IssueDetailScreen(issue: issue, viewModel: viewModel)
            } label: {
              TimelineIssueRow(issue: issue)
            }
          }
        }
      }
    }
    .listStyle(.plain)
  }
}

struct IssueRowView: View {
  let issue: VectorIssueRow

  var body: some View {
    VStack(alignment: .leading, spacing: 6) {
      HStack(alignment: .firstTextBaseline, spacing: 8) {
        Text(issue.key)
          .font(.caption.monospaced())
          .foregroundStyle(.secondary)
          .lineLimit(1)

        Text(issue.title)
          .font(.subheadline.weight(.medium))
          .foregroundStyle(.primary)
          .lineLimit(1)
      }

      HStack(spacing: 6) {
        VectorPill(
          text: issue.stateLabel,
          color: Color(vectorHex: issue.workflowStateColor),
          systemImage: vectorSystemImage(for: issue.workflowStateIcon)
        )
        if let priority = issue.priorityName {
          VectorPill(
            text: priority,
            color: Color(vectorHex: issue.priorityColor),
            systemImage: vectorSystemImage(for: issue.priorityIcon)
          )
        }
        if let projectKey = issue.projectKey {
          VectorPill(text: projectKey, color: .secondary, systemImage: "folder")
        }
      }
    }
    .frame(maxWidth: .infinity, alignment: .leading)
  }
}

struct IssueBoardCard: View {
  let issue: VectorIssueRow

  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      HStack(spacing: 6) {
        Text(issue.key)
          .font(.caption.monospaced())
          .foregroundStyle(.secondary)
        Spacer(minLength: 8)
        if !issue.linkedPrs.isEmpty {
          Image(systemName: "point.3.connected.trianglepath.dotted")
            .font(.caption)
            .foregroundStyle(VectorTheme.accent)
        }
      }

      Text(issue.title)
        .font(.subheadline.weight(.medium))
        .foregroundStyle(.primary)
        .lineLimit(2)

      HStack {
        Text(issue.assigneeLabel)
          .font(.caption)
          .foregroundStyle(.secondary)
          .lineLimit(1)
        Spacer()
        if let dueDate = issue.dueDate {
          Text(dueDate)
            .font(.caption2.monospaced())
            .foregroundStyle(.secondary)
        }
      }
    }
    .padding(10)
    .background(VectorTheme.rowBackground, in: RoundedRectangle(cornerRadius: 8, style: .continuous))
    .overlay(
      RoundedRectangle(cornerRadius: 8, style: .continuous)
        .stroke(VectorTheme.border.opacity(0.35), lineWidth: 0.5)
    )
  }
}

struct TimelineIssueRow: View {
  let issue: VectorIssueRow

  var body: some View {
    HStack(alignment: .top, spacing: 10) {
      Image(systemName: vectorSystemImage(for: issue.workflowStateIcon))
        .font(.caption)
        .foregroundStyle(Color(vectorHex: issue.workflowStateColor))
        .frame(width: 20, height: 20)

      VStack(alignment: .leading, spacing: 4) {
        Text(issue.title)
          .font(.subheadline.weight(.medium))
          .lineLimit(2)
        Text("\(issue.key) updated in \(issue.stateLabel)")
          .font(.caption)
          .foregroundStyle(.secondary)
      }
    }
    .padding(.vertical, 4)
  }
}

struct IssueDetailScreen: View {
  let issue: VectorIssueRow
  @ObservedObject var viewModel: VectorMobileViewModel

  var body: some View {
    List {
      Section {
        VStack(alignment: .leading, spacing: 12) {
          Text(issue.key)
            .font(.caption.monospaced())
            .foregroundStyle(.secondary)
          Text(issue.title)
            .font(.title3.weight(.semibold))
          if let description = issue.description {
            Text(description)
              .font(.subheadline)
              .foregroundStyle(.secondary)
          }
          HStack(spacing: 6) {
            VectorPill(text: issue.stateLabel, color: Color(vectorHex: issue.workflowStateColor), systemImage: vectorSystemImage(for: issue.workflowStateIcon))
            if let priority = issue.priorityName {
              VectorPill(text: priority, color: Color(vectorHex: issue.priorityColor), systemImage: vectorSystemImage(for: issue.priorityIcon))
            }
          }
        }
        .padding(.vertical, 4)
      }

      Section("Assignments") {
        if viewModel.assignments.isEmpty {
          AssignmentRow(assignment: VectorIssueAssignment(
            id: "current-\(issue.id)",
            assigneeId: issue.assigneeId,
            assigneeName: issue.assigneeName,
            assigneeEmail: issue.assigneeEmail,
            assigneeImage: issue.assigneeImage,
            stateId: issue.workflowStateId,
            stateName: issue.workflowStateName,
            stateIcon: issue.workflowStateIcon,
            stateColor: issue.workflowStateColor,
            stateType: issue.workflowStateType
          ))
        } else {
          ForEach(viewModel.assignments) { assignment in
            AssignmentRow(assignment: assignment)
          }
        }
      }

      Section("Comments") {
        ForEach(viewModel.comments) { comment in
          CommentRow(comment: comment)
        }
      }

      Section {
        Link(destination: viewModel.openWebURL(for: issue)) {
          Label("Open full issue on web", systemImage: "safari")
        }
      }
    }
    .navigationTitle(issue.key)
    .vectorInlineNavigationTitle()
    .onAppear {
      viewModel.loadIssueSupport(issueId: issue.id)
    }
  }
}

struct AssignmentRow: View {
  let assignment: VectorIssueAssignment

  var body: some View {
    HStack(spacing: 10) {
      Circle()
        .fill(Color(vectorHex: assignment.stateColor))
        .frame(width: 8, height: 8)
      VStack(alignment: .leading, spacing: 2) {
        Text(assignment.assigneeName ?? "Unassigned")
          .font(.subheadline.weight(.medium))
        Text(assignment.stateName ?? "No status")
          .font(.caption)
          .foregroundStyle(.secondary)
      }
    }
  }
}

struct CommentRow: View {
  let comment: VectorComment

  var body: some View {
    VStack(alignment: .leading, spacing: 6) {
      Text(comment.author?.displayName ?? "Unknown user")
        .font(.caption.weight(.semibold))
        .foregroundStyle(.secondary)
      Text(comment.body)
        .font(.subheadline)
    }
    .padding(.vertical, 4)
  }
}

struct ProjectsScreen: View {
  @ObservedObject var viewModel: VectorMobileViewModel

  var body: some View {
    List(viewModel.projects) { project in
      NavigationLink {
        ProjectDetailScreen(project: project, viewModel: viewModel)
      } label: {
        ProjectRow(project: project)
      }
    }
    .listStyle(.plain)
    .navigationTitle("Projects")
    .toolbar {
      ToolbarItem(placement: .principal) {
        Picker("Scope", selection: $viewModel.projectScope) {
          ForEach(VectorProjectScope.allCases) { scope in
            Text(scope.label).tag(scope)
          }
        }
        .pickerStyle(.segmented)
        .frame(width: 180)
        .onChange(of: viewModel.projectScope) {
          viewModel.refresh()
        }
      }
    }
  }
}

struct ProjectRow: View {
  let project: VectorProject

  var body: some View {
    HStack(spacing: 10) {
      Image(systemName: vectorSystemImage(for: project.icon))
        .foregroundStyle(Color(vectorHex: project.color))
        .frame(width: 24)
      VStack(alignment: .leading, spacing: 3) {
        Text(project.name)
          .font(.subheadline.weight(.medium))
        Text(project.key)
          .font(.caption.monospaced())
          .foregroundStyle(.secondary)
      }
      Spacer()
      if let status = project.status {
        VectorPill(text: status.name, color: Color(vectorHex: status.color), systemImage: vectorSystemImage(for: status.icon))
      }
    }
    .padding(.vertical, 4)
  }
}

struct ProjectDetailScreen: View {
  let project: VectorProject
  @ObservedObject var viewModel: VectorMobileViewModel
  @State private var tab = "issues"

  private var projectIssues: [VectorIssueRow] {
    viewModel.issues.filter { $0.projectId == project.id || $0.projectKey == project.key }
  }

  var body: some View {
    VStack(spacing: 0) {
      EntityHeader(
        icon: project.icon,
        color: project.color,
        title: project.name,
        subtitle: project.description ?? project.key
      )
      Picker("Project section", selection: $tab) {
        Text("Issues").tag("issues")
        Text("Activity").tag("activity")
        Text("Members").tag("members")
      }
      .pickerStyle(.segmented)
      .padding()

      List {
        if tab == "issues" {
          ForEach(projectIssues, id: \.rowId) { issue in
            NavigationLink {
              IssueDetailScreen(issue: issue, viewModel: viewModel)
            } label: {
              IssueRowView(issue: issue)
            }
          }
        } else if tab == "members" {
          if let lead = project.lead {
            Label(lead.displayName, systemImage: "person.crop.circle")
          }
        } else {
          Label("Activity will stream from Convex in the live-data slice", systemImage: "rays")
        }
        Link(destination: viewModel.openWebURL(for: project)) {
          Label("Open project on web", systemImage: "safari")
        }
      }
      .listStyle(.plain)
    }
    .navigationTitle(project.key)
    .vectorInlineNavigationTitle()
  }
}

struct TeamsScreen: View {
  @ObservedObject var viewModel: VectorMobileViewModel

  var body: some View {
    List(viewModel.teams) { team in
      NavigationLink {
        TeamDetailScreen(team: team, viewModel: viewModel)
      } label: {
        TeamRow(team: team)
      }
    }
    .listStyle(.plain)
    .navigationTitle("Teams")
  }
}

struct TeamRow: View {
  let team: VectorTeam

  var body: some View {
    HStack(spacing: 10) {
      Image(systemName: vectorSystemImage(for: team.icon))
        .foregroundStyle(Color(vectorHex: team.color))
        .frame(width: 24)
      VStack(alignment: .leading, spacing: 3) {
        Text(team.name)
          .font(.subheadline.weight(.medium))
        Text(team.key)
          .font(.caption.monospaced())
          .foregroundStyle(.secondary)
      }
      Spacer()
      if let count = team.memberCount {
        VectorPill(text: "\(count)", color: .secondary, systemImage: "person.2")
      }
    }
    .padding(.vertical, 4)
  }
}

struct TeamDetailScreen: View {
  let team: VectorTeam
  @ObservedObject var viewModel: VectorMobileViewModel
  @State private var tab = "issues"

  private var teamIssues: [VectorIssueRow] {
    viewModel.issues.filter { $0.teamId == team.id || $0.teamKey == team.key }
  }

  var body: some View {
    VStack(spacing: 0) {
      EntityHeader(
        icon: team.icon,
        color: team.color,
        title: team.name,
        subtitle: team.description ?? team.key
      )
      Picker("Team section", selection: $tab) {
        Text("Issues").tag("issues")
        Text("Projects").tag("projects")
        Text("Members").tag("members")
        Text("Activity").tag("activity")
      }
      .pickerStyle(.segmented)
      .padding()

      List {
        if tab == "issues" {
          ForEach(teamIssues, id: \.rowId) { issue in
            NavigationLink {
              IssueDetailScreen(issue: issue, viewModel: viewModel)
            } label: {
              IssueRowView(issue: issue)
            }
          }
        } else if tab == "projects" {
          ForEach(viewModel.projects.filter { $0.teamId == team.id }) { project in
            ProjectRow(project: project)
          }
        } else if tab == "members" {
          if let lead = team.lead {
            Label(lead.displayName, systemImage: "person.crop.circle")
          }
        } else {
          Label("Activity will stream from Convex in the live-data slice", systemImage: "rays")
        }
        Link(destination: viewModel.openWebURL(for: team)) {
          Label("Open team on web", systemImage: "safari")
        }
      }
      .listStyle(.plain)
    }
    .navigationTitle(team.key)
    .vectorInlineNavigationTitle()
  }
}

struct EntityHeader: View {
  let icon: String?
  let color: String?
  let title: String
  let subtitle: String

  var body: some View {
    HStack(alignment: .top, spacing: 12) {
      Image(systemName: vectorSystemImage(for: icon))
        .font(.title3)
        .foregroundStyle(Color(vectorHex: color))
        .frame(width: 32, height: 32)
        .background(Color(vectorHex: color).opacity(0.12), in: RoundedRectangle(cornerRadius: 8, style: .continuous))
      VStack(alignment: .leading, spacing: 4) {
        Text(title)
          .font(.headline)
        Text(subtitle)
          .font(.subheadline)
          .foregroundStyle(.secondary)
          .lineLimit(2)
      }
      Spacer()
    }
    .padding()
    .frame(maxWidth: .infinity, alignment: .leading)
    .background(VectorTheme.groupedBackground)
  }
}

struct MobileSettingsScreen: View {
  @ObservedObject var viewModel: VectorMobileViewModel

  var body: some View {
    List {
      Section("Mobile") {
        NavigationLink {
          PersonalSettingsPreview()
        } label: {
          Label("Personal settings", systemImage: "person.crop.circle")
        }
        NavigationLink {
          StatusSettingsPreview()
        } label: {
          Label("Status settings", systemImage: "slider.horizontal.3")
        }
      }

      Section("Web only") {
        Link(destination: viewModel.configuration.webURL(path: "/settings/profile")) {
          Label("Profile on web", systemImage: "safari")
        }
        Link(destination: viewModel.configuration.webURL(path: "/\(viewModel.configuration.orgSlug)/settings")) {
          Label("Workspace settings", systemImage: "building.2")
        }
        Link(destination: viewModel.configuration.workspaceWebURL) {
          Label("Open workspace", systemImage: "arrow.up.forward.app")
        }
      }
    }
    .navigationTitle("Settings")
  }
}

struct PersonalSettingsPreview: View {
  var body: some View {
    List {
      Section {
        Label("Profile", systemImage: "person")
        Label("Notifications", systemImage: "bell")
        Label("Devices", systemImage: "iphone")
      }
    }
    .navigationTitle("Personal")
  }
}

struct StatusSettingsPreview: View {
  var body: some View {
    List {
      Section("Issue states") {
        ForEach(VectorMockData.issueStates) { state in
          Label(state.name, systemImage: vectorSystemImage(for: state.icon))
        }
      }
      Section("Priorities") {
        ForEach(VectorMockData.priorities) { priority in
          Label(priority.name, systemImage: vectorSystemImage(for: priority.icon))
        }
      }
      Section("Project statuses") {
        ForEach(VectorMockData.projectStatuses) { status in
          Label(status.name, systemImage: vectorSystemImage(for: status.icon))
        }
      }
    }
    .navigationTitle("Statuses")
  }
}

struct SkeletonIssueList: View {
  var body: some View {
    List(0..<8, id: \.self) { _ in
      VStack(alignment: .leading, spacing: 8) {
        RoundedRectangle(cornerRadius: 4)
          .frame(width: 220, height: 14)
        RoundedRectangle(cornerRadius: 4)
          .frame(width: 150, height: 10)
      }
      .foregroundStyle(Color.secondary.opacity(0.25))
      .redacted(reason: .placeholder)
    }
    .listStyle(.plain)
  }
}

#Preview {
  VectorMobileRootView()
}
