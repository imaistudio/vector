import Combine
import Foundation

@MainActor
public final class VectorMobileViewModel: ObservableObject {
  @Published public private(set) var issues: [VectorIssueRow] = []
  @Published public private(set) var projects: [VectorProject] = []
  @Published public private(set) var teams: [VectorTeam] = []
  @Published public private(set) var comments: [VectorComment] = []
  @Published public private(set) var assignments: [VectorIssueAssignment] = []
  @Published public private(set) var issueActivity: [VectorActivityItem] = []
  @Published public private(set) var inboxActivity: [VectorActivityItem] = []
  @Published public private(set) var selectedIssue: VectorIssueRow?
  @Published public private(set) var workspaceOptions: VectorWorkspaceOptions?
  @Published public private(set) var userStatus: VectorUserStatus?
  @Published public private(set) var notificationPreferences: [VectorNotificationPreference] = []
  @Published public private(set) var mobilePushTokens: [VectorMobilePushTokenRegistration] = []
  @Published public private(set) var isLoading = false
  @Published public private(set) var errorMessage: String?
  @Published public private(set) var settingsErrorMessage: String?
  @Published public var issueScope: VectorIssueScope = .mine
  @Published public var projectScope: VectorProjectScope = .mine
  @Published public var issueLayoutMode: VectorIssueLayoutMode = .list

  public let configuration: VectorMobileConfiguration
  private let repository: VectorMobileRepository
  private let pageSize = 50
  private let rootPageKey = "__root"
  private var issueCache: [VectorIssueScope: [VectorIssueRow]] = [:]
  private var projectCache: [VectorProjectScope: [VectorProject]] = [:]
  private var teamCache: [VectorProjectScope: [VectorTeam]] = [:]
  private var inboxActivityCache: [VectorActivityItem] = []
  private var issuePages: [VectorIssueScope: [String: [VectorIssueRow]]] = [:]
  private var issuePageOrder: [VectorIssueScope: [String]] = [:]
  private var issuePagination: [VectorIssueScope: PaginationState] = [:]
  private var projectPages: [VectorProjectScope: [String: [VectorProject]]] = [:]
  private var projectPageOrder: [VectorProjectScope: [String]] = [:]
  private var projectPagination: [VectorProjectScope: PaginationState] = [:]
  private var teamPages: [VectorProjectScope: [String: [VectorTeam]]] = [:]
  private var teamPageOrder: [VectorProjectScope: [String]] = [:]
  private var teamPagination: [VectorProjectScope: PaginationState] = [:]
  private var inboxActivityPages: [String: [VectorActivityItem]] = [:]
  private var inboxActivityPageOrder: [String] = []
  private var inboxActivityPagination = PaginationState()
  // Loaded pages stay subscribed so cached tabs remain live when users switch back.
  private var issueListCancellables: [VectorIssueScope: [String: AnyCancellable]] = [:]
  private var projectListCancellables: [VectorProjectScope: [String: AnyCancellable]] = [:]
  private var teamListCancellables: [VectorProjectScope: [String: AnyCancellable]] = [:]
  private var inboxActivityCancellables: [String: AnyCancellable] = [:]
  private var workspaceOptionsCancellable: AnyCancellable?
  private var issueSupportCancellables = Set<AnyCancellable>()
  private var activeIssueSupportId: VectorID?
  private var settingsCancellables = Set<AnyCancellable>()
  private var isSettingsSubscribed = false

  private struct PaginationState {
    var continueCursor: String?
    var isDone = false
    var isLoadingMore = false
  }

  public init(
    configuration: VectorMobileConfiguration = .demo,
    repository: VectorMobileRepository = MockVectorRepository()
  ) {
    self.configuration = configuration
    self.repository = repository
    refresh()
  }

  public func refresh() {
    errorMessage = nil
    subscribeToIssuesIfNeeded(scope: issueScope)
    subscribeToProjectsIfNeeded(scope: projectScope)
    subscribeToTeamsIfNeeded(scope: projectScope)
    subscribeToInboxActivityIfNeeded()
    subscribeToWorkspaceOptionsIfNeeded()
    loadSettings()
  }

