package dev.labdm.manager.data

import dev.convex.android.ConvexClientWithAuth
import dev.convex.android.ConvexError
import dev.convex.android.Float64ToDoubleDecoder
import dev.convex.android.Float64ToFloatDecoder
import dev.convex.android.Int64ToIntDecoder
import dev.convex.android.Int64ToLongDecoder
import dev.convex.android.InternalError
import dev.convex.android.ServerError
import dev.convex.android.WebSocketState
import dev.labdm.manager.kit.ActivityOnTasks
import dev.labdm.manager.kit.BoardSnapshot
import dev.labdm.manager.kit.ConnectionStatus
import dev.labdm.manager.kit.GroupItem
import dev.labdm.manager.kit.InviteItem
import dev.labdm.manager.kit.RoutingItem
import dev.labdm.manager.kit.TaskBackend
import dev.labdm.manager.kit.TaskDraft
import dev.labdm.manager.kit.TaskItem
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.map
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.modules.SerializersModule
import kotlinx.serialization.modules.contextual

/**
 * `TaskBackend` over Convex's websocket client with Clerk auth.
 *
 * Live `tasks:list` updates arrive through `subscribe`, so a task completed by
 * the web app or an MCP bot appears here without polling. Writes use the same
 * mutations as every other client; `ownerId` is enforced server-side.
 */
