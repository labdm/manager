import Foundation

/// Where the app points and who it signs in with.
///
/// Values come from the generated `Config/Secrets.plist` (or Info.plist).
/// Process environment overrides are honoured so tests and CI can point at a
/// throwaway deployment without touching the app bundle.
public struct AppConfiguration: Equatable, Sendable {
  public let deploymentURL: URL
  public let clerkPublishableKey: String

  public static let deploymentInfoKey = "ManagerConvexDeploymentURL"
  public static let clerkKeyInfoKey = "ManagerClerkPublishableKey"
  public static let deploymentEnvironmentKey = "MANAGER_CONVEX_URL"
  public static let clerkKeyEnvironmentKey = "MANAGER_CLERK_PUBLISHABLE_KEY"
  public static let deploymentSecretKey = "CONVEX_URL"
  public static let clerkKeySecretKey = "CLERK_PUBLISHABLE_KEY"

  public init(deploymentURL: String, clerkPublishableKey: String) throws {
    let urlText = deploymentURL.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !urlText.isEmpty, !Self.isPlaceholder(urlText) else {
      throw ValidationError.missingDeploymentURL
    }
    guard
      let url = URL(string: urlText),
      let scheme = url.scheme?.lowercased(),
      let host = url.host,
      !host.isEmpty
    else {
      throw ValidationError.invalidDeploymentURL(urlText)
    }
    guard scheme == "https" || (scheme == "http" && Self.isLocal(host: host)) else {
      throw ValidationError.insecureDeploymentURL(urlText)
    }

    let keyText = clerkPublishableKey.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !keyText.isEmpty, !Self.isPlaceholder(keyText) else {
      throw ValidationError.missingPublishableKey
    }
    guard keyText.hasPrefix("pk_test_") || keyText.hasPrefix("pk_live_") else {
      throw ValidationError.invalidPublishableKey
    }

    self.deploymentURL = url
    self.clerkPublishableKey = keyText
  }

  /// Resolves the configuration from a bundle's Info.plist, an optional
  /// `Secrets.plist` resource, and environment overrides.
  ///
  /// Precedence, lowest to highest: Info.plist, `Secrets.plist`, process
  /// environment. The generated `Config/Secrets.plist` keeps local values out
  /// of source, and the environment override lets tests and CI point elsewhere.
  public static func resolve(
    info: [String: Any] = [:],
    environment: [String: String] = ProcessInfo.processInfo.environment,
    secrets: [String: String] = [:]
  ) throws -> AppConfiguration {
    let deployment = environment[deploymentEnvironmentKey]
      ?? secrets[deploymentSecretKey]
      ?? info[deploymentInfoKey] as? String
      ?? ""
    let clerkKey = environment[clerkKeyEnvironmentKey]
      ?? secrets[clerkKeySecretKey]
      ?? info[clerkKeyInfoKey] as? String
      ?? ""

    return try AppConfiguration(deploymentURL: deployment, clerkPublishableKey: clerkKey)
  }

  /// Host shown in Settings, never the full URL with query or key material.
  public var deploymentHost: String {
    deploymentURL.host ?? deploymentURL.absoluteString
  }

  public var isLoopback: Bool {
    guard let host = deploymentURL.host?.lowercased() else { return false }
    return Self.isLocal(host: host)
  }

  private static func isLocal(host: String) -> Bool {
    host == "localhost" || host == "127.0.0.1" || host == "::1"
  }

  /// Fresh clones carry placeholders, and an unsubstituted `$(NAME)` means a
  /// value was never filled in. Both mean "not configured yet".
  private static func isPlaceholder(_ value: String) -> Bool {
    value.hasPrefix("$(") || value.hasPrefix("<") || value.uppercased().contains("REPLACE_ME")
  }
}

extension AppConfiguration {
  public enum ValidationError: Error, Equatable, Sendable, LocalizedError {
    case missingDeploymentURL
    case invalidDeploymentURL(String)
    case insecureDeploymentURL(String)
    case missingPublishableKey
    case invalidPublishableKey

    public var errorDescription: String? {
      switch self {
      case .missingDeploymentURL:
        "No Convex deployment URL. Run `pnpm apple:project` so Config/Secrets.plist is generated."
      case let .invalidDeploymentURL(value):
        "The Convex deployment URL is not a URL: \(value)"
      case let .insecureDeploymentURL(value):
        "The Convex deployment URL must use https (http is allowed for localhost only): \(value)"
      case .missingPublishableKey:
        "No Clerk publishable key. Run `pnpm apple:project` so Config/Secrets.plist is generated."
      case .invalidPublishableKey:
        "The Clerk publishable key must start with pk_test_ or pk_live_."
      }
    }
  }
}
