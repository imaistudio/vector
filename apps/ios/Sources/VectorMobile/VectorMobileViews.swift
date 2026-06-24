import SwiftUI
#if os(iOS)
import UIKit
#endif

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
  @State private var selectedTab: VectorMobileTab = .inbox

  var body: some View {
    TabView(selection: $selectedTab) {
      NavigationStack {
        InboxScreen(viewModel: viewModel, sessionController: sessionController)
      }
      .tabItem {
        Label(VectorMobileTab.inbox.title, systemImage: VectorMobileTab.inbox.systemImage)
      }
      .tag(VectorMobileTab.inbox)

      NavigationStack {
        IssuesScreen(viewModel: viewModel, sessionController: sessionController)
      }
      .tabItem {
        Label(VectorMobileTab.issues.title, systemImage: VectorMobileTab.issues.systemImage)
      }
      .tag(VectorMobileTab.issues)

      NavigationStack {
        WorkspaceScreen(viewModel: viewModel)
      }
      .tabItem {
        Label(VectorMobileTab.workspace.title, systemImage: VectorMobileTab.workspace.systemImage)
      }
      .tag(VectorMobileTab.workspace)

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
  case inbox
  case issues
  case workspace
  case settings

  var id: String { rawValue }

  var title: String {
    switch self {
    case .inbox: "Inbox"
    case .issues: "Issues"
    case .workspace: "Workspace"
    case .settings: "Settings"
    }
  }

  var systemImage: String {
    switch self {
    case .inbox: "bell"
    case .issues: "checklist"
    case .workspace: "square.grid.2x2"
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
  @State private var appURLString = "imai.tech"
  @State private var identifier = ""
  @State private var password = ""

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
      .onAppear {
        if appURLString.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
          appURLString = "imai.tech"
        }
      }
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
        orgSlug: nil
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
  let onSubmit: () -> Void

  var body: some View {
    VStack(spacing: 0) {
      VectorLoginFormRow(title: "Instance", text: $appURLString, prompt: "imai.tech", keyboard: .url)
      VectorLoginSeparator()
      VectorLoginFormRow(title: "Account", text: $identifier, prompt: "you@example.com", keyboard: .email)
      VectorLoginSeparator()
      VectorLoginPasswordRow(text: $password, onSubmit: onSubmit)
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
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .frame(maxWidth: .infinity)
        .contentShape(Rectangle())
      }
    }
    .padding(2)
    .background(Color.secondary.opacity(0.10), in: RoundedRectangle(cornerRadius: 7, style: .continuous))
  }
}

private struct VectorEmptyState: View {
  let title: String
  let systemImage: String
  let message: String

  var body: some View {
    VStack(spacing: 10) {
      Image(systemName: systemImage)
        .font(.system(size: 28, weight: .semibold))
        .foregroundStyle(VectorTheme.accent)
        .frame(width: 48, height: 48)
        .background(VectorTheme.accent.opacity(0.10), in: RoundedRectangle(cornerRadius: 10, style: .continuous))

      VStack(spacing: 4) {
        Text(title)
          .font(.subheadline.weight(.semibold))
          .foregroundStyle(.primary)
        Text(message)
          .font(.caption)
          .foregroundStyle(.secondary)
          .multilineTextAlignment(.center)
          .fixedSize(horizontal: false, vertical: true)
      }
    }
    .padding(.horizontal, 32)
    .frame(maxWidth: .infinity, maxHeight: .infinity)
  }
}

private struct PagingTrigger: View {
  let canLoadMore: Bool
  let isLoading: Bool
  let action: () -> Void

  var body: some View {
    Group {
      if canLoadMore || isLoading {
        HStack {
          if isLoading {
            ProgressView()
              .controlSize(.small)
              .tint(VectorTheme.accent)
          }
        }
        .frame(maxWidth: .infinity)
        .frame(height: 44)
        .onAppear {
          if canLoadMore {
            action()
          }
        }
      }
    }
  }
}

struct InboxScreen: View {
  @ObservedObject var viewModel: VectorMobileViewModel
  @ObservedObject var sessionController: VectorMobileSessionController
  @State private var isShowingProfileStatusSettings = false

  var body: some View {
    ScrollView {
      if viewModel.inboxActivity.isEmpty {
        VectorEmptyState(
          title: "No inbox activity",
          systemImage: "bell",
          message: "Workspace updates, comments, and assignment changes will appear here."
        )
        .frame(minHeight: 420)
      } else {
        LazyVStack(alignment: .leading, spacing: 0) {
          ForEach(Array(viewModel.inboxActivity.enumerated()), id: \.element.id) { index, activity in
            InboxActivityNavigationRow(
              activity: activity,
              isLast: index == viewModel.inboxActivity.count - 1,
              viewModel: viewModel
            )
          }

          PagingTrigger(
            canLoadMore: viewModel.canLoadMoreInboxActivity,
            isLoading: viewModel.isLoadingMoreInboxActivity,
            action: viewModel.loadMoreInboxActivity
          )
        }
        .padding(.horizontal, 16)
        .padding(.top, 12)
        .padding(.bottom, 24)
      }
    }
    .background(VectorTheme.rowBackground)
    .navigationTitle("Inbox")
    .vectorInlineNavigationTitle()
    .navigationDestination(isPresented: $isShowingProfileStatusSettings) {
      ProfileStatusSettingsScreen(viewModel: viewModel)
    }
    .toolbar {
      #if os(iOS)
      ToolbarItem(placement: .topBarLeading) {
        WorkspaceToolbarMenu(
          sessionController: sessionController,
          currentOrgSlug: viewModel.configuration.orgSlug,
          webBaseURL: viewModel.configuration.webBaseURL,
          issuesURL: viewModel.configuration.workspaceWebURL,
          webLabel: "Open workspace on web"
        )
      }
      ToolbarItem(placement: .topBarTrailing) {
        ProfileStatusToolbarMenu(
          viewModel: viewModel,
          sessionController: sessionController,
          onOpenProfileStatusSettings: {
            isShowingProfileStatusSettings = true
          }
        )
      }
      #else
      ToolbarItem(placement: .automatic) {
        WorkspaceToolbarMenu(
          sessionController: sessionController,
          currentOrgSlug: viewModel.configuration.orgSlug,
          webBaseURL: viewModel.configuration.webBaseURL,
          issuesURL: viewModel.configuration.workspaceWebURL,
          webLabel: "Open workspace on web"
        )
      }
      ToolbarItem(placement: .primaryAction) {
        ProfileStatusToolbarMenu(
          viewModel: viewModel,
          sessionController: sessionController,
          onOpenProfileStatusSettings: {
            isShowingProfileStatusSettings = true
          }
        )
      }
      #endif
    }
  }
}

private struct InboxActivityNavigationRow: View {
  let activity: VectorActivityItem
  let isLast: Bool
  @ObservedObject var viewModel: VectorMobileViewModel

  private var matchingIssue: VectorIssueRow? {
    guard activity.target.type == "issue" else { return nil }
    return viewModel.issues.first { issue in
      issue.id == activity.target.id || issue.key == activity.target.key
    }
  }

  var body: some View {
    Group {
      if let matchingIssue {
        NavigationLink {
          IssueDetailScreen(issue: matchingIssue, viewModel: viewModel)
        } label: {
          InboxActivityRow(activity: activity, isLast: isLast)
        }
      } else {
        Link(destination: webURL) {
          InboxActivityRow(activity: activity, isLast: isLast)
        }
      }
    }
    .buttonStyle(.plain)
  }

  private var webURL: URL {
    switch activity.target.type {
    case "issue":
      if let key = activity.target.key {
        return viewModel.configuration.webURL(path: "/\(viewModel.configuration.orgSlug)/issues/\(key)")
      }
    case "project":
      if let key = activity.target.key {
        return viewModel.configuration.webURL(path: "/\(viewModel.configuration.orgSlug)/projects/\(key)")
      }
    case "team":
      if let key = activity.target.key {
        return viewModel.configuration.webURL(path: "/\(viewModel.configuration.orgSlug)/teams/\(key)")
      }
    default:
      break
    }
    return viewModel.configuration.workspaceWebURL
  }
}

private struct InboxActivityRow: View {
  let activity: VectorActivityItem
  let isLast: Bool

  var body: some View {
    HStack(alignment: .top, spacing: 10) {
      ZStack(alignment: .top) {
        if !isLast {
          Rectangle()
            .fill(VectorTheme.border.opacity(0.35))
            .frame(width: 1)
            .offset(y: 24)
        }
        Image(systemName: systemImage)
          .font(.caption2.weight(.semibold))
          .symbolRenderingMode(.monochrome)
          .foregroundStyle(iconColor)
          .frame(width: 20, height: 20)
          .background(VectorTheme.rowBackground, in: Circle())
          .overlay(Circle().stroke(VectorTheme.border.opacity(0.55), lineWidth: 0.8))
      }
      .frame(width: 28, alignment: .top)
      .frame(minHeight: 48, alignment: .top)

      VStack(alignment: .leading, spacing: 4) {
        HStack(alignment: .firstTextBaseline, spacing: 4) {
          activityText
            .font(.subheadline)
            .foregroundStyle(.primary)
            .fixedSize(horizontal: false, vertical: true)
          Spacer(minLength: 10)
          Text(relativeTimestamp(activity.createdAt))
            .font(.caption)
            .foregroundStyle(.secondary)
            .lineLimit(1)
        }

        if let targetLabel {
          Text(targetLabel)
            .font(.caption)
            .foregroundStyle(.secondary)
            .lineLimit(1)
        }

        if let preview = activity.details.commentPreview, !preview.isEmpty {
          Text(preview)
            .font(.caption)
            .foregroundStyle(.secondary)
            .lineLimit(2)
        }
      }
      .padding(.bottom, isLast ? 0 : 14)
    }
    .frame(maxWidth: .infinity, alignment: .leading)
  }

  private var actorName: String {
    activity.actor?.displayName ?? "Someone"
  }

  private var targetLabel: String? {
    let name = activity.target.name ?? activity.target.key
    guard let name else { return nil }
    if let key = activity.target.key, key != name {
      return "\(key) · \(name)"
    }
    return name
  }

  private var activityText: Text {
    Text(actorName).fontWeight(.semibold) + Text(" \(description)")
  }

  private var description: String {
    switch activity.eventType {
    case "issue_created":
      "created an issue"
    case "issue_title_changed":
      "updated an issue title"
    case "issue_description_changed":
      "updated a description"
    case "issue_workflow_state_changed":
      "changed a status"
    case "issue_priority_changed":
      "changed a priority"
    case "issue_assignees_changed":
      assignmentDescription
    case "issue_project_changed":
      "changed an issue project"
    case "issue_team_changed":
      "changed an issue team"
    case "issue_comment_added":
      "commented"
    default:
      "updated \(activity.target.type)"
    }
  }

  private var assignmentDescription: String {
    if !activity.details.addedUserNames.isEmpty {
      return "assigned \(activity.details.addedUserNames.joined(separator: ", "))"
    }
    if !activity.details.removedUserNames.isEmpty {
      return "unassigned \(activity.details.removedUserNames.joined(separator: ", "))"
    }
    return "changed assignees"
  }

  private var systemImage: String {
    switch activity.eventType {
    case "issue_created":
      "plus"
    case "issue_comment_added":
      "text.bubble"
    case "issue_assignees_changed":
      "person.2"
    case "issue_workflow_state_changed", "issue_assignment_state_changed":
      "circle.circle"
    case "issue_title_changed", "issue_description_changed":
      "textformat"
    case "issue_priority_changed":
      "arrow.left.arrow.right"
    case "issue_project_changed", "issue_project_added", "issue_project_removed":
      "folder"
    case "issue_team_changed", "issue_team_added", "issue_team_removed":
      "person.2"
    case "issue_visibility_changed":
      "eye"
    case "issue_live_activity_started",
      "issue_live_activity_delegated",
      "issue_live_activity_completed",
      "issue_live_activity_status_changed":
      "terminal"
    default:
      "doc.text"
    }
  }

  private var iconColor: Color {
    switch activity.eventType {
    case "issue_created", "issue_sub_issue_created":
      Color(vectorHex: "#8b5cf6")
    case "issue_workflow_state_changed",
      "issue_assignment_state_changed",
      "issue_live_activity_started",
      "issue_live_activity_delegated":
      Color(vectorHex: "#22c55e")
    case "issue_priority_changed":
      Color(vectorHex: "#f97316")
    case "issue_assignees_changed", "issue_comment_added":
      Color(vectorHex: "#3b82f6")
    default:
      Color.secondary
    }
  }
}

struct IssuesScreen: View {
  @ObservedObject var viewModel: VectorMobileViewModel
  @ObservedObject var sessionController: VectorMobileSessionController
  @State private var searchText = ""
  @State private var isSearchPresented = false
  @FocusState private var isSearchFocused: Bool

  private var filteredIssues: [VectorIssueRow] {
    guard isSearchActive else {
      return viewModel.issues
    }
    return viewModel.issues.filter {
      $0.key.localizedCaseInsensitiveContains(searchText)
        || $0.title.localizedCaseInsensitiveContains(searchText)
    }
  }

  private var isSearchActive: Bool {
    !searchText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
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
        WorkspaceToolbarMenu(
          sessionController: sessionController,
          currentOrgSlug: viewModel.configuration.orgSlug,
          webBaseURL: viewModel.configuration.webBaseURL,
          issuesURL: viewModel.configuration.webURL(path: "/\(viewModel.configuration.orgSlug)/issues")
        )
      }
      #else
      ToolbarItem(placement: .automatic) {
        WorkspaceToolbarMenu(
          sessionController: sessionController,
          currentOrgSlug: viewModel.configuration.orgSlug,
          webBaseURL: viewModel.configuration.webBaseURL,
          issuesURL: viewModel.configuration.webURL(path: "/\(viewModel.configuration.orgSlug)/issues")
        )
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
    } else if filteredIssues.isEmpty {
      VectorEmptyState(
        title: searchText.isEmpty ? "No issues" : "No matching issues",
        systemImage: "checklist",
        message: searchText.isEmpty ? "Issues assigned or visible to you will appear here." : "Try a different issue key or title."
      )
    } else {
      switch viewModel.issueLayoutMode {
      case .list:
        IssueList(issues: filteredIssues, viewModel: viewModel, allowsPaging: !isSearchActive)
      case .board:
        IssueBoard(issues: filteredIssues, viewModel: viewModel, allowsPaging: !isSearchActive)
      case .timeline:
        IssueTimeline(issues: filteredIssues, viewModel: viewModel, allowsPaging: !isSearchActive)
      }
    }
  }
}

