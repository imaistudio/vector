import Combine
@preconcurrency import ConvexMobile
import Foundation

struct VectorMutationResponse: Decodable {}

public enum VectorConvexFunctions {
  public static let getOrganizations = "users:getOrganizations"
  public static let listIssuesPage = "issues/queries:listIssuesPage"
  public static let getIssueByKey = "issues/queries:getByKey"
  public static let listComments = "issues/queries:listComments"
  public static let getAssignments = "issues/queries:getAssignments"
  public static let createIssue = "issues/mutations:create"
  public static let addComment = "issues/mutations:addComment"
  public static let changeWorkflowState = "issues/mutations:changeWorkflowState"
  public static let changePriority = "issues/mutations:changePriority"
  public static let updateAssignees = "issues/mutations:updateAssignees"
  public static let updateTitle = "issues/mutations:updateTitle"
  public static let updateDescription = "issues/mutations:updateDescription"
  public static let changeProject = "issues/mutations:changeProject"
  public static let changeTeam = "issues/mutations:changeTeam"
  public static let changeVisibility = "issues/mutations:changeVisibility"
  public static let listProjectActivity = "activities/queries:listProjectActivity"
  public static let listTeamActivity = "activities/queries:listTeamActivity"
  public static let listIssueActivity = "activities/queries:listIssueActivity"
  public static let listOrgActivity = "activities/queries:listOrgActivity"
  public static let listProjectsPage = "projects/queries:listPage"
  public static let getProjectByKey = "projects/queries:getByKey"
  public static let listTeamsPage = "teams/queries:listPage"
  public static let getTeamByKey = "teams/queries:getByKey"
  public static let listDocumentsPage = "documents/queries:listPage"
  public static let getWorkspaceOptions = "organizations/queries:getWorkspaceOptions"
  public static let getCurrentUserStatus = "status:getCurrentUserStatus"
  public static let setPresence = "status:setPresence"
  public static let setCustomStatus = "status:setCustomStatus"
  public static let clearCustomStatus = "status:clearCustomStatus"
  public static let listInboxNotifications = "notifications/queries:listInbox"
  public static let getNotificationPreferences = "notifications/queries:getPreferences"
  public static let listMobilePushTokens = "notifications/queries:listMobilePushTokens"
  public static let updateNotificationPreferences = "notifications/mutations:updatePreferences"
  public static let upsertMobilePushToken = "notifications/mutations:upsertMobilePushToken"
  public static let removeMobilePushToken = "notifications/mutations:removeMobilePushToken"
}

enum VectorConvexArguments {
  static func pagination(numItems: Int, cursor: String? = nil) -> [String: ConvexEncodable?] {
    [
      "numItems": Double(numItems),
      "cursor": cursor,
    ]
  }

  static func changeWorkflowState(issueId: VectorID, stateId: VectorID) -> [String: ConvexEncodable?] {
    [
      "issueId": issueId,
      "stateId": stateId,
    ]
  }

  static func changePriority(issueId: VectorID, priorityId: VectorID) -> [String: ConvexEncodable?] {
    [
      "issueId": issueId,
      "priorityId": priorityId,
    ]
  }

  static func updateAssignees(issueId: VectorID, assigneeIds: [VectorID]) -> [String: ConvexEncodable?] {
    [
      "issueId": issueId,
      "assigneeIds": assigneeIds.map { $0 as ConvexEncodable? },
    ]
  }

  static func changeProject(issueId: VectorID, projectId: VectorID?) -> [String: ConvexEncodable?] {
    [
      "issueId": issueId,
      "projectId": projectId,
    ]
  }

  static func changeTeam(issueId: VectorID, teamId: VectorID?) -> [String: ConvexEncodable?] {
    [
      "issueId": issueId,
      "teamId": teamId,
    ]
  }
}

public enum VectorIssueScope: String, CaseIterable, Identifiable {
  case mine
  case related
  case all

  public var id: String { rawValue }

  public var label: String {
    switch self {
    case .mine: "Mine"
    case .related: "Related"
    case .all: "All"
    }
  }
}

public enum VectorProjectScope: String, CaseIterable, Identifiable {
  case mine
  case all

