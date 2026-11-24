package dev.labdm.manager.kit

/**
 * One choice in the searchable icon grid. `id` is the Lucide name stored on the
 * record; `label` is what the user sees. Search matches both, so "home" finds
 * `house` and "chart" finds the chart icons.
 */
data class IconChoice(val id: String, val label: String) {
    fun matches(query: String): Boolean {
        val needle = query.trim().lowercase()
        if (needle.isEmpty()) return true
        return id.lowercase().contains(needle) || label.lowercase().contains(needle)
    }

    companion object {
        /** Lucide names first, then legacy names still carried by old templates. */
        val all: List<IconChoice> =
            listOf(
                IconChoice("house", "Home"),
                IconChoice("layout-grid", "Grid"),
                IconChoice("heart", "Health"),
                IconChoice("footprints", "Body"),
                IconChoice("users", "Relationships"),
                IconChoice("briefcase", "Work"),
                IconChoice("folder", "Projects"),
                IconChoice("wallet", "Money"),
                IconChoice("settings", "Admin"),
                IconChoice("book-open", "Learning"),
                IconChoice("messages-square", "Social"),
                IconChoice("palette", "Creative"),
                IconChoice("sun", "Daily"),
                IconChoice("calendar", "Calendar"),
                IconChoice("circle-check", "Tasks"),
                IconChoice("inbox", "Inbox"),
                IconChoice("star", "Starred"),
                IconChoice("zap", "Energy"),
                IconChoice("flag", "Goal"),
                IconChoice("target", "Target"),
                IconChoice("clock", "Time"),
                IconChoice("map-pin", "Place"),
                IconChoice("sparkles", "Event"),
                IconChoice("layers", "Series"),
                IconChoice("list-todo", "Checklist"),
                IconChoice("chart-column", "Progress"),
                IconChoice("trophy", "Achievement"),
                IconChoice("gift", "Reward"),
                IconChoice("coffee", "Break"),
                IconChoice("dumbbell", "Training"),
                IconChoice("circle", "Other"),
                // Legacy wire names: an installed template may still carry one.
                IconChoice("shield", "Admin"),
                IconChoice("book", "Learning"),
                IconChoice("message", "Social"),
                IconChoice("flame", "High priority"),
                IconChoice("check", "Tasks"),
            )

        fun search(query: String): List<IconChoice> = all.filter { it.matches(query) }
    }
}

/** The palette tokens `appearance.color` accepts. Unknown values draw gray. */
object Appearance {
    const val FALLBACK_ICON = "circle"
    const val FALLBACK_COLOR = "gray"

    val colorTokens: List<String> =
        listOf(
            "gray", "red", "orange", "amber", "yellow", "lime", "green", "emerald", "teal",
            "cyan", "sky", "blue", "indigo", "violet", "purple", "fuchsia", "pink", "rose",
        )

    val knownIcons: Set<String> = IconChoice.all.map { it.id }.toSet()
    val knownColors: Set<String> = colorTokens.toSet()

    fun icon(raw: String?): String =
        raw?.trim()?.lowercase()?.takeIf { it in knownIcons } ?: FALLBACK_ICON

    fun color(raw: String?): String =
        raw?.trim()?.lowercase()?.takeIf { it in knownColors } ?: FALLBACK_COLOR
}
