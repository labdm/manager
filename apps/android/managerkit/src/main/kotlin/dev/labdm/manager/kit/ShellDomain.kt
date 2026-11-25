package dev.labdm.manager.kit

/**
 * The five primary destinations. The menu is a separate modal drawer and never
 * repeats one of these as a drawer row.
 */
enum class ShellDestination(val label: String, val wire: String) {
    TASKS("Tasks", "tasks"),
    MESSAGES("Messages", "messages"),
    GROUPS("Groups", "groups"),
    CATEGORIES("Categories", "categories"),
    RESOURCES("Resources", "resources"),
    ;

    companion object {
        fun fromWire(raw: String?): ShellDestination =
            entries.firstOrNull { it.wire == raw } ?: TASKS
    }
}

/**
 * A Tasks filter. These are query modes and day/week/month slices, not tabs on
 * the bottom bar. Any of them can carry an unseen count.
 */
enum class BoardChip(val label: String, val wire: String) {
    ALL("All", "all"),
    DAILY("Daily", "daily"),
    WEEKLY("Weekly", "weekly"),
    MONTHLY("Monthly", "monthly"),
    EVENTS("Events", "events"),
    ;

    companion object {
        fun fromWire(raw: String?): BoardChip = entries.firstOrNull { it.wire == raw } ?: ALL
    }
}

/** Which activity records the Tasks page shows. Messages History ignores this. */
enum class ActivityOnTasks(val wire: String, val label: String) {
    OTHERS("others", "Others and agents"),
    ALL("all", "All"),
    NONE("none", "None"),
    ;

    companion object {
        fun fromWire(raw: String?): ActivityOnTasks =
            entries.firstOrNull { it.wire == raw } ?: OTHERS
    }
}

/** Every board item draws with the same row. The stored `card` look is ignored. */
enum class ShellRowKind(val wire: String) {
    TASK("task"),
    MESSAGE("message"),
    QUESTION("question"),
    INVITE("invite"),
    PROGRESSION("progression"),
    GROUP("group"),
    CATEGORY("category"),
    RESOURCE("resource"),
    ROUTING("routing"),
}

/**
 * One row in any list. Slots that do not apply to a row type stay null.
 * An invite carries Accept and Decline on the row, never in a sheet.
 */
data class ShellRow(
    val id: String,
    val title: String,
    val kind: ShellRowKind,
    val body: String? = null,
    val isNew: Boolean = false,
    val unseen: Boolean = false,
    val group: String? = null,
    val due: String? = null,
    val progress: String? = null,
    val badgeCount: Int? = null,
    val done: Boolean = false,
)

/** The record a person opens. It is set only by an explicit row selection. */
data class ShellSelection(
    val id: String,
    val title: String,
    val kind: ShellRowKind,
)

/** The product word is group; the schema word stays space. */
data class GroupItem(
    val id: String,
    val name: String,
    val icon: String = Appearance.FALLBACK_ICON,
    val color: String = Appearance.FALLBACK_COLOR,
    val isDefault: Boolean = false,
)

data class InviteItem(
    val id: String,
    val groupId: String,
    val groupName: String,
    val title: String,
    val body: String? = null,
    val seenAt: Long? = null,
) {
    val isUnread: Boolean get() = seenAt == null
}

data class RoutingItem(
    val id: String,
    val title: String,
    val trigger: String,
    val execution: String,
)

/** The mixed content behind the Tasks feed, from `board:slice`. */
data class BoardSnapshot(
    val views: List<TaskView> = emptyList(),
    val alerts: List<BoardAlert> = emptyList(),
    val questions: List<BoardQuestion> = emptyList(),
    val progressions: List<ProgressionState> = emptyList(),
    val quests: List<QuestState> = emptyList(),
)

/** The modal menu. It has no overlap with the primary destinations. */
object ShellMenu {
    val rows: List<String> = listOf(
        "Achievements",
        "Contacts",
        "Events",
        "Routings",
        "Profile",
        "Settings",
        "Docs",
        "Contact us",
        "Desktop app",
        "Changelog",
    )
}