  public var id: String { rawValue }

  public var label: String {
    switch self {
    case .mine: "Mine"
    case .all: "All"
    }
  }
}

public enum VectorIssueLayoutMode: String, CaseIterable, Identifiable {
  case list
  case board
  case timeline

  public var id: String { rawValue }

  public var label: String {
    switch self {
    case .list: "List"
    case .board: "Board"
    case .timeline: "Timeline"
    }
  }
}

@MainActor
public protocol VectorMobileRepository {
  func issuesPage(orgSlug: String, scope: VectorIssueScope, pageSize: Int, cursor: String?) -> AnyPublisher<VectorPaginatedPage<VectorIssueRow>, Error>
  func issue(orgSlug: String, key: String) -> AnyPublisher<VectorIssueRow?, Error>
  func projectsPage(orgSlug: String, scope: VectorProjectScope, pageSize: Int, cursor: String?) -> AnyPublisher<VectorPaginatedPage<VectorProject>, Error>
  func teamsPage(orgSlug: String, scope: VectorProjectScope, pageSize: Int, cursor: String?) -> AnyPublisher<VectorPaginatedPage<VectorTeam>, Error>
  func documentsPage(orgSlug: String, pageSize: Int, cursor: String?) -> AnyPublisher<VectorPaginatedPage<VectorDocument>, Error>
  func workspaceOptions(orgSlug: String) -> AnyPublisher<VectorWorkspaceOptions, Error>
  func comments(issueId: VectorID) -> AnyPublisher<[VectorComment], Error>
  func assignments(issueId: VectorID) -> AnyPublisher<[VectorIssueAssignment], Error>
  func issueActivity(issueId: VectorID) -> AnyPublisher<[VectorActivityItem], Error>
  func inboxActivityPage(orgSlug: String, pageSize: Int, cursor: String?) -> AnyPublisher<VectorOrgActivityPage, Error>
  func inboxNotificationsPage(pageSize: Int, cursor: String?) -> AnyPublisher<VectorPaginatedPage<VectorInboxNotification>, Error>
  func userStatus() -> AnyPublisher<VectorUserStatus?, Error>
  func notificationPreferences() -> AnyPublisher<[VectorNotificationPreference], Error>
  func mobilePushTokens() -> AnyPublisher<[VectorMobilePushTokenRegistration], Error>
  func setPresence(_ presence: VectorPresenceStatus) async throws
  func setCustomStatus(text: String?, emoji: String?, clearsAt: Double?) async throws
  func clearCustomStatus() async throws
  func updateNotificationPreference(_ preference: VectorNotificationPreference) async throws
  func upsertMobilePushToken(_ token: VectorPushDeviceToken, bundleId: String?, deviceLabel: String?) async throws
  func removeMobilePushToken(_ token: VectorPushDeviceToken) async throws
  func updateTitle(issueId: VectorID, title: String) async throws
  func updateDescription(issueId: VectorID, description: String?) async throws
  func changeWorkflowState(issueId: VectorID, stateId: VectorID) async throws
  func changePriority(issueId: VectorID, priorityId: VectorID) async throws
  func updateAssignees(issueId: VectorID, assigneeIds: [VectorID]) async throws
  func changeProject(issueId: VectorID, projectId: VectorID?) async throws
  func changeTeam(issueId: VectorID, teamId: VectorID?) async throws
  func changeVisibility(issueId: VectorID, visibility: String) async throws
  func addComment(issueId: VectorID, body: String, parentId: VectorID?) async throws
  func createIssue(
    orgSlug: String,
    title: String,
    description: String?,
    projectId: VectorID?,
    teamId _: VectorID?,
    stateId: VectorID?,
    priorityId: VectorID?,
    assigneeIds: [VectorID]
  ) async throws -> VectorCreateIssueResult
}

@MainActor
public final class ConvexVectorRepository: VectorMobileRepository {
  // ConvexClient is owned by the app process and the SDK exposes async/thread-safe entry points.
  private nonisolated(unsafe) let client: ConvexClient

  public init(client: ConvexClient) {
    self.client = client
  }

  public convenience init(configuration: VectorMobileConfiguration) {
    self.init(client: ConvexClient(deploymentUrl: configuration.convexDeploymentURL.absoluteString))
  }