  private func subscribeToIssuesIfNeeded(scope: VectorIssueScope) {
    if let cachedIssues = issueCache[scope] {
      if issueScope == scope {
        issues = cachedIssues
        isLoading = false
      }
    } else if issueScope == scope && issueListCancellables[scope]?[rootPageKey] == nil {
      issues = []
      isLoading = true
    }

    subscribeToIssuePage(scope: scope, cursor: nil)
  }

  private func subscribeToProjectsIfNeeded(scope: VectorProjectScope) {
    if let cachedProjects = projectCache[scope] {
      if projectScope == scope {
        projects = cachedProjects
      }
    } else if projectScope == scope && projectListCancellables[scope]?[rootPageKey] == nil {
      projects = []
    }

    subscribeToProjectPage(scope: scope, cursor: nil)
  }

  private func subscribeToTeamsIfNeeded(scope: VectorProjectScope) {
    if let cachedTeams = teamCache[scope] {
      if projectScope == scope {
        teams = cachedTeams
      }
    } else if projectScope == scope && teamListCancellables[scope]?[rootPageKey] == nil {
      teams = []
    }

    subscribeToTeamPage(scope: scope, cursor: nil)
  }

  private func subscribeToWorkspaceOptionsIfNeeded() {
    guard workspaceOptionsCancellable == nil else {
      return
    }

    workspaceOptionsCancellable = repository.workspaceOptions(orgSlug: configuration.orgSlug)
      .receive(on: DispatchQueue.main)
      .sink(
        receiveCompletion: { [weak self] completion in
          if case let .failure(error) = completion {
            self?.workspaceOptionsCancellable = nil
            self?.errorMessage = error.localizedDescription
          }
        },
        receiveValue: { [weak self] options in
          self?.workspaceOptions = options
        }
      )
  }

  private func subscribeToInboxActivityIfNeeded() {
    if !inboxActivityCache.isEmpty {
      inboxActivity = inboxActivityCache
    }

    subscribeToInboxActivityPage(cursor: nil)
  }

  public func loadIssueSupport(issue: VectorIssueRow) {
    if activeIssueSupportId == issue.id, !issueSupportCancellables.isEmpty {
      if selectedIssue?.id != issue.id {
        selectedIssue = currentIssue(issue.id) ?? issue
      }
      return
    }

    issueSupportCancellables.removeAll()
    activeIssueSupportId = issue.id
    selectedIssue = issue
    comments = []
    assignments = []
    issueActivity = []

    repository.issue(orgSlug: configuration.orgSlug, key: issue.key)
      .receive(on: DispatchQueue.main)
      .sink(
        receiveCompletion: { [weak self] completion in
          if case let .failure(error) = completion {
            self?.errorMessage = error.localizedDescription
          }
        },
        receiveValue: { [weak self] issue in
          if let issue {
            self?.selectedIssue = issue
          }
        }
      )
      .store(in: &issueSupportCancellables)

    repository.comments(issueId: issue.id)
      .receive(on: DispatchQueue.main)
      .sink(
        receiveCompletion: { _ in },
        receiveValue: { [weak self] comments in
          self?.comments = comments
        }
      )
      .store(in: &issueSupportCancellables)

    repository.assignments(issueId: issue.id)
      .receive(on: DispatchQueue.main)
      .sink(
        receiveCompletion: { _ in },
        receiveValue: { [weak self] assignments in
          self?.assignments = assignments
        }
      )
      .store(in: &issueSupportCancellables)

    repository.issueActivity(issueId: issue.id)
      .receive(on: DispatchQueue.main)
      .sink(
        receiveCompletion: { _ in },
        receiveValue: { [weak self] activity in
          self?.issueActivity = activity
        }
      )
      .store(in: &issueSupportCancellables)
  }

