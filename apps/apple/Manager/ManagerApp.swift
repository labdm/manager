import ClerkKit
import ManagerCore
import ManagerData
import ManagerUI
import SwiftUI

@main
struct ManagerApp: App {
  @State private var environment = AppEnvironment()

  var body: some Scene {
    WindowGroup {
      RootView(environment: environment)
        .tint(Color.managerAccent)
    }
    #if os(macOS)
      .defaultSize(width: 940, height: 720)
      .windowToolbarStyle(.unified)
    #endif

    #if os(macOS)
      Settings {
        // `Clerk.shared` traps when Clerk has not been configured, so the
        // settings window must not be built on a misconfigured launch.
        if environment.configuration != nil {
          SettingsScreen(configuration: environment.configuration)
            .environment(Clerk.shared)
        } else {
          Text("Set up Manager to see account settings.")
            .padding(24)
        }
      }
    #endif
  }
}
