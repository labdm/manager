import ManagerCore
import SwiftUI

/// The detail pane: brand header, always-on tabs, composer, banners and the
/// mixed board column. The left rail lives in `TaskSidebar`; both the rail and
/// these tabs are owned by the shell so neither disappears when the list is
/// empty or still loading.
public struct TaskBoardView: View {
  @Bindable var model: TaskBoardModel
  private let showsListPicker: Bool

  @State private var editorTarget: EditorTarget?
  @State private var showFindMore = false

  public init(model: TaskBoardModel, showsListPicker: Bool = false) {
    self.model = model
    self.showsListPicker = showsListPicker
  }

  public var body: some View {
    TimelineView(.everyMinute) { context in
      List {
        headerRow(now: context.date)
        tabsRow

        if showsListPicker {
          compactRailRow
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
    .sheet(item: $editorTarget) { target in
      TaskEditorView(taskID: target.id, model: model)
    }
    .sheet(isPresented: $showFindMore) {
      FindMoreView(model: model)
    }
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

  /// Tasks · Daily · Weekly · Monthly and `+`, which starts a row in the
  /// selected slice. Always rendered, independent of the board's phase.
  private var tabsRow: some View {
    CenteredRow {
      HStack(spacing: 4) {
        ForEach(BoardSlice.allCases) { slice in
          Button {
            model.selectedSlice = slice
          } label: {
            Text(slice.title)
              .font(.system(.caption, weight: .semibold))
              .foregroundStyle(
                model.selectedSlice == slice ? Color.managerAccentInk : Color.managerMuted
              )
              .padding(.horizontal, 10)
              .padding(.vertical, 6)
              .background(
                Capsule(style: .continuous)
                  .fill(
                    model.selectedSlice == slice
                      ? Color.managerAccent
                      : Color.clear
                  )
              )
          }
          .buttonStyle(.plain)
          .accessibilityLabel(slice.title)
        }

        Spacer(minLength: 4)

        Button {
          model.beginTask()
        } label: {
          Image(systemName: "plus")
            .font(.system(size: 12, weight: .bold))
            .foregroundStyle(Color.managerAccent)
            .frame(width: 26, height: 26)
            .background(
              Circle().strokeBorder(Color.managerAccent.opacity(0.6), lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Add a task to this slice")
      }
      .padding(.horizontal, 14)
    }
    .plainRow(bottom: 6)
  }

  /// Compact width has no split-view sidebar, so the rail becomes a horizontal
  /// strip of view chips. It is always present, like the tabs above it.
  private var compactRailRow: some View {
    CenteredRow {
      ScrollView(.horizontal, showsIndicators: false) {
        HStack(spacing: 8) {
          ForEach(model.boardSnapshot.views) { view in
            Button {
              model.selectedViewID = view.id
            } label: {
              HStack(spacing: 5) {
                Image(systemName: view.resolvedIcon)
                Text(view.title)
                  .font(ManagerFont.meta)
              }
              .foregroundStyle(
                model.selectedViewID == view.id ? Color.managerAccentInk : Color.managerInk
              )
              .padding(.horizontal, 10)
              .padding(.vertical, 6)
              .background(
                Capsule(style: .continuous)
                  .fill(
                    model.selectedViewID == view.id
                      ? Color.boardColor(view.resolvedColor)
                      : Color.managerRaised
                  )
              )
            }
            .buttonStyle(.plain)
          }

          Button {
            showFindMore = true
          } label: {
            HStack(spacing: 5) {
              Image(systemName: "plus.magnifyingglass")
              Text("Find more")
                .font(ManagerFont.meta)
            }
            .foregroundStyle(Color.managerAccent)
            .padding(.horizontal, 10)
            .padding(.vertical, 6)
            .background(Capsule(style: .continuous).strokeBorder(Color.managerBorder))
          }
          .buttonStyle(.plain)
        }
        .padding(.horizontal, 14)
      }
    }
    .plainRow(bottom: 4)
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
          editorTarget = EditorTarget(id: task.id)
          Task { await model.open(task) }
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

private struct EditorTarget: Identifiable {
  let id: String
}

private extension View {
  /// Strips a List row down to plain content with no separator or fill.
  func plainRow(top: CGFloat = 2, bottom: CGFloat = 2) -> some View {
    listRowInsets(EdgeInsets(top: top, leading: 8, bottom: bottom, trailing: 8))
      .listRowSeparator(.hidden)
      .listRowBackground(Color.clear)
  }
}