private struct WorkspaceToolbarMenu: View {
  @ObservedObject var sessionController: VectorMobileSessionController
  let currentOrgSlug: String
  let webBaseURL: URL
  let issuesURL: URL
  var webLabel = "Open issues on web"

  private var currentWorkspace: VectorOrganization? {
    sessionController.organizations.first { $0.slug == currentOrgSlug }
  }

  private var currentWorkspaceName: String {
    currentWorkspace?.name ?? currentOrgSlug
  }

  var body: some View {
    Menu {
      WorkspaceMenuContent(
        sessionController: sessionController,
        currentOrgSlug: currentOrgSlug,
        webURL: issuesURL,
        webLabel: webLabel
      )
    } label: {
      WorkspaceAvatarIcon(
        name: currentWorkspaceName,
        logoURL: currentWorkspace?.logoURL(baseURL: webBaseURL),
        size: 28
      )
    }
    .accessibilityLabel("Workspace menu")
  }
}

private struct WorkspaceAvatarIcon: View {
  let name: String
  let logoURL: URL?
  var size: CGFloat = 26

  private var initial: String {
    name.trimmingCharacters(in: .whitespacesAndNewlines).first.map { String($0).uppercased() } ?? "V"
  }

  var body: some View {
    ZStack {
      Circle()
        .fill(VectorTheme.accent.opacity(0.14))
        .overlay(
          Circle()
            .stroke(VectorTheme.accent.opacity(0.28), lineWidth: 0.8)
        )

      if let logoURL {
        AsyncImage(url: logoURL) { phase in
          switch phase {
          case let .success(image):
            image
              .resizable()
              .scaledToFill()
          default:
            Text(initial)
              .font(.system(size: max(11, size * 0.44), weight: .semibold))
              .foregroundStyle(VectorTheme.accent)
          }
        }
      } else {
        Text(initial)
          .font(.system(size: max(11, size * 0.44), weight: .semibold))
          .foregroundStyle(VectorTheme.accent)
      }
    }
    .frame(width: size, height: size)
    .clipShape(Circle())
  }
}

private struct WorkspaceMenuContent: View {
  @ObservedObject var sessionController: VectorMobileSessionController
  let currentOrgSlug: String
  let webURL: URL
  let webLabel: String

  var body: some View {
    if !sessionController.organizations.isEmpty {
      Section("Workspaces") {
        ForEach(sessionController.organizations) { organization in
          Button {
            sessionController.switchWorkspace(to: organization)
          } label: {
            Label(
              organization.name,
              systemImage: organization.slug == currentOrgSlug ? "checkmark" : "building.2"
            )
          }
          .disabled(organization.slug == currentOrgSlug || sessionController.isDemoMode)
        }
      }
    }

    Section {
      Link(destination: webURL) {
        Label(webLabel, systemImage: "safari")
      }
    }
  }
}

private struct ProfileStatusToolbarMenu: View {
  @ObservedObject var viewModel: VectorMobileViewModel
  @ObservedObject var sessionController: VectorMobileSessionController
  let onOpenProfileStatusSettings: () -> Void

  private var toolbarUser: VectorUser {
    let user = sessionController.user
    return VectorUser(
      id: user?.id ?? user?.email ?? "current-user",
      name: user?.displayName,
      email: user?.email,
      status: viewModel.userStatus
    )
  }

  var body: some View {
    Menu {
      if let user = sessionController.user {
        Section(user.displayName) {
          if let email = user.email {
            Text(email)
          }
        }
      }

      Section("Presence") {
        ForEach(VectorPresenceStatus.selectableCases) { presence in
          Button {
            viewModel.setPresence(presence)
          } label: {
            Label(
              presence.label,
              systemImage: viewModel.userStatus?.presence == presence ? "checkmark.circle.fill" : presence.systemImage
            )
          }
        }
      }

      Section {
        Button(action: onOpenProfileStatusSettings) {
          Label("Profile status", systemImage: "person.crop.circle.badge.checkmark")
        }
      }
    } label: {
      VectorUserAvatar(user: toolbarUser, baseURL: viewModel.configuration.webBaseURL, size: 28)
    }
    .accessibilityLabel("Profile and status")
    .onAppear {
      viewModel.loadSettings()
    }
  }
}

