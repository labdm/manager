import ConvexMobile
import Foundation
import ManagerCore

// MARK: - Wire records

/// Tolerant decoding of `board:slice`. Every field is optional so a partially
/// deployed backend cannot blank the shell. Convex numbers arrive tagged, so
/// numeric fields use `@OptionalConvexFloat`.
private struct BoardSlicePayload: Decodable {
  let views: [ViewRecord]?
  let alerts: [AlertRecord]?
  let questions: [QuestionRecord]?
  let progressions: [ProgressionRecord]?
  let quests: [QuestRecord]?

  private enum CodingKeys: String, CodingKey {
    case views
    case rail
    case alerts
    case questions
    case progressions
    case quests
  }

  init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    views = try container.decodeIfPresent([ViewRecord].self, forKey: .rail)
      ?? container.decodeIfPresent([ViewRecord].self, forKey: .views)
    alerts = try container.decodeIfPresent([AlertRecord].self, forKey: .alerts)
    questions = try container.decodeIfPresent([QuestionRecord].self, forKey: .questions)
    progressions = try container.decodeIfPresent([ProgressionRecord].self, forKey: .progressions)
    quests = try container.decodeIfPresent([QuestRecord].self, forKey: .quests)
  }

  var snapshot: BoardSnapshot {
    BoardSnapshot(
      views: (views ?? []).map(\.view),
      alerts: (alerts ?? []).map(\.alert),
      questions: (questions ?? []).map(\.question),
      progressions: (progressions ?? []).map(\.progression),
      quests: (quests ?? []).map(\.quest)
    )
  }
}

private struct ViewRecord: Decodable {
  let id: String
  let title: String?
  let icon: String?
  let color: String?
  let kind: String?
  let templateID: String?

  enum CodingKeys: String, CodingKey {
    case id, title, icon, color, kind
    case templateID = "templateId"
    case templateIDUpper = "templateID"
  }

  init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    id = try container.decode(String.self, forKey: .id)
    title = try container.decodeIfPresent(String.self, forKey: .title)
    icon = try container.decodeIfPresent(String.self, forKey: .icon)
    color = try container.decodeIfPresent(String.self, forKey: .color)
    kind = try container.decodeIfPresent(String.self, forKey: .kind)
    templateID = try container.decodeIfPresent(String.self, forKey: .templateID)
      ?? container.decodeIfPresent(String.self, forKey: .templateIDUpper)
  }

  var view: BoardViewItem {
    BoardViewItem(
      id: id,
      title: title ?? id,
      icon: icon ?? "",
      color: color ?? "",
      kind: BoardViewItem.Kind(rawValue: kind ?? "") ?? .custom,
      templateID: templateID
    )
  }
}

private struct AlertRecord: Decodable {
  let id: String
  let title: String?
  let body: String?
  let author: String?
  @OptionalConvexFloat var seenAt: Double?

  private enum CodingKeys: String, CodingKey {
    case id, title, body, author
    case source
    case seenAt
  }

  init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    id = try container.decodeIfPresent(String.self, forKey: .id) ?? ""
    title = try container.decodeIfPresent(String.self, forKey: .title)
    body = try container.decodeIfPresent(String.self, forKey: .body)
    author = try container.decodeIfPresent(String.self, forKey: .author)
      ?? container.decodeIfPresent(String.self, forKey: .source)
    seenAt = try container.decode(OptionalConvexFloat<Double>.self, forKey: .seenAt).wrappedValue
  }

  var alert: BoardAlert {
    BoardAlert(
      id: id,
      title: title ?? "",
      body: body ?? "",
      author: author ?? "",
      seenAt: seenAt.map { DueDateMath.date(fromMilliseconds: $0) }
    )
  }
}

private struct QuestionRecord: Decodable {
  let id: String
  let prompt: String?
  let options: [OptionRecord]?
  @OptionalConvexFloat var answeredAt: Double?
  @OptionalConvexFloat var seenAt: Double?

  private enum CodingKeys: String, CodingKey {
    case id, prompt, options, answeredAt, seenAt
  }

  init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    id = try container.decodeIfPresent(String.self, forKey: .id) ?? ""
    prompt = try container.decodeIfPresent(String.self, forKey: .prompt)
    options = try container.decodeIfPresent([OptionRecord].self, forKey: .options)
    answeredAt = try container.decode(OptionalConvexFloat<Double>.self, forKey: .answeredAt).wrappedValue
    seenAt = try container.decode(OptionalConvexFloat<Double>.self, forKey: .seenAt).wrappedValue
  }

  var question: BoardQuestion {
    BoardQuestion(
      id: id,
      prompt: prompt ?? "",
      options: (options ?? []).map(\.option),
      answeredAt: answeredAt.map { DueDateMath.date(fromMilliseconds: $0) },
      seenAt: seenAt.map { DueDateMath.date(fromMilliseconds: $0) }
    )
  }
}

