package dev.labdm.manager.kit

import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

/** Tasks-page activity is a who-filter. Opening a row stamps seen only after a write. */
@OptIn(ExperimentalCoroutinesApi::class)
class ShellFeedTest {

    private val now = 1_767_321_600_000L

    @Before
    fun setUp() {
        kotlinx.coroutines.Dispatchers.setMain(UnconfinedTestDispatcher())
    }

    @After
    fun tearDown() {
        kotlinx.coroutines.Dispatchers.resetMain()
    }

    @Test
    fun `tasks keeps read activity from other people and messages keeps everyone`() = runTest {
        val backend = InMemoryTaskBackend(now = { now })
        val model = TaskBoardModel(
            backend,
            now = { now },
            initialState = BoardState(
                board = BoardSnapshot(
                    alerts = listOf(
                        BoardAlert("agent", "Agent", source = TaskOrigin.AGENT),
                        BoardAlert("read", "Read", source = TaskOrigin.MEMBER, seenAt = 1L),
                        BoardAlert("self", "Self", source = TaskOrigin.SELF),
                        BoardAlert("missing", "Missing"),
                    ),
                ),
            ),
        )

        assertEquals(
            listOf("Agent", "Read", "Missing"),
            model.rowsFor(ShellDestination.TASKS, BoardChip.ALL).map { it.title },
        )
        assertEquals(
            listOf("Agent", "Read", "Self", "Missing"),
            model.rowsFor(ShellDestination.MESSAGES, BoardChip.ALL).map { it.title },
        )

        model.setActivityOnTasks(ActivityOnTasks.NONE)
        assertTrue(model.rowsFor(ShellDestination.TASKS, BoardChip.ALL).isEmpty())
        assertEquals(4, model.rowsFor(ShellDestination.MESSAGES, BoardChip.ALL).size)
    }

    @Test
    fun `opening a message stamps seen only after alerts read succeeds`() = runTest {
        val backend = InMemoryTaskBackend(now = { now })
        val alert = BoardAlert("agent", "Agent", source = TaskOrigin.AGENT)
        val model = TaskBoardModel(
            backend,
            now = { now },
            initialState = BoardState(board = BoardSnapshot(alerts = listOf(alert))),
        )
        val row = model.rowsFor().single()

        backend.failWrites = true
        model.selectRow(row)
        assertNull(model.state.value.board.alerts.single().seenAt)
        assertTrue(model.rowsFor().single().unseen)

        backend.failWrites = false
        model.selectRow(row)
        assertEquals(now, model.state.value.board.alerts.single().seenAt)
        assertEquals(listOf("agent"), backend.markedAlertIds)
        assertEquals(listOf("Agent"), model.rowsFor(ShellDestination.TASKS).map { it.title })
    }

    @Test
    fun `opening an invite does not stamp seen and a failed decision restores it`() = runTest {
        val backend = InMemoryTaskBackend(now = { now })
        val invite = InviteItem(id = "i1", groupId = "default", groupName = "Personal", title = "Ada")
        val model = TaskBoardModel(
            backend,
            now = { now },
            initialState = BoardState(invites = listOf(invite)),
        )
        val row = model.rowsFor(ShellDestination.GROUPS).first { it.kind == ShellRowKind.INVITE }

        model.selectRow(row)
        assertNull(model.state.value.invites.single().seenAt)

        backend.failWrites = true
        model.acceptInvite("i1")
        assertEquals("i1", model.state.value.invites.single().id)
        assertNull(model.state.value.invites.single().seenAt)
    }

    @Test
    fun `a cron routing records name cadence and task title`() = runTest {
        val backend = InMemoryTaskBackend(now = { now })
        val model = TaskBoardModel(backend, now = { now })

        assertTrue(model.createRouting("Morning", "weekly", "Dishes"))
        assertEquals(Triple("Morning", "weekly", "Dishes"), backend.routingsCreated.single())
    }

    @Test
    fun `a failed activity setting returns to the previous value`() = runTest {
        val backend = InMemoryTaskBackend(now = { now })
        val model = TaskBoardModel(backend, now = { now })
        backend.failWrites = true

        model.setActivityOnTasks(ActivityOnTasks.ALL)

        assertEquals(ActivityOnTasks.OTHERS, model.state.value.activityOnTasks)
    }
}