private struct WorkspaceSettingsRow: View {
  @ObservedObject var sessionController: VectorMobileSessionController
  let currentOrgSlug: String

  private var currentWorkspaceLabel: String {
    sessionController.organizations.first { $0.slug == currentOrgSlug }?.name ?? currentOrgSlug
  }

  var body: some View {
    Menu {
      if !sessionController.organizations.isEmpty {
        ForEach(sessionController.organizations) { organization in
          Button {
            sessionController.switchWorkspace(to: organization)
          } label: {
            Label(
              organization.name,
              systemImage: organization.slug == currentOrgSlug ? "checkmark" : "building.2"
            )
          }
          .disabled(organization.slug == currentOrgSlug || sessionController.isDemoMode)
        }
      }
    } label: {
      HStack {
        Text("Workspace")
        Spacer()
        Text(currentWorkspaceLabel)
          .foregroundStyle(.secondary)
          .lineLimit(1)
        Image(systemName: "chevron.up.chevron.down")
          .font(.caption2.weight(.bold))
          .foregroundStyle(.secondary)
      }
    }
    .disabled(sessionController.organizations.count <= 1 || sessionController.isDemoMode)
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
      .contentShape(RoundedRectangle(cornerRadius: 7, style: .continuous))
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
  let allowsPaging: Bool

  var body: some View {
    ScrollView {
      LazyVStack(spacing: 0) {
        ForEach(issues, id: \.rowId) { issue in
          NavigationLink {
            IssueDetailScreen(issue: issue, viewModel: viewModel)
          } label: {
            IssueRowView(
              issue: issue,
              workspaceOptions: viewModel.workspaceOptions,
              baseURL: viewModel.configuration.webBaseURL
            )
              .padding(.horizontal, 12)
              .padding(.vertical, 8)
              .contentShape(Rectangle())
          }
          .buttonStyle(.plain)

          Divider()
            .padding(.leading, 12)
        }

        PagingTrigger(
          canLoadMore: allowsPaging && viewModel.canLoadMoreIssues,
          isLoading: allowsPaging && viewModel.isLoadingMoreIssues,
          action: viewModel.loadMoreIssues
        )
      }
    }
    .background(VectorTheme.rowBackground)
  }
}

struct IssueBoard: View {
  let issues: [VectorIssueRow]
  @ObservedObject var viewModel: VectorMobileViewModel
  let allowsPaging: Bool

  private var groups: [(name: String, position: Double, status: VectorIssueMetadataValue, rows: [VectorIssueRow])] {
    let options = viewModel.workspaceOptions

    return Dictionary(grouping: issues) { issue in
      VectorIssueMetadataResolver.state(for: issue, options: options).name
    }
    .map { name, rows in
      let status = rows.first.map {
        VectorIssueMetadataResolver.state(for: $0, options: options)
      } ?? VectorIssueMetadataValue(id: nil, name: name, icon: nil, color: nil)
      let position = rows
        .compactMap { issue in
          guard let stateId = issue.workflowStateId else {
            return nil
          }

          return options?.issueStates.first { $0.id == stateId }?.position
        }
        .min() ?? Double.greatestFiniteMagnitude

      return (
        name: name,
        position: position,
        status: status,
        rows: rows.sorted { $0.updatedAt > $1.updatedAt }
      )
    }
    .sorted {
      if $0.position == $1.position {
        return $0.name < $1.name
      }

      return $0.position < $1.position
    }
  }

  var body: some View {
    ScrollView {
      ScrollView(.horizontal) {
        LazyHStack(alignment: .top, spacing: 10) {
          ForEach(groups, id: \.name) { group in
            VStack(alignment: .leading, spacing: 8) {
              HStack(spacing: 6) {
                Image(systemName: vectorSystemImage(for: group.status.icon))
                  .font(.caption.weight(.semibold))
                  .foregroundStyle(Color(vectorHex: group.status.color))
                Text(group.name)
                  .font(.subheadline.weight(.semibold))
                Text("\(group.rows.count)")
                  .font(.caption)
                  .foregroundStyle(.secondary)
              }

              ForEach(group.rows, id: \.rowId) { issue in
                NavigationLink {
                  IssueDetailScreen(issue: issue, viewModel: viewModel)
                } label: {
                  IssueBoardCard(
                    issue: issue,
                    workspaceOptions: viewModel.workspaceOptions,
                    baseURL: viewModel.configuration.webBaseURL
                  )
                }
                .buttonStyle(.plain)
              }
            }
            .padding(10)
            .frame(width: 282, alignment: .topLeading)
            .background(VectorTheme.groupedBackground, in: RoundedRectangle(cornerRadius: 8, style: .continuous))
            .vectorShadowRing(cornerRadius: 8)
          }
        }
        .padding(12)
      }

      PagingTrigger(
        canLoadMore: allowsPaging && viewModel.canLoadMoreIssues,
        isLoading: allowsPaging && viewModel.isLoadingMoreIssues,
        action: viewModel.loadMoreIssues
      )
    }
  }
}

struct IssueTimeline: View {
  let issues: [VectorIssueRow]
  @ObservedObject var viewModel: VectorMobileViewModel
  let allowsPaging: Bool

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
              TimelineIssueRow(
                issue: issue,
                workspaceOptions: viewModel.workspaceOptions,
                baseURL: viewModel.configuration.webBaseURL
              )
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)

            Divider()
              .padding(.leading, 12)
          }
        }

        PagingTrigger(
          canLoadMore: allowsPaging && viewModel.canLoadMoreIssues,
          isLoading: allowsPaging && viewModel.isLoadingMoreIssues,
          action: viewModel.loadMoreIssues
        )
      }
    }
    .background(VectorTheme.rowBackground)
  }
}

struct IssueRowView: View {
  let issue: VectorIssueRow
  let workspaceOptions: VectorWorkspaceOptions?
  let baseURL: URL

  private var status: VectorIssueMetadataValue {
    VectorIssueMetadataResolver.state(for: issue, options: workspaceOptions)
  }

  private var priority: VectorIssueMetadataValue? {
    VectorIssueMetadataResolver.priority(for: issue, options: workspaceOptions)
  }

  var body: some View {
    HStack(alignment: .center, spacing: 10) {
      Text(issue.title)
        .font(.subheadline.weight(.medium))
        .foregroundStyle(.primary)
        .lineLimit(1)
        .truncationMode(.tail)
      .frame(minWidth: 0, maxWidth: .infinity, alignment: .leading)

      HStack(spacing: 5) {
        IssueMetadataIcon(value: status, fallbackSystemImage: "circle")

        if let priority {
          IssueMetadataIcon(value: priority, fallbackSystemImage: "minus")
        }

        IssueRowAssigneeAvatar(issue: issue, workspaceOptions: workspaceOptions, baseURL: baseURL)
      }
      .layoutPriority(1)
    }
    .frame(maxWidth: .infinity, alignment: .leading)
  }
}

private struct IssueMetadataIcon: View {
  let value: VectorIssueMetadataValue
  let fallbackSystemImage: String
  var size: CGFloat = 24

  private var color: Color {
    Color(vectorHex: value.color)
  }

  var body: some View {
    let mappedSystemImage = vectorSystemImage(for: value.icon)
    let systemImage = mappedSystemImage == "circle.dotted" ? fallbackSystemImage : mappedSystemImage

    Image(systemName: systemImage)
      .font(.caption.weight(.semibold))
      .foregroundStyle(color)
      .frame(width: size, height: size)
      .background(color.opacity(0.12), in: Circle())
      .overlay(Circle().stroke(color.opacity(0.28), lineWidth: 0.7))
      .accessibilityLabel(value.name)
  }
}

private struct IssueRowAssigneeAvatar: View {
  let issue: VectorIssueRow
  let workspaceOptions: VectorWorkspaceOptions?
  let baseURL: URL

  private var user: VectorUser? {
    guard issue.assigneeId != nil || issue.assigneeName != nil || issue.assigneeEmail != nil || issue.assigneeImage != nil else {
      return nil
    }

    return VectorUser(
      id: issue.assigneeId ?? issue.assigneeEmail ?? issue.assigneeName ?? "assignee",
      name: issue.assigneeName,
      email: issue.assigneeEmail,
      image: issue.assigneeImage,
      status: workspaceOptions?.memberStatus(userId: issue.assigneeId, email: issue.assigneeEmail)
    )
  }

  var body: some View {
    Group {
      if let user {
        VectorUserAvatar(user: user, baseURL: baseURL, size: 24)
      } else {
        Image(systemName: "person.crop.circle")
          .font(.caption.weight(.semibold))
          .foregroundStyle(.secondary)
          .frame(width: 24, height: 24)
          .background(Color.secondary.opacity(0.10), in: Circle())
          .overlay(Circle().stroke(VectorTheme.border.opacity(0.25), lineWidth: 0.5))
      }
    }
    .accessibilityLabel("Assignee: \(issue.assigneeLabel)")
  }
}

struct IssueBoardCard: View {
  let issue: VectorIssueRow
  let workspaceOptions: VectorWorkspaceOptions?
  let baseURL: URL

  private var status: VectorIssueMetadataValue {
    VectorIssueMetadataResolver.state(for: issue, options: workspaceOptions)
  }

  private var priority: VectorIssueMetadataValue? {
    VectorIssueMetadataResolver.priority(for: issue, options: workspaceOptions)
  }

  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      Text(issue.title)
        .font(.subheadline.weight(.medium))
        .foregroundStyle(.primary)
        .lineLimit(2)