private struct OptionRecord: Decodable {
  let id: String
  let label: String?

  var option: QuestionOption {
    QuestionOption(id: id, label: label ?? id)
  }
}

private struct ProgressionRecord: Decodable {
  let id: String
  let title: String?
  @OptionalConvexFloat var current: Double?
  @OptionalConvexFloat var target: Double?

  var progression: BoardProgression {
    BoardProgression(
      id: id,
      title: title ?? "",
      current: Int(current ?? 0),
      target: Int(target ?? 1)
    )
  }
}

private struct QuestRecord: Decodable {
  let id: String
  let title: String?
  let steps: [StepRecord]?
  let isWaiting: Bool?

  private enum CodingKeys: String, CodingKey {
    case id
    case title
    case steps
    case isWaiting
    case waiting
  }

  init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    id = try container.decode(String.self, forKey: .id)
    title = try container.decodeIfPresent(String.self, forKey: .title)
    steps = try container.decodeIfPresent([StepRecord].self, forKey: .steps)
    isWaiting = try container.decodeIfPresent(Bool.self, forKey: .waiting)
      ?? container.decodeIfPresent(Bool.self, forKey: .isWaiting)
  }

  var quest: BoardQuest {
    BoardQuest(
      id: id,
      title: title ?? "",
      steps: (steps ?? []).map(\.step),
      isWaiting: isWaiting ?? false
    )
  }
}

private struct StepRecord: Decodable {
  let id: String
  let title: String?
  let done: Bool?

  var step: QuestStep {
    QuestStep(id: id, title: title ?? "", done: done ?? false)
  }
}

// MARK: - BoardSource on the Convex client

extension ConvexTaskBackend {
  /// One shot of `board:slice`. The function is a mutation: it ensures Home
  /// and mints recurrences, so it cannot be a live query.
  public func boardSliceUpdates() -> AsyncThrowingStream<BoardSnapshot, Error> {
    AsyncThrowingStream { continuation in
      let task = Task {
        do {
          let args: [String: ConvexEncodable?] = [
            "tab": "tasks",
            "timezone": TimeZone.current.identifier,
          ]
          let payload: BoardSlicePayload = try await self.perform {
            try await self.client.mutation(ConvexFunction.boardSlice, with: args)
          }
          let snapshot = payload.snapshot
          self.boardSnapshot = snapshot
          continuation.yield(snapshot)
          continuation.finish()
        } catch {
          continuation.finish(throwing: error)
        }
      }
      continuation.onTermination = { _ in task.cancel() }
    }
  }

  /// Installs a template onto the rail. The optimistic view append lives in the
  /// model; this is the wire call behind `views:installTemplate`.
  public func installTemplate(_ template: ViewTemplate) async throws {
    let args: [String: ConvexEncodable?] = [
      "slug": template.id,
    ]
    try await perform {
      try await self.client.mutation(ConvexFunction.viewsInstallTemplate, with: args)
    }
  }

  public func createCustomView(title: String, icon: String, color: String) async throws {
    let args: [String: ConvexEncodable?] = [
      "title": title,
      "icon": icon,
      "color": color,
    ]
    try await perform {
      try await self.client.mutation(ConvexFunction.viewsCreateCustom, with: args)
    }
  }

  /// Creates the first occurrence of a recurring series. `periodStart` is a
  /// civil-day start and is never copied into a deadline.
  public func createRecurrence(
    title: String,
    behavior: String,
    cadence: String = SeriesCadence.daily.rawValue,
    periodStart: Date
  ) async throws {
    let args: [String: ConvexEncodable?] = [
      "title": title,
      "behavior": behavior,
      "cadence": cadence,
      "timezone": TimeZone.current.identifier,
      "anchorOn": dayMilliseconds(periodStart),
    ]
    try await perform {
      try await self.client.mutation(ConvexFunction.recurrencesCreate, with: args)
    }
  }

  /// Alert and question transitions have no backend contract in this slice:
  /// they update the cached board payload the same way the in-memory source
  /// does, so the band and prompt clear immediately.
  public func dismissAlert(id: String) {
    if let index = boardSnapshot.alerts.firstIndex(where: { $0.id == id }) {
      boardSnapshot.alerts[index].seenAt = Date()
    }
  }

  public func answerQuestion(id: String, optionID: String) {
    if let index = boardSnapshot.questions.firstIndex(where: { $0.id == id }) {
      boardSnapshot.questions[index].answeredAt = Date()
    }
  }
}
