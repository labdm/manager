package dev.labdm.manager.kit

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.util.TimeZone

class TaskFactsTest {

    // MARK: - NEW

    @Test
    fun `an agent row without seenAt is NEW`() {
        val task = TaskItem("1", "Install Omarchy", done = false, origin = TaskOrigin.AGENT)

        assertTrue(task.isNew)
    }

    @Test
    fun `a member row without seenAt is NEW`() {
        val task = TaskItem("1", "Take out the bins", done = false, origin = TaskOrigin.MEMBER)

        assertTrue(task.isNew)
    }

    @Test
    fun `a missing origin is not NEW even when seenAt is absent`() {
        // Rows written before M1 have neither field. They are not NEW.
        val task = TaskItem("1", "Old chore", done = false)

        assertFalse(task.isNew)
    }

    @Test
    fun `a self row is not NEW`() {
        val task = TaskItem(
            "1",
            "Play Witcher",
            done = false,
            origin = TaskOrigin.SELF,
            seenAt = 1_700_000_000_000L,
        )

        assertFalse(task.isNew)
    }

    @Test
    fun `an agent row stops being NEW once seenAt is set`() {
        val unseen = TaskItem("1", "Install Omarchy", done = false, origin = TaskOrigin.AGENT)

        assertFalse(unseen.withSeen(1_767_321_600_000L).isNew)
    }

    // MARK: - Overdue and rank

    @Test
    fun `overdue needs a deadline in the past on an open row`() {
        val deadline = 1_000L

        assertFalse(TaskFacts.isOverdue(deadlineAt = null, done = false, now = 2_000L))
        assertFalse(TaskFacts.isOverdue(deadlineAt = deadline, done = false, now = 500L))
        assertFalse(TaskFacts.isOverdue(deadlineAt = deadline, done = true, now = 2_000L))
        assertTrue(TaskFacts.isOverdue(deadlineAt = deadline, done = false, now = 2_000L))
    }

    @Test
    fun `escalate bumps a seed rank by ten and caps at thirty`() {
        assertEquals(
            20,
            TaskFacts.effectiveRank(Priority.NORMAL, 10, overdue = true, overduePolicy = OverduePolicy.ESCALATE),
        )
        assertEquals(
            30,
            TaskFacts.effectiveRank(Priority.HIGH, 20, overdue = true, overduePolicy = OverduePolicy.ESCALATE),
        )
        assertEquals(
            30,
            TaskFacts.effectiveRank(Priority.URGENT, 30, overdue = true, overduePolicy = OverduePolicy.ESCALATE),
        )
    }

    @Test
    fun `a non-overdue or non-escalating row keeps its rank`() {
        assertEquals(
            10,
            TaskFacts.effectiveRank(Priority.NORMAL, 10, overdue = false, overduePolicy = OverduePolicy.ESCALATE),
        )
        assertEquals(
            10,
            TaskFacts.effectiveRank(Priority.NORMAL, 10, overdue = true, overduePolicy = OverduePolicy.RETIRE),
        )
        assertEquals(
            10,
            TaskFacts.effectiveRank(Priority.NORMAL, 10, overdue = true, overduePolicy = OverduePolicy.NONE),
        )
    }

    @Test
    fun `a custom priority string keeps its rank and still reports overdue`() {
        val custom = Priority("whenever")
        val effective = TaskFacts.effectiveRank(custom, 5, overdue = true, overduePolicy = OverduePolicy.ESCALATE)

        assertEquals(5, effective)
        assertFalse(custom.isSeed)
    }

    // MARK: - Wire parsing

    @Test
    fun `priority parses the seed strings and falls back for unknown ones`() {
        assertEquals(Priority.HIGH, Priority.fromWire("high"))
        assertEquals(20, Priority.fromWire("high")?.seedRank)
        assertNull(Priority.fromWire(null))
        assertNull(Priority.fromWire("  "))
        // An unknown string survives instead of collapsing onto a seed.
        assertEquals(Priority("someday"), Priority.fromWire("someday"))
        assertNull(Priority.fromWire("someday")?.seedRank)
    }

    @Test
    fun `overdue policy defaults to none and only parses the three seeds`() {
        assertEquals(OverduePolicy.ESCALATE, OverduePolicy.fromWire("escalate"))
        assertEquals(OverduePolicy.RETIRE, OverduePolicy.fromWire("retire"))
        assertEquals(OverduePolicy.NONE, OverduePolicy.fromWire("none"))
        assertEquals(OverduePolicy.NONE, OverduePolicy.fromWire(null))
        assertEquals(OverduePolicy.NONE, OverduePolicy.fromWire("carry_forward"))
    }

