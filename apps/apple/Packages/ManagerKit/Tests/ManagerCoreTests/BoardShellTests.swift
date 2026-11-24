import Foundation
import Testing
@testable import ManagerCore

/// The shell's pure state: rail views, tabs and mixed rows. The in-memory
/// backend is the source, so the same assertions back the UI without SwiftUI.
@Suite("Board shell")
@MainActor
struct BoardShellTests {
  let now = utcDate(2026, 11, 19)
  let calendar = utcCalendar()

  private func makeBoard(tasks: [TaskItem] = []) -> (TaskBoardModel, InMemoryTaskBackend) {
    let backend = InMemoryTaskBackend(tasks: tasks)
    return (TaskBoardModel(backend: backend), backend)
  }

  private func waitFor(_ condition: @MainActor () -> Bool) async {
    for _ in 0..<200 {
      if condition() { return }
      await Task.yield()
    }
    Issue.record("Timed out waiting for the board snapshot")
  }

  @Test("The catalog lists every suggested view")
  func catalog() {
    #expect(ViewTemplateCatalog.all.map(\.title) == [
      "Household", "Health", "Body", "Relationships", "Work", "Projects",
      "Money", "Admin", "Learning", "Social", "Creative",
    ])
    #expect(ViewTemplateCatalog.all.allSatisfy { Appearance.knownIcons.contains($0.view.resolvedIcon) })
    #expect(ViewTemplateCatalog.all.allSatisfy { Appearance.knownColors.contains($0.view.resolvedColor) })
  }

  @Test("The rail always starts on Home and Find more installs a view")
  func installTemplate() async {
    let (board, backend) = makeBoard()
    board.start()
    await Task.yield()

    #expect(board.selectedView.id == "home")
    #expect(board.boardSnapshot.views == [.home])

    await board.installTemplate(ViewTemplateCatalog.all[0])
    #expect(board.selectedView.id == "home")
    #expect(board.boardSnapshot.views.map(\.title) == ["Home", "Household"])
    #expect(backend.installedTemplateIDs == ["household"])

    // Installing the same template twice does not duplicate the rail row.
    await board.installTemplate(ViewTemplateCatalog.all[0])
    #expect(board.boardSnapshot.views.count == 2)
  }

  @Test("An unknown icon and color fall back instead of crashing")
  func unknownAppearance() async {
    let (board, _) = makeBoard()
    board.start()
    await Task.yield()

    await board.createCustomView(title: "  Weird  ", icon: "not-an-icon", color: "not-a-color")
    let view = board.boardSnapshot.views.last
    #expect(view?.title == "Weird")
    #expect(view?.icon == Appearance.fallbackIcon)
    #expect(view?.color == Appearance.fallbackColor)
    #expect(view?.resolvedIcon == Appearance.fallbackIcon)
    #expect(view?.resolvedColor == Appearance.fallbackColor)
  }

  @Test("Empty sections are hidden and tabs filter by time slice")
  func sectionsFollowSlice() async {
    let today = TaskItem(id: "today", title: "Today", done: false, dueAt: now)
    let tomorrow = TaskItem(id: "tomorrow", title: "Tomorrow", done: false, dueAt: utcDate(2026, 11, 20))
    let backend = InMemoryTaskBackend(tasks: [today, tomorrow])
    backend.boardSnapshot = BoardSnapshot(
      alerts: [], questions: [], progressions: [], quests: []
    )
    let board = TaskBoardModel(backend: backend)
    board.start()
    await waitFor { board.boardSnapshot.alerts.isEmpty }

    board.selectedSlice = .tasks
    var sections = board.boardSections(now: now, calendar: calendar)
    #expect(sections.map(\.id) == ["tasks"])
    #expect(sections[0].rows.count == 2)

    board.selectedSlice = .daily
    sections = board.boardSections(now: now, calendar: calendar)
    #expect(sections.map(\.id) == ["tasks"])
    #expect(sections[0].rows.count == 1)

    // A day with no open content keeps the rail and tabs but shows no section.
    board.selectedSlice = .monthly
    let empty = InMemoryTaskBackend()
    empty.boardSnapshot = BoardSnapshot(alerts: [], questions: [], progressions: [], quests: [])
    let emptyBoard = TaskBoardModel(backend: empty)
    emptyBoard.start()
    await waitFor { emptyBoard.boardSnapshot.alerts.isEmpty }
    #expect(emptyBoard.boardSections(now: now, calendar: calendar).isEmpty)
    #expect(emptyBoard.selectedView.id == "home")
    #expect(emptyBoard.selectedSlice == .tasks)
  }

  @Test("The mixed column keeps alerts, questions, progress and quests")
  func mixedRows() async {
    let backend = InMemoryTaskBackend(tasks: [TaskItem(id: "one", title: "One", done: false)])
    let board = TaskBoardModel(backend: backend)
    board.start()
    await waitFor { !board.boardSnapshot.alerts.isEmpty && board.tasks.count == 1 }

    let sections = board.boardSections(now: now, calendar: calendar)
    #expect(sections.map(\.id) == ["alerts", "questions", "tasks", "progression", "quests"])

    let question = board.boardSnapshot.questions[0]
    #expect(question.options.count == 4)
    board.answerQuestion(question, optionID: "buy")
    #expect(board.boardSections(now: now, calendar: calendar).map(\.id) == ["alerts", "tasks", "progression", "quests"])

    board.dismissAlert(board.boardSnapshot.alerts[0])
    #expect(board.boardSections(now: now, calendar: calendar).map(\.id) == ["tasks", "progression", "quests"])
  }

  @Test("Only agent or member rows without a seenAt wear NEW")
  func newMark() {
    let agent = TaskItem(id: "agent", title: "Install Omarchy", done: false, origin: .agent)
    let member = TaskItem(id: "member", title: "Shared", done: false, origin: .member)
    let mine = TaskItem(id: "mine", title: "Mine", done: false, origin: .selfCreated)
    let seen = TaskItem(id: "seen", title: "Seen", done: false, origin: .agent, seenAt: now)
    #expect(agent.isNew)
    #expect(member.isNew)
    #expect(!mine.isNew)
    #expect(!seen.isNew)
  }

  @Test("Plus starts a row in the selected slice")
  func plusPrefillsTheSlice() {
    let board = TaskBoardModel(backend: InMemoryTaskBackend())
    board.selectedSlice = .daily
    board.beginTask(now: now, calendar: calendar)
    #expect(board.draftDueDate == calendar.startOfDay(for: now))
    #expect(board.composerFocusRequest == 1)

    board.selectedSlice = .tasks
    board.beginTask(now: now, calendar: calendar)
    #expect(board.draftDueDate == nil)
    #expect(board.composerFocusRequest == 2)
  }
}
