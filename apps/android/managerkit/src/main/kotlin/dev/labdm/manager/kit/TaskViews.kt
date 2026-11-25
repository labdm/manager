package dev.labdm.manager.kit

import java.util.Calendar
import java.util.Date
import java.util.TimeZone

/**
 * The time slice the main column is showing, addressed by the rail's tab row.
 *
 * `tasks` is the view with no time filter. `daily`, `weekly` and `monthly` attach
 * the slice to the day, week and month event. A task is part of a time-bound
 * slice when its planned day falls inside that span.
 */
enum class TaskSlice(val wire: String) {
    TASKS("tasks"),
    DAILY("daily"),
    WEEKLY("weekly"),
    MONTHLY("monthly");

    companion object {
        fun fromWire(raw: String?): TaskSlice = entries.firstOrNull { it.wire == raw } ?: TASKS
    }
}

/** The kind of a view on the rail. Home is built in; the rest are installed or computed. */
enum class TaskViewKind(val wire: String) {
    HOME("home"),
    TEMPLATE("template"),
    COMPUTED("computed"),
    CUSTOM("custom");

    companion object {
        fun fromWire(raw: String?): TaskViewKind = entries.firstOrNull { it.wire == raw } ?: HOME
    }
}

/**
 * A view: a named slice on the rail. Home is built in; a template is installed
 * from the catalog; a computed view is a saved query; a custom view is one the
 * user fills by hand.
 */
data class TaskView(
    val id: String,
    val title: String,
    val icon: String,
    val color: String,
    val kind: TaskViewKind,
) {
    companion object {
        val HOME = TaskView(
            id = "home",
            title = "Home",
            icon = TaskIcons.resolve("house"),
            color = TaskColors.resolve("sky"),
            kind = TaskViewKind.HOME,
        )
    }
}

/** A template a user can install from Find more. */
data class TaskTemplate(
    val slug: String,
    val name: String,
    val icon: String,
    val color: String,
)

/**
 * The life categories the rail offers through Find more. Slugs are stable, so a
 * custom view may reuse any of them.
 */
object TaskCatalog {
    val lifeTemplates: List<TaskTemplate> = listOf(
        TaskTemplate("household", "Household", "house", "blue"),
        TaskTemplate("health", "Health", "heart", "red"),
        TaskTemplate("body", "Body", "dumbbell", "orange"),
        TaskTemplate("relationships", "Relationships", "users", "pink"),
        TaskTemplate("work", "Work", "briefcase", "indigo"),
        TaskTemplate("projects", "Projects", "folder", "violet"),
        TaskTemplate("money", "Money", "wallet", "emerald"),
        TaskTemplate("admin", "Admin", "shield", "gray"),
        TaskTemplate("learning", "Learning", "book", "sky"),
        TaskTemplate("social", "Social", "users", "teal"),
        TaskTemplate("creative", "Creative", "palette", "fuchsia"),
    )
}

/**
 * An icon name. The schema does not enumerate the Lucide set, so an unknown name
 * falls back instead of crashing the board.
 */
object TaskIcons {
    const val FALLBACK = "circle"

    private val knownIcons =
        setOf(
            "house", "heart", "dumbbell", "users", "briefcase", "folder", "wallet", "shield",
            "book", "message", "palette", "sparkles", "flame", "sun", "star", "calendar", "check",
        )

    fun resolve(raw: String?): String = raw?.trim()?.lowercase()?.takeIf { it in knownIcons } ?: FALLBACK
}

/**
 * A palette token. An unknown token falls back instead of crashing the board.
 */
object TaskColors {
    const val FALLBACK = "gray"

    private val knownColors =
        setOf(
            "gray", "red", "orange", "amber", "yellow", "lime", "green", "emerald", "teal",
            "cyan", "sky", "blue", "indigo", "violet", "purple", "fuchsia", "pink", "rose",
        )

    fun resolve(raw: String?): String = raw?.trim()?.lowercase()?.takeIf { it in knownColors } ?: FALLBACK
}

/**
 * An alert from an agent or another person. Not a task: no checkbox, no done
 * state. Reading one clears NEW. The Tasks feed keeps it when the activity
 * setting includes the author. Messages always keeps it.
 */
data class BoardAlert(
    val id: String,
    val title: String,
    val body: String? = null,
    val source: TaskOrigin? = null,
    val seenAt: Long? = null,
) {
    val isUnread: Boolean get() = seenAt == null
}

