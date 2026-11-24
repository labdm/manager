package dev.labdm.manager.kit.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Chat
import androidx.compose.material.icons.automirrored.filled.DirectionsRun
import androidx.compose.material.icons.automirrored.filled.MenuBook
import androidx.compose.material.icons.filled.AccountBalanceWallet
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.BarChart
import androidx.compose.material.icons.filled.Bolt
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Circle
import androidx.compose.material.icons.filled.DateRange
import androidx.compose.material.icons.filled.EmojiEvents
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.Flag
import androidx.compose.material.icons.filled.Folder
import androidx.compose.material.icons.filled.GridView
import androidx.compose.material.icons.filled.Group
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Inbox
import androidx.compose.material.icons.filled.Layers
import androidx.compose.material.icons.filled.LocalCafe
import androidx.compose.material.icons.filled.LocalFireDepartment
import androidx.compose.material.icons.filled.Palette
import androidx.compose.material.icons.filled.Place
import androidx.compose.material.icons.filled.Redeem
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Shield
import androidx.compose.material.icons.filled.Star
import androidx.compose.material.icons.filled.Work
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import dev.labdm.manager.kit.Appearance
import dev.labdm.manager.kit.IconChoice

/** Resolves a stored Lucide name to a Material icon. Unknown names are safe. */
internal fun iconFor(name: String): ImageVector =
    when (name) {
        "house" -> Icons.Filled.Home
        "layout-grid", "square.grid.2x2" -> Icons.Filled.GridView
        "heart" -> Icons.Filled.Favorite
        "footprints", "figure.walk", "dumbbell" -> Icons.AutoMirrored.Filled.DirectionsRun
        "users", "person.2" -> Icons.Filled.Group
        "briefcase" -> Icons.Filled.Work
        "folder" -> Icons.Filled.Folder
        "wallet", "dollarsign.circle" -> Icons.Filled.AccountBalanceWallet
        "settings", "gearshape" -> Icons.Filled.Settings
        "book-open", "book" -> Icons.AutoMirrored.Filled.MenuBook
        "messages-square", "message", "bubble.left.and.bubble.right" -> Icons.AutoMirrored.Filled.Chat
        "palette", "paintbrush" -> Icons.Filled.Palette
        "sun", "sun.max" -> Icons.Filled.DateRange
        "calendar" -> Icons.Filled.CalendarMonth
        "circle-check", "checkmark.circle", "check", "list-todo" -> Icons.Filled.CheckCircle
        "inbox", "tray.full" -> Icons.Filled.Inbox
        "star" -> Icons.Filled.Star
        "zap", "bolt" -> Icons.Filled.Bolt
        "flag" -> Icons.Filled.Flag
        "target" -> Icons.Filled.Place
        "clock" -> Icons.Filled.Schedule
        "map-pin" -> Icons.Filled.Place
        "sparkles" -> Icons.Filled.AutoAwesome
        "layers" -> Icons.Filled.Layers
        "chart-column" -> Icons.Filled.BarChart
        "trophy" -> Icons.Filled.EmojiEvents
        "gift" -> Icons.Filled.Redeem
        "coffee" -> Icons.Filled.LocalCafe
        "shield" -> Icons.Filled.Shield
        "flame" -> Icons.Filled.LocalFireDepartment
        else -> Icons.Filled.Circle
    }

/** Resolves a palette token to a swatch. Unknown tokens fall back to gray. */
internal fun colorFor(token: String): Color =
    when (Appearance.color(token)) {
        "red" -> Color(0xFFDC2626)
        "orange" -> Color(0xFFEA580C)
        "amber" -> Color(0xFFD97706)
        "yellow" -> Color(0xFFCA8A04)
        "lime" -> Color(0xFF65A30D)
        "green" -> Color(0xFF16A34A)
        "emerald" -> Color(0xFF059669)
        "teal" -> Color(0xFF0D9488)
        "cyan" -> Color(0xFF0891B2)
        "sky" -> Color(0xFF0284C7)
        "blue" -> Color(0xFF2563EB)
        "indigo" -> Color(0xFF4F46E5)
        "violet" -> Color(0xFF7C3AED)
        "purple" -> Color(0xFF9333EA)
        "fuchsia" -> Color(0xFFC026D3)
        "pink" -> Color(0xFFDB2777)
        "rose" -> Color(0xFFE11D48)
        else -> Color(0xFF6B7280)
    }

/**
 * A searchable Lucide grid, palette swatches and a live preview. The user never
 * types an icon name: every choice is a chip resolved to a known icon.
 */
@Composable
internal fun AppearancePicker(
    selectedIcon: String,
    selectedColor: String,
    onIconChange: (String) -> Unit,
    onColorChange: (String) -> Unit,
) {
    var query by remember { mutableStateOf("") }
    val matches = remember(query) { IconChoice.search(query) }

    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        OutlinedTextField(
            value = query,
            onValueChange = { query = it },
            label = { Text("Search icons") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
        )
        FlowRow(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .heightIn(max = 168.dp)
                    .verticalScroll(rememberScrollState()),
            horizontalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            matches.forEach { choice ->
                FilterChip(
                    selected = selectedIcon == choice.id,
                    onClick = { onIconChange(choice.id) },
                    label = { Text(choice.label, textAlign = TextAlign.Center) },
                    leadingIcon = {
                        Icon(
                            imageVector = iconFor(choice.id),
                            contentDescription = null,
                            modifier = Modifier.size(16.dp),
                        )
                    },
                )
            }
        }

        Text("Color", style = MaterialTheme.typography.labelMedium)
        FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            Appearance.colorTokens.forEach { token ->
                Box(
                    modifier =
                        Modifier
                            .size(30.dp)
                            .background(colorFor(token), CircleShape)
                            .border(
                                width = if (selectedColor == token) 3.dp else 1.dp,
                                color = if (selectedColor == token) {
                                    MaterialTheme.colorScheme.onSurface
                                } else {
                                    Color.Transparent
                                },
                                shape = CircleShape,
                            )
                            .clickable { onColorChange(token) },
                )
            }
        }

        HorizontalDivider()
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(
                imageVector = iconFor(selectedIcon),
                contentDescription = "Appearance preview",
                tint = colorFor(selectedColor),
                modifier = Modifier.padding(end = 8.dp),
            )
            Text("Appearance preview", style = MaterialTheme.typography.bodySmall)
        }
    }
}
