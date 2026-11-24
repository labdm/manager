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

  /// Reconcile recurring tasks for the given calendar.
  ///
  /// - For `replace`: at most one open row per recurrence. The previous open
  ///   row gets `outcome: "superseded"` and a new open row is inserted for
  ///   `periodStart`.
  /// - For `stack`: each missed period adds a new open row. Older rows stay
  ///   open; no row is superseded.
  /// - Idempotent: running twice produces the same result (no duplicate rows).
  public func reconcile(now: Date, calendar: Calendar = .current) {
    reconcileCallCount += 1
    lastReconcileBehavior = nil
    lastReconcileRecurrenceId = nil
    lastReconcilePeriodStart = nil

    // Group tasks by recurrenceId
    let recurrenceGroups = Dictionary(
      grouping: storedTasks) { $0.recurrenceId }
    .filter { $0.key != nil }

    for (recurrenceId, tasks) in recurrenceGroups {
      let groupTasks = tasks
      guard let behavior = groupTasks.first?.behavior else { continue }
      lastReconcileBehavior = behavior
      lastReconcileRecurrenceId = recurrenceId
      lastReconcilePeriodStart = groupTasks.first?.periodStart

      let openTasks = groupTasks.filter {
        $0.done == false && $0.outcome == nil && $0.deletedAt == nil
      }

      let nowDay = calendar.startOfDay(for: now)

      if behavior == "replace" {
        // Replace: at most one open row per (recurrenceId, periodStart).
        // Mark any open row whose periodStart is not the current period as superseded.
        let currentPeriodStart = nowDay

        for task in openTasks where task.periodStart != currentPeriodStart {
          if let index = storedTasks.firstIndex(where: { $0.id == task.id }) {
            storedTasks[index].outcome = "superseded"
          }
        }

        // Ensure there is exactly one open row for the current period.
        // If none exists, create one.
        let hasCurrentOpen = openTasks.contains { task in
          task.periodStart == currentPeriodStart
        }

        if !hasCurrentOpen {
          let newTask = TaskItem(
            id: "task-\(storedTasks.count + 1)",
            title: groupTasks.first?.title ?? "Recurring task",
            done: false,
            dueAt: nowDay,
            recurrenceId: recurrenceId,
            behavior: "replace",
            periodStart: nowDay
          )
          storedTasks.append(newTask)
        }
      } else if behavior == "stack" {
        // Stack: each period since the anchor gets its own open row.
        // Anchor is the periodStart of the first/oldest task in the group.
        guard let anchorPeriodStart = groupTasks.min(
          by: { ($0.periodStart ?? nowDay) < ($1.periodStart ?? nowDay) })?.periodStart else { continue }

        // Generate all period starts from anchor to now (daily, inclusive).
        var periodStart: Date = anchorPeriodStart
        while periodStart <= nowDay {
          // Check if an open row already exists for this period
          let exists = openTasks.contains { task in
            calendar.startOfDay(for: task.periodStart ?? nowDay) == calendar.startOfDay(for: periodStart)
          }
          if !exists {
            let newTask = TaskItem(
              id: "task-\(storedTasks.count + 1)",
              title: groupTasks.first?.title ?? "Recurring task",
              done: false,
              dueAt: calendar.startOfDay(for: periodStart),
              recurrenceId: recurrenceId,
              behavior: "stack",
              periodStart: calendar.startOfDay(for: periodStart)
            )
            storedTasks.append(newTask)
          }
          periodStart = calendar.date(byAdding: .day, value: 1, to: periodStart) ?? nowDay
        }
      }
    }

    continuation?.yield(visibleTasks)
  }
}
