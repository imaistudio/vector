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
    XCTAssertEqual(VectorConvexFunctions.getCurrentUserStatus, "status:getCurrentUserStatus")
    XCTAssertEqual(VectorConvexFunctions.upsertMobilePushToken, "notifications/mutations:upsertMobilePushToken")
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

    let issuesCancellable = repository.issues(orgSlug: "imai", scope: .mine, pageSize: 10)
      .sink(receiveCompletion: { _ in }, receiveValue: { issues = $0 })
    let detailCancellable = repository.issue(orgSlug: "imai", key: "ROADMAP-5")
      .sink(receiveCompletion: { _ in }, receiveValue: { detailIssue = $0 })
    let projectsCancellable = repository.projects(orgSlug: "imai", scope: .mine, pageSize: 10)
      .sink(receiveCompletion: { _ in }, receiveValue: { projects = $0 })
    let teamsCancellable = repository.teams(orgSlug: "imai", scope: .mine, pageSize: 10)
      .sink(receiveCompletion: { _ in }, receiveValue: { teams = $0 })
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
}

private struct FailingAuthTransport: VectorAuthTransport {
  func data(for request: URLRequest) async throws -> (Data, URLResponse) {
    throw URLError(.notConnectedToInternet)
  }
}