      HStack {
        IssueMetadataIcon(value: status, fallbackSystemImage: "circle", size: 22)
        if let priority {
          IssueMetadataIcon(value: priority, fallbackSystemImage: "minus", size: 22)
        }
        IssueRowAssigneeAvatar(issue: issue, workspaceOptions: workspaceOptions, baseURL: baseURL)
        Spacer()
        if !issue.linkedPrs.isEmpty {
          Image(systemName: "point.3.connected.trianglepath.dotted")
            .font(.caption)
            .foregroundStyle(VectorTheme.accent)
        }
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
        .stroke(VectorTheme.border.opacity(0.28), lineWidth: 0.7)
    )
  }
}

struct TimelineIssueRow: View {
  let issue: VectorIssueRow
  let workspaceOptions: VectorWorkspaceOptions?
  let baseURL: URL

  private var status: VectorIssueMetadataValue {
    VectorIssueMetadataResolver.state(for: issue, options: workspaceOptions)
  }

  private var priority: VectorIssueMetadataValue? {
    VectorIssueMetadataResolver.priority(for: issue, options: workspaceOptions)
  }

  var body: some View {
    HStack(alignment: .center, spacing: 10) {
      IssueMetadataIcon(value: status, fallbackSystemImage: "circle", size: 22)

      VStack(alignment: .leading, spacing: 4) {
        Text(issue.title)
          .font(.subheadline.weight(.medium))
          .lineLimit(1)
        Text("Updated \(relativeTimestamp(issue.updatedAt))")
          .font(.caption)
          .foregroundStyle(.secondary)
          .lineLimit(1)
      }
      .frame(minWidth: 0, maxWidth: .infinity, alignment: .leading)

      HStack(spacing: 5) {
        if let priority {
          IssueMetadataIcon(value: priority, fallbackSystemImage: "minus", size: 22)
        }
        IssueRowAssigneeAvatar(issue: issue, workspaceOptions: workspaceOptions, baseURL: baseURL)
      }
    }
    .padding(.vertical, 4)
  }
}

struct IssueDetailScreen: View {
  let issue: VectorIssueRow
  @ObservedObject var viewModel: VectorMobileViewModel
  @State private var draftTitle = ""
  @State private var draftDescription = ""
  @State private var isEditingDescription = false
  @State private var isSavingDocument = false
  @State private var isPostingComment = false
  @State private var commentDraft = ""
  @State private var activeReplyParentId: VectorID?
  @State private var postingReplyParentId: VectorID?
  @State private var replyDrafts: [VectorID: String] = [:]
  @State private var pendingProperty: IssueDetailProperty?
  @State private var issueErrorMessage: String?
  @FocusState private var focusedField: IssueDetailFocusField?

  private var displayIssue: VectorIssueRow {
    if let selectedIssue = viewModel.selectedIssue, selectedIssue.id == issue.id {
      return selectedIssue
    }
    return viewModel.issues.first { $0.id == issue.id } ?? issue
  }

  private var canEditIssue: Bool {
    displayIssue.canEdit ?? false
  }

  private var selectedAssigneeIds: Set<VectorID> {
    let assignmentIds = viewModel.assignments.compactMap(\.assigneeId)
    if !assignmentIds.isEmpty {
      return Set(assignmentIds)
    }
    if let assigneeId = displayIssue.assigneeId {
      return [assigneeId]
    }
    return []
  }

  private var hasDocumentChanges: Bool {
    draftTitle.trimmingCharacters(in: .whitespacesAndNewlines) != displayIssue.title
      || draftDescription != (displayIssue.description ?? "")
  }

  private var timelineEntries: [IssueTimelineEntry] {
    let commentEntries = viewModel.comments
      .filter { $0.parentId == nil }
      .map(IssueTimelineEntry.comment)
    let activityEntries = viewModel.issueActivity
      .filter { $0.eventType != "issue_comment_added" }
      .map(IssueTimelineEntry.activity)

    return (commentEntries + activityEntries).sorted { $0.createdAt < $1.createdAt }
  }

  private var repliesByParent: [VectorID: [VectorComment]] {
    Dictionary(grouping: viewModel.comments.filter { $0.parentId != nil }) { comment in
      comment.parentId ?? ""
    }
    .mapValues { replies in
      replies.sorted { $0.creationTime < $1.creationTime }
    }
  }