  public func loadSettings() {
    guard !isSettingsSubscribed else {
      return
    }

    isSettingsSubscribed = true
    settingsErrorMessage = nil
    settingsCancellables.removeAll()

    repository.userStatus()
      .receive(on: DispatchQueue.main)
      .sink(
        receiveCompletion: { [weak self] completion in
          if case let .failure(error) = completion {
            self?.settingsErrorMessage = error.localizedDescription
            self?.isSettingsSubscribed = false
          }
        },
        receiveValue: { [weak self] status in
          self?.userStatus = status
        }
      )
      .store(in: &settingsCancellables)

    repository.notificationPreferences()
      .receive(on: DispatchQueue.main)
      .sink(
        receiveCompletion: { [weak self] completion in
          if case let .failure(error) = completion {
            self?.settingsErrorMessage = error.localizedDescription
            self?.isSettingsSubscribed = false
          }
        },
        receiveValue: { [weak self] preferences in
          self?.notificationPreferences = preferences
        }
      )
      .store(in: &settingsCancellables)

    repository.mobilePushTokens()
      .receive(on: DispatchQueue.main)
      .sink(
        receiveCompletion: { [weak self] completion in
          if case let .failure(error) = completion {
            self?.settingsErrorMessage = error.localizedDescription
            self?.isSettingsSubscribed = false
          }
        },
        receiveValue: { [weak self] tokens in
          self?.mobilePushTokens = tokens
        }
      )
      .store(in: &settingsCancellables)
  }

  public func setPresence(_ presence: VectorPresenceStatus) {
    let previous = userStatus
    userStatus = VectorUserStatus(
      presence: presence,
      customText: previous?.customText,
      customEmoji: previous?.customEmoji,
      clearsAt: previous?.clearsAt,
      updatedAt: Date().timeIntervalSince1970 * 1000
    )

    Task {
      do {
        try await repository.setPresence(presence)
      } catch {
        await MainActor.run {
          self.userStatus = previous
          self.settingsErrorMessage = error.localizedDescription
        }
      }
    }
  }

  public func setCustomStatus(text: String, emoji: String, clearsAt: Double?) {
    let trimmedText = text.trimmingCharacters(in: .whitespacesAndNewlines)
    let trimmedEmoji = emoji.trimmingCharacters(in: .whitespacesAndNewlines)
    let previous = userStatus
    userStatus = VectorUserStatus(
      presence: previous?.presence ?? .online,
      customText: trimmedText.isEmpty ? nil : trimmedText,
      customEmoji: trimmedEmoji.isEmpty ? nil : trimmedEmoji,
      clearsAt: clearsAt,
      updatedAt: Date().timeIntervalSince1970 * 1000
    )

    Task {
      do {
        try await repository.setCustomStatus(
          text: trimmedText.isEmpty ? nil : trimmedText,
          emoji: trimmedEmoji.isEmpty ? nil : trimmedEmoji,
          clearsAt: clearsAt
        )
      } catch {
        await MainActor.run {
          self.userStatus = previous
          self.settingsErrorMessage = error.localizedDescription
        }
      }
    }
  }

  public func clearCustomStatus() {
    let previous = userStatus
    userStatus = VectorUserStatus(
      presence: previous?.presence ?? .online,
      updatedAt: Date().timeIntervalSince1970 * 1000
    )

    Task {
      do {
        try await repository.clearCustomStatus()
      } catch {
        await MainActor.run {
          self.userStatus = previous
          self.settingsErrorMessage = error.localizedDescription
        }
      }
    }
  }

  public func setPushEnabled(for category: VectorNotificationCategory, isEnabled: Bool) {
    guard let existing = notificationPreferences.first(where: { $0.category == category }) else {
      return
    }
    let previous = notificationPreferences
    let nextPreference = VectorNotificationPreference(
      category: existing.category,
      inAppEnabled: existing.inAppEnabled,
      emailEnabled: existing.emailEnabled,
      pushEnabled: isEnabled
    )
    notificationPreferences = notificationPreferences.map {
      $0.category == category ? nextPreference : $0
    }

    Task {
      do {
        try await repository.updateNotificationPreference(nextPreference)
      } catch {
        await MainActor.run {
          self.notificationPreferences = previous
          self.settingsErrorMessage = error.localizedDescription
        }
      }
    }
  }

  public func upsertMobilePushToken(_ token: VectorPushDeviceToken) {
    Task {
      do {
        try await repository.upsertMobilePushToken(
          token,
          bundleId: Bundle.main.bundleIdentifier,
          deviceLabel: "iPhone"
        )
      } catch {
        await MainActor.run {
          self.settingsErrorMessage = error.localizedDescription
        }
      }
    }
  }

  public func removeMobilePushToken(_ token: VectorPushDeviceToken) {
    Task {
      do {
        try await repository.removeMobilePushToken(token)
      } catch {
        await MainActor.run {
          self.settingsErrorMessage = error.localizedDescription
        }
      }
    }
  }