  public func issuesPage(
    orgSlug: String,
    scope: VectorIssueScope = .mine,
    pageSize: Int = 30,
    cursor: String? = nil
  ) -> AnyPublisher<VectorPaginatedPage<VectorIssueRow>, Error> {
    let args: [String: ConvexEncodable?] = [
      "orgSlug": orgSlug,
      "scope": scope.rawValue,
      "paginationOpts": VectorConvexArguments.pagination(numItems: pageSize, cursor: cursor),
    ]

    return client
      .subscribe(to: VectorConvexFunctions.listIssuesPage, with: args, yielding: VectorPaginatedPage<VectorIssueRow>.self)
      .mapError { $0 as Error }
      .eraseToAnyPublisher()
  }

  public func issue(orgSlug: String, key: String) -> AnyPublisher<VectorIssueRow?, Error> {
    client
      .subscribe(
        to: VectorConvexFunctions.getIssueByKey,
        with: [
          "orgSlug": orgSlug,
          "issueKey": key,
        ],
        yielding: VectorIssueRow?.self
      )
      .mapError { $0 as Error }
      .eraseToAnyPublisher()
  }

  public func projectsPage(
    orgSlug: String,
    scope: VectorProjectScope = .mine,
    pageSize: Int = 30,
    cursor: String? = nil
  ) -> AnyPublisher<VectorPaginatedPage<VectorProject>, Error> {
    let args: [String: ConvexEncodable?] = [
      "orgSlug": orgSlug,
      "scope": scope.rawValue,
      "paginationOpts": VectorConvexArguments.pagination(numItems: pageSize, cursor: cursor),
    ]

    return client
      .subscribe(to: VectorConvexFunctions.listProjectsPage, with: args, yielding: VectorPaginatedPage<VectorProject>.self)
      .mapError { $0 as Error }
      .eraseToAnyPublisher()
  }

  public func teamsPage(
    orgSlug: String,
    scope: VectorProjectScope = .mine,
    pageSize: Int = 30,
    cursor: String? = nil
  ) -> AnyPublisher<VectorPaginatedPage<VectorTeam>, Error> {
    let args: [String: ConvexEncodable?] = [
      "orgSlug": orgSlug,
      "scope": scope.rawValue,
      "paginationOpts": VectorConvexArguments.pagination(numItems: pageSize, cursor: cursor),
    ]

    return client
      .subscribe(to: VectorConvexFunctions.listTeamsPage, with: args, yielding: VectorPaginatedPage<VectorTeam>.self)
      .mapError { $0 as Error }
      .eraseToAnyPublisher()
  }

  public func documentsPage(
    orgSlug: String,
    pageSize: Int = 30,
    cursor: String? = nil
  ) -> AnyPublisher<VectorPaginatedPage<VectorDocument>, Error> {
    let args: [String: ConvexEncodable?] = [
      "orgSlug": orgSlug,
      "scope": "all",
      "paginationOpts": VectorConvexArguments.pagination(numItems: pageSize, cursor: cursor),
    ]

    return client
      .subscribe(to: VectorConvexFunctions.listDocumentsPage, with: args, yielding: VectorPaginatedPage<VectorDocument>.self)
      .mapError { $0 as Error }
      .eraseToAnyPublisher()
  }

  public func workspaceOptions(orgSlug: String) -> AnyPublisher<VectorWorkspaceOptions, Error> {
    client
      .subscribe(
        to: VectorConvexFunctions.getWorkspaceOptions,
        with: ["orgSlug": orgSlug],
        yielding: VectorWorkspaceOptions.self
      )
      .mapError { $0 as Error }
      .eraseToAnyPublisher()
  }

  public func comments(issueId: VectorID) -> AnyPublisher<[VectorComment], Error> {
    client
      .subscribe(to: VectorConvexFunctions.listComments, with: ["issueId": issueId], yielding: [VectorComment].self)
      .mapError { $0 as Error }
      .eraseToAnyPublisher()
  }

