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
 * Shell-independent board rules: explicit series behavior and cadence, the
 * appearance catalog, and the two clocks. The row-first UI is covered by
 * `ManagerShellTest`; these checks stay Compose-free.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class BoardRulesTest {

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
    fun `series and cadence are explicit form choices`() = runTest {
        val (model, backend) = makeBoard()
        val draft =
            TaskDraft(
                title = "  Read the report  ",
                series = SeriesBehavior.STACK,
                cadence = SeriesCadence.WEEKLY,
            )

        assertTrue(model.createTaskFromSheet(draft))

        assertEquals(listOf(SeriesBehavior.STACK), backend.createdSeries)
        assertEquals(listOf(SeriesCadence.WEEKLY), backend.createdCadences)
        val created = backend.storedTasks.first()
        assertEquals(SeriesBehavior.STACK, created.series)
        assertEquals(SeriesCadence.WEEKLY, created.cadence)
        assertFalse(created.isNew)

        assertEquals(
            listOf("none", "replace", "stack"),
            SeriesBehavior.entries.map { it.wire },
        )
        assertEquals(
            listOf("daily", "weekly", "monthly", "every14days"),
            SeriesCadence.entries.map { it.wire },
        )
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

}
