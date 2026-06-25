import Combine
import ConvexMobile
import XCTest
@testable import VectorMobile

final class VectorMobileTests: XCTestCase {
  func testFunctionNamesUseNestedConvexPathSyntax() {
    XCTAssertEqual(VectorConvexFunctions.getOrganizations, "users:getOrganizations")
    XCTAssertEqual(VectorConvexFunctions.listIssuesPage, "issues/queries:listIssuesPage")
    XCTAssertEqual(VectorConvexFunctions.getIssueByKey, "issues/queries:getByKey")
    XCTAssertEqual(VectorConvexFunctions.changeWorkflowState, "issues/mutations:changeWorkflowState")
    XCTAssertEqual(VectorConvexFunctions.updateTitle, "issues/mutations:updateTitle")
    XCTAssertEqual(VectorConvexFunctions.updateDescription, "issues/mutations:updateDescription")
    XCTAssertEqual(VectorConvexFunctions.changeProject, "issues/mutations:changeProject")
    XCTAssertEqual(VectorConvexFunctions.changeVisibility, "issues/mutations:changeVisibility")
    XCTAssertEqual(VectorConvexFunctions.getWorkspaceOptions, "organizations/queries:getWorkspaceOptions")
    XCTAssertEqual(VectorConvexFunctions.listProjectActivity, "activities/queries:listProjectActivity")
    XCTAssertEqual(VectorConvexFunctions.listOrgActivity, "activities/queries:listOrgActivity")
    XCTAssertEqual(VectorConvexFunctions.getCurrentUserStatus, "status:getCurrentUserStatus")
    XCTAssertEqual(VectorConvexFunctions.upsertMobilePushToken, "notifications/mutations:upsertMobilePushToken")
  }

  func testNotificationCategoryRawValuesMatchBackend() {
    XCTAssertEqual(VectorNotificationCategory.teamStatusChanges.rawValue, "team_status_changes")
    XCTAssertEqual(VectorNotificationCategory.teamStatusChanges.label, "Team status changes")
  }

  func testAuthNormalizesAppURLLikeCLI() throws {
    XCTAssertEqual(try VectorAuthClient.normalizeAppURL("vector.example.com").absoluteString, "https://vector.example.com")
    XCTAssertEqual(try VectorAuthClient.normalizeAppURL("https://vector.example.com/").absoluteString, "https://vector.example.com")
    XCTAssertEqual(try VectorAuthClient.normalizeAppURL("localhost:3000/").absoluteString, "http://localhost:3000")
    XCTAssertThrowsError(try VectorAuthClient.normalizeAppURL(""))
  }

  func testCookieHeaderSplitPreservesExpiresCommas() {
    let rawHeader = "session=abc; Path=/; Expires=Wed, 24 Jun 2026 12:00:00 GMT, token=def; Path=/; HttpOnly"

    let cookies = VectorAuthClient.splitSetCookieHeader(rawHeader)

    XCTAssertEqual(cookies.count, 2)
    XCTAssertTrue(cookies[0].contains("Expires=Wed, 24 Jun 2026"))
    XCTAssertTrue(cookies[1].hasPrefix("token=def"))
  }

  func testAppConfigFallsBackToLocalConvexForLocalDevelopment() async throws {
    let client = VectorAuthClient(transport: FailingAuthTransport())
    let config = try await client.fetchAppConfig(appURL: URL(string: "http://localhost:3000")!)

    XCTAssertEqual(config.convexURL.absoluteString, "http://127.0.0.1:3210")
  }

  func testAppConfigDoesNotFallbackForRemoteInstances() async {
    let client = VectorAuthClient(transport: FailingAuthTransport())

    do {
      _ = try await client.fetchAppConfig(appURL: URL(string: "https://vector.example.com")!)
      XCTFail("Expected remote config fetch to fail.")
    } catch {
      XCTAssertTrue(error is URLError)
    }
  }

