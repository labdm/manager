import Foundation
import Testing
@testable import ManagerCore

/// The in-memory contract for create, edit and detail flow. Every rule is
/// checked without SwiftUI: compact create routing, sheet presentation, the
/// explicit series choices and the NEW mark-seen rule.
@Suite("Create and detail flow")
@MainActor
struct SheetShellTests {
  let now = utcDate(2026, 11, 19)
  let calendar = utcCalendar()
  let monday = utcDate(2026, 11, 16)
  let tuesday = utcDate(2026, 11, 17)
  let wednesday = utcDate(2026, 11, 18)

  private func makeBoard(tasks: [TaskItem] = []) -> (TaskBoardModel, InMemoryTaskBackend) {
    let backend = InMemoryTaskBackend(tasks: tasks)
    let board = TaskBoardModel(backend: backend)
    board.start()
    return (board, backend)
  }

  private func waitFor(_ condition: @MainActor () -> Bool) async {
    for _ in 0..<200 {
      if condition() { return }
      await Task.yield()
    }
    Issue.record("Timed out waiting for the board")
  }

  private func openRows(_ backend: InMemoryTaskBackend, id: String) -> [TaskItem] {
    backend.storedTasks.filter {
      $0.recurrenceId == id && !$0.done && $0.outcome == nil && $0.deletedAt == nil
    }
  }

  @Test("A create action pushes on compact width and inserts no form in the column")
  func createPresentsASheet() async {
    let (board, backend) = makeBoard()
    await waitFor { board.phase == .ready }

    board.beginTask(now: now, calendar: calendar)
    #expect(board.presentedSheet == .createTask)
    #expect(board.isCreateRouteActive)
    #expect(board.draftDueDate == nil)

    // The board is unchanged by the create action: no row was inserted and no
    // editor form lives in the column.
    #expect(backend.createdTitles.isEmpty)
    #expect(board.tasks.isEmpty)
    #expect(board.composerFocusRequest == 1)

    board.selectChip(.daily)
    board.beginTask(now: now, calendar: calendar)
    #expect(board.draftDueDate == calendar.startOfDay(for: now))
    #expect(board.isCreateRouteActive)

    for target in [
      BoardSheet.category(nil), .event(nil), .view(nil), .progression(nil), .resource(nil),
    ] {
      board.present(target)
      #expect(board.presentedSheet == target)
    }
    board.dismissSheet()
    #expect(board.presentedSheet == nil)
    #expect(!board.isCreateRouteActive)
  }

  @Test("Selecting a row fills detail without opening the editor")
  func selectingRowKeepsTheFailedMarkSeenRule() async {
    let task = TaskItem(id: "agent", title: "Install Omarchy", done: false, origin: .agent)
    let (board, backend) = makeBoard(tasks: [task])
    await waitFor { board.phase == .ready }
    #expect(board.tasks.first?.isNew == true)

    backend.failWrites = true
    await board.selectRow(.task(task))

    #expect(board.presentedSheet == nil)
    #expect(board.detailTitle == "Install Omarchy")
    // The write failed, so nothing was recorded as seen and NEW stays.
    #expect(backend.markedSeenIDs.isEmpty)
    #expect(board.tasks.first?.seenAt == nil)
    #expect(board.tasks.first?.isNew == true)
    #expect(board.errorMessage == "Could not mark the task as seen")
  }

  @Test("A stored card hint never changes the one row")
  func presentationHintIsIgnored() {
    let card = TaskItem(id: "card", title: "Card", done: false, look: .card)
    let check = TaskItem(id: "check", title: "Check", done: false, look: .check)
    let cardRow = BoardRow.task(card)
    let checkRow = BoardRow.task(check)

    #expect(cardRow.typeMark == checkRow.typeMark)
    #expect(cardRow.primaryActionTitle == checkRow.primaryActionTitle)
    #expect(cardRow.title == "Card")
  }

  @Test("Task look, series and cadence are explicit choices")
  func lookSeriesAndCadence() async {
    let (board, backend) = makeBoard()
    await waitFor { board.phase == .ready }

    let draft = TaskDraft(
      title: "  Read the report  ",
      look: .card,
      series: .stack,
      cadence: .weekly
    )
    #expect(await board.createTask(from: draft, calendar: calendar))

    #expect(backend.createdLooks == [.card])
    #expect(backend.createdSeries == [.stack])
    #expect(backend.createdCadences == [.weekly])
    #expect(backend.storedTasks.first?.look == .card)
    #expect(backend.storedTasks.first?.series == .stack)
    #expect(backend.storedTasks.first?.cadence == .weekly)
    #expect(backend.storedTasks.first?.isNew == false)

    #expect(TaskLook.allCases.map(\.rawValue) == ["check", "row", "card"])
    #expect(SeriesBehavior.allCases.map(\.rawValue) == ["none", "replace", "stack"])
    #expect(SeriesCadence.allCases.map(\.rawValue) == ["daily", "weekly", "monthly", "every14days"])
    #expect(TaskLook(decoded: "nonsense") == .check)
    #expect(SeriesBehavior(decoded: nil) == .none)
    #expect(SeriesCadence(decoded: nil) == .daily)
  }

