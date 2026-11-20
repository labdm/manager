package dev.labdm.manager.kit

import kotlinx.coroutines.flow.Flow

/** Websocket state, mapped from Convex's `WebSocketState` by `managerdata`. */
enum class ConnectionStatus {
    CONNECTING,
    CONNECTED,
    OFFLINE,
}

/**
 * The only data operations the UI knows about. `managerdata` implements this
 * over Convex; tests and previews use [InMemoryTaskBackend].
 *
 * Mirrors the Swift `TaskBackend` protocol in `Packages/ManagerKit`.
 */
interface TaskBackend {
    /** Provisions the Convex `users` row for the current Clerk identity. */
    suspend fun ensureUser()

    /** Live `tasks:list` updates. A mutation from web/MCP arrives here. */
    fun taskUpdates(): Flow<List<TaskItem>>

    fun connectionUpdates(): Flow<ConnectionStatus>

    suspend fun createTask(title: String, dueAt: Long?)

    /** Explicit setter, never a toggle: a retried tap must not invert state. */
    suspend fun setTask(id: String, done: Boolean)

    suspend fun deleteTask(id: String)
}
