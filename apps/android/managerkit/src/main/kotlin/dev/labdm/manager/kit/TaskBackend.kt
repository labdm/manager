package dev.labdm.manager.kit

import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flowOf

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

    /**
     * Creates a row with the full M1 facts. The signed-in caller is `self`, so
     * the row is never NEW.
     */
    suspend fun createTask(draft: TaskDraft)

    /**
     * Creates the first occurrence of a recurring series. Behavior and cadence
     * are explicit choices from the sheet, never inferred from "daily".
     */
    suspend fun createRecurrence(title: String, behavior: String, cadence: String, periodStart: Long)

    /** Explicit setter, never a toggle: a retried tap must not invert state. */
    suspend fun setTask(id: String, done: Boolean)

    /**
     * Calls `tasks:markSeen`. Opening a row is an explicit open, not painting
     * the list, so it is a mutation rather than a side effect of composition.
     */
    suspend fun markSeen(id: String)

    /** Calls `alerts:read`. A failed open must not stamp `seenAt`. */
    suspend fun markAlertSeen(id: String)

    /** Writes the editable facts of an existing row. Delete stays [deleteTask]. */
    suspend fun updateTask(id: String, draft: TaskDraft)

    suspend fun deleteTask(id: String)

    /**
     * One shot of `board:slice`: the Tasks feed's views, messages, questions and
     * tracks. It is a mutation on the wire because it mints recurrences, so a
     * fresh call refreshes the snapshot.
     */
    fun boardSliceUpdates(): Flow<BoardSnapshot> = flowOf(BoardSnapshot())

    fun groupUpdates(): Flow<List<GroupItem>> = flowOf(emptyList())

    /** Invites arrive with `groups:list`; there is no separate list function. */
    fun inviteUpdates(): Flow<List<InviteItem>> = flowOf(emptyList())

    fun routingUpdates(): Flow<List<RoutingItem>> = flowOf(emptyList())

    suspend fun createGroup(name: String, icon: String, color: String) = Unit

    suspend fun createInvite(groupId: String, invitee: String) = Unit

    suspend fun acceptInvite(id: String) = Unit

    suspend fun declineInvite(id: String) = Unit

    /**
     * `routings:create` with an explicit cron trigger and a `createTask`
     * execution. Cadence is `daily`, `weekly` or `monthly`.
     */
    suspend fun createRouting(name: String, cadence: String, title: String) = Unit

    suspend fun setActivityOnTasks(value: ActivityOnTasks) = Unit
}
