import ClerkKit
import ClerkKitUI
import ConvexMobile
import ManagerCore
import ManagerData
import ManagerUI
import SwiftUI

/// Chooses between setup, sign-in and the board.
struct RootView: View {
  let environment: AppEnvironment

  var body: some View {
    switch environment.state {
    case let .misconfigured(error):
      // Deliberately does not touch `Clerk.shared`: it traps before
      // `Clerk.configure` has run, and that is exactly this branch.
      SetupRequiredView(message: error.localizedDescription)
    case let .ready(services):
      AuthGate(services: services)
        // ClerkKitUI's AuthView, UserButton and UserProfileView read Clerk
        // from the environment; inject the shared instance once.
        .environment(Clerk.shared)
    }
  }
}

/// Mirrors Convex's auth state into the UI and owns the board for the session.
private struct AuthGate: View {
  let services: ManagerServices

  @State private var board: TaskBoardModel
  @State private var authState: AuthState<String> = .loading
  @State private var isAuthPresented = false

  init(services: ManagerServices) {
    self.services = services
    _board = State(initialValue: TaskBoardModel(backend: services.backend))
  }

  var body: some View {
    Group {
      switch authState {
      case .loading:
        LaunchView()
      case .unauthenticated:
        SignInPromptView(isWorking: false) {
          isAuthPresented = true
        }
      case .authenticated:
        ManagerShell(model: board) {
          AccountButton()
        }
      }
    }
    .sheet(isPresented: $isAuthPresented) {
      AuthView()
    }
    .task {
      await observeAuth()
    }
  }

  /// `ConvexClientWithAuth.authState` already reflects Clerk changes (the
  /// Clerk provider syncs sign-in, token refresh and sign-out), so the app only
  /// has to start and stop the live query alongside it.
  private func observeAuth() async {
    for await state in services.client.authState.values {
      authState = state
      switch state {
      case .authenticated:
        isAuthPresented = false
        board.start()
      case .unauthenticated:
        board.stop()
      case .loading:
        break
      }
    }
  }
}

private struct AccountButton: View {
  var body: some View {
    UserButton()
      .frame(width: 28, height: 28)
      .accessibilityLabel("Account")
  }
}
