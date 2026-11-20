import ManagerCore
import SwiftUI

/// A task row: checkbox, title, due badge, with tap, swipe and context actions.
public struct TaskRowView: View {
  public let task: TaskItem
  public let now: Date
  public let isWorking: Bool
  public let onToggle: () -> Void
  public let onDelete: () -> Void

  @State private var isHovering = false

  public init(
    task: TaskItem,
    now: Date,
    isWorking: Bool = false,
    onToggle: @escaping () -> Void,
    onDelete: @escaping () -> Void
  ) {
    self.task = task
    self.now = now
    self.isWorking = isWorking
    self.onToggle = onToggle
    self.onDelete = onDelete
  }

  public var body: some View {
    HStack(alignment: .top, spacing: 12) {
      TaskCheckbox(isDone: task.done, isWorking: isWorking)
        .padding(.top, 1)

      VStack(alignment: .leading, spacing: 3) {
        Text(task.title)
          .font(ManagerFont.rowTitle)
          .foregroundStyle(task.done ? Color.managerMuted : Color.managerInk)
          .strikethrough(task.done, color: Color.managerMuted)
          .lineLimit(3)
          .multilineTextAlignment(.leading)

        if let dueAt = task.dueAt {
          DueBadge(description: DueDateLabel.describe(dueAt: dueAt, now: now))
        }
      }

      Spacer(minLength: 0)
    }
    .padding(.vertical, 4)
    .padding(.horizontal, 14)
    .frame(minHeight: 48)
    .background(
      RoundedRectangle(cornerRadius: 12, style: .continuous)
        .fill(isHovering && !task.done ? Color.managerRaised.opacity(0.7) : Color.clear)
    )
    .contentShape(Rectangle())
    .onTapGesture(perform: onToggle)
    .onHover { isHovering = $0 }
    .accessibilityElement(children: .combine)
    .accessibilityAddTraits(.isButton)
    .accessibilityHint(task.done ? "Reopens the task" : "Completes the task")
    .accessibilityAction(named: Text(task.done ? "Reopen" : "Complete")) { onToggle() }
    .accessibilityAction(named: Text("Delete")) { onDelete() }
    .contextMenu {
      Button(task.done ? "Reopen" : "Complete", action: onToggle)
      Divider()
      Button("Delete", role: .destructive, action: onDelete)
    }
    .swipeActions(edge: .trailing, allowsFullSwipe: true) {
      Button(role: .destructive, action: onDelete) {
        Label("Delete", systemImage: "trash")
      }
    }
    .swipeActions(edge: .leading) {
      Button(action: onToggle) {
        Label(task.done ? "Reopen" : "Done", systemImage: task.done ? "arrow.uturn.backward" : "checkmark")
      }
      .tint(Color.managerAccent)
    }
  }
}
