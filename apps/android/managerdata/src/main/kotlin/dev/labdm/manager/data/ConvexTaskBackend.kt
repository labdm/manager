package dev.labdm.manager.data

import dev.convex.android.ConvexClientWithAuth
import dev.convex.android.ConvexError
import dev.convex.android.InternalError
import dev.convex.android.ServerError
import dev.convex.android.WebSocketState
import dev.labdm.manager.kit.ConnectionStatus
import dev.labdm.manager.kit.TaskBackend
import dev.labdm.manager.kit.TaskItem
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.map
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement

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
        val args = buildMap<String, Any?> {
            put("title", title)
            // A JS number, not a BigInt: v.number() rejects Convex's integer encoding.
            dueAt?.let { put("dueAt", it.toDouble()) }
        }
        perform<TaskRecord> { client.mutation<TaskRecord>(ConvexFunction.CREATE, args) }
    }

    override suspend fun setTask(id: String, done: Boolean) {
        perform<TaskRecord> {
            client.mutation<TaskRecord>(ConvexFunction.SET_DONE, mapOf("id" to id, "done" to done))
        }
    }

    override suspend fun deleteTask(id: String) {
        perform<RemovalRecord> { client.mutation<RemovalRecord>(ConvexFunction.REMOVE, mapOf("id" to id)) }
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
}
