package dev.labdm.manager.kit.ui

import android.app.DatePickerDialog
import android.app.TimePickerDialog
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ExitToApp
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.Checkbox
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import dev.labdm.manager.kit.BoardPhase
import dev.labdm.manager.kit.DueDateMath
import dev.labdm.manager.kit.OverduePolicy
import dev.labdm.manager.kit.PlannedTimeMath
import dev.labdm.manager.kit.Priority
import dev.labdm.manager.kit.TaskBoardModel
import dev.labdm.manager.kit.TaskDateLabels
import dev.labdm.manager.kit.TaskDraft
import dev.labdm.manager.kit.TaskItem
import kotlinx.coroutines.launch
import java.util.Calendar
import java.util.Date

/**
 * The signed-in screen. `account` and `onSignOut` come from the app layer
 * because the account control is a Clerk composable, like Apple's `Accessory`.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TaskBoardScreen(
    model: TaskBoardModel,
    account: @Composable () -> Unit,
    onSignOut: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val state by model.state.collectAsStateWithLifecycle()
    val scope = rememberCoroutineScope()

    Scaffold(
        modifier = modifier,
        topBar = {
            TopAppBar(
                title = { Text("Manager") },
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
                .fillMaxSize()
                .padding(padding)
                .padding(horizontal = 16.dp)
                .background(MaterialTheme.colorScheme.background),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            model.connectionNotice?.let { Notice(it) }
            state.errorMessage?.let { message ->
                Notice(
                    text = message,
                    action = {
                        TextButton(onClick = { model.dismissError() }) { Text("Dismiss") }
                    },
                )
            }

            Composer(model = model)

            when (val phase = state.phase) {
                BoardPhase.Loading -> LinearProgressIndicator(Modifier.fillMaxWidth())
                is BoardPhase.Failed -> Card(Modifier.fillMaxWidth()) {
                    Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text(phase.message, color = MaterialTheme.colorScheme.error)
                        Button(onClick = { model.retry() }) { Text("Retry") }
                    }
                }
                BoardPhase.Idle, BoardPhase.Ready -> Unit
            }

            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                verticalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                items(items = state.tasks, key = { it.id }) { task ->
                    TaskRow(
                        task = task,
                        busy = task.id in state.inFlight,
                        onOpen = { scope.launch { model.openTask(task) } },
                        onCheckedChange = { done -> scope.launch { model.setDone(task.id, done) } },
                        onDelete = { scope.launch { model.delete(task) } },
                    )
                }
            }
        }
    }

    state.edit?.let { edit ->
        TaskEditorDialog(model = model, draft = edit.draft, isSaving = edit.isSaving)
    }
}

@Composable
private fun Composer(model: TaskBoardModel) {
    val state by model.state.collectAsStateWithLifecycle()
    val scope = rememberCoroutineScope()
    val draft = state.draft

    OutlinedTextField(
        value = draft.title,
        onValueChange = { model.updateDraft(it) },
        label = { Text("New task") },
        singleLine = true,
        modifier = Modifier.fillMaxWidth(),
        isError = model.draftValidationMessage != null,
        supportingText = model.draftValidationMessage?.let { { Text(it) } },
    )
    FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        Button(
            onClick = { scope.launch { model.addTask() } },
            enabled = model.canSubmitDraft,
        ) {
            Text("Add task")
        }
        DayButton(
            dayMillis = draft.plannedOn,
            label = "Planned day",
            onChange = { model.setDraftPlannedOn(it) },
        )
        TimeButton(
            minutes = draft.plannedTime,
            label = "Time",
            onChange = { model.setDraftPlannedTime(it) },
        )
        PriorityChips(
            selected = draft.priority,
            onSelect = { model.setDraftPriority(it) },
        )
    }
}

@Composable
private fun TaskRow(
    task: TaskItem,
    busy: Boolean,
    onOpen: () -> Unit,
    onCheckedChange: (Boolean) -> Unit,
    onDelete: () -> Unit,
) {
    Card(Modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier
                .clickable(enabled = !busy, onClick = onOpen)
                .padding(horizontal = 12.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Checkbox(
                checked = task.done,
                onCheckedChange = onCheckedChange,
                enabled = !busy,
            )
            Column(Modifier.weight(1f)) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    if (task.isNew) NewMark()
                    Text(
                        text = task.title,
                        style = MaterialTheme.typography.bodyLarge,
                        fontWeight = if (task.isNew) FontWeight.SemiBold else null,
                        textDecoration = if (task.done) TextDecoration.LineThrough else null,
                    )
                }
                task.notes?.let {
                    Text(
                        text = it,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    task.plannedDay?.let {
                        Meta(
                            TaskDateLabels.planned(it, task.plannedTime),
                            MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                    task.deadlineAt?.let {
                        Meta(
                            if (task.overdue) "Overdue · ${TaskDateLabels.instant(it)}"
                            else "Due · ${TaskDateLabels.instant(it)}",
                            if (task.overdue) MaterialTheme.colorScheme.error
                            else MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                    task.location?.let { Meta(it, MaterialTheme.colorScheme.onSurfaceVariant) }
                    task.priority?.let {
                        Meta(
                            it.label,
                            if (task.overdue) MaterialTheme.colorScheme.error
                            else MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
            }
            IconButton(onClick = onDelete, enabled = !busy) {
                Icon(Icons.Filled.Delete, contentDescription = "Delete ${task.title}")
            }
        }
    }
}

@Composable
private fun Meta(text: String, color: androidx.compose.ui.graphics.Color) {
    Text(text = text, style = MaterialTheme.typography.labelSmall, color = color)
}

/** The NEW mark that leaves the row once it is opened. */
@Composable
private fun NewMark() {
    Surface(
        color = MaterialTheme.colorScheme.tertiaryContainer,
        contentColor = MaterialTheme.colorScheme.onTertiaryContainer,
        shape = MaterialTheme.shapes.extraSmall,
        modifier = Modifier.semantics { contentDescription = "New" },
    ) {
        Text(
            text = "NEW",
            style = MaterialTheme.typography.labelSmall,
            fontWeight = FontWeight.Bold,
            modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
        )
    }
}

