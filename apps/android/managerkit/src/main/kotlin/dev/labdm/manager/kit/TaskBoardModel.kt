package dev.labdm.manager.kit

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/** Presentation phase of the board. */
sealed interface BoardPhase {
    data object Idle : BoardPhase
    data object Loading : BoardPhase
    data object Ready : BoardPhase
    data class Failed(val message: String) : BoardPhase
}

/** An open editor for one row. Absent means no editor is showing. */
data class TaskEdit(
    val taskId: String,
    val draft: TaskDraft,
    val isSaving: Boolean = false,
)

data class BoardState(
    val tasks: List<TaskItem> = emptyList(),
    val phase: BoardPhase = BoardPhase.Idle,
    val connection: ConnectionStatus = ConnectionStatus.CONNECTING,
    val hasConnectedOnce: Boolean = false,
    val inFlight: Set<String> = emptySet(),
    val errorMessage: String? = null,
    val isSaving: Boolean = false,
    val draft: TaskDraft = TaskDraft(),
    val edit: TaskEdit? = null,
    val selectedSlice: TaskSlice = TaskSlice.TASKS,
    val views: List<TaskView> = listOf(TaskView.HOME),
    val selectedViewId: String = TaskView.HOME.id,
    /** The grid button covers the screen with these tiles; it is never a rail. */
    val showsDashboard: Boolean = false,
    /** The bottom plus presents this sheet; no form is pushed into the column. */
    val presentedSheet: BoardSheet? = null,
    val composerFocusRequest: Int = 0,
    val sheetEntities: List<BoardEntity> = emptyList(),
    val alerts: List<BoardAlert> = emptyList(),
    val questions: List<BoardQuestion> = emptyList(),
    val progression: ProgressionState? = null,
    val quest: QuestState? = null,
    val pinnedTaskIds: Set<String> = emptySet(),
) {
    val draftTitle: String get() = draft.title
    val draftDueAt: Long? get() = draft.plannedOn

    val selectedView: TaskView
        get() = views.firstOrNull { it.id == selectedViewId } ?: TaskView.HOME

    /**
     * Tiles for the full-screen dashboard: one per view plus the add tile, which
     * is always last and is the only dashboard path to the category sheet.
     */
    val dashboardTiles: List<DashboardTile>
        get() {
            val tiles = views.map { DashboardTile(it.id, it.title, it.icon, it.color) }.toMutableList()
            if (tiles.none { it.title == "Add category" }) {
                tiles += DashboardTile(
                    id = "dashboard-add-category",
                    title = "Add category",
                    icon = Appearance.FALLBACK_ICON,
                    color = Appearance.FALLBACK_COLOR,
                    isAddTile = true,
                )
            }
            return tiles
        }

    /** Rows another person or an agent wrote and you have not opened. */
    val newCount: Int get() = tasks.count { it.isNew }

    /** Unread alerts. Reading one clears it from the band. */
    val unreadAlerts: List<BoardAlert> get() = alerts.filter { it.isUnread }

    /** Open questions. An answered question leaves the band. */
    val openQuestions: List<BoardQuestion>
        get() = questions.filter { it.answeredAt == null }
}

/**
 * Presentation state for the task board.
 *
 * Owns the live list, composer draft, row editor and optimistic mutations. No
 * Convex or Clerk imports: the whole state machine is unit tested against an
 * in-memory backend, mirroring Swift's `TaskBoardModel`.
 */
