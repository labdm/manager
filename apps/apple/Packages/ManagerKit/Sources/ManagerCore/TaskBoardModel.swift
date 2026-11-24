import Foundation
import Observation

/// Presentation state for the task board.
///
/// Owns the live task list, the composer draft, smart-list selection and
/// optimistic mutations. It has no SwiftUI and no networking of its own, so the
/// whole state machine is unit tested against an in-memory `TaskBackend`.
@MainActor
@Observable
public final class TaskBoardModel {
  public enum Phase: Equatable, Sendable {
    case idle
    case loading
    case ready
    case failed(String)
  }

  public private(set) var tasks: [TaskItem] = []
  public private(set) var phase: Phase = .idle
  public private(set) var connection: ConnectionStatus = .connecting
  public private(set) var hasConnectedOnce = false
  public private(set) var inFlight: Set<String> = []
  public private(set) var errorMessage: String?
  public private(set) var isSaving = false

  /// Shell state: the left rail, the selected view and the active time tab.
  public private(set) var boardSnapshot: BoardSnapshot = .starter
  public var selectedViewID: String = BoardViewItem.home.id
  public var selectedSlice: BoardSlice = .tasks
  /// Incremented when `+` is tapped so the composer can focus its title field.
  public private(set) var composerFocusRequest = 0

  /// Sidebar selection. Persisted by the app layer, not by this model.
  public var selectedList: TaskList = .all
  public var draftTitle = ""
  public var draftDueDate: Date?

  @ObservationIgnored private let backend: any TaskBackend
  @ObservationIgnored private var updatesTask: Task<Void, Never>?
  @ObservationIgnored private var connectionTask: Task<Void, Never>?
  @ObservationIgnored private var boardTask: Task<Void, Never>?

  public init(backend: any TaskBackend) {
    self.backend = backend
  }

  // MARK: - Lifecycle

  /// Starts live updates. Idempotent: safe to call on every auth change.
  public func start() {
    guard updatesTask == nil else { return }

    phase = .loading
    connection = .connecting
    startConnectionMonitor()

    updatesTask = Task { [weak self] in
      guard let self else { return }

      // Not fatal: a signed-out or not-yet-provisioned identity surfaces when
      // the subscription itself fails below.
      try? await self.backend.ensureUser()
      guard !Task.isCancelled else { return }

      do {
        for try await items in self.backend.taskUpdates() {
          guard !Task.isCancelled else { return }
          self.tasks = items
          if self.phase != .ready { self.phase = .ready }
        }
        guard !Task.isCancelled else { return }
        self.phase = .failed("Live updates stopped. Pull to refresh or reopen the app.")
      } catch {
        guard !Task.isCancelled else { return }
        self.phase = .failed(Self.message(for: error))
      }
    }

    // Board content is a separate live query (`board:slice`). If the deployment
    // has no such function yet, the starter snapshot keeps the shell rendered;
    // the task list above stays authoritative.
    boardTask = Task { [weak self] in
      guard let self else { return }
      do {
        for try await snapshot in self.backend.boardSliceUpdates() {
          guard !Task.isCancelled else { return }
          self.boardSnapshot = snapshot
        }
      } catch {
        // Keep the last snapshot. A board failure must not blank the rail.
      }
    }
  }

  /// Stops live updates and clears everything user-specific.
  public func stop() {
    updatesTask?.cancel()
    updatesTask = nil
    connectionTask?.cancel()
    connectionTask = nil
    boardTask?.cancel()
    boardTask = nil

    tasks = []
    phase = .idle
    connection = .connecting
    hasConnectedOnce = false
    inFlight = []
    errorMessage = nil
    isSaving = false
    draftTitle = ""
    draftDueDate = nil
    boardSnapshot = .starter
    selectedViewID = BoardViewItem.home.id
    selectedSlice = .tasks
    composerFocusRequest = 0
  }

  /// Restarts after a failure without losing the composer draft.
  public func retry() {
    updatesTask?.cancel()
    updatesTask = nil
    connectionTask?.cancel()
    connectionTask = nil
    boardTask?.cancel()
    boardTask = nil
    start()
  }

