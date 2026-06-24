import Combine
import Foundation

@MainActor
public final class VectorMobileViewModel: ObservableObject {
  @Published public private(set) var issues: [VectorIssueRow] = []
  @Published public private(set) var projects: [VectorProject] = []
  @Published public private(set) var teams: [VectorTeam] = []
  @Published public private(set) var comments: [VectorComment] = []
  @Published public private(set) var assignments: [VectorIssueAssignment] = []
  @Published public private(set) var isLoading = false
  @Published public private(set) var errorMessage: String?
  @Published public var issueScope: VectorIssueScope = .mine
  @Published public var projectScope: VectorProjectScope = .mine
  @Published public var issueLayoutMode: VectorIssueLayoutMode = .list

  public let configuration: VectorMobileConfiguration
  private let repository: VectorMobileRepository
  private var listCancellables = Set<AnyCancellable>()
  private var issueSupportCancellables = Set<AnyCancellable>()

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
