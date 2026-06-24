import Combine
@preconcurrency import ConvexMobile
import Foundation
import Security

public enum VectorAuthError: LocalizedError, Equatable {
  case invalidAppURL
  case missingConvexURL
  case missingStoredSession
  case noWorkspaceMembership
  case workspaceNotFound(String)
  case requestFailed(String)

  public var errorDescription: String? {
    switch self {
    case .invalidAppURL:
      "Enter a valid Vector app URL."
    case .missingConvexURL:
      "This Vector instance did not return a Convex deployment URL from /api/config."
    case .missingStoredSession:
      "No saved Vector session was found."
    case .noWorkspaceMembership:
      "This account does not belong to any Vector workspaces."
    case let .workspaceNotFound(slug):
      "No workspace matched \(slug)."
    case let .requestFailed(message):
      message
    }
  }
}

public protocol VectorAuthTransport: Sendable {
  func data(for request: URLRequest) async throws -> (Data, URLResponse)
}

extension URLSession: VectorAuthTransport {}

public struct VectorAppConfig: Codable, Equatable, Sendable {
  public let convexURL: URL
  public let tunnelHost: String?
}

public struct VectorStoredSession: Codable, Equatable, Sendable {
  public var appURL: URL
  public var convexURL: URL
  public var orgSlug: String?
  public var cookies: [String: String]
  public var user: VectorAuthenticatedUser?

  public init(
    appURL: URL,
    convexURL: URL,
    orgSlug: String? = nil,
    cookies: [String: String] = [:],
    user: VectorAuthenticatedUser? = nil
  ) {
    self.appURL = appURL
    self.convexURL = convexURL
    self.orgSlug = orgSlug
    self.cookies = cookies
    self.user = user
  }
}

public protocol VectorSessionStore: Sendable {
  func load() throws -> VectorStoredSession?
  func save(_ session: VectorStoredSession) throws
  func clear() throws
}

public final class VectorKeychainSessionStore: VectorSessionStore, @unchecked Sendable {
  private let service: String
  private let account: String

  public init(service: String = "studio.imai.vector.mobile", account: String = "default") {
    self.service = service
    self.account = account
  }

  public func load() throws -> VectorStoredSession? {
    var query = baseQuery()
    query[kSecMatchLimit as String] = kSecMatchLimitOne
    query[kSecReturnData as String] = true

    var item: CFTypeRef?
    let status = SecItemCopyMatching(query as CFDictionary, &item)
    if status == errSecItemNotFound {
      return nil
    }
    guard status == errSecSuccess, let data = item as? Data else {
      throw VectorAuthError.requestFailed("Unable to read saved Vector session.")
    }
    return try JSONDecoder().decode(VectorStoredSession.self, from: data)
  }

  public func save(_ session: VectorStoredSession) throws {
    let data = try JSONEncoder().encode(session)
    var query = baseQuery()
    let attributes = [kSecValueData as String: data]
    let updateStatus = SecItemUpdate(query as CFDictionary, attributes as CFDictionary)
    if updateStatus == errSecSuccess {
      return
    }
    if updateStatus != errSecItemNotFound {
      throw VectorAuthError.requestFailed("Unable to update saved Vector session.")
    }

    query[kSecValueData as String] = data
    query[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
    let addStatus = SecItemAdd(query as CFDictionary, nil)
    guard addStatus == errSecSuccess else {
      throw VectorAuthError.requestFailed("Unable to save Vector session.")
    }
  }

  public func clear() throws {
    let status = SecItemDelete(baseQuery() as CFDictionary)
    guard status == errSecSuccess || status == errSecItemNotFound else {
      throw VectorAuthError.requestFailed("Unable to clear saved Vector session.")
    }
  }

  private func baseQuery() -> [String: Any] {
    [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrService as String: service,
      kSecAttrAccount as String: account,
    ]
  }
}

public final class VectorAuthClient: @unchecked Sendable {
  private struct RawAppConfig: Decodable {
    let convexUrl: String?
    let tunnelHost: String?
  }

