import SwiftUI
import UIKit
import UserNotifications

final class VectorAppDelegate: NSObject, UIApplicationDelegate {
  func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    UNUserNotificationCenter.current().delegate = VectorPushNotificationCoordinator.shared
    return true
  }

  func application(
    _ application: UIApplication,
    didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data
  ) {
    Task { @MainActor in
      VectorPushNotificationCoordinator.shared.updateDeviceToken(deviceToken)
    }
  }

  func application(
    _ application: UIApplication,
    didFailToRegisterForRemoteNotificationsWithError error: Error
  ) {
    Task { @MainActor in
      VectorPushNotificationCoordinator.shared.updateRegistrationError(error)
    }
  }
}

@main
struct VectorApp: App {
  @UIApplicationDelegateAdaptor(VectorAppDelegate.self) private var appDelegate

  var body: some Scene {
    WindowGroup {
      VectorMobileRootView()
    }
  }
}
