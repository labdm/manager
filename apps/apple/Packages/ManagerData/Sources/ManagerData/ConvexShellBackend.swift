import Combine
import ConvexMobile
import Foundation
import ManagerCore

// MARK: - Tolerant wire records

/// Convex rows may use `_id` or an already-mapped `id`, and every newer
/// presentation field is optional. A missing field becomes an empty value so
/// an older deployment still draws the shell.
private struct GroupRecord: Decodable {
  let id: String
  let name: String?
  let icon: String?
  let color: String?
  let isDefault: Bool?

  private enum CodingKeys: String, CodingKey {
    case id
    case documentID = "_id"
    case name, icon, color
    case isDefault
  }

  init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    id = try container.decodeIfPresent(String.self, forKey: .id)
      ?? container.decodeIfPresent(String.self, forKey: .documentID)
      ?? ""
    name = try container.decodeIfPresent(String.self, forKey: .name)
    icon = try container.decodeIfPresent(String.self, forKey: .icon)
    color = try container.decodeIfPresent(String.self, forKey: .color)
    isDefault = try container.decodeIfPresent(Bool.self, forKey: .isDefault)
  }

  var group: BoardGroup {
    BoardGroup(
      id: id,
      name: name ?? "",
      icon: icon ?? "",
      color: color ?? "",
      isDefault: isDefault ?? false
    )
  }
}

private struct InviteRecord: Decodable {
  let id: String
  let groupId: String?
  let email: String?
  let status: String?
  @OptionalConvexFloat var seenAt: Double?

  private enum CodingKeys: String, CodingKey {
    case id
    case documentID = "_id"
    case groupId
    case email, status, seenAt
  }

  init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    id = try container.decodeIfPresent(String.self, forKey: .id)
      ?? container.decodeIfPresent(String.self, forKey: .documentID)
      ?? ""
    groupId = try container.decodeIfPresent(String.self, forKey: .groupId)
    email = try container.decodeIfPresent(String.self, forKey: .email)
    status = try container.decodeIfPresent(String.self, forKey: .status)
    seenAt = try container.decode(OptionalConvexFloat<Double>.self, forKey: .seenAt).wrappedValue
  }

  var invite: BoardInvite {
    BoardInvite(
      id: id,
      groupId: groupId ?? "",
      email: email ?? "",
      status: status ?? "pending",
      seenAt: seenAt.map { DueDateMath.date(fromMilliseconds: $0) }
    )
  }
}

private struct RoutingRecord: Decodable {
  let id: String
  let name: String?
  let trigger: String?
  let cadence: String?
  let executionKind: String?
  let title: String?

  private enum CodingKeys: String, CodingKey {
    case id
    case documentID = "_id"
    case name, trigger, cadence, title
    case executionKind
  }

  init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    id = try container.decodeIfPresent(String.self, forKey: .id)
      ?? container.decodeIfPresent(String.self, forKey: .documentID)
      ?? ""
    name = try container.decodeIfPresent(String.self, forKey: .name)
    trigger = try container.decodeIfPresent(String.self, forKey: .trigger)
    cadence = try container.decodeIfPresent(String.self, forKey: .cadence)
    executionKind = try container.decodeIfPresent(String.self, forKey: .executionKind)
    title = try container.decodeIfPresent(String.self, forKey: .title)
  }

  var routing: BoardRouting {
    BoardRouting(
      id: id,
      name: name ?? "",
      trigger: trigger ?? "",
      cadence: cadence ?? "",
      executionKind: executionKind ?? "",
      title: title ?? ""
    )
  }
}

private struct CategoryRecord: Decodable {
  let id: String
  let title: String?
  let name: String?
  let icon: String?
  let color: String?

  private enum CodingKeys: String, CodingKey {
    case id
    case documentID = "_id"
    case title, name, icon, color
  }

  init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    id = try container.decodeIfPresent(String.self, forKey: .id)
      ?? container.decodeIfPresent(String.self, forKey: .documentID)
      ?? ""
    title = try container.decodeIfPresent(String.self, forKey: .title)
    name = try container.decodeIfPresent(String.self, forKey: .name)
    icon = try container.decodeIfPresent(String.self, forKey: .icon)
    color = try container.decodeIfPresent(String.self, forKey: .color)
  }

  var category: BoardCategory {
    BoardCategory(id: id, title: title ?? name ?? "", icon: icon ?? "", color: color ?? "")
  }
}

private struct ResourceRecord: Decodable {
  let id: String
  let title: String?
  let name: String?
  @OptionalConvexFloat var quantity: Double?
  let unit: String?

