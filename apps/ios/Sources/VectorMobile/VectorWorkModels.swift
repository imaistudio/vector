@preconcurrency import ConvexMobile
import Foundation

public struct VectorCreateRequestResult: Decodable, Equatable {
  public let requestId: VectorID
  public let requestKey: String
}

public enum VectorRequestScope: String, CaseIterable, Identifiable, Sendable {
  case inbox
  case mine
  case requested
  case all

  public var id: String { rawValue }

  public var label: String {
    switch self {
    case .inbox: "Inbox"
    case .mine: "To me"
    case .requested: "By me"
    case .all: "All"
    }
  }

}

public enum VectorWorkScope: String, CaseIterable, Identifiable, Sendable {
  case active
  case mine
  case attention
  case all

  public var id: String { rawValue }

  public var label: String {
    switch self {
    case .active: "Active"
    case .mine: "Mine"
    case .attention: "Attention"
    case .all: "All"
    }
  }
}

public enum VectorRequestStatus: String, Decodable, Equatable, Sendable {
  case new
  case routed
  case planned
  case inDelivery = "in_delivery"
  case readyForReview = "ready_for_review"
  case changesRequested = "changes_requested"
  case completed
  case declined
  case duplicate
  case unknown

  public init(from decoder: Decoder) throws {
    let value = try decoder.singleValueContainer().decode(String.self)
    self = Self(rawValue: value) ?? .unknown
  }

  public var label: String {
    switch self {
    case .new: "Needs routing"
    case .routed: "Routed"
    case .planned: "Planned"
    case .inDelivery: "In delivery"
    case .readyForReview: "Ready for review"
    case .changesRequested: "Changes requested"
    case .completed: "Completed"
    case .declined: "Declined"
    case .duplicate: "Duplicate"
    case .unknown: "Unknown"
    }
  }

  public var isClaimable: Bool {
    switch self {
    case .new, .routed, .readyForReview, .changesRequested: true
    default: false
    }
  }
}

public enum VectorWorkStatus: String, Decodable, Equatable, CaseIterable, Identifiable, Sendable {
  case planned
  case active
  case waiting
  case blocked
  case readyForReview = "ready_for_review"
  case completed
  case canceled
  case unknown

  public init(from decoder: Decoder) throws {
    let value = try decoder.singleValueContainer().decode(String.self)
    self = Self(rawValue: value) ?? .unknown
  }

  public var id: String { rawValue }

  public var label: String {
    switch self {
    case .planned: "Planned"
    case .active: "Active"
    case .waiting: "Waiting"
    case .blocked: "Blocked"
    case .readyForReview: "Ready for review"
    case .completed: "Completed"
    case .canceled: "Canceled"
    case .unknown: "Unknown"
    }
  }
}

public enum VectorTaskStatus: String, Decodable, Equatable, CaseIterable, Identifiable, Sendable {
  case todo
  case inProgress = "in_progress"
  case waiting
  case blocked
  case done
  case canceled
  case unknown

  public init(from decoder: Decoder) throws {
    let value = try decoder.singleValueContainer().decode(String.self)
    self = Self(rawValue: value) ?? .unknown
  }

  public var id: String { rawValue }

  public var label: String {
    switch self {
    case .todo: "To do"
    case .inProgress: "In progress"
    case .waiting: "Waiting"
    case .blocked: "Blocked"
    case .done: "Done"
    case .canceled: "Canceled"
    case .unknown: "Unknown"
    }
  }
}

public struct VectorRequestRow: Decodable, Equatable, Identifiable {
  public let id: VectorID
  public let key: String
  public let title: String
  public let description: String?
  public let expectedOutput: String
  public let reviewGuidance: String?
  public let status: VectorRequestStatus
  public let owner: VectorUser?
  public let requester: VectorUser?
  public let dueDate: String?
  @ConvexFloat public var linkedWorkCount: Double
  @ConvexFloat public var recipientCount: Double
  @ConvexFloat public var createdAt: Double
  @ConvexFloat public var updatedAt: Double

  public init(
    id: VectorID,
    key: String,
    title: String,
    expectedOutput: String,
    status: VectorRequestStatus,
    description: String? = nil,
    reviewGuidance: String? = nil,
    owner: VectorUser? = nil,
    requester: VectorUser? = nil,
    dueDate: String? = nil,
    linkedWorkCount: Double = 0,
    recipientCount: Double = 0,
    createdAt: Double,
    updatedAt: Double
  ) {
    self.id = id
    self.key = key
    self.title = title
    self.description = description
    self.expectedOutput = expectedOutput
    self.reviewGuidance = reviewGuidance
    self.status = status
    self.owner = owner
    self.requester = requester
    self.dueDate = dueDate
    self._linkedWorkCount = ConvexFloat(wrappedValue: linkedWorkCount)
    self._recipientCount = ConvexFloat(wrappedValue: recipientCount)
    self._createdAt = ConvexFloat(wrappedValue: createdAt)
    self._updatedAt = ConvexFloat(wrappedValue: updatedAt)
  }

