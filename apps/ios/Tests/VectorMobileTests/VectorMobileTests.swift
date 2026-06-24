import Combine
import ConvexMobile
import XCTest
@testable import VectorMobile

final class VectorMobileTests: XCTestCase {
  func testFunctionNamesUseNestedConvexPathSyntax() {
    XCTAssertEqual(VectorConvexFunctions.getOrganizations, "users:getOrganizations")
    XCTAssertEqual(VectorConvexFunctions.listIssuesPage, "issues/queries:listIssuesPage")
    XCTAssertEqual(VectorConvexFunctions.changeWorkflowState, "issues/mutations:changeWorkflowState")
    XCTAssertEqual(VectorConvexFunctions.listProjectActivity, "activities/queries:listProjectActivity")
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

  @MainActor
  func testMockRepositoryReturnsCoreMobileData() throws {
    let repository = MockVectorRepository()
    var issues: [VectorIssueRow] = []
    var projects: [VectorProject] = []
    var teams: [VectorTeam] = []

    let issuesCancellable = repository.issues(orgSlug: "imai", scope: .mine, pageSize: 10)
      .sink(receiveCompletion: { _ in }, receiveValue: { issues = $0 })
    let projectsCancellable = repository.projects(orgSlug: "imai", scope: .mine, pageSize: 10)
      .sink(receiveCompletion: { _ in }, receiveValue: { projects = $0 })
    let teamsCancellable = repository.teams(orgSlug: "imai", scope: .mine, pageSize: 10)
      .sink(receiveCompletion: { _ in }, receiveValue: { teams = $0 })

    XCTAssertFalse(issues.isEmpty)
    XCTAssertFalse(projects.isEmpty)
    XCTAssertFalse(teams.isEmpty)

    withExtendedLifetime([issuesCancellable, projectsCancellable, teamsCancellable]) {}
  }
}

private struct FailingAuthTransport: VectorAuthTransport {
  func data(for request: URLRequest) async throws -> (Data, URLResponse) {
    throw URLError(.notConnectedToInternet)
  }
}