  var body: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: 18) {
        VStack(alignment: .leading, spacing: 10) {
          Text(displayIssue.key)
            .font(.caption.monospaced())
            .foregroundStyle(.secondary)

          if canEditIssue {
            TextField("Issue title", text: $draftTitle, axis: .vertical)
              .font(.system(size: 28, weight: .semibold))
              .textFieldStyle(.plain)
              .focused($focusedField, equals: .title)
              .submitLabel(.done)
              .onSubmit(saveDocumentChanges)
          } else {
            Text(displayIssue.title)
              .font(.system(size: 28, weight: .semibold))
              .foregroundStyle(.primary)
              .fixedSize(horizontal: false, vertical: true)
          }

          IssuePropertyBar(
            issue: displayIssue,
            options: viewModel.workspaceOptions,
            selectedAssigneeIds: selectedAssigneeIds,
            pendingProperty: pendingProperty,
            isEditable: canEditIssue,
            onStateSelect: { state in
              runPropertyUpdate(.status) {
                try await viewModel.changeIssueWorkflowState(issueId: displayIssue.id, state: state)
              }
            },
            onPrioritySelect: { priority in
              runPropertyUpdate(.priority) {
                try await viewModel.changeIssuePriority(issueId: displayIssue.id, priority: priority)
              }
            },
            onAssigneesSelect: { assigneeIds in
              runPropertyUpdate(.assignees) {
                try await viewModel.updateIssueAssignees(issueId: displayIssue.id, assigneeIds: assigneeIds)
              }
            },
            onProjectSelect: { project in
              runPropertyUpdate(.project) {
                try await viewModel.changeIssueProject(issueId: displayIssue.id, project: project)
              }
            },
            onTeamSelect: { team in
              runPropertyUpdate(.team) {
                try await viewModel.changeIssueTeam(issueId: displayIssue.id, team: team)
              }
            },
            onVisibilitySelect: { visibility in
              runPropertyUpdate(.visibility) {
                try await viewModel.changeIssueVisibility(issueId: displayIssue.id, visibility: visibility.rawValue)
              }
            }
          )
          .padding(.horizontal, -22)
        }

        DocumentSection(title: "Description") {
          if !canEditIssue {
            if draftDescription.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
              Text("No description")
                .font(.body)
                .foregroundStyle(.secondary)
            } else {
              MarkdownDocumentView(markdown: draftDescription)
            }
          } else if isEditingDescription || draftDescription.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            ZStack(alignment: .topLeading) {
              if draftDescription.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                Text("Add description")
                  .font(.body)
                  .foregroundStyle(.secondary)
                  .padding(.horizontal, 4)
                  .padding(.vertical, 8)
              }

              TextEditor(text: $draftDescription)
                .font(.body)
                .lineSpacing(4)
                .frame(minHeight: 220)
                .scrollContentBackground(.hidden)
                .focused($focusedField, equals: .description)
            }
            .background(Color.clear)
          } else {
            Button {
              withAnimation(.snappy(duration: 0.18)) {
                isEditingDescription = true
                focusedField = .description
              }
            } label: {
              MarkdownDocumentView(markdown: draftDescription)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
          }

          HStack(spacing: 10) {
            if canEditIssue && !isEditingDescription && !draftDescription.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
              Button("Edit description") {
                withAnimation(.snappy(duration: 0.18)) {
                  isEditingDescription = true
                  focusedField = .description
                }
              }
              .font(.caption.weight(.semibold))
              .buttonStyle(.plain)
              .foregroundStyle(VectorTheme.accent)
            }

            Spacer()

            if canEditIssue && (isEditingDescription || hasDocumentChanges) {
              Button(action: saveDocumentChanges) {
                HStack(spacing: 6) {
                  if isSavingDocument {
                    ProgressView()
                      .controlSize(.small)
                  }
                  Text(hasDocumentChanges ? "Save changes" : "Done")
                }
                .font(.caption.weight(.semibold))
                .padding(.horizontal, 10)
                .frame(height: 30)
                .background(VectorTheme.accent.opacity(hasDocumentChanges ? 0.15 : 0.08), in: Capsule())
              }
              .buttonStyle(.plain)
              .disabled(isSavingDocument)
            }
          }
        }

        DocumentSection(title: "Activity") {
          if timelineEntries.isEmpty {
            VectorEmptyState(
              title: "No activity",
              systemImage: "rays",
              message: "Comments and issue updates will appear here."
            )
            .frame(minHeight: 180)
          } else {
            VStack(alignment: .leading, spacing: 0) {
              ForEach(Array(timelineEntries.enumerated()), id: \.element.id) { index, entry in
                if index > 0 {
                  let spacing = timelineSpacing(before: index)
                  if spacing > 0 {
                    Color.clear.frame(height: spacing)
                  }
                }

                switch entry {
                case let .comment(comment):
                  IssueCommentCard(
                    comment: comment,
                    replies: repliesByParent[comment.id] ?? [],
                    baseURL: viewModel.configuration.webBaseURL,
                    replyDraft: Binding(
                      get: { replyDrafts[comment.id, default: ""] },
                      set: { replyDrafts[comment.id] = $0 }
                    ),
                    isReplying: activeReplyParentId == comment.id,
                    isPostingReply: postingReplyParentId == comment.id,
                    focusedField: $focusedField,
                    onReplyTap: {
                      withAnimation(.snappy(duration: 0.18)) {
                        activeReplyParentId = comment.id
                        focusedField = .replyComment(comment.id)
                      }
                    },
                    onCancelReply: {
                      withAnimation(.snappy(duration: 0.18)) {
                        activeReplyParentId = nil
                        replyDrafts[comment.id] = ""
                      }
                    },
                    onSubmitReply: {
                      postReply(parentId: comment.id)
                    }
                  )
                case let .activity(activity):
                  IssueActivityTimelineRow(
                    activity: activity,
                    isLast: index == timelineEntries.count - 1
                  )
                }
              }
            }
          }

          IssueCommentComposer(
            text: $commentDraft,
            isPosting: isPostingComment,
            placeholder: "Leave a comment... Use @ to mention",
            focusTarget: .mainComment,
            focusedField: $focusedField,
            onSubmit: postComment
          )
          .onChange(of: focusedField) { _, focusedField in
            if focusedField == .mainComment {
              activeReplyParentId = nil
            }
          }
        }

        if let issueErrorMessage {
          Label(issueErrorMessage, systemImage: "exclamationmark.triangle")
            .font(.caption)
            .foregroundStyle(.red)
            .fixedSize(horizontal: false, vertical: true)
        }
      }
      .padding(.horizontal, 22)
      .padding(.top, 22)
      .padding(.bottom, 148)
      .frame(maxWidth: .infinity, alignment: .leading)
    }
    .background(VectorTheme.rowBackground)
    .navigationTitle(displayIssue.key)
    .vectorInlineNavigationTitle()
    .toolbar {
      ToolbarItem(placement: .primaryAction) {
        Link(destination: viewModel.openWebURL(for: displayIssue)) {
          Image(systemName: "safari")
        }
        .accessibilityLabel("Open full issue on web")
      }
      #if os(iOS)
      ToolbarItemGroup(placement: .keyboard) {
        if focusedField?.showsMarkdownToolbar == true {
          MarkdownFormattingKeyboardToolbar(
            onAction: { action in
              applyMarkdownFormatting(action)
            },
            onDismiss: {
              focusedField = nil
            }
          )
        }
      }
      #endif
    }
    .onAppear {
      syncDraft(from: displayIssue)
      viewModel.loadIssueSupport(issue: displayIssue)
    }
    .onChange(of: displayIssue) { _, nextIssue in
      guard !hasDocumentChanges && !isEditingDescription else {
        return
      }
      syncDraft(from: nextIssue)
    }
    #if os(iOS)
    .onReceive(NotificationCenter.default.publisher(for: UIResponder.keyboardWillHideNotification)) { _ in
      if focusedField?.showsMarkdownToolbar == true {
        focusedField = nil
      }
    }
    #endif
  }

  private func syncDraft(from issue: VectorIssueRow) {
    draftTitle = issue.title
    draftDescription = issue.description ?? ""
  }

  private func timelineSpacing(before index: Int) -> CGFloat {
    guard index > 0 else {
      return 0
    }

    if timelineEntries[index - 1].isComment && timelineEntries[index].isComment {
      return 0
    }

    return 12
  }

  private func saveDocumentChanges() {
    guard canEditIssue else {
      issueErrorMessage = "You do not have permission to edit this issue."
      return
    }

    guard !isSavingDocument else {
      return
    }

    let title = draftTitle.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !title.isEmpty else {
      issueErrorMessage = "Title is required."
      return
    }

    isSavingDocument = true
    issueErrorMessage = nil
    Task { @MainActor in
      do {
        if title != displayIssue.title {
          try await viewModel.updateIssueTitle(issueId: displayIssue.id, title: title)
          draftTitle = title
        }
        if draftDescription != (displayIssue.description ?? "") {
          try await viewModel.updateIssueDescription(issueId: displayIssue.id, description: draftDescription)
        }
        isEditingDescription = false
        focusedField = nil
      } catch {
        issueErrorMessage = error.localizedDescription
      }
      isSavingDocument = false
    }
  }

  private func postComment() {
    guard !isPostingComment else {
      return
    }

    let body = commentDraft.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !body.isEmpty else {
      return
    }

    isPostingComment = true
    issueErrorMessage = nil
    Task { @MainActor in
      do {
        try await viewModel.addIssueComment(issueId: displayIssue.id, body: body)
        commentDraft = ""
        activeReplyParentId = nil
        focusedField = nil
      } catch {
        issueErrorMessage = error.localizedDescription
      }
      isPostingComment = false
    }
  }

  private func postReply(parentId: VectorID) {
    guard postingReplyParentId == nil else {
      return
    }

    let body = replyDrafts[parentId, default: ""].trimmingCharacters(in: .whitespacesAndNewlines)
    guard !body.isEmpty else {
      return
    }

    postingReplyParentId = parentId
    issueErrorMessage = nil
    Task { @MainActor in
      do {
        try await viewModel.addIssueComment(issueId: displayIssue.id, body: body, parentId: parentId)
        replyDrafts[parentId] = ""
        activeReplyParentId = nil
        focusedField = nil
      } catch {
        issueErrorMessage = error.localizedDescription
      }
      postingReplyParentId = nil
    }
  }

  private func runPropertyUpdate(_ property: IssueDetailProperty, operation: @escaping () async throws -> Void) {
    guard canEditIssue else {
      issueErrorMessage = "You do not have permission to edit this issue."
      return
    }

    guard pendingProperty == nil else {
      return
    }

    pendingProperty = property
    issueErrorMessage = nil
    Task { @MainActor in
      do {
        try await operation()
      } catch {
        issueErrorMessage = error.localizedDescription
      }
      pendingProperty = nil
    }
  }

  private func applyMarkdownFormatting(_ action: MarkdownFormatAction) {
    switch focusedField {
    case .description:
      draftDescription = action.apply(to: draftDescription)
    case .mainComment:
      commentDraft = action.apply(to: commentDraft)
    case let .replyComment(parentId):
      replyDrafts[parentId, default: ""] = action.apply(to: replyDrafts[parentId, default: ""])
    case .title, nil:
      return
    }
  }
}

private enum IssueDetailFocusField: Hashable {
  case title
  case description
  case mainComment
  case replyComment(VectorID)

  var showsMarkdownToolbar: Bool {
    switch self {
    case .description, .mainComment, .replyComment:
      true
    case .title:
      false
    }
  }
}

private enum IssueDetailProperty: Hashable {
  case status
  case priority
  case assignees
  case project
  case team
  case visibility
}

private enum IssueTimelineEntry: Identifiable {
  case comment(VectorComment)
  case activity(VectorActivityItem)

  var id: String {
    switch self {
    case let .comment(comment):
      "comment:\(comment.id)"
    case let .activity(activity):
      "activity:\(activity.id)"
    }
  }

  var createdAt: Double {
    switch self {
    case let .comment(comment):
      comment.creationTime
    case let .activity(activity):
      activity.createdAt
    }
  }

  var isComment: Bool {
    if case .comment = self {
      return true
    }
    return false
  }
}

private enum MarkdownFormatAction: String, CaseIterable, Identifiable {
  case bold
  case italic
  case heading
  case bullet
  case code
  case quote
  case link

  var id: String { rawValue }

  var systemImage: String {
    switch self {
    case .bold: "bold"
    case .italic: "italic"
    case .heading: "textformat.size"
    case .bullet: "list.bullet"
    case .code: "chevron.left.forwardslash.chevron.right"
    case .quote: "quote.opening"
    case .link: "link"
    }
  }

  var accessibilityLabel: String {
    switch self {
    case .bold: "Bold"
    case .italic: "Italic"
    case .heading: "Heading"
    case .bullet: "Bullet list"
    case .code: "Inline code"
    case .quote: "Quote"
    case .link: "Link"
    }
  }

  func apply(to text: String) -> String {
    switch self {
    case .bold:
      appendInline("**bold**", to: text)
    case .italic:
      appendInline("_italic_", to: text)
    case .heading:
      appendLine("## Heading", to: text)
    case .bullet:
      appendLine("- ", to: text)
    case .code:
      appendInline("`code`", to: text)
    case .quote:
      appendLine("> ", to: text)
    case .link:
      appendInline("[link](https://)", to: text)
    }
  }

  private func appendInline(_ snippet: String, to text: String) -> String {
    if text.isEmpty || text.hasSuffix(" ") || text.hasSuffix("\n") {
      return text + snippet
    }
    return text + " " + snippet
  }

  private func appendLine(_ snippet: String, to text: String) -> String {
    if text.isEmpty || text.hasSuffix("\n") {
      return text + snippet
    }
    return text + "\n" + snippet
  }
}

private enum IssueVisibilityOption: String, CaseIterable, Identifiable {
  case privateVisibility = "private"
  case organization
  case publicVisibility = "public"

  var id: String { rawValue }

  var label: String {
    switch self {
    case .privateVisibility: "Private"
    case .organization: "Organization"
    case .publicVisibility: "Public"
    }
  }

  var systemImage: String {
    switch self {
    case .privateVisibility: "lock"
    case .organization: "building.2"
    case .publicVisibility: "globe"
    }
  }
}

