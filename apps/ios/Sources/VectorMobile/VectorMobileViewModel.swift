import Combine
import Foundation

public enum VectorMobileError: LocalizedError {
  case validation(String)

  public var errorDescription: String? {
    switch self {
    case let .validation(message): message
    }
  }
}

@MainActor
public final class VectorMobileViewModel: ObservableObject {
  @Published public private(set) var requests: [VectorRequestRow] = []
  @Published public private(set) var work: [VectorWorkRow] = []
  @Published public private(set) var selectedRequest: VectorRequestDetail?
  @Published public private(set) var selectedWork: VectorWorkDetail?
  @Published public private(set) var selectedRequestError: String?
  @Published public private(set) var selectedWorkError: String?
  @Published public private(set) var isLoadingRequests = false
  @Published public private(set) var isLoadingWork = false
  @Published public private(set) var pendingWorkModelActions: Set<String> = []
  @Published public private(set) var issues: [VectorIssueRow] = []
  @Published public private(set) var projects: [VectorProject] = []
  @Published public private(set) var teams: [VectorTeam] = []
  @Published public private(set) var documents: [VectorDocument] = []
  @Published public private(set) var inboxNotifications: [VectorInboxNotification] = []
  @Published public private(set) var comments: [VectorComment] = []
  @Published public private(set) var assignments: [VectorIssueAssignment] = []
  @Published public private(set) var issueActivity: [VectorActivityItem] = []
  @Published public private(set) var inboxActivity: [VectorActivityItem] = []
  @Published public private(set) var selectedIssue: VectorIssueRow?
  @Published public private(set) var selectedDocument: VectorDocument?
  @Published public private(set) var workspaceOptions: VectorWorkspaceOptions?
  @Published public private(set) var currentUser: VectorUser?
  @Published public private(set) var userStatus: VectorUserStatus?
  @Published public private(set) var pendingPresence: VectorPresenceStatus?
  @Published public private(set) var isUpdatingUserStatus = false
  @Published public private(set) var notificationPreferences: [VectorNotificationPreference] = []
  @Published public private(set) var mobilePushTokens: [VectorMobilePushTokenRegistration] = []
  @Published public private(set) var isLoading = false
  @Published public private(set) var errorMessage: String?
  @Published public private(set) var settingsErrorMessage: String?
  @Published public var issueScope: VectorIssueScope = .mine
  @Published public var requestScope: VectorRequestScope = .inbox
  @Published public var workScope: VectorWorkScope = .active
  @Published public var projectScope: VectorProjectScope = .mine
  @Published public var issueLayoutMode: VectorIssueLayoutMode = .list

  public let configuration: VectorMobileConfiguration
  private let repository: VectorMobileRepository
  private let pageSize = 50
  private let rootPageKey = "__root"
  private var issueCache: [VectorIssueScope: [VectorIssueRow]] = [:]
  private var projectCache: [VectorProjectScope: [VectorProject]] = [:]
  private var teamCache: [VectorProjectScope: [VectorTeam]] = [:]
  private var documentCache: [VectorDocument] = []
  private var inboxNotificationCache: [VectorInboxNotification] = []
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
  private var documentPages: [String: [VectorDocument]] = [:]
  private var documentPageOrder: [String] = []
  private var documentPagination = PaginationState()
  private var inboxNotificationPages: [String: [VectorInboxNotification]] = [:]
  private var inboxNotificationPageOrder: [String] = []
  private var inboxNotificationPagination = PaginationState()
  private var inboxActivityPages: [String: [VectorActivityItem]] = [:]
  private var inboxActivityPageOrder: [String] = []
  private var inboxActivityPagination = PaginationState()
  // Loaded pages stay subscribed so cached tabs remain live when users switch back.
  private var issueListCancellables: [VectorIssueScope: [String: AnyCancellable]] = [:]
  private var requestListCancellable: AnyCancellable?
  private var workListCancellable: AnyCancellable?
  private var requestDetailCancellable: AnyCancellable?
  private var workDetailCancellable: AnyCancellable?
  private var projectListCancellables: [VectorProjectScope: [String: AnyCancellable]] = [:]
  private var teamListCancellables: [VectorProjectScope: [String: AnyCancellable]] = [:]
  private var documentListCancellables: [String: AnyCancellable] = [:]
  private var inboxNotificationCancellables: [String: AnyCancellable] = [:]
  private var inboxActivityCancellables: [String: AnyCancellable] = [:]
  private var workspaceOptionsCancellable: AnyCancellable?
  private var issueSupportCancellables = Set<AnyCancellable>()
  private var activeIssueSupportId: VectorID?
  private var activeIssueCollectionsId: VectorID?
  private var documentDetailCancellable: AnyCancellable?
  private var activeDocumentId: VectorID?
  private var settingsCancellables = Set<AnyCancellable>()
  private var isSettingsSubscribed = false
  private var authenticatedUser: VectorAuthenticatedUser?
  private var subscribedComments: [VectorComment] = []
  private var pendingComments: [VectorID: VectorComment] = [:]
  private var userStatusMutationSequence = 0
  private var optimisticUserStatusGuard: OptimisticUserStatusGuard?

