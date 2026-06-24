import SwiftUI
import UIKit

final class VectorAppDelegate: NSObject, UIApplicationDelegate {
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