private struct IssuePropertyBar: View {
  let issue: VectorIssueRow
  let options: VectorWorkspaceOptions?
  let selectedAssigneeIds: Set<VectorID>
  let pendingProperty: IssueDetailProperty?
  let isEditable: Bool
  let onStateSelect: (VectorState) -> Void
  let onPrioritySelect: (VectorPriority) -> Void
  let onAssigneesSelect: ([VectorID]) -> Void
  let onProjectSelect: (VectorProject?) -> Void
  let onTeamSelect: (VectorTeam?) -> Void
  let onVisibilitySelect: (IssueVisibilityOption) -> Void

  private var currentVisibility: IssueVisibilityOption {
    IssueVisibilityOption(rawValue: issue.visibility ?? "organization") ?? .organization
  }

  private var isStatusDisabled: Bool {
    !isEditable || (options?.issueStates.isEmpty ?? true) || pendingProperty != nil
  }

  private var isPriorityDisabled: Bool {
    !isEditable || (options?.issuePriorities.isEmpty ?? true) || pendingProperty != nil
  }

  private var isAssigneeDisabled: Bool {
    !isEditable || (options?.members.isEmpty ?? true) || pendingProperty != nil
  }

  private var status: VectorIssueMetadataValue {
    VectorIssueMetadataResolver.state(for: issue, options: options)
  }

  private var priority: VectorIssueMetadataValue? {
    VectorIssueMetadataResolver.priority(for: issue, options: options)
  }

  private var statusText: String {
    status.name
  }

  private var statusColor: Color {
    Color(vectorHex: status.color)
  }

  private var statusSystemImage: String {
    vectorSystemImage(for: status.icon)
  }

  private var priorityText: String {
    priority?.name ?? "Priority"
  }

  private var priorityColor: Color {
    Color(vectorHex: priority?.color)
  }

  private var prioritySystemImage: String {
    vectorSystemImage(for: priority?.icon)
  }

  var body: some View {
    ScrollView(.horizontal, showsIndicators: false) {
      HStack(spacing: 6) {
        Menu {
          ForEach((options?.issueStates ?? []).sorted { $0.position < $1.position }) { state in
            Button {
              onStateSelect(state)
            } label: {
              Label(state.name, systemImage: issue.workflowStateId == state.id ? "checkmark" : vectorSystemImage(for: state.icon))
            }
          }
        } label: {
          IssuePropertyPill(
            text: statusText,
            color: statusColor,
            systemImage: statusSystemImage,
            isPending: pendingProperty == .status
          )
        }
        .disabled(isStatusDisabled)

        Menu {
          ForEach((options?.issuePriorities ?? []).sorted { $0.weight > $1.weight }) { priority in
            Button {
              onPrioritySelect(priority)
            } label: {
              Label(priority.name, systemImage: issue.priorityId == priority.id ? "checkmark" : vectorSystemImage(for: priority.icon))
            }
          }
        } label: {
          IssuePropertyPill(
            text: priorityText,
            color: priorityColor,
            systemImage: prioritySystemImage,
            isPending: pendingProperty == .priority
          )
        }
        .disabled(isPriorityDisabled)

        IssueAssigneeMenu(
          members: options?.members ?? [],
          selectedAssigneeIds: selectedAssigneeIds,
          isPending: pendingProperty == .assignees,
          onSelect: onAssigneesSelect
        )
        .disabled(isAssigneeDisabled)

        Menu {
          Button {
            onProjectSelect(nil)
          } label: {
            Label("No project", systemImage: issue.projectId == nil ? "checkmark" : "folder")
          }
          ForEach(options?.projects ?? []) { project in
            Button {
              onProjectSelect(project)
            } label: {
              Label(project.name, systemImage: issue.projectId == project.id ? "checkmark" : vectorSystemImage(for: project.icon))
            }
          }
        } label: {
          IssuePropertyPill(
            text: issue.projectKey ?? "No project",
            color: Color.secondary,
            systemImage: "folder",
            isPending: pendingProperty == .project
          )
        }
        .disabled(!isEditable || options == nil || pendingProperty != nil)

        Menu {
          Button {
            onTeamSelect(nil)
          } label: {
            Label("No team", systemImage: issue.teamId == nil ? "checkmark" : "person.3")
          }
          ForEach(options?.teams ?? []) { team in
            Button {
              onTeamSelect(team)
            } label: {
              Label(team.name, systemImage: issue.teamId == team.id ? "checkmark" : vectorSystemImage(for: team.icon))
            }
          }
        } label: {
          IssuePropertyPill(
            text: issue.teamKey ?? "No team",
            color: Color.secondary,
            systemImage: "person.3",
            isPending: pendingProperty == .team
          )
        }
        .disabled(!isEditable || options == nil || pendingProperty != nil)

        Menu {
          ForEach(IssueVisibilityOption.allCases) { visibility in
            Button {
              onVisibilitySelect(visibility)
            } label: {
              Label(visibility.label, systemImage: currentVisibility == visibility ? "checkmark" : visibility.systemImage)
            }
          }
        } label: {
          IssuePropertyPill(
            text: currentVisibility.label,
            color: Color.secondary,
            systemImage: currentVisibility.systemImage,
            isPending: pendingProperty == .visibility
          )
        }
        .disabled(!isEditable || pendingProperty != nil)
      }
      .padding(.horizontal, 22)
      .padding(.vertical, 2)
    }
    #if os(iOS)
    .scrollClipDisabled()
    #endif
  }
}

private struct IssuePropertyPill: View {
  let text: String
  var color: Color
  var systemImage: String
  var isPending: Bool

  var body: some View {
    HStack(spacing: 5) {
      if isPending {
        ProgressView()
          .controlSize(.small)
      } else {
        Image(systemName: systemImage)
          .font(.caption2.weight(.semibold))
      }
      Text(text)
        .lineLimit(1)
      Image(systemName: "chevron.down")
        .font(.caption2.weight(.bold))
        .foregroundStyle(.secondary)
    }
    .font(.caption.weight(.medium))
    .foregroundStyle(color)
    .padding(.horizontal, 9)
    .frame(height: 30)
    .background(color.opacity(0.10), in: Capsule())
  }
}

private struct IssueAssigneeMenu: View {
  let members: [VectorWorkspaceMember]
  let selectedAssigneeIds: Set<VectorID>
  let isPending: Bool
  let onSelect: ([VectorID]) -> Void

  private var label: String {
    if selectedAssigneeIds.isEmpty {
      return "Unassigned"
    }
    if selectedAssigneeIds.count == 1,
      let selectedId = selectedAssigneeIds.first,
      let member = members.first(where: { $0.userId == selectedId })
    {
      return member.displayName
    }
    return "\(selectedAssigneeIds.count) assignees"
  }

  var body: some View {
    Menu {
      Button {
        onSelect([])
      } label: {
        Label("Unassigned", systemImage: selectedAssigneeIds.isEmpty ? "checkmark" : "person.slash")
      }

      ForEach(members.filter { $0.userId != nil }) { member in
        let userId = member.userId ?? member.id
        Button {
          var next = selectedAssigneeIds
          if next.contains(userId) {
            next.remove(userId)
          } else {
            next.insert(userId)
          }
          onSelect(Array(next))
        } label: {
          Label(member.displayName, systemImage: selectedAssigneeIds.contains(userId) ? "checkmark" : "person")
        }
      }
    } label: {
      IssuePropertyPill(
        text: label,
        color: Color.secondary,
        systemImage: "person.crop.circle",
        isPending: isPending
      )
    }
  }
}

private struct IssueCommentComposer: View {
  @Binding var text: String
  let isPosting: Bool
  var placeholder = "Write a comment"
  var minHeight: CGFloat = 76
  let focusTarget: IssueDetailFocusField
  let focusedField: FocusState<IssueDetailFocusField?>.Binding
  let onSubmit: () -> Void

  private var canSubmit: Bool {
    !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && !isPosting
  }

  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      ZStack(alignment: .topLeading) {
        if text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
          Text(placeholder)
            .font(.subheadline)
            .foregroundStyle(.secondary)
            .padding(.horizontal, 10)
            .padding(.vertical, 9)
        }

        TextEditor(text: $text)
          .font(.subheadline)
          .frame(minHeight: minHeight)
          .scrollContentBackground(.hidden)
          .focused(focusedField, equals: focusTarget)
      }
      .background(VectorTheme.groupedBackground, in: RoundedRectangle(cornerRadius: 8, style: .continuous))
      .vectorShadowRing(cornerRadius: 8)

      HStack {
        Spacer()
        Button(action: onSubmit) {
          HStack(spacing: 6) {
            if isPosting {
              ProgressView()
                .controlSize(.small)
            }
            Text("Comment")
          }
          .font(.caption.weight(.semibold))
          .padding(.horizontal, 10)
          .frame(height: 30)
          .background(VectorTheme.accent.opacity(canSubmit ? 0.15 : 0.08), in: Capsule())
        }
        .buttonStyle(.plain)
        .disabled(!canSubmit)
      }
    }
  }
}

private struct MarkdownFormattingKeyboardToolbar: View {
  let onAction: (MarkdownFormatAction) -> Void
  let onDismiss: () -> Void

