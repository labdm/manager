import SwiftUI

/// Wraps a row's content so it stays centered and readable in wide windows
/// (Mac, iPad landscape, unfolded iPhone Duo) instead of stretching edge to edge.
public struct CenteredRow<Content: View>: View {
  private let maxWidth: CGFloat
  private let content: Content

  public init(
    maxWidth: CGFloat = ManagerMetrics.contentMaxWidth,
    @ViewBuilder content: () -> Content
  ) {
    self.maxWidth = maxWidth
    self.content = content()
  }

  public var body: some View {
    HStack(spacing: 0) {
      Spacer(minLength: 0)
      content.frame(maxWidth: maxWidth)
      Spacer(minLength: 0)
    }
  }
}
