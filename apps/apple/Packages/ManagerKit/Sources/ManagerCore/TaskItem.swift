import Foundation

/// One task, as every client sees it.
///
/// Mirrors `TaskView` in `packages/backend/convex/lib/taskService.ts`: `id`,
/// `title`, `done`, `dueAt`. The backend owns ordering; this type only carries
/// data so the UI can regroup it for the current day.
public struct TaskItem: Identifiable, Hashable, Sendable, Codable {
  public var id: String
  public var title: String
  public var done: Bool
  /// Due instant, already converted from the backend's epoch milliseconds.
  /// The backend stores the start of a local day, so treat this as a day.
  public var dueAt: Date?

  public init(id: String, title: String, done: Bool, dueAt: Date? = nil) {
    self.id = id
    self.title = title
    self.done = done
    self.dueAt = dueAt
  }

  public func withDone(_ done: Bool) -> TaskItem {
    var copy = self
    copy.done = done
    return copy
  }

  public func withTitle(_ title: String) -> TaskItem {
    var copy = self
    copy.title = title
    return copy
  }
}
