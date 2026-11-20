package dev.labdm.manager.data

import dev.convex.android.Float64
import dev.labdm.manager.kit.TaskItem
import kotlinx.serialization.Serializable

/** Convex function names, so a rename fails at compile time here, not at runtime. */
object ConvexFunction {
    const val ENSURE_USER = "users:ensure"
    const val LIST = "tasks:list"
    const val CREATE = "tasks:create"
    const val SET_DONE = "tasks:setDone"
    const val REMOVE = "tasks:remove"
}

/**
 * Wire shape of `TaskView` from `packages/backend/convex/lib/taskService.ts`.
 *
 * Convex encodes JavaScript numbers as tagged `$float` objects. `dueAt` must go
 * through `Float64` (Convex's alias for a Double decoder), exactly like Swift's
 * `@OptionalConvexFloat`: a plain `Double` fails at runtime. See
 * `TaskRecordParsingTest` for the tagged-number fixture.
 */
@Serializable
data class TaskRecord(
    val id: String,
    val title: String,
    val done: Boolean,
    val ownerId: String,
    val dueAt: Float64? = null,
) {
    fun toItem(): TaskItem = TaskItem(
        id = id,
        title = title,
        done = done,
        dueAt = dueAt?.toLong(),
    )
}

/** Result of the `tasks:remove` mutation. */
@Serializable
data class RemovalRecord(
    val success: Boolean,
    val id: String,
)
