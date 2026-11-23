import Foundation
import Testing
@testable import ManagerCore

@Suite("Task board model")
@MainActor
struct TaskBoardModelTest {
  let now = utcDate(2026, 11, 19)
  let calendar = utcCalendar()

  private func makeBoard(
    tasks: [TaskItem] = []
  ) -> (TaskBoardModel, InMemoryTaskBackend) {
    let backend = InMemoryTaskBackend(tasks: tasks)
    return (TaskBoardModel(backend: backend), backend)
  }

  /// Lets the model's update task run until the condition holds.
  private func waitFor(
    _ condition: @MainActor () -> Bool,
    timeout: Duration = .seconds(2)
  ) async {
    let deadline = ContinuousClock.now.advanced(by: timeout)
    while ContinuousClock.now < deadline {
      if condition() { return }
      await Task.yield()
      try? await Task.sleep(for: .milliseconds(1))
    }
    Issue.record("Timed out waiting for the board to settle")
  }

  @Test("Start provisions the user and loads tasks")
  func startLoads() async {
    let task = TaskItem(id: "1", title: "Ship it", done: false)
    let (board, backend) = makeBoard(tasks: [task])

    board.start()
    await waitFor { board.phase == .ready }

    #expect(backend.ensureUserCalls == 1)
    #expect(board.tasks == [task])
  }

  @Test("Start is idempotent")
  func startIsIdempotent() async {
    let (board, backend) = makeBoard()
    board.start()
    await waitFor { board.phase == .ready }
    board.start()
    await waitFor { board.phase == .ready }

    #expect(backend.ensureUserCalls == 1)
  }

  @Test("Stop clears user state")
  func stopClears() async {
    let (board, _) = makeBoard(tasks: [TaskItem(id: "1", title: "One", done: false)])
    board.start()
    await waitFor { board.phase == .ready }

    board.stop()
    #expect(board.tasks.isEmpty)
    #expect(board.phase == .idle)
    #expect(board.connectionNotice == nil)
  }

  @Test("Subscription failures surface as a retryable phase")
  func subscriptionFailure() async {
    let backend = InMemoryTaskBackend()
    backend.failSubscription = true
    let board = TaskBoardModel(backend: backend)

    board.start()
    await waitFor {
      if case .failed = board.phase { return true }
      return false
    }
    #expect(board.tasks.isEmpty)
  }

  @Test("Composer trims the title and clears on success")
  func addTask() async {
    let (board, backend) = makeBoard()
    board.start()
    await waitFor { board.phase == .ready }

    board.draftTitle = "  Buy milk  "
    board.draftDueDate = utcDate(2026, 11, 21, hour: 9)
    let created = await board.addTask(calendar: calendar)

    #expect(created)
    #expect(backend.createdTitles == ["Buy milk"])
    #expect(backend.createdDueDates == [utcDate(2026, 11, 21, hour: 0)])
    #expect(board.draftTitle.isEmpty)
    #expect(board.draftDueDate == nil)

    #expect(backend.storedTasks.first?.origin == .selfCreated)
    #expect(backend.storedTasks.first?.seenAt != nil)
    #expect(backend.storedTasks.first?.isNew == false)
  }

  @Test("Composer refuses titles the backend would reject")
  func addTaskValidation() async {
    let (board, backend) = makeBoard()
    board.start()
    await waitFor { board.phase == .ready }

    board.draftTitle = String(repeating: "a", count: TaskTitle.maxLength + 1)
    let created = await board.addTask(calendar: calendar)

    #expect(!created)
    #expect(backend.createdTitles.isEmpty)
    #expect(board.errorMessage?.contains("limited to") == true)
    #expect(!board.draftTitle.isEmpty)
  }

  @Test("Composer keeps the draft when the write fails")
  func addTaskFailure() async {
    let (board, backend) = makeBoard()
    backend.failWrites = true
    board.start()
    await waitFor { board.phase == .ready }

    board.draftTitle = "Buy milk"
    let created = await board.addTask(calendar: calendar)

    #expect(!created)
    #expect(board.draftTitle == "Buy milk")
    #expect(board.errorMessage == "Could not save the task")
  }

  @Test("Toggling is optimistic and rolls back on failure")
  func toggleRollsBack() async {
    let task = TaskItem(id: "1", title: "Ship it", done: false)
    let (board, backend) = makeBoard(tasks: [task])
    board.start()
    await waitFor { board.phase == .ready }

    backend.failWrites = true
    await board.toggle(task)

    #expect(board.tasks.first?.done == false)
    #expect(board.errorMessage == "Could not update the task")
  }

  @Test("Toggling reaches the backend")
  func toggleSucceeds() async {
    let task = TaskItem(id: "1", title: "Ship it", done: false)
    let (board, backend) = makeBoard(tasks: [task])
    board.start()
    await waitFor { board.phase == .ready }

    await board.toggle(task)
    await waitFor { backend.storedTasks.first?.done == true }

    #expect(board.tasks.first?.done == true)
    #expect(board.errorMessage == nil)
  }

