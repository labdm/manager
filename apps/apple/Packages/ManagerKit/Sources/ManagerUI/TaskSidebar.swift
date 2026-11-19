import ManagerCore
import SwiftUI

/// Smart-list sidebar for regular width: iPad, Mac, unfolded iPhone Duo.
public struct TaskSidebar: View {
  @Bindable var model: TaskBoardModel

  public init(model: TaskBoardModel) {
    self.model = model
  }

  private var selection: Binding<TaskList?> {
    Binding(
      get: { model.selectedList },
      set: { candidate in
        if let candidate { model.selectedList = candidate }
      }
    )
  }

  public var body: some View {
    List(selection: selection) {
      Section {
        ForEach(TaskList.allCases) { list in
          row(for: list)
            .tag(list)
        }
      } header: {
        Text("Lists")
          .font(.system(.caption2).weight(.semibold))
          .tracking(1.4)
          .textCase(.uppercase)
          .foregroundStyle(Color.managerMuted)
      }

      Section {
        connectionFooter
      }
    }
    .listStyle(.sidebar)
    .scrollContentBackground(.hidden)
    .navigationTitle("Manager")
    .managerBackground()
  }

  private func row(for list: TaskList) -> some View {
    let count = model.count(for: list)
    return Label {
      HStack(spacing: 8) {
        Text(list.title)
          .font(ManagerFont.rowTitle)
          .foregroundStyle(Color.managerInk)
        Spacer(minLength: 8)
        if count > 0 {
          CountBadge(count: count, emphasized: list == .today && model.openTodayCount() > 0)
        }
      }
    } icon: {
      Image(systemName: list.systemImage)
        .foregroundStyle(list == .today ? Color.managerAccent : Color.managerMuted)
    }
    .padding(.vertical, 3)
    .accessibilityLabel("\(list.title), \(count) tasks")
  }

  private var connectionFooter: some View {
    HStack(spacing: 6) {
      Circle()
        .fill(statusColor)
        .frame(width: 7, height: 7)
      Text(statusText)
        .font(.system(.caption2))
        .foregroundStyle(Color.managerMuted)
      Spacer(minLength: 0)
    }
    .padding(.vertical, 2)
    .accessibilityElement(children: .combine)
  }

  private var statusColor: Color {
    switch model.connection {
    case .connected: Color.managerAccent
    case .connecting: Color.managerMuted
    case .offline: Color.managerDanger
    }
  }

  private var statusText: String {
    switch model.connection {
    case .connected: "Live"
    case .connecting: "Connecting…"
    case .offline: "Offline"
    }
  }
}