  func testIssueRowDecodesConvexNumberFields() throws {
    let payload = """
      {
        "_id": "issue-1",
        "_creationTime": 1774550000000,
        "updatedAt": 1774560000000,
        "key": "ROADMAP-1",
        "title": "Native issue detail",
        "description": "Build the compact native issue detail screen.",
        "projectId": "project-1",
        "projectKey": "ROADMAP",
        "teamId": "team-1",
        "teamKey": "PROD",
        "priorityId": "priority-1",
        "priorityName": "High",
        "priorityIcon": "signal-high",
        "priorityColor": "#ef4444",
        "workflowStateId": "state-1",
        "workflowStateName": "In Progress",
        "workflowStateIcon": "loader",
        "workflowStateColor": "#f59e0b",
        "workflowStateType": "in_progress",
        "reporterName": "raj",
        "assignmentId": "assignment-1",
        "assigneeId": "user-1",
        "assigneeName": "raj",
        "assigneeEmail": "raj@example.com",
        "dueDate": "2026-07-08",
        "visibility": "organization",
        "canEdit": true,
        "lastActivityEventType": "comment_added",
        "linkedPrs": [
          { "number": 24, "state": "open", "url": "https://github.com/xrehpicx/vector/pull/24" }
        ]
      }
      """.data(using: .utf8)!

    let issue = try JSONDecoder().decode(VectorIssueRow.self, from: payload)

    XCTAssertEqual(issue.id, "issue-1")
    XCTAssertEqual(issue.key, "ROADMAP-1")
    XCTAssertEqual(issue.rowId, "issue-1:assignment-1")
    XCTAssertEqual(issue.stateLabel, "In Progress")
    XCTAssertEqual(issue.assigneeLabel, "raj")
    XCTAssertEqual(issue.canEdit, true)
    XCTAssertEqual(issue.linkedPrs.first?.number, 24)
    XCTAssertEqual(issue.updatedAt, 1_774_560_000_000)
  }

  func testPaginationArgsEncodeNumItemsAsConvexNumber() throws {
    let encoded = try VectorConvexArguments.pagination(numItems: 30).convexEncode()

    XCTAssertTrue(encoded.contains("\"numItems\":30"))
    XCTAssertTrue(encoded.contains("\"cursor\":null"))
    XCTAssertFalse(encoded.contains("$integer"))
  }

  func testOrganizationDecodesLogoStorageId() throws {
    let payload = """
      {
        "_id": "org-1",
        "name": "Vector",
        "slug": "imai",
        "logo": "storage-logo-1"
      }
      """.data(using: .utf8)!

    let organization = try JSONDecoder().decode(VectorOrganization.self, from: payload)

    XCTAssertEqual(organization.logo, "storage-logo-1")
    XCTAssertEqual(
      organization.logoURL(baseURL: URL(string: "https://imai.tech")!)?.absoluteString,
      "https://imai.tech/api/files/storage-logo-1"
    )
  }

  func testOrganizationLogoURLHandlesAbsoluteAndEmptyValues() {
    let baseURL = URL(string: "https://imai.tech")!
    let absolute = VectorOrganization(
      id: "org-absolute",
      name: "Vector",
      slug: "vector",
      logo: "https://cdn.example.com/vector.png"
    )
    let empty = VectorOrganization(
      id: "org-empty",
      name: "Vector",
      slug: "vector",
      logo: "  "
    )

    XCTAssertEqual(absolute.logoURL(baseURL: baseURL)?.absoluteString, "https://cdn.example.com/vector.png")
    XCTAssertNil(empty.logoURL(baseURL: baseURL))
  }

  func testChangeWorkflowStateArgsUseBackendStateIdName() throws {
    let encoded = try VectorConvexArguments
      .changeWorkflowState(issueId: "issue-1", stateId: "state-1")
      .convexEncode()

    XCTAssertTrue(encoded.contains("\"issueId\":\"issue-1\""))
    XCTAssertTrue(encoded.contains("\"stateId\":\"state-1\""))
    XCTAssertFalse(encoded.contains("workflowStateId"))
  }

