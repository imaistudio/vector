import Foundation

@MainActor
enum VectorMockData {
  static let raj = VectorUser(id: "user-raj", name: "raj", email: "raj@example.com")
  static let maya = VectorUser(id: "user-maya", name: "Maya", email: "maya@example.com")

  static let issueStates = [
    VectorState(id: "state-done", name: "Done", type: "done", position: 4, color: "#10b981", icon: "check-circle"),
    VectorState(id: "state-progress", name: "In Progress", type: "in_progress", position: 3, color: "#f59e0b", icon: "loader"),
    VectorState(id: "state-todo", name: "To Do", type: "todo", position: 2, color: "#94a3b8", icon: "circle"),
  ]

  static let priorities = [
    VectorPriority(id: "priority-high", name: "High", weight: 3, color: "#ef4444", icon: "signal-high"),
    VectorPriority(id: "priority-medium", name: "Medium", weight: 2, color: "#f59e0b", icon: "signal-medium"),
    VectorPriority(id: "priority-low", name: "Low", weight: 1, color: "#64748b", icon: "signal-low"),
  ]

  static let projectStatuses = [
    VectorProjectStatus(id: "project-status-progress", name: "In Progress", type: "in_progress", position: 2, color: "#0ea5e9", icon: "activity"),
    VectorProjectStatus(id: "project-status-planned", name: "Planned", type: "planned", position: 1, color: "#8b5cf6", icon: "calendar"),
  ]

  static let projects = [
    VectorProject(
      id: "project-roadmap",
      key: "ROADMAP",
      name: "IMAI Roadmap",
      description: "Roadmap for imai.studio",
      icon: "map",
      color: "#0ea5e9",
      lead: raj,
      status: projectStatuses[0],
      creationTime: 1_774_450_000_000
    ),
    VectorProject(
      id: "project-agent",
      key: "AGENT",
      name: "Design Agent",
      description: "Agent workflows for product ideation",
      icon: "sparkles",
      color: "#8b5cf6",
      lead: maya,
      status: projectStatuses[1],
      creationTime: 1_774_100_000_000
    ),
  ]

  static let teams = [
    VectorTeam(
      id: "team-product",
      key: "PROD",
      name: "Product",
      description: "Product direction and execution",
      icon: "box",
      color: "#0ea5e9",
      lead: raj,
      memberCount: 5,
      creationTime: 1_774_300_000_000
    ),
    VectorTeam(
      id: "team-design",
      key: "DSGN",
      name: "Design",
      description: "Brand, UI, and interaction design",
      icon: "palette",
      color: "#ec4899",
      lead: maya,
      memberCount: 4,
      creationTime: 1_774_200_000_000
    ),
  ]

  static let issues = [
    VectorIssueRow(
      id: "issue-5",
      key: "ROADMAP-5",
      title: "Advanced technical blueprint flow",
      description: "Turn product plans into implementation-ready blueprints.",
      projectId: "project-roadmap",
      projectKey: "ROADMAP",
      teamId: "team-product",
      teamKey: "PROD",
      priorityId: "priority-high",
      priorityName: "High",
      priorityIcon: "signal-high",
      priorityColor: "#ef4444",
      workflowStateId: "state-done",
      workflowStateName: "Done",
      workflowStateIcon: "check-circle",
      workflowStateColor: "#10b981",
      workflowStateType: "done",
      reporterName: "raj",
      assigneeId: "user-raj",
      assigneeName: "raj",
      assigneeEmail: "raj@example.com",
      dueDate: "2026-07-08",
      lastActivityEventType: "comment_added",
      linkedPrs: [VectorPullRequestSummary(number: 42, state: "open", url: "https://github.com/xrehpicx/vector/pull/42")],
      creationTime: 1_774_450_000_000,
      updatedAt: 1_774_550_000_000
    ),
    VectorIssueRow(
      id: "issue-6",
      key: "ROADMAP-6",
      title: "Catalog data creation flow",
      description: "A guided flow for structured product catalog data.",
      projectId: "project-roadmap",
      projectKey: "ROADMAP",
      teamId: "team-design",
      teamKey: "DSGN",
      priorityId: "priority-medium",
      priorityName: "Medium",
      priorityIcon: "signal-medium",
      priorityColor: "#f59e0b",
      workflowStateId: "state-progress",
      workflowStateName: "In Progress",
      workflowStateIcon: "loader",
      workflowStateColor: "#f59e0b",
      workflowStateType: "in_progress",
      reporterName: "Maya",
      assigneeId: "user-maya",
      assigneeName: "Maya",
      assigneeEmail: "maya@example.com",
      dueDate: "2026-07-15",
      lastActivityEventType: "status_changed",
      creationTime: 1_774_350_000_000,
      updatedAt: 1_774_500_000_000
    ),
    VectorIssueRow(
      id: "issue-3",
      key: "ROADMAP-3",
      title: "Long-form video agent for product content",
      description: "Support long-form product video generation workflows.",
      projectId: "project-agent",
      projectKey: "AGENT",
      teamId: "team-design",
      teamKey: "DSGN",
      priorityId: "priority-low",
      priorityName: "Low",
      priorityIcon: "signal-low",
      priorityColor: "#64748b",
      workflowStateId: "state-todo",
      workflowStateName: "To Do",
      workflowStateIcon: "circle",
      workflowStateColor: "#94a3b8",
      workflowStateType: "todo",
      reporterName: "raj",
      assigneeId: nil,
      assigneeName: nil,
      dueDate: nil,
      lastActivityEventType: "created",
      creationTime: 1_774_250_000_000,
      updatedAt: 1_774_250_000_000
    ),
  ]

  static let comments = [
    VectorComment(
      id: "comment-1",
      body: "The native app should keep this flow focused on review and quick updates.",
      author: raj,
      creationTime: 1_774_560_000_000
    ),
    VectorComment(
      id: "comment-2",
      body: "For deeper editing, opening the web route is fine.",
      author: maya,
      creationTime: 1_774_565_000_000
    ),
  ]
}
