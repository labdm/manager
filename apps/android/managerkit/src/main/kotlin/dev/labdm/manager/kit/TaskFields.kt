package dev.labdm.manager.kit

import java.util.Calendar
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import java.text.SimpleDateFormat

/** Title rules shared with the web/Apple clients. */
object TaskTitle {
    const val MAX_LENGTH = 100

    fun normalize(raw: String): String? {
        val normalized = raw.trim().replace(Regex("\\s+"), " ")
        return normalized.takeIf { it.isNotEmpty() && it.length <= MAX_LENGTH }
    }

    fun isValid(raw: String): Boolean = normalize(raw) != null
}

/** Day-boundary helpers. The backend stores the start of a local day in `dueAt`. */
object DueDateMath {
    fun startOfDay(epochMillis: Long, timeZone: TimeZone = TimeZone.getDefault()): Long {
        val calendar = Calendar.getInstance(timeZone).apply {
            time = Date(epochMillis)
            set(Calendar.HOUR_OF_DAY, 0)
            set(Calendar.MINUTE, 0)
            set(Calendar.SECOND, 0)
            set(Calendar.MILLISECOND, 0)
        }
        return calendar.timeInMillis
    }

    fun dayLabel(epochMillis: Long, locale: Locale = Locale.getDefault()): String =
        SimpleDateFormat("EEE, MMM d", locale).format(Date(epochMillis))
}

/**
 * Labels for the two clocks. A deadline is an instant, so it shows a clock
 * time; the planned day usually has none.
 */
object TaskDateLabels {
    /** `Wed, Mar 4`, or `Wed, Mar 4 · 09:30` when the row has a clock time. */
    fun planned(
        dayMillis: Long,
        minutes: Int?,
        locale: Locale = Locale.getDefault(),
    ): String {
        val day = DueDateMath.dayLabel(dayMillis, locale)
        return if (minutes == null) day else "$day · ${PlannedTimeMath.label(minutes, locale)}"
    }

    /** `Wed, Mar 4 · 18:00` for an instant such as `deadlineAt`. */
    fun instant(epochMillis: Long, locale: Locale = Locale.getDefault()): String =
        SimpleDateFormat("EEE, MMM d · HH:mm", locale).format(Date(epochMillis))
}
