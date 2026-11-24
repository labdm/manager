import Foundation
import Observation

/// Presentation state for the row-first shell.
///
/// Owns the live task list, the destination and chip selection, the empty
/// detail pane, create/edit presentation and optimistic mutations. It has no
/// SwiftUI and no networking of its own, so the whole state machine is unit
/// tested against an in-memory backend.
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

  /// Last known payload. Every newer array defaults to empty, so an older
  /// deployment still draws the shell.
  public private(set) var boardSnapshot: BoardSnapshot = .starter

  // MARK: Shell state

  /// Tasks is the default destination. The menu is not one of these values.
  public var selectedDestination: ShellDestination = .tasks
  public var selectedChip: BoardChip = .all
  /// The split detail starts empty. Nothing preselects a row on load or after
  /// a chip or destination change: selection is what marks a row seen.
  public var selectedRowID: String?
  /// `nil` reads across the person's groups. The default group is selected
  /// when groups ship; an older payload leaves this as All.
  public var selectedGroupID: String?
  public var activityOnTasks: ActivityOnTasks = .others

  /// On compact width create is pushed with `navigationDestination`. On
  /// regular width the same draft is presented as a sheet.
  public var isCreateRouteActive = false
  public private(set) var presentedSheet: BoardSheet?

  /// Locally authored entities for mechanics whose backend mutations are still
  /// planned. Tasks still go through `TaskBackend`.
  public private(set) var localEntities: [BoardEntity] = []

  /// Incremented when the create button is tapped. Kept for title focus.
  public private(set) var composerFocusRequest = 0

  /// Retained for the pure grouping helpers; the chip picker replaced it as
  /// the visible filter control.
  public var selectedList: TaskList = .all
  public var draftTitle = ""
  public var draftDueDate: Date?

  @ObservationIgnored private let backend: any TaskBackend & ShellBackend
  @ObservationIgnored private var updatesTask: Task<Void, Never>?
  @ObservationIgnored private var connectionTask: Task<Void, Never>?
  @ObservationIgnored private var boardTask: Task<Void, Never>?
  @ObservationIgnored private var shellTask: Task<Void, Never>?

  public init(backend: any TaskBackend & ShellBackend) {
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
        // Keep the last snapshot. A board failure must not blank the shell.
      }
    }

    // The other destinations read their own string-named functions. A missing
    // function yields an empty array, never a fallback screen.
    shellTask = Task { [weak self] in
      guard let self else { return }
      await self.loadShellRecords()
    }
  }

  /// Best-effort reads for Groups, Routings, Categories and Resources. Each
  /// call is independent so one missing deployment function cannot hide the
  /// records that do exist.
  private func loadShellRecords() async {
    async let groups = try? backend.groupsList()
    async let routings = try? backend.routingsList()
    async let categories = try? backend.categoriesList()
    async let resources = try? backend.resourcesList()

    let loadedGroups = await groups
    let loadedRoutings = await routings
    let loadedCategories = await categories
    let loadedResources = await resources

    if let loadedGroups { boardSnapshot.groups = loadedGroups }
    if let loadedRoutings { boardSnapshot.routings = loadedRoutings }
    if let loadedCategories { boardSnapshot.categories = loadedCategories }
    if let loadedResources { boardSnapshot.resources = loadedResources }
  }

  /// Stops live updates and clears everything user-specific.
  public func stop() {
    updatesTask?.cancel()
    updatesTask = nil
    connectionTask?.cancel()
    connectionTask = nil
    boardTask?.cancel()
    boardTask = nil
    shellTask?.cancel()
    shellTask = nil

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
    selectedDestination = .tasks
    selectedChip = .all
    selectedRowID = nil
    selectedGroupID = nil
    activityOnTasks = .others
    isCreateRouteActive = false
    presentedSheet = nil
    localEntities = []
    composerFocusRequest = 0
  }

  /// Restarts after a failure without losing the draft.
  public func retry() {
    updatesTask?.cancel()
    updatesTask = nil
    connectionTask?.cancel()
    connectionTask = nil
    boardTask?.cancel()
    boardTask = nil
    shellTask?.cancel()
    shellTask = nil
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

  /// Mixed rows for the active chip. Empty sections are dropped by the domain.
  public func boardSections(now: Date = .now, calendar: Calendar = .current) -> [BoardSection] {
    boardSnapshot.sections(
      tasks: tasks,
      chip: selectedChip,
      activity: activityOnTasks,
      groupID: selectedGroupID,
      now: now,
      calendar: calendar
    )
  }

  /// One row list for any destination. The list never chooses a row for the
  /// detail column; only an explicit tap sets `selectedRowID`.
  public func rows(
    for destination: ShellDestination,
    chip: BoardChip,
    now: Date = .now,
    calendar: Calendar = .current
  ) -> [BoardRow] {
    switch destination {
    case .tasks:
      return boardSections(now: now, calendar: calendar).flatMap(\.rows)
    case .messages:
      return boardSnapshot.alerts.map(BoardRow.alert)
    case .groups:
      return boardSnapshot.groups.map(BoardRow.group)
        + boardSnapshot.invites.map(BoardRow.invite)
    case .categories:
      return boardSnapshot.categories.map(BoardRow.category)
    case .resources:
      return boardSnapshot.resources.map(BoardRow.resource)
    }
  }

  public var rows: [BoardRow] {
    rows(for: selectedDestination, chip: selectedChip)
  }

  /// The detail column reads "Select an item." until this is non-nil.
  public var selectedRow: BoardRow? {
    rows.first { $0.id == selectedRowID }
  }

  public var detailTitle: String? { selectedRow?.title }

  /// Changing destination or chip clears the selection. This is what keeps a
  /// row from being marked read just because the window got wider or a filter
  /// changed.
  public func selectDestination(_ destination: ShellDestination) {
    selectedDestination = destination
    selectedRowID = nil
    isCreateRouteActive = false
  }

  public func selectChip(_ chip: BoardChip) {
    selectedChip = chip
    selectedRowID = nil
  }

  public func selectGroup(_ groupID: String?) {
    selectedGroupID = groupID
    selectedRowID = nil
  }

  /// Unseen counts for `.badge()`. A zero is never shown by the view.
  public func badgeCount(for destination: ShellDestination) -> Int {
    rows(for: destination, chip: selectedChip).count { $0.isUnseen }
  }

  public func badgeCount(for chip: BoardChip) -> Int {
    rows(for: .tasks, chip: chip).count { $0.isUnseen }
  }

  /// Opening a row is the only act that marks it seen. A failed write leaves
  /// the NEW mark in place.
  public func selectRow(_ row: BoardRow) async {
    selectedRowID = row.id
    switch row {
    case let .task(task):
      // Selecting is not editing. It only marks the row seen; the detail pane
      // has its own explicit Edit button.
      await open(task)
    case let .alert(alert):
      await markAlertSeen(alert)
    case let .invite(invite):
      markInviteSeen(invite)
    case let .question(question):
      markQuestionSeen(question)
    default:
      break
    }
  }

  /// The create button pushes on compact width and presents on regular width.
  /// For a time chip the planned day is prefilled with that period's first day.
  public func beginTask(now: Date = .now, calendar: Calendar = .current) {
    draftDueDate = selectedChip.anchor(now: now, calendar: calendar)
    composerFocusRequest += 1
    presentedSheet = .createTask
    isCreateRouteActive = true
  }

  // MARK: - Modals

  public func present(_ sheet: BoardSheet) {
    presentedSheet = sheet
    if sheet == .createTask { isCreateRouteActive = true }
  }

  public func dismissSheet() {
    presentedSheet = nil
    isCreateRouteActive = false
  }

  /// Editing from a detail pane still uses a sheet, but never auto-opens one.
  public func openTask(_ task: TaskItem) async {
    presentedSheet = .editTask(task.id)
    await open(task)
  }

  /// Saves a locally authored entity. Categories and views also appear as
  /// dashboard tiles so the new sheet flow is visible end to end.
  @discardableResult
  public func saveEntity(
    kind: BoardEntityKind,
    title: String,
    icon: String,
    color: String
  ) async -> Bool {
    let trimmed = title.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmed.isEmpty else { return false }

    let entity = BoardEntity(
      kind: kind,
      title: trimmed,
      icon: Appearance.icon(icon),
      color: Appearance.color(color)
    )
    localEntities.append(entity)
    defer { presentedSheet = nil }

    if kind == .category || kind == .view {
      await createCustomView(title: trimmed, icon: entity.icon, color: entity.color)
    }
    return true
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

  /// Creates a task from the quick-add draft. Returns true on success.
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

  /// Creates a task from the full sheet draft. Look, series and cadence are
  /// presentation facts; only the M1 fields reach the `tasks:create` mutation.
  @discardableResult
  public func createTask(from draft: TaskDraft, calendar: Calendar = .current) async -> Bool {
    let trimmed = draft.title.trimmingCharacters(in: .whitespacesAndNewlines)
    guard TaskTitle.isValid(trimmed), !isSaving else { return false }

    isSaving = true
    defer { isSaving = false }

    var resolved = draft
    resolved.title = trimmed
    resolved.plannedOn = resolved.plannedOn.map { calendar.startOfDay(for: $0) }
    if !TaskPriority.seeds.contains(resolved.priority) {
      resolved.priorityRank = resolved.priority.seedRank
    }
    do {
      try await backend.createTask(resolved)
      errorMessage = nil
      return true
    } catch {
      errorMessage = Self.message(for: error)
      return false
    }
  }

  /// Creates the first occurrence of a series from the sheet. The behavior and
  /// cadence are explicit choices, never guessed from "daily".
  @discardableResult
  public func createSeriesTask(
    from draft: TaskDraft,
    now: Date = .now,
    calendar: Calendar = .current
  ) async -> Bool {
    let trimmed = draft.title.trimmingCharacters(in: .whitespacesAndNewlines)
    guard TaskTitle.isValid(trimmed), draft.series != .none, !isSaving else { return false }

    isSaving = true
    defer { isSaving = false }

    let day = draft.plannedOn.map { calendar.startOfDay(for: $0) }
      ?? selectedChip.anchor(now: now, calendar: calendar)
      ?? calendar.startOfDay(for: now)
    do {
      try await backend.createRecurrence(
        title: trimmed,
        behavior: draft.series.rawValue,
        cadence: draft.cadence.rawValue,
        periodStart: day
      )
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
    do {
      try await backend.markSeen(id: task.id)
      // NEW clears only after the write succeeds. A failed open leaves the
      // row exactly as it was.
      replace(original.withSeen())
      errorMessage = nil
    } catch {
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

  public func createRecurrence(
    title: String,
    behavior: String,
    cadence: SeriesCadence = .daily,
    now: Date = .now,
    calendar: Calendar = .current
  ) async {
    let day = selectedChip.anchor(now: now, calendar: calendar) ?? calendar.startOfDay(for: now)
    do {
      try await backend.createRecurrence(
        title: title,
        behavior: behavior,
        cadence: cadence.rawValue,
        periodStart: day
      )
      errorMessage = nil
    } catch {
      errorMessage = Self.message(for: error)
    }
  }

  /// Settings writes `users:setActivityOnTasks { value }`. The default is
  /// `others`; History always ignores this setting.
  public func setActivityOnTasks(_ value: ActivityOnTasks) async {
    let previous = activityOnTasks
    activityOnTasks = value
    do {
      try await backend.setActivityOnTasks(value)
      errorMessage = nil
    } catch {
      activityOnTasks = previous
      errorMessage = Self.message(for: error)
    }
  }

  /// Reading a message sets `seenAt` only after the write succeeds, and leaves
  /// the record in History.
  public func markAlertSeen(_ alert: BoardAlert) async {
    guard let index = boardSnapshot.alerts.firstIndex(where: { $0.id == alert.id }) else { return }
    do {
      try await backend.markAlertSeen(id: alert.id)
      boardSnapshot.alerts[index].seenAt = Date()
      errorMessage = nil
    } catch {
      errorMessage = Self.message(for: error)
    }
  }

  private func markInviteSeen(_ invite: BoardInvite) {
    guard let index = boardSnapshot.invites.firstIndex(where: { $0.id == invite.id }) else { return }
    if boardSnapshot.invites[index].seenAt == nil {
      boardSnapshot.invites[index].seenAt = Date()
    }
  }

  private func markQuestionSeen(_ question: BoardQuestion) {
    guard let index = boardSnapshot.questions.firstIndex(where: { $0.id == question.id }) else { return }
    if boardSnapshot.questions[index].seenAt == nil {
      boardSnapshot.questions[index].seenAt = Date()
    }
  }

  /// The row's primary action. The type mark itself is never a button.
  public func performPrimaryAction(on row: BoardRow) async {
    switch row {
    case let .task(task):
      await toggle(task)
    case let .alert(alert):
      await markAlertSeen(alert)
    case let .question(question):
      answerQuestion(question, optionID: question.options.first?.id ?? "")
    case let .invite(invite):
      await acceptInvite(invite)
    default:
      selectedRowID = row.id
    }
  }

  private func inviteFor(_ row: BoardRow) -> BoardInvite? {
    guard case let .invite(invite) = row else { return nil }
    return invite
  }

  public func acceptInvite(inviteFor row: BoardRow) async {
    guard let invite = inviteFor(row) else { return }
    await acceptInvite(invite)
  }

  public func declineInvite(inviteFor row: BoardRow) async {
    guard let invite = inviteFor(row) else { return }
    await declineInvite(invite)
  }

  /// Accepting or declining also sets `seenAt`; the invite leaves the open
  /// board but stays in the group's log.
  public func acceptInvite(_ invite: BoardInvite) async {
    guard let index = boardSnapshot.invites.firstIndex(where: { $0.id == invite.id }) else { return }
    let previous = boardSnapshot.invites[index]
    boardSnapshot.invites[index].status = "accepted"
    boardSnapshot.invites[index].seenAt = Date()
    do {
      try await backend.acceptInvite(id: invite.id)
      errorMessage = nil
    } catch {
      boardSnapshot.invites[index] = previous
      errorMessage = Self.message(for: error)
    }
  }

  public func declineInvite(_ invite: BoardInvite) async {
    guard let index = boardSnapshot.invites.firstIndex(where: { $0.id == invite.id }) else { return }
    let previous = boardSnapshot.invites[index]
    boardSnapshot.invites[index].status = "declined"
    boardSnapshot.invites[index].seenAt = Date()
    do {
      try await backend.declineInvite(id: invite.id)
      errorMessage = nil
    } catch {
      boardSnapshot.invites[index] = previous
      errorMessage = Self.message(for: error)
    }
  }

  public func createGroup(name: String) async {
    let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmed.isEmpty else { return }
    let preview = BoardGroup(id: "group-pending", name: trimmed)
    boardSnapshot.groups.append(preview)
    do {
      try await backend.createGroup(name: trimmed)
      boardSnapshot.groups.removeAll { $0.id == preview.id }
      errorMessage = nil
    } catch {
      boardSnapshot.groups.removeAll { $0.id == preview.id }
      errorMessage = Self.message(for: error)
    }
  }

  public func createInvite(groupId: String, email: String) async {
    guard !groupId.isEmpty, !email.isEmpty else { return }
    let preview = BoardInvite(id: "invite-pending", groupId: groupId, email: email)
    boardSnapshot.invites.append(preview)
    do {
      try await backend.createInvite(groupId: groupId, email: email)
      boardSnapshot.invites.removeAll { $0.id == preview.id }
      errorMessage = nil
    } catch {
      boardSnapshot.invites.removeAll { $0.id == preview.id }
      errorMessage = Self.message(for: error)
    }
  }

  /// Cron is an explicit trigger and `createTask` an explicit execution. The
  /// cadence never implies a recurrence behavior.
  public func createRouting(name: String, cadence: String, title: String) async {
    let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmed.isEmpty else { return }
    let preview = BoardRouting(
      id: "routing-pending",
      name: trimmed,
      trigger: "cron",
      cadence: cadence,
      executionKind: "createTask",
      title: title
    )
    boardSnapshot.routings.append(preview)
    do {
      try await backend.createRouting(name: trimmed, cadence: cadence, title: title)
      boardSnapshot.routings.removeAll { $0.id == preview.id }
      errorMessage = nil
    } catch {
      boardSnapshot.routings.removeAll { $0.id == preview.id }
      errorMessage = Self.message(for: error)
    }
  }

  /// Marks a message seen without removing it. History keeps every record.
  public func dismissAlert(_ alert: BoardAlert) {
    guard let index = boardSnapshot.alerts.firstIndex(where: { $0.id == alert.id }) else { return }
    boardSnapshot.alerts[index].seenAt = Date()
    backend.dismissAlert(id: alert.id)
  }

  /// Composes a message from Messages. The record stays in `alerts`; a failed
  /// write removes the local preview so History never shows an unsent record.
  public func createMessage(title: String, body: String) async {
    let trimmed = title.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmed.isEmpty else { return }

    let preview = BoardAlert(
      id: "message-\(UUID().uuidString)",
      title: trimmed,
      body: body,
      author: "self",
      seenAt: Date()
    )
    boardSnapshot.alerts.append(preview)
    do {
      try await backend.createAlert(title: trimmed, body: body)
      // An in-memory backend has already replaced the snapshot with its own
      // record; a Convex mutation has not, so the preview stays until reload.
      errorMessage = nil
    } catch {
      boardSnapshot.alerts.removeAll { $0.id == preview.id }
      errorMessage = Self.message(for: error)
    }
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
