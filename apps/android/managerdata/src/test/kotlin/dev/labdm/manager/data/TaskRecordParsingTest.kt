package dev.labdm.manager.data

import dev.convex.android.Float64ToDoubleDecoder
import dev.convex.android.Int64ToIntDecoder
import dev.convex.android.Int64ToLongDecoder
import dev.convex.android.Float64ToFloatDecoder
import dev.labdm.manager.kit.OverduePolicy
import dev.labdm.manager.kit.Priority
import dev.labdm.manager.kit.TaskOrigin
import dev.labdm.manager.kit.TaskOutcome
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.modules.SerializersModule
import kotlinx.serialization.modules.contextual
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.util.Base64

/**
 * Convex encodes JavaScript numbers as tagged `$float` objects on the wire.
 * These tests use the same Json configuration as ConvexClient's internal
 * decoder so they catch a regression from plain Double or from an untagged
 * fixture.
 *
 * Every optional numeric M1 field is checked, not only `dueAt`: they all cross
 * the same number format, and one plain `Double` would fail at runtime on a
 * real payload.
 */
class TaskRecordParsingTest {

    private val convexJson = Json {
        ignoreUnknownKeys = true
        allowSpecialFloatingPointValues = true
        serializersModule = SerializersModule {
            contextual(Int64ToIntDecoder)
            contextual(Int64ToLongDecoder)
            contextual(Float64ToFloatDecoder)
            contextual(Float64ToDoubleDecoder)
        }
    }

    @Test
    fun `decodes tagged dueAt into an epoch millisecond Long`() {
        val dueAt = 1_767_321_600_000.0
        val wire = taskJson("\"dueAt\":${tagged(dueAt)}")

        val record = convexJson.decodeFromString<TaskRecord>(wire)

        assertEquals(dueAt, record.dueAt)
        assertEquals(dueAt.toLong(), record.toItem().dueAt)
        assertEquals("Buy milk", record.toItem().title)
        assertEquals("k1", record.toItem().id)
        assertEquals(false, record.toItem().done)
    }

    @Test
    fun `decodes a null dueAt`() {
        val record = convexJson.decodeFromString<TaskRecord>(taskJson("\"dueAt\":null"))
        assertNull(record.dueAt)
        assertNull(record.toItem().dueAt)
    }

    @Test
    fun `decodes a plain JSON number too`() {
        val record = convexJson.decodeFromString<TaskRecord>(taskJson("\"dueAt\":42.0"))
        assertEquals(42.0, record.dueAt)
    }

    @Test
    fun `decodes every tagged M1 fact`() {
        val plannedOn = 1_767_312_000_000.0
        val deadlineAt = 1_767_400_000_000.0
        val remindAt = 1_767_390_000_000.0
        val seenAt = 1_767_321_600_000.0
        val completedAt = 1_767_330_000_000.0
        val wire = taskJson(
            "\"dueAt\":${tagged(plannedOn)}," +
                "\"plannedOn\":${tagged(plannedOn)}," +
                "\"plannedTime\":${tagged(570.0)}," +
                "\"deadlineAt\":${tagged(deadlineAt)}," +
                "\"remindAt\":${tagged(remindAt)}," +
                "\"seenAt\":${tagged(seenAt)}," +
                "\"completedAt\":${tagged(completedAt)}," +
                "\"notes\":\"Oat milk\"," +
                "\"location\":\"Corner shop\"," +
                "\"priority\":\"high\"," +
                "\"priorityRank\":${tagged(20.0)}," +
                "\"effectiveRank\":${tagged(30.0)}," +
                "\"overdue\":true," +
                "\"overduePolicy\":\"escalate\"," +
                "\"outcome\":\"missed\"," +
                "\"origin\":\"agent\""
        )

        val item = convexJson.decodeFromString<TaskRecord>(wire).toItem()

        assertEquals(plannedOn.toLong(), item.plannedDay)
        assertEquals(570, item.plannedTime)
        assertEquals(deadlineAt.toLong(), item.deadlineAt)
        assertEquals(remindAt.toLong(), item.remindAt)
        assertEquals(seenAt.toLong(), item.seenAt)
        assertEquals(completedAt.toLong(), item.completedAt)
        assertEquals("Oat milk", item.notes)
        assertEquals("Corner shop", item.location)
        assertEquals(Priority.HIGH, item.priority)
        assertEquals(20, item.priorityRank)
        assertEquals(30, item.effectiveRank)
        assertTrue(item.overdue)
        assertEquals(OverduePolicy.ESCALATE, item.overduePolicy)
        assertEquals(TaskOutcome.MISSED, item.outcome)
        assertEquals(TaskOrigin.AGENT, item.origin)
        // An agent row with seenAt is not NEW.
        assertFalse(item.isNew)
    }

    @Test
    fun `an agent row without seenAt is NEW`() {
        val item = convexJson.decodeFromString<TaskRecord>(taskJson("\"origin\":\"agent\"")).toItem()

        assertTrue(item.isNew)
    }

    @Test
    fun `an older payload with no M1 fields decodes with defaults`() {
        val item = convexJson.decodeFromString<TaskRecord>(taskJson("\"dueAt\":null")).toItem()

        assertNull(item.notes)
        assertNull(item.plannedOn)
        assertNull(item.plannedTime)
        assertNull(item.deadlineAt)
        assertNull(item.remindAt)
        assertNull(item.priority)
        assertNull(item.origin)
        assertNull(item.seenAt)
        assertNull(item.completedAt)
        assertEquals(OverduePolicy.NONE, item.overduePolicy)
        assertFalse(item.overdue)
        assertFalse(item.isNew)
    }

    @Test
    fun `an unknown priority string survives and an unknown policy falls back to none`() {
        val item = convexJson.decodeFromString<TaskRecord>(
            taskJson("\"priority\":\"someday\",\"overduePolicy\":\"carry_forward\"")
        ).toItem()

        assertEquals(Priority("someday"), item.priority)
        assertNull(item.priority?.seedRank)
        assertEquals(OverduePolicy.NONE, item.overduePolicy)
    }

    @Test
    fun `a plain Double cannot decode a tagged optional M1 field`() {
        val wire = taskJson("\"deadlineAt\":${tagged(1.0)}")
        val failure = runCatching { convexJson.decodeFromString<PlainDoubleRecord>(wire) }
            .exceptionOrNull()
        assertTrue("plain Double must not silently decode a tagged Convex number", failure != null)
    }

    @Test
    fun `a plain Double cannot decode the tagged dueAt either`() {
        val wire = taskJson("\"dueAt\":${tagged(1.0)}")
        val failure = runCatching { convexJson.decodeFromString<PlainDoubleRecord>(wire) }
            .exceptionOrNull()
        assertTrue("plain Double must not silently decode a tagged Convex number", failure != null)
    }

    private fun taskJson(fields: String) =
        "{\"id\":\"k1\",\"title\":\"Buy milk\",\"done\":false,\"ownerId\":\"u1\"," +
            fields.removeSuffix(",") + "}"

    private fun tagged(value: Double): String = "{\"${'$'}float\":\"${encodeDouble(value)}\"}"

    /** Convex stores finite doubles as little-endian IEEE-754 bytes in base64. */
    private fun encodeDouble(value: Double): String {
        val bytes = ByteBuffer.allocate(java.lang.Double.BYTES)
            .order(ByteOrder.LITTLE_ENDIAN)
            .putDouble(value)
            .array()
        return Base64.getEncoder().encodeToString(bytes)
    }

    @Serializable
    private data class PlainDoubleRecord(
        val dueAt: Double? = null,
        val deadlineAt: Double? = null,
    )
}
