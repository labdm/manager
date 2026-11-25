import Combine
import ConvexMobile
import Foundation
import ManagerCore

/// Convex function names, kept in one place so a rename is a compile error away
/// from the backend rather than a silent runtime failure.
enum ConvexFunction {
  static let ensureUser = "users:ensure"
  static let list = "tasks:list"
  static let create = "tasks:create"
  static let update = "tasks:update"
  static let setDone = "tasks:setDone"
  static let remove = "tasks:remove"
  static let markSeen = "tasks:markSeen"
  static let recurrencesCreate = "recurrences:create"
  static let viewsInstallTemplate = "views:installTemplate"
  static let viewsCreateCustom = "views:createCustom"
  static let boardSlice = "board:slice"

  // Row-first shell. Every call uses a string name, the same style as the
  // task calls above. A deployment that predates one of them fails only that
  // read or write; the shell keeps drawing with an empty array.
  static let categoriesList = "categories:list"
  static let resourcesList = "resources:list"
  static let alertsCreate = "alerts:create"
  static let alertsRead = "alerts:read"
  static let groupsList = "groups:list"
  static let groupsCreate = "groups:create"
  static let invitesList = "invites:list"
  static let invitesCreate = "invites:create"
  static let invitesAccept = "invites:accept"
  static let invitesDecline = "invites:decline"
  static let routingsList = "routings:list"
  static let routingsCreate = "routings:create"
  static let setActivityOnTasks = "users:setActivityOnTasks"
}

/// Wire shape of `TaskView` from `packages/backend/convex/lib/taskService.ts`.
///
/// Convex encodes JavaScript numbers as a tagged `$float` object, so every
/// optional numeric field goes through `@OptionalConvexFloat`; decoding one as
/// a plain `Double` silently fails. Missing fields decode to nil.
struct TaskRecord: Decodable {
  let id: String
  let title: String
  let done: Bool
  let ownerId: String
  @OptionalConvexFloat var dueAt: Double?
  let notes: String?
  @OptionalConvexFloat var plannedOn: Double?
  @OptionalConvexFloat var plannedTime: Double?
  let location: String?
  @OptionalConvexFloat var deadlineAt: Double?
  @OptionalConvexFloat var remindAt: Double?
  let priority: String?
  @OptionalConvexFloat var priorityRank: Double?
  @OptionalConvexFloat var effectiveRank: Double?
  let overdue: Bool?
  let overduePolicy: String?
  let outcome: String?
  let origin: String?
  @OptionalConvexFloat var seenAt: Double?
  @OptionalConvexFloat var completedAt: Double?
  @OptionalConvexFloat var deletedAt: Double?
  // Target vocabulary: not written by the M1 mutation, but decoded when a
  // newer deployment starts sending it. Missing fields stay empty.
  let look: String?
  let series: String?
  let cadence: String?
  let eventID: String?
  let groupID: String?

  var item: TaskItem {
    let priority = TaskPriority(decoded: self.priority)
    let rank = priorityRank.map(Int.init) ?? priority.seedRank
    let policy = OverduePolicy(decoded: overduePolicy)
    let trashedAt = deletedAt.map { DueDateMath.date(fromMilliseconds: $0) }
    let deadline = deadlineAt.map { DueDateMath.date(fromMilliseconds: $0) }
    let isOverdue = overdue ?? TaskFacts.isOverdue(
      deadlineAt: deadline,
      done: done,
      deletedAt: trashedAt,
      now: Date()
    )
    let rankWithOverdue = effectiveRank.map(Int.init) ?? TaskFacts.effectiveRank(
      priorityRank: rank,
      priority: priority,
      policy: policy,
      overdue: isOverdue
    )

    return TaskItem(
      id: id,
      title: title,
      done: done,
      // `dueAt` and `plannedOn` are two names for the planned day. An old row
      // may only have the legacy field; prefer `plannedOn` when both exist.
      dueAt: (plannedOn ?? dueAt).map { DueDateMath.day(fromMilliseconds: $0) },
      notes: notes,
      plannedTime: plannedTime.flatMap { TaskFacts.normalizedPlannedTime(Int($0)) },
      location: location,
      deadlineAt: deadline,
      remindAt: remindAt.map { DueDateMath.date(fromMilliseconds: $0) },
      priority: priority,
      priorityRank: rank,
      effectiveRank: rankWithOverdue,
      overdue: isOverdue,
      overduePolicy: policy,
      outcome: outcome,
      origin: TaskOrigin(decoded: self.origin),
      seenAt: seenAt.map { DueDateMath.date(fromMilliseconds: $0) },
      completedAt: completedAt.map { DueDateMath.date(fromMilliseconds: $0) },
      deletedAt: trashedAt,
      eventID: eventID,
      groupID: groupID,
      look: TaskLook(decoded: look),
      series: SeriesBehavior(decoded: series),
      cadence: SeriesCadence(decoded: cadence)
    )
  }
}

