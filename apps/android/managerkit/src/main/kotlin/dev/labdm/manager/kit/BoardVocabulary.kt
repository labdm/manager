package dev.labdm.manager.kit

/**
 * How one task is drawn on the board. A task carries its own look; the board
 * never guesses it from priority or date. Unknown wire values fall back to the
 * compact check row.
 */
enum class TaskLook(val wire: String, val label: String) {
    CHECK("check", "Check"),
    ROW("row", "Row"),
    CARD("card", "Card"),
    ;

    companion object {
        fun fromWire(raw: String?): TaskLook = entries.firstOrNull { it.wire == raw } ?: CHECK
    }
}

/**
 * A series declares its own machine. "None" is an ordinary task, not a daily
 * series with a special flag.
 */
enum class SeriesBehavior(val wire: String, val label: String, val detail: String) {
    NONE("none", "None", "One task"),
    REPLACE("replace", "Replace", "One open task. A missed period leaves the board."),
    STACK("stack", "Stack", "One open task per period. Missed periods stay."),
    ;

    companion object {
        fun fromWire(raw: String?): SeriesBehavior = entries.firstOrNull { it.wire == raw } ?: NONE
    }
}

/**
 * How often a series mints its next occurrence. A cadence is never inferred
 * from a behavior: both are explicit choices in the sheet.
 */
enum class SeriesCadence(val wire: String, val label: String) {
    DAILY("daily", "Daily"),
    WEEKLY("weekly", "Weekly"),
    MONTHLY("monthly", "Monthly"),
    EVERY_14_DAYS("every14days", "Every 14 days"),
    ;

    companion object {
        /** Accepts the backend's `biweekly` id and the human label as aliases. */
        fun fromWire(raw: String?): SeriesCadence =
            entries.firstOrNull { candidate ->
                candidate.wire == raw ||
                    (candidate == EVERY_14_DAYS && raw in setOf("biweekly", "every 14 days", "fourteen"))
            } ?: DAILY
    }
}

/**
 * Everything that can be created or edited in a sheet. The board never pushes
 * a form into the column: every target is owned here so it can be tested
 * without Compose.
 */
sealed class BoardSheet {
    data object CreateTask : BoardSheet()
    data class EditTask(val taskId: String) : BoardSheet()
    data class Category(val entityId: String?) : BoardSheet()
    data class Event(val entityId: String?) : BoardSheet()
    data class View(val entityId: String?) : BoardSheet()
    data class Progression(val entityId: String?) : BoardSheet()
    data class Resource(val entityId: String?) : BoardSheet()

    val id: String
        get() = when (this) {
            CreateTask -> "create-task"
            is EditTask -> "edit-task-$taskId"
            is Category -> "category-${entityId ?: "new"}"
            is Event -> "event-${entityId ?: "new"}"
            is View -> "view-${entityId ?: "new"}"
            is Progression -> "progression-${entityId ?: "new"}"
            is Resource -> "resource-${entityId ?: "new"}"
        }

    /** The title shown in the sheet's top bar. */
    val title: String
        get() = when (this) {
            CreateTask -> "New task"
            is EditTask -> "Task details"
            is Category -> if (entityId == null) "New category" else "Edit category"
            is Event -> if (entityId == null) "New event" else "Edit event"
            is View -> if (entityId == null) "New view" else "Edit view"
            is Progression -> if (entityId == null) "New progression" else "Edit progression"
            is Resource -> if (entityId == null) "New resource" else "Edit resource"
        }
}

/** A locally authored entity whose backend mutations are still planned. */
enum class BoardEntityKind(val wire: String, val label: String) {
    CATEGORY("category", "Category"),
    EVENT("event", "Event"),
    VIEW("view", "View"),
    PROGRESSION("progression", "Progression"),
    RESOURCE("resource", "Resource"),
    ;

    companion object {
        fun fromWire(raw: String?): BoardEntityKind = entries.firstOrNull { it.wire == raw } ?: CATEGORY
    }
}

data class BoardEntity(
    val id: String,
    val kind: BoardEntityKind,
    val title: String,
    val icon: String,
    val color: String,
)

/** One tile on the full-screen dashboard. The add tile is always last. */
data class DashboardTile(
    val id: String,
    val title: String,
    val icon: String,
    val color: String,
    val isAddTile: Boolean = false,
)