class TaskBoardModel(
    private val backend: TaskBackend,
    private val now: () -> Long = System::currentTimeMillis,
) : ViewModel() {

    private val _state = MutableStateFlow(BoardState())
    val state: StateFlow<BoardState> = _state.asStateFlow()

    private var updatesJob: Job? = null
    private var connectionJob: Job? = null

    /** Starts live updates. Idempotent, so auth changes can call it repeatedly. */
    fun start() {
        if (updatesJob?.isActive == true) return
        _state.update { it.copy(phase = BoardPhase.Loading, connection = ConnectionStatus.CONNECTING) }
        startConnectionMonitor()

        updatesJob = viewModelScope.launch {
            // Not fatal: a not-yet-provisioned identity surfaces as a query error.
            runCatching { backend.ensureUser() }
            try {
                backend.taskUpdates().collect { items ->
                    _state.update {
                        it.copy(tasks = items, phase = BoardPhase.Ready, errorMessage = null)
                    }
                }
                _state.update {
                    it.copy(phase = BoardPhase.Failed("Live updates stopped. Reopen the app to retry."))
                }
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (error: Exception) {
                _state.update { it.copy(phase = BoardPhase.Failed(message(error))) }
            }
        }
    }

    /** Stops live updates and clears everything user-specific. */
    fun stop() {
        updatesJob?.cancel()
        updatesJob = null
        connectionJob?.cancel()
        connectionJob = null
        _state.value = BoardState()
    }

    override fun onCleared() {
        stop()
        super.onCleared()
    }

    /** Restarts after a failure without losing the composer draft. */
    fun retry() {
        val draft = _state.value.draft
        stop()
        _state.update { it.copy(draft = draft) }
        start()
    }

    private fun startConnectionMonitor() {
        connectionJob = viewModelScope.launch {
            backend.connectionUpdates()
                .catch { _state.update { current -> current.copy(connection = ConnectionStatus.OFFLINE) } }
                .collect { status ->
                    _state.update { current ->
                        current.copy(
                            connection = status,
                            hasConnectedOnce = current.hasConnectedOnce || status == ConnectionStatus.CONNECTED,
                        )
                    }
                }
        }
    }

    // MARK: - Derived helpers

    fun isWorking(id: String): Boolean = _state.value.inFlight.contains(id)

    val connectionNotice: String?
        get() = when (_state.value.connection) {
            ConnectionStatus.CONNECTED -> null
            ConnectionStatus.OFFLINE -> "Offline. Changes are not reaching the backend."
            ConnectionStatus.CONNECTING ->
                if (_state.value.hasConnectedOnce) "Reconnecting…" else null
        }

    // MARK: - Composer

    fun updateDraft(title: String) = updateDraft { it.copy(title = title) }

    /** The planned day. Stored as the start of that local day, never a deadline. */
    fun setDraftDueAt(epochMillis: Long?) = setDraftPlannedOn(epochMillis)

    fun setDraftPlannedOn(epochMillis: Long?) = updateDraft { it.copy(plannedOn = epochMillis) }

    fun setDraftPlannedTime(minutes: Int?) = updateDraft {
        if (PlannedTimeMath.isValid(minutes)) it.copy(plannedTime = minutes) else it
    }

    fun setDraftNotes(notes: String?) = updateDraft { it.copy(notes = notes?.takeIf(String::isNotBlank)) }

    fun setDraftLocation(location: String?) =
        updateDraft { it.copy(location = location?.takeIf(String::isNotBlank)) }

    /** A deadline is its own instant and does not touch the planned day. */
    fun setDraftDeadlineAt(epochMillis: Long?) = updateDraft { it.copy(deadlineAt = epochMillis) }

    fun setDraftRemindAt(epochMillis: Long?) = updateDraft { it.copy(remindAt = epochMillis) }

    fun setDraftPriority(priority: Priority?) = updateDraft {
        it.copy(priority = priority, priorityRank = priority?.seedRank)
    }

    fun setDraftOverduePolicy(policy: OverduePolicy) = updateDraft {
        it.copy(overduePolicy = policy)
    }

    private fun updateDraft(transform: (TaskDraft) -> TaskDraft) {
        _state.update { it.copy(draft = transform(it.draft)) }
    }

    val draftValidationMessage: String?
        get() {
            val draft = _state.value.draft
            val title = draft.title.trim()
            return when {
                title.isNotEmpty() && title.length > TaskTitle.MAX_LENGTH ->
                    "Titles are limited to ${TaskTitle.MAX_LENGTH} characters."
                !PlannedTimeMath.isValid(draft.plannedTime) ->
                    "Time must be between 00:00 and 23:59."
                else -> null
            }
        }

    val canSubmitDraft: Boolean
        get() = !_state.value.isSaving && TaskTitle.isValid(_state.value.draft.title)

    /** Creates a task from the composer. Returns true when the draft was cleared. */
    suspend fun addTask(): Boolean {
        val validationMessage = draftValidationMessage
        if (validationMessage != null) {
            _state.update { it.copy(errorMessage = validationMessage) }
            return false
        }
        val draft = _state.value.draft
        val title = TaskTitle.normalize(draft.title) ?: return false
        if (_state.value.isSaving) return false

        _state.update { it.copy(isSaving = true) }
        try {
            backend.createTask(
                draft.copy(
                    title = title,
                    plannedOn = draft.plannedOn?.let { DueDateMath.startOfDay(it) },
                )
            )
            _state.update {
                it.copy(draft = TaskDraft(), errorMessage = null, isSaving = false)
            }
            return true
        } catch (error: Exception) {
            _state.update { it.copy(errorMessage = message(error), isSaving = false) }
            return false
        }
    }

    fun clearDraft() {
        _state.update { it.copy(draft = TaskDraft()) }
    }

    // MARK: - Opening and editing

    /**
     * Opening a row is an explicit open. `tasks:markSeen` runs first, and
     * `seenAt` is stamped only after it succeeds, so a failed open leaves the
     * row NEW and a later open tries again. Painting the list never calls it.
     */
    suspend fun openTask(task: TaskItem) {
        // The editor is a sheet, not a form inserted into the board column.
        _state.update { it.copy(presentedSheet = BoardSheet.EditTask(task.id)) }
        var opened = task
        if (task.seenAt == null) {
            try {
                backend.markSeen(task.id)
                val timestamp = now()
                opened = task.withSeen(timestamp)
                _state.update { current ->
                    current.copy(
                        tasks = current.tasks.map { if (it.id == task.id) opened else it },
                    )
                }
            } catch (error: Exception) {
                _state.update { it.copy(errorMessage = message(error)) }
            }
        }
        _state.update { it.copy(edit = TaskEdit(opened.id, TaskDraft.from(opened))) }
    }

    fun updateEditDraft(transform: (TaskDraft) -> TaskDraft) {
        _state.update { current ->
            val edit = current.edit ?: return@update current
            current.copy(edit = edit.copy(draft = transform(edit.draft)))
        }
    }

    fun closeEditor() {
        _state.update { it.copy(edit = null) }
    }

    val editValidationMessage: String?
        get() {
            val edit = _state.value.edit ?: return null
            val title = edit.draft.title.trim()
            return when {
                title.isEmpty() -> "A task needs a title."
                title.length > TaskTitle.MAX_LENGTH ->
                    "Titles are limited to ${TaskTitle.MAX_LENGTH} characters."
                !PlannedTimeMath.isValid(edit.draft.plannedTime) ->
                    "Time must be between 00:00 and 23:59."
                else -> null
            }
        }

    /** Saves the editor, optimistic and rolled back on failure. */
    suspend fun saveEdit(): Boolean {
        val edit = _state.value.edit ?: return false
        val validationMessage = editValidationMessage
        if (validationMessage != null) {
            _state.update { it.copy(errorMessage = validationMessage) }
            return false
        }
        if (edit.isSaving) return false
        val original = _state.value.tasks.firstOrNull { it.id == edit.taskId } ?: return false

        // The editor is seeded with a day that is already at the start of a
        // civil day. Re-normalizing it would slide it into the previous day in
        // any zone behind UTC, so keep it unless the user actually picked a
        // new day.
        // A blank date is not a clear. The mutation omits absent numbers, and
        // the server keeps the stored value. Notes and location do clear,
        // because an empty string is stored.
        val plannedOn = when {
            edit.draft.plannedOn == null -> original.plannedDay
            edit.draft.plannedOn == original.plannedDay -> original.plannedDay
            else -> DueDateMath.startOfDay(edit.draft.plannedOn)
        }
        val draft = edit.draft.copy(
            title = TaskTitle.normalize(edit.draft.title) ?: original.title,
            notes = edit.draft.notes ?: "",
            plannedOn = plannedOn,
            plannedTime = edit.draft.plannedTime ?: original.plannedTime,
            location = edit.draft.location ?: "",
            deadlineAt = edit.draft.deadlineAt ?: original.deadlineAt,
            remindAt = edit.draft.remindAt ?: original.remindAt,
            priority = edit.draft.priority ?: Priority.NORMAL,
        )
        val timestamp = now()

        _state.update { current ->
            current.copy(
                edit = edit.copy(isSaving = true),
                tasks = current.tasks.map {
                    if (it.id == edit.taskId) it.withDraft(draft, timestamp) else it
                },
            )
        }
        return try {
            backend.updateTask(edit.taskId, draft)
            _state.update { it.copy(edit = null, errorMessage = null) }
            true
        } catch (error: Exception) {
            restore(original)
            _state.update {
                it.copy(
                    edit = it.edit?.copy(isSaving = false),
                    errorMessage = message(error),
                )
            }
            false
        }
    }

    // MARK: - Mutations

    /** Calls the explicit setter; never sends a derived toggle to the backend. */
    suspend fun toggle(task: TaskItem) {
        setDone(task.id, !task.done)
    }

    suspend fun setDone(id: String, done: Boolean) {
        val original = _state.value.tasks.firstOrNull { it.id == id } ?: return
        if (isWorking(id)) return

        _state.update { current ->
            current.copy(
                inFlight = current.inFlight + id,
                tasks = current.tasks.map { if (it.id == id) it.withDone(done, now()) else it },
            )
        }
        try {
            backend.setTask(id, done)
            _state.update { it.copy(errorMessage = null) }
        } catch (error: Exception) {
            restore(original)
            _state.update { it.copy(errorMessage = message(error)) }
        } finally {
            _state.update { it.copy(inFlight = it.inFlight - id) }
        }
    }

    /** Delete is the existing remove mutation. There is no trash screen. */
    suspend fun delete(task: TaskItem) {
        if (isWorking(task.id)) return
        val index = _state.value.tasks.indexOfFirst { it.id == task.id }

        _state.update { current ->
            current.copy(
                inFlight = current.inFlight + task.id,
                tasks = current.tasks.filterNot { it.id == task.id },
            )
        }
        try {
            backend.deleteTask(task.id)
            _state.update { it.copy(errorMessage = null) }
        } catch (error: Exception) {
            _state.update { current ->
                val restored = current.tasks.toMutableList()
                restored.add(index.coerceAtMost(restored.size), task)
                current.copy(tasks = restored, errorMessage = message(error))
            }
        } finally {
            _state.update { it.copy(inFlight = it.inFlight - task.id) }
        }
    }

    // MARK: - Sheets

    /**
     * The bottom plus opens the task sheet. It never inserts a form into the
     * column. A time-bound slice still prefills that slice's first day, as the
     * old quick-add did.
     */
    fun beginTask() {
        _state.update { current ->
            val day = when (current.selectedSlice) {
                TaskSlice.TASKS -> null
                else -> DueDateMath.startOfDay(now())
            }
            current.copy(
                draft = current.draft.copy(plannedOn = day),
                composerFocusRequest = current.composerFocusRequest + 1,
                presentedSheet = BoardSheet.CreateTask,
            )
        }
    }

    fun present(sheet: BoardSheet) {
        _state.update { it.copy(presentedSheet = sheet) }
    }

    fun dismissSheet() {
        _state.update { current ->
            current.copy(
                presentedSheet = null,
                edit = if (current.presentedSheet is BoardSheet.EditTask) null else current.edit,
            )
        }
    }

    /** The grid button covers the whole screen with tiles, never a side rail. */
    fun openDashboard() {
        _state.update { it.copy(showsDashboard = true, presentedSheet = null) }
    }

    fun closeDashboard() {
        _state.update { it.copy(showsDashboard = false) }
    }

    /** Picking a tile selects that view and closes the cover. */
    fun selectDashboardTile(tile: DashboardTile) {
        if (tile.isAddTile) {
            _state.update {
                it.copy(showsDashboard = false, presentedSheet = BoardSheet.Category(null))
            }
            return
        }
        _state.update { it.copy(selectedViewId = tile.id, showsDashboard = false) }
    }

    /**
     * Creates a task from the full sheet. Look, series and cadence are explicit
     * choices; when a series is selected, only the first occurrence is minted
     * here and the backend owns the rest.
     */
    suspend fun createTaskFromSheet(draft: TaskDraft): Boolean {
        val title = TaskTitle.normalize(draft.title) ?: return false
        if (_state.value.isSaving) return false

        _state.update { it.copy(isSaving = true) }
        return try {
            backend.createTask(
                draft.copy(
                    title = title,
                    plannedOn = draft.plannedOn?.let { DueDateMath.startOfDay(it) },
                ),
            )
            _state.update { it.copy(isSaving = false, errorMessage = null) }
            true
        } catch (error: Exception) {
            _state.update { it.copy(isSaving = false, errorMessage = message(error)) }
            false
        }
    }

    /** Creates the first occurrence of a series from the sheet. */
    suspend fun createSeriesTask(draft: TaskDraft): Boolean {
        val title = TaskTitle.normalize(draft.title) ?: return false
        if (draft.series == SeriesBehavior.NONE || _state.value.isSaving) return false

        val day = draft.plannedOn?.let { DueDateMath.startOfDay(it) }
            ?: composerPlannedDay()
            ?: DueDateMath.startOfDay(now())
        _state.update { it.copy(isSaving = true) }
        return try {
            backend.createRecurrence(title, draft.series.wire, draft.cadence.wire, day)
            _state.update { it.copy(isSaving = false, errorMessage = null) }
            true
        } catch (error: Exception) {
            _state.update { it.copy(isSaving = false, errorMessage = message(error)) }
            false
        }
    }

    /**
     * Saves a locally authored entity. Categories and views also land on the
     * dashboard so the sheet flow is visible end to end. Unknown icons and
     * colors fall back instead of crashing the board.
     */
    fun saveEntity(
        kind: BoardEntityKind,
        title: String,
        icon: String,
        color: String,
    ): Boolean {
        val trimmed = title.trim()
        if (trimmed.isEmpty()) return false
        entitySequence += 1
        val entity = BoardEntity(
            id = "entity-$entitySequence",
            kind = kind,
            title = trimmed,
            icon = Appearance.icon(icon),
            color = Appearance.color(color),
        )
        _state.update { current ->
            val nextViews =
                if (kind == BoardEntityKind.CATEGORY || kind == BoardEntityKind.VIEW) {
                    current.views + TaskView(
                        id = "view-${entity.id}",
                        title = trimmed,
                        icon = entity.icon,
                        color = entity.color,
                        kind = if (kind == BoardEntityKind.CATEGORY) {
                            TaskViewKind.TEMPLATE
                        } else {
                            TaskViewKind.CUSTOM
                        },
                    )
                } else {
                    current.views
                }
            current.copy(
                sheetEntities = current.sheetEntities + entity,
                views = nextViews,
                presentedSheet = null,
            )
        }
        return true
    }

    private var entitySequence = 0

    // MARK: - Views

    /** Selects the built-in Home view. */
    fun selectHome() = selectView(TaskView.HOME.id)

    fun selectView(viewId: String) {
        _state.update { it.copy(selectedViewId = viewId, showsDashboard = false) }
    }

    /** Selects a time slice for the main column. */
    fun selectSlice(slice: TaskSlice) {
        _state.update { it.copy(selectedSlice = slice) }
    }

    /** Installs a catalog template as a dashboard tile. */
    fun installTemplate(template: TaskTemplate) {
        val view =
            TaskView(
                id = "view-${template.slug}",
                title = template.name,
                icon = TaskIcons.resolve(template.icon),
                color = TaskColors.resolve(template.color),
                kind = TaskViewKind.TEMPLATE,
            )
        _state.update { current ->
            val views = if (current.views.any { it.id == view.id }) current.views else current.views + view
            current.copy(views = views, selectedViewId = view.id, presentedSheet = null)
        }
    }

    /** Creates a custom view from a sheet's title, icon and color. */
    fun createCustomView(title: String, icon: String, color: String): TaskView {
        val trimmed = title.trim()
        val view =
            TaskView(
                id = "view-${trimmed.replace(Regex("[^a-z0-9]+"), "-").trim('-').lowercase()}-custom",
                title = trimmed,
                icon = Appearance.icon(icon),
                color = Appearance.color(color),
                kind = TaskViewKind.CUSTOM,
            )
        _state.update { current ->
            val views = if (current.views.any { it.id == view.id }) current.views else current.views + view
            current.copy(views = views, selectedViewId = view.id, presentedSheet = null)
        }
        return view
    }

    /** Marks an alert read; reading clears it from the band and keeps it in the log. */
    fun markAlertRead(alertId: String) {
        _state.update { current ->
            current.copy(alerts = current.alerts.map { if (it.id == alertId) it.copy(seenAt = now()) else it })
        }
    }

    /** Records an answer; the question leaves the open band. */
    fun answerQuestion(questionId: String, optionId: String) {
        _state.update { current ->
            current.copy(
                questions = current.questions.map { question ->
                    if (question.id == questionId) question.copy(answeredAt = now()) else question
                },
            )
        }
    }

    /** Pins a row to the top of the current view. A pin changes no priority or date. */
    fun pinTask(taskId: String) {
        _state.update { it.copy(pinnedTaskIds = it.pinnedTaskIds + taskId) }
    }

    /** Removes a pin. */
    fun unpinTask(taskId: String) {
        _state.update { it.copy(pinnedTaskIds = it.pinnedTaskIds - taskId) }
    }

    // MARK: - Slices

    fun tasksForSlice(slice: TaskSlice, now: Long = now()): List<TaskItem> =
        TaskSlices.tasksFor(_state.value.tasks, slice, now)

    fun tasksForCurrentSlice(now: Long = now()): List<TaskItem> = tasksForSlice(_state.value.selectedSlice, now)

    /**
     * The planned day a create in the current slice lands on. A time-bound slice
     * composes into its own day; the open Tasks view filters by nothing.
     */
    fun composerPlannedDay(slice: TaskSlice = _state.value.selectedSlice, now: Long = now()): Long? =
        when (slice) {
            TaskSlice.TASKS -> null
            TaskSlice.DAILY, TaskSlice.WEEKLY, TaskSlice.MONTHLY -> DueDateMath.startOfDay(now)
        }

    /** Composes a task in the current slice, prefilling the slice's day. */
    suspend fun addTaskInCurrentSlice(): Boolean {
        val day = composerPlannedDay()
        if (day != null && _state.value.draft.plannedOn == null) {
            _state.update { it.copy(draft = it.draft.copy(plannedOn = day)) }
        }
        return addTask()
    }

    fun dismissError() {
        _state.update { it.copy(errorMessage = null) }
    }

    private fun restore(task: TaskItem) {
        _state.update { current ->
            current.copy(
                tasks = current.tasks.map { item -> if (item.id == task.id) task else item }
            )
        }
    }

    private fun message(error: Throwable): String =
        error.message?.takeIf { it.isNotBlank() } ?: "Something went wrong."
}
