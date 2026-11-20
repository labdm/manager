import Foundation

/// How the task list is broken into groups for display.
public enum TaskSection: String, CaseIterable, Identifiable, Sendable {
  case overdue
  case today
  case upcoming
  case anytime
  case completed

  public var id: String { rawValue }

  public var title: String {
    switch self {
    case .overdue: "Overdue"
    case .today: "Today"
    case .upcoming: "Upcoming"
    case .anytime: "Anytime"
    case .completed: "Done"
    }
  }

  public var systemImage: String {
    switch self {
    case .overdue: "exclamationmark.triangle"
    case .today: "sun.max"
    case .upcoming: "calendar"
    case .anytime: "tray"
    case .completed: "checkmark.circle"
    }
  }

  /// Completed work starts folded away; everything else is open.
  public var startsCollapsed: Bool { self == .completed }
}

/// A non-empty section, ready to render.
public struct TaskSectionGroup: Identifiable, Equatable, Sendable {
  public let section: TaskSection
  public let tasks: [TaskItem]

  public var id: TaskSection { section }

  public init(section: TaskSection, tasks: [TaskItem]) {
    self.section = section
    self.tasks = tasks
  }
}

public enum TaskOrganizer {
  /// Which section a task belongs to.
  public static func section(
    for task: TaskItem,
    now: Date,
    calendar: Calendar = .current
  ) -> TaskSection {
    if task.done { return .completed }
    guard let dueAt = task.dueAt else { return .anytime }

    let dueDay = calendar.startOfDay(for: dueAt)
    let today = calendar.startOfDay(for: now)
    if dueDay < today { return .overdue }
    if dueDay == today { return .today }
    return .upcoming
  }

  /// Groups tasks, dropping empty sections and sorting each by due date.
  ///
  /// The backend already sorts pending-first then newest-first, so the incoming
  /// order is the tie-breaker for tasks with equal (or missing) due dates.
  public static func groups(
    for tasks: [TaskItem],
    now: Date,
    calendar: Calendar = .current
  ) -> [TaskSectionGroup] {
    var buckets: [TaskSection: [(offset: Int, task: TaskItem)]] = [:]
    for (offset, task) in tasks.enumerated() {
      buckets[section(for: task, now: now, calendar: calendar), default: []]
        .append((offset, task))
    }

    return TaskSection.allCases.compactMap { section in
      guard let entries = buckets[section], !entries.isEmpty else { return nil }
      let sorted = entries.sorted { lhs, rhs in
        switch (lhs.task.dueAt, rhs.task.dueAt) {
        case let (left?, right?) where left != right:
          return left < right
        case (_?, nil):
          return true
        case (nil, _?):
          return false
        default:
          return lhs.offset < rhs.offset
        }
      }
      return TaskSectionGroup(section: section, tasks: sorted.map(\.task))
    }
  }
}
