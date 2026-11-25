import Foundation

// MARK: - Primary navigation

/// The five destinations. The menu is a button, never a sixth tab, and none of
/// its pages is duplicated here.
public enum ShellDestination: String, CaseIterable, Identifiable, Hashable, Codable, Sendable {
  case tasks
  case messages
  case groups
  case categories
  case resources

  public var id: String { rawValue }

  public var title: String {
    switch self {
    case .tasks: "Tasks"
    case .messages: "Messages"
    case .groups: "Groups"
    case .categories: "Categories"
    case .resources: "Resources"
    }
  }

  public var systemImage: String {
    switch self {
    case .tasks: "checklist"
    case .messages: "bubble.left.and.bubble.right"
    case .groups: "person.3"
    case .categories: "square.stack.3d.up"
    case .resources: "chart.bar"
    }
  }
}

/// Pages pushed from the always-available menu button. Nothing here is also a
/// primary destination.
public enum ShellMenuDestination: String, CaseIterable, Identifiable, Hashable, Codable, Sendable {
  case achievements
  case contacts
  case events
  case routings
  case profile
  case settings
  case docs
  case contactUs
  case desktopApp
  case changelog

  public var id: String { rawValue }

  public var title: String {
    switch self {
    case .achievements: "Achievements"
    case .contacts: "Contacts"
    case .events: "Events"
    case .routings: "Routings"
    case .profile: "Profile"
    case .settings: "Settings"
    case .docs: "Docs"
    case .contactUs: "Contact us"
    case .desktopApp: "Desktop app"
    case .changelog: "Changelog"
    }
  }

  public var systemImage: String {
    switch self {
    case .achievements: "trophy"
    case .contacts: "person.crop.circle"
    case .events: "calendar.badge.clock"
    case .routings: "gearshape.2"
    case .profile: "person.circle"
    case .settings: "slider.horizontal.3"
    case .docs: "doc.text"
    case .contactUs: "envelope"
    case .desktopApp: "desktopcomputer"
    case .changelog: "list.bullet"
    }
  }
}

// MARK: - Tasks filter chips

/// Chips sit above the Tasks list. Daily, Weekly and Monthly are the day, week
/// and month event slices. Events filters rows attached to a named event.
/// "All" is a query mode, not a stored event.
public enum BoardChip: String, CaseIterable, Identifiable, Hashable, Codable, Sendable {
  case all
  case daily
  case weekly
  case monthly
  case events

  public var id: String { rawValue }

  public var title: String {
    switch self {
    case .all: "All"
    case .daily: "Daily"
    case .weekly: "Weekly"
    case .monthly: "Monthly"
    case .events: "Events"
    }
  }

  public var systemImage: String {
    switch self {
    case .all: "tray.full"
    case .daily: "sun.max"
    case .weekly: "calendar"
    case .monthly: "calendar.badge.clock"
    case .events: "sparkles"
    }
  }

  /// The day a new task in this chip is planned for. Weeks start on Monday,
  /// matching the rest of the product.
  public func anchor(now: Date, calendar: Calendar) -> Date? {
    let day = calendar.startOfDay(for: now)
    switch self {
    case .all:
      return nil
    case .daily, .events:
      return day
    case .weekly:
      var mondayFirst = calendar
      mondayFirst.firstWeekday = 2
      let components = mondayFirst.dateComponents([.yearForWeekOfYear, .weekOfYear], from: day)
      return mondayFirst.date(from: components) ?? day
    case .monthly:
      let components = calendar.dateComponents([.year, .month], from: day)
      return calendar.date(from: components) ?? day
    }
  }

  public func contains(
    _ task: TaskItem,
    now: Date,
    calendar: Calendar = .current
  ) -> Bool {
    switch self {
    case .all:
      return true
    case .events:
      return task.eventID != nil
    case .daily, .weekly, .monthly:
      guard let due = task.dueAt else { return false }
      guard let anchor = anchor(now: now, calendar: calendar) else { return false }
      let day = calendar.startOfDay(for: due)
      switch self {
      case .daily:
        return day == anchor
      case .weekly:
        let end = calendar.date(byAdding: .day, value: 7, to: anchor) ?? anchor
        return day >= anchor && day < end
      case .monthly:
        let end = calendar.date(byAdding: .month, value: 1, to: anchor) ?? anchor
        return day >= anchor && day < end
      case .all, .events:
        return false
      }
    }
  }
}

// MARK: - Activity on Tasks

/// Which activity records appear on the Tasks page. Messages always keep the
/// full history on the Messages screen; this setting only filters the feed.
public enum ActivityOnTasks: String, CaseIterable, Identifiable, Hashable, Codable, Sendable {
  case others
  case all
  case none

  public var id: String { rawValue }

  public var title: String {
    switch self {
    case .others: "Others and agents"
    case .all: "Everyone"
    case .none: "None"
    }
  }

  /// The value sent to `users:setActivityOnTasks`.
  public var value: String { rawValue }

  /// A missing source reads as an agent or another person so an older payload
  /// still draws the shell.
  public func includes(_ alert: BoardAlert) -> Bool {
    switch self {
    case .others: alert.authorKind != "self"
    case .all: true
    case .none: false
    }
  }
}
