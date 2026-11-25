import Foundation
import ManagerUI
import Testing

/// Source guards for the row-first shell. These tests run with only Command
/// Line Tools, like the rest of `pnpm apple:test`.
@Suite("Row-first chrome")
struct SheetChromeTests {
  private static let packageRoot = URL(fileURLWithPath: #filePath)
    .deletingLastPathComponent() // ManagerUITests
    .deletingLastPathComponent() // Tests
    .deletingLastPathComponent() // ManagerKit

  private static let sourcesURL = packageRoot
    .appendingPathComponent("Sources/ManagerUI")

  private func source(_ file: String) throws -> String {
    try String(contentsOf: Self.sourcesURL.appendingPathComponent(file), encoding: .utf8)
  }

  @Test("Phone uses a system TabView and regular width uses a split view")
  func adaptiveRoot() throws {
    let shell = try source("ManagerShell.swift")
    #expect(shell.contains("TabView(selection: destinationSelection)"))
    #expect(shell.contains("ForEach(ShellDestination.allCases)"))
    #expect(shell.contains(".tabItem"))
    #expect(shell.contains("NavigationSplitView"))
    #expect(shell.contains("List(selection: sidebarSelection)"))
    #expect(shell.contains("navigationDestination(for: ShellMenuRoute.self)"))
    #expect(!shell.contains("BottomTabBar"))
    #expect(!shell.contains("CategoryDashboardView"))
  }

  @Test("The menu is a pushed list with Settings")
  func menuList() throws {
    let menu = try source("MenuNavigation.swift")
    #expect(menu.contains("MenuListView"))
    #expect(menu.contains("ForEach(ShellMenuDestination.allCases)"))
    #expect(menu.contains("case .settings"))
    #expect(menu.contains("SettingsPage"))
    #expect(menu.contains("Picker(\"Activity on Tasks\""))
    #expect(!menu.contains(".tabItem"))

    let shell = try source("ManagerShell.swift")
    #expect(shell.contains("MenuButton"))
  }

  @Test("The detail starts empty and only a row tap gives it a title")
  func emptyDetail() throws {
    let detail = try source("RowDetailView.swift")
    #expect(detail.contains("Text(\"Select an item.\")"))
    #expect(detail.contains("if let row"))
    #expect(detail.contains("row.title"))

    let shell = try source("ManagerShell.swift")
    #expect(!shell.contains("onAppear"))
    #expect(shell.contains("model.selectedRow"))
  }

  @Test("Chips sit above one row list and any chip can badge")
  func chipsAndRows() throws {
    let board = try source("TaskBoardView.swift")
    #expect(board.contains("ForEach(BoardChip.allCases)"))
    #expect(board.contains("badgeCount(for: chip)"))
    #expect(board.contains("OptionalBadge"))
    #expect(board.contains("BoardRowView"))
    #expect(!board.contains("TaskList.allCases"))
    #expect(!board.contains("TextField"))
    #expect(!board.contains("Form {"))
    #expect(!board.contains(".sheet("))
  }

  @Test("Every record uses one row anatomy and ignores the card look")
  func oneRowAnatomy() throws {
    let row = try source("TaskRowView.swift")
    #expect(row.contains("BoardRowView"))
    #expect(row.contains("row.typeMark"))
    #expect(row.contains("row.title"))
    #expect(!row.contains("TaskLook"))
    #expect(!row.contains("LazyVGrid"))

    let sheet = try source("TaskSheetView.swift")
    #expect(!sheet.contains("TaskLook.allCases"))
    #expect(!sheet.contains("Task look"))
    #expect(sheet.contains("SeriesBehavior.allCases"))
    #expect(sheet.contains("SeriesCadence.allCases"))
    #expect(sheet.contains("series.detail"))
    #expect(sheet.contains("model.createSeriesTask(from: resolved)"))
    #expect(sheet.contains("model.openTask") == false)
  }

  @Test("Removed chrome files are gone")
  func removedFiles() {
    let files = ["TaskBoardScreen.swift", "BottomTabBar.swift", "CategoryDashboardView.swift"]
    for file in files {
      #expect(!FileManager.default.fileExists(atPath: Self.sourcesURL.appendingPathComponent(file).path),
              "\(file) should not be part of the shell")
    }
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
    for kind in ["category", "event", "view", "progression", "resource"] {
      #expect(sheet.contains("case .\(kind)"))
    }
  }
}
