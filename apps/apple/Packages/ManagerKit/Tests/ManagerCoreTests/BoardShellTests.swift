import Foundation
import Testing
@testable import ManagerCore

/// The pure state behind the row-first shell: destinations, chips, one row
/// anatomy and the mixed Tasks feed. The in-memory backend is the source, so
/// the same assertions back the UI without SwiftUI.
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

  @Test("Primary destinations and menu pages are disjoint")
  func shellVocabulary() {
    #expect(ShellDestination.allCases.map(\.title) == [
      "Tasks", "Messages", "Groups", "Categories", "Resources",
    ])
    #expect(ShellMenuDestination.allCases.map(\.title) == [
      "Achievements", "Contacts", "Events", "Routings", "Profile",
      "Settings", "Docs", "Contact us", "Desktop app", "Changelog",
    ])
    #expect(ShellMenuDestination.allCases.contains(.settings))
    #expect(Set(ShellDestination.allCases.map(\.rawValue)).isDisjoint(
      with: Set(ShellMenuDestination.allCases.map(\.rawValue))
    ))
  }

  @Test("The shell starts on Tasks with an empty detail and Settings in the menu")
  func shellStartsEmpty() {
    let (board, _) = makeBoard()
    #expect(board.selectedDestination == .tasks)
    #expect(board.selectedChip == .all)
    #expect(board.activityOnTasks == .others)
    #expect(board.selectedRowID == nil)
    #expect(board.detailTitle == nil)
  }

  @Test("Choosing a row fills the detail; changing the chip clears it")
  func detailSelection() async {
    let task = TaskItem(id: "one", title: "One", done: false)
    let (board, _) = makeBoard(tasks: [task])
    board.start()
    await waitFor { board.tasks.count == 1 }

    #expect(board.detailTitle == nil)
    await board.selectRow(.task(task))
    #expect(board.selectedRowID == "task-one")
    #expect(board.detailTitle == "One")

    board.selectChip(.daily)
    #expect(board.selectedRowID == nil)
    #expect(board.detailTitle == nil)

    await board.selectRow(.task(task))
    board.selectDestination(.messages)
    #expect(board.selectedRowID == nil)
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

  @Test("Empty sections are hidden and chips filter by period")
  func sectionsFollowChip() async {
    let today = TaskItem(id: "today", title: "Today", done: false, dueAt: now)
    let tomorrow = TaskItem(id: "tomorrow", title: "Tomorrow", done: false, dueAt: utcDate(2026, 11, 20))
    let backend = InMemoryTaskBackend(tasks: [today, tomorrow])
    backend.boardSnapshot = BoardSnapshot(
      alerts: [], questions: [], progressions: [], quests: []
    )
    let board = TaskBoardModel(backend: backend)
    board.start()
    await waitFor { board.boardSnapshot.alerts.isEmpty }

    board.selectChip(.all)
    var sections = board.boardSections(now: now, calendar: calendar)
    #expect(sections.map(\.id) == ["tasks"])
    #expect(sections[0].rows.count == 2)

    board.selectChip(.daily)
    sections = board.boardSections(now: now, calendar: calendar)
    #expect(sections.map(\.id) == ["tasks"])
    #expect(sections[0].rows.count == 1)

    let empty = InMemoryTaskBackend()
    empty.boardSnapshot = BoardSnapshot(alerts: [], questions: [], progressions: [], quests: [])
    let emptyBoard = TaskBoardModel(backend: empty)
    emptyBoard.start()
    await waitFor { emptyBoard.boardSnapshot.alerts.isEmpty }
    #expect(emptyBoard.boardSections(now: now, calendar: calendar).isEmpty)
    #expect(emptyBoard.selectedDestination == .tasks)
    #expect(emptyBoard.selectedChip == .all)
  }

  @Test("The mixed Tasks column keeps messages, questions, progress and quests")
  func mixedRows() async {
    let backend = InMemoryTaskBackend(tasks: [TaskItem(id: "one", title: "One", done: false)])
    let board = TaskBoardModel(backend: backend)
    board.start()
    await waitFor { !board.boardSnapshot.alerts.isEmpty && board.tasks.count == 1 }

    #expect(board.boardSections(now: now, calendar: calendar).map(\.id)
      == ["messages", "questions", "tasks", "progressions", "quests"])

    let question = board.boardSnapshot.questions[0]
    #expect(question.options.count == 4)
    board.answerQuestion(question, optionID: "buy")
    #expect(board.boardSections(now: now, calendar: calendar).map(\.id)
      == ["messages", "tasks", "progressions", "quests"])

    let alert = board.boardSnapshot.alerts[0]
    board.dismissAlert(alert)
    // History keeps the record; only the Tasks feed drops it.
    #expect(board.boardSnapshot.alerts.count == 1)
    #expect(board.boardSections(now: now, calendar: calendar).map(\.id)
      == ["tasks", "progressions", "quests"])
  }

  @Test("Activity on Tasks defaults to other people and can include or hide everyone")
  func activitySetting() async {
    let backend = InMemoryTaskBackend()
    backend.boardSnapshot = BoardSnapshot(
      alerts: [
        BoardAlert(id: "agent", title: "Agent", body: "", author: "agent"),
        BoardAlert(id: "self", title: "Self", body: "", author: "self"),
      ],
      questions: [], progressions: [], quests: []
    )
    let board = TaskBoardModel(backend: backend)
    board.start()
    await waitFor { board.boardSnapshot.alerts.count == 2 }

    #expect(board.boardSections(now: now, calendar: calendar).map(\.id) == ["messages"])
    #expect(board.boardSections(now: now, calendar: calendar)[0].rows.count == 1)

    await board.setActivityOnTasks(.all)
    #expect(backend.activityOnTasksValues == [.all])
    #expect(board.boardSections(now: now, calendar: calendar)[0].rows.count == 2)

    await board.setActivityOnTasks(.none)
    #expect(board.boardSections(now: now, calendar: calendar).isEmpty)
    // The Messages destination always shows the full history.
    #expect(board.rows(for: .messages, chip: .all).count == 2)
  }

  @Test("A composed message uses alerts and stays in History")
  func composeMessage() async {
    let backend = InMemoryTaskBackend()
    backend.boardSnapshot = BoardSnapshot(alerts: [], questions: [], progressions: [], quests: [])
    let board = TaskBoardModel(backend: backend)
    board.start()
    await waitFor { board.phase == .ready }

    await board.createMessage(title: "  Low stock  ", body: "Coffee")
    #expect(backend.createdAlerts.count == 1)
    #expect(backend.createdAlerts.first?.title == "Low stock")
    #expect(backend.createdAlerts.first?.body == "Coffee")
    #expect(board.rows(for: .messages, chip: .all).count == 1)
    #expect(board.rows(for: .messages, chip: .all).first?.title == "Low stock")
  }

  @Test("An older snapshot decodes new arrays as empty")
  func olderSnapshotStillDraws() throws {
    let json = """
    {"views":[{"id":"home","title":"Home","kind":"home"}],"alerts":[],"questions":[],"progressions":[],"quests":[]}
    """
    let snapshot = try JSONDecoder().decode(BoardSnapshot.self, from: Data(json.utf8))
    #expect(snapshot.views.first?.id == "home")
    #expect(snapshot.groups.isEmpty)
    #expect(snapshot.invites.isEmpty)
    #expect(snapshot.routings.isEmpty)
    #expect(snapshot.categories.isEmpty)
    #expect(snapshot.resources.isEmpty)
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

  @Test("Plus starts a row in the selected chip")
  func plusPrefillsTheChip() {
    let board = TaskBoardModel(backend: InMemoryTaskBackend())
    board.selectChip(.daily)
    board.beginTask(now: now, calendar: calendar)
    #expect(board.draftDueDate == calendar.startOfDay(for: now))
    #expect(board.composerFocusRequest == 1)

    board.selectChip(.all)
    board.beginTask(now: now, calendar: calendar)
    #expect(board.draftDueDate == nil)
    #expect(board.composerFocusRequest == 2)
  }
}