/** An open question with options. Answering can create the next task. */
data class BoardQuestionOption(
    val id: String,
    val label: String,
    val position: Int,
)

data class BoardQuestion(
    val id: String,
    val prompt: String,
    val options: List<BoardQuestionOption> = emptyList(),
    val answeredAt: Long? = null,
)

/** A known-size track drawn as a bar: `Finish the book`, 150/300. */
data class ProgressionState(
    val title: String,
    val current: Int,
    val target: Int,
    val unit: String? = null,
    val id: String = "progression",
) {
    val isComplete: Boolean get() = target > 0 && current >= target
}

/** One step of a quest chain. */
data class QuestStep(
    val position: Int,
    val title: String,
    val gate: QuestGate,
    val taskId: String? = null,
) {
    enum class QuestGate {
        AVAILABLE,
        LOCKED,
    }
}

/** A quest: a chain of tasks. A waiting quest stays on the board with no date. */
data class QuestState(
    val id: String,
    val title: String,
    val steps: List<QuestStep>,
) {
    val nextStep: QuestStep?
        get() = steps.lastOrNull { it.gate == QuestStep.QuestGate.LOCKED || it.gate == QuestStep.QuestGate.AVAILABLE }
}

/**
 * The column, top to bottom: unread alerts, open questions, pinned rows, task
 * rows, progression bars and quest steppers. Empty sections stay hidden.
 */
data class BoardColumnSections(
    val alerts: List<BoardAlert>,
    val questions: List<BoardQuestion>,
    val pinnedTasks: List<TaskItem>,
    val tasks: List<TaskItem>,
    val progression: ProgressionState?,
    val quest: QuestState?,
) {
    val isEmpty: Boolean
        get() =
            alerts.isEmpty() &&
                questions.isEmpty() &&
                pinnedTasks.isEmpty() &&
                tasks.isEmpty() &&
                progression == null &&
                quest == null

    companion object {
        fun of(
            tasks: List<TaskItem>,
            alerts: List<BoardAlert>,
            questions: List<BoardQuestion>,
            progression: ProgressionState?,
            quest: QuestState?,
            pinnedTaskIds: Set<String>,
        ): BoardColumnSections {
            val open = TaskSlices.openTasks(tasks)
            val pinned = open.filter { it.id in pinnedTaskIds }
            val rest = open.filterNot { it.id in pinnedTaskIds }
            return BoardColumnSections(
                alerts = alerts,
                questions = questions,
                pinnedTasks = pinned,
                tasks = rest,
                progression = progression,
                quest = quest,
            )
        }
    }
}

/**
 * Slice queries over the open board. The backend owns ordering and derived
 * facts; the slice only decides which open rows a time-bound view shows.
 */
object TaskSlices {
    fun openTasks(tasks: List<TaskItem>): List<TaskItem> = tasks.filter { TaskFacts.isOpen(it) }

    fun tasksFor(tasks: List<TaskItem>, slice: TaskSlice, now: Long): List<TaskItem> =
        when (slice) {
            TaskSlice.TASKS -> TaskSlices.openTasks(tasks)
            TaskSlice.DAILY -> TaskSlices.openTasks(tasks).filter { it.plannedDay == DueDateMath.startOfDay(now) }
            TaskSlice.WEEKLY -> {
                val weekStart = DueDateMath.weekStart(now)
                TaskSlices.openTasks(tasks).filter { task ->
                    val day = task.plannedDay
                    day != null && day >= weekStart && day < TaskSlices.nextWeekStart(weekStart)
                }
            }
            TaskSlice.MONTHLY -> {
                val monthStart = DueDateMath.monthStart(now)
                TaskSlices.openTasks(tasks).filter { task ->
                    val day = task.plannedDay
                    day != null && day >= monthStart && day < TaskSlices.nextMonthStart(monthStart)
                }
            }
        }

    fun nextWeekStart(weekStart: Long): Long =
        Calendar.getInstance(TimeZone.getDefault()).apply { timeInMillis = weekStart }.apply {
            add(Calendar.DAY_OF_MONTH, 7)
        }.timeInMillis

    fun nextMonthStart(monthStart: Long): Long {
        val calendar = Calendar.getInstance(TimeZone.getDefault()).apply { timeInMillis = monthStart }
        calendar.add(Calendar.MONTH, 1)
        return calendar.timeInMillis
    }
}