  public func assignments(issueId: VectorID) -> AnyPublisher<[VectorIssueAssignment], Error> {
    client
      .subscribe(to: VectorConvexFunctions.getAssignments, with: ["issueId": issueId], yielding: [VectorIssueAssignment].self)
      .mapError { $0 as Error }
      .eraseToAnyPublisher()
  }

  public func issueActivity(issueId: VectorID) -> AnyPublisher<[VectorActivityItem], Error> {
    let args: [String: ConvexEncodable?] = [
      "issueId": issueId,
      "paginationOpts": VectorConvexArguments.pagination(numItems: 30),
    ]

    return client
      .subscribe(to: VectorConvexFunctions.listIssueActivity, with: args, yielding: VectorPaginatedPage<VectorActivityItem>.self)
      .map(\.page)
      .mapError { $0 as Error }
      .eraseToAnyPublisher()
  }

  public func inboxActivityPage(orgSlug: String, pageSize: Int, cursor: String? = nil) -> AnyPublisher<VectorOrgActivityPage, Error> {
    var args: [String: ConvexEncodable?] = [
      "orgSlug": orgSlug,
      "limit": Double(pageSize),
    ]
    if let cursor {
      args["cursor"] = cursor
    }

    return client
      .subscribe(to: VectorConvexFunctions.listOrgActivity, with: args, yielding: VectorOrgActivityPage.self)
      .mapError { $0 as Error }
      .eraseToAnyPublisher()
  }

  public func inboxNotificationsPage(pageSize: Int, cursor: String? = nil) -> AnyPublisher<VectorPaginatedPage<VectorInboxNotification>, Error> {
    let args: [String: ConvexEncodable?] = [
      "filter": "all",
      "paginationOpts": VectorConvexArguments.pagination(numItems: pageSize, cursor: cursor),
    ]

    return client
      .subscribe(to: VectorConvexFunctions.listInboxNotifications, with: args, yielding: VectorPaginatedPage<VectorInboxNotification>.self)
      .mapError { $0 as Error }
      .eraseToAnyPublisher()
  }

  public func userStatus() -> AnyPublisher<VectorUserStatus?, Error> {
    client
      .subscribe(to: VectorConvexFunctions.getCurrentUserStatus, yielding: VectorUserStatus?.self)
      .mapError { $0 as Error }
      .eraseToAnyPublisher()
  }

  public func notificationPreferences() -> AnyPublisher<[VectorNotificationPreference], Error> {
    client
      .subscribe(to: VectorConvexFunctions.getNotificationPreferences, yielding: [VectorNotificationPreference].self)
      .mapError { $0 as Error }
      .eraseToAnyPublisher()
  }

  public func mobilePushTokens() -> AnyPublisher<[VectorMobilePushTokenRegistration], Error> {
    client
      .subscribe(to: VectorConvexFunctions.listMobilePushTokens, yielding: [VectorMobilePushTokenRegistration].self)
      .mapError { $0 as Error }
      .eraseToAnyPublisher()
  }

  public func setPresence(_ presence: VectorPresenceStatus) async throws {
    let _: VectorMutationResponse = try await client.mutation(
      VectorConvexFunctions.setPresence,
      with: ["presence": presence.rawValue]
    )
  }

  public func setCustomStatus(text: String?, emoji: String?, clearsAt: Double?) async throws {
    var args: [String: ConvexEncodable?] = [:]
    if let text {
      args["customText"] = text
    }
    if let emoji {
      args["customEmoji"] = emoji
    }
    if let clearsAt {
      args["clearsAt"] = clearsAt
    }

    let _: VectorMutationResponse = try await client.mutation(
      VectorConvexFunctions.setCustomStatus,
      with: args
    )
  }

  public func clearCustomStatus() async throws {
    let _: VectorMutationResponse = try await client.mutation(VectorConvexFunctions.clearCustomStatus)
  }

  public func updateNotificationPreference(_ preference: VectorNotificationPreference) async throws {
    let _: VectorMutationResponse = try await client.mutation(
      VectorConvexFunctions.updateNotificationPreferences,
      with: [
        "category": preference.category.rawValue,
        "inAppEnabled": preference.inAppEnabled,
        "emailEnabled": preference.emailEnabled,
        "pushEnabled": preference.pushEnabled,
      ]
    )
  }

