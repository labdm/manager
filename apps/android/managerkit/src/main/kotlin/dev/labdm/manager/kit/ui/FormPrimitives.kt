package dev.labdm.manager.kit.ui

import android.app.DatePickerDialog
import android.app.TimePickerDialog
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import dev.labdm.manager.kit.DueDateMath
import dev.labdm.manager.kit.PlannedTimeMath
import dev.labdm.manager.kit.Priority
import dev.labdm.manager.kit.TaskDateLabels
import java.util.Calendar
import java.util.Date

/** The planned day. Written as the start of that local day. */
@Composable
internal fun DayButton(
    dayMillis: Long?,
    label: String,
    allowClear: Boolean = true,
    onChange: (Long?) -> Unit,
) {
    val context = LocalContext.current
    val calendar =
        Calendar.getInstance().apply {
            time = Date(dayMillis ?: System.currentTimeMillis())
        }

    TextButton(
        onClick = {
            DatePickerDialog(
                context,
                { _, year, month, day ->
                    val picked =
                        Calendar.getInstance().apply {
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
internal fun TimeButton(
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
internal fun InstantButton(
    instantMillis: Long?,
    label: String,
    allowClear: Boolean = true,
    onChange: (Long?) -> Unit,
) {
    val context = LocalContext.current
    val start =
        Calendar.getInstance().apply {
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
                            val picked =
                                Calendar.getInstance().apply {
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
internal fun PriorityChips(selected: Priority?, onSelect: (Priority?) -> Unit) {
    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
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

@Composable
internal fun Meta(
    text: String,
    color: Color,
) {
    Text(text = text, style = MaterialTheme.typography.labelSmall, color = color)
}

/** The NEW mark that leaves the row once it is opened. */
@Composable
internal fun NewMark() {
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

/** A shared full-width message with an optional action. */
@Composable
internal fun Notice(
    text: String,
    action: (@Composable () -> Unit)? = null,
) {
    Surface(
        color = MaterialTheme.colorScheme.errorContainer,
        contentColor = MaterialTheme.colorScheme.onErrorContainer,
        shape = MaterialTheme.shapes.small,
        modifier = Modifier.fillMaxWidth(),
    ) {
        Row(modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp)) {
            Text(text, Modifier.weight(1f))
            action?.invoke()
        }
    }
}