  private struct AuthSessionResponse: Decodable {
    let user: VectorAuthenticatedUser?
  }

  private struct ConvexTokenResponse: Decodable {
    let token: String?
  }

  private let transport: VectorAuthTransport

  public init(transport: VectorAuthTransport? = nil) {
    self.transport = transport ?? Self.defaultURLSession
  }

  public func signIn(appURLString: String, identifier: String, password: String) async throws -> VectorStoredSession {
    let appURL = try await resolveAppURL(appURLString)
    let config = try await fetchAppConfig(appURL: appURL)
    var session = VectorStoredSession(appURL: appURL, convexURL: config.convexURL)

    session = try await loginWithPassword(session: session, identifier: identifier, password: password)
    let authState = try await fetchAuthSession(session: session)
    session = authState.session
    session.user = authState.user
    return session
  }

  public func resolveAppURL(_ raw: String) async throws -> URL {
    let normalized = try Self.normalizeAppURL(raw)
    var request = URLRequest(url: normalized)
    request.httpMethod = "HEAD"

    do {
      let (_, response) = try await transport.data(for: request)
      if let resolvedURL = response.url, let origin = Self.originURL(from: resolvedURL) {
        return origin
      }
    } catch {
      return normalized
    }

    return normalized
  }

  public func fetchAppConfig(appURL: URL) async throws -> VectorAppConfig {
    var request = URLRequest(url: appURL.appending(path: "/api/config"))
    request.httpMethod = "GET"

    do {
      let (data, response) = try await transport.data(for: request)
      try validate(response: response)

      let raw = try JSONDecoder().decode(RawAppConfig.self, from: data)
      guard
        let convexURLString = raw.convexUrl?.trimmingCharacters(in: .whitespacesAndNewlines),
        !convexURLString.isEmpty,
        let convexURL = URL(string: convexURLString)
      else {
        if let localConfig = Self.localDevelopmentConfig(for: appURL, tunnelHost: raw.tunnelHost) {
          return localConfig
        }
        throw VectorAuthError.missingConvexURL
      }

      return VectorAppConfig(convexURL: convexURL, tunnelHost: raw.tunnelHost)
    } catch {
      if let localConfig = Self.localDevelopmentConfig(for: appURL, tunnelHost: nil) {
        return localConfig
      }
      throw error
    }
  }

  public func fetchAuthSession(session: VectorStoredSession) async throws -> (session: VectorStoredSession, user: VectorAuthenticatedUser?) {
    let (data, response, nextSession) = try await authRequest(session: session, path: "/api/auth/get-session", method: "GET")
    try validate(response: response)
    let authState = try JSONDecoder().decode(AuthSessionResponse.self, from: data)
    return (nextSession, authState.user)
  }

  public func fetchConvexToken(session: VectorStoredSession) async throws -> (session: VectorStoredSession, token: String) {
    let (data, response, nextSession) = try await authRequest(session: session, path: "/api/auth/convex/token", method: "GET")
    try validate(response: response)
    let tokenResponse = try JSONDecoder().decode(ConvexTokenResponse.self, from: data)
    guard let token = tokenResponse.token, !token.isEmpty else {
      throw VectorAuthError.requestFailed("Missing Convex token.")
    }
    return (nextSession, token)
  }

  public func logout(session: VectorStoredSession) async throws {
    let (_, response, _) = try await authRequest(session: session, path: "/api/auth/sign-out", method: "POST", body: Data("{}".utf8))
    try validate(response: response)
  }

  public static func normalizeAppURL(_ raw: String) throws -> URL {
    var value = raw.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !value.isEmpty else {
      throw VectorAuthError.invalidAppURL
    }

    if !value.lowercased().hasPrefix("http://") && !value.lowercased().hasPrefix("https://") {
      let isLocal = value.lowercased().hasPrefix("localhost") || value.hasPrefix("127.0.0.1")
      value = "\(isLocal ? "http" : "https")://\(value)"
    }

    while value.hasSuffix("/") {
      value.removeLast()
    }

    guard let url = URL(string: value), url.host != nil else {
      throw VectorAuthError.invalidAppURL
    }
    return url
  }

