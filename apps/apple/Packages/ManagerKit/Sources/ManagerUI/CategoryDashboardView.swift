import ManagerCore
import SwiftUI

/// The full-screen category dashboard reached from the grid button. It is a
/// grid of tiles, never a navigation sidebar column: picking a tile selects
/// the category and closes the cover.
public struct CategoryDashboardView: View {
  @Bindable public var model: TaskBoardModel
  private let onDismiss: () -> Void

  private let columns = [GridItem(.adaptive(minimum: 140), spacing: 14)]

  public init(model: TaskBoardModel, onDismiss: @escaping () -> Void) {
    self.model = model
    self.onDismiss = onDismiss
  }

  public var body: some View {
    NavigationStack {
      ScrollView {
        LazyVGrid(columns: columns, spacing: 14) {
          ForEach(model.dashboardTiles) { tile in
            Button {
              model.selectDashboardTile(tile)
              onDismiss()
            } label: {
              VStack(spacing: 10) {
                Image(systemName: Appearance.symbol(for: tile.icon))
                  .font(.system(size: 26, weight: .medium))
                  .foregroundStyle(Color.boardColor(tile.color))
                  .frame(width: 52, height: 52)
                  .background(
                    Circle().fill(Color.boardColor(tile.color).opacity(0.16))
                  )
                Text(tile.title)
                  .font(ManagerFont.rowTitle.weight(.semibold))
                  .foregroundStyle(Color.managerInk)
                  .lineLimit(2)
                  .multilineTextAlignment(.center)
                Spacer(minLength: 0)
              }
              .frame(maxWidth: .infinity, minHeight: 124)
              .padding(14)
              .background(
                RoundedRectangle(cornerRadius: ManagerMetrics.cardRadius, style: .continuous)
                  .fill(Color.managerSurface)
              )
              .overlay {
                RoundedRectangle(cornerRadius: ManagerMetrics.cardRadius, style: .continuous)
                  .strokeBorder(Color.managerBorder)
              }
            }
            .buttonStyle(.plain)
            .accessibilityLabel(tile.isAddTile ? "Add category" : tile.title)
          }
        }
        .padding()
      }
      .managerBackground()
      .navigationTitle("Categories")
      .toolbar {
        ToolbarItem(placement: .confirmationAction) {
          Button("Done", action: onDismiss)
        }
      }
    }
  }
}
