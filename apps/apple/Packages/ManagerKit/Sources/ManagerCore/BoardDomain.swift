import Foundation

// MARK: - Appearance

/// Icon and color are strings on the record. Unknown values fall back instead
/// of trapping, so a template built by a newer client or a typo in a custom
/// view cannot crash an older one.
public enum Appearance {
  /// Lucide names the client knows how to draw. Anything else becomes a
  /// neutral tile instead of trapping on an `Image`.
  public static let knownIcons: Set<String> = Set(IconChoice.all.map(\.id))

  public static let fallbackIcon = "square.dashed"

  public static let knownColors: Set<String> = Set(colorTokens)

  /// The swatch order used by every appearance picker.
  public static let colorTokens: [String] = [
    "sky", "mint", "green", "amber", "orange", "rose", "violet", "blue",
    "slate", "teal", "red", "yellow", "purple", "pink", "indigo", "gray",
  ]
  public static let fallbackColor = "sky"

  /// Maps a stored Lucide name to the SF Symbol drawn on Apple platforms.
  /// Unknown values already went through `icon(_:)`, so this never traps.
  public static func symbol(for raw: String?) -> String {
    let resolved = icon(raw)
    return IconChoice.all.first { $0.id == resolved }?.symbol ?? fallbackIcon
  }

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

  private enum CodingKeys: String, CodingKey {
    case id, title, icon, color, kind
    case templateID = "templateId"
    case templateIDUpper = "templateID"
  }

