import ManagerCore
import SwiftUI

/// The adaptive root of the signed-in app. There is no side rail: the board is
/// one column with a bottom glass tab bar, a grid button that opens a full-screen
/// category dashboard, and a `+` that presents a sheet. Compact width uses a
/// bottom sheet; a wide iPad or Mac gets a centered dialog instead.
public struct TaskBoardScreen<Accessory: View>: View {
  @Bindable public var model: TaskBoardModel
  @Environment(\.horizontalSizeClass) private var horizontalSizeClass

  private let accessory: Accessory

  public init(model: TaskBoardModel, @ViewBuilder accessory: () -> Accessory) {
    self.model = model
    self.accessory = accessory()
  }

  private var usesBottomSheet: Bool {
    #if os(iOS)
      horizontalSizeClass == .compact
    #else
      false
    #endif
  }

  public var body: some View {
    NavigationStack {
      TaskBoardView(model: model)
        .toolbar {
          ToolbarItem(placement: .primaryAction) {
            accessory
          }
        }
        .safeAreaInset(edge: .bottom) {
          BottomTabBar(model: model)
        }
    }
    .tint(Color.managerAccent)
    .sheet(item: compactSheet) { target in
      sheetContent(target)
        #if os(iOS)
          .managerBottomSheet()
        #endif
    }
    .overlay {
      if !usesBottomSheet, let target = model.presentedSheet {
        ManagerCenteredSheet(onDismiss: { model.dismissSheet() }) {
          sheetContent(target)
        }
      }
    }
    #if os(iOS)
    .fullScreenCover(isPresented: dashboardBinding) {
      CategoryDashboardView(model: model, onDismiss: { model.closeDashboard() })
    }
    #else
    .overlay {
      if model.showsDashboard {
        CategoryDashboardView(model: model, onDismiss: { model.closeDashboard() })
      }
    }
    #endif
    .animation(.snappy(duration: 0.22), value: horizontalSizeClass)
  }

  private var compactSheet: Binding<BoardSheet?> {
    Binding(
      get: { usesBottomSheet ? model.presentedSheet : nil },
      set: { if $0 == nil { model.dismissSheet() } }
    )
  }

  private var dashboardBinding: Binding<Bool> {
    Binding(
      get: { model.showsDashboard },
      set: { if !$0 { model.closeDashboard() } }
    )
  }

  @ViewBuilder
  private func sheetContent(_ target: BoardSheet) -> some View {
    NavigationStack {
      EntitySheetView(target: target, model: model, onDismiss: { model.dismissSheet() })
    }
  }
}

#if os(iOS)
  private extension View {
    /// iPhone presents the create and edit forms as a bottom sheet.
    func managerBottomSheet() -> some View {
      presentationDetents([.large])
        .presentationDragIndicator(.visible)
    }
  }
#endif
