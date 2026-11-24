package dev.labdm.manager.kit

import java.util.Calendar
import java.util.TimeZone
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.map

/**
 * Backend for previews and unit tests. No Convex or Clerk imports.
 *
 * It mirrors the server's M1 rules where the board depends on them: delete
 * soft-hides a row exactly as `tasks:list` will, a create from the app is
 * `self` with `seenAt` set, and [markSeen] stamps a previously unseen agent row.
 * It also owns the M2 recurrence preview: a `replace` series keeps one open row
 * while a `stack` series keeps every period open, both through [reconcile].
 */
class InMemoryTaskBackend(
    initial: List<TaskItem> = emptyList(),
    private val now: () -> Long = System::currentTimeMillis,
) : TaskBackend {

    private data class Stored(val item: TaskItem, val deletedAt: Long?)

    private val store = MutableStateFlow(initial.map { Stored(it, deletedAt = null) })
    private val connection = MutableStateFlow(ConnectionStatus.CONNECTED)
    private var nextId = initial.size

    /** Rows the list shows: open rows plus done rows, minus soft-deleted ones. */
    val allTasks: List<TaskItem>
        get() = store.value.filter { isListable(it) }.map { it.item }

    /** Soft-deleted rows. The real list hides them and no screen shows them. */
    val trashedTasks: List<TaskItem>
        get() = store.value.filter { it.deletedAt != null }.map { it.item }

    /** Every row the backend still holds, including the ones the board hides. */
    val storedTasks: List<TaskItem>
        get() = store.value.filter { it.deletedAt == null }.map { it.item }

    override suspend fun ensureUser() = Unit

    override fun taskUpdates(): Flow<List<TaskItem>> =
        store.map { stored -> stored.filter { isListable(it) }.map { it.item } }

    override fun connectionUpdates(): Flow<ConnectionStatus> = connection.asStateFlow()

    /**
     * Reconciles open recurrence series. A `replace` series supersedes the open
     * occurrence of a period that has ended and mints the next open one; a `stack`
     * series mints an open occurrence for every period since its last open one and
     * leaves the older periods open. Minting is idempotent on
     * `(recurrenceId, periodStart)`, so a second reconcile does not duplicate.
     */
    fun reconcile(nowMillis: Long = now()) {
        val currentPeriod = DueDateMath.startOfDay(nowMillis)

        fun openRows(): List<TaskItem> =
            store.value
                .filter { it.deletedAt == null }
                .map { it.item }
                .filter { TaskFacts.isOpen(it) }

        val series =
            store.value
                .filter { it.deletedAt == null }
                .map { it.item }
                .filter { it.behavior != null && it.recurrenceId != null }
                .groupBy { it.recurrenceId!! }

        series.forEach { (recurrenceId, occurrences) ->
            val behavior = occurrences.first().behavior!!
            val open = openRows().filter { it.recurrenceId == recurrenceId }

            if (behavior == TaskBehavior.REPLACE) {
                // At most one open occurrence: the period that ended is superseded.
                open
                    .filter { it.periodStart != null && it.periodStart < currentPeriod }
                    .forEach { task ->
                        store.value = store.value.map {
                            if (it.item.id == task.id) it.copy(item = task.withOutcome(TaskOutcome.SUPERSEDED, nowMillis)) else it
                        }
                    }
            }

            // Re-read the open rows after retiring, so a retired row is no longer open.
            val openNow = openRows().filter { it.recurrenceId == recurrenceId }
            val currentOpen = openNow.filter { it.periodStart == currentPeriod }
            if (currentOpen.isNotEmpty()) return@forEach

            val template =
                openNow.maxByOrNull { it.periodStart ?: 0L }
                    ?: open.maxByOrNull { it.periodStart ?: 0L }
                    ?: return@forEach
            val firstPeriod =
                if (behavior == TaskBehavior.STACK) {
                    // Stack keeps every period open, so fill the gaps since the last one.
                    (openNow.maxByOrNull { it.periodStart ?: 0L }?.periodStart ?: currentPeriod) + 86_400_000L
                } else {
                    currentPeriod
                }
            var period = firstPeriod
            while (period <= currentPeriod) {
                nextId += 1
                val minted = template.copy(
                    id = "local-$nextId",
                    recurrenceId = recurrenceId,
                    periodStart = period,
                    behavior = template.behavior,
                    outcome = null,
                    done = false,
                    dueAt = period,
                    plannedOn = period,
                    deadlineAt = null,
                    remindAt = template.remindAt,
                    notes = template.notes,
                    plannedTime = template.plannedTime,
                    location = template.location,
                    priority = template.priority,
                    priorityRank = template.priorityRank,
                    overduePolicy = template.overduePolicy,
                    origin = TaskOrigin.SELF,
                    seenAt = nowMillis,
                )
                store.value = listOf(Stored(minted, deletedAt = null)) + store.value
                period = nextDayStart(period)
            }
        }
    }

    private fun nextDayStart(epochMillis: Long): Long =
        Calendar.getInstance(TimeZone.getDefault()).apply { timeInMillis = epochMillis }.apply {
            add(Calendar.DAY_OF_MONTH, 1)
        }.timeInMillis

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
            recurrenceId = draft.recurrenceId,
            periodStart = draft.periodStart,
            behavior = draft.behavior,
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

    /** Trash hides a row; a done row is listable for the Done tab; a superseded or missed row left the open board. */
    private fun isListable(stored: Stored): Boolean {
        if (stored.deletedAt != null) return false
        val task = stored.item
        if (task.done) return true
        if (task.outcome != null) return false
        return true
    }
}
