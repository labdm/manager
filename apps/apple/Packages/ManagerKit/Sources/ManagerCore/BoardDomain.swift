import Foundation

// MARK: - Appearance

/// Icon and color are strings on the record. Unknown values fall back instead
/// of trapping, so a template built by a newer client or a typo in a custom
/// view cannot crash an older one.
public enum Appearance {
  /// SF Symbols the rail knows how to draw. Anything else becomes a neutral tile.
  public static let knownIcons: Set<String> = [
    "house", "square.grid.2x2", "heart", "figure.walk", "person.2",
    "briefcase", "folder", "dollarsign.circle", "gearshape", "book",
    "bubble.left.and.bubble.right", "paintbrush", "sun.max", "calendar",
    "checkmark.circle", "tray.full", "star", "bolt", "square.dashed",
  ]
  public static let fallbackIcon = "square.dashed"

  public static let knownColors: Set<String> = [
    "sky", "mint", "green", "amber", "orange", "rose", "violet", "blue",
    "slate", "teal", "red", "yellow", "purple", "pink", "indigo", "gray",
  ]
  public static let fallbackColor = "sky"

  public static func icon(_ raw: String?) -> String {
    guard let raw, knownIcons.contains(raw) else { return fallbackIcon }
    return raw
  }

  public static func color(_ raw: String?) -> String {
    guard let raw, knownColors.contains(raw) else { return fallbackColor }
    return raw
  }
}

// MARK: - Rail view

/// One left-rail slice. "View" is the product word: Home, an installed
/// template, a computed view or one the person made themselves. It is not a
/// shared space.
public struct BoardViewItem: Identifiable, Hashable, Codable, Sendable {
  public enum Kind: String, Codable, Sendable {
    case home
    case template
    case custom
    case computed
  }

  public var id: String
  public var title: String
  public var icon: String
  public var color: String
  public var kind: Kind
  public var templateID: String?

  public init(
    id: String,
    title: String,
    icon: String,
    color: String,
    kind: Kind,
    templateID: String? = nil
  ) {
    self.id = id
    self.title = title
    self.icon = icon
    self.color = color
    self.kind = kind
    self.templateID = templateID
  }

  public static let home = BoardViewItem(
    id: "home",
    title: "Home",
    icon: "house",
    color: "sky",
    kind: .home
  )

  /// The raw strings are kept as-is; the renderer is responsible for falling
  /// back. This keeps the model a faithful mirror of the wire record.
  public var resolvedIcon: String { Appearance.icon(icon) }
  public var resolvedColor: String { Appearance.color(color) }
}

// MARK: - Template catalog

/// A Find more hit: a category with a suggested icon and color. Installing one
/// copies it onto the rail as a view.
public struct ViewTemplate: Identifiable, Hashable, Codable, Sendable {
  public var id: String
  public var title: String
  public var icon: String
  public var color: String

  public init(id: String, title: String, icon: String, color: String) {
    self.id = id
    self.title = title
    self.icon = icon
    self.color = color
  }

  public var view: BoardViewItem {
    BoardViewItem(
      id: "view-\(id)",
      title: title,
      icon: Appearance.icon(icon),
      color: Appearance.color(color),
      kind: .template,
      templateID: id
    )
  }
}

public enum ViewTemplateCatalog {
  public static let all: [ViewTemplate] = [
    ViewTemplate(id: "household", title: "Household", icon: "house", color: "mint"),
    ViewTemplate(id: "health", title: "Health", icon: "heart", color: "rose"),
    ViewTemplate(id: "body", title: "Body", icon: "figure.walk", color: "orange"),
    ViewTemplate(id: "relationships", title: "Relationships", icon: "person.2", color: "violet"),
    ViewTemplate(id: "work", title: "Work", icon: "briefcase", color: "blue"),
    ViewTemplate(id: "projects", title: "Projects", icon: "folder", color: "amber"),
    ViewTemplate(id: "money", title: "Money", icon: "dollarsign.circle", color: "green"),
    ViewTemplate(id: "admin", title: "Admin", icon: "gearshape", color: "slate"),
    ViewTemplate(id: "learning", title: "Learning", icon: "book", color: "indigo"),
    ViewTemplate(id: "social", title: "Social", icon: "bubble.left.and.bubble.right", color: "pink"),
    ViewTemplate(id: "creative", title: "Creative", icon: "paintbrush", color: "purple"),
  ]
}