  private enum CodingKeys: String, CodingKey {
    case id
    case documentID = "_id"
    case title, name, quantity, unit
  }

  init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    id = try container.decodeIfPresent(String.self, forKey: .id)
      ?? container.decodeIfPresent(String.self, forKey: .documentID)
      ?? ""
    title = try container.decodeIfPresent(String.self, forKey: .title)
    name = try container.decodeIfPresent(String.self, forKey: .name)
    quantity = try container.decode(OptionalConvexFloat<Double>.self, forKey: .quantity).wrappedValue
    unit = try container.decodeIfPresent(String.self, forKey: .unit)
  }

  var resource: BoardResource {
    BoardResource(
      id: id,
      title: title ?? name ?? "",
      quantity: Int(quantity ?? 0),
      unit: unit ?? ""
    )
  }
}

// MARK: - ShellBackend on the Convex client

extension ConvexTaskBackend {
  /// Convex Swift exposes queries as subscriptions. Taking the first value is
  /// the one-shot read the shell needs; leaving the loop cancels the query.
  private func fetch<T: Decodable>(_ name: String, yielding: T.Type) async throws -> T {
    do {
      let publisher = client.subscribe(to: name, yielding: T.self)
      for try await value in publisher.values {
        return value
      }
      throw TaskBackendError("No response from \(name)")
    } catch {
      throw Self.userFacing(error)
    }
  }

  public func setActivityOnTasks(_ value: ActivityOnTasks) async throws {
    let args: [String: ConvexEncodable?] = ["value": value.value]
    try await perform {
      try await self.client.mutation(ConvexFunction.setActivityOnTasks, with: args)
    }
  }

  public func groupsList() async throws -> [BoardGroup] {
    let records: [GroupRecord] = try await perform {
      try await self.fetch(ConvexFunction.groupsList, yielding: [GroupRecord].self)
    }
    return records.map(\.group)
  }

  public func createGroup(name: String) async throws {
    let args: [String: ConvexEncodable?] = ["name": name]
    try await perform {
      try await self.client.mutation(ConvexFunction.groupsCreate, with: args)
    }
  }

  public func createInvite(groupId: String, email: String) async throws {
    let args: [String: ConvexEncodable?] = ["groupId": groupId, "email": email]
    try await perform {
      try await self.client.mutation(ConvexFunction.invitesCreate, with: args)
    }
  }

  public func acceptInvite(id: String) async throws {
    let args: [String: ConvexEncodable?] = ["inviteId": id]
    try await perform {
      try await self.client.mutation(ConvexFunction.invitesAccept, with: args)
    }
  }

  public func declineInvite(id: String) async throws {
    let args: [String: ConvexEncodable?] = ["inviteId": id]
    try await perform {
      try await self.client.mutation(ConvexFunction.invitesDecline, with: args)
    }
  }

  public func routingsList() async throws -> [BoardRouting] {
    let records: [RoutingRecord] = try await perform {
      try await self.fetch(ConvexFunction.routingsList, yielding: [RoutingRecord].self)
    }
    return records.map(\.routing)
  }

  public func createRouting(name: String, cadence: String, title: String) async throws {
    let args: [String: ConvexEncodable?] = [
      "name": name,
      "trigger": "cron",
      "cadence": cadence,
      "executionKind": "createTask",
      "title": title,
    ]
    try await perform {
      try await self.client.mutation(ConvexFunction.routingsCreate, with: args)
    }
  }

  public func categoriesList() async throws -> [BoardCategory] {
    let records: [CategoryRecord] = try await perform {
      try await self.fetch(ConvexFunction.categoriesList, yielding: [CategoryRecord].self)
    }
    return records.map(\.category)
  }

  public func resourcesList() async throws -> [BoardResource] {
    let records: [ResourceRecord] = try await perform {
      try await self.fetch(ConvexFunction.resourcesList, yielding: [ResourceRecord].self)
    }
    return records.map(\.resource)
  }

  public func createAlert(title: String, body: String) async throws {
    let args: [String: ConvexEncodable?] = [
      "title": title,
      "body": body,
      "source": "apple",
    ]
    try await perform {
      try await self.client.mutation(ConvexFunction.alertsCreate, with: args)
    }
  }

  public func markAlertSeen(id: String) async throws {
    let args: [String: ConvexEncodable?] = ["id": id]
    try await perform {
      try await self.client.mutation(ConvexFunction.alertsRead, with: args)
    }
  }
}
