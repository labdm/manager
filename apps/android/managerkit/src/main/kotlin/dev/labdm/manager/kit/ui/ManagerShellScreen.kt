package dev.labdm.manager.kit.ui

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.ExitToApp
import androidx.compose.material.icons.automirrored.filled.List
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Category
import androidx.compose.material.icons.filled.Email
import androidx.compose.material.icons.filled.Groups
import androidx.compose.material.icons.filled.Inventory2
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material3.Badge
import androidx.compose.material3.BadgedBox
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.ListItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalDrawerSheet
import androidx.compose.material3.ModalNavigationDrawer
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationDrawerItem
import androidx.compose.material3.NavigationRail
import androidx.compose.material3.NavigationRailItem
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.rememberDrawerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import dev.labdm.manager.kit.ActivityOnTasks
import dev.labdm.manager.kit.BoardChip
import dev.labdm.manager.kit.BoardPhase
import dev.labdm.manager.kit.BoardState
import dev.labdm.manager.kit.ShellDestination
import dev.labdm.manager.kit.ShellMenu
import dev.labdm.manager.kit.ShellRow
import dev.labdm.manager.kit.ShellRowKind
import dev.labdm.manager.kit.TaskBoardModel
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch

/**
 * The signed-in shell. Compact widths use a Material 3 navigation bar; from
 * 600dp the same five destinations move to a navigation rail and the bar is
 * gone. The menu is a modal drawer with its own rows, not a pinned rail.
 *
 * The expanded layout is rail + list + detail. Detail starts empty and there
 * is no initial or post-filter selection, because opening a row is what marks
 * it seen.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ManagerShellScreen(
    model: TaskBoardModel,
    account: @Composable () -> Unit,
    onSignOut: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val state by model.state.collectAsStateWithLifecycle()
    val scope = rememberCoroutineScope()

    when {
        state.showsCreate ->
            TaskFormScreen(
                model = model,
                taskId = null,
                onClose = model::closeCreate,
                account = account,
                onSignOut = onSignOut,
                modifier = modifier,
            )

        state.openMenuPage != null ->
            MenuPageScreen(
                page = requireNotNull(state.openMenuPage),
                model = model,
                state = state,
                account = account,
                onSignOut = onSignOut,
                onClose = model::closeMenuPage,
                modifier = modifier,
            )

        else -> ShellContent(model, state, scope, account, onSignOut, modifier)
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ShellContent(
    model: TaskBoardModel,
    state: BoardState,
    scope: CoroutineScope,
    account: @Composable () -> Unit,
    onSignOut: () -> Unit,
    modifier: Modifier,
) {
    val drawerState = rememberDrawerState(initialValue = androidx.compose.material3.DrawerValue.Closed)
    LaunchedEffect(state.drawerOpen) {
        if (state.drawerOpen) drawerState.open() else drawerState.close()
    }

    ModalNavigationDrawer(
        drawerState = drawerState,
        drawerContent = {
            ModalDrawerSheet(modifier = Modifier.width(300.dp)) {
                ShellDrawer(model)
            }
        },
    ) {
        BoxWithConstraints(modifier.fillMaxSize()) {
            if (maxWidth < 600.dp) {
                if (state.selectedRow != null) {
                    CompactDetail(model, state, account, onSignOut)
                } else {
                    Scaffold(
                        topBar = { ShellTopBar(model, state, account, onSignOut) },
                        bottomBar = { ShellNavigationBar(model, state) },
                    ) { padding ->
                        ShellColumn(model, state, scope, Modifier.padding(padding))
                    }
                }
            } else {
                Row(Modifier.fillMaxSize()) {
                    ShellNavigationRail(model, state)
                    Scaffold(
                        modifier = Modifier.weight(1f),
                        topBar = { ShellTopBar(model, state, account, onSignOut) },
                    ) { padding ->
                        ShellColumn(model, state, scope, Modifier.padding(padding))
                    }
                    HorizontalDivider(Modifier.width(1.dp).fillMaxHeight())
                    DetailPane(
                        model = model,
                        state = state,
                        modifier = Modifier.weight(1f).fillMaxHeight(),
                    )
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ShellTopBar(
    model: TaskBoardModel,
    state: BoardState,
    account: @Composable () -> Unit,
    onSignOut: () -> Unit,
) {
    TopAppBar(
        title = { Text(state.destination.label) },
        navigationIcon = {
            IconButton(onClick = model::openDrawer, modifier = Modifier.testTag("menu-button")) {
                Icon(Icons.Filled.Menu, contentDescription = "Open menu")
            }
        },
        actions = {
            GroupSwitcher(model, state)
            IconButton(onClick = model::openCreate, modifier = Modifier.testTag("create-button")) {
                Icon(Icons.Filled.Add, contentDescription = "Create")
            }
            account()
            IconButton(onClick = onSignOut) {
                Icon(
                    Icons.AutoMirrored.Filled.ExitToApp,
                    contentDescription = "Sign out",
                )
            }
        },
    )
}

@Composable
private fun GroupSwitcher(
    model: TaskBoardModel,
    state: BoardState,
) {
    var expanded by remember { mutableStateOf(false) }
    val label = state.groups.firstOrNull { it.id == state.selectedGroupId }?.name ?: "All"
    Box {
        TextButton(onClick = { expanded = true }, modifier = Modifier.testTag("group-switcher")) {
            Text(label)
        }
        DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
            DropdownMenuItem(
                text = { Text("All") },
                onClick = {
                    model.selectGroup(null)
                    expanded = false
                },
            )
            state.groups.forEach { group ->
                DropdownMenuItem(
                    text = { Text(group.name) },
                    onClick = {
                        model.selectGroup(group.id)
                        expanded = false
                    },
                )
            }
        }
    }
}

@Composable
private fun ShellNavigationBar(
    model: TaskBoardModel,
    state: BoardState,
) {
    NavigationBar(modifier = Modifier.testTag("primary-bar")) {
        ShellDestination.entries.forEach { destination ->
            NavigationBarItem(
                selected = state.destination == destination,
                onClick = { model.selectDestination(destination) },
                icon = { DestinationIcon(destination, state) },
                label = { Text(destination.label) },
                modifier = Modifier.testTag("destination-${destination.wire}"),
            )
        }
    }
}

@Composable
private fun ShellNavigationRail(
    model: TaskBoardModel,
    state: BoardState,
) {
    NavigationRail(modifier = Modifier.width(80.dp).testTag("primary-rail")) {
        ShellDestination.entries.forEach { destination ->
            NavigationRailItem(
                selected = state.destination == destination,
                onClick = { model.selectDestination(destination) },
                icon = { DestinationIcon(destination, state) },
                label = { Text(destination.label) },
                modifier = Modifier.testTag("rail-destination-${destination.wire}"),
            )
        }
        Spacer(Modifier.weight(1f))
        HorizontalDivider()
        NavigationRailItem(
            selected = false,
            onClick = model::openDrawer,
            icon = { Icon(Icons.Filled.Menu, contentDescription = "Open menu") },
            label = { Text("Menu") },
            modifier = Modifier.testTag("rail-menu-button"),
        )
    }
}

@Composable
private fun DestinationIcon(
    destination: ShellDestination,
    state: BoardState,
) {
    val icon: ImageVector =
        when (destination) {
            ShellDestination.TASKS -> Icons.AutoMirrored.Filled.List
            ShellDestination.MESSAGES -> Icons.Filled.Email
            ShellDestination.GROUPS -> Icons.Filled.Groups
            ShellDestination.CATEGORIES -> Icons.Filled.Category
            ShellDestination.RESOURCES -> Icons.Filled.Inventory2
        }
    val badge = if (destination == ShellDestination.TASKS) modelUnseen(state) else 0
    BadgedBox(
        badge = {
            if (badge > 0) {
                Badge { Text(badge.toString()) }
            }
        },
    ) {
        Icon(icon, contentDescription = null)
    }
}

/** The bar badge comes from the mixed feed; chips keep their own counts. */
private fun modelUnseen(state: BoardState): Int =
    state.tasks.count { it.isNew } +
        state.board.alerts.count { it.isUnread } +
        state.board.questions.count { it.answeredAt == null } +
        state.invites.count { it.isUnread }

