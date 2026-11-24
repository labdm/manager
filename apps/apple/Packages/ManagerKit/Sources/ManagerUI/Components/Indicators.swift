import ManagerCore
import SwiftUI

/// The square check from the web UI, sized for touch.
public struct TaskCheckbox: View {
  public let isDone: Bool
  public let isWorking: Bool

  public init(isDone: Bool, isWorking: Bool = false) {
    self.isDone = isDone
    self.isWorking = isWorking
  }

  public var body: some View {
    ZStack {
      RoundedRectangle(cornerRadius: 7, style: .continuous)
        .fill(isDone ? Color.managerAccent : Color.clear)
        .overlay {
          RoundedRectangle(cornerRadius: 7, style: .continuous)
            .strokeBorder(Color.managerAccent, lineWidth: 1.5)
        }
        .frame(width: 22, height: 22)

      if isWorking {
        ProgressView()
          .controlSize(.mini)
      } else if isDone {
        Image(systemName: "checkmark")
          .font(.system(size: 12, weight: .bold))
          .foregroundStyle(Color.managerAccentInk)
      }
    }
    .accessibilityHidden(true)
  }
}

/// "Due today" / "Overdue · Nov 12" under a task title.
public struct DueBadge: View {
  public let description: DueDateDescription

  public init(description: DueDateDescription) {
    self.description = description
  }

  public var body: some View {
    HStack(spacing: 4) {
      Image(systemName: description.isOverdue ? "exclamationmark.circle.fill" : "calendar")
        .font(.system(size: 10, weight: .semibold))
      Text(description.text)
    }
    .font(ManagerFont.meta)
    .foregroundStyle(description.isOverdue ? Color.managerDanger : Color.managerMuted)
    .accessibilityLabel(description.text)
  }
}

/// The NEW mark on a row an agent or another person created.
public struct NewBadge: View {
  public init() {}

  public var body: some View {
    Text("NEW")
      .font(.system(size: 9, weight: .bold, design: .rounded))
      .foregroundStyle(Color.managerAccentInk)
      .padding(.horizontal, 5)
      .padding(.vertical, 2)
      .background(Capsule(style: .continuous).fill(Color.managerAccent))
      .accessibilityLabel("NEW")
  }
}

/// A small count capsule used by section headers.
public struct CountBadge: View {
  public let count: Int
  public let emphasized: Bool

  public init(count: Int, emphasized: Bool = false) {
    self.count = count
    self.emphasized = emphasized
  }

  public var body: some View {
    Text(count, format: .number)
      .font(.system(.caption2, design: .rounded).weight(.semibold))
      .monospacedDigit()
      .padding(.horizontal, 6)
      .padding(.vertical, 2)
      .foregroundStyle(emphasized ? Color.managerAccentInk : Color.managerMuted)
      .background(
        Capsule(style: .continuous)
          .fill(emphasized ? Color.managerAccent : Color.managerBorder.opacity(0.55))
      )
      .accessibilityLabel("\(count) tasks")
  }
}