  public func unregisterMobilePushToken(_ token: VectorPushDeviceToken) async {
    do {
      try await repository.removeMobilePushToken(token)
    } catch {
      await MainActor.run {
        self.settingsErrorMessage = error.localizedDescription
      }
    }
  }

  public func updateIssueTitle(issueId: VectorID, title: String) async throws {
    let trimmedTitle = title.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmedTitle.isEmpty else {
      return
    }

    let previousIssues = issues
    let previousSelectedIssue = selectedIssue
    updateIssue(issueId) { $0.withTitle(trimmedTitle) }

    do {
      try await repository.updateTitle(issueId: issueId, title: trimmedTitle)
    } catch {
      issues = previousIssues
      selectedIssue = previousSelectedIssue
      errorMessage = error.localizedDescription
      throw error
    }
  }

  public func updateIssueDescription(issueId: VectorID, description: String) async throws {
    let trimmedDescription = description.trimmingCharacters(in: .whitespacesAndNewlines)
    let nextDescription = trimmedDescription.isEmpty ? nil : description
    let previousIssues = issues
    let previousSelectedIssue = selectedIssue
    updateIssue(issueId) { $0.withDescription(nextDescription) }

    do {
      try await repository.updateDescription(issueId: issueId, description: nextDescription)
    } catch {
      issues = previousIssues
      selectedIssue = previousSelectedIssue
      errorMessage = error.localizedDescription
      throw error
    }
  }

  public func changeIssueWorkflowState(issueId: VectorID, state: VectorState) async throws {
    let previousIssues = issues
    let previousSelectedIssue = selectedIssue
    let previousAssignments = assignments
    updateIssue(issueId) { $0.withWorkflowState(state) }
    assignments = assignments.map {
      VectorIssueAssignment(
        id: $0.id,
        assigneeId: $0.assigneeId,
        assigneeName: $0.assigneeName,
        assigneeEmail: $0.assigneeEmail,
        assigneeImage: $0.assigneeImage,
        stateId: state.id,
        stateName: state.name,
        stateIcon: state.icon,
        stateColor: state.color,
        stateType: state.type,
        note: $0.note
      )
    }

    do {
      try await repository.changeWorkflowState(issueId: issueId, stateId: state.id)
    } catch {
      issues = previousIssues
      selectedIssue = previousSelectedIssue
      assignments = previousAssignments
      errorMessage = error.localizedDescription
      throw error
    }
  }

  public func changeIssuePriority(issueId: VectorID, priority: VectorPriority) async throws {
    let previousIssues = issues
    let previousSelectedIssue = selectedIssue
    updateIssue(issueId) { $0.withPriority(priority) }

    do {
      try await repository.changePriority(issueId: issueId, priorityId: priority.id)
    } catch {
      issues = previousIssues
      selectedIssue = previousSelectedIssue
      errorMessage = error.localizedDescription
      throw error
    }
  }

  public func updateIssueAssignees(issueId: VectorID, assigneeIds: [VectorID]) async throws {
    let previousIssues = issues
    let previousSelectedIssue = selectedIssue
    let previousAssignments = assignments
    let selectedMembers = assigneeIds.compactMap { assigneeId in
      workspaceOptions?.members.first { $0.userId == assigneeId }
    }
    let issue = currentIssue(issueId)
    let state = workspaceOptions?.issueStates.first { $0.id == issue?.workflowStateId }
    updateIssue(issueId) { $0.withPrimaryAssignee(selectedMembers.first) }
    assignments = selectedMembers.map { member in
      VectorIssueAssignment(
        id: "optimistic-\(issueId)-\(member.userId ?? member.id)",
        assigneeId: member.userId,
        assigneeName: member.displayName,
        assigneeEmail: member.email,
        assigneeImage: member.image,
        stateId: issue?.workflowStateId,
        stateName: state?.name ?? issue?.workflowStateName,
        stateIcon: state?.icon ?? issue?.workflowStateIcon,
        stateColor: state?.color ?? issue?.workflowStateColor,
        stateType: state?.type ?? issue?.workflowStateType
      )
    }

    do {
      try await repository.updateAssignees(issueId: issueId, assigneeIds: assigneeIds)
    } catch {
      issues = previousIssues
      selectedIssue = previousSelectedIssue
      assignments = previousAssignments
      errorMessage = error.localizedDescription
      throw error
    }
  }