@Composable
private fun ShellColumn(
    model: TaskBoardModel,
    state: BoardState,
    scope: CoroutineScope,
    modifier: Modifier,
) {
    Column(modifier.fillMaxSize()) {
        if (state.phase == BoardPhase.Loading) {
            LinearProgressIndicator(Modifier.fillMaxWidth())
        }
        if (state.destination == ShellDestination.TASKS) {
            FilterChips(model, state)
        }
        ShellList(model, state, scope)
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun FilterChips(
    model: TaskBoardModel,
    state: BoardState,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .horizontalScroll(rememberScrollState())
            .padding(horizontal = 12.dp, vertical = 8.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        BoardChip.entries.forEach { chip ->
            val count = model.unseenCount(chip)
            FilterChip(
                selected = state.chip == chip,
                onClick = { model.selectChip(chip) },
                label = {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(chip.label)
                        if (count > 0) {
                            Spacer(Modifier.width(6.dp))
                            Badge { Text(count.toString()) }
                        }
                    }
                },
                modifier = Modifier.testTag("chip-${chip.wire}"),
            )
        }
    }
}

@Composable
private fun ShellList(
    model: TaskBoardModel,
    state: BoardState,
    scope: CoroutineScope,
) {
    val rows = model.rowsFor(state.destination, state.chip)
    LazyColumn(
        modifier = Modifier.fillMaxSize().testTag("row-list"),
        verticalArrangement = Arrangement.spacedBy(2.dp),
    ) {
        items(rows, key = { it.id }) { row ->
            ShellRowItem(
                row = row,
                selected = state.selectedRow?.id == row.id,
                busy = row.id in state.inFlight,
                onSelect = { scope.launch { model.selectRow(row) } },
                onDone = { done ->
                    scope.launch { model.setDone(row.id.removePrefix("task-"), done) }
                },
                onAccept = { scope.launch { model.acceptInvite(row.id.removePrefix("invite-")) } },
                onDecline = { scope.launch { model.declineInvite(row.id.removePrefix("invite-")) } },
            )
        }
        if (rows.isEmpty()) {
            item {
                Text(
                    text = "Nothing here yet.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(16.dp),
                )
            }
        }
        item {
            state.errorMessage?.let { error ->
                Text(
                    text = error,
                    color = MaterialTheme.colorScheme.error,
                    style = MaterialTheme.typography.bodySmall,
                    modifier = Modifier.padding(16.dp),
                )
                TextButton(onClick = model::dismissError) { Text("Dismiss") }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ShellRowItem(
    row: ShellRow,
    selected: Boolean,
    busy: Boolean,
    onSelect: () -> Unit,
    onDone: (Boolean) -> Unit,
    onAccept: () -> Unit,
    onDecline: () -> Unit,
) {
    ListItem(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(enabled = !busy, onClick = onSelect)
            .testTag("row-${row.id}"),
        leadingContent = {
            if (row.kind == ShellRowKind.TASK) {
                androidx.compose.material3.Checkbox(
                    checked = row.done,
                    onCheckedChange = onDone,
                    enabled = !busy,
                )
            } else {
                Icon(rowIcon(row.kind), contentDescription = null)
            }
        },
        headlineContent = {
            Row(verticalAlignment = Alignment.CenterVertically) {
                if (row.isNew) {
                    Surface(
                        color = MaterialTheme.colorScheme.tertiaryContainer,
                        shape = MaterialTheme.shapes.extraSmall,
                    ) {
                        Text(
                            "NEW",
                            style = MaterialTheme.typography.labelSmall,
                            modifier = Modifier.padding(horizontal = 4.dp, vertical = 2.dp),
                        )
                    }
                    Spacer(Modifier.width(6.dp))
                }
                Text(
                    text = row.title,
                    style = MaterialTheme.typography.bodyLarge,
                    fontWeight = if (selected) FontWeight.SemiBold else FontWeight.Normal,
                )
            }
        },
        supportingContent = {
            val parts = listOfNotNull(row.group, row.due, row.progress, row.body)
            if (parts.isNotEmpty()) {
                Text(parts.joinToString(" · "), style = MaterialTheme.typography.bodySmall)
            }
        },
        trailingContent = {
            Row(horizontalArrangement = Arrangement.spacedBy(2.dp)) {
                when (row.kind) {
                    ShellRowKind.MESSAGE -> TextButton(onClick = onSelect) { Text("Mark read") }
                    ShellRowKind.QUESTION -> TextButton(onClick = onSelect) { Text("Answer") }
                    ShellRowKind.INVITE -> {
                        TextButton(onClick = onAccept, modifier = Modifier.testTag("accept-${row.id}")) {
                            Text("Accept")
                        }
                        TextButton(onClick = onDecline, modifier = Modifier.testTag("decline-${row.id}")) {
                            Text("Decline")
                        }
                    }

                    ShellRowKind.PROGRESSION -> TextButton(onClick = onSelect) { Text("Log") }
                    else -> Unit
                }
            }
        },
    )
}

private fun rowIcon(kind: ShellRowKind): ImageVector =
    when (kind) {
        ShellRowKind.MESSAGE -> Icons.Filled.Email
        ShellRowKind.GROUP -> Icons.Filled.Groups
        ShellRowKind.CATEGORY -> Icons.Filled.Category
        ShellRowKind.RESOURCE, ShellRowKind.PROGRESSION -> Icons.Filled.Inventory2
        else -> Icons.AutoMirrored.Filled.List
    }

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun CompactDetail(
    model: TaskBoardModel,
    state: BoardState,
    account: @Composable () -> Unit,
    onSignOut: () -> Unit,
) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Details") },
                navigationIcon = {
                    IconButton(onClick = model::clearSelection) {
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
        DetailPane(model, state, Modifier.padding(padding).fillMaxSize())
    }
}

@Composable
private fun DetailPane(
    model: TaskBoardModel,
    state: BoardState,
    modifier: Modifier,
) {
    val scope = rememberCoroutineScope()
    Surface(
        modifier = modifier.testTag("detail-pane"),
        color = MaterialTheme.colorScheme.surface,
    ) {
        val selection = state.selectedRow
        if (selection == null) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                if (state.boardError != null) {
                    Text(
                        text = requireNotNull(state.boardError),
                        color = MaterialTheme.colorScheme.error,
                        modifier = Modifier.padding(16.dp).testTag("detail-error"),
                    )
                } else {
                    Text(
                        text = "Select an item.",
                        style = MaterialTheme.typography.bodyLarge,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.testTag("empty-detail"),
                    )
                }
            }
        } else {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .verticalScroll(rememberScrollState())
                    .padding(20.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Text(
                    text = selection.title,
                    style = MaterialTheme.typography.headlineSmall,
                    modifier = Modifier.testTag("detail-title"),
                )
                Text(
                    text = selection.kind.wire.replaceFirstChar { it.uppercase() },
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                val row = model.currentRows().firstOrNull { it.id == selection.id }
                row?.body?.let { Text(it) }
                row?.due?.let { Text(it, style = MaterialTheme.typography.bodySmall) }
                row?.progress?.let { Text(it, style = MaterialTheme.typography.bodySmall) }
                if (selection.kind == ShellRowKind.TASK && row?.done == false) {
                    TextButton(onClick = { scope.launch { model.setDone(selection.id.removePrefix("task-"), true) } }) {
                        Text("Done")
                    }
                }
                if (row?.unseen == true) {
                    TextButton(onClick = { row.let { scope.launch { model.selectRow(it) } } }) {
                        Text("Mark as read")
                    }
                }
                state.errorMessage?.let { error ->
                    Text(text = error, color = MaterialTheme.colorScheme.error)
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ShellDrawer(model: TaskBoardModel) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(vertical = 12.dp),
    ) {
        Text(
            "Menu",
            style = MaterialTheme.typography.titleLarge,
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
        )
        HorizontalDivider()
        ShellMenu.rows.forEach { page ->
            NavigationDrawerItem(
                label = { Text(page) },
                selected = false,
                onClick = { model.openMenuPage(page) },
                modifier = Modifier.testTag("drawer-$page"),
            )
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun MenuPageScreen(
    page: String,
    model: TaskBoardModel,
    state: BoardState,
    account: @Composable () -> Unit,
    onSignOut: () -> Unit,
    onClose: () -> Unit,
    modifier: Modifier,
) {
    val scope = rememberCoroutineScope()
    Scaffold(
        modifier = modifier.fillMaxSize(),
        topBar = {
            TopAppBar(
                title = { Text(page) },
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
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            when (page) {
                "Settings" -> {
                    Text("Activity on Tasks", style = MaterialTheme.typography.titleMedium)
                    ActivityOnTasks.entries.forEach { value ->
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable { model.setActivityOnTasks(value) }
                                .testTag("activity-${value.wire}"),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            RadioButton(
                                selected = state.activityOnTasks == value,
                                onClick = { model.setActivityOnTasks(value) },
                            )
                            Text(value.label)
                        }
                    }
                }

                "Routings" -> {
                    state.routings.forEach { routing ->
                        Text("${routing.trigger} → ${routing.execution}")
                    }
                    var trigger by remember { mutableStateOf("") }
                    var execution by remember { mutableStateOf("") }
                    androidx.compose.material3.OutlinedTextField(
                        value = trigger,
                        onValueChange = { trigger = it },
                        label = { Text("Trigger") },
                        modifier = Modifier.fillMaxWidth(),
                    )
                    androidx.compose.material3.OutlinedTextField(
                        value = execution,
                        onValueChange = { execution = it },
                        label = { Text("Execution") },
                        modifier = Modifier.fillMaxWidth(),
                    )
                    TextButton(
                        onClick = {
                            scope.launch { model.createRouting(trigger, execution) }
                        },
                    ) {
                        Text("Create routing")
                    }
                }

                else -> {
                    Text(
                        text = "$page lives in the menu. The shell does not open it by default.",
                        style = MaterialTheme.typography.bodyMedium,
                    )
                }
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
