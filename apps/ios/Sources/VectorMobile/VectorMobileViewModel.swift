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
  private var listCancellables = Set<AnyCancellable>()
  private var issueSupportCancellables = Set<AnyCancellable>()
  private var settingsCancellables = Set<AnyCancellable>()

  public init(
    configuration: VectorMobileConfiguration = .demo,
    repository: VectorMobileRepository = MockVectorRepository()
  ) {
    self.configuration = configuration
    self.repository = repository
    refresh()
  }

  public func refresh() {
    isLoading = true
    errorMessage = nil
    listCancellables.removeAll()

    repository.issues(orgSlug: configuration.orgSlug, scope: issueScope, pageSize: 50)
      .receive(on: DispatchQueue.main)
      .sink(
        receiveCompletion: { [weak self] completion in
          self?.handleCompletion(completion)
        },
        receiveValue: { [weak self] issues in
          self?.issues = issues
          self?.isLoading = false
        }
      )
      .store(in: &listCancellables)

    repository.projects(orgSlug: configuration.orgSlug, scope: projectScope, pageSize: 50)
      .receive(on: DispatchQueue.main)
      .sink(
        receiveCompletion: { _ in },
        receiveValue: { [weak self] projects in
          self?.projects = projects
        }
      )
      .store(in: &listCancellables)

    repository.teams(orgSlug: configuration.orgSlug, scope: projectScope, pageSize: 50)
      .receive(on: DispatchQueue.main)
      .sink(
        receiveCompletion: { _ in },
        receiveValue: { [weak self] teams in
          self?.teams = teams
        }
      )
      .store(in: &listCancellables)

    repository.workspaceOptions(orgSlug: configuration.orgSlug)
      .receive(on: DispatchQueue.main)
      .sink(
        receiveCompletion: { _ in },
        receiveValue: { [weak self] options in
          self?.workspaceOptions = options
        }
      )
      .store(in: &listCancellables)

    loadSettings()
  }

  public func loadIssueSupport(issue: VectorIssueRow) {
    issueSupportCancellables.removeAll()
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
    settingsErrorMessage = nil
    settingsCancellables.removeAll()

    repository.userStatus()
      .receive(on: DispatchQueue.main)
      .sink(
        receiveCompletion: { [weak self] completion in
          if case let .failure(error) = completion {
            self?.settingsErrorMessage = error.localizedDescription
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
        receiveCompletion: { _ in },
        receiveValue: { [weak self] preferences in
          self?.notificationPreferences = preferences
        }
      )
      .store(in: &settingsCancellables)

    repository.mobilePushTokens()
      .receive(on: DispatchQueue.main)
      .sink(
        receiveCompletion: { _ in },
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

  public func addIssueComment(issueId: VectorID, body: String) async throws {
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
        creationTime: Date().timeIntervalSince1970 * 1000
      )
    )

    do {
      try await repository.addComment(issueId: issueId, body: trimmedBody)
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

  private func handleCompletion(_ completion: Subscribers.Completion<Error>) {
    if case let .failure(error) = completion {
      errorMessage = error.localizedDescription
      isLoading = false
    }
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