  private func startConnectionMonitor() {
    connectionTask = Task { [weak self] in
      guard let self else { return }
      for await status in self.backend.connectionUpdates() {
        guard !Task.isCancelled else { return }
        self.connection = status
        if status == .connected { self.hasConnectedOnce = true }
      }
    }
  }

  // MARK: - Derived state

  public func groups(now: Date = .now, calendar: Calendar = .current) -> [TaskSectionGroup] {
    let visible = tasks.filter { selectedList.includes($0, now: now, calendar: calendar) }
    return TaskOrganizer.groups(for: visible, now: now, calendar: calendar)
  }

  public func count(for list: TaskList, now: Date = .now, calendar: Calendar = .current) -> Int {
    tasks.count { list.includes($0, now: now, calendar: calendar) }
  }

  /// Open tasks due today or earlier, for the header subtitle.
  public func openTodayCount(now: Date = .now, calendar: Calendar = .current) -> Int {
    count(for: .today, now: now, calendar: calendar)
  }

  public var openCount: Int {
    tasks.count { !$0.done }
  }

  // MARK: - Shell

  /// The selected rail view, falling back to Home if the payload removed it.
  public var selectedView: BoardViewItem {
    boardSnapshot.views.first { $0.id == selectedViewID } ?? .home
  }

  /// Mixed rows for the active tab. Empty sections are dropped by the domain.
  public func boardSections(now: Date = .now, calendar: Calendar = .current) -> [BoardSection] {
    boardSnapshot.sections(tasks: tasks, slice: selectedSlice, now: now, calendar: calendar)
  }

  /// `+` starts a row in the current slice: the composer is focused and, for a
  /// time slice, its planned day is prefilled with that period's first day.
  public func beginTask(now: Date = .now, calendar: Calendar = .current) {
    draftDueDate = selectedSlice == .tasks ? nil : selectedSlice.anchor(now: now, calendar: calendar)
    composerFocusRequest += 1
  }

  /// Shown above the list when the socket drops.
  public var connectionNotice: String? {
    switch connection {
    case .connected:
      return nil
    case .offline:
      return "Offline. Changes are not reaching the backend."
    case .connecting:
      return hasConnectedOnce ? "Reconnecting…" : nil
    }
  }

  public func isWorking(on id: String) -> Bool {
    inFlight.contains(id)
  }

  public var draftValidationMessage: String? {
    let trimmed = draftTitle.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmed.isEmpty, trimmed.count > TaskTitle.maxLength else { return nil }
    return "Titles are limited to \(TaskTitle.maxLength) characters."
  }

  public var canSubmitDraft: Bool {
    !isSaving && TaskTitle.isValid(draftTitle)
  }

  // MARK: - Mutations

  /// Creates a task from the composer. Returns true when the draft was cleared.
  @discardableResult
  public func addTask(calendar: Calendar = .current) async -> Bool {
    if let message = draftValidationMessage {
      errorMessage = message
      return false
    }
    guard let title = TaskTitle.normalized(draftTitle), !isSaving else { return false }

    isSaving = true
    defer { isSaving = false }

    let dueDate = draftDueDate.map { calendar.startOfDay(for: $0) }
    do {
      try await backend.createTask(title: title, dueAt: dueDate)
      draftTitle = ""
      draftDueDate = nil
      errorMessage = nil
      return true
    } catch {
      errorMessage = Self.message(for: error)
      return false
    }
  }

  public func clearDraft() {
    draftTitle = ""
    draftDueDate = nil
  }

  public func toggle(_ task: TaskItem) async {
    await setDone(task.id, done: !task.done)
  }

  public func setDone(_ id: String, done: Bool) async {
    guard !inFlight.contains(id), let original = tasks.first(where: { $0.id == id }) else { return }

    inFlight.insert(id)
    replace(original.withDone(done))
    do {
      try await backend.setTask(id: id, done: done)
      errorMessage = nil
    } catch {
      replace(original)
      errorMessage = Self.message(for: error)
    }
    inFlight.remove(id)
  }

