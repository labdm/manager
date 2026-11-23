package dev.labdm.manager.data

import dev.convex.android.Float64
import dev.labdm.manager.kit.OverduePolicy
import dev.labdm.manager.kit.Priority
import dev.labdm.manager.kit.TaskItem
import dev.labdm.manager.kit.TaskOrigin
import dev.labdm.manager.kit.TaskOutcome
import kotlinx.serialization.Serializable

/** Convex function names, so a rename fails at compile time here, not at runtime. */
object ConvexFunction {
    const val ENSURE_USER = "users:ensure"
    const val LIST = "tasks:list"
    const val CREATE = "tasks:create"
    const val UPDATE = "tasks:update"
    const val MARK_SEEN = "tasks:markSeen"
    const val SET_DONE = "tasks:setDone"
    const val REMOVE = "tasks:remove"
}

/**
 * Wire shape of `TaskView` from `packages/backend/convex/lib/taskService.ts`.
 *
 * Convex encodes JavaScript numbers as tagged `$float` objects. Every optional
 * numeric field must go through `Float64` (Convex's alias for a Double
 * decoder), exactly like Swift's `@OptionalConvexFloat`: a plain `Double` fails
 * at runtime. That includes the timestamps M1 added — `plannedOn`,
 * `deadlineAt`, `remindAt`, `seenAt`, `completedAt` — and the derived
 * `effectiveRank`. `plannedTime` is minutes from midnight and crosses the same
 * number format, so it is `Float64` too and narrows here.
 *
 * See `TaskRecordParsingTest` for the tagged-number fixtures.
 */
@Serializable
data class TaskRecord(
    val id: String,
    val title: String,
    val done: Boolean,
    val ownerId: String,
    /** Legacy alias of [plannedOn]. Start of a civil day. */
    val dueAt: Float64? = null,
    val notes: String? = null,
    val plannedOn: Float64? = null,
    /** Minutes from midnight, 0–1439. */
    val plannedTime: Float64? = null,
    val location: String? = null,
    val deadlineAt: Float64? = null,
    val remindAt: Float64? = null,
    val priority: String? = null,
    val priorityRank: Float64? = null,
    val effectiveRank: Float64? = null,
    val overdue: Boolean? = null,
    val overduePolicy: String? = null,
    val outcome: String? = null,
    val origin: String? = null,
    val seenAt: Float64? = null,
    val completedAt: Float64? = null,
) {
    fun toItem(): TaskItem = TaskItem(
        id = id,
        title = title,
        done = done,
        dueAt = dueAt?.toLong(),
        notes = notes,
        plannedOn = plannedOn?.toLong(),
        plannedTime = plannedTime?.toInt(),
        location = location,
        deadlineAt = deadlineAt?.toLong(),
        remindAt = remindAt?.toLong(),
        priority = Priority.fromWire(priority),
        priorityRank = priorityRank?.toInt(),
        effectiveRank = effectiveRank?.toInt(),
        overdue = overdue ?: false,
        overduePolicy = OverduePolicy.fromWire(overduePolicy),
        outcome = TaskOutcome.fromWire(outcome),
        origin = TaskOrigin.fromWire(origin),
        seenAt = seenAt?.toLong(),
        completedAt = completedAt?.toLong(),
    )
}

/** Result of the `tasks:remove` mutation. */
@Serializable
data class RemovalRecord(
    val success: Boolean,
    val id: String,
)
