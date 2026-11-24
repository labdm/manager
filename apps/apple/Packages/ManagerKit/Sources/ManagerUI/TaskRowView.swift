import ManagerCore
import SwiftUI

/// The only row layout. A stored `card` presentation is ignored: tasks,
/// messages, questions, invites, progressions and records all draw this row.
/// The row stays opaque; glass belongs on the buttons around it.
public struct BoardRowView: View {
  public let row: BoardRow
  public let now: Date
  public let isWorking: Bool
  public let onOpen: () -> Void
  public let onAction: () -> Void
  public let onAccept: () -> Void
  public let onDecline: () -> Void
  public let onDelete: () -> Void

  public init(
    row: BoardRow,
    now: Date,
    isWorking: Bool = false,
    onOpen: @escaping () -> Void,
    onAction: @escaping () -> Void,
    onAccept: @escaping () -> Void,
    onDecline: @escaping () -> Void,
    onDelete: @escaping () -> Void
  ) {
    self.row = row
    self.now = now
    self.isWorking = isWorking
    self.onOpen = onOpen
    self.onAction = onAction
    self.onAccept = onAccept
    self.onDecline = onDecline
    self.onDelete = onDelete
  }

  public var body: some View {
    HStack(alignment: .top, spacing: 8) {
      if row.isUnseen {
        NewBadge()
      }

      Image(systemName: row.typeMark)
        .font(.system(size: 15, weight: .semibold))
        .foregroundStyle(Color.managerAccent)
        .frame(width: 20)
        .accessibilityHidden(true)

      if case let .progression(progression) = row {
        ProgressView(value: progression.fraction)
          .tint(Color.managerAccent)
          .frame(width: 52)
      }

      VStack(alignment: .leading, spacing: 3) {
        HStack(alignment: .firstTextBaseline, spacing: 6) {
          Text(row.title)
            .font(ManagerFont.rowTitle)
            .foregroundStyle(Color.managerInk)
            .lineLimit(2)
            .multilineTextAlignment(.leading)
          if let progressText = row.progressText {
            Text(progressText)
              .font(ManagerFont.meta)
              .monospacedDigit()
              .foregroundStyle(.secondary)
          }
        }
        if let body = row.body, !body.isEmpty {
          Text(body)
            .font(ManagerFont.meta)
            .foregroundStyle(.secondary)
            .lineLimit(2)
        }
        if case let .task(task) = row, let dueAt = task.dueAt {
          DueBadge(description: DueDateLabel.describe(dueAt: dueAt, now: now))
        }
      }
      .frame(maxWidth: .infinity, alignment: .leading)

      if let groupID = row.groupID, !groupID.isEmpty {
        Image(systemName: "person.2")
          .font(.system(size: 12, weight: .semibold))
          .foregroundStyle(.secondary)
          .accessibilityLabel("Group \(groupID)")
      }

      if case .invite = row {
        Button("Decline", action: onDecline)
          .managerButton()
          .accessibilityLabel("Decline invite")
        Button("Accept", action: onAccept)
          .managerPrimaryButton()
          .accessibilityLabel("Accept invite")
      } else {
        Button(action: onAction) {
          if case let .task(task) = row {
            TaskCheckbox(isDone: task.done, isWorking: isWorking)
          } else {
            Text(row.primaryActionTitle)
              .font(ManagerFont.meta.weight(.semibold))
          }
        }
        .buttonStyle(.plain)
        .disabled(isWorking)
        .accessibilityLabel(row.primaryActionTitle)
        .accessibilityHint(row.title)
      }
    }
    .padding(.vertical, 8)
    .padding(.horizontal, 12)
    .contentShape(Rectangle())
    .onTapGesture(perform: onOpen)
    .accessibilityElement(children: .contain)
    .contextMenu {
      Button("Open details", action: onOpen)
      Divider()
      Button("Delete", role: .destructive, action: onDelete)
    }
    .swipeActions(edge: .trailing, allowsFullSwipe: true) {
      Button(role: .destructive, action: onDelete) {
        Label("Delete", systemImage: "trash")
      }
    }
  }
}