  func testUpdateAssigneesArgsEncodeUserIds() throws {
    let encoded = try VectorConvexArguments
      .updateAssignees(issueId: "issue-1", assigneeIds: ["user-1", "user-2"])
      .convexEncode()

    XCTAssertTrue(encoded.contains("\"issueId\":\"issue-1\""))
    XCTAssertTrue(encoded.contains("\"assigneeIds\":[\"user-1\",\"user-2\"]"))
  }

  func testMutationResponseDecodesObjectPayloads() throws {
    let commentPayload = #"{"commentId":"comment-1"}"#.data(using: .utf8)!
    let successPayload = #"{"success":true}"#.data(using: .utf8)!
    let nullPayload = #"null"#.data(using: .utf8)!
    let scalarPayload = #"true"#.data(using: .utf8)!

    XCTAssertNoThrow(try JSONDecoder().decode(VectorMutationResponse.self, from: commentPayload))
    XCTAssertNoThrow(try JSONDecoder().decode(VectorMutationResponse.self, from: successPayload))
    XCTAssertNoThrow(try JSONDecoder().decode(VectorMutationResponse.self, from: nullPayload))
    XCTAssertNoThrow(try JSONDecoder().decode(VectorMutationResponse.self, from: scalarPayload))
  }

  func testActivityDetailsDecodesCommentId() throws {
    let payload = """
      {
        "commentId": "comment-1",
        "commentPreview": "A useful mobile comment"
      }
      """.data(using: .utf8)!

    let details = try JSONDecoder().decode(VectorActivityDetails.self, from: payload)

    XCTAssertEqual(details.commentId, "comment-1")
    XCTAssertEqual(details.commentPreview, "A useful mobile comment")
  }

  func testUserDecodesProfileImageAliases() throws {
    let payload = """
      {
        "id": "user-1",
        "name": "Nithin",
        "email": "nithin@example.com",
        "avatarUrl": "/api/avatar/user-1"
      }
      """.data(using: .utf8)!

    let user = try JSONDecoder().decode(VectorUser.self, from: payload)

    XCTAssertEqual(user.id, "user-1")
    XCTAssertEqual(user.displayName, "Nithin")
    XCTAssertEqual(user.image, "/api/avatar/user-1")
  }

  func testMarkdownParserBuildsDocumentBlocks() {
    let blocks = VectorMarkdownParser.parse(
      """
      # Goal

      Build the **native** detail view.

      - Render Markdown
      - Keep it compact

      ```swift
      Text("Vector")
      ```
      """
    )

    XCTAssertEqual(blocks.count, 4)
    XCTAssertEqual(blocks[0], .heading(level: 1, text: "Goal"))
    XCTAssertEqual(blocks[1], .paragraph("Build the **native** detail view."))
    XCTAssertEqual(blocks[2], .unorderedList(["Render Markdown", "Keep it compact"]))
    XCTAssertEqual(blocks[3], .codeBlock("Text(\"Vector\")"))
  }

  func testIssueRowFallsBackToCreationTimeWhenUpdatedAtIsMissing() throws {
    let payload = """
      {
        "_id": "issue-2",
        "_creationTime": 1774550000000,
        "key": "ROADMAP-2",
        "title": "Offline issue card",
        "linkedPrs": []
      }
      """.data(using: .utf8)!

    let issue = try JSONDecoder().decode(VectorIssueRow.self, from: payload)

    XCTAssertEqual(issue.updatedAt, issue.creationTime)
    XCTAssertEqual(issue.rowId, "issue-2:unassigned")
  }