    @Test
    fun `origin and outcome ignore values they do not know`() {
        assertEquals(TaskOrigin.AGENT, TaskOrigin.fromWire("agent"))
        assertEquals(TaskOrigin.MEMBER, TaskOrigin.fromWire("member"))
        assertEquals(TaskOrigin.SELF, TaskOrigin.fromWire("self"))
        assertNull(TaskOrigin.fromWire(null))
        assertNull(TaskOrigin.fromWire("robot"))

        assertEquals(TaskOutcome.SUPERSEDED, TaskOutcome.fromWire("superseded"))
        assertEquals(TaskOutcome.MISSED, TaskOutcome.fromWire("missed"))
        assertNull(TaskOutcome.fromWire(null))
        assertNull(TaskOutcome.fromWire("deleted"))
    }

    // MARK: - The two clocks

    @Test
    fun `the planned day is one fact under two wire names`() {
        assertEquals(1_767_312_000_000L, TaskItem("1", "t", false, dueAt = 1_767_312_000_000L).plannedDay)
        assertEquals(1_767_312_000_000L, TaskItem("1", "t", false, plannedOn = 1_767_312_000_000L).plannedDay)
    }

    @Test
    fun `editing a deadline leaves the planned day alone`() {
        val task = TaskItem("1", "File taxes", done = false, plannedOn = 1_767_312_000_000L)

        val edited = task.withDraft(
            TaskDraft.from(task).copy(deadlineAt = 1_767_400_000_000L),
        )

        assertEquals(1_767_312_000_000L, edited.plannedDay)
        assertEquals(1_767_400_000_000L, edited.deadlineAt)
    }

    @Test
    fun `deleting the planned day leaves the deadline alone`() {
        val task = TaskItem(
            "1",
            "File taxes",
            done = false,
            plannedOn = 1_767_312_000_000L,
            deadlineAt = 1_767_400_000_000L,
        )

        val edited = task.withDraft(TaskDraft.from(task).copy(plannedOn = null, plannedTime = null))

        assertNull(edited.plannedDay)
        assertNull(edited.dueAt)
        assertEquals(1_767_400_000_000L, edited.deadlineAt)
    }

    @Test
    fun `setting the planned day never writes the deadline`() {
        val task = TaskItem("1", "Buy milk", done = false)

        val edited = task.withDraft(TaskDraft.from(task).copy(plannedOn = 1_767_312_000_000L))

        assertEquals(1_767_312_000_000L, edited.plannedDay)
        assertNull(edited.deadlineAt)
    }

    @Test
    fun `completion stamps completedAt and clearing done removes it`() {
        val task = TaskItem("1", "Buy milk", done = false)

        val done = task.withDone(true, now = 1_767_321_600_000L)
        assertEquals(1_767_321_600_000L, done.completedAt)

        assertNull(done.withDone(false, now = 1_767_400_000_000L).completedAt)
    }

    // MARK: - Planned time

    @Test
    fun `planned time is minutes from midnight`() {
        assertTrue(PlannedTimeMath.isValid(null))
        assertTrue(PlannedTimeMath.isValid(0))
        assertTrue(PlannedTimeMath.isValid(1439))
        assertFalse(PlannedTimeMath.isValid(-1))
        assertFalse(PlannedTimeMath.isValid(1440))
        assertEquals("09:30", PlannedTimeMath.label(570, java.util.Locale.US))
        assertEquals("00:00", PlannedTimeMath.label(0, java.util.Locale.US))
    }

    @Test
    fun `planned time combines with the planned day, not with today`() {
        val utc = TimeZone.getTimeZone("UTC")
        val day = 1_767_312_000_000L // 2026-01-02T00:00:00Z

        assertEquals(day + 9 * 3_600_000L + 30 * 60_000L, PlannedTimeMath.instantOn(day, 570, utc))
        assertEquals(570, PlannedTimeMath.minutesOf(day + 9 * 3_600_000L + 30 * 60_000L, utc))
    }

    @Test
    fun `an omitted priority resolves to normal and ten`() {
        val draft = TaskDraft(title = "Buy milk")

        assertEquals(Priority.NORMAL, draft.resolvedPriority)
        assertEquals(10, draft.resolvedPriorityRank)
    }
}
