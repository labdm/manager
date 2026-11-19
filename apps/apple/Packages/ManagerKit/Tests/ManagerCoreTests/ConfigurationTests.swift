import Foundation
import Testing
@testable import ManagerCore

@Suite("Configuration")
struct AppConfigurationTest {
  @Test("Accepts a production deployment and key")
  func valid() throws {
    let configuration = try AppConfiguration(
      deploymentURL: "https://example.convex.cloud",
      clerkPublishableKey: "pk_test_abc"
    )
    #expect(configuration.deploymentURL.host == "example.convex.cloud")
    #expect(configuration.deploymentHost == "example.convex.cloud")
    #expect(!configuration.isLoopback)
  }

  @Test("Allows http only on loopback")
  func loopback() throws {
    let local = try AppConfiguration(
      deploymentURL: "http://127.0.0.1:3210",
      clerkPublishableKey: "pk_test_abc"
    )
    #expect(local.isLoopback)

    #expect(throws: AppConfiguration.ValidationError.self) {
      try AppConfiguration(
        deploymentURL: "http://example.convex.cloud",
        clerkPublishableKey: "pk_test_abc"
      )
    }
  }

  @Test("Rejects placeholders and empty values")
  func placeholders() {
    #expect(throws: AppConfiguration.ValidationError.missingDeploymentURL) {
      try AppConfiguration(deploymentURL: "", clerkPublishableKey: "pk_test_abc")
    }
    #expect(throws: AppConfiguration.ValidationError.missingDeploymentURL) {
      try AppConfiguration(deploymentURL: "$(MANAGER_CONVEX_URL)", clerkPublishableKey: "pk_test_abc")
    }
    #expect(throws: AppConfiguration.ValidationError.missingPublishableKey) {
      try AppConfiguration(deploymentURL: "https://example.convex.cloud", clerkPublishableKey: "")
    }
    #expect(throws: AppConfiguration.ValidationError.invalidPublishableKey) {
      try AppConfiguration(deploymentURL: "https://example.convex.cloud", clerkPublishableKey: "pk_")
    }
  }

  @Test("Rejects keys that are not Clerk publishable keys")
  func invalidKey() {
    #expect(throws: AppConfiguration.ValidationError.invalidPublishableKey) {
      try AppConfiguration(
        deploymentURL: "https://example.convex.cloud",
        clerkPublishableKey: "secret_key"
      )
    }
  }

  @Test("Info.plist values are used, secrets and environment win over it")
  func resolution() throws {
    let info: [String: Any] = [
      AppConfiguration.deploymentInfoKey: "https://plist.convex.cloud",
      AppConfiguration.clerkKeyInfoKey: "pk_test_plist",
    ]

    let fromInfo = try AppConfiguration.resolve(info: info, environment: [:])
    #expect(fromInfo.deploymentHost == "plist.convex.cloud")

    let fromSecrets = try AppConfiguration.resolve(
      info: info,
      environment: [:],
      secrets: [
        AppConfiguration.deploymentSecretKey: "https://secrets.convex.cloud",
        AppConfiguration.clerkKeySecretKey: "pk_test_secrets",
      ]
    )
    #expect(fromSecrets.deploymentHost == "secrets.convex.cloud")
    #expect(fromSecrets.clerkPublishableKey == "pk_test_secrets")

    let overridden = try AppConfiguration.resolve(
      info: info,
      environment: [
        AppConfiguration.deploymentEnvironmentKey: "http://localhost:3210",
        AppConfiguration.clerkKeyEnvironmentKey: "pk_test_env",
      ],
      secrets: [AppConfiguration.deploymentSecretKey: "https://secrets.convex.cloud"]
    )
    #expect(overridden.deploymentHost == "localhost")
    #expect(overridden.clerkPublishableKey == "pk_test_env")
  }

  @Test("Explains how to fix a missing configuration")
  func messages() {
    let error = AppConfiguration.ValidationError.missingDeploymentURL
    #expect(error.errorDescription?.contains("pnpm apple:project") == true)
  }
}
