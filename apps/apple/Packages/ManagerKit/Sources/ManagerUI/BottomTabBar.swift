import ManagerCore
import SwiftUI

/// The app chrome: four slice tabs, a grid button for the full-screen category
/// dashboard and a `+` for the sheet. Glass is on the bar and its controls,
/// never on the text-heavy board rows.
public struct BottomTabBar: View {
  @Bindable public var model: TaskBoardModel

  public init(model: TaskBoardModel) {
    self.model = model
  }

  public var body: some View {
    HStack(spacing: 2) {
      ForEach(BoardSlice.allCases) { slice in
        Button {
          model.selectedSlice = slice
        } label: {
          VStack(spacing: 2) {
            Image(systemName: slice.systemImage)
              .font(.system(size: 15, weight: .semibold))
            Text(slice.title)
              .font(.system(size: 10, weight: .medium))
          }
          .frame(maxWidth: .infinity)
          .padding(.vertical, 7)
          .foregroundStyle(
            model.selectedSlice == slice ? Color.managerAccentInk : Color.managerMuted
          )
          .background {
            if model.selectedSlice == slice {
              Capsule(style: .continuous)
                .fill(Color.managerAccent.opacity(0.9))
            }
          }
          .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(slice.title)
        .accessibilityAddTraits(model.selectedSlice == slice ? .isSelected : [])
      }

      Rectangle()
        .fill(Color.managerBorder)
        .frame(width: 1, height: 28)
        .padding(.horizontal, 4)

      Button {
        model.openDashboard()
      } label: {
        Image(systemName: "square.grid.2x2")
          .font(.system(size: 16, weight: .semibold))
          .frame(width: 34, height: 34)
      }
      .managerButton()
      .accessibilityLabel("Open categories dashboard")

      Button {
        model.beginTask()
      } label: {
        Image(systemName: "plus")
          .font(.system(size: 16, weight: .bold))
          .frame(width: 34, height: 34)
      }
      .managerPrimaryButton()
      .accessibilityLabel("Create a task")
    }
    .padding(.horizontal, 10)
    .padding(.vertical, 6)
    .background(
      RoundedRectangle(cornerRadius: 22, style: .continuous)
        .fill(.regularMaterial)
    )
    .overlay {
      RoundedRectangle(cornerRadius: 22, style: .continuous)
        .strokeBorder(Color.managerBorder, lineWidth: 1)
    }
    .padding(.horizontal, 12)
    .accessibilityLabel("Board navigation")
  }
}
