import Foundation
import ManagerUI
import Testing

/// Source guards for the sheets-and-bottom-tabs chrome. These tests run with
/// only Command Line Tools, like the rest of `pnpm apple:test`.
@Suite("Sheet chrome")
struct SheetChromeTests {
  private static let sourcesURL = URL(fileURLWithPath: #filePath)
    .deletingLastPathComponent() // ManagerUITests
    .deletingLastPathComponent() // Tests
    .deletingLastPathComponent() // ManagerKit
    .appendingPathComponent("Sources/ManagerUI")

  private func source(_ file: String) throws -> String {
    try String(contentsOf: Self.sourcesURL.appendingPathComponent(file), encoding: .utf8)
  }

  @Test("The root has no side rail or split view")
  func noSidebar() throws {
    let screen = try source("TaskBoardScreen.swift")
    #expect(!screen.contains("TaskSidebar"))
    #expect(!screen.contains("NavigationSplitView"))
    #expect(!screen.contains("List(selection"))
    #expect(screen.contains("BottomTabBar"))
    #expect(screen.contains("ManagerCenteredSheet"))
    #expect(screen.contains("CategoryDashboardView"))
    #expect(screen.contains(".sheet(item:"))
    #expect(screen.contains("fullScreenCover"))
    #expect(screen.contains("usesBottomSheet"))
  }

  @Test("The tab bar carries the four slices, a grid and a plus")
  func bottomBar() throws {
    let bar = try source("BottomTabBar.swift")
    #expect(bar.contains("BoardSlice.allCases"))
    #expect(bar.contains("slice.title"))
    let slices = try source("../ManagerCore/BoardDomain.swift")
    for title in ["\"Tasks\"", "\"Daily\"", "\"Weekly\"", "\"Monthly\""] {
      #expect(slices.contains(title))
    }
    #expect(bar.contains("square.grid.2x2"))
    #expect(bar.contains("model.openDashboard()"))
    #expect(bar.contains("model.beginTask()"))
    #expect(bar.contains(".managerPrimaryButton()"))
    #expect(bar.contains(".managerButton()"))
  }

  @Test("A create action never inserts a form into the column")
  func noInlineForm() throws {
    let board = try source("TaskBoardView.swift")
    #expect(!board.contains("TaskComposerView"))
    #expect(!board.contains("TaskEditorView"))
    #expect(!board.contains("EntitySheetView"))
    #expect(!board.contains("TextField"))
    #expect(!board.contains("Form {"))
    #expect(!board.contains(".sheet("))
    #expect(board.contains("model.openTask(task)"))

    let screen = try source("TaskBoardScreen.swift")
    #expect(screen.contains("sheetContent(target)"))
  }

  @Test("The dashboard is a full-screen grid of category tiles")
  func dashboardGrid() throws {
    let dashboard = try source("CategoryDashboardView.swift")
    #expect(dashboard.contains("LazyVGrid"))
    #expect(dashboard.contains("model.dashboardTiles"))
    #expect(dashboard.contains("model.selectDashboardTile(tile)"))
    #expect(dashboard.contains("Add category"))
    #expect(!dashboard.contains("NavigationSplitView"))
    #expect(!dashboard.contains("List(selection"))
  }

  @Test("Appearance uses a searchable grid, swatches and a preview")
  func appearancePicker() throws {
    let picker = try source("AppearancePicker.swift")
    #expect(picker.contains("TextField(\"Search icons\""))
    #expect(picker.contains("IconChoice.search(query)"))
    #expect(picker.contains("Appearance.colorTokens"))
    #expect(picker.contains("Appearance.symbol(for: icon)"))
    #expect(picker.contains("Appearance preview"))
    #expect(!picker.contains("TextField(\"Icon name"))
    #expect(!picker.contains("TextField(\"Color token"))

    let sheet = try source("EntitySheetView.swift")
    #expect(sheet.contains("AppearancePicker("))
    #expect(!sheet.contains("TextField(\"Icon name"))
    #expect(!sheet.contains("TextField(\"Color token"))
    for kind in ["category", "event", "view", "progression", "resource"] {
      #expect(sheet.contains("case .\(kind)"))
    }
  }

  @Test("The task sheet offers check/row/card and explicit series choices")
  func taskSheetChoices() throws {
    let form = try source("TaskSheetView.swift")
    #expect(form.contains("TaskLook.allCases"))
    #expect(form.contains("SeriesBehavior.allCases"))
    #expect(form.contains("SeriesCadence.allCases"))
    #expect(form.contains("series.detail"))
    #expect(form.contains("model.createSeriesTask(from: resolved)"))
    #expect(form.contains("model.openTask") == false)
  }
}
