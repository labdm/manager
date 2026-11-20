package dev.labdm.manager.kit

import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow

/** Backend for previews and unit tests. No Convex or Clerk imports. */
class InMemoryTaskBackend(
    initial: List<TaskItem> = emptyList(),
) : TaskBackend {

    private val tasks = MutableStateFlow(initial)
    private val connection = MutableStateFlow(ConnectionStatus.CONNECTED)
    val allTasks: List<TaskItem>
        get() = tasks.value

    override suspend fun ensureUser() = Unit

    override fun taskUpdates(): Flow<List<TaskItem>> = tasks.asStateFlow()

    override fun connectionUpdates(): Flow<ConnectionStatus> = connection.asStateFlow()

    override suspend fun createTask(title: String, dueAt: Long?) {
        val item = TaskItem(
            id = "local-${tasks.value.size + 1}",
            title = title,
            done = false,
            dueAt = dueAt,
        )
        tasks.value = listOf(item) + tasks.value
    }

    override suspend fun setTask(id: String, done: Boolean) {
        tasks.value = tasks.value.map { if (it.id == id) it.withDone(done) else it }
    }

    override suspend fun deleteTask(id: String) {
        tasks.value = tasks.value.filterNot { it.id == id }
    }
}
