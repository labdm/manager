import Foundation
import ManagerUI
import Testing

/// Regression guards for the Liquid Glass redesign.
///
/// The first version of the redesign wrapped `NavigationSplitView` in a
/// `GlassEffectContainer` and put clear-glass surfaces on every row, badge and
/// checkbox. That collapsed the Mac detail column and washed out task titles.
/// Glass belongs on controls; text-heavy rows keep their opaque paper styling.
@Suite("Liquid Glass")
struct GlassCoverageTests {
  private static let packageRoot = URL(fileURLWithPath: #filePath)
    .deletingLastPathComponent() // ManagerUITests
    .deletingLastPathComponent() // Tests
    .deletingLastPathComponent() // ManagerKit

  private static let sourcesURL = packageRoot
    .appendingPathComponent("Sources/ManagerUI")

  private func source(_ file: String) throws -> String {
    try String(contentsOf: Self.sourcesURL.appendingPathComponent(file), encoding: .utf8)
  }

  @Test("Glass is availability-gated and uses native button styles")
  func glassUsesNativeButtonStyles() throws {
    let theme = try source("GlassTheme.swift")
    #expect(theme.contains("#available(iOS 26.0, macOS 26.0, *)"))
    #expect(theme.contains("buttonStyle(.glassProminent)"))
    #expect(theme.contains("buttonStyle(.glass)"))
    #expect(theme.contains("buttonStyle(.borderedProminent)"))
    #expect(theme.contains("#if compiler(>=6.2)"))
  }

  @Test("Navigation root is not wrapped in a glass fusion container")
  func navigationRootHasNoGlassContainer() throws {
    let screen = try source("TaskBoardScreen.swift")
    #expect(!screen.contains("GlassEffectContainer"))
    #expect(!screen.contains("ManagerGlass.Container"))
    #expect(!screen.contains("NavigationSplitView"))
    #expect(screen.contains("NavigationStack"))
    #expect(screen.contains("BottomTabBar"))
    #expect(screen.contains("fullScreenCover"))
  }

  @Test("Text-heavy surfaces keep their opaque styling")
  func textSurfacesStayOpaque() throws {
    let files = [
      "TaskBoardView.swift",
      "TaskRowView.swift",
      "CategoryDashboardView.swift",
      "Components/Indicators.swift",
      "Components/Sections.swift",
    ]
    for file in files {
      let text = try source(file)
      #expect(!text.contains(".managerGlass("), "\(file) puts glass on text content")
      #expect(!text.contains(".glassEffect("), "\(file) puts glass on text content")
    }
  }

  @Test("Prominent actions still adopt glass")
  func prominentActionsAdoptGlass() throws {
    let tabBar = try source("BottomTabBar.swift")
    let onboarding = try source("OnboardingViews.swift")
    #expect(tabBar.contains(".managerPrimaryButton()"))
    #expect(onboarding.contains(".managerPrimaryButton()"))
  }
}
