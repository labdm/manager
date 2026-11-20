package dev.labdm.manager.kit.ui

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

// The paper-and-ink palette from packages/ui/src/tasks.css and the Apple client.
val Paper = Color(0xFFF3EFE4)
val Surface = Color(0xFFFFFDF8)
val Ink = Color(0xFF1C1915)
val Muted = Color(0xFF6F675C)
val Accent = Color(0xFF0F6E56)
val Danger = Color(0xFF8D2C1F)

private val LightColors = lightColorScheme(
    primary = Accent,
    onPrimary = Color(0xFFF7F3EA),
    background = Paper,
    onBackground = Ink,
    surface = Surface,
    onSurface = Ink,
    onSurfaceVariant = Muted,
    error = Danger,
)

private val DarkColors = darkColorScheme(
    primary = Color(0xFF5ACBAD),
    onPrimary = Color(0xFF08221B),
    background = Color(0xFF14120F),
    onBackground = Color(0xFFF2EDE3),
    surface = Color(0xFF1E1B17),
    onSurface = Color(0xFFF2EDE3),
    onSurfaceVariant = Color(0xFFA79E90),
    error = Color(0xFFF09A8B),
)

@Composable
fun ManagerTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit,
) {
    MaterialTheme(
        colorScheme = if (darkTheme) DarkColors else LightColors,
        content = content,
    )
}
