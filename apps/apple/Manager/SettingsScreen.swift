import ClerkKit
import ClerkKitUI
import ManagerCore
import ManagerUI
import SwiftUI

/// macOS Settings window. iOS reaches the same things through `UserButton`.
struct SettingsScreen: View {
  let configuration: AppConfiguration?

  @State private var isProfilePresented = false

  var body: some View {
    Form {
      Section("Account") {
        Button("Manage account…") {
          isProfilePresented = true
        }
      }

      Section("Backend") {
        LabeledContent("Deployment", value: configuration?.deploymentHost ?? "Not configured")
        LabeledContent("Scheme", value: configuration?.deploymentURL.scheme?.uppercased() ?? "—")
        Text("Live queries over Convex. The same deployment as manager.labdm.dev and the MCP bots.")
          .font(.footnote)
          .foregroundStyle(.secondary)
      }

      Section("About") {
        LabeledContent("Manager", value: Self.version)
        Link("Open the web app", destination: URL(string: "https://manager.labdm.dev")!)
      }
    }
    .formStyle(.grouped)
    .frame(minWidth: 420, minHeight: 420)
    .sheet(isPresented: $isProfilePresented) {
      UserProfileView(isDismissible: true)
    }
  }

  private static var version: String {
    let info = Bundle.main.infoDictionary
    let short = info?["CFBundleShortVersionString"] as? String ?? "0.1.0"
    let build = info?["CFBundleVersion"] as? String ?? "1"
    return "\(short) (\(build))"
  }
}