  func testAssignmentDecodesNestedConvexResponse() throws {
    let payload = """
      {
        "_id": "assignment-1",
        "note": "Own the mobile detail view",
        "assignee": {
          "_id": "user-1",
          "name": "raj",
          "email": "raj@example.com",
          "image": "https://example.com/avatar.png"
        },
        "state": {
          "_id": "state-1",
          "name": "In Progress",
          "type": "in_progress",
          "position": 2,
          "color": "#f59e0b",
          "icon": "loader"
        }
      }
      """.data(using: .utf8)!

    let assignment = try JSONDecoder().decode(VectorIssueAssignment.self, from: payload)

    XCTAssertEqual(assignment.id, "assignment-1")
    XCTAssertEqual(assignment.assigneeName, "raj")
    XCTAssertEqual(assignment.assigneeEmail, "raj@example.com")
    XCTAssertEqual(assignment.stateName, "In Progress")
    XCTAssertEqual(assignment.stateType, "in_progress")
  }

  func testWorkspaceOptionsDecodeMembersAndIssueMetadata() throws {
    let payload = """
      {
        "members": [
          {
            "_id": "member-1",
            "userId": "user-1",
            "role": "admin",
            "user": {
              "_id": "user-1",
              "name": "raj",
              "email": "raj@example.com",
              "image": null
            }
          }
        ],
        "teams": [],
        "projects": [],
        "issueStates": [
          { "_id": "state-1", "name": "In Progress", "type": "in_progress", "position": 2, "color": "#f59e0b", "icon": "loader" }
        ],
        "issuePriorities": [
          { "_id": "priority-1", "name": "High", "weight": 3, "color": "#ef4444", "icon": "signal-high" }
        ],
        "projectStatuses": []
      }
      """.data(using: .utf8)!

    let options = try JSONDecoder().decode(VectorWorkspaceOptions.self, from: payload)

    XCTAssertEqual(options.members.first?.displayName, "raj")
    XCTAssertEqual(options.members.first?.userId, "user-1")
    XCTAssertEqual(options.issueStates.first?.name, "In Progress")
    XCTAssertEqual(options.issuePriorities.first?.name, "High")
  }

  @MainActor
  func testIssueMetadataResolverPrefersWorkspaceConfigById() throws {
    let issue = VectorMockData.issues[0]
    let stateId = try XCTUnwrap(issue.workflowStateId)
    let priorityId = try XCTUnwrap(issue.priorityId)
    let options = VectorWorkspaceOptions(
      members: [],
      teams: [],
      projects: [],
      issueStates: [
        VectorState(
          id: stateId,
          name: "Workspace Done",
          type: "done",
          position: 12,
          color: "#123456",
          icon: "sparkles"
        ),
      ],
      issuePriorities: [
        VectorPriority(
          id: priorityId,
          name: "Workspace Critical",
          weight: 9,
          color: "#654321",
          icon: "flame"
        ),
      ],
      projectStatuses: []
    )

    let status = VectorIssueMetadataResolver.state(for: issue, options: options)
    let priority = try XCTUnwrap(VectorIssueMetadataResolver.priority(for: issue, options: options))

    XCTAssertEqual(status.name, "Workspace Done")
    XCTAssertEqual(status.color, "#123456")
    XCTAssertEqual(status.icon, "sparkles")
    XCTAssertEqual(priority.name, "Workspace Critical")
    XCTAssertEqual(priority.color, "#654321")
    XCTAssertEqual(priority.icon, "flame")
  }

  @MainActor
  func testIssueMetadataResolverFallsBackToRowFieldsBeforeOptionsLoad() throws {
    let issue = VectorMockData.issues[0]

    let status = VectorIssueMetadataResolver.state(for: issue, options: nil)
    let priority = try XCTUnwrap(VectorIssueMetadataResolver.priority(for: issue, options: nil))

    XCTAssertEqual(status.name, issue.workflowStateName ?? "No status")
    XCTAssertEqual(status.color, issue.workflowStateColor)
    XCTAssertEqual(status.icon, issue.workflowStateIcon)
    XCTAssertEqual(priority.name, issue.priorityName ?? "")
    XCTAssertEqual(priority.color, issue.priorityColor)
    XCTAssertEqual(priority.icon, issue.priorityIcon)
  }

