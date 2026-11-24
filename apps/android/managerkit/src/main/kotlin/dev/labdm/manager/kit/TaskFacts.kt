package dev.labdm.manager.kit

/**
 * Priority is a string plus a numeric order, not a closed enum.
 *
 * Seeds are `low` 0, `normal` 10, `high` 20, `urgent` 30. A row written by an
 * agent may carry a string outside that set; it stays put and still shows
 * overdue. Unknown values therefore never collapse into a seed.
 */
@JvmInline
value class Priority(val wire: String) {
    val seedRank: Int?
        get() = when (this) {
            LOW -> 0
            NORMAL -> 10
            HIGH -> 20
            URGENT -> 30
            else -> null
        }

    val isSeed: Boolean get() = seedRank != null

    val label: String get() = wire

    companion object {
        val LOW = Priority("low")
        val NORMAL = Priority("normal")
        val HIGH = Priority("high")
        val URGENT = Priority("urgent")

        /** The seeds in display order. Omitted priority means [NORMAL] / 10. */
        val seeds: List<Priority> = listOf(LOW, NORMAL, HIGH, URGENT)

        fun fromWire(raw: String?): Priority? =
            raw?.trim()?.takeIf { it.isNotEmpty() }?.let(::Priority)
    }
}

/** What the overdue policy runs at the deadline. Omitted means [NONE]. */
enum class OverduePolicy(val wire: String) {
    NONE("none"),
    RETIRE("retire"),
    ESCALATE("escalate"),
    ;

    companion object {
        fun fromWire(raw: String?): OverduePolicy =
            entries.firstOrNull { it.wire == raw } ?: NONE
    }
}

/**
 * Who created the row. Absent on rows written before M1, which are not NEW.
 * `member` is reserved for shared spaces.
 */
enum class TaskOrigin(val wire: String) {
    SELF("self"),
    AGENT("agent"),
    MEMBER("member"),
    ;

    companion object {
        fun fromWire(raw: String?): TaskOrigin? = entries.firstOrNull { it.wire == raw }
    }
}

/** The only two terminal outcomes. Absent means a normal open or completed task. */
enum class TaskOutcome(val wire: String) {
    SUPERSEDED("superseded"),
    MISSED("missed"),
    ;

    companion object {
        fun fromWire(raw: String?): TaskOutcome? = entries.firstOrNull { it.wire == raw }
    }
}

/**
 * How a recurrence treats its open occurrences.
 *
 * `replace` keeps at most one open occurrence: when the next period starts, the
 * previous open row becomes `superseded` and a new open row is minted. A missed
 * day never leaves an open pile behind, so the open board stays at one card.
 *
 * `stack` inserts one open occurrence per period and leaves the older ones open,
 * so a journal keeps every missed day writable.
 */
enum class TaskBehavior(val wire: String) {
    REPLACE("replace"),
    STACK("stack"),
    ;

    companion object {
        fun fromWire(raw: String?): TaskBehavior? = entries.firstOrNull { it.wire == raw }
    }
}

/**
 * Facts the backend derives on read, kept here so the in-memory backend and the
 * board agree with `taskView` before a cron exists.
 */
object TaskFacts {
    /** Escalate adds this much, once, and never past [MAX_RANK]. */
    const val ESCALATE_BUMP = 10
    const val MAX_RANK = 30

    /**
     * NEW means an agent or another person wrote the row and you have not
     * opened it. A missing `origin` is never NEW, and your own create sets
     * `seenAt`, so it is never NEW either.
     */
    fun isNew(origin: TaskOrigin?, seenAt: Long?): Boolean =
        seenAt == null && (origin == TaskOrigin.AGENT || origin == TaskOrigin.MEMBER)

    /** Before the deadline, open, not done and not trashed. */
    fun isOverdue(deadlineAt: Long?, done: Boolean, now: Long): Boolean =
        !done && deadlineAt != null && deadlineAt < now

    /**
     * Escalate bumps only a seed priority, because a custom string has no
     * meaning to add 10 to. Everything else keeps its rank and still shows
     * overdue.
     */
    fun effectiveRank(
        priority: Priority?,
        priorityRank: Int?,
        overdue: Boolean,
        overduePolicy: OverduePolicy,
    ): Int? {
        val rank = priorityRank ?: priority?.seedRank ?: return null
        val escalate = overdue && overduePolicy == OverduePolicy.ESCALATE && priority?.isSeed == true
        return if (escalate) minOf(rank + ESCALATE_BUMP, MAX_RANK) else rank
    }

    /**
     * The open board: not done, and not already superseded or missed. A missed
     * chance retires and a skipped period supersedes, and neither leaves an open
     * row behind.
     */
    fun isOpen(task: TaskItem): Boolean = task.outcome == null && !task.done
}