  var body: some View {
    HStack(spacing: 8) {
      ForEach(MarkdownFormatAction.allCases) { action in
        Button {
          onAction(action)
        } label: {
          Image(systemName: action.systemImage)
            .font(.system(size: 15, weight: .semibold))
            .frame(width: 30, height: 30)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(action.accessibilityLabel)
      }

      Spacer(minLength: 8)

      Button {
        onDismiss()
      } label: {
        Image(systemName: "keyboard.chevron.compact.down")
          .font(.system(size: 15, weight: .semibold))
          .frame(width: 34, height: 30)
      }
      .buttonStyle(.plain)
      .accessibilityLabel("Dismiss keyboard")
    }
    .foregroundStyle(.secondary)
  }
}

private func relativeTimestamp(_ milliseconds: Double) -> String {
  let date = Date(timeIntervalSince1970: milliseconds / 1000)
  let seconds = max(0, Int(Date().timeIntervalSince(date)))

  if seconds < 60 {
    return "just now"
  }

  let minutes = seconds / 60
  if minutes < 60 {
    return "\(minutes) minute\(minutes == 1 ? "" : "s") ago"
  }

  let hours = minutes / 60
  if hours < 24 {
    return "\(hours) hour\(hours == 1 ? "" : "s") ago"
  }

  let days = hours / 24
  if days < 7 {
    return "\(days) day\(days == 1 ? "" : "s") ago"
  }

  return date.formatted(date: .abbreviated, time: .omitted)
}

private struct IssueActivityTimelineRow: View {
  let activity: VectorActivityItem
  let isLast: Bool

  var body: some View {
    HStack(alignment: .top, spacing: 10) {
      ZStack(alignment: .top) {
        if !isLast {
          Rectangle()
            .fill(VectorTheme.border.opacity(0.35))
            .frame(width: 1)
            .offset(y: 22)
        }
        Image(systemName: systemImage)
          .font(.caption2.weight(.semibold))
          .symbolRenderingMode(.monochrome)
          .foregroundStyle(iconColor)
          .frame(width: 18, height: 18)
          .background(VectorTheme.rowBackground, in: Circle())
          .overlay(
            Circle()
              .stroke(VectorTheme.border.opacity(0.55), lineWidth: 0.8)
          )
      }
      .frame(width: 28, alignment: .top)
      .frame(minHeight: 30, alignment: .top)

      HStack(alignment: .firstTextBaseline, spacing: 4) {
        activityText
          .font(.subheadline)
          .foregroundStyle(.primary)
          .fixedSize(horizontal: false, vertical: true)
        Spacer(minLength: 12)
        Text(relativeTimestamp(activity.createdAt))
          .font(.caption)
          .foregroundStyle(.secondary)
          .lineLimit(1)
      }
    }
    .frame(maxWidth: .infinity, alignment: .leading)
    .padding(.vertical, 5)
  }

  private var actorName: String {
    activity.actor?.displayName ?? "Someone"
  }

  private var activityText: Text {
    Text(actorName).fontWeight(.semibold) + Text(" \(description)")
  }

  private var description: String {
    switch activity.eventType {
    case "issue_created":
      "created this issue"
    case "issue_title_changed":
      "updated the title"
    case "issue_description_changed":
      "updated the description"
    case "issue_workflow_state_changed":
      "changed the status"
    case "issue_priority_changed":
      "changed the priority"
    case "issue_assignees_changed":
      assignmentDescription
    case "issue_project_changed":
      "changed the project"
    case "issue_team_changed":
      "changed the team"
    case "issue_visibility_changed":
      "changed visibility"
    case "issue_comment_added":
      "commented"
    default:
      "updated the issue"
    }
  }

  private var assignmentDescription: String {
    if !activity.details.addedUserNames.isEmpty {
      return "assigned \(activity.details.addedUserNames.joined(separator: ", "))"
    }
    if !activity.details.removedUserNames.isEmpty {
      return "unassigned \(activity.details.removedUserNames.joined(separator: ", "))"
    }
    return "changed assignees"
  }

  private var systemImage: String {
    switch activity.eventType {
    case "issue_created":
      "plus"
    case "issue_comment_added":
      "text.bubble"
    case "issue_assignees_changed":
      "person.2"
    case "issue_workflow_state_changed", "issue_assignment_state_changed":
      "circle.circle"
    case "issue_title_changed", "issue_description_changed":
      "textformat"
    case "issue_priority_changed":
      "arrow.left.arrow.right"
    case "issue_project_changed", "issue_project_added", "issue_project_removed":
      "folder"
    case "issue_team_changed", "issue_team_added", "issue_team_removed":
      "person.2"
    case "issue_visibility_changed":
      "eye"
    case "issue_sub_issue_created",
      "issue_github_artifact_linked",
      "issue_github_artifact_unlinked",
      "issue_github_artifact_suppressed",
      "issue_github_artifact_status_changed":
      "point.3.connected.trianglepath.dotted"
    case "issue_live_activity_started",
      "issue_live_activity_delegated",
      "issue_live_activity_completed",
      "issue_live_activity_status_changed":
      "terminal"
    default:
      "doc.text"
    }
  }

  private var iconColor: Color {
    switch activity.eventType {
    case "issue_created", "issue_sub_issue_created":
      Color(vectorHex: "#8b5cf6")
    case "issue_workflow_state_changed",
      "issue_assignment_state_changed",
      "issue_live_activity_started",
      "issue_live_activity_delegated":
      Color(vectorHex: "#22c55e")
    case "issue_priority_changed":
      Color(vectorHex: "#f97316")
    case "issue_assignees_changed", "issue_comment_added":
      Color(vectorHex: "#3b82f6")
    case "issue_team_changed",
      "issue_team_added",
      "issue_team_removed",
      "issue_project_changed",
      "issue_project_added",
      "issue_project_removed",
      "issue_visibility_changed",
      "issue_title_changed",
      "issue_description_changed",
      "issue_github_artifact_linked",
      "issue_github_artifact_unlinked",
      "issue_github_artifact_suppressed",
      "issue_github_artifact_status_changed",
      "issue_live_activity_completed",
      "issue_live_activity_status_changed":
      Color.secondary
    default:
      Color.secondary
    }
  }
}

private struct IssueCommentCard: View {
  let comment: VectorComment
  let replies: [VectorComment]
  let baseURL: URL
  @Binding var replyDraft: String
  let isReplying: Bool
  let isPostingReply: Bool
  let focusedField: FocusState<IssueDetailFocusField?>.Binding
  let onReplyTap: () -> Void
  let onCancelReply: () -> Void
  let onSubmitReply: () -> Void

  var body: some View {
    VStack(alignment: .leading, spacing: 0) {
      commentContent(comment, compact: false, showsReplyAction: true)
        .padding(.vertical, 10)

      ForEach(replies) { reply in
        commentContent(reply, compact: true)
          .padding(.leading, 36)
          .padding(.top, 2)
          .padding(.bottom, 8)
      }

      if isReplying {
        VStack(alignment: .leading, spacing: 8) {
          IssueCommentComposer(
            text: $replyDraft,
            isPosting: isPostingReply,
            placeholder: "Leave a reply... Use @ to mention",
            minHeight: 46,
            focusTarget: .replyComment(comment.id),
            focusedField: focusedField,
            onSubmit: onSubmitReply
          )
        }
        .padding(.top, 6)
        .padding(.leading, 36)
        .padding(.bottom, 8)
      }
    }
    .frame(maxWidth: .infinity, alignment: .leading)
  }

  @ViewBuilder
  private func commentContent(_ comment: VectorComment, compact: Bool, showsReplyAction: Bool = false) -> some View {
    HStack(alignment: .top, spacing: 10) {
      VectorUserAvatar(user: comment.author, baseURL: baseURL, size: compact ? 22 : 28)

      VStack(alignment: .leading, spacing: compact ? 5 : 7) {
        HStack(alignment: .firstTextBaseline, spacing: 6) {
          Text(comment.author?.displayName ?? "Unknown user")
            .font(.subheadline.weight(.semibold))
            .lineLimit(1)
          Text(relativeTimestamp(comment.creationTime))
            .font(.caption)
            .foregroundStyle(.secondary)
            .lineLimit(1)
          Spacer(minLength: 8)
          if showsReplyAction {
            Button {
              if isReplying {
                onCancelReply()
              } else {
                onReplyTap()
              }
            } label: {
              Text(isReplying ? "Cancel" : "Reply")
                .font(.caption.weight(.semibold))
                .foregroundStyle(VectorTheme.accent)
                .frame(height: 24)
            }
            .buttonStyle(.plain)
            .disabled(isPostingReply)
          }
        }

        MarkdownDocumentView(markdown: comment.body)
          .font(compact ? .subheadline : .body)
      }
      .frame(maxWidth: .infinity, alignment: .leading)
    }
    .frame(maxWidth: .infinity, alignment: .leading)
  }
}

private struct VectorUserAvatar: View {
  let user: VectorUser?
  let baseURL: URL?
  var size: CGFloat = 26

  var body: some View {
    ZStack(alignment: .bottomTrailing) {
      avatar
        .frame(width: size, height: size)
        .clipShape(Circle())
        .overlay(
          Circle()
            .stroke(statusRingColor, lineWidth: status == nil ? 0.5 : max(1.2, size * 0.06))
        )

      if let status {
        Circle()
          .fill(Color(vectorHex: status.presence.colorHex))
          .frame(width: max(7, size * 0.30), height: max(7, size * 0.30))
          .overlay(Circle().stroke(VectorTheme.rowBackground, lineWidth: max(1.5, size * 0.08)))
          .offset(x: max(1, size * 0.06), y: max(1, size * 0.06))
      }
    }
    .frame(width: size, height: size)
  }

  @ViewBuilder private var avatar: some View {
    if let url = imageURL {
      AsyncImage(url: url) { phase in
        switch phase {
        case let .success(image):
          image
            .resizable()
            .scaledToFill()
        default:
          fallback
        }
      }
    } else {
      fallback
    }
  }

  private var status: VectorUserStatus? {
    user?.status
  }