  private struct OptimisticUserStatusGuard {
    enum ConfirmationMode {
      case presence
      case fullStatus
    }

    let token: Int
    let status: VectorUserStatus
    let confirmationMode: ConfirmationMode
  }

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
    refreshRequests()
    refreshWork()
    subscribeToIssuesIfNeeded(scope: issueScope)
    subscribeToProjectsIfNeeded(scope: projectScope)
    subscribeToTeamsIfNeeded(scope: projectScope)
    subscribeToDocumentsIfNeeded()
    subscribeToInboxNotificationsIfNeeded()
    subscribeToWorkspaceOptionsIfNeeded()
    loadSettings()
  }

  public func refreshRequests() {
    requestListCancellable?.cancel()
    isLoadingRequests = true
    requestListCancellable = repository.requestsPage(
      orgSlug: configuration.orgSlug,
      scope: requestScope,
      pageSize: pageSize,
      cursor: nil
    )
    .receive(on: DispatchQueue.main)
    .sink(
      receiveCompletion: { [weak self] completion in
        guard let self else { return }
        isLoadingRequests = false
        if case let .failure(error) = completion {
          errorMessage = error.localizedDescription
        }
      },
      receiveValue: { [weak self] page in
        self?.requests = page.page
        self?.isLoadingRequests = false
      }
    )
  }

  public func refreshWork() {
    workListCancellable?.cancel()
    isLoadingWork = true
    workListCancellable = repository.workPage(
      orgSlug: configuration.orgSlug,
      scope: workScope,
      pageSize: pageSize,
      cursor: nil
    )
    .receive(on: DispatchQueue.main)
    .sink(
      receiveCompletion: { [weak self] completion in
        guard let self else { return }
        isLoadingWork = false
        if case let .failure(error) = completion {
          errorMessage = error.localizedDescription
        }
      },
      receiveValue: { [weak self] page in
        self?.work = page.page
        self?.isLoadingWork = false
      }
    )
  }

  public func loadRequest(_ row: VectorRequestRow) {
    requestDetailCancellable?.cancel()
    selectedRequest = nil
    selectedRequestError = nil
    requestDetailCancellable = repository.request(orgSlug: configuration.orgSlug, key: row.key)
      .receive(on: DispatchQueue.main)
      .sink(
        receiveCompletion: { [weak self] completion in
          if case let .failure(error) = completion {
            self?.selectedRequestError = error.localizedDescription
          }
        },
        receiveValue: { [weak self] detail in
          self?.selectedRequestError = detail == nil
            ? "This request was not found or you no longer have access."
            : nil
          self?.selectedRequest = detail
        }
      )
  }

  public func loadWork(_ row: VectorWorkRow) {
    workDetailCancellable?.cancel()
    selectedWork = nil
    selectedWorkError = nil
    workDetailCancellable = repository.work(orgSlug: configuration.orgSlug, key: row.key)
      .receive(on: DispatchQueue.main)
      .sink(
        receiveCompletion: { [weak self] completion in
          if case let .failure(error) = completion {
            self?.selectedWorkError = error.localizedDescription
          }
        },
        receiveValue: { [weak self] detail in
          self?.selectedWorkError = detail == nil
            ? "This work was not found or you no longer have access."
            : nil
          self?.selectedWork = detail
        }
      )
  }

  public func createRequest(
    title: String,
    description: String?,
    expectedOutput: String,
    reviewGuidance: String?
  ) async -> Bool {
    await performWorkModelAction(id: "create-request") {
      _ = try await self.repository.createRequest(
        orgSlug: self.configuration.orgSlug,
        title: title,
        description: description,
        expectedOutput: expectedOutput,
        reviewGuidance: reviewGuidance
      )
    }
  }

  public func claimRequest(_ requestId: VectorID) async -> Bool {
    await performWorkModelAction(id: "request:\(requestId):claim") {
      try await self.repository.claimRequest(requestId: requestId)
    }
  }

  public func completeRequest(_ requestId: VectorID) async -> Bool {
    await performWorkModelAction(id: "request:\(requestId):complete") {
      try await self.repository.completeRequest(requestId: requestId)
    }
  }

  public func requestChanges(_ requestId: VectorID, note: String) async -> Bool {
    await performWorkModelAction(id: "request:\(requestId):changes") {
      try await self.repository.requestChanges(requestId: requestId, note: note)
    }
  }

  public func startWork(_ workId: VectorID) async -> Bool {
    await performWorkModelAction(id: "work:\(workId):start") {
      try await self.repository.startWork(workId: workId)
    }
  }

  public func setWorkStatus(_ workId: VectorID, status: VectorWorkStatus) async -> Bool {
    await performWorkModelAction(id: "work:\(workId):status") {
      try await self.repository.setWorkStatus(workId: workId, status: status)
    }
  }

  public func readyWorkForReview(_ workId: VectorID) async -> Bool {
    await performWorkModelAction(id: "work:\(workId):review") {
      try await self.repository.readyWorkForReview(workId: workId)
    }
  }

  public func completeWork(_ workId: VectorID) async -> Bool {
    await performWorkModelAction(id: "work:\(workId):complete") {
      try await self.repository.completeWork(workId: workId)
    }
  }

  public func respondToHandoff(_ handoffId: VectorID, accept: Bool) async -> Bool {
    await performWorkModelAction(id: "handoff:\(handoffId)") {
      try await self.repository.respondToWorkHandoff(handoffId: handoffId, accept: accept)
    }
  }

  public func setTaskStatus(_ taskId: VectorID, status: VectorTaskStatus) async -> Bool {
    await performWorkModelAction(id: "task:\(taskId):status") {
      try await self.repository.setTaskStatus(taskId: taskId, status: status)
    }
  }

  private func performWorkModelAction(
    id: String,
    operation: () async throws -> Void
  ) async -> Bool {
    guard !pendingWorkModelActions.contains(id) else { return false }
    pendingWorkModelActions.insert(id)
    defer { pendingWorkModelActions.remove(id) }
    do {
      try await operation()
      return true
    } catch {
      errorMessage = error.localizedDescription
      return false
    }
  }

  public func setAuthenticatedUser(_ user: VectorAuthenticatedUser?) {
    authenticatedUser = user
    syncCurrentUser()
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
          self?.syncCurrentUser()
        }
      )
  }

  private func subscribeToDocumentsIfNeeded() {
    if !documentCache.isEmpty {
      documents = documentCache
    }

    subscribeToDocumentPage(cursor: nil)
  }

  private func subscribeToInboxNotificationsIfNeeded() {
    if !inboxNotificationCache.isEmpty {
      inboxNotifications = inboxNotificationCache
    }

    subscribeToInboxNotificationPage(cursor: nil)
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
    activeIssueCollectionsId = nil
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
          guard let self, let issue else { return }
          selectedIssue = issue
          activeIssueSupportId = issue.id
          subscribeIssueCollections(issue: issue)
        }
      )
      .store(in: &issueSupportCancellables)

    if issue.id != issue.key {
      subscribeIssueCollections(issue: issue)
    }
  }

  private func subscribeIssueCollections(issue: VectorIssueRow) {
    guard activeIssueCollectionsId != issue.id else {
      return
    }

    activeIssueCollectionsId = issue.id
    subscribedComments = []
    pendingComments = [:]
    comments = []
    assignments = []
    issueActivity = []

    repository.comments(issueId: issue.id)
      .receive(on: DispatchQueue.main)
      .sink(
        receiveCompletion: { _ in },
        receiveValue: { [weak self] comments in
          self?.subscribedComments = comments
          self?.applyCommentSnapshot()
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

  public func loadDocument(_ document: VectorDocument) {
    if activeDocumentId == document.id, documentDetailCancellable != nil {
      if selectedDocument?.id != document.id {
        selectedDocument = currentDocument(document.id) ?? document
      }
      return
    }

    documentDetailCancellable = nil
    activeDocumentId = document.id
    selectedDocument = currentDocument(document.id) ?? document

    documentDetailCancellable = repository.document(documentId: document.id)
      .receive(on: DispatchQueue.main)
      .sink(
        receiveCompletion: { [weak self] completion in
          if case let .failure(error) = completion {
            self?.errorMessage = error.localizedDescription
          }
        },
        receiveValue: { [weak self] document in
          guard let self else { return }
          if let document {
            selectedDocument = document
            updateDocumentCache(document)
          }
        }
      )
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
          self?.applySubscribedUserStatus(status)
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
    let optimisticStatus = VectorUserStatus(
      presence: presence,
      customText: previous?.customText,
      customEmoji: previous?.customEmoji,
      clearsAt: previous?.clearsAt,
      updatedAt: Date().timeIntervalSince1970 * 1000
    )
    let token = beginOptimisticUserStatus(
      optimisticStatus,
      pendingPresence: presence,
      confirmationMode: .presence
    )

    Task {
      do {
        try await repository.setPresence(presence)
        await MainActor.run {
          self.finishUserStatusMutation(token: token)
        }
      } catch {
        await MainActor.run {
          self.failUserStatusMutation(token: token, previous: previous, error: error)
        }
      }
    }
  }

  public func setCustomStatus(text: String, emoji: String, clearsAt: Double?) {
    let trimmedText = text.trimmingCharacters(in: .whitespacesAndNewlines)
    let trimmedEmoji = emoji.trimmingCharacters(in: .whitespacesAndNewlines)
    let previous = userStatus
    let optimisticStatus = VectorUserStatus(
      presence: previous?.presence ?? .online,
      customText: trimmedText.isEmpty ? nil : trimmedText,
      customEmoji: trimmedEmoji.isEmpty ? nil : trimmedEmoji,
      clearsAt: clearsAt,
      updatedAt: Date().timeIntervalSince1970 * 1000
    )
    let token = beginOptimisticUserStatus(
      optimisticStatus,
      pendingPresence: nil,
      confirmationMode: .fullStatus
    )

    Task {
      do {
        try await repository.setCustomStatus(
          text: trimmedText.isEmpty ? nil : trimmedText,
          emoji: trimmedEmoji.isEmpty ? nil : trimmedEmoji,
          clearsAt: clearsAt
        )
        await MainActor.run {
          self.finishUserStatusMutation(token: token)
        }
      } catch {
        await MainActor.run {
          self.failUserStatusMutation(token: token, previous: previous, error: error)
        }
      }
    }
  }

  public func clearCustomStatus() {
    let previous = userStatus
    let optimisticStatus = VectorUserStatus(
      presence: previous?.presence ?? .online,
      updatedAt: Date().timeIntervalSince1970 * 1000
    )
    let token = beginOptimisticUserStatus(
      optimisticStatus,
      pendingPresence: nil,
      confirmationMode: .fullStatus
    )

    Task {
      do {
        try await repository.clearCustomStatus()
        await MainActor.run {
          self.finishUserStatusMutation(token: token)
        }
      } catch {
        await MainActor.run {
          self.failUserStatusMutation(token: token, previous: previous, error: error)
        }
      }
    }
  }

  private func beginOptimisticUserStatus(
    _ status: VectorUserStatus,
    pendingPresence: VectorPresenceStatus?,
    confirmationMode: OptimisticUserStatusGuard.ConfirmationMode
  ) -> Int {
    userStatusMutationSequence += 1
    let token = userStatusMutationSequence
    optimisticUserStatusGuard = OptimisticUserStatusGuard(
      token: token,
      status: status,
      confirmationMode: confirmationMode
    )
    self.pendingPresence = pendingPresence
    isUpdatingUserStatus = true
    applyDisplayedUserStatus(status)
    return token
  }

  private func finishUserStatusMutation(token: Int) {
    guard optimisticUserStatusGuard?.token == token else {
      return
    }

    pendingPresence = nil
    isUpdatingUserStatus = false

    Task { [weak self] in
      try? await Task.sleep(nanoseconds: 5_000_000_000)
      await MainActor.run {
        guard self?.optimisticUserStatusGuard?.token == token else {
          return
        }
        self?.optimisticUserStatusGuard = nil
      }
    }
  }

  private func failUserStatusMutation(token: Int, previous: VectorUserStatus?, error: Error) {
    guard optimisticUserStatusGuard?.token == token else {
      return
    }

    optimisticUserStatusGuard = nil
    pendingPresence = nil
    isUpdatingUserStatus = false
    applyDisplayedUserStatus(previous)
    settingsErrorMessage = error.localizedDescription
  }

  private func applySubscribedUserStatus(_ status: VectorUserStatus?) {
    if let guardedStatus = optimisticUserStatusGuard {
      if userStatus(status, matches: guardedStatus) {
        optimisticUserStatusGuard = nil
        pendingPresence = nil
        isUpdatingUserStatus = false
      } else {
        return
      }
    }

    applyDisplayedUserStatus(status)
  }

  private func applyDisplayedUserStatus(_ status: VectorUserStatus?) {
    if userStatus != status {
      userStatus = status
    }
    syncCurrentUser()
  }

  private func userStatus(_ lhs: VectorUserStatus?, matches guardedStatus: OptimisticUserStatusGuard) -> Bool {
    guard let lhs else {
      return false
    }

    let rhs = guardedStatus.status
    if guardedStatus.confirmationMode == .presence {
      return lhs.presence == rhs.presence
    }

    return lhs.presence == rhs.presence
      && normalizedStatusText(lhs.customText) == normalizedStatusText(rhs.customText)
      && normalizedStatusText(lhs.customEmoji) == normalizedStatusText(rhs.customEmoji)
      && lhs.clearsAt == rhs.clearsAt
  }

  private func normalizedStatusText(_ value: String?) -> String {
    value?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
  }

  public func setPushEnabled(for category: VectorNotificationCategory, isEnabled: Bool) {
    let previous = notificationPreferences
    let existing = notificationPreference(for: category)
    let nextPreference = VectorNotificationPreference(
      category: existing.category,
      inAppEnabled: existing.inAppEnabled,
      emailEnabled: existing.emailEnabled,
      pushEnabled: isEnabled
    )
    notificationPreferences = mergedNotificationPreferences(replacing: [nextPreference])

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

  public func setPushEnabled(for categories: [VectorNotificationCategory], isEnabled: Bool) {
    configurePushPreferences(
      enabledCategories: isEnabled ? Set(categories) : [],
      disabledCategories: isEnabled ? [] : Set(categories)
    )
  }

  public func configurePushPreferences(
    enabledCategories: Set<VectorNotificationCategory>,
    disabledCategories: Set<VectorNotificationCategory>
  ) {
    let categories = enabledCategories.union(disabledCategories)
    guard !categories.isEmpty else {
      return
    }
    let previous = notificationPreferences
    let nextPreferences = categories.map {
      let existing = notificationPreference(for: $0)
      return VectorNotificationPreference(
        category: existing.category,
        inAppEnabled: existing.inAppEnabled,
        emailEnabled: existing.emailEnabled,
        pushEnabled: enabledCategories.contains($0)
      )
    }
    notificationPreferences = mergedNotificationPreferences(replacing: nextPreferences)

    Task {
      do {
        for preference in nextPreferences {
          try await repository.updateNotificationPreference(preference)
        }
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

  public func updateDocument(documentId: VectorID, title: String, content: String) async throws {
    let trimmedTitle = title.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmedTitle.isEmpty else {
      throw VectorMobileError.validation("Title is required.")
    }

    let previousDocuments = documents
    let previousDocumentCache = documentCache
    let previousDocumentPages = documentPages
    let previousSelectedDocument = selectedDocument
    let nextDocument = (selectedDocument ?? currentDocument(documentId))?.with(title: trimmedTitle, content: content)
    if let nextDocument {
      updateDocumentCache(nextDocument)
      selectedDocument = nextDocument
    }

    do {
      try await repository.updateDocument(documentId: documentId, title: trimmedTitle, content: content)
    } catch {
      documents = previousDocuments
      documentCache = previousDocumentCache
      documentPages = previousDocumentPages
      selectedDocument = previousSelectedDocument
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

    let optimisticId = "optimistic-\(UUID().uuidString)"
    pendingComments[optimisticId] = VectorComment(
      id: optimisticId,
      body: body,
      author: currentUser ?? optimisticAuthenticatedUser,
      parentId: parentId,
      creationTime: Date().timeIntervalSince1970 * 1000
    )
    applyCommentSnapshot()

    Task { @MainActor [weak self] in
      guard let self else {
        return
      }

      do {
        let serverId = try await repository.addComment(issueId: issueId, body: trimmedBody, parentId: parentId)
        guard selectedIssue?.id == issueId else {
          pendingComments.removeValue(forKey: optimisticId)
          return
        }

        let subscribedIds = Set(subscribedComments.map(\.id))
        if subscribedIds.contains(serverId) {
          pendingComments.removeValue(forKey: optimisticId)
        } else if let pending = pendingComments.removeValue(forKey: optimisticId) {
          pendingComments[serverId] = pending.withId(serverId)
        }
        applyCommentSnapshot()
      } catch {
        pendingComments.removeValue(forKey: optimisticId)
        applyCommentSnapshot()
        errorMessage = error.localizedDescription
      }
    }
  }

  public func createIssue(
    title: String,
    description: String?,
    project: VectorProject?,
    team: VectorTeam?,
    state: VectorState?,
    priority: VectorPriority?,
    assigneeIds: [VectorID]
  ) async throws -> VectorCreateIssueResult {
    let trimmedTitle = title.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmedTitle.isEmpty else {
      throw VectorMobileError.validation("Title is required.")
    }

    let trimmedDescription = description?.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty
    let result = try await repository.createIssue(
      orgSlug: configuration.orgSlug,
      title: trimmedTitle,
      description: trimmedDescription,
      projectId: project?.id,
      teamId: nil,
      stateId: state?.id,
      priorityId: priority?.id,
      assigneeIds: assigneeIds
    )
    if let team, team.id != project?.teamId {
      do {
        try await repository.changeTeam(issueId: result.issueId, teamId: team.id)
      } catch {
        settingsErrorMessage = "Issue \(result.key) was created, but the team could not be changed."
      }
    }
    return result
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

  public func openWebURL(for document: VectorDocument) -> URL {
    configuration.webURL(path: "/\(configuration.orgSlug)/documents/\(document.id)")
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

  public var canLoadMoreDocuments: Bool {
    canLoadMore(documentPagination)
  }

  public var isLoadingMoreDocuments: Bool {
    documentPagination.isLoadingMore
  }

  public var canLoadMoreInboxNotifications: Bool {
    canLoadMore(inboxNotificationPagination)
  }

  public var isLoadingMoreInboxNotifications: Bool {
    inboxNotificationPagination.isLoadingMore
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

  public func loadMoreDocuments() {
    guard let cursor = nextCursor(documentPagination) else {
      return
    }
    subscribeToDocumentPage(cursor: cursor)
  }

  public func loadMoreInboxNotifications() {
    guard let cursor = nextCursor(inboxNotificationPagination) else {
      return
    }
    subscribeToInboxNotificationPage(cursor: cursor)
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

  private func subscribeToDocumentPage(cursor: String?) {
    let key = pageKey(cursor)
    guard documentListCancellables[key] == nil else {
      return
    }

    markLoading(cursor: cursor, pagination: &documentPagination)
    documentListCancellables[key] = repository
      .documentsPage(orgSlug: configuration.orgSlug, pageSize: pageSize, cursor: cursor)
      .receive(on: DispatchQueue.main)
      .sink(
        receiveCompletion: { [weak self, key] completion in
          self?.handlePageCompletion(completion, key: key, active: true) {
            self?.documentListCancellables[key] = nil
            self?.documentPagination.isLoadingMore = false
          }
        },
        receiveValue: { [weak self, key] page in
          guard let self else { return }
          documentPages[key] = page.page
          appendPageKey(key, to: &documentPageOrder)
          updatePagination(page.nextCursor, isDone: page.isDone, key: key, order: documentPageOrder, state: &documentPagination)
          rebuildDocuments()
        }
      )
  }

  private func subscribeToInboxNotificationPage(cursor: String?) {
    let key = pageKey(cursor)
    guard inboxNotificationCancellables[key] == nil else {
      return
    }

    markLoading(cursor: cursor, pagination: &inboxNotificationPagination)
    inboxNotificationCancellables[key] = repository
      .inboxNotificationsPage(pageSize: pageSize, cursor: cursor)
      .receive(on: DispatchQueue.main)
      .sink(
        receiveCompletion: { [weak self, key] completion in
          self?.handlePageCompletion(completion, key: key, active: true) {
            self?.inboxNotificationCancellables[key] = nil
            self?.inboxNotificationPagination.isLoadingMore = false
          }
        },
        receiveValue: { [weak self, key] page in
          guard let self else { return }
          inboxNotificationPages[key] = page.page
          appendPageKey(key, to: &inboxNotificationPageOrder)
          updatePagination(page.nextCursor, isDone: page.isDone, key: key, order: inboxNotificationPageOrder, state: &inboxNotificationPagination)
          rebuildInboxNotifications()
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

  private func rebuildDocuments() {
    documentCache = uniqueItems(orderedPages(documentPages, order: documentPageOrder), id: \.id)
    documents = documentCache
  }

  private func rebuildInboxNotifications() {
    inboxNotificationCache = uniqueItems(orderedPages(inboxNotificationPages, order: inboxNotificationPageOrder), id: \.id)
    inboxNotifications = inboxNotificationCache
  }

  private func rebuildInboxActivity() {
    inboxActivityCache = uniqueItems(orderedPages(inboxActivityPages, order: inboxActivityPageOrder), id: \.id)
    inboxActivity = inboxActivityCache
  }

  private func applyCommentSnapshot() {
    let subscribedIds = Set(subscribedComments.map(\.id))
    pendingComments = pendingComments.filter { !subscribedIds.contains($0.key) }
    comments = uniqueItems(
      (subscribedComments + pendingComments.values).sorted { lhs, rhs in
        lhs.creationTime < rhs.creationTime
      },
      id: \.id
    )
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

  private func currentDocument(_ documentId: VectorID) -> VectorDocument? {
    selectedDocument?.id == documentId ? selectedDocument : documents.first { $0.id == documentId }
  }

  private func notificationPreference(for category: VectorNotificationCategory) -> VectorNotificationPreference {
    notificationPreferences.first { $0.category == category } ?? defaultNotificationPreference(for: category)
  }

  private func mergedNotificationPreferences(
    replacing replacements: [VectorNotificationPreference]
  ) -> [VectorNotificationPreference] {
    var byCategory = Dictionary(uniqueKeysWithValues: notificationPreferences.map { ($0.category, $0) })
    for preference in replacements {
      byCategory[preference.category] = preference
    }
    return VectorNotificationCategory.allCases.compactMap { byCategory[$0] }
  }

  private func defaultNotificationPreference(for category: VectorNotificationCategory) -> VectorNotificationPreference {
    switch category {
    case .invites:
      VectorNotificationPreference(category: category, inAppEnabled: true, emailEnabled: true, pushEnabled: false)
    case .assignments, .mentions, .requests, .handoffs, .reviews:
      VectorNotificationPreference(category: category, inAppEnabled: true, emailEnabled: true, pushEnabled: true)
    case .comments, .workSessions, .attention, .reminders, .github:
      VectorNotificationPreference(category: category, inAppEnabled: true, emailEnabled: false, pushEnabled: true)
    case .teamStatusChanges:
      VectorNotificationPreference(category: category, inAppEnabled: true, emailEnabled: false, pushEnabled: false)
    case .unknown:
      VectorNotificationPreference(category: category, inAppEnabled: true, emailEnabled: false, pushEnabled: false)
    }
  }

  private func syncCurrentUser() {
    guard let authenticatedUser else {
      currentUser = nil
      return
    }

    let workspaceUser = workspaceOptions?.members.first { member in
      if let userId = member.userId, let sessionUserId = authenticatedUser.id, userId == sessionUserId {
        return true
      }
      if let email = member.email,
        let sessionEmail = authenticatedUser.email,
        email.caseInsensitiveCompare(sessionEmail) == .orderedSame
      {
        return true
      }
      return false
    }?.user

    currentUser = VectorUser(
      id: workspaceUser?.id ?? authenticatedUser.id ?? authenticatedUser.email ?? "current-user",
      name: workspaceUser?.name ?? authenticatedUser.displayName,
      email: workspaceUser?.email ?? authenticatedUser.email,
      image: workspaceUser?.image ?? authenticatedUser.image,
      status: userStatus ?? workspaceUser?.status
    )
  }

  private var optimisticAuthenticatedUser: VectorUser? {
    guard let authenticatedUser else {
      return nil
    }

    return VectorUser(
      id: authenticatedUser.id ?? authenticatedUser.email ?? "current-user",
      name: authenticatedUser.displayName,
      email: authenticatedUser.email,
      image: authenticatedUser.image,
      status: userStatus
    )
  }

  private func updateIssue(_ issueId: VectorID, transform: (VectorIssueRow) -> VectorIssueRow) {
    issues = issues.map { issue in
      issue.id == issueId ? transform(issue) : issue
    }
    if let selectedIssue, selectedIssue.id == issueId {
      self.selectedIssue = transform(selectedIssue)
    }
  }

  private func updateDocumentCache(_ document: VectorDocument) {
    documents = documents.map { existing in
      existing.id == document.id ? document : existing
    }
    documentCache = documentCache.map { existing in
      existing.id == document.id ? document : existing
    }
    for key in documentPages.keys {
      documentPages[key] = documentPages[key]?.map { existing in
        existing.id == document.id ? document : existing
      }
    }
  }
}

private extension String {
  var nilIfEmpty: String? {
    isEmpty ? nil : self
  }
}

private extension VectorDocument {
  func with(title: String, content: String?) -> VectorDocument {
    VectorDocument(
      id: id,
      title: title,
      content: content,
      icon: icon,
      color: color,
      team: team,
      project: project,
      author: author,
      visibility: visibility,
      creationTime: creationTime,
      lastEditedAt: Date().timeIntervalSince1970 * 1000
    )
  }
}

private extension VectorComment {
  func withId(_ id: VectorID) -> VectorComment {
    VectorComment(
      id: id,
      body: body,
      author: author,
      parentId: parentId,
      creationTime: creationTime
    )
  }
}