  public func upsertMobilePushToken(_ token: VectorPushDeviceToken, bundleId: String?, deviceLabel: String?) async throws {
    var args: [String: ConvexEncodable?] = [
      "token": token.value,
      "environment": token.environment,
    ]
    if let bundleId {
      args["bundleId"] = bundleId
    }
    if let deviceLabel {
      args["deviceLabel"] = deviceLabel
    }

    let _: VectorMutationResponse = try await client.mutation(
      VectorConvexFunctions.upsertMobilePushToken,
      with: args
    )
  }

  public func removeMobilePushToken(_ token: VectorPushDeviceToken) async throws {
    let _: VectorMutationResponse = try await client.mutation(
      VectorConvexFunctions.removeMobilePushToken,
      with: [
        "token": token.value,
        "environment": token.environment,
      ]
    )
  }

  public func changeWorkflowState(issueId: VectorID, stateId: VectorID) async throws {
    let _: VectorMutationResponse = try await client.mutation(
      VectorConvexFunctions.changeWorkflowState,
      with: VectorConvexArguments.changeWorkflowState(issueId: issueId, stateId: stateId)
    )
  }

  public func changePriority(issueId: VectorID, priorityId: VectorID) async throws {
    let _: VectorMutationResponse = try await client.mutation(
      VectorConvexFunctions.changePriority,
      with: VectorConvexArguments.changePriority(issueId: issueId, priorityId: priorityId)
    )
  }

  public func updateAssignees(issueId: VectorID, assigneeIds: [VectorID]) async throws {
    let _: VectorMutationResponse = try await client.mutation(
      VectorConvexFunctions.updateAssignees,
      with: VectorConvexArguments.updateAssignees(issueId: issueId, assigneeIds: assigneeIds)
    )
  }

  public func changeProject(issueId: VectorID, projectId: VectorID?) async throws {
    let _: VectorMutationResponse = try await client.mutation(
      VectorConvexFunctions.changeProject,
      with: VectorConvexArguments.changeProject(issueId: issueId, projectId: projectId)
    )
  }

  public func changeTeam(issueId: VectorID, teamId: VectorID?) async throws {
    let _: VectorMutationResponse = try await client.mutation(
      VectorConvexFunctions.changeTeam,
      with: VectorConvexArguments.changeTeam(issueId: issueId, teamId: teamId)
    )
  }

  public func changeVisibility(issueId: VectorID, visibility: String) async throws {
    let _: VectorMutationResponse = try await client.mutation(
      VectorConvexFunctions.changeVisibility,
      with: [
        "issueId": issueId,
        "visibility": visibility,
      ]
    )
  }

  public func updateTitle(issueId: VectorID, title: String) async throws {
    let _: VectorMutationResponse = try await client.mutation(
      VectorConvexFunctions.updateTitle,
      with: [
        "issueId": issueId,
        "title": title,
      ]
    )
  }

  public func updateDescription(issueId: VectorID, description: String?) async throws {
    let _: VectorMutationResponse = try await client.mutation(
      VectorConvexFunctions.updateDescription,
      with: [
        "issueId": issueId,
        "description": description,
      ]
    )
  }

  public func addComment(issueId: VectorID, body: String, parentId: VectorID? = nil) async throws {
    var args: [String: ConvexEncodable?] = [
      "issueId": issueId,
      "body": body,
    ]
    if let parentId {
      args["parentId"] = parentId
    }

    let _: VectorMutationResponse = try await client.mutation(
      VectorConvexFunctions.addComment,
      with: args
    )
  }

  public func createIssue(
    orgSlug: String,
    title: String,
    description: String?,
    projectId: VectorID?,
    teamId: VectorID?,
    stateId: VectorID?,
    priorityId: VectorID?,
    assigneeIds: [VectorID]
  ) async throws -> VectorCreateIssueResult {
    var data: [String: ConvexEncodable?] = [
      "title": title,
    ]
    if let description {
      data["description"] = description
    }
    if let projectId {
      data["projectId"] = projectId
    }
    if let stateId {
      data["stateId"] = stateId
    }
    if let priorityId {
      data["priorityId"] = priorityId
    }
    if !assigneeIds.isEmpty {
      data["assigneeIds"] = assigneeIds.map { $0 as ConvexEncodable? }
    }

    return try await client.mutation(
      VectorConvexFunctions.createIssue,
      with: [
        "orgSlug": orgSlug,
        "data": data,
      ]
    )
  }
}

