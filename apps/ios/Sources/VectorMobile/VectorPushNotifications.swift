import Combine
import Foundation
import UserNotifications
#if os(iOS)
  import UIKit
#endif

public enum VectorPushAuthorizationStatus: String, Equatable, Sendable {
  case unknown
  case notDetermined
  case denied
  case authorized
  case provisional
  case ephemeral

  public var label: String {
    switch self {
    case .unknown: "Unknown"
    case .notDetermined: "Not asked"
    case .denied: "Denied"
    case .authorized: "Allowed"
    case .provisional: "Provisional"
    case .ephemeral: "Ephemeral"
    }
  }

  public var allowsRemoteRegistration: Bool {
    switch self {
    case .authorized, .provisional, .ephemeral:
      true
    case .unknown, .notDetermined, .denied:
      false
    }
  }
}

public struct VectorPushDeviceToken: Equatable, Sendable {
  public let value: String
  public let environment: String

  public init(value: String, environment: String) {
    self.value = value
    self.environment = environment
  }
}

@MainActor
public protocol VectorPushNotificationCoordinating: ObservableObject {
  var authorizationStatus: VectorPushAuthorizationStatus { get }
  var deviceToken: VectorPushDeviceToken? { get }
  var registrationError: String? { get }

  func refreshAuthorizationStatus() async
  func requestRegistration() async
  func registerForRemoteNotificationsIfAuthorized() async
  func clearRegistration()
}

@MainActor
public final class VectorPushNotificationCoordinator: NSObject, VectorPushNotificationCoordinating, UNUserNotificationCenterDelegate {
  public static let shared = VectorPushNotificationCoordinator()

  @Published public private(set) var authorizationStatus: VectorPushAuthorizationStatus = .unknown
  @Published public private(set) var deviceToken: VectorPushDeviceToken?
  @Published public private(set) var registrationError: String?
  @Published public private(set) var pendingNotificationHref: String?

  private override init() {
    super.init()
  }

  public func refreshAuthorizationStatus() async {
    let settings = await UNUserNotificationCenter.current().notificationSettings()
    authorizationStatus = VectorPushAuthorizationStatus(settings.authorizationStatus)
  }

  public func requestRegistration() async {
    registrationError = nil
    UNUserNotificationCenter.current().delegate = self

    do {
      let granted = try await UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .badge, .sound])
      await refreshAuthorizationStatus()
      guard granted else {
        registrationError = "Notification permission was not granted."
        return
      }
      #if os(iOS)
        UIApplication.shared.registerForRemoteNotifications()
      #endif
    } catch {
      registrationError = error.localizedDescription
    }
  }

  public func registerForRemoteNotificationsIfAuthorized() async {
    registrationError = nil
    UNUserNotificationCenter.current().delegate = self
    await refreshAuthorizationStatus()
    guard authorizationStatus.allowsRemoteRegistration else {
      return
    }

    #if os(iOS)
      UIApplication.shared.registerForRemoteNotifications()
    #endif
  }

  public func updateDeviceToken(_ data: Data) {
    deviceToken = VectorPushDeviceToken(value: data.vectorHexEncodedString, environment: Self.apnsEnvironment)
    registrationError = nil
  }

  public func updateRegistrationError(_ error: Error) {
    registrationError = error.localizedDescription
  }

  public func clearRegistration() {
    deviceToken = nil
    registrationError = nil
  }

  public func consumePendingNotificationHref() {
    pendingNotificationHref = nil
  }

  public nonisolated func userNotificationCenter(
    _ center: UNUserNotificationCenter,
    willPresent notification: UNNotification
  ) async -> UNNotificationPresentationOptions {
    [.banner, .list, .sound]
  }

  public nonisolated func userNotificationCenter(
    _ center: UNUserNotificationCenter,
    didReceive response: UNNotificationResponse
  ) async {
    let href = (response.notification.request.content.userInfo["href"] as? String)?
      .trimmingCharacters(in: .whitespacesAndNewlines)
    await MainActor.run {
      pendingNotificationHref = href?.isEmpty == false ? href : nil
    }
  }

  private static var apnsEnvironment: String {
    #if DEBUG
      "sandbox"
    #else
      "production"
    #endif
  }
}

private extension VectorPushAuthorizationStatus {
  init(_ status: UNAuthorizationStatus) {
    switch status {
    case .notDetermined:
      self = .notDetermined
    case .denied:
      self = .denied
    case .authorized:
      self = .authorized
    case .provisional:
      self = .provisional
    case .ephemeral:
      self = .ephemeral
    @unknown default:
      self = .unknown
    }
  }
}

private extension Data {
  var vectorHexEncodedString: String {
    map { String(format: "%02x", $0) }.joined()
  }
}