  private var statusRingColor: Color {
    if let status {
      return Color(vectorHex: status.presence.colorHex).opacity(0.68)
    }
    return VectorTheme.border.opacity(0.25)
  }

  private var imageURL: URL? {
    guard let rawImage = user?.image?.trimmingCharacters(in: .whitespacesAndNewlines), !rawImage.isEmpty else {
      return nil
    }

    if rawImage.hasPrefix("//") {
      return URL(string: "https:\(rawImage)")
    }

    if let absoluteURL = URL(string: rawImage), absoluteURL.scheme != nil {
      return absoluteURL
    }

    if let baseURL {
      return URL(string: rawImage, relativeTo: baseURL)?.absoluteURL
    }

    return URL(string: rawImage)
  }

  private var fallback: some View {
    Circle()
      .fill(VectorTheme.accent.opacity(0.14))
      .overlay(
        Text(initials)
          .font(.system(size: max(10, size * 0.38), weight: .semibold))
          .foregroundStyle(VectorTheme.accent)
      )
  }

  private var initials: String {
    let source = user?.displayName.trimmingCharacters(in: .whitespacesAndNewlines) ?? "?"
    let parts = source.split(separator: " ")
    let value = parts.prefix(2).compactMap { $0.first }.map(String.init).joined()
    return value.isEmpty ? "?" : value.uppercased()
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

private enum WorkspaceSection: String, CaseIterable, Identifiable {
  case teams
  case projects

  var id: String { rawValue }

  var label: String {
    switch self {
    case .teams: "Teams"
    case .projects: "Projects"
    }
  }

  var searchPrompt: String {
    switch self {
    case .teams: "Search teams"
    case .projects: "Search projects"
    }
  }
}

struct WorkspaceScreen: View {
  @ObservedObject var viewModel: VectorMobileViewModel
  @State private var section: WorkspaceSection = .teams
  @State private var searchText = ""
  @State private var isSearchPresented = false
  @FocusState private var isSearchFocused: Bool

  private var filteredTeams: [VectorTeam] {
    let query = searchText.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !query.isEmpty else { return viewModel.teams }
    return viewModel.teams.filter {
      $0.name.localizedCaseInsensitiveContains(query)
        || $0.key.localizedCaseInsensitiveContains(query)
        || ($0.description?.localizedCaseInsensitiveContains(query) ?? false)
    }
  }

  private var filteredProjects: [VectorProject] {
    let query = searchText.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !query.isEmpty else { return viewModel.projects }
    return viewModel.projects.filter {
      $0.name.localizedCaseInsensitiveContains(query)
        || $0.key.localizedCaseInsensitiveContains(query)
        || ($0.description?.localizedCaseInsensitiveContains(query) ?? false)
    }
  }

  private var isSearchActive: Bool {
    !searchText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
  }

  var body: some View {
    VStack(spacing: 0) {
      VStack(spacing: 8) {
        if isSearchPresented || !searchText.isEmpty {
          HStack(spacing: 8) {
            TextField(section.searchPrompt, text: $searchText)
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

        CompactSegmentedControl(options: WorkspaceSection.allCases, selection: $section) { $0.label }
      }
      .padding(12)

      content
    }
    .background(VectorTheme.groupedBackground)
    .navigationTitle("Workspace")
    .vectorInlineNavigationTitle()
    .toolbar {
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
        .accessibilityLabel(isSearchPresented ? "Hide search" : "Search workspace")
      }
    }
    .onChange(of: section) {
      searchText = ""
      if isSearchPresented {
        Task { @MainActor in
          try? await Task.sleep(nanoseconds: 80_000_000)
          isSearchFocused = true
        }
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
    switch section {
    case .teams:
      if filteredTeams.isEmpty {
        VectorEmptyState(
          title: searchText.isEmpty ? "No teams" : "No matching teams",
          systemImage: "person.2",
          message: searchText.isEmpty ? "Teams from this workspace will appear here." : "Try a different team name or key."
        )
      } else {
        List {
          ForEach(filteredTeams) { team in
            NavigationLink {
              TeamDetailScreen(team: team, viewModel: viewModel)
            } label: {
              TeamRow(team: team)
            }
          }

          PagingTrigger(
            canLoadMore: !isSearchActive && viewModel.canLoadMoreTeams,
            isLoading: !isSearchActive && viewModel.isLoadingMoreTeams,
            action: viewModel.loadMoreTeams
          )
          .listRowSeparator(.hidden)
          .listRowBackground(Color.clear)
          .listRowInsets(EdgeInsets())
        }
        .listStyle(.plain)
      }
    case .projects:
      if filteredProjects.isEmpty {
        VectorEmptyState(
          title: searchText.isEmpty ? "No projects" : "No matching projects",
          systemImage: "folder",
          message: searchText.isEmpty ? "Projects from this workspace will appear here." : "Try a different project name or key."
        )
      } else {
        List {
          ForEach(filteredProjects) { project in
            NavigationLink {
              ProjectDetailScreen(project: project, viewModel: viewModel)
            } label: {
              ProjectRow(project: project)
            }
          }

          PagingTrigger(
            canLoadMore: !isSearchActive && viewModel.canLoadMoreProjects,
            isLoading: !isSearchActive && viewModel.isLoadingMoreProjects,
            action: viewModel.loadMoreProjects
          )
          .listRowSeparator(.hidden)
          .listRowBackground(Color.clear)
          .listRowInsets(EdgeInsets())
        }
        .listStyle(.plain)
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
      CompactSegmentedControl(options: ["issues", "activity", "members"], selection: $tab) { $0.capitalized }
        .padding()

      List {
        if tab == "issues" {
          if projectIssues.isEmpty {
            VectorEmptyState(
              title: "No project issues",
              systemImage: "checklist",
              message: "Issues linked to this project will appear here."
            )
            .frame(minHeight: 190)
            .listRowSeparator(.hidden)
          } else {
            ForEach(projectIssues, id: \.rowId) { issue in
              NavigationLink {
                IssueDetailScreen(issue: issue, viewModel: viewModel)
              } label: {
                IssueRowView(
                  issue: issue,
                  workspaceOptions: viewModel.workspaceOptions,
                  baseURL: viewModel.configuration.webBaseURL
                )
              }
            }
          }
        } else if tab == "members" {
          if let lead = project.lead {
            HStack(spacing: 10) {
              VectorUserAvatar(user: lead, baseURL: viewModel.configuration.webBaseURL, size: 28)
              VStack(alignment: .leading, spacing: 2) {
                Text(lead.displayName)
                  .font(.subheadline.weight(.medium))
                Text("Lead")
                  .font(.caption)
                  .foregroundStyle(.secondary)
              }
            }
            .padding(.vertical, 4)
          } else {
            VectorEmptyState(
              title: "No project members",
              systemImage: "person.crop.circle",
              message: "Project leads and members will appear here."
            )
            .frame(minHeight: 190)
            .listRowSeparator(.hidden)
          }
        } else {
          VectorEmptyState(
            title: "No project activity",
            systemImage: "rays",
            message: "Project updates will appear here when activity is available on mobile."
          )
          .frame(minHeight: 190)
          .listRowSeparator(.hidden)
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
          if teamIssues.isEmpty {
            VectorEmptyState(
              title: "No team issues",
              systemImage: "checklist",
              message: "Issues owned by this team will appear here."
            )
            .frame(minHeight: 190)
            .listRowSeparator(.hidden)
          } else {
            ForEach(teamIssues, id: \.rowId) { issue in
              NavigationLink {
                IssueDetailScreen(issue: issue, viewModel: viewModel)
              } label: {
                IssueRowView(
                  issue: issue,
                  workspaceOptions: viewModel.workspaceOptions,
                  baseURL: viewModel.configuration.webBaseURL
                )
              }
            }
          }
        } else if tab == "projects" {
          let teamProjects = viewModel.projects.filter { $0.teamId == team.id }
          if teamProjects.isEmpty {
            VectorEmptyState(
              title: "No team projects",
              systemImage: "folder",
              message: "Projects linked to this team will appear here."
            )
            .frame(minHeight: 190)
            .listRowSeparator(.hidden)
          } else {
            ForEach(teamProjects) { project in
              NavigationLink {
                ProjectDetailScreen(project: project, viewModel: viewModel)
              } label: {
                ProjectRow(project: project)
              }
            }
          }
        } else if tab == "members" {
          if let lead = team.lead {
            HStack(spacing: 10) {
              VectorUserAvatar(user: lead, baseURL: viewModel.configuration.webBaseURL, size: 28)
              VStack(alignment: .leading, spacing: 2) {
                Text(lead.displayName)
                  .font(.subheadline.weight(.medium))
                Text("Lead")
                  .font(.caption)
                  .foregroundStyle(.secondary)
              }
            }
            .padding(.vertical, 4)
          } else {
            VectorEmptyState(
              title: "No team members",
              systemImage: "person.2",
              message: "Team leads and members will appear here."
            )
            .frame(minHeight: 190)
            .listRowSeparator(.hidden)
          }
        } else {
          VectorEmptyState(
            title: "No team activity",
            systemImage: "rays",
            message: "Team updates will appear here when activity is available on mobile."
          )
          .frame(minHeight: 190)
          .listRowSeparator(.hidden)
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
        WorkspaceSettingsRow(
          sessionController: sessionController,
          currentOrgSlug: viewModel.configuration.orgSlug
        )
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
        ForEach(VectorPresenceStatus.selectableCases) { presence in
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
