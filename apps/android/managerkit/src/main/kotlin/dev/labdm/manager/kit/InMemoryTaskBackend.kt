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

    /** What the sheets asked for, recorded so the state machine can be tested. */
    val createdDrafts = mutableListOf<TaskDraft>()
    val createdLooks = mutableListOf<TaskLook>()
    val createdSeries = mutableListOf<SeriesBehavior>()
    val createdCadences = mutableListOf<SeriesCadence>()
    val recurrenceCadences = mutableListOf<String>()

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
     * Reconciles open recurrence series for the current civil day.
     *
     * The idempotency key is `(recurrenceId, periodStart)` compared at day start
     * and covering every row in the series, including done and superseded ones.
     * A `replace` series supersedes older open periods and keeps only the current
     * one; a `stack` series mints a row for every period since the oldest one and
     * leaves older rows open. Minting is idempotent, so a second reconcile does
     * nothing.
     */
    fun reconcile(nowMillis: Long = now()) {
        val today = DueDateMath.startOfDay(nowMillis)

        fun storedItems(): List<TaskItem> =
            store.value.filter { it.deletedAt == null }.map { it.item }

        fun periodOf(item: TaskItem): Long? = item.periodStart?.let { DueDateMath.startOfDay(it) }

        fun supersede(item: TaskItem) {
            store.value = store.value.map { entry ->
                if (entry.item.id == item.id) {
                    entry.copy(item = item.withOutcome(TaskOutcome.SUPERSEDED, nowMillis))
                } else {
                    entry
                }
            }
        }

        fun mint(template: TaskItem, recurrenceId: String, behavior: TaskBehavior, cadence: SeriesCadence, day: Long) {
            nextId += 1
            val minted = template.copy(
                id = "local-$nextId",
                recurrenceId = recurrenceId,
                periodStart = day,
                behavior = behavior,
                series = SeriesBehavior.fromWire(behavior.wire),
                cadence = cadence,
                outcome = null,
                done = false,
                dueAt = day,
                plannedOn = day,
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
        }

        val groups =
            storedItems()
                .filter { it.recurrenceId != null && it.behavior != null }
                .groupBy { it.recurrenceId!! }

        groups.forEach { (recurrenceId, occurrences) ->
            val behavior = occurrences.first().behavior!!
            val cadence = occurrences.first().cadence
            val template = occurrences.first()
            val existingDays = occurrences.mapNotNull(::periodOf).toSet()

            when (behavior) {
                TaskBehavior.REPLACE -> {
                    val currentPeriod = currentPeriod(cadence, today, existingDays.minOrNull())
                    // A period that ended leaves the open board, but stays stored.
                    occurrences
                        .filter { TaskFacts.isOpen(it) }
                        .filter { period -> periodOf(period)?.let { it < currentPeriod } == true }
                        .forEach(::supersede)

                    // Several open rows on the current period cannot both stay.
                    val currentOpen =
                        storedItems()
                            .filter { it.recurrenceId == recurrenceId && TaskFacts.isOpen(it) }
                            .filter { periodOf(it) == currentPeriod }
                    currentOpen.drop(1).forEach(::supersede)

                    if (currentPeriod !in existingDays) {
                        mint(template, recurrenceId, behavior, cadence, currentPeriod)
                    }
                }

                TaskBehavior.STACK -> {
                    var day = existingDays.minOrNull() ?: return@forEach
                    var guard = 0
                    while (day <= today && guard < 10_000) {
                        if (day !in existingDays) {
                            mint(template, recurrenceId, behavior, cadence, day)
                        }
                        val next = nextPeriod(day, cadence)
                        if (next == null || next <= day) break
                        day = next
                        guard += 1
                    }
                }
            }
        }
    }

    /** Start of the period containing [today], counted from the series anchor. */
    private fun currentPeriod(cadence: SeriesCadence, today: Long, anchor: Long?): Long =
        when (cadence) {
            SeriesCadence.DAILY -> today
            SeriesCadence.WEEKLY -> DueDateMath.weekStart(today)
            SeriesCadence.MONTHLY -> DueDateMath.monthStart(today)
            SeriesCadence.EVERY_14_DAYS -> {
                var day = anchor ?: return today
                var guard = 0
                while (guard < 10_000) {
                    val next = addDays(day, 14)
                    if (next > today) break
                    day = next
                    guard += 1
                }
                DueDateMath.startOfDay(day)
            }
        }

    private fun nextPeriod(day: Long, cadence: SeriesCadence): Long? =
        when (cadence) {
            SeriesCadence.DAILY -> addDays(day, 1)
            SeriesCadence.WEEKLY -> addDays(day, 7)
            SeriesCadence.MONTHLY -> addMonths(day, 1)
            SeriesCadence.EVERY_14_DAYS -> addDays(day, 14)
        }

    private fun addDays(epochMillis: Long, count: Int): Long =
        Calendar.getInstance(TimeZone.getDefault()).apply { timeInMillis = epochMillis }.apply {
            add(Calendar.DAY_OF_MONTH, count)
        }.timeInMillis

    private fun addMonths(epochMillis: Long, count: Int): Long =
        Calendar.getInstance(TimeZone.getDefault()).apply { timeInMillis = epochMillis }.apply {
            add(Calendar.MONTH, count)
        }.timeInMillis

    override suspend fun createTask(title: String, dueAt: Long?) {
        createTask(TaskDraft(title = title, plannedOn = dueAt))
    }

    override suspend fun createTask(draft: TaskDraft) {
        val timestamp = now()
        val plannedOn = draft.plannedOn
        createdDrafts += draft
        createdLooks += draft.look
        createdSeries += draft.series
        createdCadences += draft.cadence
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
            behavior = draft.behavior ?: draft.series.takeIf { it != SeriesBehavior.NONE }?.let {
                TaskBehavior.fromWire(it.wire)
            },
            look = draft.look,
            series = draft.series,
            cadence = draft.cadence,
            // A row you typed is yours and already seen, so it is never NEW.
            origin = TaskOrigin.SELF,
            seenAt = timestamp,
        )
        store.value = listOf(Stored(item, deletedAt = null)) + store.value
    }

    /** Seeds the first occurrence of a series and reconciles it on its anchor day. */
    override suspend fun createRecurrence(
        title: String,
        behavior: String,
        cadence: String,
        periodStart: Long,
    ) {
        val timestamp = now()
        val day = DueDateMath.startOfDay(periodStart)
        val behaviorValue = TaskBehavior.fromWire(behavior)
        val cadenceValue = SeriesCadence.fromWire(cadence)
        nextId += 1
        val item = TaskItem(
            id = "local-$nextId",
            title = TaskTitle.normalize(title) ?: title.trim(),
            done = false,
            dueAt = day,
            plannedOn = day,
            recurrenceId = "local-rec-$nextId",
            periodStart = day,
            behavior = behaviorValue,
            series = SeriesBehavior.fromWire(behavior),
            cadence = cadenceValue,
            origin = TaskOrigin.SELF,
            seenAt = timestamp,
        )
        store.value = listOf(Stored(item, deletedAt = null)) + store.value
        recurrenceCadences += cadence
        reconcile(day)
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
