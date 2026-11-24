import SwiftUI

/// The regular-width presentation: a centered dialog on a wide iPad and on
/// Mac. Compact width uses the system bottom sheet instead, so this is only
/// mounted when the environment says there is room for a dialog.
public struct ManagerCenteredSheet<Content: View>: View {
  private let onDismiss: () -> Void
  private let content: Content

  public init(onDismiss: @escaping () -> Void, @ViewBuilder content: () -> Content) {
    self.onDismiss = onDismiss
    self.content = content()
  }

  public var body: some View {
    ZStack {
      Color.black.opacity(0.32)
        .ignoresSafeArea()
        .contentShape(Rectangle())
        .onTapGesture(perform: onDismiss)
        .accessibilityHidden(true)

      VStack(alignment: .leading, spacing: 0) {
        content
      }
      .frame(maxWidth: 720, maxHeight: 680)
      .background(
        RoundedRectangle(cornerRadius: 20, style: .continuous)
          .fill(Color.managerSurface)
      )
      .overlay {
        RoundedRectangle(cornerRadius: 20, style: .continuous)
          .strokeBorder(Color.managerBorder, lineWidth: 1)
      }
      .shadow(radius: 24)
      .padding(24)
      .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
    .accessibilityLabel("Dialog")
  }
}
