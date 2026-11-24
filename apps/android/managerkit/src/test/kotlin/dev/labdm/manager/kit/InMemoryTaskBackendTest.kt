package dev.labdm.manager.kit

import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * The in-memory backend is what the board's unit tests run against, so it has
 * to reproduce the server's M1 rules: soft delete hides a row, your own create
 * is seen, and opening an agent row stamps it.
 */
class InMemoryTaskBackendTest {

    private val now = 1_767_321_600_000L
    private val dayStart: Long = DueDateMath.startOfDay(now)
    private val twoDaysBefore: Long = dayStart - 2 * 86_400_000L

    private fun backend(initial: List<TaskItem> = emptyList()) =
        InMemoryTaskBackend(initial, now = { now })

    @Test
    fun `soft delete hides the row from the list but keeps it stored`() = runTest {
        val backend = backend(listOf(TaskItem("1", "Buy milk", done = false)))

        backend.deleteTask("1")

        assertTrue(backend.allTasks.isEmpty())
        assertTrue(backend.taskUpdates().first().isEmpty())
        assertEquals(listOf("1"), backend.trashedTasks.map { it.id })
    }

    @Test
    fun `a create from the app is self and already seen`() = runTest {
        val backend = backend()

        backend.createTask(TaskDraft(title = "Play Witcher"))

        val created = backend.allTasks.single()
        assertEquals(TaskOrigin.SELF, created.origin)
        assertEquals(now, created.seenAt)
        assertFalse(created.isNew)
    }

    @Test
    fun `a create writes the planned day to both wire names and no deadline`() = runTest {
        val backend = backend()
        val day = 1_767_312_000_000L

        backend.createTask(TaskDraft(title = "Buy milk", plannedOn = day))

        val created = backend.allTasks.single()
        assertEquals(day, created.plannedOn)
        assertEquals(day, created.dueAt)
        assertNull(created.deadlineAt)
    }

    @Test
    fun `a deadline on create does not write the planned day`() = runTest {
        val backend = backend()
        val deadline = 1_767_400_000_000L

        backend.createTask(TaskDraft(title = "File taxes", deadlineAt = deadline))

        val created = backend.allTasks.single()
        assertEquals(deadline, created.deadlineAt)
        assertNull(created.plannedOn)
        assertNull(created.dueAt)
    }

    @Test
    fun `markSeen stamps an agent row once and leaves it NEW until then`() = runTest {
        val backend = backend(listOf(TaskItem("1", "Install Omarchy", done = false, origin = TaskOrigin.AGENT)))

        assertTrue(backend.allTasks.single().isNew)

        backend.markSeen("1")

        val seen = backend.allTasks.single()
        assertEquals(now, seen.seenAt)
        assertFalse(seen.isNew)
    }

    @Test
    fun `markSeen does not overwrite an existing seenAt`() = runTest {
        val earlier = 1_700_000_000_000L
        val backend = backend(
            listOf(
                TaskItem(
                    "1",
                    "Install Omarchy",
                    done = false,
                    origin = TaskOrigin.AGENT,
                    seenAt = earlier,
                )
            )
        )

        backend.markSeen("1")

        assertEquals(earlier, backend.allTasks.single().seenAt)
    }

    @Test
    fun `update writes the editable facts without inventing a deadline`() = runTest {
        val backend = backend(listOf(TaskItem("1", "Buy milk", done = false)))
        val task = backend.allTasks.single()
        val day = 1_767_312_000_000L

        backend.updateTask(
            "1",
            TaskDraft.from(task).copy(
                notes = "Oat milk",
                plannedOn = day,
                plannedTime = 570,
                location = "Corner shop",
                priority = Priority.HIGH,
                overduePolicy = OverduePolicy.ESCALATE,
            ),
        )

        val updated = backend.allTasks.single()
        assertEquals("Oat milk", updated.notes)
        assertEquals(day, updated.plannedDay)
        assertEquals(570, updated.plannedTime)
        assertEquals("Corner shop", updated.location)
        assertEquals(Priority.HIGH, updated.priority)
        assertEquals(20, updated.priorityRank)
        assertEquals(OverduePolicy.ESCALATE, updated.overduePolicy)
        assertNull(updated.deadlineAt)
    }