  public static func splitSetCookieHeader(_ value: String) -> [String] {
    var parts: [String] = []
    var start = value.startIndex
    var index = value.startIndex

    while index < value.endIndex {
      if value[index] == "," {
        let next = value.index(after: index)
        let rest = value[next...].trimmingCharacters(in: .whitespaces)
        let cookiePrefix = rest.prefix { character in
          character != ";" && character != ","
        }
        if cookiePrefix.contains("=") {
          parts.append(String(value[start..<index]))
          start = next
        }
      }
      index = value.index(after: index)
    }

    parts.append(String(value[start...]))
    return parts.map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }.filter { !$0.isEmpty }
  }

  private func loginWithPassword(session: VectorStoredSession, identifier: String, password: String) async throws -> VectorStoredSession {
    let trimmedIdentifier = identifier.trimmingCharacters(in: .whitespacesAndNewlines)
    let isEmail = trimmedIdentifier.contains("@")
    let path = isEmail ? "/api/auth/sign-in/email" : "/api/auth/sign-in/username"
    let bodyObject: [String: String] = isEmail
      ? ["email": trimmedIdentifier, "password": password]
      : ["username": trimmedIdentifier, "password": password]
    let body = try JSONEncoder().encode(bodyObject)
    let (_, response, nextSession) = try await authRequest(session: session, path: path, method: "POST", body: body)
    try validate(response: response)
    return nextSession
  }

  private func authRequest(
    session: VectorStoredSession,
    path: String,
    method: String,
    body: Data? = nil
  ) async throws -> (Data, URLResponse, VectorStoredSession) {
    var request = URLRequest(url: session.appURL.appending(path: path))
    request.httpMethod = method
    request.httpBody = body
    request.setValue(session.appURL.absoluteString, forHTTPHeaderField: "Origin")
    request.setValue("\(session.appURL.absoluteString)/", forHTTPHeaderField: "Referer")
    if body != nil {
      request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    }
    if !session.cookies.isEmpty {
      request.setValue(Self.cookieHeader(session.cookies), forHTTPHeaderField: "Cookie")
    }

    let (data, response) = try await transport.data(for: request)
    let nextSession = Self.applySetCookieHeaders(to: session, response: response)
    return (data, response, nextSession)
  }

  private func validate(response: URLResponse) throws {
    guard let httpResponse = response as? HTTPURLResponse else {
      throw VectorAuthError.requestFailed("Invalid server response.")
    }
    guard (200..<300).contains(httpResponse.statusCode) else {
      throw VectorAuthError.requestFailed("Request failed with HTTP \(httpResponse.statusCode).")
    }
  }

  private static func originURL(from url: URL) -> URL? {
    guard let scheme = url.scheme, let host = url.host else {
      return nil
    }
    var components = URLComponents()
    components.scheme = scheme
    components.host = host
    components.port = url.port
    return components.url
  }

  private static func isLocalAppURL(_ url: URL) -> Bool {
    let host = url.host?.lowercased()
    return host == "localhost" || host == "127.0.0.1"
  }

  private static func localDevelopmentConfig(for appURL: URL, tunnelHost: String?) -> VectorAppConfig? {
    guard isLocalAppURL(appURL), let localURL = URL(string: "http://127.0.0.1:3210") else {
      return nil
    }
    return VectorAppConfig(convexURL: localURL, tunnelHost: tunnelHost)
  }

  private static let defaultURLSession: URLSession = {
    let configuration = URLSessionConfiguration.ephemeral
    configuration.httpShouldSetCookies = false
    configuration.httpCookieAcceptPolicy = .never
    configuration.httpCookieStorage = nil
    return URLSession(configuration: configuration)
  }()

  private static func cookieHeader(_ cookies: [String: String]) -> String {
    cookies
      .sorted { $0.key < $1.key }
      .map { "\($0.key)=\($0.value)" }
      .joined(separator: "; ")
  }