  private enum CodingKeys: String, CodingKey {
    case id = "_id"
    case key
    case title
    case description
    case expectedOutput
    case reviewGuidance
    case status
    case owner
    case requester
    case dueDate
    case linkedWorkCount
    case recipientCount
    case createdAt
    case updatedAt
  }
}

public struct VectorLinkedWork: Decodable, Equatable, Identifiable {
  public let id: VectorID
  public let key: String
  public let title: String
  public let workStatus: VectorWorkStatus?
  public let relation: String?

  public init(id: VectorID, key: String, title: String, workStatus: VectorWorkStatus? = nil, relation: String? = nil) {
    self.id = id
    self.key = key
    self.title = title
    self.workStatus = workStatus
    self.relation = relation
  }

  private enum CodingKeys: String, CodingKey {
    case id = "_id"
    case key
    case title
    case workStatus
    case relation
  }
}

public struct VectorLinkedRequest: Decodable, Equatable, Identifiable {
  public let id: VectorID
  public let key: String
  public let title: String
  public let expectedOutput: String
  public let status: VectorRequestStatus
  public let latestReviewNote: String?
  public let relation: String?

  public init(id: VectorID, key: String, title: String, expectedOutput: String, status: VectorRequestStatus, latestReviewNote: String? = nil, relation: String? = nil) {
    self.id = id
    self.key = key
    self.title = title
    self.expectedOutput = expectedOutput
    self.status = status
    self.latestReviewNote = latestReviewNote
    self.relation = relation
  }

  private enum CodingKeys: String, CodingKey {
    case id = "_id"
    case key
    case title
    case expectedOutput
    case status
    case latestReviewNote
    case relation
  }
}

public struct VectorRequestRecipient: Decodable, Equatable, Identifiable {
  public let id: VectorID
  public let role: String
  public let user: VectorUser?

  private enum CodingKeys: String, CodingKey {
    case id = "_id"
    case role
    case user
  }
}

public struct VectorRequestDetail: Decodable, Equatable, Identifiable {
  public let id: VectorID
  public let key: String
  public let title: String
  public let description: String?
  public let expectedOutput: String
  public let reviewGuidance: String?
  public let status: VectorRequestStatus
  public let owner: VectorUser?
  public let requester: VectorUser?
  public let linkedWork: [VectorLinkedWork]
  public let recipients: [VectorRequestRecipient]
  public let canEdit: Bool
  public let dueDate: String?
  @ConvexFloat public var createdAt: Double
  @ConvexFloat public var updatedAt: Double

  public init(
    id: VectorID,
    key: String,
    title: String,
    expectedOutput: String,
    status: VectorRequestStatus,
    description: String? = nil,
    reviewGuidance: String? = nil,
    owner: VectorUser? = nil,
    requester: VectorUser? = nil,
    linkedWork: [VectorLinkedWork] = [],
    recipients: [VectorRequestRecipient] = [],
    canEdit: Bool = true,
    dueDate: String? = nil,
    createdAt: Double,
    updatedAt: Double
  ) {
    self.id = id
    self.key = key
    self.title = title
    self.description = description
    self.expectedOutput = expectedOutput
    self.reviewGuidance = reviewGuidance
    self.status = status
    self.owner = owner
    self.requester = requester
    self.linkedWork = linkedWork
    self.recipients = recipients
    self.canEdit = canEdit
    self.dueDate = dueDate
    self._createdAt = ConvexFloat(wrappedValue: createdAt)
    self._updatedAt = ConvexFloat(wrappedValue: updatedAt)
  }

  private enum CodingKeys: String, CodingKey {
    case id = "_id"
    case key
    case title
    case description
    case expectedOutput
    case reviewGuidance
    case status
    case owner
    case requester
    case linkedWork
    case recipients
    case canEdit
    case dueDate
    case createdAt
    case updatedAt
  }
}

public struct VectorTaskProgress: Decodable, Equatable {
  @ConvexFloat public var done: Double
  @ConvexFloat public var total: Double

  public init(done: Double, total: Double) {
    self._done = ConvexFloat(wrappedValue: done)
    self._total = ConvexFloat(wrappedValue: total)
  }
}