  @MainActor
  func testMockRepositoryReturnsCoreMobileData() throws {
    let repository = MockVectorRepository()
    var issues: [VectorIssueRow] = []
    var detailIssue: VectorIssueRow?
    var projects: [VectorProject] = []
    var teams: [VectorTeam] = []
    var workspaceOptions: VectorWorkspaceOptions?

    let issuesCancellable = repository.issuesPage(orgSlug: "imai", scope: .mine, pageSize: 10, cursor: nil)
      .sink(receiveCompletion: { _ in }, receiveValue: { issues = $0.page })
    let detailCancellable = repository.issue(orgSlug: "imai", key: "ROADMAP-5")
      .sink(receiveCompletion: { _ in }, receiveValue: { detailIssue = $0 })
    let projectsCancellable = repository.projectsPage(orgSlug: "imai", scope: .mine, pageSize: 10, cursor: nil)
      .sink(receiveCompletion: { _ in }, receiveValue: { projects = $0.page })
    let teamsCancellable = repository.teamsPage(orgSlug: "imai", scope: .mine, pageSize: 10, cursor: nil)
      .sink(receiveCompletion: { _ in }, receiveValue: { teams = $0.page })
    let optionsCancellable = repository.workspaceOptions(orgSlug: "imai")
      .sink(receiveCompletion: { _ in }, receiveValue: { workspaceOptions = $0 })

    XCTAssertFalse(issues.isEmpty)
    XCTAssertEqual(detailIssue?.key, "ROADMAP-5")
    XCTAssertEqual(detailIssue?.canEdit, true)
    XCTAssertFalse(projects.isEmpty)
    XCTAssertFalse(teams.isEmpty)
    XCTAssertFalse(workspaceOptions?.members.isEmpty ?? true)

    withExtendedLifetime([issuesCancellable, detailCancellable, projectsCancellable, teamsCancellable, optionsCancellable]) {}
  }

  @MainActor
  func testViewModelReusesLiveQuerySubscriptionsAcrossRefreshes() {
    let repository = CountingVectorRepository()
    let viewModel = VectorMobileViewModel(configuration: .demo, repository: repository)

    XCTAssertEqual(repository.issueListCalls[.mine, default: 0], 1)
    XCTAssertEqual(repository.projectListCalls[.mine, default: 0], 1)
    XCTAssertEqual(repository.teamListCalls[.mine, default: 0], 1)
    XCTAssertEqual(repository.workspaceOptionsCalls, 1)
    XCTAssertEqual(repository.userStatusCalls, 1)

    viewModel.refresh()
    viewModel.loadSettings()

    XCTAssertEqual(repository.issueListCalls[.mine, default: 0], 1)
    XCTAssertEqual(repository.projectListCalls[.mine, default: 0], 1)
    XCTAssertEqual(repository.teamListCalls[.mine, default: 0], 1)
    XCTAssertEqual(repository.workspaceOptionsCalls, 1)
    XCTAssertEqual(repository.userStatusCalls, 1)

    viewModel.issueScope = .all
    viewModel.refresh()
    XCTAssertEqual(repository.issueListCalls[.all, default: 0], 1)

    viewModel.issueScope = .mine
    viewModel.refresh()
    XCTAssertEqual(repository.issueListCalls[.mine, default: 0], 1)

    viewModel.projectScope = .all
    viewModel.refresh()
    XCTAssertEqual(repository.projectListCalls[.all, default: 0], 1)
    XCTAssertEqual(repository.teamListCalls[.all, default: 0], 1)
  }

  @MainActor
  func testViewModelLoadsAdditionalIssuePages() async throws {
    let repository = PagingVectorRepository()
    let viewModel = VectorMobileViewModel(configuration: .demo, repository: repository)
    await waitUntil {
      viewModel.issues.map(\.id) == [VectorMockData.issues[0].id]
    }

    XCTAssertEqual(viewModel.issues.map(\.id), [VectorMockData.issues[0].id])
    XCTAssertTrue(viewModel.canLoadMoreIssues)

    viewModel.loadMoreIssues()
    await waitUntil {
      viewModel.issues.map(\.id) == [VectorMockData.issues[0].id, VectorMockData.issues[1].id]
    }

    XCTAssertEqual(viewModel.issues.map(\.id), [VectorMockData.issues[0].id, VectorMockData.issues[1].id])
    XCTAssertFalse(viewModel.canLoadMoreIssues)
    XCTAssertEqual(repository.issuePageCursors, [nil, "next"])
  }

