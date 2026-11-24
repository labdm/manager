package dev.labdm.manager.kit

/**
 * One task, as every client sees it.
 *
 * Mirrors `TaskView` in `packages/backend/convex/lib/taskService.ts`. The
 * backend owns ordering, `effectiveRank` and `overdue`; this type only carries
 * data so the UI can group it for the current day. Every number arrives as
 * epoch milliseconds decoded from Convex's tagged `$float` format by
 * `managerdata`, except `plannedTime`, which is minutes from midnight.
 *
 * Optional fields stay optional: an older deployment, or a row written before
 * M1, simply omits them.
 */
data class TaskItem(
    val id: String,
    val title: String,
    val done: Boolean,
    /** Legacy read/write alias of the planned day. Never a deadline. */
    val dueAt: Long? = null,
    val notes: String? = null,
    /** Civil day: epoch ms at the local start of that day. */
    val plannedOn: Long? = null,
    /** Minutes from midnight, 0–1439, only when there is a clock time. */
    val plannedTime: Int? = null,
    val location: String? = null,
    /** The instant the overdue policy runs. Never the planned day. */
    val deadlineAt: Long? = null,
    val remindAt: Long? = null,
    val priority: Priority? = null,
    val priorityRank: Int? = null,
    val effectiveRank: Int? = null,
    val overdue: Boolean = false,
    val overduePolicy: OverduePolicy = OverduePolicy.NONE,
    val outcome: TaskOutcome? = null,
    val origin: TaskOrigin? = null,
    /** When the viewer opened the row. Absent plus an agent origin means NEW. */
    val seenAt: Long? = null,
    val completedAt: Long? = null,
    /** The series this occurrence belongs to, when it repeats. */
    val recurrenceId: String? = null,
    /** The civil day this occurrence covers. Start of a local day, like `plannedOn`. */
    val periodStart: Long? = null,
    /** How the series treats its open occurrences. Absent on one-off tasks. */
    val behavior: TaskBehavior? = null,
) {
    /** The planned day is one fact with two wire names. */
    val plannedDay: Long?
        get() = plannedOn ?: dueAt

    val isNew: Boolean
        get() = TaskFacts.isNew(origin, seenAt)

    fun withDone(done: Boolean, now: Long = System.currentTimeMillis()): TaskItem = copy(
        done = done,
        completedAt = if (done) (completedAt ?: now) else null,
        overdue = TaskFacts.isOverdue(deadlineAt, done, now),
        effectiveRank = TaskFacts.effectiveRank(
            priority = priority,
            priorityRank = priorityRank,
            overdue = TaskFacts.isOverdue(deadlineAt, done, now),
            overduePolicy = overduePolicy,
        ),
    )

    fun withSeen(now: Long): TaskItem = copy(seenAt = now)

    /** Marks the occurrence terminal for its series: superseded or missed. */
    fun withOutcome(outcome: TaskOutcome?, now: Long = System.currentTimeMillis()): TaskItem = copy(
        outcome = outcome,
        overdue = TaskFacts.isOverdue(deadlineAt, done, now),
        effectiveRank = TaskFacts.effectiveRank(
            priority = priority,
            priorityRank = priorityRank,
            overdue = TaskFacts.isOverdue(deadlineAt, done, now),
            overduePolicy = overduePolicy,
        ),
    )

    /** Applies an edited draft locally. `deadlineAt` never writes the planned day. */
    fun withDraft(draft: TaskDraft, now: Long = System.currentTimeMillis()): TaskItem {
        val facts = draft.withSeedRank()
        val plannedOn = facts.plannedOn
        val overdue = TaskFacts.isOverdue(facts.deadlineAt, done, now)
        return copy(
            title = TaskTitle.normalize(facts.title) ?: title,
            notes = facts.notes,
            plannedOn = plannedOn,
            dueAt = plannedOn,
            plannedTime = facts.plannedTime,
            location = facts.location,
            deadlineAt = facts.deadlineAt,
            remindAt = facts.remindAt,
            priority = facts.priority,
            priorityRank = facts.priorityRank,
            overdue = overdue,
            effectiveRank = TaskFacts.effectiveRank(
                priority = facts.priority,
                priorityRank = facts.priorityRank,
                overdue = overdue,
                overduePolicy = facts.overduePolicy,
            ),
            overduePolicy = facts.overduePolicy,
        )
    }
}