  public func delete(_ task: TaskItem) async {
    guard !inFlight.contains(task.id) else { return }

    inFlight.insert(task.id)
    let index = tasks.firstIndex { $0.id == task.id }
    tasks.removeAll { $0.id == task.id }
    do {
      try await backend.deleteTask(id: task.id)
      errorMessage = nil
    } catch {
      if let index, index <= tasks.count {
        tasks.insert(task, at: index)
      } else {
        tasks.append(task)
      }
      errorMessage = Self.message(for: error)
    }
    inFlight.remove(task.id)
  }

  /// An explicit open from a row or the editor. This is the only place that
  /// marks a task seen; loading or regrouping the board never calls it.
  public func open(_ task: TaskItem) async {
    guard !inFlight.contains(task.id), let original = tasks.first(where: { $0.id == task.id }) else {
      return
    }

    inFlight.insert(task.id)
    replace(original.withSeen())
    do {
      try await backend.markSeen(id: task.id)
      replace(original.withSeen())
      errorMessage = nil
    } catch {
      replace(original)
      errorMessage = Self.message(for: error)
    }
    inFlight.remove(task.id)
  }

  /// Saves the full editor. Deadline and remind-at never write the planned day;
  /// `TaskItem.applying` maps the planned day onto the legacy `dueAt` alias.
  public func save(_ task: TaskItem, draft: TaskDraft) async {
    guard !inFlight.contains(task.id), let original = tasks.first(where: { $0.id == task.id }) else {
      return
    }

    inFlight.insert(task.id)
    replace(original.applying(draft))
    do {
      try await backend.updateTask(id: task.id, draft: draft)
      errorMessage = nil
    } catch {
      replace(original)
      errorMessage = Self.message(for: error)
    }
    inFlight.remove(task.id)
  }

  public func dismissError() {
    errorMessage = nil
  }

  // MARK: - Shell mutations

  public func installTemplate(_ template: ViewTemplate) async {
    let view = template.view
    if !boardSnapshot.views.contains(where: { $0.id == view.id }) {
      boardSnapshot.views.append(view)
    }
    do {
      try await backend.installTemplate(template)
      errorMessage = nil
    } catch {
      boardSnapshot.views.removeAll { $0.id == view.id }
      errorMessage = Self.message(for: error)
    }
  }

  public func createCustomView(title: String, icon: String, color: String) async {
    let trimmed = title.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmed.isEmpty else { return }
    let view = BoardViewItem(
      id: "view-custom-preview",
      title: trimmed,
      icon: Appearance.icon(icon),
      color: Appearance.color(color),
      kind: .custom
    )
    boardSnapshot.views.append(view)
    do {
      try await backend.createCustomView(title: trimmed, icon: icon, color: color)
      errorMessage = nil
    } catch {
      boardSnapshot.views.removeAll { $0.id == view.id }
      errorMessage = Self.message(for: error)
    }
  }

  public func createRecurrence(title: String, behavior: String, now: Date = .now, calendar: Calendar = .current) async {
    let day = selectedSlice.anchor(now: now, calendar: calendar)
    do {
      try await backend.createRecurrence(title: title, behavior: behavior, periodStart: day)
      errorMessage = nil
    } catch {
      errorMessage = Self.message(for: error)
    }
  }

  public func dismissAlert(_ alert: BoardAlert) {
    boardSnapshot.alerts.removeAll { $0.id == alert.id }
    backend.dismissAlert(id: alert.id)
  }

  public func answerQuestion(_ question: BoardQuestion, optionID: String) {
    if let index = boardSnapshot.questions.firstIndex(where: { $0.id == question.id }) {
      boardSnapshot.questions[index].answeredAt = Date()
    }
    backend.answerQuestion(id: question.id, optionID: optionID)
  }

  private func replace(_ task: TaskItem) {
    guard let index = tasks.firstIndex(where: { $0.id == task.id }) else { return }
    tasks[index] = task
  }

  private static func message(for error: Error) -> String {
    if let backendError = error as? TaskBackendError { return backendError.message }
    let text = error.localizedDescription
    return text.isEmpty ? "Something went wrong." : text
  }
}
