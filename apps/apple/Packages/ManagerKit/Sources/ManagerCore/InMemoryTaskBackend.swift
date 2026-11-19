import Foundation

/// In-memory `TaskBackend` used by tests and SwiftUI previews.
///
/// It records what the board asked for and pushes the authoritative list back
/// through the live-update stream, so tests exercise the same code path as the
/// Convex adapter.
@MainActor
public final class InMemoryTaskBackend: TaskBackend {
  public var storedTasks: [TaskItem]
  public var failWrites = false
  public var failSubscription = false
  public var ensureUserCalls = 0
  public var createdTitles: [String] = []
  public var createdDueDates: [Date?] = []

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
        continuation.yield(self.storedTasks)
      }
    }
  }

  public func connectionUpdates() -> AsyncStream<ConnectionStatus> {
    AsyncStream { continuation in
      self.connectionContinuation = continuation
      continuation.yield(.connected)
    }
  }

  public func createTask(title: String, dueAt: Date?) async throws {
    if failWrites { throw TaskBackendError("Could not save the task") }
    createdTitles.append(title)
    createdDueDates.append(dueAt)
    storedTasks.append(
      TaskItem(
        id: "task-\(storedTasks.count + 1)",
        title: title,
        done: false,
        dueAt: dueAt
      )
    )
    continuation?.yield(storedTasks)
  }

  public func setTask(id: String, done: Bool) async throws {
    if failWrites { throw TaskBackendError("Could not update the task") }
    if let index = storedTasks.firstIndex(where: { $0.id == id }) {
      storedTasks[index].done = done
    }
    continuation?.yield(storedTasks)
  }

  public func deleteTask(id: String) async throws {
    if failWrites { throw TaskBackendError("Could not delete the task") }
    storedTasks.removeAll { $0.id == id }
    continuation?.yield(storedTasks)
  }

  /// Pushes an external change, as if a bot or another device wrote it.
  public func push(_ tasks: [TaskItem]) {
    storedTasks = tasks
    continuation?.yield(tasks)
  }

  public func emit(connection: ConnectionStatus) {
    connectionContinuation?.yield(connection)
  }
}
