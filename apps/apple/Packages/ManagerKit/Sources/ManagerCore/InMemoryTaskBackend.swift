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
}
