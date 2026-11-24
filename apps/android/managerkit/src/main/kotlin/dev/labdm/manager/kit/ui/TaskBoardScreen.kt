package dev.labdm.manager.kit.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ExitToApp
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import dev.labdm.manager.kit.BoardAlert
import dev.labdm.manager.kit.BoardColumnSections
import dev.labdm.manager.kit.BoardPhase
import dev.labdm.manager.kit.BoardQuestion
import dev.labdm.manager.kit.BoardQuestionOption
import dev.labdm.manager.kit.BoardState
import dev.labdm.manager.kit.ProgressionState
import dev.labdm.manager.kit.QuestState
import dev.labdm.manager.kit.TaskBoardModel
import dev.labdm.manager.kit.TaskDateLabels
import dev.labdm.manager.kit.TaskItem
import dev.labdm.manager.kit.TaskLook
import kotlinx.coroutines.launch

/**
 * The signed-in screen. `account` and `onSignOut` come from the app layer
 * because the account control is a Clerk composable, like Apple's `Accessory`.
 *
 * The Home shell has no side rail: one board column, a bottom bar with the four
 * time slices, a grid button that covers the screen with category tiles, and a
 * plus that presents the task sheet. Creating or editing anything presents a
 * modal bottom sheet; no form is ever pushed into the column.
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

    Box(modifier = modifier.fillMaxSize()) {
        Scaffold(
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
            bottomBar = { BottomChromeBar(model = model, state = state) },
        ) { padding ->
            BoardColumn(
                model = model,
                state = state,
                scope = scope,
                modifier =
                    Modifier
                        .fillMaxSize()
                        .padding(padding),
            )
        }

        if (state.showsDashboard) {
            CategoryDashboard(
                model = model,
                state = state,
                onClose = { model.closeDashboard() },
            )
        }

        BoardSheetHost(model = model, state = state)
    }
}

@Composable
private fun BoardColumn(
    model: TaskBoardModel,
    state: BoardState,
    scope: kotlinx.coroutines.CoroutineScope,
    modifier: Modifier = Modifier,
) {
    val tasks = model.tasksForCurrentSlice()
    val sections =
        BoardColumnSections.of(
            tasks = tasks,
            alerts = state.unreadAlerts,
            questions = state.openQuestions,
            progression = state.progression,
            quest = state.quest,
            pinnedTaskIds = state.pinnedTaskIds,
        )

    Column(
        modifier =
            modifier
                .verticalScroll(rememberScrollState())
                .background(MaterialTheme.colorScheme.background)
                .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        if (state.phase == BoardPhase.Loading) {
            LinearProgressIndicator(modifier = Modifier.fillMaxWidth())
        }
        model.connectionNotice?.let { Notice(it) }
        state.errorMessage?.let {
            Notice(
                text = it,
                action = { TextButton(onClick = { model.dismissError() }) { Text("Dismiss") } },
            )
        }
        (state.phase as? BoardPhase.Failed)?.let { failed ->
            Notice(
                text = failed.message,
                action = { TextButton(onClick = { model.retry() }) { Text("Retry") } },
            )
        }

        sections.alerts.forEach { alert ->
            AlertBand(
                alert = alert,
                onRead = { model.markAlertRead(alert.id) },
            )
        }
        sections.questions.forEach { question ->
            QuestionGroup(
                question = question,
                onAnswer = { option -> model.answerQuestion(question.id, option.id) },
            )
        }
        sections.pinnedTasks.forEach { task -> TaskRowFor(task, state, model, scope) }
        sections.tasks.forEach { task -> TaskRowFor(task, state, model, scope) }
        sections.progression?.let { ProgressionBar(progression = it) }
        sections.quest?.let { QuestStepper(quest = it) }
        if (sections.isEmpty) {
            Text(
                text = "Nothing here yet.",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

@Composable
private fun TaskRowFor(
    task: TaskItem,
    state: BoardState,
    model: TaskBoardModel,
    scope: kotlinx.coroutines.CoroutineScope,
) {
    TaskRow(
        task = task,
        busy = task.id in state.inFlight,
        onOpen = { scope.launch { model.openTask(task) } },
        onCheckedChange = { done -> scope.launch { model.setDone(task.id, done) } },
        onDelete = { scope.launch { model.delete(task) } },
    )
}

@Composable
private fun AlertBand(
    alert: BoardAlert,
    onRead: (String) -> Unit,
) {
    Card(Modifier.fillMaxWidth()) {
        Column(
            modifier = Modifier.padding(12.dp),
            verticalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = alert.title,
                    style = MaterialTheme.typography.bodyLarge,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier.weight(1f),
                )
                Text(
                    text = alert.source?.wire ?: "manager",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            alert.body?.let {
                Text(
                    text = it,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            TextButton(onClick = { onRead(alert.id) }) { Text("Read") }
        }
    }
}

@Composable
private fun QuestionGroup(
    question: BoardQuestion,
    onAnswer: (BoardQuestionOption) -> Unit,
) {
    Card(Modifier.fillMaxWidth()) {
        Column(
            modifier = Modifier.padding(12.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Text(
                text = question.prompt,
                style = MaterialTheme.typography.bodyLarge,
                fontWeight = FontWeight.SemiBold,
            )
            androidx.compose.foundation.layout.FlowRow(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                question.options.forEach { option ->
                    FilterChip(
                        selected = false,
                        onClick = { onAnswer(option) },
                        label = { Text(option.label) },
                    )
                }
            }
        }
    }
}

@Composable
private fun ProgressionBar(progression: ProgressionState) {
    val progress =
        if (progression.target > 0) {
            progression.current.coerceIn(0, progression.target).toFloat() / progression.target
        } else {
            0f
        }
    Card(Modifier.fillMaxWidth()) {
        Column(
            modifier = Modifier.padding(12.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = progression.title,
                    style = MaterialTheme.typography.bodyLarge,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier.weight(1f),
                )
                Text(
                    text = "${progression.current}/${progression.target}${progression.unit?.let { " $it" } ?: ""}",
                    style = MaterialTheme.typography.labelLarge,
                )
            }
            LinearProgressIndicator(
                progress = { progress },
                modifier = Modifier.fillMaxWidth(),
            )
        }
    }
}

@Composable
private fun QuestStepper(quest: QuestState) {
    Card(Modifier.fillMaxWidth()) {
        Column(
            modifier = Modifier.padding(12.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Text(
                text = quest.title,
                style = MaterialTheme.typography.bodyLarge,
                fontWeight = FontWeight.SemiBold,
            )
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                quest.steps.forEach { step ->
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        Surface(
                            color = MaterialTheme.colorScheme.secondaryContainer,
                            contentColor = MaterialTheme.colorScheme.onSecondaryContainer,
                            shape = MaterialTheme.shapes.small,
                        ) {
                            Text(
                                text = step.position.toString(),
                                style = MaterialTheme.typography.labelSmall,
                                fontWeight = FontWeight.Bold,
                                modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
                            )
                        }
                        Text(
                            text = step.title,
                            style = MaterialTheme.typography.bodySmall,
                            modifier = Modifier.weight(1f),
                        )
                    }
                }
                if (quest.nextStep == null) {
                    Text(
                        text = "Waiting",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        }
    }
}

/**
 * The look is stored on the task. `check` is a checkbox row, `row` is a plain
 * line with no checkbox and `card` is an emphasized card. Unknown values fall
 * back to `check` at the wire boundary.
 */
