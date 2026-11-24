package dev.labdm.manager.kit.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.ExitToApp
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import dev.labdm.manager.kit.SeriesBehavior
import dev.labdm.manager.kit.SeriesCadence
import dev.labdm.manager.kit.TaskBoardModel
import dev.labdm.manager.kit.TaskDraft
import kotlinx.coroutines.launch

/**
 * Create is a full-screen navigation route, not a sheet over the list. Series
 * and cadence stay explicit choices; cadence never implies a behavior. The
 * stored presentation hint is absent here because the board draws one row.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun TaskFormScreen(
    model: TaskBoardModel,
    taskId: String?,
    onClose: () -> Unit,
    account: @Composable () -> Unit,
    onSignOut: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val state by model.state.collectAsStateWithLifecycle()
    val scope = rememberCoroutineScope()
    val seed: TaskDraft =
        remember(taskId) {
            if (taskId != null) {
                state.edit?.draft
                    ?: state.tasks.firstOrNull { it.id == taskId }?.let { TaskDraft.from(it) }
                    ?: TaskDraft()
            } else {
                state.draft
            }
        }

    var title by remember(taskId) { mutableStateOf(seed.title) }
    var notes by remember(taskId) { mutableStateOf(seed.notes.orEmpty()) }
    var plannedOn by remember(taskId) { mutableStateOf(seed.plannedOn) }
    var plannedTime by remember(taskId) { mutableStateOf(seed.plannedTime) }
    var deadlineAt by remember(taskId) { mutableStateOf(seed.deadlineAt) }
    var remindAt by remember(taskId) { mutableStateOf(seed.remindAt) }
    var location by remember(taskId) { mutableStateOf(seed.location.orEmpty()) }
    var priority by remember(taskId) { mutableStateOf(seed.priority) }
    var policy by remember(taskId) { mutableStateOf(seed.overduePolicy) }
    var series by remember(taskId) { mutableStateOf(seed.series) }
    var cadence by remember(taskId) { mutableStateOf(seed.cadence) }

    Scaffold(
        modifier = modifier.fillMaxSize(),
        topBar = {
            TopAppBar(
                title = { Text(if (taskId == null) "New task" else "Task details") },
                navigationIcon = {
                    IconButton(onClick = onClose) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
                actions = {
                    account()
                    IconButton(onClick = onSignOut) {
                        Icon(Icons.AutoMirrored.Filled.ExitToApp, contentDescription = "Sign out")
                    }
                },
            )
        },
    ) { padding ->
        Column(
            modifier = Modifier
                .padding(padding)
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 20.dp, vertical = 12.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            OutlinedTextField(
                value = title,
                onValueChange = { title = it },
                label = { Text("Title") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )

            SectionLabel("Series")
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                SeriesBehavior.entries.forEach { choice ->
                    FilterChip(
                        selected = series == choice,
                        onClick = { series = choice },
                        label = { Text(choice.label) },
                    )
                }
            }
            Text(
                text = series.detail,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            if (series != SeriesBehavior.NONE) {
                SectionLabel("Cadence")
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    SeriesCadence.entries.forEach { choice ->
                        FilterChip(
                            selected = cadence == choice,
                            onClick = { cadence = choice },
                            label = { Text(choice.label) },
                        )
                    }
                }
            }

            HorizontalDivider()
            SectionLabel("Planned")
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                DayButton(dayMillis = plannedOn, label = "Planned day") { plannedOn = it }
                TimeButton(minutes = plannedTime, label = "Time") { plannedTime = it }
            }

            SectionLabel("Deadline and reminder")
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                InstantButton(instantMillis = deadlineAt, label = "Deadline") { deadlineAt = it }
                InstantButton(instantMillis = remindAt, label = "Remind at") { remindAt = it }
            }

            OutlinedTextField(
                value = location,
                onValueChange = { location = it },
                label = { Text("Location") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )
            PriorityChips(selected = priority) { priority = it }
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                dev.labdm.manager.kit.OverduePolicy.entries.forEach { choice ->
                    FilterChip(
                        selected = policy == choice,
                        onClick = { policy = choice },
                        label = { Text(choice.wire) },
                    )
                }
            }
            OutlinedTextField(
                value = notes,
                onValueChange = { notes = it },
                label = { Text("Notes") },
                minLines = 2,
                modifier = Modifier.fillMaxWidth(),
            )

            state.errorMessage?.let { error ->
                Text(text = error, color = MaterialTheme.colorScheme.error)
            }

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                TextButton(onClick = onClose) { Text("Cancel") }
                Button(
                    onClick = {
                        val draft =
                            TaskDraft(
                                title = title,
                                notes = notes.ifBlank { null },
                                plannedOn = plannedOn,
                                plannedTime = plannedTime,
                                location = location.ifBlank { null },
                                deadlineAt = deadlineAt,
                                remindAt = remindAt,
                                priority = priority,
                                overduePolicy = policy,
                                series = series,
                                cadence = cadence,
                            )
                        scope.launch {
                            val ok =
                                if (taskId != null) {
                                    model.updateEditDraft { draft }
                                    model.saveEdit()
                                } else if (draft.series != SeriesBehavior.NONE) {
                                    model.createSeriesTask(draft)
                                } else {
                                    model.createTaskFromSheet(draft)
                                }
                            if (ok) onClose()
                        }
                    },
                    enabled = title.isNotBlank() && !state.isSaving,
                ) {
                    Text(if (taskId == null) "Create" else "Save")
                }
            }
        }
    }
}

@Composable
private fun SectionLabel(text: String) {
    Text(text = text, style = MaterialTheme.typography.labelMedium)
}
