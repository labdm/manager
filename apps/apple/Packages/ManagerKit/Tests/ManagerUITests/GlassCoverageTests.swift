import Foundation
import ManagerUI
import Testing

/// Regression guards for Liquid Glass in the row-first shell. Glass belongs on
/// controls; text-heavy rows, the detail pane and the split view stay opaque.
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

  @Test("The adaptive root has no glass fusion container")
  func navigationRootHasNoGlassContainer() throws {
    let shell = try source("ManagerShell.swift")
    #expect(!shell.contains("GlassEffectContainer"))
    #expect(!shell.contains("ManagerGlass.Container"))
    #expect(shell.contains("TabView"))
    #expect(shell.contains("NavigationSplitView"))
    #expect(shell.contains("navigationDestination"))
    #expect(!shell.contains("BottomTabBar"))
    #expect(!shell.contains("fullScreenCover"))
  }

  @Test("Text-heavy surfaces keep their opaque styling")
  func textSurfacesStayOpaque() throws {
    let files = [
      "TaskBoardView.swift",
      "TaskRowView.swift",
      "RowDetailView.swift",
      "Components/Indicators.swift",
      "Components/Sections.swift",
    ]
    for file in files {
      let text = try source(file)
      #expect(!text.contains(".managerGlass("), "\(file) puts glass on text content")
      #expect(!text.contains(".glassEffect("), "\(file) puts glass on text content")
    }
  }

  @Test("Prominent actions still adopt glass through ManagerGlass")
  func prominentActionsAdoptGlass() throws {
    let shell = try source("ManagerShell.swift")
    let menu = try source("MenuNavigation.swift")
    let onboarding = try source("OnboardingViews.swift")
    #expect(shell.contains(".managerPrimaryButton()"))
    #expect(menu.contains(".managerButton()"))
    #expect(onboarding.contains(".managerPrimaryButton()"))
  }
}
