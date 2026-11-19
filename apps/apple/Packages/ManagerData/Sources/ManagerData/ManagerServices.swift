import ClerkConvex
import ConvexMobile
import Foundation
import ManagerCore

/// The signed-in Convex client plus the board backend that uses it.
@MainActor
public struct ManagerServices {
  public let client: ConvexClientWithAuth<String>
  public let backend: ConvexTaskBackend

  public init(configuration: AppConfiguration) {
    // `Clerk.configure(publishableKey:)` must run before this initializer: the
    // Clerk provider binds to the client and starts session sync immediately.
    let client = ConvexClientWithAuth(
      deploymentUrl: configuration.deploymentURL.absoluteString,
      authProvider: ClerkConvexAuthProvider()
    )
    self.client = client
    self.backend = ConvexTaskBackend(client: client)
  }
}