public struct VectorWorkRow: Decodable, Equatable, Identifiable {
  public let id: VectorID
  public let key: String
  public let title: String
  public let description: String?
  public let workStatus: VectorWorkStatus
  public let owner: VectorUser?
  public let ownerId: VectorID?
  public let effort: String?
  public let dueDate: String?
  public let taskProgress: VectorTaskProgress
  @ConvexFloat public var activeExecutionCount: Double
  @ConvexFloat public var openAttentionCount: Double
  @OptionalConvexFloat private var ownerStartedAtValue: Double?
  @OptionalConvexFloat private var lastMeaningfulActivityAtValue: Double?
  @ConvexFloat public var creationTime: Double

  public init(
    id: VectorID,
    key: String,
    title: String,
    workStatus: VectorWorkStatus,
    description: String? = nil,
    owner: VectorUser? = nil,
    ownerId: VectorID? = nil,
    effort: String? = nil,
    dueDate: String? = nil,
    taskProgress: VectorTaskProgress = .init(done: 0, total: 0),
    activeExecutionCount: Double = 0,
    openAttentionCount: Double = 0,
    ownerStartedAt: Double? = nil,
    lastMeaningfulActivityAt: Double? = nil,
    creationTime: Double
  ) {
    self.id = id
    self.key = key
    self.title = title
    self.description = description
    self.workStatus = workStatus
    self.owner = owner
    self.ownerId = ownerId
    self.effort = effort
    self.dueDate = dueDate
    self.taskProgress = taskProgress
    self._activeExecutionCount = ConvexFloat(wrappedValue: activeExecutionCount)
    self._openAttentionCount = ConvexFloat(wrappedValue: openAttentionCount)
    self._ownerStartedAtValue = OptionalConvexFloat(wrappedValue: ownerStartedAt)
    self._lastMeaningfulActivityAtValue = OptionalConvexFloat(wrappedValue: lastMeaningfulActivityAt)
    self._creationTime = ConvexFloat(wrappedValue: creationTime)
  }

  private enum CodingKeys: String, CodingKey {
    case id = "_id"
    case key
    case title
    case description
    case workStatus
    case owner
    case ownerId
    case effort
    case dueDate
    case taskProgress
    case activeExecutionCount
    case openAttentionCount
    case ownerStartedAtValue = "ownerStartedAt"
    case lastMeaningfulActivityAtValue = "lastMeaningfulActivityAt"
    case creationTime = "_creationTime"
  }

  public var ownerStartedAt: Double? { ownerStartedAtValue }
  public var lastMeaningfulActivityAt: Double { lastMeaningfulActivityAtValue ?? creationTime }
}

public struct VectorWorkTask: Decodable, Equatable, Identifiable {
  public let id: VectorID
  @ConvexFloat public var number: Double
  public let title: String
  public let description: String?
  public let status: VectorTaskStatus
  public let assignee: VectorUser?
  public let dueDate: String?

  public init(id: VectorID, number: Double, title: String, status: VectorTaskStatus, description: String? = nil, assignee: VectorUser? = nil, dueDate: String? = nil) {
    self.id = id
    self._number = ConvexFloat(wrappedValue: number)
    self.title = title
    self.description = description
    self.status = status
    self.assignee = assignee
    self.dueDate = dueDate
  }

  private enum CodingKeys: String, CodingKey {
    case id = "_id"
    case number
    case title
    case description
    case status
    case assignee
    case dueDate
  }
}

public struct VectorWorkOwnershipPeriod: Decodable, Equatable, Identifiable {
  public let id: VectorID
  public let owner: VectorUser?
  public let summary: String?
  @ConvexFloat public var startedAt: Double
  @OptionalConvexFloat private var executionStartedAtValue: Double?
  @OptionalConvexFloat private var endedAtValue: Double?

  public init(id: VectorID, owner: VectorUser?, summary: String? = nil, startedAt: Double, executionStartedAt: Double? = nil, endedAt: Double? = nil) {
    self.id = id
    self.owner = owner
    self.summary = summary
    self._startedAt = ConvexFloat(wrappedValue: startedAt)
    self._executionStartedAtValue = OptionalConvexFloat(wrappedValue: executionStartedAt)
    self._endedAtValue = OptionalConvexFloat(wrappedValue: endedAt)
  }

  private enum CodingKeys: String, CodingKey {
    case id = "_id"
    case owner
    case summary
    case startedAt
    case executionStartedAtValue = "executionStartedAt"
    case endedAtValue = "endedAt"
  }

  public var executionStartedAt: Double? { executionStartedAtValue }
  public var endedAt: Double? { endedAtValue }
}

