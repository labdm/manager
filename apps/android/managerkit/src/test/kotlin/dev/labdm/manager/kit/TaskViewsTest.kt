package dev.labdm.manager.kit

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class TaskViewsTest {

    private val now = 1_767_321_600_000L
    private val day: Long = 86_400_000L
    private val today: Long = DueDateMath.startOfDay(now)

    private fun task(
        id: String,
        title: String,
        plannedOn: Long? = null,
        done: Boolean = false,
        outcome: TaskOutcome? = null,
    ) = TaskItem(
        id = id,
        title = title,
        done = done,
        plannedOn = plannedOn,
        outcome = outcome,
    )

    @Test
    fun `the tasks slice shows every open task and nothing else`() {
        val tasks =
            listOf(
                task("1", "Buy milk", plannedOn = today - day),
                task("2", "Paid rent", done = true),
                task("3", "Missed window", plannedOn = today - day, outcome = TaskOutcome.SUPERSEDED),
            )

        val open = TaskSlices.openTasks(tasks)

        assertEquals(listOf("1"), open.map { it.id })
    }

    @Test
    fun `the daily slice shows only the task planned for today`() {
        val tasks =
            listOf(
                task("1", "Wash dishes", plannedOn = today),
                task("2", "Journal", plannedOn = today - day),
            )

        val daily = TaskSlices.tasksFor(tasks, TaskSlice.DAILY, now = now)

        assertEquals(listOf("1"), daily.map { it.id })
    }

    @Test
    fun `the weekly slice starts on monday and spans seven days`() {
        val weekStart = DueDateMath.weekStart(today)
        // The week start is itself a Monday start, and spans exactly seven days.
        assertEquals(weekStart, DueDateMath.weekStart(weekStart))
        assertEquals(weekStart + 7 * day, TaskSlices.nextWeekStart(weekStart))

        val tasks =
            listOf(
                task("1", "This week", plannedOn = weekStart + 2 * day),
                task("2", "Last week", plannedOn = weekStart - day),
                task("3", "Two weeks ago", plannedOn = weekStart - 14 * day),
            )

        val weekly = TaskSlices.tasksFor(tasks, TaskSlice.WEEKLY, now = now)

        assertEquals(listOf("1"), weekly.map { it.id })
    }

    @Test
    fun `the monthly slice shows the current month only`() {
        val tasks =
            listOf(
                task("1", "Pay tax", plannedOn = today + 10 * day),
                task("2", "Old rent", plannedOn = today - 40 * day),
            )

        val monthly = TaskSlices.tasksFor(tasks, TaskSlice.MONTHLY, now = now)

        assertEquals(listOf("1"), monthly.map { it.id })
    }

    @Test
    fun `the find more catalog lists the life categories`() {
        assertEquals(11, TaskCatalog.lifeTemplates.size)
        assertEquals(
            listOf(
                "household", "health", "body", "relationships", "work", "projects", "money", "admin",
                "learning", "social", "creative",
            ),
            TaskCatalog.lifeTemplates.map { it.slug },
        )
    }

    @Test
    fun `an unknown icon falls back instead of crashing`() {
        assertEquals(TaskIcons.FALLBACK, TaskIcons.resolve(null))
        assertEquals(TaskIcons.FALLBACK, TaskIcons.resolve("   "))
        assertEquals(TaskIcons.FALLBACK, TaskIcons.resolve("not-a-lucide-icon"))
        assertEquals("house", TaskIcons.resolve("House"))
    }

    @Test
    fun `an unknown color falls back instead of crashing`() {
        assertEquals(TaskColors.FALLBACK, TaskColors.resolve(null))
        assertEquals(TaskColors.FALLBACK, TaskColors.resolve("   "))
        assertEquals(TaskColors.FALLBACK, TaskColors.resolve("not-a-color"))
        assertEquals("sky", TaskColors.resolve("Sky"))
    }

    @Test
    fun `empty sections are hidden and non-empty ones are not`() {
        assertTrue(BoardColumnSections.of(emptyList(), emptyList(), emptyList(), null, null, emptySet()).isEmpty)

        val sections =
            BoardColumnSections.of(
                tasks = listOf(task("1", "Buy milk"), task("2", "Pay rent")),
                alerts = listOf(BoardAlert("a1", "Flight is Thursday", source = TaskOrigin.AGENT)),
                questions = listOf(BoardQuestion("q1", "Buy glass?")),
                progression = ProgressionState("Finish the book", current = 150, target = 300, unit = "pages"),
                quest = QuestState("quest-1", "Train this month", steps = listOf(QuestStep(1, "Run", QuestStep.QuestGate.AVAILABLE))),
                pinnedTaskIds = setOf("1"),
            )

        assertFalse(sections.isEmpty)
        assertEquals(listOf("a1"), sections.alerts.map { it.id })
        assertEquals(listOf("q1"), sections.questions.map { it.id })
        assertEquals(listOf("1"), sections.pinnedTasks.map { it.id })
        assertEquals(listOf("2"), sections.tasks.map { it.id })
        assertEquals(ProgressionState("Finish the book", current = 150, target = 300, unit = "pages"), sections.progression)
    }
}