  @MainActor
  func testViewModelLoadsAdditionalWorkspaceAndInboxPages() async throws {
    let repository = PagingVectorRepository()
    let viewModel = VectorMobileViewModel(configuration: .demo, repository: repository)

    await waitUntil {
      viewModel.projects.map(\.id) == [VectorMockData.projects[0].id]
        && viewModel.teams.map(\.id) == [VectorMockData.teams[0].id]
        && viewModel.inboxActivity.map(\.id) == [VectorMockData.activityItems[0].id]
    }

    XCTAssertTrue(viewModel.canLoadMoreProjects)
    XCTAssertTrue(viewModel.canLoadMoreTeams)
    XCTAssertTrue(viewModel.canLoadMoreInboxActivity)

    viewModel.loadMoreProjects()
    viewModel.loadMoreTeams()
    viewModel.loadMoreInboxActivity()

    await waitUntil {
      viewModel.projects.map(\.id) == [VectorMockData.projects[0].id, VectorMockData.projects[1].id]
        && viewModel.teams.map(\.id) == [VectorMockData.teams[0].id, VectorMockData.teams[1].id]
        && viewModel.inboxActivity.map(\.id) == [VectorMockData.activityItems[0].id, VectorMockData.activityItems[1].id]
    }

    XCTAssertFalse(viewModel.canLoadMoreProjects)
    XCTAssertFalse(viewModel.canLoadMoreTeams)
    XCTAssertFalse(viewModel.canLoadMoreInboxActivity)
    XCTAssertEqual(repository.projectPageCursors, [nil, "next"])
    XCTAssertEqual(repository.teamPageCursors, [nil, "next"])
    XCTAssertEqual(repository.inboxActivityCursors, [nil, "next"])
  }

  @MainActor
  private func waitUntil(
    timeout: TimeInterval = 1,
    file: StaticString = #filePath,
    line: UInt = #line,
    _ condition: @MainActor @escaping () -> Bool
  ) async {
    let deadline = Date().addingTimeInterval(timeout)
    while !condition(), Date() < deadline {
      try? await Task.sleep(nanoseconds: 1_000_000)
    }
    XCTAssertTrue(condition(), file: file, line: line)
  }
}

private struct FailingAuthTransport: VectorAuthTransport {
  func data(for request: URLRequest) async throws -> (Data, URLResponse) {
    throw URLError(.notConnectedToInternet)
  }
}

@MainActor
private final class CountingVectorRepository: VectorMobileRepository {
  var issueListCalls: [VectorIssueScope: Int] = [:]
  var projectListCalls: [VectorProjectScope: Int] = [:]
  var teamListCalls: [VectorProjectScope: Int] = [:]
  var workspaceOptionsCalls = 0
  var userStatusCalls = 0

  func issuesPage(orgSlug: String, scope: VectorIssueScope, pageSize: Int, cursor: String?) -> AnyPublisher<VectorPaginatedPage<VectorIssueRow>, Error> {
    issueListCalls[scope, default: 0] += 1
    return publisher(VectorPaginatedPage(page: VectorMockData.issues, isDone: true))
  }

  func issue(orgSlug: String, key: String) -> AnyPublisher<VectorIssueRow?, Error> {
    publisher(VectorMockData.issues.first { $0.key == key })
  }

  func projectsPage(orgSlug: String, scope: VectorProjectScope, pageSize: Int, cursor: String?) -> AnyPublisher<VectorPaginatedPage<VectorProject>, Error> {
    projectListCalls[scope, default: 0] += 1
    return publisher(VectorPaginatedPage(page: VectorMockData.projects, isDone: true))
  }

