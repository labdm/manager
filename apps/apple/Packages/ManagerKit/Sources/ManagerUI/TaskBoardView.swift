import ManagerCore
import SwiftUI

/// The board column: header, list filter, banners and the mixed rows. Chrome
/// lives outside this view — `TaskBoardScreen` owns the bottom tabs, the grid
/// dashboard and the sheet. No form is ever inserted into this column.
public struct TaskBoardView: View {
  @Bindable public var model: TaskBoardModel

  public init(model: TaskBoardModel) {
    self.model = model
  }

  public var body: some View {
    TimelineView(.everyMinute) { context in
      List {
        headerRow(now: context.date)
        listPickerRow

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
        Text(model.selectedView.title)
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

  /// The smart list filter is a control in the column, not a navigation rail.
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
      let sections = model.boardSections(now: now)
      if sections.isEmpty {
        noticeRow(
          BoardNoticeView(
            systemImage: model.selectedView.resolvedIcon,
            title: model.selectedList.emptyTitle,
            message: model.selectedList.emptyMessage
          )
        )
      } else {
        ForEach(sections) { section in
          boardSection(section, now: now)
        }
      }
    }
  }

  private func boardSection(_ section: BoardSection, now: Date) -> some View {
    Section {
      ForEach(section.rows) { row in
        boardRow(row, now: now)
      }
    } header: {
      CenteredRow {
        Text(section.title)
          .font(.system(.caption2).weight(.semibold))
          .tracking(1.4)
          .textCase(.uppercase)
          .foregroundStyle(Color.managerMuted)
          .padding(.horizontal, 14)
          .padding(.top, 10)
      }
      .plainRow(top: 0, bottom: 2)
    }
  }

  @ViewBuilder
  private func boardRow(_ row: BoardRow, now: Date) -> some View {
    switch row {
    case let .task(task):
      taskRow(task, now: now)
    case let .alert(alert):
      CenteredRow {
        AlertBandView(alert: alert, onDismiss: { model.dismissAlert(alert) })
          .padding(.horizontal, 14)
      }
      .plainRow()
    case let .question(question):
      CenteredRow {
        QuestionView(question: question, onAnswer: { optionID in
          model.answerQuestion(question, optionID: optionID)
        })
        .padding(.horizontal, 14)
      }
      .plainRow()
    case let .progression(progression):
      CenteredRow {
        ProgressionView(progression: progression)
          .padding(.horizontal, 14)
      }
      .plainRow()
    case let .quest(quest):
      CenteredRow {
        QuestView(quest: quest)
          .padding(.horizontal, 14)
      }
      .plainRow()
    }
  }

  private func taskRow(_ task: TaskItem, now: Date) -> some View {
    CenteredRow {
      TaskRowView(
        task: task,
        now: now,
        isWorking: model.isWorking(on: task.id),
        onOpen: {
          Task { await model.openTask(task) }
        },
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
}

private extension View {
  /// Strips a List row down to plain content with no separator or fill.
  func plainRow(top: CGFloat = 2, bottom: CGFloat = 2) -> some View {
    listRowInsets(EdgeInsets(top: top, leading: 8, bottom: bottom, trailing: 8))
      .listRowSeparator(.hidden)
      .listRowBackground(Color.clear)
  }
}
