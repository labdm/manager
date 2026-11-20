import Foundation

/// The smart lists offered in the sidebar and the compact picker.
///
/// "Today" deliberately includes overdue tasks, the way Things and Todoist do:
/// a list that hides yesterday's unfinished work is a list you stop trusting.
public enum TaskList: String, CaseIterable, Identifiable, Sendable, Codable {
  case all
  case today
  case upcoming
  case done

  public var id: String { rawValue }

  public var title: String {
    switch self {
    case .all: "All"
    case .today: "Today"
    case .upcoming: "Upcoming"
    case .done: "Done"
    }
  }

  public var systemImage: String {
    switch self {
    case .all: "tray.full"
    case .today: "sun.max"
    case .upcoming: "calendar"
    case .done: "checkmark.circle"
    }
  }

  public var emptyTitle: String {
    switch self {
    case .all: "Nothing to do"
    case .today: "Today is clear"
    case .upcoming: "No upcoming tasks"
    case .done: "Nothing finished yet"
    }
  }

  public var emptyMessage: String {
    switch self {
    case .all: "Add a task to get started. Bots can add them through MCP too."
    case .today: "Nothing due today or earlier. Enjoy the quiet."
    case .upcoming: "Tasks with a future due date show up here."
    case .done: "Complete a task and it lands here."
    }
  }

  /// Whether a task belongs to this list on the given day.
  public func includes(_ task: TaskItem, now: Date, calendar: Calendar = .current) -> Bool {
    switch self {
    case .all:
      return true
    case .done:
      return task.done
    case .today:
      guard !task.done, let dueAt = task.dueAt else { return false }
      return calendar.startOfDay(for: dueAt) <= calendar.startOfDay(for: now)
    case .upcoming:
      guard !task.done, let dueAt = task.dueAt else { return false }
      return calendar.startOfDay(for: dueAt) > calendar.startOfDay(for: now)
    }
  }
}