@MainActor
public final class MockVectorRepository: VectorMobileRepository {
  public init() {}

  public func issuesPage(
    orgSlug: String,
    scope: VectorIssueScope,
    pageSize: Int,
    cursor: String?
  ) -> AnyPublisher<VectorPaginatedPage<VectorIssueRow>, Error> {
    mockPage(VectorMockData.issues, pageSize: pageSize, cursor: cursor)
      .setFailureType(to: Error.self)
      .eraseToAnyPublisher()
  }

  public func issue(orgSlug: String, key: String) -> AnyPublisher<VectorIssueRow?, Error> {
    Just(VectorMockData.issues.first { $0.key == key })
      .setFailureType(to: Error.self)
      .eraseToAnyPublisher()
  }

  public func projectsPage(
    orgSlug: String,
    scope: VectorProjectScope,
    pageSize: Int,
    cursor: String?
  ) -> AnyPublisher<VectorPaginatedPage<VectorProject>, Error> {
    mockPage(VectorMockData.projects, pageSize: pageSize, cursor: cursor)
      .setFailureType(to: Error.self)
      .eraseToAnyPublisher()
  }

  public func teamsPage(
    orgSlug: String,
    scope: VectorProjectScope,
    pageSize: Int,
    cursor: String?
  ) -> AnyPublisher<VectorPaginatedPage<VectorTeam>, Error> {
    mockPage(VectorMockData.teams, pageSize: pageSize, cursor: cursor)
      .setFailureType(to: Error.self)
      .eraseToAnyPublisher()
  }

  public func documentsPage(orgSlug: String, pageSize: Int, cursor: String?) -> AnyPublisher<VectorPaginatedPage<VectorDocument>, Error> {
    mockPage(VectorMockData.documents, pageSize: pageSize, cursor: cursor)
      .setFailureType(to: Error.self)
      .eraseToAnyPublisher()
  }

  public func workspaceOptions(orgSlug: String) -> AnyPublisher<VectorWorkspaceOptions, Error> {
    Just(VectorMockData.workspaceOptions)
      .setFailureType(to: Error.self)
      .eraseToAnyPublisher()
  }

  public func comments(issueId: VectorID) -> AnyPublisher<[VectorComment], Error> {
    Just(VectorMockData.comments)
      .setFailureType(to: Error.self)
      .eraseToAnyPublisher()
  }

  public func assignments(issueId: VectorID) -> AnyPublisher<[VectorIssueAssignment], Error> {
    let assignments = VectorMockData.issues
      .filter { $0.id == issueId }
      .map {
        VectorIssueAssignment(
          id: "assignment-\($0.id)",
          assigneeId: $0.assigneeId,
          assigneeName: $0.assigneeName,
          assigneeEmail: $0.assigneeEmail,
          assigneeImage: $0.assigneeImage,
          stateId: $0.workflowStateId,
          stateName: $0.workflowStateName,
          stateIcon: $0.workflowStateIcon,
          stateColor: $0.workflowStateColor,
          stateType: $0.workflowStateType
        )
      }

    return Just(assignments)
      .setFailureType(to: Error.self)
      .eraseToAnyPublisher()
  }

  public func issueActivity(issueId: VectorID) -> AnyPublisher<[VectorActivityItem], Error> {
    Just(VectorMockData.activityItems)
      .setFailureType(to: Error.self)
      .eraseToAnyPublisher()
  }

  public func inboxActivityPage(orgSlug: String, pageSize: Int, cursor: String?) -> AnyPublisher<VectorOrgActivityPage, Error> {
    let start = min(cursor.flatMap(Int.init) ?? 0, VectorMockData.activityItems.count)
    let end = min(start + pageSize, VectorMockData.activityItems.count)
    let items = Array(VectorMockData.activityItems[start..<end])
    let nextCursor = end < VectorMockData.activityItems.count ? String(end) : nil

    return Just(VectorOrgActivityPage(items: items, nextCursor: nextCursor))
      .setFailureType(to: Error.self)
      .eraseToAnyPublisher()
  }

