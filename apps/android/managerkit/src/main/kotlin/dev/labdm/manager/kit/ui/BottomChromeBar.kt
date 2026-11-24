package dev.labdm.manager.kit.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.List
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.DateRange
import androidx.compose.material.icons.filled.GridView
import androidx.compose.material.icons.filled.Today
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import dev.labdm.manager.kit.BoardState
import dev.labdm.manager.kit.TaskBoardModel
import dev.labdm.manager.kit.TaskSlice

/**
 * The app chrome: four slice tabs, a grid button for the full-screen dashboard
 * and a plus for the sheet. Replaces the old side rail on every screen width.
 */
@Composable
internal fun BottomChromeBar(
    model: TaskBoardModel,
    state: BoardState,
) {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        color = MaterialTheme.colorScheme.surface,
        shadowElevation = 8.dp,
        tonalElevation = 3.dp,
    ) {
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 6.dp, vertical = 6.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            TaskSlice.entries.forEach { slice ->
                val selected = state.selectedSlice == slice
                val label = slice.name.lowercase().replaceFirstChar { it.uppercase() }
                Column(
                    modifier =
                        Modifier
                            .weight(1f)
                            .background(
                                if (selected) Accent else Color.Transparent,
                                RoundedCornerShape(14.dp),
                            )
                            .clickable { model.selectSlice(slice) }
                            .padding(vertical = 8.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(2.dp),
                ) {
                    Icon(
                        imageVector = sliceIcon(slice),
                        contentDescription = null,
                        tint = if (selected) Color.White else Muted,
                        modifier = Modifier.size(18.dp),
                    )
                    Text(
                        text = label,
                        style = MaterialTheme.typography.labelSmall,
                        fontWeight = if (selected) FontWeight.Bold else FontWeight.Normal,
                        color = if (selected) Color.White else Muted,
                    )
                }
            }

            Box(
                modifier =
                    Modifier
                        .padding(horizontal = 4.dp)
                        .width(1.dp)
                        .height(28.dp)
                        .background(MaterialTheme.colorScheme.outlineVariant),
            )

            IconButton(onClick = { model.openDashboard() }) {
                Icon(
                    imageVector = Icons.Filled.GridView,
                    contentDescription = "Open categories dashboard",
                    tint = Accent,
                )
            }

            IconButton(onClick = { model.beginTask() }) {
                Surface(shape = CircleShape, color = Accent, modifier = Modifier.size(36.dp)) {
                    Box(contentAlignment = Alignment.Center) {
                        Icon(
                            imageVector = Icons.Filled.Add,
                            contentDescription = "Create a task",
                            tint = Color.White,
                        )
                    }
                }
            }
        }
    }
}

private fun sliceIcon(slice: TaskSlice): ImageVector =
    when (slice) {
        TaskSlice.TASKS -> Icons.AutoMirrored.Filled.List
        TaskSlice.DAILY -> Icons.Filled.Today
        TaskSlice.WEEKLY -> Icons.Filled.CalendarMonth
        TaskSlice.MONTHLY -> Icons.Filled.DateRange
    }
