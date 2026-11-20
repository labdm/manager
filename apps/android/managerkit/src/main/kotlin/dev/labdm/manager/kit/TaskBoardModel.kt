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

data class BoardState(
    val tasks: List<TaskItem> = emptyList(),
    val phase: BoardPhase = BoardPhase.Idle,
    val connection: ConnectionStatus = ConnectionStatus.CONNECTING,
    val hasConnectedOnce: Boolean = false,
    val inFlight: Set<String> = emptySet(),
    val errorMessage: String? = null,
    val isSaving: Boolean = false,
    val draftTitle: String = "",
    val draftDueAt: Long? = null,
)

/**
 * Presentation state for the task board.
 *
 * Owns the live list, composer draft and optimistic mutations. No Convex or
 * Clerk imports: the whole state machine is unit tested against an in-memory
 * backend, mirroring Swift's `TaskBoardModel`.
 */
class TaskBoardModel(
    private val backend: TaskBackend,
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
        val draft = _state.value.draftTitle to _state.value.draftDueAt
        stop()
        _state.update { it.copy(draftTitle = draft.first, draftDueAt = draft.second) }
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

    fun updateDraft(title: String) {
        _state.update { it.copy(draftTitle = title) }
    }

    fun setDraftDueAt(epochMillis: Long?) {
        _state.update { it.copy(draftDueAt = epochMillis) }
    }

    val draftValidationMessage: String?
        get() {
            val title = _state.value.draftTitle.trim()
            return if (title.isNotEmpty() && title.length > TaskTitle.MAX_LENGTH) {
                "Titles are limited to ${TaskTitle.MAX_LENGTH} characters."
            } else {
                null
            }
        }

    val canSubmitDraft: Boolean
        get() = !_state.value.isSaving && TaskTitle.isValid(_state.value.draftTitle)

    /** Creates a task from the composer. Returns true when the draft was cleared. */
    suspend fun addTask(): Boolean {
        val validationMessage = draftValidationMessage
        if (validationMessage != null) {
            _state.update { it.copy(errorMessage = validationMessage) }
            return false
        }
        val title = TaskTitle.normalize(_state.value.draftTitle) ?: return false
        if (_state.value.isSaving) return false

        _state.update { it.copy(isSaving = true) }
        try {
            val dueAt = _state.value.draftDueAt?.let { DueDateMath.startOfDay(it) }
            backend.createTask(title, dueAt)
            _state.update {
                it.copy(draftTitle = "", draftDueAt = null, errorMessage = null, isSaving = false)
            }
            return true
        } catch (error: Exception) {
            _state.update { it.copy(errorMessage = message(error), isSaving = false) }
            return false
        }
    }

    fun clearDraft() {
        _state.update { it.copy(draftTitle = "", draftDueAt = null) }
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
                tasks = current.tasks.map { if (it.id == id) it.withDone(done) else it },
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
