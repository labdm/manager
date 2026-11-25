import ManagerCore
import SwiftUI

/// The row list used by every primary destination. Chips only appear on
/// Tasks; the other destinations draw their existing records in the same row.
public struct DestinationView: View {
  public let destination: ShellDestination
  @Bindable public var model: TaskBoardModel
  public let onSelect: (BoardRow) -> Void

  public init(
    destination: ShellDestination,
    model: TaskBoardModel,
    onSelect: @escaping (BoardRow) -> Void
  ) {
    self.destination = destination
    self.model = model
    self.onSelect = onSelect
  }

  public var body: some View {
    Group {
      switch destination {
      case .tasks:
        BoardListView(model: model, onSelect: onSelect)
      case .messages:
        MessagesView(model: model, onSelect: onSelect)
      case .groups:
        GroupsView(model: model, onSelect: onSelect)
      case .categories, .resources:
        BoardListView(model: model, onSelect: onSelect)
      }
    }
  }
}

private struct MessagesView: View {
  @Bindable var model: TaskBoardModel
  let onSelect: (BoardRow) -> Void
  @State private var title = ""
  @State private var bodyText = ""

  var body: some View {
    VStack(spacing: 0) {
      DisclosureGroup("Compose message") {
        TextField("Title", text: $title)
        TextField("Body", text: $bodyText, axis: .vertical)
          .lineLimit(2...4)
        Button("Send") {
          let draftTitle = title
          let draftBody = bodyText
          title = ""
          bodyText = ""
          Task { await model.createMessage(title: draftTitle, body: draftBody) }
        }
        .managerButton()
        .disabled(title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
      }
      .padding(.horizontal, 16)
      .padding(.top, 8)

      HStack {
        Text("History shows every message, including your own.")
          .font(ManagerFont.meta)
          .foregroundStyle(.secondary)
        Spacer(minLength: 0)
      }
      .padding(.horizontal, 16)
      .padding(.top, 8)

      BoardListView(model: model, onSelect: onSelect)
    }
  }
}

private struct GroupsView: View {
  @Bindable var model: TaskBoardModel
  let onSelect: (BoardRow) -> Void
  @State private var groupName = ""
  @State private var inviteEmail = ""

  var body: some View {
    VStack(spacing: 0) {
      DisclosureGroup("Group tools") {
        HStack {
          TextField("New group name", text: $groupName)
          Button("Add") {
            let name = groupName
            groupName = ""
            Task { await model.createGroup(name: name) }
          }
          .managerButton()
          .disabled(groupName.isEmpty)
        }
        HStack {
          TextField("Invite email", text: $inviteEmail)
          Button("Invite") {
            let email = inviteEmail
            let groupID = model.selectedGroupID ?? model.boardSnapshot.groups.first?.id ?? "default"
            inviteEmail = ""
            Task { await model.createInvite(groupId: groupID, email: email) }
          }
          .managerButton()
          .disabled(inviteEmail.isEmpty)
        }
      }
      .padding(.horizontal, 16)
      .padding(.top, 8)

      BoardListView(model: model, onSelect: onSelect)
    }
  }
}

/// The header switcher selects one group or All. All reads across the groups
/// the person belongs to and never attaches an item to two groups.
public struct GroupSwitcher: View {
  @Bindable public var model: TaskBoardModel

  public init(model: TaskBoardModel) {
    self.model = model
  }

  public var body: some View {
    Menu {
      Button {
        model.selectGroup(nil)
      } label: {
        Label("All groups", systemImage: model.selectedGroupID == nil ? "checkmark" : "square.dashed")
      }
      ForEach(model.boardSnapshot.groups) { group in
        Button {
          model.selectGroup(group.id)
        } label: {
          Label(group.title, systemImage: model.selectedGroupID == group.id ? "checkmark" : "person.3")
        }
      }
    } label: {
      Label(groupTitle, systemImage: "person.3")
    }
    .managerButton()
    .accessibilityLabel("Group switcher")
  }

  private var groupTitle: String {
    guard let id = model.selectedGroupID else { return "All groups" }
    return model.boardSnapshot.groups.first { $0.id == id }?.title ?? id
  }
}
