package dev.labdm.manager.kit

import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class TaskBoardModelTest {

    private val now = 1_767_321_600_000L
    private lateinit var backend: RecordingBackend
    private lateinit var model: TaskBoardModel

    @Before
    fun setUp() {
        kotlinx.coroutines.Dispatchers.setMain(UnconfinedTestDispatcher())
        backend = RecordingBackend(
            listOf(TaskItem("1", "Buy milk", done = false, dueAt = 1_767_321_600_000L))
        )
        model = TaskBoardModel(backend, now = { now })
        // The main dispatcher is unconfined, so start() processes its first
        // emissions synchronously without an explicit runCurrent().
        model.start()
    }

    @After
    fun tearDown() {
        model.stop()
        kotlinx.coroutines.Dispatchers.resetMain()
    }

    @Test
    fun `setDone is optimistic and calls the explicit setter`() = runTest {
        val task = model.state.value.tasks.single()

        model.toggle(task)
        runCurrent()

        assertEquals(listOf("1" to true), backend.doneCalls)
        assertEquals(true, model.state.value.tasks.single().done)
    }

    @Test
    fun `failed setDone rolls back to the original state`() = runTest {
        backend.failMutations = true

        model.setDone("1", true)
        runCurrent()

        assertEquals(false, model.state.value.tasks.single().done)
        assertNotNull(model.state.value.errorMessage)
        assertEquals(emptySet<String>(), model.state.value.inFlight)
    }

    @Test
    fun `failed delete restores the task at its original index`() = runTest {
        backend.failMutations = true
        val task = model.state.value.tasks.single()

        model.delete(task)
        runCurrent()

        assertEquals(listOf(task), model.state.value.tasks)
    }

    @Test
    fun `composer normalizes the title and sends dueAt as day-start millis`() = runTest {
        val millis = 1_767_378_600_000L
        model.updateDraft("  Buy   bread  ")
        model.setDraftDueAt(millis)

        assert(model.addTask())
        runCurrent()

        val draft = backend.createDraftCalls.single()
        assertEquals("Buy bread", draft.title)
        assertEquals(DueDateMath.startOfDay(millis), draft.plannedOn)
        assertEquals("", model.state.value.draftTitle)
        assertNull(model.state.value.draftDueAt)
    }

    @Test
    fun `empty draft cannot be submitted`() = runTest {
        assert(!model.addTask())
        assert(backend.createDraftCalls.isEmpty())
    }

    // MARK: - NEW

    @Test
    fun `an agent row shows NEW until it is opened`() = runTest {
        backend.emit(listOf(TaskItem("2", "Install Omarchy", done = false, origin = TaskOrigin.AGENT)))
        runCurrent()

        val unseen = model.state.value.tasks.single()
        assertTrue(unseen.isNew)
        assertEquals(1, model.state.value.newCount)
        // Painting the list must not call markSeen.
        assertTrue(backend.seenCalls.isEmpty())

        model.openTask(unseen)
        runCurrent()

        assertEquals(listOf("2"), backend.seenCalls)
        assertFalse(model.state.value.tasks.single().isNew)
        assertEquals(0, model.state.value.newCount)
        assertEquals(now, model.state.value.tasks.single().seenAt)
    }

    @Test
    fun `a failed open leaves the row NEW and a later open tries again`() = runTest {
        backend.emit(listOf(TaskItem("2", "Install Omarchy", done = false, origin = TaskOrigin.AGENT)))
        runCurrent()
        backend.failMutations = true

        model.openTask(model.state.value.tasks.single())
        runCurrent()

        assertTrue(model.state.value.tasks.single().isNew)
        assertNull(model.state.value.tasks.single().seenAt)
        assertNotNull(model.state.value.errorMessage)
        assertTrue(backend.seenCalls.isEmpty())

        backend.failMutations = false
        model.openTask(model.state.value.tasks.single())
        runCurrent()

        assertEquals(listOf("2"), backend.seenCalls)
        assertFalse(model.state.value.tasks.single().isNew)
    }

    @Test
    fun `opening an already seen row does not call markSeen again`() = runTest {
        backend.emit(
            listOf(
                TaskItem(
                    "1",
                    "Buy milk",
                    done = false,
                    dueAt = 1_767_321_600_000L,
                    seenAt = 1_700_000_000_000L,
                )
            )
        )
        runCurrent()

        model.openTask(model.state.value.tasks.single())
        runCurrent()

        assertTrue(backend.seenCalls.isEmpty())
        assertNotNull(model.state.value.edit)
    }

    @Test
    fun `a local create is not NEW`() = runTest {
        model.updateDraft("Play Witcher")

        assert(model.addTask())
        runCurrent()

        val draft = backend.createDraftCalls.single()
        assertNull(draft.plannedTime)
        assertFalse(TaskItem("9", draft.title, done = false, origin = TaskOrigin.SELF, seenAt = now).isNew)
    }

    // MARK: - Opening the editor

    @Test
    fun `opening a row seeds the editor from the row`() = runTest {
        val task = TaskItem(
            "1",
            "File taxes",
            done = false,
            plannedOn = 1_767_312_000_000L,
            deadlineAt = 1_767_400_000_000L,
            priority = Priority.HIGH,
            priorityRank = 20,
            overduePolicy = OverduePolicy.ESCALATE,
        )
        backend.emit(listOf(task))
        runCurrent()

        model.openTask(task)

        val edit = model.state.value.edit
        assertNotNull(edit)
        assertEquals("File taxes", edit!!.draft.title)
        assertEquals(1_767_312_000_000L, edit.draft.plannedOn)
        assertEquals(1_767_400_000_000L, edit.draft.deadlineAt)
        assertEquals(OverduePolicy.ESCALATE, edit.draft.overduePolicy)
    }

    @Test
    fun `saving the editor writes the draft and closes it`() = runTest {
        model.openTask(model.state.value.tasks.single())

        model.updateEditDraft {
            it.copy(notes = "Semi-skimmed", location = "Corner shop", priority = Priority.URGENT)
        }
        assertTrue(model.saveEdit())
        runCurrent()

        val saved = backend.updateCalls.single()
        assertEquals("1", saved.first)
        assertEquals("Semi-skimmed", saved.second.notes)
        assertEquals("Corner shop", saved.second.location)
        assertEquals(Priority.URGENT, saved.second.priority)
        assertNull(model.state.value.edit)
    }

    @Test
    fun `a failed save restores the row and keeps the editor open`() = runTest {
        val original = model.state.value.tasks.single()
        model.openTask(original)
        model.updateEditDraft { it.copy(title = "Buy oat milk") }
        backend.failMutations = true

        assertFalse(model.saveEdit())
        runCurrent()

        assertEquals(original.title, model.state.value.tasks.single().title)
        assertNotNull(model.state.value.edit)
        assertEquals(false, model.state.value.edit?.isSaving)
        assertNotNull(model.state.value.errorMessage)
    }

    @Test
    fun `a blank deadline leaves the stored deadline in place`() = runTest {
        val deadline = 1_767_400_000_000L
        val plannedOn = 1_767_312_000_000L
        val remindAt = 1_767_390_000_000L
        backend.emit(
            listOf(
                TaskItem(
                    "1",
                    "File taxes",
                    done = false,
                    seenAt = 1L,
                    plannedOn = plannedOn,
                    plannedTime = 90,
                    deadlineAt = deadline,
                    remindAt = remindAt,
                )
            )
        )
        runCurrent()
        model.openTask(model.state.value.tasks.single())
        model.updateEditDraft {
            it.copy(plannedOn = null, plannedTime = null, deadlineAt = null, remindAt = null)
        }

        assertTrue(model.saveEdit())
        runCurrent()

        val saved = model.state.value.tasks.single()
        assertEquals(deadline, saved.deadlineAt)
        assertEquals(plannedOn, saved.plannedOn)
        assertEquals(90, saved.plannedTime)
        assertEquals(remindAt, saved.remindAt)
        val sent = backend.updateCalls.single().second
        assertEquals(deadline, sent.deadlineAt)
        assertEquals(plannedOn, sent.plannedOn)
        assertEquals(90, sent.plannedTime)
        assertEquals(remindAt, sent.remindAt)
    }

    @Test
    fun `the editor rejects a blank title`() = runTest {
        model.openTask(model.state.value.tasks.single())
        model.updateEditDraft { it.copy(title = "   ") }

        assertFalse(model.saveEdit())
        assertTrue(backend.updateCalls.isEmpty())
        assertNotNull(model.state.value.errorMessage)
    }

    // MARK: - Two clocks

    @Test
    fun `editing a deadline does not move the planned day`() = runTest {
        val task = TaskItem("1", "File taxes", done = false, plannedOn = 1_767_312_000_000L)
        backend.emit(listOf(task))
        runCurrent()
        model.openTask(task)

        model.updateEditDraft { it.copy(deadlineAt = 1_767_400_000_000L) }
        model.saveEdit()

        val saved = backend.updateCalls.single().second
        assertEquals(1_767_312_000_000L, saved.plannedOn)
        assertEquals(1_767_400_000_000L, saved.deadlineAt)
        assertEquals(1_767_312_000_000L, model.state.value.tasks.single().plannedDay)
    }

    @Test
    fun `the composer keeps the deadline out of the planned day`() = runTest {
        model.updateDraft("File taxes")
        model.setDraftDeadlineAt(1_767_400_000_000L)

        assert(model.addTask())
        runCurrent()

        val draft = backend.createDraftCalls.single()
        assertNull(draft.plannedOn)
        assertEquals(1_767_400_000_000L, draft.deadlineAt)
    }

    @Test
    fun `the planned time is stored as minutes and never as an instant`() = runTest {
        model.updateDraft("Standup")
        model.setDraftPlannedOn(1_767_378_600_000L)
        model.setDraftPlannedTime(570)

        assert(model.addTask())
        runCurrent()

        val draft = backend.createDraftCalls.single()
        assertEquals(570, draft.plannedTime)
        assertEquals(DueDateMath.startOfDay(1_767_378_600_000L), draft.plannedOn)
    }

    @Test
    fun `an out of range planned time is ignored`() = runTest {
        model.setDraftPlannedTime(1440)

        assertNull(model.state.value.draft.plannedTime)
    }

    @Test
    fun `delete still calls the existing remove mutation`() = runTest {
        model.delete(model.state.value.tasks.single())
        runCurrent()

        assertEquals(listOf("1"), backend.deleteCalls)
        assertTrue(model.state.value.tasks.isEmpty())
    }

    // MARK: - Home shell

    @Test
    fun `the plus button composes a task in the current slice`() = runTest {
        model.updateDraft("Dishes")
        model.selectSlice(TaskSlice.DAILY)

        assertTrue(model.addTaskInCurrentSlice())
        runCurrent()

        val draft = backend.createDraftCalls.single()
        assertEquals(DueDateMath.startOfDay(now), draft.plannedOn)
    }

    @Test
    fun `the plus button composes into the tasks slice without prefilling a day`() = runTest {
        model.updateDraft("Dishes")
        model.selectSlice(TaskSlice.TASKS)

        assertTrue(model.addTaskInCurrentSlice())
        runCurrent()

        assertNull(backend.createDraftCalls.single().plannedOn)
    }

    private class RecordingBackend(
        initial: List<TaskItem>,
    ) : TaskBackend {
        private val items = MutableStateFlow(initial)
        private val status = MutableStateFlow(ConnectionStatus.CONNECTED)
        var failMutations = false
        val createCalls = mutableListOf<Pair<String, Long?>>()
        val createDraftCalls = mutableListOf<TaskDraft>()
        val doneCalls = mutableListOf<Pair<String, Boolean>>()
        val seenCalls = mutableListOf<String>()
        val updateCalls = mutableListOf<Pair<String, TaskDraft>>()
        val deleteCalls = mutableListOf<String>()

        fun emit(tasks: List<TaskItem>) {
            items.value = tasks
        }

        override suspend fun ensureUser() = Unit
        override fun taskUpdates(): Flow<List<TaskItem>> = items
        override fun connectionUpdates(): Flow<ConnectionStatus> = status

        override suspend fun createTask(title: String, dueAt: Long?) {
            if (failMutations) error("create failed")
            createCalls += title to dueAt
        }

        override suspend fun createTask(draft: TaskDraft) {
            if (failMutations) error("create failed")
            createDraftCalls += draft
        }

        override suspend fun setTask(id: String, done: Boolean) {
            if (failMutations) error("setDone failed")
            doneCalls += id to done
        }

        override suspend fun markSeen(id: String) {
            if (failMutations) error("markSeen failed")
            seenCalls += id
        }

        override suspend fun updateTask(id: String, draft: TaskDraft) {
            if (failMutations) error("update failed")
            updateCalls += id to draft
        }

        override suspend fun deleteTask(id: String) {
            if (failMutations) error("delete failed")
            deleteCalls += id
        }
    }
}