  public func changeIssueProject(issueId: VectorID, project: VectorProject?) async throws {
    let previousIssues = issues
    let previousSelectedIssue = selectedIssue
    updateIssue(issueId) { $0.withProject(project) }

    do {
      try await repository.changeProject(issueId: issueId, projectId: project?.id)
    } catch {
      issues = previousIssues
      selectedIssue = previousSelectedIssue
      errorMessage = error.localizedDescription
      throw error
    }
  }

  public func changeIssueTeam(issueId: VectorID, team: VectorTeam?) async throws {
    let previousIssues = issues
    let previousSelectedIssue = selectedIssue
    updateIssue(issueId) { $0.withTeam(team) }

    do {
      try await repository.changeTeam(issueId: issueId, teamId: team?.id)
    } catch {
      issues = previousIssues
      selectedIssue = previousSelectedIssue
      errorMessage = error.localizedDescription
      throw error
    }
  }

  public func changeIssueVisibility(issueId: VectorID, visibility: String) async throws {
    let previousIssues = issues
    let previousSelectedIssue = selectedIssue
    updateIssue(issueId) { $0.withVisibility(visibility) }

    do {
      try await repository.changeVisibility(issueId: issueId, visibility: visibility)
    } catch {
      issues = previousIssues
      selectedIssue = previousSelectedIssue
      errorMessage = error.localizedDescription
      throw error
    }
  }

  public func addIssueComment(issueId: VectorID, body: String, parentId: VectorID? = nil) async throws {
    let trimmedBody = body.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmedBody.isEmpty else {
      return
    }

    let previousComments = comments
    comments.append(
      VectorComment(
        id: "optimistic-\(UUID().uuidString)",
        body: body,
        author: nil,
        parentId: parentId,
        creationTime: Date().timeIntervalSince1970 * 1000
      )
    )

    do {
      try await repository.addComment(issueId: issueId, body: trimmedBody, parentId: parentId)
    } catch {
      comments = previousComments
      errorMessage = error.localizedDescription
      throw error
    }
  }

  public func openWebURL(for issue: VectorIssueRow) -> URL {
    configuration.webURL(path: "/\(configuration.orgSlug)/issues/\(issue.key)")
  }

  public func openWebURL(for project: VectorProject) -> URL {
    configuration.webURL(path: "/\(configuration.orgSlug)/projects/\(project.key)")
  }

  public func openWebURL(for team: VectorTeam) -> URL {
    configuration.webURL(path: "/\(configuration.orgSlug)/teams/\(team.key)")
  }

  public var canLoadMoreIssues: Bool {
    canLoadMore(issuePagination[issueScope])
  }

  public var isLoadingMoreIssues: Bool {
    issuePagination[issueScope]?.isLoadingMore ?? false
  }

  public var canLoadMoreProjects: Bool {
    canLoadMore(projectPagination[projectScope])
  }

  public var isLoadingMoreProjects: Bool {
    projectPagination[projectScope]?.isLoadingMore ?? false
  }

  public var canLoadMoreTeams: Bool {
    canLoadMore(teamPagination[projectScope])
  }

  public var isLoadingMoreTeams: Bool {
    teamPagination[projectScope]?.isLoadingMore ?? false
  }

  public var canLoadMoreInboxActivity: Bool {
    canLoadMore(inboxActivityPagination)
  }

  public var isLoadingMoreInboxActivity: Bool {
    inboxActivityPagination.isLoadingMore
  }

  public func loadMoreIssues() {
    guard let cursor = nextCursor(issuePagination[issueScope]) else {
      return
    }
    subscribeToIssuePage(scope: issueScope, cursor: cursor)
  }

  public func loadMoreProjects() {
    guard let cursor = nextCursor(projectPagination[projectScope]) else {
      return
    }
    subscribeToProjectPage(scope: projectScope, cursor: cursor)
  }

  public func loadMoreTeams() {
    guard let cursor = nextCursor(teamPagination[projectScope]) else {
      return
    }
    subscribeToTeamPage(scope: projectScope, cursor: cursor)
  }

  public func loadMoreInboxActivity() {
    guard let cursor = nextCursor(inboxActivityPagination) else {
      return
    }
    subscribeToInboxActivityPage(cursor: cursor)
  }

