import Foundation

// MARK: - Presentation vocabulary

/// How one task is drawn on the board. A task carries its own look; the board
/// never guesses from priority or date.
public enum TaskLook: String, CaseIterable, Codable, Sendable {
  case check
  case row
  case card

  public var title: String {
    switch self {
    case .check: "Check"
    case .row: "Row"
    case .card: "Card"
    }
  }

  /// Unknown wire values fall back to the compact check mark.
  public init(decoded rawValue: String?) {
    self = Self(rawValue: rawValue ?? "") ?? .check
  }
}

/// A series declares its own machine. "None" is an ordinary task, not a daily
/// series with a special flag.
public enum SeriesBehavior: String, CaseIterable, Codable, Sendable {
  case none
  case replace
  case stack

  public var title: String {
    switch self {
    case .none: "None"
    case .replace: "Replace"
    case .stack: "Stack"
    }
  }

  public var detail: String {
    switch self {
    case .none: "One task"
    case .replace: "One open task. A missed period leaves the board."
    case .stack: "One open task per period. Missed periods stay."
    }
  }

  public init(decoded rawValue: String?) {
    self = Self(rawValue: rawValue ?? "") ?? .none
  }
}

/// How often a series mints its next occurrence. A cadence is never inferred
/// from a behavior: both are explicit choices on the series.
public enum SeriesCadence: String, CaseIterable, Codable, Sendable {
  case daily
  case weekly
  case monthly
  case every14days

  public var title: String {
    switch self {
    case .daily: "Daily"
    case .weekly: "Weekly"
    case .monthly: "Monthly"
    case .every14days: "Every 14 days"
    }
  }

  public init(decoded rawValue: String?) {
    self = Self(rawValue: rawValue ?? "") ?? .daily
  }
}

// MARK: - Modals

/// Everything that can be created or edited in a sheet. The board never pushes
/// a form into the column: each target is presented as a sheet.
public enum BoardSheet: Identifiable, Hashable, Sendable {
  case createTask
  case editTask(String)
  case category(String?)
  case event(String?)
  case view(String?)
  case progression(String?)
  case resource(String?)

  public var id: String {
    switch self {
    case .createTask: "create-task"
    case let .editTask(id): "edit-task-\(id)"
    case let .category(id): "category-\(id ?? "new")"
    case let .event(id): "event-\(id ?? "new")"
    case let .view(id): "view-\(id ?? "new")"
    case let .progression(id): "progression-\(id ?? "new")"
    case let .resource(id): "resource-\(id ?? "new")"
    }
  }

  /// The title shown in the sheet's navigation bar.
  public var title: String {
    switch self {
    case .createTask: "New task"
    case .editTask: "Task details"
    case let .category(id): id == nil ? "New category" : "Edit category"
    case let .event(id): id == nil ? "New event" : "Edit event"
    case let .view(id): id == nil ? "New view" : "Edit view"
    case let .progression(id): id == nil ? "New progression" : "Edit progression"
    case let .resource(id): id == nil ? "New resource" : "Edit resource"
    }
  }
}

/// A locally authored entity. Events, progressions and resources are target
/// vocabulary whose backend mutations are still being built; the UI shell keeps
/// the draft in memory so the sheet flow can be exercised end to end.
public enum BoardEntityKind: String, CaseIterable, Codable, Sendable {
  case category
  case event
  case view
  case progression
  case resource
}

public struct BoardEntity: Identifiable, Hashable, Codable, Sendable {
  public var id: String
  public var kind: BoardEntityKind
  public var title: String
  public var icon: String
  public var color: String

  public init(
    id: String = UUID().uuidString,
    kind: BoardEntityKind,
    title: String,
    icon: String,
    color: String
  ) {
    self.id = id
    self.kind = kind
    self.title = title
    self.icon = icon
    self.color = color
  }
}

/// One tile on the full-screen category dashboard. The add tile is always last
/// and is the only path to the category sheet from the dashboard.
public struct DashboardTile: Identifiable, Hashable, Sendable {
  public var id: String
  public var title: String
  public var icon: String
  public var color: String
  public var isAddTile: Bool

  public init(
    id: String,
    title: String,
    icon: String,
    color: String,
    isAddTile: Bool = false
  ) {
    self.id = id
    self.title = title
    self.icon = icon
    self.color = color
    self.isAddTile = isAddTile
  }
}
