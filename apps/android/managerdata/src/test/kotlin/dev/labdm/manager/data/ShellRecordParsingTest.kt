package dev.labdm.manager.data

import dev.convex.android.Float64ToDoubleDecoder
import dev.convex.android.Float64ToFloatDecoder
import dev.convex.android.Int64ToIntDecoder
import dev.convex.android.Int64ToLongDecoder
import dev.labdm.manager.kit.QuestStep
import kotlinx.serialization.json.Json
import kotlinx.serialization.modules.SerializersModule
import kotlinx.serialization.modules.contextual
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.util.Base64

/** Tagged-number guards for the new shell's wire records. */
class ShellRecordParsingTest {

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
    fun `board slice decodes tagged timestamps meters and positions`() {
        val seenAt = 1_767_321_600_000.0
        val wire =
            """
            {
              "rail": [{"id":"home","title":"Home","kind":"home"}],
              "alerts": [{"id":"a1","title":"Agent","source":"agent","seenAt":${tagged(seenAt)}}],
              "questions": [{
                "id":"q1","prompt":"Pick one",
                "options":[{"id":"o1","label":"Yes","position":${tagged(2.0)}}]
              }],
              "progressions": [{
                "id":"p1","title":"Pages","current":${tagged(40.0)},"target":${tagged(120.0)},"unit":"pages"
              }],
              "quests": [{
                "id":"quest1","title":"Chain",
                "steps":[{"title":"Step one","gate":"available","position":${tagged(0.0)}}]
              }]
            }
            """.trimIndent()

        val snapshot = convexJson.decodeFromString<BoardSliceRecord>(wire).toSnapshot()

        assertEquals(listOf("home"), snapshot.views.map { it.id })
        assertEquals(seenAt.toLong(), snapshot.alerts.single().seenAt)
        assertEquals(2, snapshot.questions.single().options.single().position)
        assertEquals(40, snapshot.progressions.single().current)
        assertEquals(120, snapshot.progressions.single().target)
        assertEquals(QuestStep.QuestGate.AVAILABLE, snapshot.quests.single().steps.single().gate)
    }

    @Test
    fun `groups and invites accept both wire envelopes`() {
        val seenAt = 1_767_321_600_000.0
        val bareGroups = """[{"id":"home","name":"Home","isDefault":true}]"""
        val wrapped =
            """
            {
              "spaces":[{"id":"home","name":"Home","default":true}],
              "invites":[{"id":"i1","groupId":"home","groupName":"Home","title":"Join","seenAt":${tagged(seenAt)}}]
            }
            """.trimIndent()

        val bare = convexJson.decodeFromString<List<GroupWireRecord>>(bareGroups)
        val parsed = convexJson.decodeFromString<GroupsRecord>(wrapped)

        assertEquals("Home", bare.single().toGroup().name)
        assertEquals(true, bare.single().toGroup().isDefault)
        assertEquals("Home", parsed.allGroups.single().toGroup().name)
        assertEquals(true, parsed.allGroups.single().toGroup().isDefault)
        assertEquals(seenAt.toLong(), parsed.invites?.single()?.toInvite()?.seenAt)
    }

    @Test
    fun `routings accept a bare array and an envelope with no rows`() {
        val bare = """[{"id":"r1","title":"On done","trigger":"done","execution":"log"}]"""

        val parsed = convexJson.decodeFromString<List<RoutingWireRecord>>(bare)
        val empty = convexJson.decodeFromString<RoutingsRecord>("{}")

        assertEquals("On done", parsed.single().toRouting().title)
        assertNull(empty.routings)
    }

    private fun tagged(value: Double): String = "{\"${'$'}float\":\"${encodeDouble(value)}\"}"

    /** Convex stores finite doubles as little-endian IEEE-754 bytes in base64. */
    private fun encodeDouble(value: Double): String =
        Base64.getEncoder().encodeToString(
            ByteBuffer.allocate(java.lang.Double.BYTES)
                .order(ByteOrder.LITTLE_ENDIAN)
                .putDouble(value)
                .array(),
        )
}