  private func subscribeToIssuePage(scope: VectorIssueScope, cursor: String?) {
    let key = pageKey(cursor)
    guard issueListCancellables[scope]?[key] == nil else {
      return
    }

    markLoading(cursor: cursor, pagination: &issuePagination[scope, default: PaginationState()])
    issueListCancellables[scope, default: [:]][key] = repository
      .issuesPage(orgSlug: configuration.orgSlug, scope: scope, pageSize: pageSize, cursor: cursor)
      .receive(on: DispatchQueue.main)
      .sink(
        receiveCompletion: { [weak self, scope, key] completion in
          self?.handlePageCompletion(completion, key: key, active: self?.issueScope == scope) {
            self?.issueListCancellables[scope]?[key] = nil
            self?.issuePagination[scope, default: PaginationState()].isLoadingMore = false
            if key == self?.rootPageKey {
              self?.isLoading = false
            }
          }
        },
        receiveValue: { [weak self, scope, key] page in
          guard let self else { return }
          issuePages[scope, default: [:]][key] = page.page
          appendPageKey(key, to: &issuePageOrder[scope, default: []])
          updatePagination(page.nextCursor, isDone: page.isDone, key: key, order: issuePageOrder[scope] ?? [], state: &issuePagination[scope, default: PaginationState()])
          rebuildIssues(scope: scope)
        }
      )
  }

  private func subscribeToProjectPage(scope: VectorProjectScope, cursor: String?) {
    let key = pageKey(cursor)
    guard projectListCancellables[scope]?[key] == nil else {
      return
    }

    markLoading(cursor: cursor, pagination: &projectPagination[scope, default: PaginationState()])
    projectListCancellables[scope, default: [:]][key] = repository
      .projectsPage(orgSlug: configuration.orgSlug, scope: scope, pageSize: pageSize, cursor: cursor)
      .receive(on: DispatchQueue.main)
      .sink(
        receiveCompletion: { [weak self, scope, key] completion in
          self?.handlePageCompletion(completion, key: key, active: self?.projectScope == scope) {
            self?.projectListCancellables[scope]?[key] = nil
            self?.projectPagination[scope, default: PaginationState()].isLoadingMore = false
          }
        },
        receiveValue: { [weak self, scope, key] page in
          guard let self else { return }
          projectPages[scope, default: [:]][key] = page.page
          appendPageKey(key, to: &projectPageOrder[scope, default: []])
          updatePagination(page.nextCursor, isDone: page.isDone, key: key, order: projectPageOrder[scope] ?? [], state: &projectPagination[scope, default: PaginationState()])
          rebuildProjects(scope: scope)
        }
      )
  }

  private func subscribeToTeamPage(scope: VectorProjectScope, cursor: String?) {
    let key = pageKey(cursor)
    guard teamListCancellables[scope]?[key] == nil else {
      return
    }

    markLoading(cursor: cursor, pagination: &teamPagination[scope, default: PaginationState()])
    teamListCancellables[scope, default: [:]][key] = repository
      .teamsPage(orgSlug: configuration.orgSlug, scope: scope, pageSize: pageSize, cursor: cursor)
      .receive(on: DispatchQueue.main)
      .sink(
        receiveCompletion: { [weak self, scope, key] completion in
          self?.handlePageCompletion(completion, key: key, active: self?.projectScope == scope) {
            self?.teamListCancellables[scope]?[key] = nil
            self?.teamPagination[scope, default: PaginationState()].isLoadingMore = false
          }
        },
        receiveValue: { [weak self, scope, key] page in
          guard let self else { return }
          teamPages[scope, default: [:]][key] = page.page
          appendPageKey(key, to: &teamPageOrder[scope, default: []])
          updatePagination(page.nextCursor, isDone: page.isDone, key: key, order: teamPageOrder[scope] ?? [], state: &teamPagination[scope, default: PaginationState()])
          rebuildTeams(scope: scope)
        }
      )
  }