  @Test("Deleting is optimistic and restores the row on failure")
  func deleteRollsBack() async {
    let tasks = [
      TaskItem(id: "1", title: "One", done: false),
      TaskItem(id: "2", title: "Two", done: false),
    ]
    let (board, backend) = makeBoard(tasks: tasks)
    board.start()
    await waitFor { board.phase == .ready }

    backend.failWrites = true
    await board.delete(tasks[0])

    #expect(board.tasks.map(\.id) == ["1", "2"])
    #expect(board.errorMessage == "Could not delete the task")
  }

  @Test("Groups respect the selected list")
  func groupedByList() async {
    let tasks = [
      TaskItem(id: "today", title: "Today", done: false, dueAt: now),
      TaskItem(id: "later", title: "Later", done: false, dueAt: utcDate(2026, 12, 1)),
    ]
    let (board, _) = makeBoard(tasks: tasks)
    board.start()
    await waitFor { board.phase == .ready }

    board.selectedList = .today
    let groups = board.groups(now: now, calendar: calendar)
    #expect(groups.flatMap(\.tasks).map(\.id) == ["today"])

    board.selectedList = .all
    #expect(board.count(for: .all, now: now, calendar: calendar) == 2)
    #expect(board.count(for: .upcoming, now: now, calendar: calendar) == 1)
    #expect(board.openTodayCount(now: now, calendar: calendar) == 1)
  }

  @Test("Connection notice follows the socket")
  func connectionNotice() async {
    let (board, backend) = makeBoard()
    board.start()
    await waitFor { board.hasConnectedOnce }

    #expect(board.connectionNotice == nil)

    backend.emit(connection: .offline)
    await waitFor { board.connection == .offline }
    #expect(board.connectionNotice?.contains("Offline") == true)

    backend.emit(connection: .connecting)
    await waitFor { board.connection == .connecting }
    #expect(board.connectionNotice == "Reconnecting…")
  }

  @Test("Opening a NEW row calls markSeen and clears the mark locally")
  func openMarksSeen() async {
    let task = TaskItem(id: "1", title: "Install Omarchy", done: false, origin: .agent)
    let (board, backend) = makeBoard(tasks: [task])
    board.start()
    await waitFor { board.phase == .ready }
    #expect(board.tasks.first?.isNew == true)

    await board.open(task)
    await waitFor { backend.markedSeenIDs == ["1"] }

    #expect(backend.markedSeenIDs == ["1"])
    #expect(board.tasks.first?.seenAt != nil)
    #expect(board.tasks.first?.isNew == false)
    #expect(backend.storedTasks.first?.seenAt != nil)
  }

  @Test("A failed markSeen keeps the mark")
  func openRollsBack() async {
    let task = TaskItem(id: "1", title: "From agent", done: false, origin: .agent)
    let (board, backend) = makeBoard(tasks: [task])
    board.start()
    await waitFor { board.phase == .ready }

    backend.failWrites = true
    await board.open(task)

    #expect(board.tasks.first?.seenAt == nil)
    #expect(board.tasks.first?.isNew == true)
    #expect(board.errorMessage == "Could not mark the task as seen")
  }

  @Test("The editor writes facts without moving the planned day into the deadline")
  func saveEditorFacts() async {
    let task = TaskItem(id: "1", title: "Old", done: false, origin: .agent)
    let (board, backend) = makeBoard(tasks: [task])
    board.start()
    await waitFor { board.phase == .ready }

    let planned = utcDate(2026, 11, 21)
    let deadline = utcDate(2026, 11, 25, hour: 23)
    let reminder = utcDate(2026, 11, 24, hour: 9)
    let draft = TaskDraft(
      title: "File taxes",
      notes: "Bring the receipts",
      plannedOn: planned,
      plannedTime: 555,
      location: "Desk",
      deadlineAt: deadline,
      remindAt: reminder,
      priority: .high,
      priorityRank: 20,
      overduePolicy: .escalate
    )

    await board.save(task, draft: draft)
    await waitFor { backend.updatedDrafts["1"] != nil }

    let saved = backend.visibleTasks.first
    #expect(saved?.title == "File taxes")
    #expect(saved?.notes == "Bring the receipts")
    #expect(saved?.dueAt == planned)
    #expect(saved?.plannedOn == planned)
    #expect(saved?.plannedTime == 555)
    #expect(saved?.location == "Desk")
    #expect(saved?.deadlineAt == deadline)
    #expect(saved?.remindAt == reminder)
    #expect(saved?.priority == .high)
    #expect(saved?.priorityRank == 20)
    #expect(saved?.overduePolicy == .escalate)
    #expect(board.tasks.first?.dueAt == planned)
  }

  @Test("Soft delete hides the row without erasing it")
  func softDeleteHides() async {
    let tasks = [
      TaskItem(id: "1", title: "One", done: false),
      TaskItem(id: "2", title: "Two", done: false),
    ]
    let (board, backend) = makeBoard(tasks: tasks)
    board.start()
    await waitFor { board.phase == .ready }

    await board.delete(tasks[0])
    await waitFor { backend.storedTasks.first?.deletedAt != nil }

    #expect(backend.visibleTasks.map(\.id) == ["2"])
    #expect(backend.storedTasks.count == 2)
    #expect(board.tasks.map(\.id) == ["2"])
  }
}
