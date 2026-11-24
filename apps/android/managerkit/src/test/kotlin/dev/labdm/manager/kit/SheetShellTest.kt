package dev.labdm.manager.kit

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.util.TimeZone

/**
 * The in-memory contract for the sheets-and-bottom-tabs shell. Every rule is
 * checked without Compose: presentation state, the dashboard tiles, the three
 * looks, the explicit series choices, the mark-seen rule and the two clocks.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class SheetShellTest {

    private val now = 1_767_321_600_000L
    private val day = 86_400_000L
    private var originalZone: TimeZone? = null

    @Before
    fun setUp() {
        originalZone = TimeZone.getDefault()
        TimeZone.setDefault(TimeZone.getTimeZone("UTC"))
        Dispatchers.setMain(UnconfinedTestDispatcher())
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
        originalZone?.let { TimeZone.setDefault(it) }
    }

    private val today: Long get() = DueDateMath.startOfDay(now)
    private val monday: Long get() = DueDateMath.weekStart(today)
    private val tuesday: Long get() = monday + day
    private val wednesday: Long get() = monday + 2 * day

    private fun makeBoard(tasks: List<TaskItem> = emptyList()): Pair<TaskBoardModel, InMemoryTaskBackend> {
        val backend = InMemoryTaskBackend(tasks, now = { now })
        val model = TaskBoardModel(backend, now = { now })
        model.start()
        return model to backend
    }

    private fun openRows(
        backend: InMemoryTaskBackend,
        recurrenceId: String,
    ): List<TaskItem> =
        backend.storedTasks.filter {
            it.recurrenceId == recurrenceId && TaskFacts.isOpen(it)
        }

    @Test
    fun `the dashboard is a grid of category tiles and not a side rail`() {
        val (model, _) = makeBoard()

        assertFalse(model.state.value.showsDashboard)
        assertEquals(TaskView.HOME.id, model.state.value.selectedViewId)

        model.openDashboard()

        assertTrue(model.state.value.showsDashboard)
        // Opening the dashboard changes no navigation selection: it is a cover.
        assertEquals(TaskView.HOME.id, model.state.value.selectedViewId)
        assertEquals("Home", model.state.value.dashboardTiles.first().title)
        assertTrue(model.state.value.dashboardTiles.last().isAddTile)

        val household = TaskCatalog.lifeTemplates.first()
        model.installTemplate(household)
        assertEquals(3, model.state.value.dashboardTiles.size)

        val tile = model.state.value.dashboardTiles[1]
        model.selectDashboardTile(tile)
        assertFalse(model.state.value.showsDashboard)
        assertEquals("view-${household.slug}", model.state.value.selectedViewId)

        model.openDashboard()
        model.selectDashboardTile(model.state.value.dashboardTiles.last())
        assertFalse(model.state.value.showsDashboard)
        assertEquals(BoardSheet.Category(null), model.state.value.presentedSheet)
    }

    @Test
    fun `create presents a sheet and inserts no form in the column`() {
        val (model, backend) = makeBoard()

        model.beginTask()
        assertEquals(BoardSheet.CreateTask, model.state.value.presentedSheet)
        assertNull(model.state.value.draft.plannedOn)
        assertTrue(backend.createdDrafts.isEmpty())
        assertEquals(1, model.state.value.composerFocusRequest)

        model.selectSlice(TaskSlice.DAILY)
        model.beginTask()
        assertEquals(today, model.state.value.draft.plannedOn)
        assertEquals(BoardSheet.CreateTask, model.state.value.presentedSheet)

        for (target in listOf<BoardSheet>(
            BoardSheet.Category(null),
            BoardSheet.Event(null),
            BoardSheet.View(null),
            BoardSheet.Progression(null),
            BoardSheet.Resource(null),
        )) {
            model.present(target)
            assertEquals(target, model.state.value.presentedSheet)
        }
        model.dismissSheet()
        assertNull(model.state.value.presentedSheet)
    }

    @Test
    fun `a failed open keeps NEW and the editor sheet stays open`() = runTest {
        val task = TaskItem("agent", "Install Omarchy", done = false, origin = TaskOrigin.AGENT)
        val backend = FailingSeenBackend(InMemoryTaskBackend(listOf(task), now = { now }))
        val model = TaskBoardModel(backend, now = { now })
        model.start()
        assertTrue(model.state.value.tasks.single().isNew)

        model.openTask(task)

        assertEquals(BoardSheet.EditTask("agent"), model.state.value.presentedSheet)
        assertTrue(model.state.value.tasks.single().isNew)
        assertNull(model.state.value.tasks.single().seenAt)
        org.junit.Assert.assertNotNull(model.state.value.errorMessage)
    }

    @Test
    fun `task look series and cadence are explicit sheet choices`() = runTest {
        val (model, backend) = makeBoard()
        val draft =
            TaskDraft(
                title = "  Read the report  ",
                look = TaskLook.CARD,
                series = SeriesBehavior.STACK,
                cadence = SeriesCadence.WEEKLY,
            )

        assertTrue(model.createTaskFromSheet(draft))

        assertEquals(listOf(TaskLook.CARD), backend.createdLooks)
        assertEquals(listOf(SeriesBehavior.STACK), backend.createdSeries)
        assertEquals(listOf(SeriesCadence.WEEKLY), backend.createdCadences)
        val created = backend.storedTasks.first()
        assertEquals(TaskLook.CARD, created.look)
        assertEquals(SeriesBehavior.STACK, created.series)
        assertEquals(SeriesCadence.WEEKLY, created.cadence)
        assertFalse(created.isNew)

        assertEquals(
            listOf("check", "row", "card"),
            TaskLook.entries.map { it.wire },
        )
        assertEquals(
            listOf("none", "replace", "stack"),
            SeriesBehavior.entries.map { it.wire },
        )
        assertEquals(
            listOf("daily", "weekly", "monthly", "every14days"),
            SeriesCadence.entries.map { it.wire },
        )
        assertEquals(TaskLook.CHECK, TaskLook.fromWire("nonsense"))
        assertEquals(SeriesBehavior.NONE, SeriesBehavior.fromWire(null))
        assertEquals(SeriesCadence.DAILY, SeriesCadence.fromWire(null))
    }

    @Test
    fun `replace still leaves exactly one open row`() = runTest {
        val (model, backend) = makeBoard()
        val draft =
            TaskDraft(
                title = "Dishes",
                plannedOn = monday,
                series = SeriesBehavior.REPLACE,
                cadence = SeriesCadence.DAILY,
            )

        assertTrue(model.createSeriesTask(draft))
        assertEquals(listOf("daily"), backend.recurrenceCadences)

        val recurrenceId = backend.storedTasks.first { it.recurrenceId != null }.recurrenceId!!
        assertEquals(1, openRows(backend, recurrenceId).size)

        backend.reconcile(tuesday)

        val all = backend.storedTasks.filter { it.recurrenceId == recurrenceId }
        assertEquals(2, all.size)
        assertEquals(TaskOutcome.SUPERSEDED, all.first { it.periodStart == monday }.outcome)
        val open = openRows(backend, recurrenceId)
        assertEquals(1, open.size)
        assertEquals(tuesday, open.first().periodStart)
        assertNull(open.first().deadlineAt)
        assertFalse(open.first().isNew)
    }

    @Test
    fun `stack still leaves the missed days open`() = runTest {
        val (model, backend) = makeBoard()
        val draft =
            TaskDraft(
                title = "Journal",
                plannedOn = monday,
                series = SeriesBehavior.STACK,
                cadence = SeriesCadence.DAILY,
            )

        assertTrue(model.createSeriesTask(draft))
        val recurrenceId = backend.storedTasks.first { it.recurrenceId != null }.recurrenceId!!

        backend.reconcile(wednesday)

        val open = openRows(backend, recurrenceId)
        assertEquals(3, open.size)
        assertEquals(setOf(monday, tuesday, wednesday), open.map { it.periodStart }.toSet())
        assertTrue(open.all { it.outcome == null })
        assertTrue(open.all { !it.isNew })
    }

    @Test
    fun `a fourteen day cadence steps fourteen days and not one`() = runTest {
        val (model, backend) = makeBoard()
        val draft =
            TaskDraft(
                title = "Fortnightly",
                plannedOn = monday,
                series = SeriesBehavior.STACK,
                cadence = SeriesCadence.EVERY_14_DAYS,
            )

        assertTrue(model.createSeriesTask(draft))
        assertEquals(listOf("every14days"), backend.recurrenceCadences)
        val recurrenceId = backend.storedTasks.first { it.recurrenceId != null }.recurrenceId!!

        backend.reconcile(monday + 15 * day)

        val days = openRows(backend, recurrenceId).map { it.periodStart }.toSet()
        assertEquals(setOf(monday, monday + 14 * day), days)
    }

    @Test
    fun `the appearance catalog is searchable and every choice is safe`() {
        assertTrue(IconChoice.search("home").any { it.id == "house" })
        assertTrue(IconChoice.search("chart").any { it.id == "chart-column" })
        assertTrue(IconChoice.search("nothing-matches").isEmpty())
        assertTrue(IconChoice.all.all { Appearance.knownIcons.contains(it.id) })
        assertTrue(Appearance.colorTokens.all { Appearance.knownColors.contains(it) })
        assertEquals(Appearance.FALLBACK_ICON, Appearance.icon("not-an-icon"))
        assertEquals("house", Appearance.icon("house"))
    }

    @Test
    fun `a blank deadline in the sheet leaves the stored deadline and day in place`() = runTest {
        val deadline = today + 5 * day
        val plannedOn = today - 2 * day
        val (model, _) =
            makeBoard(
                listOf(
                    TaskItem(
                        "1",
                        "File taxes",
                        done = false,
                        seenAt = 1L,
                        plannedOn = plannedOn,
                        plannedTime = 90,
                        deadlineAt = deadline,
                    ),
                ),
            )

        model.openTask(model.state.value.tasks.single())
        model.updateEditDraft {
            it.copy(plannedOn = null, plannedTime = null, deadlineAt = null)
        }
        assertTrue(model.saveEdit())

        val saved = model.state.value.tasks.single()
        assertEquals(deadline, saved.deadlineAt)
        assertEquals(plannedOn, saved.plannedOn)
        assertEquals(90, saved.plannedTime)
    }

    /** Delegates everything but markSeen, which fails as a dropped write would. */
    private class FailingSeenBackend(
        private val delegate: InMemoryTaskBackend,
    ) : TaskBackend by delegate {
        override suspend fun markSeen(id: String) {
            error("Could not mark the task as seen")
        }
    }
}
