import ManagerCore
import SwiftUI

/// The detail column. It starts empty: selecting a row is the only way to put
/// a title here, because selection is what marks a row seen.
public struct RowDetailView: View {
  public let row: BoardRow?
  @Bindable public var model: TaskBoardModel

  public init(row: BoardRow?, model: TaskBoardModel) {
    self.row = row
    self.model = model
  }

  public var body: some View {
    Group {
      if let row {
        VStack(alignment: .leading, spacing: 12) {
          Text(row.title)
            .font(ManagerFont.title)
            .foregroundStyle(Color.managerInk)
          if let body = row.body, !body.isEmpty {
            Text(body)
              .font(ManagerFont.rowTitle)
              .foregroundStyle(.secondary)
          }
          if let progressText = row.progressText {
            Label(progressText, systemImage: "chart.bar")
              .font(ManagerFont.meta)
              .foregroundStyle(.secondary)
          }
          if case let .task(task) = row {
            Button(task.done ? "Reopen" : "Mark done") {
              Task { await model.toggle(task) }
            }
            .managerPrimaryButton()
            Button("Edit task") {
              model.present(.editTask(task.id))
            }
            .managerButton()
          }
          Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(24)
        .navigationTitle("Details")
      } else {
        Text("Select an item.")
          .font(ManagerFont.title)
          .foregroundStyle(.secondary)
          .frame(maxWidth: .infinity, maxHeight: .infinity)
          .navigationTitle("Details")
      }
    }
    .managerBackground()
  }
}
