import Foundation

/// A failure worth showing to a person.
public struct TaskBackendError: Error, Equatable, Sendable, LocalizedError {
  public let message: String

  public init(_ message: String) {
    self.message = message
  }

  public var errorDescription: String? { message }
}

/// Everything the board needs from a backend.
///
/// `ManagerCore` never imports Convex or Clerk: `ManagerData` implements this
/// against `ConvexClientWithAuth`, and tests implement it in memory.
@MainActor
public protocol TaskBackend: AnyObject {
  /// Provisions the signed-in user's row. Safe to call repeatedly.
  func ensureUser() async throws

  /// Live task list. Yields the authoritative list whenever it changes.
  func taskUpdates() -> AsyncThrowingStream<[TaskItem], Error>

  /// Live connection state, for the "reconnecting" banner.
  func connectionUpdates() -> AsyncStream<ConnectionStatus>

  func createTask(_ draft: TaskDraft) async throws
  func updateTask(id: String, draft: TaskDraft) async throws
  func setTask(id: String, done: Bool) async throws
  func deleteTask(id: String) async throws

  /// An explicit open. Backend implementations call `tasks:markSeen`; they do
  /// not set `seenAt` merely because a row was painted on screen.
  func markSeen(id: String) async throws
}

public extension TaskBackend {
  /// Keeps the quick composer small. The row opens the full editor.
  func createTask(title: String, dueAt: Date?) async throws {
    try await createTask(TaskDraft(title: title, plannedOn: dueAt))
  }
}
