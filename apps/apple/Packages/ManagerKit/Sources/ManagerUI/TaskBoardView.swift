import ManagerCore
import SwiftUI

/// The list column. Every chip can wear an unseen badge, and every record is
/// drawn with the one row anatomy. Nothing here inserts a form or opens a row.
public struct BoardListView: View {
  @Bindable public var model: TaskBoardModel
  public let onSelect: (BoardRow) -> Void

  public init(model: TaskBoardModel, onSelect: @escaping (BoardRow) -> Void) {
    self.model = model
    self.onSelect = onSelect
  }

  public var body: some View {
    TimelineView(.everyMinute) { context in
      List {
        if model.selectedDestination == .tasks {
          headerRow
          chipStrip
        } else if model.selectedDestination == .groups {
          headerRow
        }

        if let notice = model.connectionNotice {
          bannerRow(InlineBanner(text: notice, style: .warning))
        }

        if let error = model.errorMessage {
          bannerRow(
            InlineBanner(text: error, style: .error, dismiss: model.dismissError)
          )
        }

        contentRows(now: context.date)
      }
      .listStyle(.plain)
      .scrollContentBackground(.hidden)
      .environment(\.defaultMinListRowHeight, 1)
    }
    .managerBackground()
  }

  private var headerRow: some View {
    CenteredRow {
      HStack(spacing: 12) {
        VStack(alignment: .leading, spacing: 2) {
          Text("Manager").managerMark()
          Text(model.selectedDestination.title)
            .font(ManagerFont.display)
            .foregroundStyle(Color.managerInk)
        }
        Spacer(minLength: 0)
        GroupSwitcher(model: model)
      }
      .padding(.horizontal, 14)
      .padding(.top, 10)
    }
    .plainRow(top: 0, bottom: 6)
  }

  /// Chips sit above the list and swipe sideways. Any chip may show an unseen
  /// count; there is no tab bar or segmented control below it.
  private var chipStrip: some View {
    CenteredRow {
      ScrollView(.horizontal, showsIndicators: false) {
        HStack(spacing: 8) {
          ForEach(BoardChip.allCases) { chip in
            chipButton(chip)
          }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 2)
      }
    }
    .plainRow(top: 2, bottom: 8)
  }

  private func chipButton(_ chip: BoardChip) -> some View {
    let count = model.badgeCount(for: chip)
    return Button {
      model.selectChip(chip)
    } label: {
      HStack(spacing: 5) {
        Image(systemName: chip.systemImage)
          .font(.system(size: 11, weight: .semibold))
        Text(chip.title)
          .font(ManagerFont.meta.weight(.semibold))
      }
      .padding(.horizontal, 12)
      .padding(.vertical, 7)
      .foregroundStyle(
        model.selectedChip == chip ? Color.managerAccentInk : Color.managerInk
      )
      .background {
        Capsule(style: .continuous)
          .fill(model.selectedChip == chip ? Color.managerAccent : Color.managerRaised)
      }
    }
    .managerButton()
    .accessibilityLabel(chip.title)
    .accessibilityAddTraits(model.selectedChip == chip ? .isSelected : [])
    .modifier(OptionalBadge(count: count))
  }

  private func bannerRow(_ banner: InlineBanner) -> some View {
    CenteredRow {
      banner.padding(.horizontal, 14)
    }
    .plainRow()
  }

  @ViewBuilder
  private func contentRows(now: Date) -> some View {
    let rows = model.rows
    if rows.isEmpty {
      CenteredRow {
        BoardNoticeView(
          systemImage: model.selectedDestination.systemImage,
          title: "Nothing here yet",
          message: "Records you add through Manager or an agent appear here."
        )
        .padding(.horizontal, 14)
      }
      .plainRow(top: 20, bottom: 20)
    } else {
      ForEach(rows) { row in
        BoardRowView(
          row: row,
          now: now,
          isWorking: model.isWorking(on: row.id),
          onOpen: { onSelect(row) },
          onAction: { Task { await model.performPrimaryAction(on: row) } },
          onAccept: { Task { await model.acceptInvite(inviteFor: row) } },
          onDecline: { Task { await model.declineInvite(inviteFor: row) } },
          onDelete: {
            if case let .task(task) = row { Task { await model.delete(task) } }
          }
        )
        .listRowInsets(EdgeInsets(top: 2, leading: 8, bottom: 2, trailing: 8))
        .listRowSeparator(.hidden)
        .listRowBackground(Color.clear)
      }
    }
  }
}

/// Applies `.badge()` only when the count is non-zero.
public struct OptionalBadge: ViewModifier {
  public let count: Int

  public init(count: Int) {
    self.count = count
  }

  public func body(content: Content) -> some View {
    Group {
      if count > 0 {
        content.badge(count)
      } else {
        content
      }
    }
  }
}

private extension View {
  /// Strips a List row down to plain content with no separator or fill.
  func plainRow(top: CGFloat = 2, bottom: CGFloat = 2) -> some View {
    listRowInsets(EdgeInsets(top: top, leading: 8, bottom: bottom, trailing: 8))
      .listRowSeparator(.hidden)
      .listRowBackground(Color.clear)
  }
}
