import SwiftUI

public struct VectorMobileRootView: View {
  @StateObject private var sessionController: VectorMobileSessionController

  public init(sessionController: VectorMobileSessionController = VectorMobileSessionController()) {
    self._sessionController = StateObject(wrappedValue: sessionController)
  }

  @ViewBuilder
  public var body: some View {
    switch sessionController.phase {
    case .restoring:
      VectorSessionRestoreScreen()
    case .signedOut, .authenticating:
      VectorSetupScreen(sessionController: sessionController)
    case .signedIn:
      if let viewModel = sessionController.viewModel {
        AuthenticatedVectorMobileView(viewModel: viewModel, sessionController: sessionController)
      } else {
        VectorSessionRestoreScreen()
      }
    }
  }
}

private struct AuthenticatedVectorMobileView: View {
  @ObservedObject var viewModel: VectorMobileViewModel
  @ObservedObject var sessionController: VectorMobileSessionController
  @State private var selectedTab: VectorMobileTab = .issues

  var body: some View {
    NavigationStack {
      switch selectedTab {
      case .issues:
        IssuesScreen(viewModel: viewModel)
      case .projects:
        ProjectsScreen(viewModel: viewModel)
      case .teams:
        TeamsScreen(viewModel: viewModel)
      case .settings:
        MobileSettingsScreen(viewModel: viewModel, sessionController: sessionController)
      }
    }
    .tint(VectorTheme.accent)
    .safeAreaInset(edge: .bottom, spacing: 0) {
      VectorCompactTabBar(selection: $selectedTab)
    }
  }
}

private enum VectorMobileTab: String, CaseIterable, Identifiable {
  case issues
  case projects
  case teams
  case settings

  var id: String { rawValue }

  var title: String {
    switch self {
    case .issues: "Issues"
    case .projects: "Projects"
    case .teams: "Teams"
    case .settings: "Settings"
    }
  }

  var systemImage: String {
    switch self {
    case .issues: "checklist"
    case .projects: "folder"
    case .teams: "person.3"
    case .settings: "gearshape"
    }
  }
}

private struct VectorCompactTabBar: View {
  @Binding var selection: VectorMobileTab

  var body: some View {
    VStack(spacing: 0) {
      Divider()
      HStack(spacing: 0) {
        ForEach(VectorMobileTab.allCases) { tab in
          Button {
            selection = tab
          } label: {
            VStack(spacing: 3) {
              Image(systemName: tab.systemImage)
                .font(.system(size: 16, weight: .semibold))
              Text(tab.title)
                .font(.caption2.weight(.medium))
            }
            .frame(maxWidth: .infinity)
            .frame(height: 46)
            .foregroundStyle(selection == tab ? VectorTheme.accent : Color.secondary)
            .contentShape(Rectangle())
          }
          .buttonStyle(.plain)
        }
      }
      .padding(.horizontal, 4)
      .background(VectorTheme.rowBackground)
    }
    .background(VectorTheme.rowBackground)
  }
}

private struct VectorSessionRestoreScreen: View {
  var body: some View {
    VStack(spacing: 18) {
      VectorLogoMark(size: 72)
      ProgressView()
        .tint(VectorTheme.accent)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .background(VectorTheme.groupedBackground)
  }
}

private struct VectorSetupScreen: View {
  @ObservedObject var sessionController: VectorMobileSessionController
  @State private var appURLString = ""
  @State private var identifier = ""
  @State private var password = ""
  @State private var orgSlug = ""

  private var canSubmit: Bool {
    !appURLString.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
      && !identifier.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
      && !password.isEmpty
      && sessionController.phase != .authenticating
  }