// MARK: - Tabs

/// The top-of-column tabs. `Tasks` has no time filter; the other three attach
/// the slice to a day, week or month event.
public enum BoardSlice: String, CaseIterable, Identifiable, Codable, Sendable {
  case tasks
  case daily
  case weekly
  case monthly

  public var id: String { rawValue }

  public var title: String {
    switch self {
    case .tasks: "Tasks"
    case .daily: "Daily"
    case .weekly: "Weekly"
    case .monthly: "Monthly"
    }
  }

  public var systemImage: String {
    switch self {
    case .tasks: "tray.full"
    case .daily: "sun.max"
    case .weekly: "calendar"
    case .monthly: "calendar.badge.clock"
    }
  }

  /// The day a new task in this slice should be planned for. Weeks start on
  /// Monday, matching the rest of the product.
  public func anchor(now: Date, calendar: Calendar) -> Date {
    let day = calendar.startOfDay(for: now)
    switch self {
    case .tasks, .daily:
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

  public func contains(_ date: Date, now: Date, calendar: Calendar) -> Bool {
    let day = calendar.startOfDay(for: date)
    let anchor = self.anchor(now: now, calendar: calendar)
    switch self {
    case .tasks:
      return true
    case .daily:
      return day == anchor
    case .weekly:
      return day >= anchor && day < (calendar.date(byAdding: .day, value: 7, to: anchor) ?? day)
    case .monthly:
      return day >= anchor && day < (calendar.date(byAdding: .month, value: 1, to: anchor) ?? day)
    }
  }
}

// MARK: - Mixed rows

/// An agent or person note. It has no checkbox; reading it clears it from the
/// band and leaves it in the log.
public struct BoardAlert: Identifiable, Hashable, Codable, Sendable {
  public var id: String
  public var title: String
  public var body: String

  public init(id: String, title: String, body: String) {
    self.id = id
    self.title = title
    self.body = body
  }
}

public struct QuestionOption: Identifiable, Hashable, Codable, Sendable {
  public var id: String
  public var label: String

  public init(id: String, label: String) {
    self.id = id
    self.label = label
  }
}

/// A prompt with options. Answering removes it from the column; the answer may
/// append a quest step or create a task later.
public struct BoardQuestion: Identifiable, Hashable, Codable, Sendable {
  public var id: String
  public var prompt: String
  public var options: [QuestionOption]
  public var answeredAt: Date?

  public init(id: String, prompt: String, options: [QuestionOption], answeredAt: Date? = nil) {
    self.id = id
    self.prompt = prompt
    self.options = options
    self.answeredAt = answeredAt
  }
}

/// A known-size track: a bar drawn from `current` to `target`.
public struct BoardProgression: Identifiable, Hashable, Codable, Sendable {
  public var id: String
  public var title: String
  public var current: Int
  public var target: Int

  public init(id: String, title: String, current: Int, target: Int) {
    self.id = id
    self.title = title
    self.current = current
    self.target = max(1, target)
  }

  public var fraction: Double {
    guard target > 0 else { return 0 }
    return min(1, max(0, Double(current) / Double(target)))
  }
}

public struct QuestStep: Identifiable, Hashable, Codable, Sendable {
  public var id: String
  public var title: String
  public var done: Bool

  public init(id: String, title: String, done: Bool = false) {
    self.id = id
    self.title = title
    self.done = done
  }
}

/// A chain of tasks drawn as a stepper with an empty next slot.
public struct BoardQuest: Identifiable, Hashable, Codable, Sendable {
  public var id: String
  public var title: String
  public var steps: [QuestStep]
  public var isWaiting: Bool

  public init(id: String, title: String, steps: [QuestStep], isWaiting: Bool = false) {
    self.id = id
    self.title = title
    self.steps = steps
    self.isWaiting = isWaiting
  }
}

public enum BoardRow: Identifiable, Sendable {
  case task(TaskItem)
  case alert(BoardAlert)
  case question(BoardQuestion)
  case progression(BoardProgression)
  case quest(BoardQuest)

  public var id: String {
    switch self {
    case let .task(task): "task-\(task.id)"
    case let .alert(alert): "alert-\(alert.id)"
    case let .question(question): "question-\(question.id)"
    case let .progression(progression): "progression-\(progression.id)"
    case let .quest(quest): "quest-\(quest.id)"
    }
  }
}

public struct BoardSection: Identifiable, Sendable {
  public var id: String
  public var title: String
  public var rows: [BoardRow]

  public init(id: String, title: String, rows: [BoardRow]) {
    self.id = id
    self.title = title
    self.rows = rows
  }
}

// MARK: - Snapshot

/// Everything the shell draws except the live task list. It is the unit-test
/// source: the in-memory backend owns one, and the Convex backend keeps the
/// last `board:slice` payload in the same shape.
public struct BoardSnapshot: Codable, Sendable {
  public var views: [BoardViewItem]
  public var alerts: [BoardAlert]
  public var questions: [BoardQuestion]
  public var progressions: [BoardProgression]
  public var quests: [BoardQuest]

  public init(
    views: [BoardViewItem] = [.home],
    alerts: [BoardAlert] = [],
    questions: [BoardQuestion] = [],
    progressions: [BoardProgression] = [],
    quests: [BoardQuest] = []
  ) {
    self.views = views
    self.alerts = alerts
    self.questions = questions
    self.progressions = progressions
    self.quests = quests
  }

  /// Content used when no backend payload has arrived yet (previews, tests and
  /// the first frame before `board:slice` answers). Rail and tabs come from the
  /// shell itself, so they always show even with an empty snapshot.
  public static let starter = BoardSnapshot(
    views: [.home],
    alerts: [
      BoardAlert(id: "flight", title: "Flight is Thursday", body: "Leave for the airport by 08:00."),
    ],
    questions: [
      BoardQuestion(
        id: "glass",
        prompt: "How do you want to fix the broken window?",
        options: [
          QuestionOption(id: "buy", label: "Buy glass"),
          QuestionOption(id: "send", label: "Send money"),
          QuestionOption(id: "repairer", label: "Call a repairer"),
          QuestionOption(id: "other", label: "Something else"),
        ]
      ),
    ],
    progressions: [
      BoardProgression(id: "book", title: "Finish the book", current: 150, target: 300),
    ],
    quests: [
      BoardQuest(
        id: "window",
        title: "Broken window",
        steps: [QuestStep(id: "call", title: "Call the landlord", done: true)],
        isWaiting: true
      ),
    ]
  )

  /// Mixed rows for one slice, grouped by kind. Empty groups are dropped; the
  /// rail and tabs are owned by the shell so they never disappear.
  public func sections(
    tasks: [TaskItem],
    slice: BoardSlice,
    now: Date = .now,
    calendar: Calendar = .current
  ) -> [BoardSection] {
    let openTasks = tasks.filter {
      !$0.done && $0.outcome == nil && $0.deletedAt == nil && slice.contains($0.dueAt ?? .distantPast, now: now, calendar: calendar)
    }

    var result: [BoardSection] = []
    if !alerts.isEmpty {
      result.append(BoardSection(id: "alerts", title: "Alerts", rows: alerts.map(BoardRow.alert)))
    }
    let openQuestions = questions.filter { $0.answeredAt == nil }
    if !openQuestions.isEmpty {
      result.append(BoardSection(id: "questions", title: "Questions", rows: openQuestions.map(BoardRow.question)))
    }
    if !openTasks.isEmpty {
      result.append(BoardSection(id: "tasks", title: "Tasks", rows: openTasks.map(BoardRow.task)))
    }
    if !progressions.isEmpty {
      result.append(BoardSection(id: "progression", title: "Progression", rows: progressions.map(BoardRow.progression)))
    }
    if !quests.isEmpty {
      result.append(BoardSection(id: "quests", title: "Quests", rows: quests.map(BoardRow.quest)))
    }
    return result
  }
}