  func teamsPage(orgSlug: String, scope: VectorProjectScope, pageSize: Int, cursor: String?) -> AnyPublisher<VectorPaginatedPage<VectorTeam>, Error> {
    teamListCalls[scope, default: 0] += 1
    return publisher(VectorPaginatedPage(page: VectorMockData.teams, isDone: true))
  }

  func workspaceOptions(orgSlug: String) -> AnyPublisher<VectorWorkspaceOptions, Error> {
    workspaceOptionsCalls += 1
    return publisher(VectorMockData.workspaceOptions)
  }

  func comments(issueId: VectorID) -> AnyPublisher<[VectorComment], Error> {
    publisher([])
  }

  func assignments(issueId: VectorID) -> AnyPublisher<[VectorIssueAssignment], Error> {
    publisher([])
  }

  func issueActivity(issueId: VectorID) -> AnyPublisher<[VectorActivityItem], Error> {
    publisher([])
  }

  func inboxActivityPage(orgSlug: String, pageSize: Int, cursor: String?) -> AnyPublisher<VectorOrgActivityPage, Error> {
    publisher(VectorOrgActivityPage(items: []))
  }

  func userStatus() -> AnyPublisher<VectorUserStatus?, Error> {
    userStatusCalls += 1
    return publisher(nil)
  }

  func notificationPreferences() -> AnyPublisher<[VectorNotificationPreference], Error> {
    publisher([])
  }

  func mobilePushTokens() -> AnyPublisher<[VectorMobilePushTokenRegistration], Error> {
    publisher([])
  }

  func setPresence(_ presence: VectorPresenceStatus) async throws {}

  func setCustomStatus(text: String?, emoji: String?, clearsAt: Double?) async throws {}

  func clearCustomStatus() async throws {}

  func updateNotificationPreference(_ preference: VectorNotificationPreference) async throws {}

  func upsertMobilePushToken(_ token: VectorPushDeviceToken, bundleId: String?, deviceLabel: String?) async throws {}

  func removeMobilePushToken(_ token: VectorPushDeviceToken) async throws {}

  func updateTitle(issueId: VectorID, title: String) async throws {}

  func updateDescription(issueId: VectorID, description: String?) async throws {}

  func changeWorkflowState(issueId: VectorID, stateId: VectorID) async throws {}

  func changePriority(issueId: VectorID, priorityId: VectorID) async throws {}

  func updateAssignees(issueId: VectorID, assigneeIds: [VectorID]) async throws {}

  func changeProject(issueId: VectorID, projectId: VectorID?) async throws {}

  func changeTeam(issueId: VectorID, teamId: VectorID?) async throws {}

  func changeVisibility(issueId: VectorID, visibility: String) async throws {}

  func addComment(issueId: VectorID, body: String, parentId: VectorID?) async throws {}

  private func publisher<Value>(_ value: Value) -> AnyPublisher<Value, Error> {
    Just(value)
      .setFailureType(to: Error.self)
      .eraseToAnyPublisher()
  }
}

@MainActor
private final class PagingVectorRepository: VectorMobileRepository {
  var issuePageCursors: [String?] = []
  var projectPageCursors: [String?] = []
  var teamPageCursors: [String?] = []
  var inboxActivityCursors: [String?] = []

  func issuesPage(orgSlug: String, scope: VectorIssueScope, pageSize: Int, cursor: String?) -> AnyPublisher<VectorPaginatedPage<VectorIssueRow>, Error> {
    issuePageCursors.append(cursor)
    if cursor == nil {
      return publisher(VectorPaginatedPage(page: [VectorMockData.issues[0]], continueCursor: "next", isDone: false))
    }
    return publisher(VectorPaginatedPage(page: [VectorMockData.issues[0], VectorMockData.issues[1]], isDone: true))
  }

  func issue(orgSlug: String, key: String) -> AnyPublisher<VectorIssueRow?, Error> {
    publisher(VectorMockData.issues.first { $0.key == key })
  }

