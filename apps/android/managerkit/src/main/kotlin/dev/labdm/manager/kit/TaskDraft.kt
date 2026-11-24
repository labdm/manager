package dev.labdm.manager.kit

/**
 * Everything the create field and the editor can set.
 *
 * The planned day and `dueAt` are the same fact here: [plannedOn] is written to
 * both wire names. [deadlineAt] is a separate instant and never touches the
 * planned day. [plannedTime] is minutes from midnight on that day, not an
 * epoch, so a time cannot silently become a different day.
 */
data class TaskDraft(
    val title: String = "",
    val notes: String? = null,
    val plannedOn: Long? = null,
    val plannedTime: Int? = null,
    val location: String? = null,
    val deadlineAt: Long? = null,
    val remindAt: Long? = null,
    val priority: Priority? = null,
    val priorityRank: Int? = null,
    val overduePolicy: OverduePolicy = OverduePolicy.NONE,
    val recurrenceId: String? = null,
    val periodStart: Long? = null,
    val behavior: TaskBehavior? = null,
) {
    /** Omitted priority and rank are `normal` / 10, never blank. */
    val resolvedPriority: Priority
        get() = priority ?: Priority.NORMAL

    val resolvedPriorityRank: Int
        get() = priorityRank ?: resolvedPriority.seedRank ?: Priority.NORMAL.seedRank!!

    /**
     * A seed priority carries a known order. An editor can change just the
     * priority string, so fill the rank when it was left out. Custom strings
     * have no seed rank and stay without one.
     */
    fun withSeedRank(): TaskDraft =
        if (priorityRank == null && priority?.seedRank != null) {
            copy(priorityRank = priority.seedRank)
        } else {
            this
        }

    companion object {
        /** Builds a draft from the facts already on a row, for the editor. */
        fun from(task: TaskItem): TaskDraft = TaskDraft(
            title = task.title,
            notes = task.notes,
            plannedOn = task.plannedDay,
            plannedTime = task.plannedTime,
            location = task.location,
            deadlineAt = task.deadlineAt,
            remindAt = task.remindAt,
            priority = task.priority,
            priorityRank = task.priorityRank,
            overduePolicy = task.overduePolicy,
            recurrenceId = task.recurrenceId,
            periodStart = task.periodStart,
            behavior = task.behavior,
        )
    }
}

/** Clock helpers for [TaskDraft.plannedTime]. */
object PlannedTimeMath {
    const val MIN_MINUTES = 0
    const val MAX_MINUTES = 1439

    fun isValid(minutes: Int?): Boolean =
        minutes == null || minutes in MIN_MINUTES..MAX_MINUTES

    /** `null` clears the stored time. Out-of-range input is rejected, not clamped. */
    fun normalize(minutes: Int?): Int? {
        require(isValid(minutes)) { "plannedTime must be $MIN_MINUTES–$MAX_MINUTES" }
        return minutes
    }

    /** Minutes since local midnight for [epochMillis]. */
    fun minutesOf(epochMillis: Long, timeZone: java.util.TimeZone = java.util.TimeZone.getDefault()): Int {
        val calendar = java.util.Calendar.getInstance(timeZone).apply { time = java.util.Date(epochMillis) }
        return calendar.get(java.util.Calendar.HOUR_OF_DAY) * 60 +
            calendar.get(java.util.Calendar.MINUTE)
    }

    /** Combines a civil day with minutes from midnight, in the local zone. */
    fun instantOn(
        dayStartMillis: Long,
        minutes: Int,
        timeZone: java.util.TimeZone = java.util.TimeZone.getDefault(),
    ): Long {
        val calendar = java.util.Calendar.getInstance(timeZone).apply {
            time = java.util.Date(dayStartMillis)
            set(java.util.Calendar.HOUR_OF_DAY, minutes / 60)
            set(java.util.Calendar.MINUTE, minutes % 60)
            set(java.util.Calendar.SECOND, 0)
            set(java.util.Calendar.MILLISECOND, 0)
        }
        return calendar.timeInMillis
    }

    /** `09:30` in the given locale. */
    fun label(minutes: Int, locale: java.util.Locale = java.util.Locale.getDefault()): String =
        String.format(locale, "%02d:%02d", minutes / 60, minutes % 60)
}
