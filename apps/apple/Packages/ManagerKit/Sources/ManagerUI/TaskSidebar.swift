import ManagerCore
import SwiftUI

/// Left rail for regular width: iPad, Mac, unfolded iPhone Duo.
///
/// Home is always present and Find more is always reachable. Installed and
/// custom views sit between them. Icons and colors are strings on the record;
/// unknown values fall back to a neutral tile and muted ink.
public struct TaskSidebar: View {
  @Bindable var model: TaskBoardModel
  @State private var showFindMore = false

  public init(model: TaskBoardModel) {
    self.model = model
  }

  private var selection: Binding<String> {
    Binding(
      get: { model.selectedViewID },
      set: { model.selectedViewID = $0 }
    )
  }

  private var installedViews: [BoardViewItem] {
    model.boardSnapshot.views.filter { $0.kind != .home }
  }

  public var body: some View {
    List(selection: selection) {
      Section {
        row(for: .home)
          .tag(BoardViewItem.home.id)
      } header: {
        railHeader("Home")
      }

      if !installedViews.isEmpty {
        Section {
          ForEach(installedViews) { view in
            row(for: view)
              .tag(view.id)
          }
        } header: {
          railHeader("Views")
        }
      }

      Section {
        Button {
          showFindMore = true
        } label: {
          Label("Find more", systemImage: "plus.magnifyingglass")
            .font(ManagerFont.rowTitle)
            .foregroundStyle(Color.managerAccent)
            .padding(.vertical, 3)
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Find more views")

        connectionFooter
      } header: {
        railHeader("Discover")
      }
    }
    .listStyle(.sidebar)
    .scrollContentBackground(.hidden)
    .navigationTitle("Manager")
    .managerBackground()
    .sheet(isPresented: $showFindMore) {
      FindMoreView(model: model)
    }
  }

  private func railHeader(_ title: String) -> some View {
    Text(title)
      .font(.system(.caption2).weight(.semibold))
      .tracking(1.4)
      .textCase(.uppercase)
      .foregroundStyle(Color.managerMuted)
  }

  private func row(for view: BoardViewItem) -> some View {
    let isSelected = model.selectedViewID == view.id
    return Label {
      HStack(spacing: 8) {
        Text(view.title)
          .font(ManagerFont.rowTitle)
          .foregroundStyle(isSelected ? Color.managerInk : Color.managerMuted)
        Spacer(minLength: 8)
        if isSelected {
          Image(systemName: "chevron.right")
            .font(.system(size: 10, weight: .semibold))
            .foregroundStyle(Color.managerMuted)
        }
      }
    } icon: {
      Image(systemName: view.resolvedIcon)
        .foregroundStyle(Color.boardColor(view.resolvedColor))
    }
    .padding(.vertical, 3)
    .accessibilityLabel(view.title)
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

/// Find more: the template catalog plus a custom-view form. A template install
/// copies a suggested icon and color onto the rail; a typo in either string is
/// normalized by `Appearance` before it ever reaches an `Image`.
struct FindMoreView: View {
  @Bindable var model: TaskBoardModel
  @Environment(\.dismiss) private var dismiss
  @State private var title = ""
  @State private var icon = Appearance.fallbackIcon
  @State private var color = Appearance.fallbackColor

  var body: some View {
    NavigationStack {
      List {
        Section {
          ForEach(ViewTemplateCatalog.all) { template in
            HStack(spacing: 10) {
              Image(systemName: template.view.resolvedIcon)
                .foregroundStyle(Color.boardColor(template.view.resolvedColor))
                .frame(width: 24)
              Text(template.title)
                .font(ManagerFont.rowTitle)
                .foregroundStyle(Color.managerInk)
              Spacer(minLength: 8)
              Button("Install") {
                Task { await model.installTemplate(template) }
              }
              .buttonStyle(.plain)
              .font(ManagerFont.meta.weight(.semibold))
              .foregroundStyle(Color.managerAccent)
            }
            .padding(.vertical, 2)
          }
        } header: {
          Text("Suggested views")
            .font(.system(.caption2).weight(.semibold))
            .tracking(1.4)
            .foregroundStyle(Color.managerMuted)
        }

        Section {
          TextField("View title", text: $title)
            .font(ManagerFont.rowTitle)
          TextField("Icon name (SF Symbol)", text: $icon)
            .font(ManagerFont.meta)
          TextField("Color token", text: $color)
            .font(ManagerFont.meta)

          HStack(spacing: 10) {
            Image(systemName: Appearance.icon(icon))
              .foregroundStyle(Color.boardColor(Appearance.color(color)))
            Text(title.isEmpty ? "New view" : title)
              .font(ManagerFont.meta)
              .foregroundStyle(Color.managerMuted)
            Spacer(minLength: 0)
          }
          .padding(.vertical, 4)

          Button("Create view") {
            Task {
              await model.createCustomView(title: title, icon: icon, color: color)
              dismiss()
            }
          }
          .managerPrimaryButton()
          .disabled(title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
        } header: {
          Text("Custom view")
            .font(.system(.caption2).weight(.semibold))
            .tracking(1.4)
            .foregroundStyle(Color.managerMuted)
        }
      }
      .listStyle(.plain)
      .navigationTitle("Find more")
      .toolbar {
        ToolbarItem(placement: .confirmationAction) {
          Button("Done") { dismiss() }
        }
      }
      .managerBackground()
    }
  }
}