  public init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    id = try container.decodeIfPresent(String.self, forKey: .id) ?? ""
    title = try container.decodeIfPresent(String.self, forKey: .title) ?? id
    icon = try container.decodeIfPresent(String.self, forKey: .icon) ?? ""
    color = try container.decodeIfPresent(String.self, forKey: .color) ?? ""
    kind = try container.decodeIfPresent(Kind.self, forKey: .kind) ?? .custom
    templateID = try container.decodeIfPresent(String.self, forKey: .templateID)
      ?? container.decodeIfPresent(String.self, forKey: .templateIDUpper)
  }

  public func encode(to encoder: Encoder) throws {
    var container = encoder.container(keyedBy: CodingKeys.self)
    try container.encode(id, forKey: .id)
    try container.encode(title, forKey: .title)
    try container.encode(icon, forKey: .icon)
    try container.encode(color, forKey: .color)
    try container.encode(kind, forKey: .kind)
    try container.encodeIfPresent(templateID, forKey: .templateID)
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

/// An agent or person note. It has no checkbox. Reading it clears NEW. The
/// Tasks feed keeps the note when the activity setting includes the author.
/// History always keeps it.
public struct BoardAlert: Identifiable, Hashable, Codable, Sendable {
  public var id: String
  public var title: String
  public var body: String
  /// `self`, `agent` or `member`. Missing fields decode as empty and are read
  /// as someone else.
  public var author: String
  public var seenAt: Date?

  public init(
    id: String,
    title: String,
    body: String,
    author: String = "",
    seenAt: Date? = nil
  ) {
    self.id = id
    self.title = title
    self.body = body
    self.author = author
    self.seenAt = seenAt
  }

  private enum CodingKeys: String, CodingKey {
    case id, title, body, author, seenAt
  }

  public init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    id = try container.decode(String.self, forKey: .id)
    title = try container.decodeIfPresent(String.self, forKey: .title) ?? ""
    body = try container.decodeIfPresent(String.self, forKey: .body) ?? ""
    author = try container.decodeIfPresent(String.self, forKey: .author) ?? ""
    seenAt = try container.decodeIfPresent(Date.self, forKey: .seenAt)
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
  public var seenAt: Date?

  public init(
    id: String,
    prompt: String,
    options: [QuestionOption],
    answeredAt: Date? = nil,
    seenAt: Date? = nil
  ) {
    self.id = id
    self.prompt = prompt
    self.options = options
    self.answeredAt = answeredAt
    self.seenAt = seenAt
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

/// One row anatomy for every record type. The stored `look` is deliberately
/// not part of this enum: a `card` hint in data still draws as this row.
public enum BoardRow: Identifiable, Hashable, Sendable {
  case task(TaskItem)
  case alert(BoardAlert)
  case question(BoardQuestion)
  case invite(BoardInvite)
  case progression(BoardProgression)
  case quest(BoardQuest)
  case group(BoardGroup)
  case category(BoardCategory)
  case resource(BoardResource)
  case routing(BoardRouting)

  public var id: String {
    switch self {
    case let .task(task): "task-\(task.id)"
    case let .alert(alert): "alert-\(alert.id)"
    case let .question(question): "question-\(question.id)"
    case let .invite(invite): "invite-\(invite.id)"
    case let .progression(progression): "progression-\(progression.id)"
    case let .quest(quest): "quest-\(quest.id)"
    case let .group(group): "group-\(group.id)"
    case let .category(category): "category-\(category.id)"
    case let .resource(resource): "resource-\(resource.id)"
    case let .routing(routing): "routing-\(routing.id)"
    }
  }

  public var title: String {
    switch self {
    case let .task(task): task.title
    case let .alert(alert): alert.title
    case let .question(question): question.prompt
    case let .invite(invite): invite.title
    case let .progression(progression): progression.title
    case let .quest(quest): quest.title
    case let .group(group): group.title
    case let .category(category): category.displayTitle
    case let .resource(resource): resource.displayTitle
    case let .routing(routing): routing.displayTitle
    }
  }

  public var body: String? {
    switch self {
    case let .task(task): task.notes
    case let .alert(alert): alert.body
    case let .invite(invite): invite.email.isEmpty ? nil : "Invited to \(invite.groupId)"
    case let .resource(resource): resource.unit.isEmpty ? nil : "\(resource.quantity) \(resource.unit)"
    case let .routing(routing): routing.title.isEmpty ? nil : "\(routing.trigger) · \(routing.executionKind)"
    default: nil
    }
  }

  /// The type mark is an image, never a button.
  public var typeMark: String {
    switch self {
    case .task: "checkmark.circle"
    case .alert: "bell"
    case .question: "questionmark.circle"
    case .invite: "envelope"
    case .progression: "chart.bar"
    case .quest: "exclamationmark.circle"
    case .group: "person.3"
    case .category: "square.stack.3d.up"
    case .resource: "chart.bar"
    case .routing: "gearshape.2"
    }
  }

  public var isUnseen: Bool {
    switch self {
    case let .task(task): task.isNew
    case let .alert(alert): alert.isUnseen
    case let .question(question): question.seenAt == nil && question.answeredAt == nil
    case let .invite(invite): invite.isNew
    default: false
    }
  }

  public var progressText: String? {
    switch self {
    case let .progression(progression): "\(progression.current)/\(progression.target)"
    default: nil
    }
  }

  public var groupID: String? {
    switch self {
    case let .task(task): task.groupID
    case let .invite(invite): invite.groupId
    case .group: nil
    default: nil
    }
  }

  public var primaryActionTitle: String {
    switch self {
    case let .task(task): task.done ? "Reopen" : "Done"
    case .alert: "Mark as read"
    case .question: "Answer"
    case .invite: "Accept"
    case .progression: "Log"
    case .quest: "Open"
    case .group: "Open"
    case .category: "Open"
    case .resource: "Open"
    case .routing: "Open"
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
/// last `board:slice` payload in the same shape. Every newer array defaults to
/// empty, so an older payload still draws the shell.
public struct BoardSnapshot: Codable, Sendable {
  public var views: [BoardViewItem]
  public var alerts: [BoardAlert]
  public var questions: [BoardQuestion]
  public var progressions: [BoardProgression]
  public var quests: [BoardQuest]
  public var groups: [BoardGroup]
  public var invites: [BoardInvite]
  public var routings: [BoardRouting]
  public var categories: [BoardCategory]
  public var resources: [BoardResource]

  public init(
    views: [BoardViewItem] = [.home],
    alerts: [BoardAlert] = [],
    questions: [BoardQuestion] = [],
    progressions: [BoardProgression] = [],
    quests: [BoardQuest] = [],
    groups: [BoardGroup] = [],
    invites: [BoardInvite] = [],
    routings: [BoardRouting] = [],
    categories: [BoardCategory] = [],
    resources: [BoardResource] = []
  ) {
    self.views = views
    self.alerts = alerts
    self.questions = questions
    self.progressions = progressions
    self.quests = quests
    self.groups = groups
    self.invites = invites
    self.routings = routings
    self.categories = categories
    self.resources = resources
  }

  private enum CodingKeys: String, CodingKey {
    case views, alerts, questions, progressions, quests
    case groups, invites, routings, categories, resources
  }

  /// An older payload omits the newer arrays. Every one of them becomes an
  /// empty array rather than failing the whole snapshot.
  public init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    views = try container.decodeIfPresent([BoardViewItem].self, forKey: .views) ?? [.home]
    alerts = try container.decodeIfPresent([BoardAlert].self, forKey: .alerts) ?? []
    questions = try container.decodeIfPresent([BoardQuestion].self, forKey: .questions) ?? []
    progressions = try container.decodeIfPresent([BoardProgression].self, forKey: .progressions) ?? []
    quests = try container.decodeIfPresent([BoardQuest].self, forKey: .quests) ?? []
    groups = try container.decodeIfPresent([BoardGroup].self, forKey: .groups) ?? []
    invites = try container.decodeIfPresent([BoardInvite].self, forKey: .invites) ?? []
    routings = try container.decodeIfPresent([BoardRouting].self, forKey: .routings) ?? []
    categories = try container.decodeIfPresent([BoardCategory].self, forKey: .categories) ?? []
    resources = try container.decodeIfPresent([BoardResource].self, forKey: .resources) ?? []
  }

  /// Content used when no backend payload has arrived yet (previews, tests and
  /// the first frame before `board:slice` answers). The destinations and chips
  /// come from the shell itself, so they always show with an empty snapshot.
  public static let starter = BoardSnapshot(
    views: [.home],
    alerts: [
      BoardAlert(id: "flight", title: "Flight is Thursday", body: "Leave for the airport by 08:00.", author: "agent"),
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

  /// Mixed rows for one chip, grouped by kind. Empty groups are dropped; the
  /// chips and destinations are owned by the shell so they never disappear.
  public func sections(
    tasks: [TaskItem],
    chip: BoardChip,
    activity: ActivityOnTasks = .others,
    groupID: String? = nil,
    now: Date = .now,
    calendar: Calendar = .current
  ) -> [BoardSection] {
    let inGroup = { (rowGroupID: String?) -> Bool in
      guard let groupID else { return true }
      return rowGroupID == nil || rowGroupID == groupID
    }
    let openTasks = tasks.filter { task in
      !task.done
        && task.outcome == nil
        && task.deletedAt == nil
        && chip.contains(task, now: now, calendar: calendar)
        && inGroup(task.groupID)
    }
    let visibleAlerts = alerts.filter { activity.includes($0) }
    let openQuestions = questions.filter { $0.answeredAt == nil }
    let pendingInvites = invites.filter { $0.isPending }
    let visibleProgressions = progressions.filter { _ in inGroup(nil) }

    var result: [BoardSection] = []
    if !visibleAlerts.isEmpty {
      result.append(BoardSection(id: "messages", title: "Messages", rows: visibleAlerts.map(BoardRow.alert)))
    }
    if !openQuestions.isEmpty {
      result.append(BoardSection(id: "questions", title: "Questions", rows: openQuestions.map(BoardRow.question)))
    }
    if !pendingInvites.isEmpty {
      result.append(BoardSection(id: "invites", title: "Invites", rows: pendingInvites.map(BoardRow.invite)))
    }
    if !openTasks.isEmpty {
      result.append(BoardSection(id: "tasks", title: "Tasks", rows: openTasks.map(BoardRow.task)))
    }
    if !visibleProgressions.isEmpty {
      result.append(BoardSection(id: "progressions", title: "Progressions", rows: visibleProgressions.map(BoardRow.progression)))
    }
    if !quests.isEmpty {
      result.append(BoardSection(id: "quests", title: "Quests", rows: quests.map(BoardRow.quest)))
    }
    return result
  }
}