  var body: some View {
    NavigationStack {
      ZStack {
        VectorAuthBackground()

        ScrollView {
          VStack(spacing: 18) {
            VectorLoginBrand()

            VStack(alignment: .leading, spacing: 14) {
              VStack(alignment: .leading, spacing: 6) {
                Text("Sign in")
                  .font(.headline.weight(.semibold))
                  .foregroundStyle(.white)
                Text("Enter your credentials to continue")
                  .font(.caption)
                  .foregroundStyle(.white.opacity(0.62))
              }

              VStack(spacing: 10) {
                VectorLoginField(title: "Instance URL", text: $appURLString, prompt: "imai.tech", keyboard: .url)
                VectorLoginField(title: "Email or Username", text: $identifier, prompt: "you@example.com", keyboard: .email)
                VectorLoginSecureField(text: $password, onSubmit: signIn)
                VectorLoginField(title: "Workspace slug", text: $orgSlug, prompt: "Optional", keyboard: .plain)
              }

              if let error = sessionController.errorMessage {
                Label(error, systemImage: "exclamationmark.triangle")
                  .font(.caption)
                  .foregroundStyle(Color(red: 1.0, green: 0.42, blue: 0.48))
                  .fixedSize(horizontal: false, vertical: true)
              }

              Button(action: signIn) {
                HStack(spacing: 8) {
                  if sessionController.phase == .authenticating {
                    ProgressView()
                      .controlSize(.small)
                      .tint(.white)
                  }
                  Text(sessionController.phase == .authenticating ? "Signing in" : "Sign in")
                    .font(.subheadline.weight(.semibold))
                }
                .frame(maxWidth: .infinity)
                .frame(height: 38)
                .foregroundStyle(canSubmit ? Color.white : Color.white.opacity(0.38))
                .background(
                  canSubmit ? VectorTheme.accent : Color.white.opacity(0.08),
                  in: RoundedRectangle(cornerRadius: 7, style: .continuous)
                )
              }
              .buttonStyle(.plain)
              .disabled(!canSubmit)
            }
            .padding(12)
            .frame(maxWidth: 304)
            .background(Color(red: 0.08, green: 0.08, blue: 0.10).opacity(0.94), in: RoundedRectangle(cornerRadius: 8, style: .continuous))
            .overlay(
              RoundedRectangle(cornerRadius: 8, style: .continuous)
                .stroke(Color.white.opacity(0.08), lineWidth: 0.5)
            )
            .shadow(color: Color.black.opacity(0.34), radius: 20, x: 0, y: 14)

            HStack(spacing: 4) {
              Text("Need a quick look?")
                .foregroundStyle(.white.opacity(0.46))
              Button("Preview sample data") {
                sessionController.useDemoData()
              }
              .buttonStyle(.plain)
              .foregroundStyle(VectorTheme.accent)
            }
            .font(.caption)
          }
          .frame(maxWidth: .infinity)
          .padding(.horizontal, 20)
          .padding(.top, 92)
          .padding(.bottom, 32)
        }
      }
      .ignoresSafeArea()
      .vectorHiddenNavigationBar()
    }
  }

  private func signIn() {
    guard canSubmit else {
      return
    }
    Task {
      await sessionController.signIn(
        appURLString: appURLString,
        identifier: identifier,
        password: password,
        orgSlug: orgSlug.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : orgSlug
      )
    }
  }
}

private struct VectorAuthBackground: View {
  var body: some View {
    ZStack {
      LinearGradient(
        colors: [
          Color(red: 0.01, green: 0.01, blue: 0.04),
          Color(red: 0.02, green: 0.03, blue: 0.08),
          Color(red: 0.01, green: 0.01, blue: 0.03),
        ],
        startPoint: .topLeading,
        endPoint: .bottomTrailing
      )
      RadialGradient(
        colors: [
          Color(red: 0.05, green: 0.47, blue: 0.62).opacity(0.34),
          Color.clear,
        ],
        center: .bottomTrailing,
        startRadius: 12,
        endRadius: 360
      )
      RadialGradient(
        colors: [
          Color(red: 0.20, green: 0.12, blue: 0.46).opacity(0.24),
          Color.clear,
        ],
        center: .topLeading,
        startRadius: 0,
        endRadius: 280
      )
    }
  }
}

private struct VectorLoginBrand: View {
  var body: some View {
    HStack(spacing: 6) {
      Image("VectorLogo")
        .resizable()
        .scaledToFit()
        .frame(width: 15, height: 15)
      Text("Vector")
        .font(.caption.weight(.semibold))
        .foregroundStyle(.white)
    }
    .accessibilityElement(children: .combine)
    .accessibilityLabel("Vector")
  }
}

private struct VectorLoginField: View {
  let title: String
  @Binding var text: String
  let prompt: String
  let keyboard: VectorSetupKeyboard