/// A mutation may return a full task view or just an acknowledgement. Neither
/// matters to the board: the live query is authoritative.
struct TaskMutationResult: Decodable {
  let task: TaskRecord?

  init(from decoder: Decoder) throws {
    task = try? TaskRecord(from: decoder)
  }
}

/// Result of the `tasks:remove` mutation.
struct RemovalRecord: Decodable {
  let success: Bool
  let id: String
}

/// `TaskBackend` implemented over the Convex Swift client with Clerk auth.
///
/// Live queries arrive through `ConvexClient.subscribe`, which keeps a single
/// websocket for the process and resubscribes after a drop. A task completed by
/// the web app or an MCP bot therefore lands here without polling.
@MainActor
public final class ConvexTaskBackend: TaskBackend, ShellBackend {
  // Internal so the BoardSource extension in ConvexBoardSource.swift can call
  // the same client helpers as the task calls.
  let client: ConvexClientWithAuth<String>

  /// Last `board:slice` payload, or the starter shell before it answers. The
  /// task list from `tasks:list` remains authoritative for task rows.
  // Internal setter so the BoardSource extension in ConvexBoardSource.swift can
  // cache incoming payloads and local alert/question transitions.
  public var boardSnapshot: BoardSnapshot = .starter

  public init(client: ConvexClientWithAuth<String>) {
    self.client = client
  }

  // MARK: - TaskBackend

  public func ensureUser() async throws {
    try await perform {
      try await self.client.mutation(ConvexFunction.ensureUser)
    }
  }

  public func taskUpdates() -> AsyncThrowingStream<[TaskItem], Error> {
    let publisher = client.subscribe(to: ConvexFunction.list, yielding: [TaskRecord].self)

    return AsyncThrowingStream { continuation in
      let box = CancellableBox()
      box.cancellable = publisher.sink(
        receiveCompletion: { completion in
          switch completion {
          case .finished:
            continuation.finish()
          case let .failure(error):
            continuation.finish(throwing: Self.userFacing(error))
          }
        },
        receiveValue: { records in
          // The server already hides tombstones. This filter keeps an old or
          // lagging payload from resurrecting one on screen.
          continuation.yield(records.filter { $0.deletedAt == nil }.map(\.item))
        }
      )
      continuation.onTermination = { _ in
        box.cancellable?.cancel()
      }
    }
  }

  public func connectionUpdates() -> AsyncStream<ConnectionStatus> {
    let publisher = client.watchWebSocketState()

    return AsyncStream { continuation in
      let box = CancellableBox()
      box.cancellable = publisher.sink { state in
        switch state {
        case .connected:
          continuation.yield(.connected)
        case .connecting:
          continuation.yield(.connecting)
        }
      }
      continuation.onTermination = { _ in
        box.cancellable?.cancel()
      }
    }
  }

