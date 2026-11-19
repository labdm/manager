import SwiftUI

/// Liquid Glass adoption for Manager.
///
/// Glass is applied to *controls*, not to text-heavy rows or badges: a `List`
/// full of clear-glass surfaces fuses into a milky layer that hides the task
/// titles, and wrapping `NavigationStack`/`NavigationSplitView` in a
/// `GlassEffectContainer` collapses the regular-width columns. Buttons are the
/// idiomatic place for `.glass` / `.glassProminent`, and the fallback below is
/// byte-for-byte the pre-glass button style for iOS 17 / macOS 14.
public enum ManagerGlass {
  public struct PrimaryButton: ViewModifier {
    public init() {}

    public func body(content: Content) -> some View {
      Group {
        if #available(iOS 26.0, macOS 26.0, *) {
          content.buttonStyle(.glassProminent).tint(Color.managerAccent)
        } else {
          content.buttonStyle(.borderedProminent).tint(Color.managerAccent)
        }
      }
    }
  }

  public struct SecondaryButton: ViewModifier {
    public init() {}

    public func body(content: Content) -> some View {
      Group {
        if #available(iOS 26.0, macOS 26.0, *) {
          content.buttonStyle(.glass)
        } else {
          content.buttonStyle(.plain)
        }
      }
    }
  }
}

public extension View {
  /// Prominent action button: prominent glass on 26+, tinted filled button below.
  func managerPrimaryButton() -> some View {
    modifier(ManagerGlass.PrimaryButton())
  }

  /// Secondary action button: glass on 26+, plain button below.
  func managerButton() -> some View {
    modifier(ManagerGlass.SecondaryButton())
  }
}
