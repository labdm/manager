package dev.labdm.manager.kit.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.automirrored.filled.ExitToApp
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.Checkbox
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import dev.labdm.manager.kit.BoardPhase
import dev.labdm.manager.kit.DueDateMath
import dev.labdm.manager.kit.TaskBoardModel
import dev.labdm.manager.kit.TaskItem
import kotlinx.coroutines.launch

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
                        onCheckedChange = { done -> scope.launch { model.setDone(task.id, done) } },
                        onDelete = { scope.launch { model.delete(task) } },
                    )
                }
            }
        }
    }
}

@Composable
private fun Composer(model: TaskBoardModel) {
    val state by model.state.collectAsStateWithLifecycle()
    val scope = rememberCoroutineScope()

    OutlinedTextField(
        value = state.draftTitle,
        onValueChange = { model.updateDraft(it) },
        label = { Text("New task") },
        singleLine = true,
        modifier = Modifier.fillMaxWidth(),
        isError = model.draftValidationMessage != null,
        supportingText = model.draftValidationMessage?.let { { Text(it) } },
    )
    Row(verticalAlignment = Alignment.CenterVertically) {
        Button(
            onClick = { scope.launch { model.addTask() } },
            enabled = model.canSubmitDraft,
        ) {
            Text("Add task")
        }
        TextButton(
            onClick = {
                model.setDraftDueAt(
                    if (state.draftDueAt == null) DueDateMath.startOfDay(System.currentTimeMillis())
                    else null
                )
            },
        ) {
            Text(
                state.draftDueAt?.let { "Due ${DueDateMath.dayLabel(it)} · clear" }
                    ?: "Set due date"
            )
        }
    }
}

@Composable
private fun TaskRow(
    task: TaskItem,
    busy: Boolean,
    onCheckedChange: (Boolean) -> Unit,
    onDelete: () -> Unit,
) {
    Card(Modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Checkbox(
                checked = task.done,
                onCheckedChange = onCheckedChange,
                enabled = !busy,
            )
            Column(Modifier.weight(1f)) {
                Text(
                    text = task.title,
                    style = MaterialTheme.typography.bodyLarge,
                    textDecoration = if (task.done) TextDecoration.LineThrough else null,
                )
                task.dueAt?.let {
                    Text(
                        text = DueDateMath.dayLabel(it),
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
            IconButton(onClick = onDelete, enabled = !busy) {
                Icon(Icons.Filled.Delete, contentDescription = "Delete ${task.title}")
            }
        }
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
