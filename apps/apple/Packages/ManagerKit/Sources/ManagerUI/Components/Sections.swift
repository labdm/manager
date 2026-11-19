import ManagerCore
import SwiftUI

/// Section header with a count and, for completed work, a fold control.
public struct TaskSectionHeader: View {
  public let group: TaskSectionGroup
  public let isCollapsed: Bool
  public let onToggleCollapse: (() -> Void)?

  public init(group: TaskSectionGroup, isCollapsed: Bool = false, onToggleCollapse: (() -> Void)? = nil) {
    self.group = group
    self.isCollapsed = isCollapsed
    self.onToggleCollapse = onToggleCollapse
  }

  private var tint: Color {
    group.section == .overdue ? Color.managerDanger : Color.managerMuted
  }

  public var body: some View {
    HStack(spacing: 6) {
      Image(systemName: group.section.systemImage)
        .font(.system(size: 10, weight: .semibold))
      Text(group.section.title)
        .font(.system(.caption2).weight(.semibold))
        .tracking(1.4)
        .textCase(.uppercase)
      CountBadge(count: group.tasks.count, emphasized: group.section == .today || group.section == .overdue)

      Spacer(minLength: 0)

      if onToggleCollapse != nil {
        Image(systemName: isCollapsed ? "chevron.right" : "chevron.down")
          .font(.system(size: 10, weight: .semibold))
      }
    }
    .foregroundStyle(tint)
    .padding(.vertical, 4)
    .contentShape(Rectangle())
    .onTapGesture { onToggleCollapse?() }
    .accessibilityElement(children: .combine)
    .accessibilityAddTraits(onToggleCollapse == nil ? [] : .isButton)
  }
}

/// Empty, failed and offline states.
public struct BoardNoticeView: View {
  public let systemImage: String
  public let title: String
  public let message: String
  public let actionTitle: String?
  public let action: (() -> Void)?

  public init(
    systemImage: String,
    title: String,
    message: String,
    actionTitle: String? = nil,
    action: (() -> Void)? = nil
  ) {
    self.systemImage = systemImage
    self.title = title
    self.message = message
    self.actionTitle = actionTitle
    self.action = action
  }

  public var body: some View {
    VStack(spacing: 10) {
      Image(systemName: systemImage)
        .font(.system(size: 26, weight: .light))
        .foregroundStyle(Color.managerAccent)
      Text(title)
        .font(ManagerFont.title)
        .foregroundStyle(Color.managerInk)
      Text(message)
        .font(ManagerFont.meta)
        .foregroundStyle(Color.managerMuted)
        .multilineTextAlignment(.center)
        .frame(maxWidth: 380)
      if let actionTitle, let action {
        Button(actionTitle, action: action)
          .buttonStyle(.borderedProminent)
          .tint(Color.managerAccent)
          .padding(.top, 4)
      }
    }
    .frame(maxWidth: .infinity)
    .padding(.vertical, 36)
  }
}

/// Thin inline banner used for connection and error messages.
public struct InlineBanner: View {
  public enum Style {
    case warning
    case error
  }

  public let text: String
  public let style: Style
  public let dismiss: (() -> Void)?

  public init(text: String, style: Style, dismiss: (() -> Void)? = nil) {
    self.text = text
    self.style = style
    self.dismiss = dismiss
  }

  private var tint: Color {
    style == .error ? Color.managerDanger : Color.managerMuted
  }

  public var body: some View {
    HStack(spacing: 8) {
      Image(systemName: style == .error ? "exclamationmark.triangle.fill" : "wifi.exclamationmark")
        .font(.system(size: 11, weight: .semibold))
      Text(text)
        .font(ManagerFont.meta)
      Spacer(minLength: 0)
      if let dismiss {
        Button {
          dismiss()
        } label: {
          Image(systemName: "xmark")
            .font(.system(size: 10, weight: .bold))
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Dismiss")
      }
    }
    .foregroundStyle(tint)
    .padding(.horizontal, 12)
    .padding(.vertical, 8)
    .background {
      RoundedRectangle(cornerRadius: 10, style: .continuous)
        .fill(tint.opacity(0.1))
    }
  }
}
