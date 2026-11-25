import Foundation

/// The in-memory half of the row-first shell contract. It records each call
/// and updates the cached snapshot, so the same tests can drive the Groups,
/// Routings, Categories, Resources and Settings screens without Convex.
@MainActor
extension InMemoryTaskBackend: ShellBackend {
  public func setActivityOnTasks(_ value: ActivityOnTasks) async throws {
    if failWrites { throw TaskBackendError("Could not save the setting") }
    activityOnTasksValues.append(value)
  }

  public func groupsList() async throws -> [BoardGroup] {
    boardSnapshot.groups
  }

  public func createGroup(name: String) async throws {
    if failWrites { throw TaskBackendError("Could not create the group") }
    let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmed.isEmpty else { return }
    createdGroupNames.append(trimmed)
    boardSnapshot.groups.append(
      BoardGroup(id: "group-\(boardSnapshot.groups.count + 1)", name: trimmed)
    )
  }

  public func createInvite(groupId: String, email: String) async throws {
    if failWrites { throw TaskBackendError("Could not send the invite") }
    guard !groupId.isEmpty, !email.isEmpty else { return }
    createdInvites.append((groupId: groupId, email: email))
    boardSnapshot.invites.append(
      BoardInvite(id: "invite-\(boardSnapshot.invites.count + 1)", groupId: groupId, email: email)
    )
  }

  public func acceptInvite(id: String) async throws {
    if failWrites { throw TaskBackendError("Could not accept the invite") }
    acceptedInviteIDs.append(id)
    if let index = boardSnapshot.invites.firstIndex(where: { $0.id == id }) {
      boardSnapshot.invites[index].status = "accepted"
      boardSnapshot.invites[index].seenAt = Date()
    }
  }

  public func declineInvite(id: String) async throws {
    if failWrites { throw TaskBackendError("Could not decline the invite") }
    declinedInviteIDs.append(id)
    if let index = boardSnapshot.invites.firstIndex(where: { $0.id == id }) {
      boardSnapshot.invites[index].status = "declined"
      boardSnapshot.invites[index].seenAt = Date()
    }
  }

  public func invitesList() async throws -> [BoardInvite] {
    boardSnapshot.invites
  }

  public func routingsList() async throws -> [BoardRouting] {
    boardSnapshot.routings
  }

  public func createRouting(name: String, cadence: String, title: String) async throws {
    if failWrites { throw TaskBackendError("Could not create the routing") }
    let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmed.isEmpty else { return }
    createdRoutings.append((name: trimmed, cadence: cadence, title: title))
    boardSnapshot.routings.append(
      BoardRouting(
        id: "routing-\(boardSnapshot.routings.count + 1)",
        name: trimmed,
        trigger: "cron",
        cadence: cadence,
        executionKind: "createTask",
        title: title
      )
    )
  }

  public func categoriesList() async throws -> [BoardCategory] {
    boardSnapshot.categories
  }

  public func resourcesList() async throws -> [BoardResource] {
    boardSnapshot.resources
  }

  public func createAlert(title: String, body: String) async throws {
    if failWrites { throw TaskBackendError("Could not send the message") }
    let trimmed = title.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmed.isEmpty else { return }
    createdAlerts.append((title: trimmed, body: body))
    boardSnapshot.alerts.append(
      BoardAlert(
        id: "alert-\(boardSnapshot.alerts.count + 1)",
        title: trimmed,
        body: body,
        author: "self",
        seenAt: Date()
      )
    )
    emitBoard()
  }

  public func markAlertSeen(id: String) async throws {
    if failWrites { throw TaskBackendError("Could not mark the message as read") }
    markedAlertIDs.append(id)
    if let index = boardSnapshot.alerts.firstIndex(where: { $0.id == id }) {
      boardSnapshot.alerts[index].seenAt = Date()
    }
  }
}