  func projectsPage(orgSlug: String, scope: VectorProjectScope, pageSize: Int, cursor: String?) -> AnyPublisher<VectorPaginatedPage<VectorProject>, Error> {
    projectPageCursors.append(cursor)
    if cursor == nil {
      return publisher(VectorPaginatedPage(page: [VectorMockData.projects[0]], continueCursor: "next", isDone: false))
    }
    return publisher(VectorPaginatedPage(page: [VectorMockData.projects[0], VectorMockData.projects[1]], isDone: true))
  }

  func teamsPage(orgSlug: String, scope: VectorProjectScope, pageSize: Int, cursor: String?) -> AnyPublisher<VectorPaginatedPage<VectorTeam>, Error> {
    teamPageCursors.append(cursor)
    if cursor == nil {
      return publisher(VectorPaginatedPage(page: [VectorMockData.teams[0]], continueCursor: "next", isDone: false))
    }
    return publisher(VectorPaginatedPage(page: [VectorMockData.teams[0], VectorMockData.teams[1]], isDone: true))
  }

  func workspaceOptions(orgSlug: String) -> AnyPublisher<VectorWorkspaceOptions, Error> {
    publisher(VectorMockData.workspaceOptions)
  }

  func comments(issueId: VectorID) -> AnyPublisher<[VectorComment], Error> {
    publisher([])
  }

  func assignments(issueId: VectorID) -> AnyPublisher<[VectorIssueAssignment], Error> {
    publisher([])
  }

  func issueActivity(issueId: VectorID) -> AnyPublisher<[VectorActivityItem], Error> {
    publisher([])
  }

  func inboxActivityPage(orgSlug: String, pageSize: Int, cursor: String?) -> AnyPublisher<VectorOrgActivityPage, Error> {
    inboxActivityCursors.append(cursor)
    if cursor == nil {
      return publisher(VectorOrgActivityPage(items: [VectorMockData.activityItems[0]], nextCursor: "next"))
    }
    return publisher(VectorOrgActivityPage(items: [VectorMockData.activityItems[0], VectorMockData.activityItems[1]]))
  }

  func userStatus() -> AnyPublisher<VectorUserStatus?, Error> {
    publisher(nil)
  }

  func notificationPreferences() -> AnyPublisher<[VectorNotificationPreference], Error> {
    publisher([])
  }

  func mobilePushTokens() -> AnyPublisher<[VectorMobilePushTokenRegistration], Error> {
    publisher([])
  }

  func setPresence(_ presence: VectorPresenceStatus) async throws {}

  func setCustomStatus(text: String?, emoji: String?, clearsAt: Double?) async throws {}

  func clearCustomStatus() async throws {}

  func updateNotificationPreference(_ preference: VectorNotificationPreference) async throws {}

  func upsertMobilePushToken(_ token: VectorPushDeviceToken, bundleId: String?, deviceLabel: String?) async throws {}

  func removeMobilePushToken(_ token: VectorPushDeviceToken) async throws {}

  func updateTitle(issueId: VectorID, title: String) async throws {}

  func updateDescription(issueId: VectorID, description: String?) async throws {}

  func changeWorkflowState(issueId: VectorID, stateId: VectorID) async throws {}

  func changePriority(issueId: VectorID, priorityId: VectorID) async throws {}

  func updateAssignees(issueId: VectorID, assigneeIds: [VectorID]) async throws {}

  func changeProject(issueId: VectorID, projectId: VectorID?) async throws {}

  func changeTeam(issueId: VectorID, teamId: VectorID?) async throws {}

  func changeVisibility(issueId: VectorID, visibility: String) async throws {}

  func addComment(issueId: VectorID, body: String, parentId: VectorID?) async throws {}

  private func publisher<Value>(_ value: Value) -> AnyPublisher<Value, Error> {
    Just(value)
      .setFailureType(to: Error.self)
      .eraseToAnyPublisher()
  }
}
