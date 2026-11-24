package dev.labdm.manager.kit

import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.map

/**
 * Backend for previews and unit tests. No Convex or Clerk imports.
 *
 * It mirrors the server's M1 rules where the board depends on them: delete
 * soft-hides a row exactly as `tasks:list` will, a create from the app is
 * `self` with `seenAt` set, and [markSeen] stamps a previously unseen
 * agent row.
 */
class InMemoryTaskBackend(
    initial: List<TaskItem> = emptyList(),
    private val now: () -> Long = System::currentTimeMillis,
) : TaskBackend {

    private data class Stored(val item: TaskItem, val deletedAt: Long?)

    private val store = MutableStateFlow(initial.map { Stored(it, deletedAt = null) })
    private val connection = MutableStateFlow(ConnectionStatus.CONNECTED)
    private var nextId = initial.size

    /** Rows the list shows: everything not soft-deleted. */
    val allTasks: List<TaskItem>
        get() = store.value.filter { it.deletedAt == null }.map { it.item }

    /** Soft-deleted rows. The real list hides them and no screen shows them. */
    val trashedTasks: List<TaskItem>
        get() = store.value.filter { it.deletedAt != null }.map { it.item }

    override suspend fun ensureUser() = Unit

    override fun taskUpdates(): Flow<List<TaskItem>> =
        store.map { stored -> stored.filter { it.deletedAt == null }.map { it.item } }

    override fun connectionUpdates(): Flow<ConnectionStatus> = connection.asStateFlow()

    override suspend fun createTask(title: String, dueAt: Long?) {
        createTask(TaskDraft(title = title, plannedOn = dueAt))
    }

    override suspend fun createTask(draft: TaskDraft) {
        val timestamp = now()
        val plannedOn = draft.plannedOn
        nextId += 1
        val item = TaskItem(
            id = "local-$nextId",
            title = TaskTitle.normalize(draft.title) ?: draft.title.trim(),
            done = false,
            // The planned day is one fact under two wire names.
            dueAt = plannedOn,
            notes = draft.notes,
            plannedOn = plannedOn,
            plannedTime = draft.plannedTime,
            location = draft.location,
            deadlineAt = draft.deadlineAt,
            remindAt = draft.remindAt,
            priority = draft.resolvedPriority,
            priorityRank = draft.resolvedPriorityRank,
            effectiveRank = draft.resolvedPriorityRank,
            overdue = false,
            overduePolicy = draft.overduePolicy,
            // A row you typed is yours and already seen, so it is never NEW.
            origin = TaskOrigin.SELF,
            seenAt = timestamp,
        )
        store.value = listOf(Stored(item, deletedAt = null)) + store.value
    }

    override suspend fun setTask(id: String, done: Boolean) {
        val timestamp = now()
        store.value = store.value.map {
            if (it.item.id == id) it.copy(item = it.item.withDone(done, timestamp)) else it
        }
    }

    override suspend fun markSeen(id: String) {
        val timestamp = now()
        store.value = store.value.map {
            val item = it.item
            if (item.id == id && item.seenAt == null) {
                it.copy(item = item.withSeen(timestamp))
            } else {
                it
            }
        }
    }

    override suspend fun updateTask(id: String, draft: TaskDraft) {
        val timestamp = now()
        store.value = store.value.map {
            if (it.item.id != id) {
                it
            } else {
                // Match tasks.update: an absent number is left alone. An empty
                // string clears notes and location. A missing priority is normal.
                val previous = it.item
                val kept = draft.copy(
                    notes = draft.notes ?: "",
                    plannedOn = draft.plannedOn ?: previous.plannedDay,
                    plannedTime = draft.plannedTime ?: previous.plannedTime,
                    location = draft.location ?: "",
                    deadlineAt = draft.deadlineAt ?: previous.deadlineAt,
                    remindAt = draft.remindAt ?: previous.remindAt,
                    priority = draft.priority ?: Priority.NORMAL,
                )
                it.copy(item = previous.withDraft(kept, timestamp))
            }
        }
    }

    /** Soft delete: the row stays stored but leaves the list, like the server. */
    override suspend fun deleteTask(id: String) {
        val timestamp = now()
        store.value = store.value.map {
            if (it.item.id == id && it.deletedAt == null) it.copy(deletedAt = timestamp) else it
        }
    }
}