    @Test
    fun `update moves the deadline without moving the planned day`() = runTest {
        val backend = backend(listOf(TaskItem("1", "File taxes", done = false, plannedOn = 1_767_312_000_000L)))
        val deadline = 1_767_400_000_000L

        backend.updateTask("1", TaskDraft.from(backend.allTasks.single()).copy(deadlineAt = deadline))

        val updated = backend.allTasks.single()
        assertEquals(1_767_312_000_000L, updated.plannedDay)
        assertEquals(deadline, updated.deadlineAt)
    }

    @Test
    fun `setDone keeps using an explicit setter`() = runTest {
        val backend = backend(listOf(TaskItem("1", "Buy milk", done = false)))

        backend.setTask("1", true)
        backend.setTask("1", true)

        assertTrue(backend.allTasks.single().done)
        assertNotNull(backend.allTasks.single().completedAt)
    }

    @Test
    fun `legacy createTask still works and defaults the priority`() = runTest {
        val backend = backend()

        backend.createTask("Buy bread", 1_767_312_000_000L)

        val created = backend.allTasks.single()
        assertEquals("Buy bread", created.title)
        assertEquals(1_767_312_000_000L, created.plannedDay)
        assertEquals(Priority.NORMAL, created.priority)
        assertEquals(10, created.priorityRank)
    }

    // MARK: - Replace and stack

    @Test
    fun `a replace daily series supersedes the older period and keeps one open row`() = runTest {
        val backend = backend(
            listOf(
                TaskItem(
                    id = "1",
                    title = "Wash dishes",
                    done = false,
                    plannedOn = twoDaysBefore,
                    recurrenceId = "dishes",
                    periodStart = twoDaysBefore,
                    behavior = TaskBehavior.REPLACE,
                ),
            ),
        )

        backend.reconcile(now)

        // The open board keeps one row; the missed period is superseded and left behind.
        assertEquals(1, backend.allTasks.count { TaskFacts.isOpen(it) })
        assertEquals(TaskOutcome.SUPERSEDED, backend.storedTasks.first { it.id == "1" }.outcome)
    }

    @Test
    fun `a stack daily journal keeps every open period`() = runTest {
        val backend = backend(
            listOf(
                TaskItem(
                    id = "1",
                    title = "Journal",
                    done = false,
                    plannedOn = twoDaysBefore,
                    recurrenceId = "journal",
                    periodStart = twoDaysBefore,
                    behavior = TaskBehavior.STACK,
                ),
                TaskItem(
                    id = "2",
                    title = "Journal",
                    done = false,
                    plannedOn = twoDaysBefore + 86_400_000L,
                    recurrenceId = "journal",
                    periodStart = twoDaysBefore + 86_400_000L,
                    behavior = TaskBehavior.STACK,
                ),
                TaskItem(
                    id = "3",
                    title = "Journal",
                    done = false,
                    plannedOn = dayStart,
                    recurrenceId = "journal",
                    periodStart = dayStart,
                    behavior = TaskBehavior.STACK,
                ),
            ),
        )

        backend.reconcile(now)

        // A stack keeps every period open, so a missed day never closes the next one.
        assertEquals(3, backend.allTasks.count { TaskFacts.isOpen(it) })
    }

    @Test
    fun `a second reconcile does not duplicate the mint`() = runTest {
        val backend = backend(
            listOf(
                TaskItem(
                    id = "1",
                    title = "Wash dishes",
                    done = false,
                    plannedOn = twoDaysBefore,
                    recurrenceId = "dishes",
                    periodStart = twoDaysBefore,
                    behavior = TaskBehavior.REPLACE,
                ),
            ),
        )

        backend.reconcile(now)
        backend.reconcile(now)

        assertEquals(1, backend.allTasks.count { TaskFacts.isOpen(it) })
        // One superseded row plus the minted open row: nothing was minted twice.
        assertEquals(2, backend.storedTasks.size)
        assertEquals(1, backend.storedTasks.count { TaskFacts.isOpen(it) })
    }
}
