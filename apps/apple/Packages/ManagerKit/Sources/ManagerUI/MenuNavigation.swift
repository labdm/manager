import ManagerCore
import SwiftUI

/// Routes pushed from the toolbar menu button. The menu is never a tab and no
/// page here is duplicated in the primary destinations.
public enum ShellMenuRoute: Hashable, Sendable {
  case list
  case page(ShellMenuDestination)
}

/// The always-available menu button. Glass stays on this control through the
/// existing `ManagerGlass` helpers.
public struct MenuButton: View {
  public let action: () -> Void

  public init(action: @escaping () -> Void) {
    self.action = action
  }

  public var body: some View {
    Button(action: action) {
      Label("Menu", systemImage: "line.3.horizontal")
    }
    .managerButton()
    .accessibilityLabel("Menu")
  }
}

/// The pushed menu list. Settings is one of its rows; none of these rows is a
/// tab or pinned rail item.
public struct MenuListView: View {
  @Bindable public var model: TaskBoardModel

  public init(model: TaskBoardModel) {
    self.model = model
  }

  public var body: some View {
    List {
      Section {
        ForEach(ShellMenuDestination.allCases) { destination in
          NavigationLink(value: ShellMenuRoute.page(destination)) {
            Label(destination.title, systemImage: destination.systemImage)
          }
          .accessibilityLabel(destination.title)
        }
      }
    }
    .listStyle(.automatic)
    .navigationTitle("Menu")
  }
}

/// A pushed menu page. Settings, Contacts and Routings are real screens; the
/// other pages are readable placeholders until their records ship.
public struct MenuPageView: View {
  public let destination: ShellMenuDestination
  @Bindable public var model: TaskBoardModel

  public init(destination: ShellMenuDestination, model: TaskBoardModel) {
    self.destination = destination
    self.model = model
  }

  public var body: some View {
    Group {
      switch destination {
      case .settings:
        SettingsPage(model: model)
      case .contacts:
        ContactsPage(model: model)
      case .routings:
        RoutingsPage(model: model)
      case .achievements:
        AchievementsPage()
      case .events:
        EventsPage()
      case .profile:
        ProfilePage()
      case .docs, .contactUs, .desktopApp, .changelog:
        PlaceholderPage(destination: destination)
      }
    }
    .navigationTitle(destination.title)
  }
}

private struct SettingsPage: View {
  @Bindable var model: TaskBoardModel

  var body: some View {
    Form {
      Section("Tasks") {
        Picker("Activity on Tasks", selection: Binding(
          get: { model.activityOnTasks },
          set: { value in Task { await model.setActivityOnTasks(value) } }
        )) {
          ForEach(ActivityOnTasks.allCases) { value in
            Text(value.title).tag(value)
          }
        }
        Text("Your own tasks always show. History shows every message.")
          .font(ManagerFont.meta)
          .foregroundStyle(.secondary)
      }
    }
    .formStyle(.grouped)
  }
}

private struct ContactsPage: View {
  @Bindable var model: TaskBoardModel
  @State private var email = ""

  private var groupID: String {
    model.selectedGroupID ?? model.boardSnapshot.groups.first?.id ?? "default"
  }

  var body: some View {
    Form {
      Section("Invite") {
        TextField("Email", text: $email)
        #if os(iOS)
          .textInputAutocapitalization(.never)
          .keyboardType(.emailAddress)
        #endif
        Button("Send invite") {
          let address = email
          email = ""
          Task { await model.createInvite(groupId: groupID, email: address) }
        }
        .managerButton()
        .disabled(email.isEmpty)
      }
      Section("People") {
        ForEach(model.boardSnapshot.invites) { invite in
          Label(invite.title, systemImage: "envelope")
        }
      }
    }
    .formStyle(.grouped)
  }
}

private struct RoutingsPage: View {
  @Bindable var model: TaskBoardModel
  @State private var name = ""
  @State private var cadence = "daily"
  @State private var title = ""

  var body: some View {
    Form {
      Section("Automations") {
        if model.boardSnapshot.routings.isEmpty {
          Text("No routings yet.").foregroundStyle(.secondary)
        } else {
          ForEach(model.boardSnapshot.routings) { routing in
            VStack(alignment: .leading, spacing: 2) {
              Text(routing.displayTitle).font(ManagerFont.rowTitle)
              Text("cron · \(routing.cadence) · \(routing.executionKind)")
                .font(ManagerFont.meta)
                .foregroundStyle(.secondary)
            }
          }
        }
      }
      Section("New cron routing") {
        TextField("Name", text: $name)
        Picker("Cadence", selection: $cadence) {
          ForEach(["daily", "weekly", "monthly"], id: \.self) { Text($0).tag($0) }
        }
        TextField("Task title", text: $title)
        Button("Add routing") {
          let draftName = name
          let draftCadence = cadence
          let draftTitle = title
          name = ""
          title = ""
          Task { await model.createRouting(name: draftName, cadence: draftCadence, title: draftTitle) }
        }
        .managerButton()
        .disabled(name.isEmpty || title.isEmpty)
      }
    }
    .formStyle(.grouped)
  }
}

private struct AchievementsPage: View {
  var body: some View {
    List {
      LabeledContent("Completed tasks", value: "0")
      LabeledContent("Missed tasks", value: "0")
      LabeledContent("Superseded tasks", value: "0")
      LabeledContent("Progressions", value: "0 of 0")
      LabeledContent("Quests", value: "0 of 0")
    }
  }
}

private struct EventsPage: View {
  var body: some View {
    List {
      Text("Day, week, month and named events live here.").foregroundStyle(.secondary)
    }
  }
}

private struct ProfilePage: View {
  var body: some View {
    List {
      Text("Account fields appear when Clerk is connected.").foregroundStyle(.secondary)
    }
  }
}

private struct PlaceholderPage: View {
  let destination: ShellMenuDestination

  var body: some View {
    List {
      Text("\(destination.title) is part of the row-first menu.")
        .foregroundStyle(.secondary)
    }
  }
}
