import ManagerCore
import SwiftUI

/// The adaptive root of the signed-in app.
///
/// Phone uses the system `TabView`. Regular width uses `NavigationSplitView`
/// with an empty detail column and no preselection. The menu is a toolbar
/// button that pushes a list, never a tab or a pinned rail. Glass stays on the
/// buttons through `ManagerGlass`; rows and the split view stay opaque.
public struct ManagerShell<Accessory: View>: View {
  @Bindable public var model: TaskBoardModel
  @Environment(\.horizontalSizeClass) private var horizontalSizeClass

  private let accessory: Accessory

  public init(model: TaskBoardModel, @ViewBuilder accessory: () -> Accessory) {
    self.model = model
    self.accessory = accessory()
  }

  private var usesSplit: Bool {
    #if os(macOS)
      true
    #else
      horizontalSizeClass == .regular
    #endif
  }

  public var body: some View {
    Group {
      if usesSplit {
        splitShell
      } else {
        compactShell
      }
    }
    .tint(Color.managerAccent)
    .sheet(item: sheetBinding) { target in
      sheetContent(target)
    }
  }

  // MARK: - Compact

  private var compactShell: some View {
    TabView(selection: destinationSelection) {
      ForEach(ShellDestination.allCases) { destination in
        CompactDestinationStack(
          destination: destination,
          model: model,
          accessory: accessory
        )
        .tabItem {
          Label(destination.title, systemImage: destination.systemImage)
        }
        .modifier(OptionalBadge(count: model.badgeCount(for: destination)))
        .tag(destination)
      }
    }
  }

  /// Each tab owns its own pushed stack. Detail and create both use
  /// `navigationDestination`; clearing the model selection pops the detail.
  private struct CompactDestinationStack<AccessoryView: View>: View {
    let destination: ShellDestination
    @Bindable var model: TaskBoardModel
    let accessory: AccessoryView
    @State private var menuPath: [ShellMenuRoute] = []

    var body: some View {
      NavigationStack {
        DestinationView(destination: destination, model: model, onSelect: select)
          .navigationTitle(destination.title)
          .toolbar {
            ToolbarItem(placement: .navigation) {
              MenuButton { menuPath.append(.list) }
            }
            ToolbarItem(placement: .navigation) {
              accessory
            }
            if destination == .tasks {
              ToolbarItem(placement: .primaryAction) {
                createButton
              }
            }
          }
          .navigationDestination(for: ShellMenuRoute.self) { route in
            menuDestination(route)
          }
          .navigationDestination(item: detailItem) { row in
            RowDetailView(row: row, model: model)
          }
          .navigationDestination(isPresented: createBinding) {
            TaskSheetView(target: .createTask, model: model) {
              model.dismissSheet()
            }
          }
      }
    }

    private func select(_ row: BoardRow) {
      Task { await model.selectRow(row) }
    }

    private var createButton: some View {
      Button {
        model.beginTask()
      } label: {
        Image(systemName: "plus")
          .font(.system(size: 16, weight: .bold))
      }
      .managerPrimaryButton()
      .accessibilityLabel("Create a task")
    }

    private var detailItem: Binding<BoardRow?> {
      Binding(
        get: { model.selectedRow },
        set: { if $0 == nil { model.selectedRowID = nil } }
      )
    }

    private var createBinding: Binding<Bool> {
      Binding(
        get: { model.isCreateRouteActive && destination == .tasks },
        set: { if !$0 { model.dismissSheet() } }
      )
    }

    @ViewBuilder
    private func menuDestination(_ route: ShellMenuRoute) -> some View {
      switch route {
      case .list:
        MenuListView(model: model)
      case let .page(page):
        MenuPageView(destination: page, model: model)
      }
    }
  }

  // MARK: - Regular width

  private var splitShell: some View {
    NavigationSplitView {
      List(selection: destinationSelection) {
        ForEach(ShellDestination.allCases) { destination in
          Label(destination.title, systemImage: destination.systemImage)
            .modifier(OptionalBadge(count: model.badgeCount(for: destination)))
            .tag(destination)
        }
      }
      .listStyle(.sidebar)
      .navigationTitle("Manager")
    } content: {
      NavigationStack {
        DestinationView(destination: model.selectedDestination, model: model) { row in
          Task { await model.selectRow(row) }
        }
        .navigationTitle(model.selectedDestination.title)
        .toolbar {
          ToolbarItem(placement: .navigation) {
            RegularMenuStack(accessory: accessory)
          }
          if model.selectedDestination == .tasks {
            ToolbarItem(placement: .primaryAction) {
              Button {
                model.beginTask()
              } label: {
                Image(systemName: "plus")
                  .font(.system(size: 16, weight: .bold))
              }
              .managerPrimaryButton()
              .accessibilityLabel("Create a task")
            }
          }
        }
        .navigationDestination(for: ShellMenuRoute.self) { route in
          switch route {
          case .list:
            MenuListView(model: model)
          case let .page(page):
            MenuPageView(destination: page, model: model)
          }
        }
      }
    } detail: {
      NavigationStack {
        RowDetailView(row: model.selectedRow, model: model)
      }
    }
  }

  /// The menu button is a toolbar button on regular width too. It pushes the
  /// same list as on the phone; the path lives in the enclosing stack.
  private struct RegularMenuStack<AccessoryView: View>: View {
    let accessory: AccessoryView

    var body: some View {
      HStack(spacing: 8) {
        NavigationLink(value: ShellMenuRoute.list) {
          Label("Menu", systemImage: "line.3.horizontal")
        }
        .managerButton()
        .accessibilityLabel("Menu")
        accessory
      }
    }
  }

  // MARK: - Shared

  private var destinationSelection: Binding<ShellDestination> {
    Binding(
      get: { model.selectedDestination },
      set: { model.selectDestination($0) }
    )
  }

  private var sheetBinding: Binding<BoardSheet?> {
    Binding(
      get: {
        // On compact width create is pushed, not presented.
        if !usesSplit, case .createTask = model.presentedSheet { return nil }
        return model.presentedSheet
      },
      set: { if $0 == nil { model.dismissSheet() } }
    )
  }

  @ViewBuilder
  private func sheetContent(_ target: BoardSheet) -> some View {
    NavigationStack {
      switch target {
      case .createTask, .editTask:
        TaskSheetView(target: target, model: model) {
          model.dismissSheet()
        }
      default:
        EntitySheetView(target: target, model: model) {
          model.dismissSheet()
        }
      }
    }
    #if os(iOS)
    .presentationDetents([.large])
    .presentationDragIndicator(.visible)
    #endif
  }
}