public struct VectorWorkHandoff: Decodable, Equatable, Identifiable {
  public let id: VectorID
  public let status: String
  public let summary: String?
  public let fromOwner: VectorUser?
  public let toOwner: VectorUser?
  public let isRecipient: Bool
  @ConvexFloat public var initiatedAt: Double

  public init(id: VectorID, status: String, summary: String? = nil, fromOwner: VectorUser?, toOwner: VectorUser?, isRecipient: Bool, initiatedAt: Double) {
    self.id = id
    self.status = status
    self.summary = summary
    self.fromOwner = fromOwner
    self.toOwner = toOwner
    self.isRecipient = isRecipient
    self._initiatedAt = ConvexFloat(wrappedValue: initiatedAt)
  }

  private enum CodingKeys: String, CodingKey {
    case id = "_id"
    case status
    case summary
    case fromOwner
    case toOwner
    case isRecipient
    case initiatedAt = "createdAt"
  }
}

public struct VectorWorkAttention: Decodable, Equatable, Identifiable {
  public let id: VectorID
  public let prompt: String
  public let details: String?
  public let status: String
  @ConvexFloat public var requestedAt: Double

  public init(id: VectorID, prompt: String, details: String? = nil, status: String, requestedAt: Double) {
    self.id = id
    self.prompt = prompt
    self.details = details
    self.status = status
    self._requestedAt = ConvexFloat(wrappedValue: requestedAt)
  }

  private enum CodingKeys: String, CodingKey {
    case id = "_id"
    case prompt = "title"
    case details
    case status
    case requestedAt = "createdAt"
  }
}

public struct VectorWorkExecution: Decodable, Equatable, Identifiable {
  public let id: VectorID
  public let title: String?
  public let provider: String
  public let status: String
  public let latestSummary: String?

  public init(id: VectorID, title: String? = nil, provider: String, status: String, latestSummary: String? = nil) {
    self.id = id
    self.title = title
    self.provider = provider
    self.status = status
    self.latestSummary = latestSummary
  }

  private enum CodingKeys: String, CodingKey {
    case id = "_id"
    case title
    case provider
    case status
    case latestSummary
  }
}

public struct VectorWorkDetail: Decodable, Equatable, Identifiable {
  public let id: VectorID
  public let key: String
  public let title: String
  public let description: String?
  public let workStatus: VectorWorkStatus
  public let owner: VectorUser?
  public let ownerId: VectorID?
  public let effort: String?
  public let dueDate: String?
  public let linkedRequests: [VectorLinkedRequest]
  public let tasks: [VectorWorkTask]
  public let ownershipPeriods: [VectorWorkOwnershipPeriod]
  public let handoffs: [VectorWorkHandoff]
  public let attention: [VectorWorkAttention]
  public let executions: [VectorWorkExecution]
  public let canEdit: Bool
  @OptionalConvexFloat private var ownerStartedAtValue: Double?
  @ConvexFloat public var creationTime: Double

  public init(
    id: VectorID,
    key: String,
    title: String,
    workStatus: VectorWorkStatus,
    description: String? = nil,
    owner: VectorUser? = nil,
    ownerId: VectorID? = nil,
    effort: String? = nil,
    dueDate: String? = nil,
    linkedRequests: [VectorLinkedRequest] = [],
    tasks: [VectorWorkTask] = [],
    ownershipPeriods: [VectorWorkOwnershipPeriod] = [],
    handoffs: [VectorWorkHandoff] = [],
    attention: [VectorWorkAttention] = [],
    executions: [VectorWorkExecution] = [],
    canEdit: Bool = true,
    ownerStartedAt: Double? = nil,
    creationTime: Double
  ) {
    self.id = id
    self.key = key
    self.title = title
    self.description = description
    self.workStatus = workStatus
    self.owner = owner
    self.ownerId = ownerId
    self.effort = effort
    self.dueDate = dueDate
    self.linkedRequests = linkedRequests
    self.tasks = tasks
    self.ownershipPeriods = ownershipPeriods
    self.handoffs = handoffs
    self.attention = attention
    self.executions = executions
    self.canEdit = canEdit
    self._ownerStartedAtValue = OptionalConvexFloat(wrappedValue: ownerStartedAt)
    self._creationTime = ConvexFloat(wrappedValue: creationTime)
  }

  private enum CodingKeys: String, CodingKey {
    case id = "_id"
    case key
    case title
    case description
    case workStatus
    case owner
    case ownerId
    case effort
    case dueDate
    case linkedRequests
    case tasks
    case ownershipPeriods
    case handoffs
    case attention
    case executions
    case canEdit
    case ownerStartedAtValue = "ownerStartedAt"
    case creationTime = "_creationTime"
  }

  public var ownerStartedAt: Double? { ownerStartedAtValue }
}
