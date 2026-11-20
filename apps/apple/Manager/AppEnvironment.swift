import ClerkKit
import ConvexMobile
import Foundation
import ManagerCore
import ManagerData

/// Everything the app needs that must be built exactly once per process:
/// the validated configuration, the Clerk-backed Convex client, and the board.
@MainActor
final class AppEnvironment {
  enum State {
    /// Missing or unusable `Config/Secrets.plist`; the app shows setup steps.
    case misconfigured(AppConfiguration.ValidationError)
    case ready(ManagerServices)
  }

  let state: State
  let configuration: AppConfiguration?

  init(bundle: Bundle = .main) {
    do {
      let configuration = try AppConfiguration.resolve(
        info: bundle.infoDictionary ?? [:],
        environment: ProcessInfo.processInfo.environment,
        secrets: Self.secrets(in: bundle)
      )

      #if DEBUG
        // Logs websocket traffic to OSLog. Debug builds only: the payload can
        // contain task text.
        initConvexLogging()
      #endif

      // Clerk must be configured before the Convex client binds its provider.
      Clerk.configure(publishableKey: configuration.clerkPublishableKey)

      self.configuration = configuration
      self.state = .ready(ManagerServices(configuration: configuration))
    } catch let error as AppConfiguration.ValidationError {
      self.configuration = nil
      self.state = .misconfigured(error)
    } catch {
      self.configuration = nil
      self.state = .misconfigured(.missingDeploymentURL)
    }
  }

  /// Reads the plist written by `scripts/apple-project.sh` from the app bundle.
  private static func secrets(in bundle: Bundle) -> [String: String] {
    guard
      let url = bundle.url(forResource: "Secrets", withExtension: "plist"),
      let data = try? Data(contentsOf: url),
      let raw = try? PropertyListSerialization.propertyList(from: data, format: nil),
      let dictionary = raw as? [String: Any]
    else {
      return [:]
    }
    return dictionary.compactMapValues { $0 as? String }
  }
}
