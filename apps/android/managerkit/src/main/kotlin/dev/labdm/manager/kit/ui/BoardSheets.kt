package dev.labdm.manager.kit.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import dev.labdm.manager.kit.Appearance
import androidx.compose.foundation.layout.FlowRow
import dev.labdm.manager.kit.BoardEntityKind
import dev.labdm.manager.kit.BoardSheet
import dev.labdm.manager.kit.BoardState
import dev.labdm.manager.kit.OverduePolicy
import dev.labdm.manager.kit.SeriesBehavior
import dev.labdm.manager.kit.SeriesCadence
import dev.labdm.manager.kit.TaskBoardModel
import dev.labdm.manager.kit.TaskDraft
import dev.labdm.manager.kit.TaskLook
import kotlinx.coroutines.launch

/**
 * Every create and edit target is a modal bottom sheet. The board is never
 * pushed into a form, and the sheet is not a navigation destination.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun BoardSheetHost(
    model: TaskBoardModel,
    state: BoardState,
) {
    val sheet = state.presentedSheet ?: return
    ModalBottomSheet(
        onDismissRequest = { model.dismissSheet() },
        sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(modifier = Modifier.fillMaxWidth()) {
            Text(
                text = sheet.title,
                style = MaterialTheme.typography.titleLarge,
                modifier = Modifier.padding(horizontal = 20.dp, vertical = 8.dp),
            )
            HorizontalDivider()
            when (sheet) {
                BoardSheet.CreateTask ->
                    TaskSheetForm(
                        model = model,
                        state = state,
                        taskId = null,
                        onDismiss = { model.dismissSheet() },
                    )

                is BoardSheet.EditTask ->
                    TaskSheetForm(
                        model = model,
                        state = state,
                        taskId = sheet.taskId,
                        onDismiss = { model.dismissSheet() },
                    )

                is BoardSheet.Category,
                is BoardSheet.Event,
                is BoardSheet.View,
                is BoardSheet.Progression,
                is BoardSheet.Resource,
                ->
                    EntitySheetForm(
                        model = model,
                        sheet = sheet,
                        onDismiss = { model.dismissSheet() },
                    )
            }
        }
    }
}

@Composable
private fun TaskSheetForm(
    model: TaskBoardModel,
    state: BoardState,
    taskId: String?,
    onDismiss: () -> Unit,
) {
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
    var look by remember(taskId) { mutableStateOf(seed.look) }
    var series by remember(taskId) { mutableStateOf(seed.series) }
    var cadence by remember(taskId) { mutableStateOf(seed.cadence) }
    var icon by remember(taskId) { mutableStateOf(Appearance.FALLBACK_ICON) }
    var color by remember(taskId) { mutableStateOf(Appearance.FALLBACK_COLOR) }

    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 20.dp, vertical = 8.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        OutlinedTextField(
            value = title,
            onValueChange = { title = it },
            label = { Text("Title") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
        )

        SectionLabel("Look")
        FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            TaskLook.entries.forEach { choice ->
                FilterChip(
                    selected = look == choice,
                    onClick = { look = choice },
                    label = { Text(choice.label) },
                )
            }
        }

        SectionLabel("Series")
        FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
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
            FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
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
        FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            DayButton(dayMillis = plannedOn, label = "Planned day") { plannedOn = it }
            TimeButton(minutes = plannedTime, label = "Time") { plannedTime = it }
        }

        SectionLabel("Deadline and reminder")
        FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            // A deadline is its own instant and never writes the planned day.
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
        FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            OverduePolicy.entries.forEach { choice ->
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

        AppearancePicker(icon, color, { icon = it }, { color = it })

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            TextButton(onClick = onDismiss) { Text("Cancel") }
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
                            look = look,
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
                        if (ok) onDismiss()
                    }
                },
                enabled = title.isNotBlank() && !state.isSaving,
            ) {
                Text(if (taskId != null) "Save" else "Create")
            }
        }
    }
}

@Composable
private fun SectionLabel(text: String) {
    Text(text = text, style = MaterialTheme.typography.labelMedium)
}

@Composable
private fun EntitySheetForm(
    model: TaskBoardModel,
    sheet: BoardSheet,
    onDismiss: () -> Unit,
) {
    val kind =
        when (sheet) {
            is BoardSheet.Category -> BoardEntityKind.CATEGORY
            is BoardSheet.Event -> BoardEntityKind.EVENT
            is BoardSheet.View -> BoardEntityKind.VIEW
            is BoardSheet.Progression -> BoardEntityKind.PROGRESSION
            is BoardSheet.Resource -> BoardEntityKind.RESOURCE
            else -> BoardEntityKind.CATEGORY
        }

    var title by remember(sheet.id) { mutableStateOf("") }
    var icon by remember(sheet.id) { mutableStateOf(Appearance.FALLBACK_ICON) }
    var color by remember(sheet.id) { mutableStateOf(Appearance.FALLBACK_COLOR) }
    var slug by remember(sheet.id) { mutableStateOf("") }
    var eventKind by remember(sheet.id) { mutableStateOf("day") }
    var viewKind by remember(sheet.id) { mutableStateOf("custom") }
    var mode by remember(sheet.id) { mutableStateOf("steps") }
    var target by remember(sheet.id) { mutableStateOf("1") }
    var unit by remember(sheet.id) { mutableStateOf("") }

    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 20.dp, vertical = 8.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        OutlinedTextField(
            value = title,
            onValueChange = { title = it },
            label = { Text("Name") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
        )

        when (kind) {
            BoardEntityKind.CATEGORY ->
                OutlinedTextField(
                    value = slug,
                    onValueChange = { slug = it },
                    label = { Text("Slug") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )

            BoardEntityKind.EVENT -> {
                SectionLabel("Kind")
                FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    listOf("day", "week", "month", "quarter", "year", "custom").forEach { choice ->
                        FilterChip(
                            selected = eventKind == choice,
                            onClick = { eventKind = choice },
                            label = { Text(choice) },
                        )
                    }
                }
            }

            BoardEntityKind.VIEW -> {
                SectionLabel("Kind")
                FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    listOf("template", "computed", "custom").forEach { choice ->
                        FilterChip(
                            selected = viewKind == choice,
                            onClick = { viewKind = choice },
                            label = { Text(choice) },
                        )
                    }
                }
            }

            BoardEntityKind.PROGRESSION -> {
                SectionLabel("Mode")
                FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    listOf("steps", "meter").forEach { choice ->
                        FilterChip(
                            selected = mode == choice,
                            onClick = { mode = choice },
                            label = { Text(choice) },
                        )
                    }
                }
                OutlinedTextField(
                    value = target,
                    onValueChange = { target = it },
                    label = { Text("Target") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
                OutlinedTextField(
                    value = unit,
                    onValueChange = { unit = it },
                    label = { Text("Unit") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
            }

            BoardEntityKind.RESOURCE -> Unit
        }

        AppearancePicker(icon, color, { icon = it }, { color = it })

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            TextButton(onClick = onDismiss) { Text("Cancel") }
            Button(
                onClick = {
                    if (model.saveEntity(kind, title, icon, color)) onDismiss()
                },
                enabled = title.isNotBlank(),
            ) {
                Text("Create")
            }
        }
    }
}
