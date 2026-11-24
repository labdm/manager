import Foundation

/// The seed priority strings. Unknown values from the backend are preserved as
/// raw strings but are not offered in the picker.
public struct TaskPriority: RawRepresentable, Hashable, Codable, Sendable {
  public let rawValue: String

  public init(rawValue: String) {
    self.rawValue = rawValue
  }

  public init(from decoder: Decoder) throws {
    let container = try decoder.singleValueContainer()
    rawValue = try container.decode(String.self)
  }

  public func encode(to encoder: Encoder) throws {
    var container = encoder.singleValueContainer()
    try container.encode(rawValue)
  }

  public static let low = TaskPriority(rawValue: "low")
  public static let normal = TaskPriority(rawValue: "normal")
  public static let high = TaskPriority(rawValue: "high")
  public static let urgent = TaskPriority(rawValue: "urgent")

  public static let seeds: [TaskPriority] = [.low, .normal, .high, .urgent]

  /// Mirrors the seed ranks in `docs/plan.md`. An unknown string stays valid but
  /// sorts at the normal rank until the backend says otherwise.
  public var seedRank: Int {
    switch self {
    case Self.low: 0
    case Self.normal: 10
    case Self.high: 20
    case Self.urgent: 30
    default: 10
    }
  }

  public var isSeed: Bool { Self.seeds.contains(self) }

  /// Decoding is forgiving: an omitted priority means `normal`.
  public init(decoded rawValue: String?) {
    self.rawValue = rawValue ?? Self.normal.rawValue
  }
}

/// M1's three overdue policies. Unknown values fall back to doing nothing.
public enum OverduePolicy: String, CaseIterable, Codable, Sendable {
  case none
  case retire
  case escalate

  public init(decoded rawValue: String?) {
    self = Self(rawValue: rawValue ?? "") ?? .none
  }
}

/// Who put the row on the board. `member` is reserved for shared spaces later.
public enum TaskOrigin: String, Codable, Sendable {
  case selfCreated = "self"
  case agent
  case member

  public init?(decoded rawValue: String?) {
    guard let rawValue else { return nil }
    self.init(rawValue: rawValue)
  }
}

/// Derived M1 rules shared by decoding and optimistic updates.
public enum TaskFacts {
  /// NEW is an unread row from an agent or another person, never a local create
  /// and never a legacy row with no origin.
  public static func isNew(origin: TaskOrigin?, seenAt: Date?) -> Bool {
    guard seenAt == nil else { return false }
    return origin == .agent || origin == .member
  }

  /// A deadline is its own clock. It never supplies the planned day or `dueAt`.
  public static func plannedDay(_ date: Date?, calendar: Calendar = .current) -> Date? {
    date.map { calendar.startOfDay(for: $0) }
  }

  public static func isValidPlannedTime(_ minutes: Int) -> Bool {
    (0..<1440).contains(minutes)
  }

  public static func normalizedPlannedTime(_ minutes: Int?) -> Int? {
    guard let minutes, isValidPlannedTime(minutes) else { return nil }
    return minutes
  }

  public static func minutes(from date: Date, calendar: Calendar = .current) -> Int {
    let components = calendar.dateComponents([.hour, .minute], from: date)
    return (components.hour ?? 0) * 60 + (components.minute ?? 0)
  }

  public static func date(
    fromPlannedTime minutes: Int,
    on day: Date? = nil,
    calendar: Calendar = .current
  ) -> Date? {
    guard isValidPlannedTime(minutes) else { return nil }
    let base = calendar.startOfDay(for: day ?? Date())
    return calendar.date(
      byAdding: DateComponents(hour: minutes / 60, minute: minutes % 60),
      to: base
    )
  }

  public static func label(forPlannedTime minutes: Int) -> String {
    String(format: "%02d:%02d", minutes / 60, minutes % 60)
  }

  public static func isOverdue(deadlineAt: Date?, done: Bool, deletedAt: Date?, now: Date) -> Bool {
    guard !done, deletedAt == nil, let deadlineAt else { return false }
    return deadlineAt < now
  }

  /// Escalate adds ten to a seed rank, capped at urgent, and only while the
  /// deadline has passed. Other policies and custom priorities stay put.
  public static func effectiveRank(
    priorityRank: Int,
    priority: TaskPriority,
    policy: OverduePolicy,
    overdue: Bool
  ) -> Int {
    guard overdue, policy == .escalate, priority.isSeed else { return priorityRank }
    return min(priorityRank + 10, 30)
  }
}

/// Every field the task editor can write. Unset optional facts clear the wire
/// field; dates and ranks are normalized by the model before they get here.
public struct TaskDraft: Equatable, Sendable {
  public var title: String
  public var notes: String?
  public var plannedOn: Date?
  public var plannedTime: Int?
  public var location: String?
  public var deadlineAt: Date?
  public var remindAt: Date?
  public var priority: TaskPriority
  public var priorityRank: Int
  public var overduePolicy: OverduePolicy
  public var look: TaskLook
  public var series: SeriesBehavior
  public var cadence: SeriesCadence

  public init(
    title: String,
    notes: String? = nil,
    plannedOn: Date? = nil,
    plannedTime: Int? = nil,
    location: String? = nil,
    deadlineAt: Date? = nil,
    remindAt: Date? = nil,
    priority: TaskPriority = .normal,
    priorityRank: Int? = nil,
    overduePolicy: OverduePolicy = .none,
    look: TaskLook = .check,
    series: SeriesBehavior = .none,
    cadence: SeriesCadence = .daily
  ) {
    self.title = title
    self.notes = notes
    self.plannedOn = plannedOn
    self.plannedTime = TaskFacts.normalizedPlannedTime(plannedTime)
    self.location = location
    self.deadlineAt = deadlineAt
    self.remindAt = remindAt
    self.priority = priority
    self.priorityRank = priorityRank ?? priority.seedRank
    self.overduePolicy = overduePolicy
    self.look = look
    self.series = series
    self.cadence = cadence
  }

  public init(task: TaskItem) {
    self.init(
      title: task.title,
      notes: task.notes,
      plannedOn: task.plannedOn,
      plannedTime: task.plannedTime,
      location: task.location,
      deadlineAt: task.deadlineAt,
      remindAt: task.remindAt,
      priority: task.priority,
      priorityRank: task.priorityRank,
      overduePolicy: task.overduePolicy,
      look: task.look,
      series: task.series,
      cadence: task.cadence
    )
  }
}
