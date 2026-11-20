import ManagerCore
import SwiftUI

/// Shown while Clerk restores a session from the keychain.
public struct LaunchView: View {
  public init() {}

  public var body: some View {
    VStack(spacing: 14) {
      Text("Manager").managerMark()
      ProgressView()
        .controlSize(.small)
      Text("Restoring your session…")
        .font(ManagerFont.meta)
        .foregroundStyle(Color.managerMuted)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .managerBackground()
  }
}

/// The signed-out screen. The actual sign-in UI is Clerk's `AuthView`, presented
/// by the app target; this view only sets the tone and calls `onSignIn`.
public struct SignInPromptView: View {
  private let isWorking: Bool
  private let errorMessage: String?
  private let onSignIn: () -> Void

  public init(isWorking: Bool = false, errorMessage: String? = nil, onSignIn: @escaping () -> Void) {
    self.isWorking = isWorking
    self.errorMessage = errorMessage
    self.onSignIn = onSignIn
  }

  public var body: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: 18) {
        Text("Manager").managerMark()

        Text("Tasks, quietly.")
          .font(ManagerFont.display)
          .foregroundStyle(Color.managerInk)

        Text(
          "One list for everything you owe yourself. Reminders by email, calendar sync, and bots that file tasks for you while you are away."
        )
        .font(.body)
        .foregroundStyle(Color.managerMuted)
        .fixedSize(horizontal: false, vertical: true)

        Button(action: onSignIn) {
          HStack(spacing: 8) {
            if isWorking {
              ProgressView().controlSize(.small)
            }
            Text(isWorking ? "Signing in…" : "Sign in")
              .font(ManagerFont.button)
          }
          .frame(maxWidth: .infinity)
          .padding(.vertical, 12)
        }
        .managerPrimaryButton()
        .disabled(isWorking)

        if let errorMessage {
          Text(errorMessage)
            .font(ManagerFont.meta)
            .foregroundStyle(Color.managerDanger)
        }

        VStack(alignment: .leading, spacing: 6) {
          bullet("Sign in with Apple, Google or an email code.")
          bullet("The same account as manager.labdm.dev and your MCP bots.")
          bullet("Your tasks stay private to that account.")
        }
        .padding(.top, 6)
      }
      .padding(24)
      .frame(maxWidth: 520, alignment: .leading)
      .background {
        RoundedRectangle(cornerRadius: ManagerMetrics.cardRadius, style: .continuous)
          .fill(Color.managerSurface)
          .overlay {
            RoundedRectangle(cornerRadius: ManagerMetrics.cardRadius, style: .continuous)
              .strokeBorder(Color.managerBorder, lineWidth: 1)
          }
      }
      .frame(maxWidth: .infinity)
      .padding(24)
    }
    .managerBackground()
  }

  private func bullet(_ text: String) -> some View {
    HStack(alignment: .top, spacing: 8) {
      Image(systemName: "checkmark")
        .font(.system(size: 10, weight: .bold))
        .foregroundStyle(Color.managerAccent)
        .padding(.top, 4)
      Text(text)
        .font(ManagerFont.meta)
        .foregroundStyle(Color.managerMuted)
        .fixedSize(horizontal: false, vertical: true)
    }
  }
}

/// Shown when the generated plist is missing or still holds placeholders.
public struct SetupRequiredView: View {
  private let message: String

  public init(message: String) {
    self.message = message
  }

  public var body: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: 16) {
        Text("Manager").managerMark()
        Text("Almost there")
          .font(ManagerFont.display)
          .foregroundStyle(Color.managerInk)

        Text(message)
          .font(.body)
          .foregroundStyle(Color.managerDanger)
          .fixedSize(horizontal: false, vertical: true)

        Divider().overlay(Color.managerBorder)

        VStack(alignment: .leading, spacing: 10) {
          step(1, "Fill in `.env.local` files", "`packages/backend/.env.local` needs CONVEX_URL and `apps/web/.env.local` needs VITE_CLERK_PUBLISHABLE_KEY.")
          step(2, "Regenerate the Xcode project", "Run `pnpm apple:project` from the repo root.")
          step(3, "Build again", "Xcode reads the values from Config/Secrets.plist on the next build.")
        }
      }
      .padding(24)
      .frame(maxWidth: 560, alignment: .leading)
      .frame(maxWidth: .infinity)
    }
    .managerBackground()
  }

  private func step(_ number: Int, _ title: String, _ detail: String) -> some View {
    HStack(alignment: .top, spacing: 10) {
      Text("\(number)")
        .font(.system(.caption, design: .rounded).weight(.bold))
        .foregroundStyle(Color.managerAccentInk)
        .frame(width: 20, height: 20)
        .background(Circle().fill(Color.managerAccent))
      VStack(alignment: .leading, spacing: 2) {
        Text(title)
          .font(.system(.subheadline).weight(.semibold))
          .foregroundStyle(Color.managerInk)
        Text(.init(detail))
          .font(ManagerFont.meta)
          .foregroundStyle(Color.managerMuted)
          .fixedSize(horizontal: false, vertical: true)
      }
    }
  }
}
