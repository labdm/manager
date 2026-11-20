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
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class TaskBoardModelTest {

    private lateinit var backend: RecordingBackend
    private lateinit var model: TaskBoardModel

    @Before
    fun setUp() {
        kotlinx.coroutines.Dispatchers.setMain(UnconfinedTestDispatcher())
        backend = RecordingBackend(
            listOf(TaskItem("1", "Buy milk", done = false, dueAt = 1_767_321_600_000L))
        )
        model = TaskBoardModel(backend)
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

        assertEquals("Buy bread" to DueDateMath.startOfDay(millis), backend.createCalls.single())
        assertEquals("", model.state.value.draftTitle)
        assertNull(model.state.value.draftDueAt)
    }

    @Test
    fun `empty draft cannot be submitted`() = runTest {
        assert(!model.addTask())
        assert(backend.createCalls.isEmpty())
    }

    private class RecordingBackend(
        initial: List<TaskItem>,
    ) : TaskBackend {
        private val items = MutableStateFlow(initial)
        private val status = MutableStateFlow(ConnectionStatus.CONNECTED)
        var failMutations = false
        val createCalls = mutableListOf<Pair<String, Long?>>()
        val doneCalls = mutableListOf<Pair<String, Boolean>>()
        val deleteCalls = mutableListOf<String>()

        override suspend fun ensureUser() = Unit
        override fun taskUpdates(): Flow<List<TaskItem>> = items
        override fun connectionUpdates(): Flow<ConnectionStatus> = status

        override suspend fun createTask(title: String, dueAt: Long?) {
            if (failMutations) error("create failed")
            createCalls += title to dueAt
        }

        override suspend fun setTask(id: String, done: Boolean) {
            if (failMutations) error("setDone failed")
            doneCalls += id to done
        }

        override suspend fun deleteTask(id: String) {
            if (failMutations) error("delete failed")
            deleteCalls += id
        }
    }
}
