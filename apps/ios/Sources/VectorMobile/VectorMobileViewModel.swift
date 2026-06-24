import Combine
import Foundation

@MainActor
public final class VectorMobileViewModel: ObservableObject {
  @Published public private(set) var issues: [VectorIssueRow] = []
  @Published public private(set) var projects: [VectorProject] = []
  @Published public private(set) var teams: [VectorTeam] = []
  @Published public private(set) var comments: [VectorComment] = []
  @Published public private(set) var assignments: [VectorIssueAssignment] = []
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

    loadSettings()
  }

  public func loadIssueSupport(issueId: VectorID) {
    issueSupportCancellables.removeAll()
    comments = []
    assignments = []

    repository.comments(issueId: issueId)
      .receive(on: DispatchQueue.main)
      .sink(
        receiveCompletion: { _ in },
        receiveValue: { [weak self] comments in
          self?.comments = comments
        }
      )
      .store(in: &issueSupportCancellables)

    repository.assignments(issueId: issueId)
      .receive(on: DispatchQueue.main)
      .sink(
        receiveCompletion: { _ in },
        receiveValue: { [weak self] assignments in
          self?.assignments = assignments
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
}
