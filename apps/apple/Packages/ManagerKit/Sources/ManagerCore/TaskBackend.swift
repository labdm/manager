import Foundation

/// A failure worth showing to a person.
public struct TaskBackendError: Error, Equatable, Sendable, LocalizedError {
  public let message: String

  public init(_ message: String) {
    self.message = message
  }

  public var errorDescription: String? { message }
}

/// The shell's board content: rail, mixed rows and the mutations that change
/// them. `ManagerCore` never imports Convex or Clerk; `ManagerData` implements
/// this with string function names, and tests use the in-memory source.
@MainActor
public protocol BoardSource: AnyObject {
  /// Last known board content. The in-memory source owns it; the Convex source
  /// caches the latest `board:slice` payload here.
  var boardSnapshot: BoardSnapshot { get }

  /// Live board content, wired to `board:slice` on the client.
  func boardSliceUpdates() -> AsyncThrowingStream<BoardSnapshot, Error>

  func installTemplate(_ template: ViewTemplate) async throws
  func createCustomView(title: String, icon: String, color: String) async throws
  func createRecurrence(
    title: String,
    behavior: String,
    cadence: String,
    periodStart: Date
  ) async throws

  func dismissAlert(id: String)
  func answerQuestion(id: String, optionID: String)
}

/// Records the row-first shell reads and writes through string-named Convex
/// functions. A deployment that predates one of them fails that one call; the
/// model keeps the shell rendered with empty arrays.
@MainActor
public protocol ShellBackend: AnyObject {
  func setActivityOnTasks(_ value: ActivityOnTasks) async throws
  func groupsList() async throws -> [BoardGroup]
  func createGroup(name: String) async throws
  func createInvite(groupId: String, email: String) async throws
  func acceptInvite(id: String) async throws
  func declineInvite(id: String) async throws
  func routingsList() async throws -> [BoardRouting]
  func createRouting(name: String, cadence: String, title: String) async throws
  func categoriesList() async throws -> [BoardCategory]
  func resourcesList() async throws -> [BoardResource]
  func createAlert(title: String, body: String) async throws
  func markAlertSeen(id: String) async throws
}

/// Everything the board needs from a backend.
///
/// `ManagerCore` never imports Convex or Clerk: `ManagerData` implements this
/// against `ConvexClientWithAuth`, and tests implement it in memory.
@MainActor
public protocol TaskBackend: BoardSource {
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