  var body: some View {
    VStack(alignment: .leading, spacing: 5) {
      Text(title)
        .font(.caption2.weight(.medium))
        .foregroundStyle(.white.opacity(0.72))
        .lineLimit(1)
      TextField(prompt, text: $text)
        .vectorSetupKeyboard(keyboard)
        .font(.caption)
        .foregroundStyle(.white)
        .padding(.horizontal, 9)
        .frame(height: 34)
        .background(Color.white.opacity(0.085), in: RoundedRectangle(cornerRadius: 6, style: .continuous))
        .overlay(
          RoundedRectangle(cornerRadius: 6, style: .continuous)
            .stroke(Color.white.opacity(0.16), lineWidth: 0.5)
        )
    }
  }
}

private struct VectorLoginSecureField: View {
  @Binding var text: String
  let onSubmit: () -> Void

  var body: some View {
    VStack(alignment: .leading, spacing: 5) {
      Text("Password")
        .font(.caption2.weight(.medium))
        .foregroundStyle(.white.opacity(0.72))
      SecureField("Your password", text: $text)
        .textContentType(.password)
        .submitLabel(.go)
        .onSubmit(onSubmit)
        .font(.caption)
        .foregroundStyle(.white)
        .padding(.horizontal, 9)
        .frame(height: 34)
        .background(Color.white.opacity(0.085), in: RoundedRectangle(cornerRadius: 6, style: .continuous))
        .overlay(
          RoundedRectangle(cornerRadius: 6, style: .continuous)
            .stroke(Color.white.opacity(0.16), lineWidth: 0.5)
        )
    }
  }
}

private enum VectorSetupKeyboard {
  case url
  case email
  case plain
}

private extension View {
  @ViewBuilder
  func vectorSetupKeyboard(_ keyboard: VectorSetupKeyboard) -> some View {
    #if os(iOS)
      switch keyboard {
      case .url:
        self
          .keyboardType(.URL)
          .textContentType(.URL)
          .textInputAutocapitalization(.never)
          .autocorrectionDisabled()
      case .email:
        self
          .keyboardType(.emailAddress)
          .textContentType(.username)
          .textInputAutocapitalization(.never)
          .autocorrectionDisabled()
      case .plain:
        self
          .textInputAutocapitalization(.never)
          .autocorrectionDisabled()
      }
    #else
      self
    #endif
  }
}

private struct VectorLogoMark: View {
  let size: CGFloat

  var body: some View {
    Image("VectorLogo")
      .resizable()
      .scaledToFit()
      .padding(size * 0.24)
      .frame(width: size, height: size)
      .background(
        Color.black,
        in: RoundedRectangle(cornerRadius: min(size * 0.18, 8), style: .continuous)
      )
      .accessibilityLabel("Vector")
  }
}

private struct CompactSearchField: View {
  @Binding var text: String
  let prompt: String

  var body: some View {
    HStack(spacing: 8) {
      Image(systemName: "magnifyingglass")
        .font(.caption.weight(.semibold))
        .foregroundStyle(.secondary)
      TextField(prompt, text: $text)
        .font(.subheadline)
        .vectorSetupKeyboard(.plain)
    }
    .padding(.horizontal, 10)
    .frame(height: 34)
    .background(VectorTheme.rowBackground, in: RoundedRectangle(cornerRadius: 7, style: .continuous))
    .vectorShadowRing(cornerRadius: 7)
  }
}

private struct CompactSegmentedControl<Option: Hashable>: View {
  let options: [Option]
  @Binding var selection: Option
  let label: (Option) -> String

