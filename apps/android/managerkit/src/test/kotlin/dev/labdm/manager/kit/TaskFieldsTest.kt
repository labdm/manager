package dev.labdm.manager.kit

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import java.util.TimeZone

class TaskFieldsTest {
    @Test
    fun `normalize trims and collapses whitespace`() {
        assertEquals("Buy milk", TaskTitle.normalize("  Buy   milk  "))
        assertEquals("A B", TaskTitle.normalize("A\nB"))
    }

    @Test
    fun `normalize rejects blank and overlong titles`() {
        assertNull(TaskTitle.normalize("   "))
        assertNull(TaskTitle.normalize("x".repeat(TaskTitle.MAX_LENGTH + 1)))
        assertEquals(TaskTitle.MAX_LENGTH, TaskTitle.normalize("x".repeat(TaskTitle.MAX_LENGTH))?.length)
    }

    @Test
    fun `start of day uses the supplied time zone`() {
        val utc = TimeZone.getTimeZone("UTC")
        // 2026-01-02T15:30:00Z
        val millis = 1_767_378_600_000L
        assertEquals(1_767_312_000_000L, DueDateMath.startOfDay(millis, utc))
    }
}