  private func subscribeToInboxActivityPage(cursor: String?) {
    let key = pageKey(cursor)
    guard inboxActivityCancellables[key] == nil else {
      return
    }

    markLoading(cursor: cursor, pagination: &inboxActivityPagination)
    inboxActivityCancellables[key] = repository
      .inboxActivityPage(orgSlug: configuration.orgSlug, pageSize: pageSize, cursor: cursor)
      .receive(on: DispatchQueue.main)
      .sink(
        receiveCompletion: { [weak self, key] completion in
          self?.handlePageCompletion(completion, key: key, active: true) {
            self?.inboxActivityCancellables[key] = nil
            self?.inboxActivityPagination.isLoadingMore = false
          }
        },
        receiveValue: { [weak self, key] page in
          guard let self else { return }
          inboxActivityPages[key] = page.items
          appendPageKey(key, to: &inboxActivityPageOrder)
          updatePagination(page.nextCursor, isDone: page.isDone, key: key, order: inboxActivityPageOrder, state: &inboxActivityPagination)
          rebuildInboxActivity()
        }
      )
  }

  private func markLoading(cursor: String?, pagination: inout PaginationState) {
    guard cursor != nil else {
      return
    }
    objectWillChange.send()
    pagination.isLoadingMore = true
  }

  private func updatePagination(_ cursor: String?, isDone: Bool, key: String, order: [String], state: inout PaginationState) {
    objectWillChange.send()
    guard order.last == key else {
      return
    }
    state.isLoadingMore = false
    state.continueCursor = cursor?.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty
    state.isDone = isDone || state.continueCursor == nil
  }

  private func handlePageCompletion(_ completion: Subscribers.Completion<Error>, key: String, active: Bool, cleanup: () -> Void) {
    if case let .failure(error) = completion {
      cleanup()
      if active {
        errorMessage = error.localizedDescription
        if key == rootPageKey {
          isLoading = false
        }
      }
    }
  }

  private func rebuildIssues(scope: VectorIssueScope) {
    let merged = uniqueItems(orderedPages(issuePages[scope] ?? [:], order: issuePageOrder[scope] ?? []), id: \.rowId)
    issueCache[scope] = merged
    if issueScope == scope {
      issues = merged
      isLoading = false
    }
  }

  private func rebuildProjects(scope: VectorProjectScope) {
    let merged = uniqueItems(orderedPages(projectPages[scope] ?? [:], order: projectPageOrder[scope] ?? []), id: \.id)
    projectCache[scope] = merged
    if projectScope == scope {
      projects = merged
    }
  }

  private func rebuildTeams(scope: VectorProjectScope) {
    let merged = uniqueItems(orderedPages(teamPages[scope] ?? [:], order: teamPageOrder[scope] ?? []), id: \.id)
    teamCache[scope] = merged
    if projectScope == scope {
      teams = merged
    }
  }

  private func rebuildInboxActivity() {
    inboxActivityCache = uniqueItems(orderedPages(inboxActivityPages, order: inboxActivityPageOrder), id: \.id)
    inboxActivity = inboxActivityCache
  }

  private func pageKey(_ cursor: String?) -> String {
    cursor ?? rootPageKey
  }

  private func appendPageKey(_ key: String, to order: inout [String]) {
    guard !order.contains(key) else {
      return
    }
    order.append(key)
  }

  private func orderedPages<Item>(_ pages: [String: [Item]], order: [String]) -> [Item] {
    order.flatMap { pages[$0] ?? [] }
  }

  private func uniqueItems<Item, ID: Hashable>(_ items: [Item], id: KeyPath<Item, ID>) -> [Item] {
    var seen = Set<ID>()
    return items.filter { item in
      seen.insert(item[keyPath: id]).inserted
    }
  }

  private func canLoadMore(_ state: PaginationState?) -> Bool {
    guard let state else {
      return false
    }
    return !state.isDone && !state.isLoadingMore && state.continueCursor != nil
  }

  private func nextCursor(_ state: PaginationState?) -> String? {
    guard canLoadMore(state) else {
      return nil
    }
    return state?.continueCursor
  }

  private func currentIssue(_ issueId: VectorID) -> VectorIssueRow? {
    selectedIssue?.id == issueId ? selectedIssue : issues.first { $0.id == issueId }
  }

  private func updateIssue(_ issueId: VectorID, transform: (VectorIssueRow) -> VectorIssueRow) {
    issues = issues.map { issue in
      issue.id == issueId ? transform(issue) : issue
    }
    if let selectedIssue, selectedIssue.id == issueId {
      self.selectedIssue = transform(selectedIssue)
    }
  }
}

private extension String {
  var nilIfEmpty: String? {
    isEmpty ? nil : self
  }
}