  private static func applySetCookieHeaders(to session: VectorStoredSession, response: URLResponse) -> VectorStoredSession {
    guard let httpResponse = response as? HTTPURLResponse else {
      return session
    }

    var nextCookies = session.cookies
    let rawHeaders = httpResponse.allHeaderFields.compactMap { key, value -> String? in
      guard String(describing: key).lowercased() == "set-cookie" else {
        return nil
      }
      return value as? String
    }

    for rawHeader in rawHeaders {
      for rawCookie in splitSetCookieHeader(rawHeader) {
        let parts = rawCookie.split(separator: ";", omittingEmptySubsequences: false)
        guard let cookiePart = parts.first, let separator = cookiePart.firstIndex(of: "=") else {
          continue
        }

        let name = cookiePart[..<separator].trimmingCharacters(in: .whitespacesAndNewlines)
        let value = cookiePart[cookiePart.index(after: separator)...].trimmingCharacters(in: .whitespacesAndNewlines)
        let attributes = parts.dropFirst().map { $0.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() }
        let maxAge = attributes.first { $0.hasPrefix("max-age=") }
        let expires = attributes.first { $0.hasPrefix("expires=") }
        let isExpired = value.isEmpty
          || maxAge == "max-age=0"
          || (expires.flatMap { DateFormatter.vectorCookie.date(from: String($0.dropFirst(8))) }?.timeIntervalSinceNow ?? 1) <= 0

        if isExpired {
          nextCookies.removeValue(forKey: name)
        } else {
          nextCookies[name] = value
        }
      }
    }

    var nextSession = session
    nextSession.cookies = nextCookies
    return nextSession
  }
}

private extension DateFormatter {
  static let vectorCookie: DateFormatter = {
    let formatter = DateFormatter()
    formatter.locale = Locale(identifier: "en_US_POSIX")
    formatter.dateFormat = "EEE, dd MMM yyyy HH:mm:ss zzz"
    formatter.timeZone = TimeZone(secondsFromGMT: 0)
    return formatter
  }()
}

public struct VectorBetterAuthData: Equatable {
  public let session: VectorStoredSession
  public let token: String
}

public final class VectorBetterAuthProvider: AuthProvider {
  private let authClient: VectorAuthClient
  private let sessionStore: VectorSessionStore
  private var session: VectorStoredSession

  public init(session: VectorStoredSession, authClient: VectorAuthClient, sessionStore: VectorSessionStore) {
    self.session = session
    self.authClient = authClient
    self.sessionStore = sessionStore
  }

  public func login(onIdToken: @Sendable @escaping (String?) -> Void) async throws -> VectorBetterAuthData {
    try await loginFromCache(onIdToken: onIdToken)
  }

  public func loginFromCache(onIdToken: @Sendable @escaping (String?) -> Void) async throws -> VectorBetterAuthData {
    let currentSession = (try? sessionStore.load()) ?? session
    let result = try await authClient.fetchConvexToken(session: currentSession)
    session = result.session
    try? sessionStore.save(result.session)
    onIdToken(result.token)
    return VectorBetterAuthData(session: result.session, token: result.token)
  }

  public func logout() async throws {
    try await authClient.logout(session: session)
    try sessionStore.clear()
  }

  public func extractIdToken(from authResult: VectorBetterAuthData) -> String {
    authResult.token
  }
}

@MainActor
public final class VectorMobileSessionController: ObservableObject {
  public enum Phase: Equatable {
    case restoring
    case signedOut
    case authenticating
    case signedIn
  }

  @Published public private(set) var phase: Phase = .restoring
  @Published public private(set) var viewModel: VectorMobileViewModel?
  @Published public private(set) var errorMessage: String?
  @Published public private(set) var user: VectorAuthenticatedUser?
  @Published public private(set) var organizations: [VectorOrganization] = []
  @Published public private(set) var isDemoMode = false

  private let authClient: VectorAuthClient
  private let sessionStore: VectorSessionStore
  private var convexClient: ConvexClient?

  public init(
    authClient: VectorAuthClient = VectorAuthClient(),
    sessionStore: VectorSessionStore = VectorKeychainSessionStore()
  ) {
    self.authClient = authClient
    self.sessionStore = sessionStore
    Task {
      await restore()
    }
  }

