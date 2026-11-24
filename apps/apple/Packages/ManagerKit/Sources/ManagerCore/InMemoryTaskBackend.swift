import Foundation

/// In-memory `TaskBackend` used by tests and SwiftUI previews.
///
/// It records what the board asked for and pushes the authoritative list back
/// through the live-update stream, so tests exercise the same code path as the
/// Convex adapter. Soft-deleted rows stay in `storedTasks` but never reach the
/// stream, matching the server's list filter.
@MainActor
public final class InMemoryTaskBackend: TaskBackend {
  public var storedTasks: [TaskItem]
  public var failWrites = false
  public var failSubscription = false
  public var ensureUserCalls = 0
  public var createdTitles: [String] = []
  public var createdDueDates: [Date?] = []
  public var createdDrafts: [TaskDraft] = []
  public var updatedDrafts: [String: TaskDraft] = [:]
  public var markedSeenIDs: [String] = []

  // MARK: - Board source

  /// The in-memory shell content. Tests seed this directly; mutations append to
  /// it and push it through the board stream just like a live query would.
  public var boardSnapshot: BoardSnapshot = .starter
  public var installedTemplateIDs: [String] = []
  public var customViewTitles: [String] = []
  public var createdRecurrences: [(title: String, behavior: String, periodStart: Date)] = []
  public var dismissedAlertIDs: [String] = []
  public var answeredQuestionIDs: [String] = []

  private var boardContinuation: AsyncThrowingStream<BoardSnapshot, Error>.Continuation?

  /// Recorder for reconcile calls, used by tests.
  public var reconcileCallCount = 0
  public var lastReconcileBehavior: String?
  public var lastReconcileRecurrenceId: String?
  public var lastReconcilePeriodStart: Date?

  /// What a server list would return: no tombstones.
  public var visibleTasks: [TaskItem] {
    storedTasks.filter { $0.deletedAt == nil }
  }

  private var continuation: AsyncThrowingStream<[TaskItem], Error>.Continuation?
  private var connectionContinuation: AsyncStream<ConnectionStatus>.Continuation?

  public init(tasks: [TaskItem] = [], failWrites: Bool = false) {
    self.storedTasks = tasks
    self.failWrites = failWrites
  }

  public func ensureUser() async throws {
    ensureUserCalls += 1
  }

  public func taskUpdates() -> AsyncThrowingStream<[TaskItem], Error> {
    AsyncThrowingStream { continuation in
      self.continuation = continuation
      if self.failSubscription {
        continuation.finish(throwing: TaskBackendError("Subscription failed"))
      } else {
        continuation.yield(self.visibleTasks)
      }
    }
  }

  public func connectionUpdates() -> AsyncStream<ConnectionStatus> {
    AsyncStream { continuation in
      self.connectionContinuation = continuation
      continuation.yield(.connected)
    }
  }

  public func createTask(_ draft: TaskDraft) async throws {
    if failWrites { throw TaskBackendError("Could not save the task") }
    createdTitles.append(draft.title)
    createdDueDates.append(draft.plannedOn)
    createdDrafts.append(draft)

    let now = Date()
    let day = draft.plannedOn
    let overdue = TaskFacts.isOverdue(
      deadlineAt: draft.deadlineAt,
      done: false,
      deletedAt: nil,
      now: now
    )
    storedTasks.append(
      TaskItem(
        id: "task-\(storedTasks.count + 1)",
        title: draft.title,
        done: false,
        dueAt: day,
        notes: draft.notes,
        plannedTime: draft.plannedTime,
        location: draft.location,
        deadlineAt: draft.deadlineAt,
        remindAt: draft.remindAt,
        priority: draft.priority,
        priorityRank: draft.priorityRank,
        effectiveRank: TaskFacts.effectiveRank(
          priorityRank: draft.priorityRank,
          priority: draft.priority,
          policy: draft.overduePolicy,
          overdue: overdue
        ),
        overdue: overdue,
        overduePolicy: draft.overduePolicy,
        // A create in the app is seen by definition. It never wears NEW.
        origin: .selfCreated,
        seenAt: now
      )
    )
    continuation?.yield(visibleTasks)
  }