  var body: some View {
    HStack(spacing: 0) {
      ForEach(options, id: \.self) { option in
        Button {
          selection = option
        } label: {
          Text(label(option))
            .font(.caption.weight(.semibold))
            .lineLimit(1)
            .frame(maxWidth: .infinity)
            .frame(height: 30)
            .foregroundStyle(selection == option ? Color.primary : Color.secondary)
            .background(selection == option ? VectorTheme.rowBackground : Color.clear)
        }
        .buttonStyle(.plain)
      }
    }
    .padding(2)
    .background(Color.secondary.opacity(0.10), in: RoundedRectangle(cornerRadius: 7, style: .continuous))
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
      VStack(spacing: 8) {
        CompactSearchField(text: $searchText, prompt: "Search issues")
        CompactSegmentedControl(options: VectorIssueScope.allCases, selection: $viewModel.issueScope) { $0.label }
          .onChange(of: viewModel.issueScope) {
            viewModel.refresh()
          }
        CompactSegmentedControl(options: VectorIssueLayoutMode.allCases, selection: $viewModel.issueLayoutMode) { $0.label }
      }
      .padding(12)

      content
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
    .background(VectorTheme.groupedBackground)
    .navigationTitle("Issues")
    .vectorInlineNavigationTitle()
    .toolbar {
      ToolbarItem(placement: .primaryAction) {
        Link(destination: viewModel.configuration.webURL(path: "/\(viewModel.configuration.orgSlug)/issues")) {
          Image(systemName: "safari")
        }
        .accessibilityLabel("Open issues on web")
      }
    }
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
    ScrollView {
      LazyVStack(spacing: 0) {
        ForEach(issues, id: \.rowId) { issue in
          NavigationLink {
            IssueDetailScreen(issue: issue, viewModel: viewModel)
          } label: {
            IssueRowView(issue: issue)
              .padding(.horizontal, 12)
              .padding(.vertical, 8)
              .contentShape(Rectangle())
          }
          .buttonStyle(.plain)

          Divider()
            .padding(.leading, 12)
        }
      }
    }
    .background(VectorTheme.rowBackground)
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
    ScrollView {
      LazyVStack(alignment: .leading, spacing: 14) {
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
          .frame(maxWidth: .infinity, alignment: .topLeading)
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
    ScrollView {
      LazyVStack(alignment: .leading, spacing: 0, pinnedViews: []) {
        ForEach(groups, id: \.0) { group in
          Text(group.0)
            .font(.caption.weight(.semibold))
            .foregroundStyle(.secondary)
            .padding(.horizontal, 12)
            .padding(.top, 14)
            .padding(.bottom, 6)

          ForEach(group.1, id: \.rowId) { issue in
            NavigationLink {
              IssueDetailScreen(issue: issue, viewModel: viewModel)
            } label: {
              TimelineIssueRow(issue: issue)
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)

            Divider()
              .padding(.leading, 12)
          }
        }
      }
    }
    .background(VectorTheme.rowBackground)
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
    .vectorShadowRing(cornerRadius: 8)
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
    VStack(spacing: 0) {
      CompactSegmentedControl(options: VectorProjectScope.allCases, selection: $viewModel.projectScope) { $0.label }
        .padding(12)
        .onChange(of: viewModel.projectScope) {
          viewModel.refresh()
        }

      List(viewModel.projects) { project in
        NavigationLink {
          ProjectDetailScreen(project: project, viewModel: viewModel)
        } label: {
          ProjectRow(project: project)
        }
      }
      .listStyle(.plain)
    }
    .background(VectorTheme.groupedBackground)
    .navigationTitle("Projects")
    .vectorInlineNavigationTitle()
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
      CompactSegmentedControl(options: ["issues", "activity", "members"], selection: $tab) { $0.capitalized }
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
    .vectorInlineNavigationTitle()
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
      CompactSegmentedControl(options: ["issues", "projects", "members", "activity"], selection: $tab) { $0.capitalized }
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
  @ObservedObject var sessionController: VectorMobileSessionController

  var body: some View {
    List {
      Section("Account") {
        HStack {
          Label(sessionController.user?.displayName ?? "Signed in", systemImage: "person.crop.circle")
          Spacer()
          if sessionController.isDemoMode {
            Text("Preview")
              .font(.caption)
              .foregroundStyle(.secondary)
          }
        }
        Button(role: .destructive) {
          sessionController.signOut()
        } label: {
          Label(sessionController.isDemoMode ? "Exit preview" : "Sign out", systemImage: "rectangle.portrait.and.arrow.right")
        }
      }

      Section("Instance") {
        LabeledContent("App URL", value: viewModel.configuration.webBaseURL.absoluteString)
        LabeledContent("Workspace", value: viewModel.configuration.orgSlug)
      }

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