@Composable
private fun TaskEditorDialog(
    model: TaskBoardModel,
    draft: TaskDraft,
    isSaving: Boolean,
) {
    val scope = rememberCoroutineScope()

    AlertDialog(
        onDismissRequest = { model.closeEditor() },
        title = { Text("Edit task") },
        text = {
            Column(
                modifier = Modifier.fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                OutlinedTextField(
                    value = draft.title,
                    onValueChange = { value -> model.updateEditDraft { it.copy(title = value) } },
                    label = { Text("Title") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                    isError = model.editValidationMessage != null,
                    supportingText = model.editValidationMessage?.let { { Text(it) } },
                )
                OutlinedTextField(
                    value = draft.notes.orEmpty(),
                    onValueChange = { value ->
                        model.updateEditDraft { it.copy(notes = value.ifBlank { null }) }
                    },
                    label = { Text("Notes") },
                    minLines = 2,
                    modifier = Modifier.fillMaxWidth(),
                )
                OutlinedTextField(
                    value = draft.location.orEmpty(),
                    onValueChange = { value ->
                        model.updateEditDraft { it.copy(location = value.ifBlank { null }) }
                    },
                    label = { Text("Location") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )

                HorizontalDivider()
                Text("Planned", style = MaterialTheme.typography.labelMedium)
                FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    DayButton(
                        dayMillis = draft.plannedOn,
                        label = "Planned day",
                        allowClear = false,
                        onChange = { day ->
                            model.updateEditDraft { it.copy(plannedOn = day) }
                        },
                    )
                    TimeButton(
                        minutes = draft.plannedTime,
                        label = "Time",
                        allowClear = false,
                        onChange = { minutes ->
                            model.updateEditDraft { it.copy(plannedTime = minutes) }
                        },
                    )
                }

                HorizontalDivider()
                Text("Deadline", style = MaterialTheme.typography.labelMedium)
                FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    InstantButton(
                        instantMillis = draft.deadlineAt,
                        label = "Deadline",
                        allowClear = false,
                        onChange = { instant ->
                            // A deadline never writes the planned day.
                            model.updateEditDraft { it.copy(deadlineAt = instant) }
                        },
                    )
                    InstantButton(
                        instantMillis = draft.remindAt,
                        label = "Remind at",
                        allowClear = false,
                        onChange = { instant ->
                            model.updateEditDraft { it.copy(remindAt = instant) }
                        },
                    )
                }

                HorizontalDivider()
                PriorityChips(
                    selected = draft.priority,
                    onSelect = { priority -> model.updateEditDraft { it.copy(priority = priority) } },
                )
                FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OverduePolicy.entries.forEach { policy ->
                        FilterChip(
                            selected = draft.overduePolicy == policy,
                            onClick = {
                                model.updateEditDraft { it.copy(overduePolicy = policy) }
                            },
                            label = { Text(policy.wire) },
                        )
                    }
                }
            }
        },
        confirmButton = {
            Button(
                onClick = { scope.launch { model.saveEdit() } },
                enabled = !isSaving,
            ) {
                Text("Save")
            }
        },
        dismissButton = {
            TextButton(onClick = { model.closeEditor() }) { Text("Cancel") }
        },
    )
}

