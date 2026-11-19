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
  static let setDone = "tasks:setDone"
  static let remove = "tasks:remove"
}

/// Wire shape of `TaskView` from `packages/backend/convex/lib/taskService.ts`.
///
/// Convex encodes JavaScript numbers as a tagged `$float` object, so `dueAt`
/// must go through `@OptionalConvexFloat`; decoding it as a plain `Double`
/// silently fails.
struct TaskRecord: Decodable {
  let id: String
  let title: String
  let done: Bool
  let ownerId: String
  @OptionalConvexFloat var dueAt: Double?

  var item: TaskItem {
    TaskItem(
      id: id,
      title: title,
      done: done,
      dueAt: dueAt.map { DueDateMath.day(fromMilliseconds: $0) }
    )
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
public final class ConvexTaskBackend: TaskBackend {
  private let client: ConvexClientWithAuth<String>

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
          continuation.yield(records.map(\.item))
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

  public func createTask(title: String, dueAt: Date?) async throws {
    var args: [String: ConvexEncodable?] = ["title": title]
    if let dueAt {
      // A JS number, not a BigInt: `v.number()` rejects Convex's integer encoding.
      args["dueAt"] = Double(DueDateMath.millisecondsForDay(dueAt))
    }

    try await perform {
      let _: TaskRecord = try await self.client.mutation(ConvexFunction.create, with: args)
    }
  }

  public func setTask(id: String, done: Bool) async throws {
    let args: [String: ConvexEncodable?] = ["id": id, "done": done]
    try await perform {
      let _: TaskRecord = try await self.client.mutation(ConvexFunction.setDone, with: args)
    }
  }

  public func deleteTask(id: String) async throws {
    let args: [String: ConvexEncodable?] = ["id": id]
    try await perform {
      let _: RemovalRecord = try await self.client.mutation(ConvexFunction.remove, with: args)
    }
  }

  // MARK: - Error translation

  private func perform<T>(_ operation: () async throws -> T) async throws -> T {
    do {
      return try await operation()
    } catch {
      throw Self.userFacing(error)
    }
  }

  private static func userFacing(_ error: Error) -> Error {
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
private final class CancellableBox: @unchecked Sendable {
  var cancellable: AnyCancellable?
}