  @Test("Replace still leaves exactly one open row")
  func replaceLeavesOneOpenRow() async {
    let (board, backend) = makeBoard()
    await waitFor { board.phase == .ready }

    let draft = TaskDraft(
      title: "Dishes",
      plannedOn: monday,
      series: .replace,
      cadence: .daily
    )
    #expect(await board.createSeriesTask(from: draft, now: monday, calendar: calendar))
    #expect(backend.recurrenceCadences == ["daily"])

    let seriesRows = backend.storedTasks.filter { $0.recurrenceId != nil }
    #expect(seriesRows.count == 1)
    #expect(openRows(backend, id: seriesRows[0].recurrenceId!).count == 1)

    backend.reconcile(now: tuesday, calendar: calendar)

    let all = backend.storedTasks.filter { $0.recurrenceId == seriesRows[0].recurrenceId! }
    #expect(all.count == 2)
    #expect(all.first?.outcome == "superseded")
    let open = openRows(backend, id: seriesRows[0].recurrenceId!)
    #expect(open.count == 1)
    #expect(calendar.startOfDay(for: open[0].periodStart!) == calendar.startOfDay(for: tuesday))
    #expect(open[0].deadlineAt == nil)
    #expect(open[0].isNew == false)
  }

  @Test("Stack still leaves the missed days open")
  func stackLeavesTheDays() async {
    let (board, backend) = makeBoard()
    await waitFor { board.phase == .ready }

    let draft = TaskDraft(
      title: "Journal",
      plannedOn: monday,
      series: .stack,
      cadence: .daily
    )
    #expect(await board.createSeriesTask(from: draft, now: monday, calendar: calendar))
    let recurrenceID = backend.storedTasks.first?.recurrenceId
    #expect(recurrenceID != nil)

    backend.reconcile(now: wednesday, calendar: calendar)

    let open = openRows(backend, id: recurrenceID!)
    #expect(open.count == 3)
    let days = Set(open.compactMap { $0.periodStart }.map { calendar.startOfDay(for: $0) })
    #expect(days == [
      calendar.startOfDay(for: monday),
      calendar.startOfDay(for: tuesday),
      calendar.startOfDay(for: wednesday),
    ])
    #expect(open.allSatisfy { $0.outcome == nil })
    #expect(open.allSatisfy { !$0.isNew })
  }

  @Test("A fourteen-day stack steps fourteen days, not one")
  func fourteenDayCadenceStepsByFourteenDays() async {
    let (board, backend) = makeBoard()
    await waitFor { board.phase == .ready }

    let draft = TaskDraft(
      title: "Fortnightly",
      plannedOn: monday,
      series: .stack,
      cadence: .every14days
    )
    #expect(await board.createSeriesTask(from: draft, now: monday, calendar: calendar))
    #expect(backend.recurrenceCadences == ["every14days"])
    let recurrenceID = backend.storedTasks.first?.recurrenceId

    backend.reconcile(now: utcDate(2026, 12, 1), calendar: calendar)

    let days = Set(
      openRows(backend, id: recurrenceID!)
        .compactMap { $0.periodStart }
        .map { calendar.startOfDay(for: $0) }
    )
    #expect(days == [
      calendar.startOfDay(for: monday),
      calendar.startOfDay(for: utcDate(2026, 11, 30)),
    ])
  }

  @Test("The appearance catalog is searchable and every choice is safe")
  func appearanceCatalog() {
    let homes = IconChoice.search("home")
    #expect(homes.contains { $0.id == "house" })
    #expect(IconChoice.search("chart").contains { $0.id == "chart-column" })
    #expect(IconChoice.search("nothing-matches").isEmpty)
    #expect(IconChoice.all.allSatisfy { Appearance.knownIcons.contains($0.id) })
    #expect(Appearance.colorTokens.allSatisfy { Appearance.knownColors.contains($0) })
    #expect(Appearance.symbol(for: "not-an-icon") == Appearance.fallbackIcon)
    #expect(Appearance.icon("house") == "house")
  }
}