  public func updateTask(id: String, draft: TaskDraft) async throws {
    if failWrites { throw TaskBackendError("Could not update the task") }
    guard let index = storedTasks.firstIndex(where: { $0.id == id }) else { return }
    updatedDrafts[id] = draft
    storedTasks[index] = storedTasks[index].applying(draft)
    continuation?.yield(visibleTasks)
  }

  public func setTask(id: String, done: Bool) async throws {
    if failWrites { throw TaskBackendError("Could not update the task") }
    if let index = storedTasks.firstIndex(where: { $0.id == id }) {
      storedTasks[index] = storedTasks[index].withDone(done)
    }
    continuation?.yield(visibleTasks)
  }

  public func deleteTask(id: String) async throws {
    if failWrites { throw TaskBackendError("Could not delete the task") }
    if let index = storedTasks.firstIndex(where: { $0.id == id }) {
      storedTasks[index].deletedAt = Date()
    }
    continuation?.yield(visibleTasks)
  }

  public func markSeen(id: String) async throws {
    if failWrites { throw TaskBackendError("Could not mark the task as seen") }
    markedSeenIDs.append(id)
    if let index = storedTasks.firstIndex(where: { $0.id == id }) {
      storedTasks[index] = storedTasks[index].withSeen()
    }
    continuation?.yield(visibleTasks)
  }

  /// Pushes an external change, as if a bot or another device wrote it.
  public func push(_ tasks: [TaskItem]) {
    storedTasks = tasks
    continuation?.yield(visibleTasks)
  }

  public func emit(connection: ConnectionStatus) {
    connectionContinuation?.yield(connection)
  }

  // MARK: - BoardSource

  public func boardSliceUpdates() -> AsyncThrowingStream<BoardSnapshot, Error> {
    AsyncThrowingStream { continuation in
      self.boardContinuation = continuation
      if self.failSubscription {
        continuation.finish(throwing: TaskBackendError("Board failed to load"))
      } else {
        continuation.yield(self.boardSnapshot)
      }
    }
  }

  private func emitBoard() {
    boardContinuation?.yield(boardSnapshot)
  }

  public func installTemplate(_ template: ViewTemplate) async throws {
    if failWrites { throw TaskBackendError("Could not install the view") }
    installedTemplateIDs.append(template.id)
    if !boardSnapshot.views.contains(where: { $0.id == template.view.id }) {
      boardSnapshot.views.append(template.view)
    }
    emitBoard()
  }

  public func createCustomView(title: String, icon: String, color: String) async throws {
    if failWrites { throw TaskBackendError("Could not create the view") }
    let trimmed = title.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmed.isEmpty else { return }
    customViewTitles.append(trimmed)
    let view = BoardViewItem(
      id: "view-custom-\(UUID().uuidString)",
      title: trimmed,
      icon: Appearance.icon(icon),
      color: Appearance.color(color),
      kind: .custom
    )
    boardSnapshot.views.append(view)
    emitBoard()
  }

  public func createRecurrence(title: String, behavior: String, periodStart: Date) async throws {
    if failWrites { throw TaskBackendError("Could not create the recurrence") }
    let day = Calendar.current.startOfDay(for: periodStart)
    let recurrenceId = "rec-\(UUID().uuidString)"
    createdRecurrences.append((title, behavior, day))
    let now = Date()
    storedTasks.append(
      TaskItem(
        id: nextID(),
        title: title,
        done: false,
        dueAt: day,
        origin: .selfCreated,
        seenAt: now,
        recurrenceId: recurrenceId,
        behavior: behavior,
        periodStart: day
      )
    )
    reconcile(now: day, calendar: .current)
  }

  public func dismissAlert(id: String) {
    dismissedAlertIDs.append(id)
    boardSnapshot.alerts.removeAll { $0.id == id }
    emitBoard()
  }

  public func answerQuestion(id: String, optionID: String) {
    answeredQuestionIDs.append(id)
    if let index = boardSnapshot.questions.firstIndex(where: { $0.id == id }) {
      boardSnapshot.questions[index].answeredAt = Date()
    }
    emitBoard()
  }

