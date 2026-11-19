import ManagerCore
import SwiftUI

/// The adaptive root of the signed-in app.
///
/// Compact width (iPhone closed, iPhone Duo outer display) gets one column with
/// a segmented list picker. Regular width (iPad, unfolded Duo, Mac) gets a
/// sidebar plus detail. `Accessory` is the account control, supplied by the app
/// target because it comes from ClerkKitUI.
public struct TaskBoardScreen<Accessory: View>: View {
  @Bindable var model: TaskBoardModel
  @Environment(\.horizontalSizeClass) private var horizontalSizeClass
  @State private var columnVisibility: NavigationSplitViewVisibility = .all

  private let accessory: Accessory

  public init(model: TaskBoardModel, @ViewBuilder accessory: () -> Accessory) {
    self.model = model
    self.accessory = accessory()
  }

  public var body: some View {
    Group {
      if horizontalSizeClass == .compact {
        NavigationStack {
          TaskBoardView(model: model, showsListPicker: true)
            .toolbar { toolbarContent }
        }
      } else {
        NavigationSplitView(columnVisibility: $columnVisibility) {
          TaskSidebar(model: model)
            .navigationSplitViewColumnWidth(min: 190, ideal: 220, max: 300)
        } detail: {
          TaskBoardView(model: model)
            .toolbar { toolbarContent }
        }
        .navigationSplitViewStyle(.balanced)
      }
    }
    .tint(Color.managerAccent)
    .animation(.snappy(duration: 0.22), value: horizontalSizeClass)
  }

  @ToolbarContentBuilder
  private var toolbarContent: some ToolbarContent {
    ToolbarItem(placement: .primaryAction) {
      accessory
    }
  }
}