  public func createTask(_ draft: TaskDraft) async throws {
    var args = self.args(for: draft)
    // A row the signed-in user typed is never NEW, even before the live query
    // catches up with the mutation's result.
    args["origin"] = TaskOrigin.selfCreated.rawValue
    args["seenAt"] = exactMilliseconds(Date())

    try await perform {
      let _: TaskMutationResult = try await self.client.mutation(ConvexFunction.create, with: args)
    }
  }

  public func updateTask(id: String, draft: TaskDraft) async throws {
    var args = self.args(for: draft)
    args["id"] = id
    try await perform {
      let _: TaskMutationResult = try await self.client.mutation(ConvexFunction.update, with: args)
    }
  }

  public func setTask(id: String, done: Bool) async throws {
    let args: [String: ConvexEncodable?] = ["id": id, "done": done]
    try await perform {
      let _: TaskMutationResult = try await self.client.mutation(ConvexFunction.setDone, with: args)
    }
  }

  public func deleteTask(id: String) async throws {
    let args: [String: ConvexEncodable?] = ["id": id]
    try await perform {
      let _: RemovalRecord = try await self.client.mutation(ConvexFunction.remove, with: args)
    }
  }

  public func markSeen(id: String) async throws {
    let args: [String: ConvexEncodable?] = ["id": id]
    try await perform {
      let _: TaskMutationResult = try await self.client.mutation(ConvexFunction.markSeen, with: args)
    }
  }

  // MARK: - Wire encoding

  /// The planned day is written to both names for one release. `deadlineAt`
  /// and `remindAt` are exact instants and never touch `dueAt`/`plannedOn`.
  private func args(for draft: TaskDraft) -> [String: ConvexEncodable?] {
    let args: [String: ConvexEncodable?] = [
      "title": draft.title,
      "notes": draft.notes,
      "plannedOn": dayMilliseconds(draft.plannedOn),
      "dueAt": dayMilliseconds(draft.plannedOn),
      "plannedTime": draft.plannedTime.map { Double($0) },
      "location": draft.location,
      "deadlineAt": exactMilliseconds(draft.deadlineAt),
      "remindAt": exactMilliseconds(draft.remindAt),
      "priority": draft.priority.rawValue,
      "priorityRank": Double(draft.priorityRank),
      "overduePolicy": draft.overduePolicy.rawValue,
    ]
    return args
  }

  func dayMilliseconds(_ date: Date?) -> Double? {
    guard let date else { return nil }
    return Double(DueDateMath.millisecondsForDay(date))
  }

  private func exactMilliseconds(_ date: Date) -> Double? {
    Double(DueDateMath.milliseconds(sinceEpoch: date))
  }

  private func exactMilliseconds(_ date: Date?) -> Double? {
    date.map { Double(DueDateMath.milliseconds(sinceEpoch: $0)) }
  }

  // MARK: - Error translation

  func perform<T>(_ operation: () async throws -> T) async throws -> T {
    do {
      return try await operation()
    } catch {
      throw Self.userFacing(error)
    }
  }

  static func userFacing(_ error: Error) -> Error {
    guard let clientError = error as? ClientError else {
      return TaskBackendError(error.localizedDescription)
    }

    switch clientError {
    case let .ConvexError(data):
      return TaskBackendError(convexErrorText(from: data) ?? data)
    case let .ServerError(message):
      return TaskBackendError(message)
    case let .InternalError(message):
      return TaskBackendError(message)
    }
  }

  /// Convex sends `throw new Error("…")` payloads as a JSON string.
  private static func convexErrorText(from payload: String) -> String? {
    let data = Data(payload.utf8)
    if let text = try? JSONDecoder().decode(String.self, from: data) {
      return text
    }
    struct Envelope: Decodable { let message: String }
    return (try? JSONDecoder().decode(Envelope.self, from: data))?.message
  }
}

/// Holds a Combine subscription for a stream's lifetime.
///
/// `AsyncStream`'s termination handler is `@Sendable`, so the cancellable needs
/// to cross that boundary; Combine's `AnyCancellable` is thread-safe.
final class CancellableBox: @unchecked Sendable {
  var cancellable: AnyCancellable?
}