class ConvexTaskBackend(
    private val client: ConvexClientWithAuth<String>,
) : TaskBackend {

    override suspend fun ensureUser() {
        perform<JsonElement?> { client.mutation<JsonElement?>(ConvexFunction.ENSURE_USER) }
    }

    override fun taskUpdates(): Flow<List<TaskItem>> =
        client.subscribe<List<TaskRecord>>(ConvexFunction.LIST)
            .map { result ->
                result.getOrElse { throw userFacing(it) }.map { it.toItem() }
            }

    override fun connectionUpdates(): Flow<ConnectionStatus> =
        client.webSocketStateFlow
            .map { state ->
                when (state) {
                    WebSocketState.CONNECTED -> ConnectionStatus.CONNECTED
                    WebSocketState.CONNECTING -> ConnectionStatus.CONNECTING
                }
            }
            .distinctUntilChanged()

    override suspend fun createTask(title: String, dueAt: Long?) {
        createTask(TaskDraft(title = title, plannedOn = dueAt))
    }

    override suspend fun createTask(draft: TaskDraft) {
        perform<TaskRecord> {
            client.mutation<TaskRecord>(ConvexFunction.CREATE, draftArgs(draft, includeTitle = true))
        }
    }

    /**
     * The first occurrence of a series comes from the sheet's explicit behavior
     * and cadence. The backend names the 14-day cadence `biweekly`.
     */
    override suspend fun createRecurrence(
        title: String,
        behavior: String,
        cadence: String,
        periodStart: Long,
    ) {
        val wireCadence = if (cadence == "every14days") "biweekly" else cadence
        perform<JsonElement?> {
            client.mutation<JsonElement?>(
                ConvexFunction.CREATE_RECURRENCE,
                mapOf(
                    "behavior" to behavior,
                    "cadence" to wireCadence,
                    "timezone" to java.util.TimeZone.getDefault().id,
                    "title" to title,
                    "anchorOn" to periodStart.toDouble(),
                ),
            )
        }
    }

    override suspend fun setTask(id: String, done: Boolean) {
        perform<TaskRecord> {
            client.mutation<TaskRecord>(ConvexFunction.SET_DONE, mapOf("id" to id, "done" to done))
        }
    }

    override suspend fun markSeen(id: String) {
        perform<TaskRecord> {
            client.mutation<TaskRecord>(ConvexFunction.MARK_SEEN, mapOf("id" to id))
        }
    }

    override suspend fun updateTask(id: String, draft: TaskDraft) {
        perform<TaskRecord> {
            client.mutation<TaskRecord>(
                ConvexFunction.UPDATE,
                draftArgs(draft, includeTitle = true) + mapOf("id" to id),
            )
        }
    }

    override suspend fun deleteTask(id: String) {
        perform<RemovalRecord> { client.mutation<RemovalRecord>(ConvexFunction.REMOVE, mapOf("id" to id)) }
    }

    /**
     * One shot of the mixed Tasks feed. The wire function is a mutation because
     * it mints recurrences, so a fresh call replaces the cached snapshot.
     */
    override fun boardSliceUpdates(): Flow<BoardSnapshot> = flow {
        val payload = perform<JsonElement?> {
            client.mutation<JsonElement?>(
                ConvexFunction.BOARD_SLICE,
                mapOf(
                    "tab" to "tasks",
                    "timezone" to java.util.TimeZone.getDefault().id,
                ),
            )
        }
        emit(
            if (payload == null) {
                BoardSnapshot()
            } else {
                wireJson.decodeFromString<BoardSliceRecord>(payload.toString()).toSnapshot()
            },
        )
    }

    /** Invites arrive in the same payload as groups; there is no separate list call. */
    override fun groupUpdates(): Flow<List<GroupItem>> = flow {
        emit(groupsPayload().allGroups.map(GroupWireRecord::toGroup))
    }

    override fun inviteUpdates(): Flow<List<InviteItem>> = flow {
        emit(groupsPayload().invites.orEmpty().map(InviteWireRecord::toInvite))
    }

    override fun routingUpdates(): Flow<List<RoutingItem>> = flow {
        val payload = perform<JsonElement?> { client.mutation<JsonElement?>(ConvexFunction.ROUTINGS_LIST) }
        val routings =
            when (payload) {
                null -> emptyList()
                is JsonArray -> wireJson.decodeFromString<List<RoutingWireRecord>>(payload.toString())
                else -> wireJson.decodeFromString<RoutingsRecord>(payload.toString()).routings.orEmpty()
            }
        emit(routings.map(RoutingWireRecord::toRouting))
    }

    override suspend fun createGroup(name: String, icon: String, color: String) {
        perform<JsonElement?> {
            client.mutation<JsonElement?>(
                ConvexFunction.GROUPS_CREATE,
                mapOf("name" to name, "icon" to icon, "color" to color),
            )
        }
    }

    override suspend fun createInvite(groupId: String, invitee: String) {
        perform<JsonElement?> {
            client.mutation<JsonElement?>(
                ConvexFunction.INVITES_CREATE,
                mapOf("groupId" to groupId, "invitee" to invitee),
            )
        }
    }

    override suspend fun acceptInvite(id: String) {
        perform<JsonElement?> {
            client.mutation<JsonElement?>(ConvexFunction.INVITES_ACCEPT, mapOf("id" to id))
        }
    }

    override suspend fun declineInvite(id: String) {
        perform<JsonElement?> {
            client.mutation<JsonElement?>(ConvexFunction.INVITES_DECLINE, mapOf("id" to id))
        }
    }

    override suspend fun createRouting(trigger: String, execution: String) {
        perform<JsonElement?> {
            client.mutation<JsonElement?>(
                ConvexFunction.ROUTINGS_CREATE,
                mapOf("trigger" to trigger, "execution" to execution),
            )
        }
    }

    override suspend fun setActivityOnTasks(value: ActivityOnTasks) {
        perform<JsonElement?> {
            client.mutation<JsonElement?>(
                ConvexFunction.SET_ACTIVITY_ON_TASKS,
                mapOf("value" to value.wire),
            )
        }
    }

    private suspend fun groupsPayload(): GroupsRecord =
        when (val payload = perform<JsonElement?> { client.mutation<JsonElement?>(ConvexFunction.GROUPS_LIST) }) {
            null -> GroupsRecord()
            is JsonArray -> GroupsRecord(
                groups = wireJson.decodeFromString<List<GroupWireRecord>>(payload.toString()),
            )
            else -> wireJson.decodeFromString<GroupsRecord>(payload.toString())
        }

    /**
     * The planned day is written to both `plannedOn` and its legacy alias
     * `dueAt`, because they are one fact. `deadlineAt` is sent on its own and
     * never writes either of them.
     *
     * Numbers are sent as `Double`: v.number() rejects Convex's integer
     * encoding. Absent optional fields are omitted rather than sent as null, so
     * a partial edit cannot clear a column the editor did not touch.
     */
    private fun draftArgs(draft: TaskDraft, includeTitle: Boolean): Map<String, Any?> =
        buildMap {
            val facts = draft.withSeedRank()
            if (includeTitle) put("title", facts.title)
            facts.notes?.let { put("notes", it) }
            facts.plannedOn?.let { day ->
                put("plannedOn", day.toDouble())
                put("dueAt", day.toDouble())
            }
            facts.plannedTime?.let { put("plannedTime", it.toDouble()) }
            facts.location?.let { put("location", it) }
            facts.deadlineAt?.let { put("deadlineAt", it.toDouble()) }
            facts.remindAt?.let { put("remindAt", it.toDouble()) }
            facts.priority?.let { put("priority", it.wire) }
            facts.priorityRank?.let { put("priorityRank", it.toDouble()) }
            put("overduePolicy", facts.overduePolicy.wire)
        }

    private inline fun <reified T> perform(operation: () -> T): T =
        try {
            operation()
        } catch (error: Throwable) {
            throw userFacing(error)
        }

    private fun userFacing(error: Throwable): Throwable = when (error) {
        is ConvexError -> IllegalArgumentException(convexErrorText(error.data) ?: error.message)
        is ServerError, is InternalError -> IllegalArgumentException(error.message ?: "Convex request failed.")
        else -> error
    }

    /** Convex sends `throw new Error("…")` payloads as a JSON string. */
    private fun convexErrorText(payload: String): String? =
        runCatching { Json.decodeFromString<String>(payload) }
            .getOrNull()
            ?: runCatching {
                Json.decodeFromString<ErrorEnvelope>(payload).message
            }.getOrNull()

    @kotlinx.serialization.Serializable
    private data class ErrorEnvelope(val message: String)

    private companion object {
        /** Same number decoders ConvexClient uses for tagged `$float` and `$integer`. */
        val wireJson = Json {
            ignoreUnknownKeys = true
            allowSpecialFloatingPointValues = true
            serializersModule = SerializersModule {
                contextual(Int64ToIntDecoder)
                contextual(Int64ToLongDecoder)
                contextual(Float64ToFloatDecoder)
                contextual(Float64ToDoubleDecoder)
            }
        }
    }
}