  public func inboxNotificationsPage(pageSize: Int, cursor: String?) -> AnyPublisher<VectorPaginatedPage<VectorInboxNotification>, Error> {
    mockPage(VectorMockData.inboxNotifications, pageSize: pageSize, cursor: cursor)
      .setFailureType(to: Error.self)
      .eraseToAnyPublisher()
  }

  public func userStatus() -> AnyPublisher<VectorUserStatus?, Error> {
    Just(VectorUserStatus(presence: .online, customText: "Building Vector iOS", customEmoji: "V", updatedAt: Date().timeIntervalSince1970 * 1000))
      .setFailureType(to: Error.self)
      .eraseToAnyPublisher()
  }

  public func notificationPreferences() -> AnyPublisher<[VectorNotificationPreference], Error> {
    Just([
      VectorNotificationPreference(category: .invites, inAppEnabled: true, emailEnabled: true, pushEnabled: false),
      VectorNotificationPreference(category: .assignments, inAppEnabled: true, emailEnabled: true, pushEnabled: true),
      VectorNotificationPreference(category: .mentions, inAppEnabled: true, emailEnabled: true, pushEnabled: true),
      VectorNotificationPreference(category: .comments, inAppEnabled: true, emailEnabled: false, pushEnabled: true),
      VectorNotificationPreference(category: .workSessions, inAppEnabled: true, emailEnabled: false, pushEnabled: true),
      VectorNotificationPreference(category: .teamStatusChanges, inAppEnabled: true, emailEnabled: false, pushEnabled: false),
    ])
    .setFailureType(to: Error.self)
    .eraseToAnyPublisher()
  }

  public func mobilePushTokens() -> AnyPublisher<[VectorMobilePushTokenRegistration], Error> {
    Just([])
      .setFailureType(to: Error.self)
      .eraseToAnyPublisher()
  }

  public func setPresence(_ presence: VectorPresenceStatus) async throws {}

  public func setCustomStatus(text: String?, emoji: String?, clearsAt: Double?) async throws {}

  public func clearCustomStatus() async throws {}

  public func updateNotificationPreference(_ preference: VectorNotificationPreference) async throws {}

  public func upsertMobilePushToken(_ token: VectorPushDeviceToken, bundleId: String?, deviceLabel: String?) async throws {}

  public func removeMobilePushToken(_ token: VectorPushDeviceToken) async throws {}

  public func updateTitle(issueId: VectorID, title: String) async throws {}

  public func updateDescription(issueId: VectorID, description: String?) async throws {}

  public func changeWorkflowState(issueId: VectorID, stateId: VectorID) async throws {}

  public func changePriority(issueId: VectorID, priorityId: VectorID) async throws {}

  public func updateAssignees(issueId: VectorID, assigneeIds: [VectorID]) async throws {}

  public func changeProject(issueId: VectorID, projectId: VectorID?) async throws {}

  public func changeTeam(issueId: VectorID, teamId: VectorID?) async throws {}

  public func changeVisibility(issueId: VectorID, visibility: String) async throws {}

  public func addComment(issueId: VectorID, body: String, parentId: VectorID? = nil) async throws {}

  public func createIssue(
    orgSlug: String,
    title: String,
    description: String?,
    projectId: VectorID?,
    teamId: VectorID?,
    stateId: VectorID?,
    priorityId: VectorID?,
    assigneeIds: [VectorID]
  ) async throws -> VectorCreateIssueResult {
    VectorCreateIssueResult(issueId: "mock-created-issue", key: "MOCK-1")
  }

  private func mockPage<Item: Decodable>(_ items: [Item], pageSize: Int, cursor: String?) -> Just<VectorPaginatedPage<Item>> {
    let start = min(cursor.flatMap(Int.init) ?? 0, items.count)
    let end = min(start + pageSize, items.count)
    let page = Array(items[start..<end])
    return Just(
      VectorPaginatedPage(
        page: page,
        continueCursor: end < items.count ? String(end) : "",
        isDone: end >= items.count
      )
    )
  }
}