@Composable
private fun TaskRow(
    task: TaskItem,
    busy: Boolean,
    onOpen: () -> Unit,
    onCheckedChange: (Boolean) -> Unit,
    onDelete: () -> Unit,
) {
    when (task.look) {
        TaskLook.ROW ->
            Row(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .clickable(enabled = !busy, onClick = onOpen)
                        .padding(horizontal = 12.dp, vertical = 10.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                TaskBody(task, Modifier.weight(1f))
                IconButton(onClick = onDelete, enabled = !busy) {
                    Icon(Icons.Filled.Delete, contentDescription = "Delete ${task.title}")
                }
            }

        TaskLook.CARD ->
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors =
                    CardDefaults.cardColors(
                        containerColor = MaterialTheme.colorScheme.secondaryContainer,
                    ),
                elevation = CardDefaults.cardElevation(defaultElevation = 4.dp),
            ) {
                TaskRowContent(task, busy, onOpen, onCheckedChange, onDelete)
            }

        TaskLook.CHECK ->
            Card(Modifier.fillMaxWidth()) {
                TaskRowContent(task, busy, onOpen, onCheckedChange, onDelete)
            }
    }
}

@Composable
private fun TaskRowContent(
    task: TaskItem,
    busy: Boolean,
    onOpen: () -> Unit,
    onCheckedChange: (Boolean) -> Unit,
    onDelete: () -> Unit,
) {
    Row(
        modifier =
            Modifier
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
        TaskBody(task, Modifier.weight(1f))
        IconButton(onClick = onDelete, enabled = !busy) {
            Icon(Icons.Filled.Delete, contentDescription = "Delete ${task.title}")
        }
    }
}

@Composable
private fun TaskBody(
    task: TaskItem,
    modifier: Modifier = Modifier,
) {
    Column(modifier) {
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
        androidx.compose.foundation.layout.FlowRow(
            horizontalArrangement = Arrangement.spacedBy(10.dp),
        ) {
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
