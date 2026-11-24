package dev.labdm.manager.kit.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Card
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import dev.labdm.manager.kit.BoardState
import dev.labdm.manager.kit.TaskBoardModel

/**
 * The full-screen category dashboard reached from the grid button. It covers the
 * whole screen; it is never a navigation drawer or a side rail. Picking a tile
 * selects the view and closes the cover.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun CategoryDashboard(
    model: TaskBoardModel,
    state: BoardState,
    onClose: () -> Unit,
) {
    Box(
        modifier =
            Modifier
                .fillMaxSize()
                .background(MaterialTheme.colorScheme.background),
    ) {
        Column(Modifier.fillMaxSize()) {
            TopAppBar(
                title = { Text("Categories") },
                actions = { TextButton(onClick = onClose) { Text("Done") } },
            )
            Column(
                modifier =
                    Modifier
                        .fillMaxSize()
                        .verticalScroll(rememberScrollState())
                        .padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Text(
                    text = "Categories, events and tracks",
                    style = MaterialTheme.typography.titleMedium,
                )
                FlowRow(
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    state.dashboardTiles.forEach { tile ->
                        Card(
                            modifier =
                                Modifier
                                    .width(140.dp)
                                    .semantics {
                                        contentDescription = if (tile.isAddTile) "Add category" else tile.title
                                    },
                            onClick = {
                                model.selectDashboardTile(tile)
                                onClose()
                            },
                        ) {
                            Column(
                                modifier = Modifier.padding(14.dp),
                                horizontalAlignment = Alignment.CenterHorizontally,
                                verticalArrangement = Arrangement.spacedBy(10.dp),
                            ) {
                                Surface(
                                    shape = CircleShape,
                                    color = colorFor(tile.color).copy(alpha = 0.16f),
                                    modifier = Modifier.size(52.dp),
                                ) {
                                    Box(contentAlignment = Alignment.Center) {
                                        Icon(
                                            imageVector = iconFor(tile.icon),
                                            contentDescription = null,
                                            tint = colorFor(tile.color),
                                            modifier = Modifier.size(26.dp),
                                        )
                                    }
                                }
                                Text(
                                    text = tile.title,
                                    style = MaterialTheme.typography.labelLarge,
                                    textAlign = TextAlign.Center,
                                    maxLines = 2,
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}