  public func restore() async {
    do {
      guard let session = try sessionStore.load() else {
        phase = .signedOut
        return
      }
      try await activate(session: session, requestedOrgSlug: session.orgSlug)
    } catch {
      errorMessage = nil
      phase = .signedOut
    }
  }

  public func signIn(appURLString: String, identifier: String, password: String, orgSlug: String?) async {
    phase = .authenticating
    errorMessage = nil

    do {
      let session = try await authClient.signIn(appURLString: appURLString, identifier: identifier, password: password)
      try await activate(session: session, requestedOrgSlug: orgSlug)
    } catch {
      errorMessage = error.localizedDescription
      phase = .signedOut
    }
  }

  public func useDemoData() {
    isDemoMode = true
    user = VectorAuthenticatedUser(name: "Demo")
    organizations = [VectorOrganization(id: "demo", name: "Demo workspace", slug: VectorMobileConfiguration.demo.orgSlug)]
    convexClient = nil
    viewModel = VectorMobileViewModel(configuration: .demo, repository: MockVectorRepository())
    errorMessage = nil
    phase = .signedIn
  }

  public func signOut() {
    let client = convexClient
    Task {
      if let authClient = client as? ConvexClientWithAuth<VectorBetterAuthData> {
        await authClient.logout()
      }
      try? sessionStore.clear()
      await MainActor.run {
        self.convexClient = nil
        self.viewModel = nil
        self.user = nil
        self.organizations = []
        self.isDemoMode = false
        self.errorMessage = nil
        self.phase = .signedOut
      }
    }
  }

  private func activate(session: VectorStoredSession, requestedOrgSlug: String?) async throws {
    let provider = VectorBetterAuthProvider(session: session, authClient: authClient, sessionStore: sessionStore)
    let client = ConvexClientWithAuth<VectorBetterAuthData>(
      deploymentUrl: session.convexURL.absoluteString,
      authProvider: provider
    )

    let authResult = await client.loginFromCache()
    let authData = try authResult.get()
    let orgs = try await fetchOrganizations(client: client)
    guard !orgs.isEmpty else {
      throw VectorAuthError.noWorkspaceMembership
    }

    let selectedOrg: VectorOrganization
    if let requested = requestedOrgSlug?.trimmingCharacters(in: .whitespacesAndNewlines), !requested.isEmpty {
      guard let match = orgs.first(where: { $0.slug == requested }) else {
        throw VectorAuthError.workspaceNotFound(requested)
      }
      selectedOrg = match
    } else {
      selectedOrg = orgs[0]
    }

    var savedSession = authData.session
    savedSession.orgSlug = selectedOrg.slug
    try? sessionStore.save(savedSession)

    let configuration = VectorMobileConfiguration(
      orgSlug: selectedOrg.slug,
      convexDeploymentURL: savedSession.convexURL,
      webBaseURL: savedSession.appURL
    )
    convexClient = client
    viewModel = VectorMobileViewModel(configuration: configuration, repository: ConvexVectorRepository(client: client))
    user = savedSession.user
    organizations = orgs
    isDemoMode = false
    errorMessage = nil
    phase = .signedIn
  }

  private func fetchOrganizations(client: ConvexClient) async throws -> [VectorOrganization] {
    let publisher = client.subscribe(
      to: VectorConvexFunctions.getOrganizations,
      yielding: [VectorOrganization].self
    )

    let subscriptionTask = Task { () throws -> [VectorOrganization] in
      var latest: [VectorOrganization] = []
      for try await organizations in publisher.values {
        latest = organizations
        if !organizations.isEmpty {
          return organizations
        }
      }
      return latest
    }

    return try await withThrowingTaskGroup(of: [VectorOrganization].self) { group in
      group.addTask {
        try await subscriptionTask.value
      }
      group.addTask {
        try await Task.sleep(nanoseconds: 5_000_000_000)
        return []
      }

      let organizations = try await group.next() ?? []
      subscriptionTask.cancel()
      group.cancelAll()
      return organizations
    }
  }
}
