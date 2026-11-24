import SwiftUI

#if canImport(UIKit)
  import UIKit
#elseif canImport(AppKit)
  import AppKit
#endif

/// The paper-and-ink palette shared with the web app (`packages/ui/src/tasks.css`),
/// expressed as dynamic colors so dark mode is a real mode, not an afterthought.
public extension Color {
  /// Page background: warm paper in light, warm black in dark.
  static let managerPaper = Color(light: 0xF3EFE4, dark: 0x14120F)
  /// Cards and rows.
  static let managerSurface = Color(light: 0xFFFDF8, dark: 0x1E1B17)
  /// Inputs and raised chips.
  static let managerRaised = Color(light: 0xFFFFFF, dark: 0x272219)
  /// Hairlines.
  static let managerBorder = Color(light: 0xE4DCCB, dark: 0x352F26)
  /// Primary text.
  static let managerInk = Color(light: 0x1C1915, dark: 0xF2EDE3)
  /// Secondary text.
  static let managerMuted = Color(light: 0x6F675C, dark: 0xA79E90)
  /// The green from the web UI.
  static let managerAccent = Color(light: 0x0F6E56, dark: 0x5ACBAD)
  /// Text and glyphs drawn on top of the accent.
  static let managerAccentInk = Color(light: 0xF7F3EA, dark: 0x08221B)
  /// Errors and overdue dates.
  static let managerDanger = Color(light: 0x8D2C1F, dark: 0xF09A8B)

  /// Palette tokens from a view's `color` string. An unknown token falls back
  /// to muted ink instead of trapping, so a newer client's template is safe.
  static func boardColor(_ token: String) -> Color {
    switch token {
    case "sky": Color(light: 0x2D7FF9, dark: 0x7FB6FF)
    case "mint", "teal", "green": managerAccent
    case "amber", "yellow", "orange": .orange
    case "rose", "red", "pink": managerDanger
    case "violet", "purple", "indigo": .purple
    case "blue": .blue
    case "slate", "gray": managerMuted
    default: managerMuted
    }
  }

  init(light: UInt32, dark: UInt32) {
    #if canImport(UIKit)
      self.init(
        uiColor: UIColor { traits in
          UIColor(hex: traits.userInterfaceStyle == .dark ? dark : light)
        }
      )
    #elseif canImport(AppKit)
      self.init(
        nsColor: NSColor(name: nil) { appearance in
          let isDark = appearance.bestMatch(from: [.aqua, .darkAqua]) == .darkAqua
          return NSColor(hex: isDark ? dark : light)
        }
      )
    #else
      self.init(red: 0.5, green: 0.5, blue: 0.5)
    #endif
  }
}

/// Typography. Serif for display (like the web's Iowan Old Style), system for
/// everything that has to stay legible at 11pt on a car mount or a Mac menu.
public enum ManagerFont {
  public static var mark: Font { .system(.caption, design: .default).weight(.semibold) }
  public static var display: Font { .system(.largeTitle, design: .serif).weight(.regular) }
  public static var title: Font { .system(.title3, design: .serif).weight(.regular) }
  public static var rowTitle: Font { .system(.body) }
  public static var meta: Font { .system(.footnote) }
  public static var button: Font { .system(.callout).weight(.semibold) }
}

/// Shared spacing and shapes.
public enum ManagerMetrics {
  public static let contentMaxWidth: CGFloat = 680
  public static let cardRadius: CGFloat = 18
  public static let rowSpacing: CGFloat = 10
  public static let screenPadding: CGFloat = 16
}

public extension View {
  /// Paints the paper background behind a screen, including under the sidebar.
  func managerBackground() -> some View {
    background(Color.managerPaper.ignoresSafeArea())
  }

  /// The all-caps brand mark above a title.
  func managerMark() -> some View {
    font(ManagerFont.mark)
      .tracking(1.8)
      .textCase(.uppercase)
      .foregroundStyle(Color.managerAccent)
  }
}

// MARK: - Platform color helpers

#if canImport(UIKit)
  private extension UIColor {
    convenience init(hex: UInt32) {
      self.init(
        red: CGFloat((hex >> 16) & 0xFF) / 255,
        green: CGFloat((hex >> 8) & 0xFF) / 255,
        blue: CGFloat(hex & 0xFF) / 255,
        alpha: 1
      )
    }
  }
#elseif canImport(AppKit)
  private extension NSColor {
    convenience init(hex: UInt32) {
      self.init(
        srgbRed: CGFloat((hex >> 16) & 0xFF) / 255,
        green: CGFloat((hex >> 8) & 0xFF) / 255,
        blue: CGFloat(hex & 0xFF) / 255,
        alpha: 1
      )
    }
  }
#endif
