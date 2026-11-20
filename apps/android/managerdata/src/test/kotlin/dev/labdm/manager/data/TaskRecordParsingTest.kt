package dev.labdm.manager.data

import dev.convex.android.Float64ToDoubleDecoder
import dev.convex.android.Int64ToIntDecoder
import dev.convex.android.Int64ToLongDecoder
import dev.convex.android.Float64ToFloatDecoder
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.modules.SerializersModule
import kotlinx.serialization.modules.contextual
import org.junit.Assert.assertEquals
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
        val wire = taskJson("\"dueAt\":{\"${'$'}float\":\"${encodeDouble(dueAt)}\"}")

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
    fun `a plain Double cannot decode the tagged field`() {
        val wire = taskJson("\"dueAt\":{\"${'$'}float\":\"${encodeDouble(1.0)}\"}")
        val failure = runCatching { convexJson.decodeFromString<PlainDoubleRecord>(wire) }
            .exceptionOrNull()
        assertTrue("plain Double must not silently decode a tagged Convex number", failure != null)
    }

    private fun taskJson(dueAtField: String) =
        "{\"id\":\"k1\",\"title\":\"Buy milk\",\"done\":false,\"ownerId\":\"u1\",$dueAtField}"

    /** Convex stores finite doubles as little-endian IEEE-754 bytes in base64. */
    private fun encodeDouble(value: Double): String {
        val bytes = ByteBuffer.allocate(java.lang.Double.BYTES)
            .order(ByteOrder.LITTLE_ENDIAN)
            .putDouble(value)
            .array()
        return Base64.getEncoder().encodeToString(bytes)
    }

    @Serializable
    private data class PlainDoubleRecord(val dueAt: Double?)
}
