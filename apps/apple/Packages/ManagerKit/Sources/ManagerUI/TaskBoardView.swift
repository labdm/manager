import ManagerCore
import SwiftUI

/// The task detail pane: brand header, composer, banners and grouped rows.
///
/// One scrolling `List` keeps swipe actions, keyboard navigation and VoiceOver
/// order native on every platform, including the unfolded iPhone Duo where the
/// window is wide enough for two columns.
public struct TaskBoardView: View {
  @Bindable var model: TaskBoardModel
  private let showsListPicker: Bool

  @State private var collapsedSections: Set<TaskSection> = [.completed]

  public init(model: TaskBoardModel, showsListPicker: Bool = false) {
    self.model = model
    self.showsListPicker = showsListPicker
  }

  public var body: some View {
    TimelineView(.everyMinute) { context in
      List {
        headerRow(now: context.date)

        if showsListPicker {
          listPickerRow
        }

        composerRow

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
    #if os(macOS)
      .navigationTitle("Manager")
    #endif
  }

  // MARK: - Rows

  private func headerRow(now: Date) -> some View {
    CenteredRow {
      VStack(alignment: .leading, spacing: 4) {
        Text("Manager").managerMark()
        Text(model.selectedList.title)
          .font(ManagerFont.display)
          .foregroundStyle(Color.managerInk)
        Text(subtitle(now: now))
          .font(ManagerFont.meta)
          .foregroundStyle(Color.managerMuted)
      }
      .frame(maxWidth: .infinity, alignment: .leading)
      .padding(.top, 12)
      .padding(.horizontal, 14)
    }
    .plainRow(top: 0, bottom: 8)
  }

  private var listPickerRow: some View {
    CenteredRow {
      Picker("List", selection: $model.selectedList) {
        ForEach(TaskList.allCases) { list in
          Text(list.title).tag(list)
        }
      }
      .pickerStyle(.segmented)
      .labelsHidden()
      .padding(.horizontal, 14)
    }
    .plainRow()
  }

  private var composerRow: some View {
    CenteredRow {
      TaskComposerView(model: model)
        .padding(.horizontal, 14)
    }
    .plainRow()
  }

  private func bannerRow(_ banner: InlineBanner) -> some View {
    CenteredRow {
      banner.padding(.horizontal, 14)
    }
    .plainRow()
  }

  @ViewBuilder
  private func contentRows(now: Date) -> some View {
    switch model.phase {
    case .idle, .loading:
      skeletonRows
    case let .failed(message):
      noticeRow(
        BoardNoticeView(
          systemImage: "wifi.exclamationmark",
          title: "Can't reach the backend",
          message: message,
          actionTitle: "Try again",
          action: model.retry
        )
      )
    case .ready:
      let groups = model.groups(now: now)
      if groups.isEmpty {
        noticeRow(
          BoardNoticeView(
            systemImage: model.selectedList.systemImage,
            title: model.selectedList.emptyTitle,
            message: model.selectedList.emptyMessage
          )
        )
      } else {
        ForEach(groups) { group in
          section(for: group, now: now)
        }
      }
    }
  }

  private func section(for group: TaskSectionGroup, now: Date) -> some View {
    let isCollapsed = collapsedSections.contains(group.section)
    let collapseHandler: (() -> Void)? = group.section.startsCollapsed
      ? { toggleCollapse(group.section) }
      : nil

    return Section {
      if !isCollapsed {
        ForEach(group.tasks) { task in
          taskRow(task, now: now)
        }
      }
    } header: {
      CenteredRow {
        TaskSectionHeader(
          group: group,
          isCollapsed: isCollapsed,
          onToggleCollapse: collapseHandler
        )
        .padding(.horizontal, 14)
        .padding(.top, 10)
      }
      .plainRow(top: 0, bottom: 2)
    }
  }

  private func taskRow(_ task: TaskItem, now: Date) -> some View {
    CenteredRow {
      TaskRowView(
        task: task,
        now: now,
        isWorking: model.isWorking(on: task.id),
        onToggle: { Task { await model.toggle(task) } },
        onDelete: { Task { await model.delete(task) } }
      )
    }
    .listRowInsets(EdgeInsets(top: 1, leading: 8, bottom: 1, trailing: 8))
    .listRowSeparator(.hidden)
    .listRowBackground(Color.clear)
  }

  private func noticeRow(_ notice: BoardNoticeView) -> some View {
    CenteredRow {
      notice.padding(.horizontal, 14)
    }
    .plainRow()
  }

  private var skeletonRows: some View {
    ForEach(0..<3, id: \.self) { index in
      CenteredRow {
        HStack(spacing: 12) {
          RoundedRectangle(cornerRadius: 7, style: .continuous)
            .strokeBorder(Color.managerBorder, lineWidth: 1.5)
            .frame(width: 22, height: 22)
          Capsule()
            .fill(Color.managerBorder.opacity(0.6))
            .frame(width: index == 1 ? 210 : 300, height: 11)
          Spacer(minLength: 0)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 14)
        .redacted(reason: .placeholder)
      }
      .plainRow()
    }
  }

  // MARK: - Helpers

  private func subtitle(now: Date) -> String {
    guard model.phase == .ready else { return "Loading…" }
    let open = model.openCount
    guard open > 0 else { return "All clear." }
    let today = model.openTodayCount(now: now)
    return today > 0 ? "\(today) due today · \(open) open" : "\(open) open"
  }

  private func toggleCollapse(_ section: TaskSection) {
    withAnimation(.snappy(duration: 0.2)) {
      if collapsedSections.contains(section) {
        collapsedSections.remove(section)
      } else {
        collapsedSections.insert(section)
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