@Composable
private fun PriorityChips(selected: Priority?, onSelect: (Priority?) -> Unit) {
    FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        FilterChip(
            selected = selected == null,
            onClick = { onSelect(null) },
            label = { Text("default") },
        )
        Priority.seeds.forEach { priority ->
            FilterChip(
                selected = selected == priority,
                onClick = { onSelect(if (selected == priority) null else priority) },
                label = { Text(priority.label) },
            )
        }
    }
}

/** The planned day. Written as the start of that local day. */
@Composable
private fun DayButton(
    dayMillis: Long?,
    label: String,
    allowClear: Boolean = true,
    onChange: (Long?) -> Unit,
) {
    val context = LocalContext.current
    val calendar = Calendar.getInstance().apply {
        time = Date(dayMillis ?: System.currentTimeMillis())
    }

    TextButton(
        onClick = {
            DatePickerDialog(
                context,
                { _, year, month, day ->
                    val picked = Calendar.getInstance().apply {
                        set(Calendar.YEAR, year)
                        set(Calendar.MONTH, month)
                        set(Calendar.DAY_OF_MONTH, day)
                    }
                    onChange(DueDateMath.startOfDay(picked.timeInMillis))
                },
                calendar.get(Calendar.YEAR),
                calendar.get(Calendar.MONTH),
                calendar.get(Calendar.DAY_OF_MONTH),
            ).show()
        },
    ) {
        Text(dayMillis?.let { "$label ${DueDateMath.dayLabel(it)}" } ?: "Set $label")
    }
    if (allowClear && dayMillis != null) {
        TextButton(onClick = { onChange(null) }) { Text("Clear") }
    }
}

/** Minutes from midnight on the planned day. Cleared without touching the day. */
@Composable
private fun TimeButton(
    minutes: Int?,
    label: String,
    allowClear: Boolean = true,
    onChange: (Int?) -> Unit,
) {
    val context = LocalContext.current
    val current = minutes ?: 9 * 60

    TextButton(
        onClick = {
            TimePickerDialog(
                context,
                { _, hour, minute -> onChange(hour * 60 + minute) },
                current / 60,
                current % 60,
                true,
            ).show()
        },
    ) {
        Text(minutes?.let { "$label ${PlannedTimeMath.label(it)}" } ?: "Set $label")
    }
    if (allowClear && minutes != null) {
        TextButton(onClick = { onChange(null) }) { Text("Clear") }
    }
}

/** An exact instant: date, then time. Used for the deadline and the reminder. */
@Composable
private fun InstantButton(
    instantMillis: Long?,
    label: String,
    allowClear: Boolean = true,
    onChange: (Long?) -> Unit,
) {
    val context = LocalContext.current
    val start = Calendar.getInstance().apply {
        time = Date(instantMillis ?: System.currentTimeMillis())
    }

    TextButton(
        onClick = {
            DatePickerDialog(
                context,
                { _, year, month, day ->
                    TimePickerDialog(
                        context,
                        { _, hour, minute ->
                            val picked = Calendar.getInstance().apply {
                                set(Calendar.YEAR, year)
                                set(Calendar.MONTH, month)
                                set(Calendar.DAY_OF_MONTH, day)
                                set(Calendar.HOUR_OF_DAY, hour)
                                set(Calendar.MINUTE, minute)
                                set(Calendar.SECOND, 0)
                                set(Calendar.MILLISECOND, 0)
                            }
                            onChange(picked.timeInMillis)
                        },
                        start.get(Calendar.HOUR_OF_DAY),
                        start.get(Calendar.MINUTE),
                        true,
                    ).show()
                },
                start.get(Calendar.YEAR),
                start.get(Calendar.MONTH),
                start.get(Calendar.DAY_OF_MONTH),
            ).show()
        },
    ) {
        Text(instantMillis?.let { "$label ${TaskDateLabels.instant(it)}" } ?: "Set $label")
    }
    if (allowClear && instantMillis != null) {
        TextButton(onClick = { onChange(null) }) { Text("Clear") }
    }
}

@Composable
private fun Notice(
    text: String,
    action: (@Composable () -> Unit)? = null,
) {
    Card(Modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(text, Modifier.weight(1f), color = MaterialTheme.colorScheme.error)
            action?.invoke()
        }
    }
}

/** Fullscreen setup message for missing public config. Mirrors Apple's SetupRequiredView. */
@Composable
fun SetupRequiredScreen(message: String) {
    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        Column(
            modifier = Modifier.padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            Text("Manager needs setup", style = MaterialTheme.typography.headlineSmall)
            Text(message)
        }
    }
}
