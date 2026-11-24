import ManagerCore
import SwiftUI

/// A task row with one of three explicit looks: check, row or card. Every look
/// keeps the checkbox, the NEW mark and the same open/toggle/delete actions.
public struct TaskRowView: View {
  public let task: TaskItem
  public let now: Date
  public let isWorking: Bool
  public let onOpen: () -> Void
  public let onToggle: () -> Void
  public let onDelete: () -> Void

  @State private var isHovering = false

  public init(
    task: TaskItem,
    now: Date,
    isWorking: Bool = false,
    onOpen: @escaping () -> Void,
    onToggle: @escaping () -> Void,
    onDelete: @escaping () -> Void
  ) {
    self.task = task
    self.now = now
    self.isWorking = isWorking
    self.onOpen = onOpen
    self.onToggle = onToggle
    self.onDelete = onDelete
  }

  public var body: some View {
    HStack(alignment: .top, spacing: 12) {
      Button(action: onToggle) {
        TaskCheckbox(isDone: task.done, isWorking: isWorking)
          .padding(.top, 1)
      }
      .buttonStyle(.plain)
      .disabled(isWorking)
      .accessibilityLabel(task.done ? "Reopen" : "Complete")
      .accessibilityHint(task.title)

      lookContent
        .frame(maxWidth: .infinity, alignment: .leading)

      Spacer(minLength: 0)
    }
    .padding(.vertical, task.look == .card ? 12 : 4)
    .padding(.horizontal, 14)
    .frame(minHeight: task.look == .card ? 96 : 48)
    .background {
      RoundedRectangle(cornerRadius: 12, style: .continuous)
        .fill(
          task.look == .card
            ? Color.managerRaised
            : (isHovering && !task.done ? Color.managerRaised.opacity(0.7) : Color.clear)
        )
    }
    .overlay {
      if task.look == .card {
        RoundedRectangle(cornerRadius: 12, style: .continuous)
          .strokeBorder(Color.managerBorder)
      }
    }
    .contentShape(Rectangle())
    .onTapGesture(perform: onOpen)
    .accessibilityElement(children: .combine)
    .accessibilityAddTraits(.isButton)
    .accessibilityLabel(task.isNew ? "NEW: \(task.title)" : task.title)
    .accessibilityHint("Open details")
    .onHover { isHovering = $0 }
    .contextMenu {
      Button("Open details", action: onOpen)
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

  @ViewBuilder
  private var lookContent: some View {
    switch task.look {
    case .check:
      VStack(alignment: .leading, spacing: 3) {
        titleLine(lineLimit: 3)
        if let dueAt = task.dueAt {
          DueBadge(description: DueDateLabel.describe(dueAt: dueAt, now: now))
        }
        if !factSummary.isEmpty {
          Text(factSummary)
            .font(ManagerFont.meta)
            .foregroundStyle(Color.managerMuted)
            .lineLimit(2)
            .multilineTextAlignment(.leading)
        }
      }
    case .row:
      HStack(alignment: .firstTextBaseline, spacing: 8) {
        titleLine(lineLimit: 1)
        if let dueAt = task.dueAt {
          DueBadge(description: DueDateLabel.describe(dueAt: dueAt, now: now))
        }
        if !factSummary.isEmpty {
          Text(factSummary)
            .font(ManagerFont.meta)
            .foregroundStyle(Color.managerMuted)
            .lineLimit(1)
        }
      }
    case .card:
      VStack(alignment: .leading, spacing: 6) {
        titleLine(lineLimit: 2)
        if let notes = task.notes, !notes.isEmpty {
          Text(notes)
            .font(ManagerFont.meta)
            .foregroundStyle(Color.managerMuted)
            .lineLimit(2)
        }
        HStack(spacing: 8) {
          if let dueAt = task.dueAt {
            DueBadge(description: DueDateLabel.describe(dueAt: dueAt, now: now))
          }
          if !factSummary.isEmpty {
            Text(factSummary)
              .font(ManagerFont.meta)
              .foregroundStyle(Color.managerMuted)
              .lineLimit(1)
          }
        }
      }
    }
  }

  private func titleLine(lineLimit: Int) -> some View {
    HStack(alignment: .firstTextBaseline, spacing: 6) {
      Text(task.title)
        .font(task.look == .card ? ManagerFont.title : ManagerFont.rowTitle)
        .foregroundStyle(task.done ? Color.managerMuted : Color.managerInk)
        .strikethrough(task.done, color: Color.managerMuted)
        .lineLimit(lineLimit)
        .multilineTextAlignment(.leading)

      if task.isNew {
        NewBadge()
      }
    }
  }

  private var factSummary: String {
    var pieces: [String] = []
    if let plannedTime = task.plannedTime {
      pieces.append(TaskFacts.label(forPlannedTime: plannedTime))
    }
    if let location = task.location, !location.isEmpty {
      pieces.append(location)
    }
    if let deadlineAt = task.deadlineAt {
      pieces.append("Deadline \(DueDateLabel.short(dueAt: deadlineAt, now: now))")
    }
    if task.priority != .normal {
      pieces.append(task.priority.rawValue.capitalized)
    }
    if task.overdue {
      pieces.append("Overdue")
    }
    if let outcome = task.outcome {
      pieces.append(outcome.capitalized)
    }
    if task.look != .check && task.series != .none {
      pieces.append("\(task.cadence.title) · \(task.series.title)")
    }
    return pieces.joined(separator: " · ")
  }
}
