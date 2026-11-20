package dev.labdm.manager.kit

/**
 * One task, as every client sees it.
 *
 * Mirrors `TaskView` in `packages/backend/convex/lib/taskService.ts`: `id`,
 * `title`, `done`, `dueAt`. The backend owns ordering; this type only carries
 * data so the UI can group it for the current day. `dueAt` is epoch
 * milliseconds decoded from Convex's tagged number format by `managerdata`.
 */
data class TaskItem(
    val id: String,
    val title: String,
    val done: Boolean,
    val dueAt: Long? = null,
) {
    fun withDone(done: Boolean): TaskItem = copy(done = done)
}
