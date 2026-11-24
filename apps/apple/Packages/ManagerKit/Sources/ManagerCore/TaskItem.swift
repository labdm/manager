import Foundation

/// One task, as every client sees it.
///
/// Mirrors `TaskView` in `packages/backend/convex/lib/taskService.ts`. `dueAt`
/// is the legacy name for the planned day; the two are one fact here so they
/// cannot drift. `deadlineAt` is a separate clock and never writes the day.
public struct TaskItem: Identifiable, Hashable, Sendable, Codable {
  public var id: String
  public var title: String
  public var done: Bool
  /// Start of the planned civil day, converted from the backend's epoch ms.
  public var dueAt: Date?
  public var notes: String?
  /// Minutes from midnight, 0–1439, only when there is a clock time.
  public var plannedTime: Int?
  public var location: String?
  public var deadlineAt: Date?
  public var remindAt: Date?
  public var priority: TaskPriority
  public var priorityRank: Int
  public var effectiveRank: Int
  public var overdue: Bool
  public var overduePolicy: OverduePolicy
  public var outcome: String?
  public var origin: TaskOrigin?
  public var seenAt: Date?
  public var completedAt: Date?
  public var deletedAt: Date?
  /// Recurrence identifier links this task to a recurring series.
  public var recurrenceId: String?
  /// Behavior of the recurrence: "replace" or "stack".
  public var behavior: String?
  /// Start of the civil day period for recurrence minting.
  public var periodStart: Date?
  /// How the task is drawn: check, row or card.
  public var look: TaskLook
  /// The series machine: none, replace or stack. `behavior` is the wire mirror.
  public var series: SeriesBehavior
  /// How often a series mints its next occurrence.
  public var cadence: SeriesCadence

  /// The planned day and `dueAt` are the same fact. Keeping one stored copy
  /// makes an old row with only `dueAt` and a new row with only `plannedOn`
  /// look identical to the board.
  public var plannedOn: Date? {
    get { dueAt }
    set { dueAt = newValue }
  }

  /// An agent or another person made this row and the user has not opened it.
  public var isNew: Bool { TaskFacts.isNew(origin: origin, seenAt: seenAt) }

  public init(
    id: String,
    title: String,
    done: Bool,
    dueAt: Date? = nil,
    notes: String? = nil,
    plannedTime: Int? = nil,
    location: String? = nil,
    deadlineAt: Date? = nil,
    remindAt: Date? = nil,
    priority: TaskPriority = .normal,
    priorityRank: Int? = nil,
    effectiveRank: Int? = nil,
    overdue: Bool = false,
    overduePolicy: OverduePolicy = .none,
    outcome: String? = nil,
    origin: TaskOrigin? = nil,
    seenAt: Date? = nil,
    completedAt: Date? = nil,
    deletedAt: Date? = nil,
    recurrenceId: String? = nil,
    behavior: String? = nil,
    periodStart: Date? = nil,
    look: TaskLook = .check,
    series: SeriesBehavior = .none,
    cadence: SeriesCadence = .daily
  ) {
    self.id = id
    self.title = title
    self.done = done
    self.dueAt = dueAt
    self.notes = notes
    self.plannedTime = TaskFacts.normalizedPlannedTime(plannedTime)
    self.location = location
    self.deadlineAt = deadlineAt
    self.remindAt = remindAt
    self.priority = priority
    self.priorityRank = priorityRank ?? priority.seedRank
    self.effectiveRank = effectiveRank ?? self.priorityRank
    self.overdue = overdue
    self.overduePolicy = overduePolicy
    self.outcome = outcome
    self.origin = origin
    self.seenAt = seenAt
    self.completedAt = completedAt
    self.deletedAt = deletedAt
    self.recurrenceId = recurrenceId
    self.behavior = behavior
    self.periodStart = periodStart
    self.look = look
    self.series = series
    self.cadence = cadence
  }

  public func withDone(_ done: Bool, at date: Date = Date()) -> TaskItem {
    var copy = self
    copy.done = done
    copy.completedAt = done ? (completedAt ?? date) : nil
    copy.overdue = done ? false : overdue
    if done {
      copy.effectiveRank = TaskFacts.effectiveRank(
        priorityRank: priorityRank,
        priority: priority,
        policy: overduePolicy,
        overdue: false
      )
    }
    return copy
  }

  public func withTitle(_ title: String) -> TaskItem {
    var copy = self
    copy.title = title
    return copy
  }

  public func withSeen(at date: Date = Date()) -> TaskItem {
    var copy = self
    if copy.seenAt == nil { copy.seenAt = date }
    return copy
  }

  /// Applies editor changes without touching facts the editor does not own.
  public func applying(_ draft: TaskDraft, now: Date = Date()) -> TaskItem {
    var copy = self
    copy.title = draft.title
    copy.notes = draft.notes
    // Callers normalize to a civil-day start before they build the draft.
    copy.dueAt = draft.plannedOn
    copy.plannedTime = TaskFacts.normalizedPlannedTime(draft.plannedTime)
    copy.location = draft.location
    copy.deadlineAt = draft.deadlineAt
    copy.remindAt = draft.remindAt
    copy.priority = draft.priority
    copy.priorityRank = draft.priorityRank
    copy.overduePolicy = draft.overduePolicy
    copy.overdue = TaskFacts.isOverdue(
      deadlineAt: copy.deadlineAt,
      done: copy.done,
      deletedAt: copy.deletedAt,
      now: now
    )
    copy.effectiveRank = TaskFacts.effectiveRank(
      priorityRank: copy.priorityRank,
      priority: copy.priority,
      policy: copy.overduePolicy,
      overdue: copy.overdue
    )
    copy.look = draft.look
    // Series and cadence are sheet facts for a planned mechanic: they are not
    // written by the M1 task mutation, so an edit keeps the stored series.
    return copy
  }
}
