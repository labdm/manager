import Foundation

// MARK: - Destination records

/// A group is an organization. The schema calls it a space; the screen says
/// Group. Missing fields become empty values instead of dropping the row.
public struct BoardGroup: Identifiable, Hashable, Codable, Sendable {
  public var id: String
  public var name: String
  public var icon: String
  public var color: String
  public var isDefault: Bool

  public init(
    id: String,
    name: String = "",
    icon: String = "",
    color: String = "",
    isDefault: Bool = false
  ) {
    self.id = id
    self.name = name
    self.icon = icon
    self.color = color
    self.isDefault = isDefault
  }

  public var title: String { name.isEmpty ? id : name }

  private enum CodingKeys: String, CodingKey {
    case id, name, icon, color
    case isDefault
  }

  public init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    id = try container.decodeIfPresent(String.self, forKey: .id) ?? ""
    name = try container.decodeIfPresent(String.self, forKey: .name) ?? ""
    icon = try container.decodeIfPresent(String.self, forKey: .icon) ?? ""
    color = try container.decodeIfPresent(String.self, forKey: .color) ?? ""
    isDefault = try container.decodeIfPresent(Bool.self, forKey: .isDefault) ?? false
  }
}

/// A pending or resolved group invitation. It has no due date, progression,
/// quest or resource fields.
public struct BoardInvite: Identifiable, Hashable, Codable, Sendable {
  public var id: String
  public var groupId: String
  public var email: String
  public var status: String
  public var seenAt: Date?

  public init(
    id: String,
    groupId: String = "",
    email: String = "",
    status: String = "pending",
    seenAt: Date? = nil
  ) {
    self.id = id
    self.groupId = groupId
    self.email = email
    self.status = status
    self.seenAt = seenAt
  }

  public var title: String { email.isEmpty ? "Invite to \(groupId)" : email }
  public var isPending: Bool { status.isEmpty || status == "pending" }
  public var isNew: Bool { seenAt == nil }

  private enum CodingKeys: String, CodingKey {
    case id, groupId, email, status, seenAt
  }

  public init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    id = try container.decodeIfPresent(String.self, forKey: .id) ?? ""
    groupId = try container.decodeIfPresent(String.self, forKey: .groupId) ?? ""
    email = try container.decodeIfPresent(String.self, forKey: .email) ?? ""
    status = try container.decodeIfPresent(String.self, forKey: .status) ?? "pending"
    seenAt = try container.decodeIfPresent(Date.self, forKey: .seenAt)
  }
}

/// A small automation. The engine is planned; the menu page lists the records
/// and can add a cron routing.
public struct BoardRouting: Identifiable, Hashable, Codable, Sendable {
  public var id: String
  public var name: String
  public var trigger: String
  public var cadence: String
  public var executionKind: String
  public var title: String

  public init(
    id: String,
    name: String = "",
    trigger: String = "",
    cadence: String = "",
    executionKind: String = "",
    title: String = ""
  ) {
    self.id = id
    self.name = name
    self.trigger = trigger
    self.cadence = cadence
    self.executionKind = executionKind
    self.title = title
  }

  public var displayTitle: String { name.isEmpty ? (title.isEmpty ? id : title) : name }

  private enum CodingKeys: String, CodingKey {
    case id, name, trigger, cadence, executionKind, title
  }

  public init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    id = try container.decodeIfPresent(String.self, forKey: .id) ?? ""
    name = try container.decodeIfPresent(String.self, forKey: .name) ?? ""
    trigger = try container.decodeIfPresent(String.self, forKey: .trigger) ?? ""
    cadence = try container.decodeIfPresent(String.self, forKey: .cadence) ?? ""
    executionKind = try container.decodeIfPresent(String.self, forKey: .executionKind) ?? ""
    title = try container.decodeIfPresent(String.self, forKey: .title) ?? ""
  }
}

public struct BoardCategory: Identifiable, Hashable, Codable, Sendable {
  public var id: String
  public var title: String
  public var icon: String
  public var color: String

  public init(id: String, title: String = "", icon: String = "", color: String = "") {
    self.id = id
    self.title = title
    self.icon = icon
    self.color = color
  }

  public var displayTitle: String { title.isEmpty ? id : title }

  private enum CodingKeys: String, CodingKey {
    case id, title, icon, color
  }

  public init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    id = try container.decodeIfPresent(String.self, forKey: .id) ?? ""
    title = try container.decodeIfPresent(String.self, forKey: .title) ?? ""
    icon = try container.decodeIfPresent(String.self, forKey: .icon) ?? ""
    color = try container.decodeIfPresent(String.self, forKey: .color) ?? ""
  }
}

public struct BoardResource: Identifiable, Hashable, Codable, Sendable {
  public var id: String
  public var title: String
  public var quantity: Int
  public var unit: String

  public init(id: String, title: String = "", quantity: Int = 0, unit: String = "") {
    self.id = id
    self.title = title
    self.quantity = quantity
    self.unit = unit
  }

  public var displayTitle: String { title.isEmpty ? id : title }

  private enum CodingKeys: String, CodingKey {
    case id, title, quantity, unit
  }

  public init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    id = try container.decodeIfPresent(String.self, forKey: .id) ?? ""
    title = try container.decodeIfPresent(String.self, forKey: .title) ?? ""
    quantity = try container.decodeIfPresent(Int.self, forKey: .quantity) ?? 0
    unit = try container.decodeIfPresent(String.self, forKey: .unit) ?? ""
  }
}

// MARK: - Alert origin

public extension BoardAlert {
  /// Who wrote the message. A missing value reads as someone else so an older
  /// payload still appears with the default Tasks-page setting.
  var authorKind: String { author.isEmpty ? "agent" : author }

  var isUnseen: Bool { seenAt == nil }
}
