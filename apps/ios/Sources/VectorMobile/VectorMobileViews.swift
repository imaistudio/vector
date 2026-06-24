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
  @StateObject private var pushCoordinator = VectorPushNotificationCoordinator.shared
  @State private var selectedTab: VectorMobileTab = .issues

  var body: some View {
    TabView(selection: $selectedTab) {
      NavigationStack {
        IssuesScreen(viewModel: viewModel)
      }
      .tabItem {
        Label(VectorMobileTab.issues.title, systemImage: VectorMobileTab.issues.systemImage)
      }
      .tag(VectorMobileTab.issues)

      NavigationStack {
        ProjectsScreen(viewModel: viewModel)
      }
      .tabItem {
        Label(VectorMobileTab.projects.title, systemImage: VectorMobileTab.projects.systemImage)
      }
      .tag(VectorMobileTab.projects)

      NavigationStack {
        TeamsScreen(viewModel: viewModel)
      }
      .tabItem {
        Label(VectorMobileTab.teams.title, systemImage: VectorMobileTab.teams.systemImage)
      }
      .tag(VectorMobileTab.teams)

      NavigationStack {
        MobileSettingsScreen(
          viewModel: viewModel,
          sessionController: sessionController,
          pushCoordinator: pushCoordinator
        )
      }
      .tabItem {
        Label(VectorMobileTab.settings.title, systemImage: VectorMobileTab.settings.systemImage)
      }
      .tag(VectorMobileTab.settings)
    }
    .tint(VectorTheme.accent)
    .onAppear {
      Task {
        await pushCoordinator.registerForRemoteNotificationsIfAuthorized()
        if let token = pushCoordinator.deviceToken {
          viewModel.upsertMobilePushToken(token)
        }
      }
    }
    .onReceive(pushCoordinator.$deviceToken.compactMap { $0 }.removeDuplicates()) { token in
      viewModel.upsertMobilePushToken(token)
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
          VStack(spacing: 22) {
            VectorLoginHero()

            VStack(alignment: .leading, spacing: 14) {
              VectorNativeLoginForm(
                appURLString: $appURLString,
                identifier: $identifier,
                password: $password,
                orgSlug: $orgSlug,
                onSubmit: signIn
              )

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
                .frame(height: 46)
                .foregroundStyle(Color.white)
                .background(
                  canSubmit ? VectorTheme.accent : Color.white.opacity(0.16),
                  in: RoundedRectangle(cornerRadius: 12, style: .continuous)
                )
              }
              .buttonStyle(.plain)
              .disabled(!canSubmit)

              Button {
                sessionController.useDemoData()
              } label: {
                Text("Preview sample data")
                  .font(.subheadline.weight(.medium))
                  .frame(maxWidth: .infinity)
                  .frame(height: 38)
              }
              .buttonStyle(.plain)
              .foregroundStyle(.white.opacity(0.78))
            }
            .frame(maxWidth: 360)
          }
          .frame(maxWidth: .infinity)
          .padding(.horizontal, 20)
          .padding(.top, 78)
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

private struct VectorLoginHero: View {
  var body: some View {
    VStack(spacing: 12) {
      Image("VectorLogo")
        .resizable()
        .scaledToFit()
        .frame(width: 58, height: 58)
        .shadow(color: VectorTheme.accent.opacity(0.28), radius: 22, x: 0, y: 10)

      VStack(spacing: 4) {
        Text("Vector")
          .font(.system(size: 28, weight: .semibold))
          .foregroundStyle(.white)
        Text("Sign in to your workspace")
          .font(.subheadline)
          .foregroundStyle(.white.opacity(0.64))
      }
    }
    .accessibilityElement(children: .combine)
    .accessibilityLabel("Vector. Sign in to your workspace.")
  }
}

private struct VectorNativeLoginForm: View {
  @Binding var appURLString: String
  @Binding var identifier: String
  @Binding var password: String
  @Binding var orgSlug: String
  let onSubmit: () -> Void

  var body: some View {
    VStack(spacing: 0) {
      VectorLoginFormRow(title: "Instance", text: $appURLString, prompt: "imai.tech", keyboard: .url)
      VectorLoginSeparator()
      VectorLoginFormRow(title: "Account", text: $identifier, prompt: "you@example.com", keyboard: .email)
      VectorLoginSeparator()
      VectorLoginPasswordRow(text: $password, onSubmit: onSubmit)
      VectorLoginSeparator()
      VectorLoginFormRow(title: "Workspace", text: $orgSlug, prompt: "Optional", keyboard: .plain)
    }
    .background(
      Color(red: 0.08, green: 0.09, blue: 0.12).opacity(0.82),
      in: RoundedRectangle(cornerRadius: 14, style: .continuous)
    )
    .overlay(
      RoundedRectangle(cornerRadius: 14, style: .continuous)
        .stroke(Color.white.opacity(0.12), lineWidth: 0.5)
    )
    .shadow(color: Color.black.opacity(0.28), radius: 18, x: 0, y: 12)
  }
}

private struct VectorLoginSeparator: View {
  var body: some View {
    Rectangle()
      .fill(Color.white.opacity(0.10))
      .frame(height: 0.5)
      .padding(.leading, 108)
  }
}

private struct VectorLoginFormRow: View {
  let title: String
  @Binding var text: String
  let prompt: String
  let keyboard: VectorSetupKeyboard

  var body: some View {
    HStack(spacing: 12) {
      Text(title)
        .font(.subheadline.weight(.medium))
        .foregroundStyle(.white.opacity(0.92))
        .frame(width: 84, alignment: .leading)
      TextField("", text: $text, prompt: Text(prompt).foregroundStyle(.white.opacity(0.34)))
        .vectorSetupKeyboard(keyboard)
        .font(.subheadline)
        .foregroundStyle(.white)
        .tint(VectorTheme.accent)
        .submitLabel(.next)
    }
    .padding(.horizontal, 14)
    .frame(height: 46)
  }
}

private struct VectorLoginPasswordRow: View {
  @Binding var text: String
  let onSubmit: () -> Void

  var body: some View {
    HStack(spacing: 12) {
      Text("Password")
        .font(.subheadline.weight(.medium))
        .foregroundStyle(.white.opacity(0.92))
        .frame(width: 84, alignment: .leading)
      SecureField("", text: $text, prompt: Text("Required").foregroundStyle(.white.opacity(0.34)))
        .textContentType(.password)
        .submitLabel(.go)
        .onSubmit(onSubmit)
        .font(.subheadline)
        .foregroundStyle(.white)
        .tint(VectorTheme.accent)
    }
    .padding(.horizontal, 14)
    .frame(height: 46)
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
  @State private var isSearchPresented = false
  @FocusState private var isSearchFocused: Bool

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
        if isSearchPresented || !searchText.isEmpty {
          HStack(spacing: 8) {
            TextField("Search issues", text: $searchText)
              .textFieldStyle(.roundedBorder)
              .focused($isSearchFocused)
              .submitLabel(.search)
            Button("Cancel") {
              withAnimation(.snappy(duration: 0.18)) {
                searchText = ""
                isSearchPresented = false
                isSearchFocused = false
              }
            }
            .font(.caption.weight(.semibold))
            .buttonStyle(.plain)
            .foregroundStyle(VectorTheme.accent)
          }
          .transition(.move(edge: .top).combined(with: .opacity))
        }

        HStack(spacing: 8) {
          CompactSegmentedControl(options: VectorIssueScope.allCases, selection: $viewModel.issueScope) { $0.label }
            .onChange(of: viewModel.issueScope) {
              viewModel.refresh()
            }
          IssueLayoutMenu(selection: $viewModel.issueLayoutMode)
        }
      }
      .padding(12)

      content
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
    .background(VectorTheme.groupedBackground)
    .navigationTitle("Issues")
    .vectorInlineNavigationTitle()
    .toolbar {
      #if os(iOS)
      ToolbarItem(placement: .topBarLeading) {
        Link(destination: viewModel.configuration.webURL(path: "/\(viewModel.configuration.orgSlug)/issues")) {
          Image(systemName: "safari")
        }
        .accessibilityLabel("Open issues on web")
      }
      #else
      ToolbarItem(placement: .automatic) {
        Link(destination: viewModel.configuration.webURL(path: "/\(viewModel.configuration.orgSlug)/issues")) {
          Image(systemName: "safari")
        }
        .accessibilityLabel("Open issues on web")
      }
      #endif

      ToolbarItem(placement: .primaryAction) {
        Button {
          withAnimation(.snappy(duration: 0.18)) {
            isSearchPresented.toggle()
            if !isSearchPresented {
              isSearchFocused = false
            }
          }
        } label: {
          Image(systemName: isSearchPresented ? "xmark" : "magnifyingglass")
        }
        .accessibilityLabel(isSearchPresented ? "Hide search" : "Search issues")
      }
    }
    .onChange(of: isSearchPresented) { _, presented in
      if presented {
        Task { @MainActor in
          try? await Task.sleep(nanoseconds: 120_000_000)
          isSearchFocused = true
        }
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

private struct IssueLayoutMenu: View {
  @Binding var selection: VectorIssueLayoutMode

  var body: some View {
    Menu {
      ForEach(VectorIssueLayoutMode.allCases, id: \.self) { mode in
        Button {
          selection = mode
        } label: {
          Label(mode.label, systemImage: mode == selection ? "checkmark" : mode.systemImage)
        }
      }
    } label: {
      HStack(spacing: 6) {
        Image(systemName: selection.systemImage)
          .font(.caption.weight(.semibold))
        Text(selection.label)
          .font(.caption.weight(.semibold))
          .lineLimit(1)
        Image(systemName: "chevron.down")
          .font(.caption2.weight(.bold))
      }
      .foregroundStyle(Color.primary)
      .padding(.horizontal, 10)
      .frame(height: 34)
      .background(VectorTheme.rowBackground, in: RoundedRectangle(cornerRadius: 7, style: .continuous))
      .vectorShadowRing(cornerRadius: 7)
    }
    .buttonStyle(.plain)
  }
}

private extension VectorIssueLayoutMode {
  var systemImage: String {
    switch self {
    case .list: "list.bullet"
    case .board: "rectangle.grid.2x2"
    case .timeline: "clock"
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
    ScrollView {
      VStack(alignment: .leading, spacing: 22) {
        VStack(alignment: .leading, spacing: 12) {
          Text(issue.key)
            .font(.caption.monospaced())
            .foregroundStyle(.secondary)
          Text(issue.title)
            .font(.system(size: 28, weight: .semibold))
            .fixedSize(horizontal: false, vertical: true)
          HStack(spacing: 6) {
            VectorPill(text: issue.stateLabel, color: Color(vectorHex: issue.workflowStateColor), systemImage: vectorSystemImage(for: issue.workflowStateIcon))
            if let priority = issue.priorityName {
              VectorPill(text: priority, color: Color(vectorHex: issue.priorityColor), systemImage: vectorSystemImage(for: issue.priorityIcon))
            }
            if let projectKey = issue.projectKey {
              VectorPill(text: projectKey, color: .secondary, systemImage: "folder")
            }
          }
        }

        if let description = issue.description, !description.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
          MarkdownDocumentView(markdown: description)
        } else {
          Text("No description")
            .font(.subheadline)
            .foregroundStyle(.secondary)
        }

        Divider()

        DocumentSection(title: "Assignments") {
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

        DocumentSection(title: "Comments") {
          if viewModel.comments.isEmpty {
            Text("No comments yet")
              .font(.subheadline)
              .foregroundStyle(.secondary)
          } else {
            ForEach(viewModel.comments) { comment in
              CommentRow(comment: comment)
            }
          }
        }

        Link(destination: viewModel.openWebURL(for: issue)) {
          Label("Open full issue on web", systemImage: "safari")
            .font(.subheadline.weight(.medium))
        }
      }
      .padding(.horizontal, 22)
      .padding(.top, 22)
      .padding(.bottom, 104)
      .frame(maxWidth: .infinity, alignment: .leading)
    }
    .background(VectorTheme.rowBackground)
    .navigationTitle(issue.key)
    .vectorInlineNavigationTitle()
    .toolbar {
      ToolbarItem(placement: .primaryAction) {
        Link(destination: viewModel.openWebURL(for: issue)) {
          Image(systemName: "safari")
        }
        .accessibilityLabel("Open full issue on web")
      }
    }
    .onAppear {
      viewModel.loadIssueSupport(issueId: issue.id)
    }
  }
}

private struct DocumentSection<Content: View>: View {
  let title: String
  @ViewBuilder var content: Content

  var body: some View {
    VStack(alignment: .leading, spacing: 10) {
      Text(title)
        .font(.caption.weight(.semibold))
        .foregroundStyle(.secondary)
        .textCase(.uppercase)
      VStack(alignment: .leading, spacing: 12) {
        content
      }
    }
    .frame(maxWidth: .infinity, alignment: .leading)
  }
}

private struct MarkdownDocumentView: View {
  let markdown: String

  private var blocks: [VectorMarkdownBlock] {
    VectorMarkdownParser.parse(markdown)
  }

  var body: some View {
    VStack(alignment: .leading, spacing: 13) {
      ForEach(Array(blocks.enumerated()), id: \.offset) { _, block in
        MarkdownBlockView(block: block)
      }
    }
    .frame(maxWidth: .infinity, alignment: .leading)
  }
}

private struct MarkdownBlockView: View {
  let block: VectorMarkdownBlock

  var body: some View {
    switch block {
    case let .heading(level, text):
      InlineMarkdownText(text: text)
        .font(headingFont(for: level))
        .foregroundStyle(.primary)
        .padding(.top, level <= 2 ? 6 : 2)
    case let .paragraph(text):
      InlineMarkdownText(text: text)
        .font(.body)
        .foregroundStyle(.primary.opacity(0.72))
        .lineSpacing(4)
    case let .unorderedList(items):
      VStack(alignment: .leading, spacing: 7) {
        ForEach(Array(items.enumerated()), id: \.offset) { _, item in
          HStack(alignment: .top, spacing: 8) {
            Circle()
              .fill(Color.secondary)
              .frame(width: 4, height: 4)
              .padding(.top, 9)
            InlineMarkdownText(text: item)
              .font(.body)
              .foregroundStyle(.primary.opacity(0.72))
          }
        }
      }
    case let .orderedList(items):
      VStack(alignment: .leading, spacing: 7) {
        ForEach(Array(items.enumerated()), id: \.offset) { index, item in
          HStack(alignment: .firstTextBaseline, spacing: 8) {
            Text("\(index + 1).")
              .font(.body.monospacedDigit())
              .foregroundStyle(.secondary)
              .frame(width: 24, alignment: .trailing)
            InlineMarkdownText(text: item)
              .font(.body)
              .foregroundStyle(.primary.opacity(0.72))
          }
        }
      }
    case let .codeBlock(code):
      ScrollView(.horizontal, showsIndicators: false) {
        Text(code)
          .font(.system(.footnote, design: .monospaced))
          .foregroundStyle(.primary)
          .padding(10)
          .frame(maxWidth: .infinity, alignment: .leading)
      }
      .background(VectorTheme.groupedBackground, in: RoundedRectangle(cornerRadius: 7, style: .continuous))
    case let .quote(text):
      HStack(alignment: .top, spacing: 10) {
        Rectangle()
          .fill(Color.secondary.opacity(0.28))
          .frame(width: 3)
        InlineMarkdownText(text: text)
          .font(.body)
          .foregroundStyle(.secondary)
          .lineSpacing(4)
      }
    case .horizontalRule:
      Divider()
        .padding(.vertical, 4)
    }
  }

  private func headingFont(for level: Int) -> Font {
    switch level {
    case 1:
      .title2.weight(.semibold)
    case 2:
      .title3.weight(.semibold)
    case 3:
      .headline.weight(.semibold)
    default:
      .subheadline.weight(.semibold)
    }
  }
}

private struct InlineMarkdownText: View {
  let text: String

  var body: some View {
    Text(attributedText)
      .fixedSize(horizontal: false, vertical: true)
  }

  private var attributedText: AttributedString {
    (
      try? AttributedString(
        markdown: text,
        options: AttributedString.MarkdownParsingOptions(interpretedSyntax: .inlineOnlyPreservingWhitespace)
      )
    ) ?? AttributedString(text)
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
      MarkdownDocumentView(markdown: comment.body)
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
  @ObservedObject var pushCoordinator: VectorPushNotificationCoordinator

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
          ProfileStatusSettingsScreen(viewModel: viewModel)
        } label: {
          Label("Profile status", systemImage: "person.crop.circle.badge.checkmark")
        }
        NavigationLink {
          MobilePushNotificationsScreen(viewModel: viewModel, pushCoordinator: pushCoordinator)
        } label: {
          Label("Push notifications", systemImage: "bell.badge")
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
    .onAppear {
      viewModel.loadSettings()
      Task {
        await pushCoordinator.refreshAuthorizationStatus()
      }
    }
  }
}

struct ProfileStatusSettingsScreen: View {
  @ObservedObject var viewModel: VectorMobileViewModel
  @State private var customText = ""
  @State private var customEmoji = ""
  @State private var clearAfter: StatusClearAfter = .never

  var body: some View {
    List {
      Section("Presence") {
        ForEach(VectorPresenceStatus.allCases) { presence in
          Button {
            viewModel.setPresence(presence)
          } label: {
            HStack {
              Label {
                Text(presence.label)
              } icon: {
                Image(systemName: presence.systemImage)
                  .foregroundStyle(Color(vectorHex: presence.colorHex))
              }
              Spacer()
              if viewModel.userStatus?.presence == presence {
                Image(systemName: "checkmark")
                  .font(.caption.weight(.semibold))
                  .foregroundStyle(VectorTheme.accent)
              }
            }
          }
          .buttonStyle(.plain)
        }
      }

      Section("Custom status") {
        HStack {
          Text("Emoji")
          TextField("Optional", text: $customEmoji)
            .multilineTextAlignment(.trailing)
        }
        HStack {
          Text("Status")
          TextField("What's happening?", text: $customText)
            .multilineTextAlignment(.trailing)
        }
        Picker("Clear", selection: $clearAfter) {
          ForEach(StatusClearAfter.allCases) { option in
            Text(option.label).tag(option)
          }
        }

        Button {
          viewModel.setCustomStatus(
            text: customText,
            emoji: customEmoji,
            clearsAt: clearAfter.clearsAt
          )
        } label: {
          Label("Save custom status", systemImage: "checkmark.circle")
        }

        if (viewModel.userStatus?.customText?.isEmpty == false) || (viewModel.userStatus?.customEmoji?.isEmpty == false) {
          Button(role: .destructive) {
            customText = ""
            customEmoji = ""
            clearAfter = .never
            viewModel.clearCustomStatus()
          } label: {
            Label("Clear custom status", systemImage: "xmark.circle")
          }
        }
      }

      if let status = viewModel.userStatus {
        Section("Current") {
          LabeledContent("Presence", value: status.presence.label)
          if let emoji = status.customEmoji, !emoji.isEmpty {
            LabeledContent("Emoji", value: emoji)
          }
          if let text = status.customText, !text.isEmpty {
            LabeledContent("Status", value: text)
          }
        }
      }

      if let error = viewModel.settingsErrorMessage {
        Section {
          Label(error, systemImage: "exclamationmark.triangle")
            .foregroundStyle(.red)
        }
      }
    }
    .navigationTitle("Profile Status")
    .onAppear {
      viewModel.loadSettings()
      syncDraft()
    }
    .onChange(of: viewModel.userStatus) {
      syncDraft()
    }
  }

  private func syncDraft() {
    customText = viewModel.userStatus?.customText ?? ""
    customEmoji = viewModel.userStatus?.customEmoji ?? ""
  }
}

private enum StatusClearAfter: String, CaseIterable, Identifiable {
  case never
  case oneHour
  case today
  case week

  var id: String { rawValue }

  var label: String {
    switch self {
    case .never: "Never"
    case .oneHour: "In 1 hour"
    case .today: "Tonight"
    case .week: "In 1 week"
    }
  }

  var clearsAt: Double? {
    let now = Date()
    let calendar = Calendar.current
    switch self {
    case .never:
      return nil
    case .oneHour:
      return now.addingTimeInterval(60 * 60).timeIntervalSince1970 * 1000
    case .today:
      return (calendar.date(bySettingHour: 23, minute: 59, second: 0, of: now) ?? now).timeIntervalSince1970 * 1000
    case .week:
      return now.addingTimeInterval(7 * 24 * 60 * 60).timeIntervalSince1970 * 1000
    }
  }
}

struct MobilePushNotificationsScreen: View {
  @ObservedObject var viewModel: VectorMobileViewModel
  @ObservedObject var pushCoordinator: VectorPushNotificationCoordinator

  private var currentRegistration: VectorMobilePushTokenRegistration? {
    guard let token = pushCoordinator.deviceToken else { return nil }
    return viewModel.mobilePushTokens.first {
      $0.token == token.value && $0.environment == token.environment && $0.disabledAt == nil
    }
  }

  var body: some View {
    List {
      Section("This iPhone") {
        LabeledContent("Permission", value: pushCoordinator.authorizationStatus.label)
        if let token = pushCoordinator.deviceToken {
          LabeledContent("APNs", value: currentRegistration == nil ? "Ready" : "Registered")
          LabeledContent("Environment", value: token.environment.capitalized)
        }
        if let error = pushCoordinator.registrationError {
          Label(error, systemImage: "exclamationmark.triangle")
            .foregroundStyle(.red)
        }

        Button {
          Task {
            await pushCoordinator.requestRegistration()
            if let token = pushCoordinator.deviceToken {
              viewModel.upsertMobilePushToken(token)
            }
          }
        } label: {
          Label(currentRegistration == nil ? "Enable push on this iPhone" : "Refresh registration", systemImage: "bell.badge")
        }

        if let token = pushCoordinator.deviceToken, currentRegistration != nil {
          Button(role: .destructive) {
            viewModel.removeMobilePushToken(token)
            pushCoordinator.clearRegistration()
          } label: {
            Label("Remove this iPhone", systemImage: "trash")
          }
        }
      }

      Section("Push categories") {
        ForEach(viewModel.notificationPreferences) { preference in
          Toggle(isOn: Binding(
            get: { preference.pushEnabled },
            set: { viewModel.setPushEnabled(for: preference.category, isEnabled: $0) }
          )) {
            Text(preference.category.label)
          }
        }
      }

      Section("Registered devices") {
        if viewModel.mobilePushTokens.filter({ $0.disabledAt == nil }).isEmpty {
          Label("No registered iOS devices", systemImage: "iphone")
            .foregroundStyle(.secondary)
        } else {
          ForEach(viewModel.mobilePushTokens.filter { $0.disabledAt == nil }) { token in
            VStack(alignment: .leading, spacing: 3) {
              Text(token.deviceLabel ?? "iOS device")
                .font(.subheadline.weight(.medium))
              Text(token.environment.capitalized)
                .font(.caption)
                .foregroundStyle(.secondary)
            }
          }
        }
      }

      if let error = viewModel.settingsErrorMessage {
        Section {
          Label(error, systemImage: "exclamationmark.triangle")
            .foregroundStyle(.red)
        }
      }
    }
    .navigationTitle("Push")
    .onAppear {
      viewModel.loadSettings()
      Task {
        await pushCoordinator.refreshAuthorizationStatus()
      }
    }
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