  private func nextID() -> String {
    var number = storedTasks.count + 1
    var candidate = "task-\(number)"
    while storedTasks.contains(where: { $0.id == candidate }) {
      number += 1
      candidate = "task-\(number)"
    }
    return candidate
  }

  /// Reconcile recurring tasks for the given calendar.
  ///
  /// The idempotency key is `(recurrenceId, periodStart)` compared as a civil
  /// day, and it covers *every* row in the series — done, superseded and soft
  /// deleted included. A finished Tuesday therefore never grows a second
  /// Tuesday, and running reconcile twice changes nothing.
  ///
  /// - `replace`: older open rows become `outcome: "superseded"`; the current
  ///   civil day is minted only when the series has no row for it yet. At most
  ///   one open row remains.
  /// - `stack`: every civil day from the oldest row through today gets its own
  ///   open row; older open rows are left alone.
  ///
  /// Weekly series (not part of this slice) must step with a Monday-first
  /// calendar (`calendar.firstWeekday = 2`); daily stepping is weekday-agnostic.
  public func reconcile(now: Date, calendar: Calendar = .current) {
    reconcileCallCount += 1
    lastReconcileBehavior = nil
    lastReconcileRecurrenceId = nil
    lastReconcilePeriodStart = nil

    let today = calendar.startOfDay(for: now)

    let groups = Dictionary(grouping: storedTasks) { $0.recurrenceId }
      .filter { $0.key != nil }

    for (recurrenceId, group) in groups {
      guard let recurrenceId,
            let behavior = group.first(where: { $0.behavior != nil })?.behavior
      else { continue }

      lastReconcileBehavior = behavior
      lastReconcileRecurrenceId = recurrenceId
      lastReconcilePeriodStart = today

      // Every row counts for idempotency, regardless of done/outcome/deleted.
      let existingDays = Set(
        group.compactMap { $0.periodStart.map { self.civilDay($0, calendar: calendar) } }
      )
      let title = group.first?.title ?? "Recurring task"

      func isOpen(_ task: TaskItem) -> Bool {
        !task.done && task.outcome == nil && task.deletedAt == nil
      }

      func supersede(_ task: TaskItem) {
        guard let index = storedTasks.firstIndex(where: { $0.id == task.id }) else { return }
        storedTasks[index].outcome = "superseded"
      }

      if behavior == "replace" {
        // Older open periods lose their slot on the board.
        for task in group where isOpen(task) {
          guard let start = task.periodStart,
                self.civilDay(start, calendar: calendar) < today
          else { continue }
          supersede(task)
        }

        // If several open rows already land on today, keep one and supersede
        // the rest so the series can never show two dishes for one day.
        let todayOpen = group.filter {
          isOpen($0) && $0.periodStart.map { self.civilDay($0, calendar: calendar) } == today
        }
        for task in todayOpen.dropFirst() { supersede(task) }

        // Mint today only when the series has no row for this civil day at all.
        if !existingDays.contains(today) {
          mint(title: title, recurrenceId: recurrenceId, behavior: behavior, day: today, now: now)
        }
      } else if behavior == "stack" {
        guard let anchor = existingDays.min() else { continue }

        var day = anchor
        while day <= today {
          if !existingDays.contains(day) {
            mint(title: title, recurrenceId: recurrenceId, behavior: behavior, day: day, now: now)
          }
          guard let next = calendar.date(byAdding: .day, value: 1, to: day), next > day else { break }
          day = next
        }
      }
    }

    continuation?.yield(visibleTasks)
  }

  private func civilDay(_ date: Date, calendar: Calendar) -> Date {
    calendar.startOfDay(for: date)
  }

  /// A minted occurrence is authored by the app and already seen, so it never
  /// wears NEW. The planned day and `dueAt` are one fact; a deadline is never
  /// derived from it.
  private func mint(title: String, recurrenceId: String, behavior: String, day: Date, now: Date) {
    storedTasks.append(
      TaskItem(
        id: nextID(),
        title: title,
        done: false,
        dueAt: day, // sets plannedOn too — the two names are one stored fact
        origin: .selfCreated,
        seenAt: now,
        recurrenceId: recurrenceId,
        behavior: behavior,
        periodStart: day
      )
    )
  }
}
