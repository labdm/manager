import Foundation

/// Human wording for a due date, relative to "now".
///
/// The web client prints `Due Nov 19, 2026`. On Apple platforms the list is the
/// primary surface, so the same information is said the way a person would say
/// it: "Due today", "Due Wednesday", "Overdue · Nov 12".
public struct DueDateDescription: Equatable, Sendable {
  /// Ready-to-display text, including the "Due"/"Overdue" prefix.
  public let text: String
  public let isOverdue: Bool
  public let isToday: Bool

  public init(text: String, isOverdue: Bool, isToday: Bool) {
    self.text = text
    self.isOverdue = isOverdue
    self.isToday = isToday
  }
}

public enum DueDateLabel {
  /// Names a due day relative to `now`, in the calendar's time zone.
  public static func describe(
    dueAt: Date,
    now: Date = .now,
    calendar: Calendar = .current,
    locale: Locale = .current
  ) -> DueDateDescription {
    let dueDay = calendar.startOfDay(for: dueAt)
    let today = calendar.startOfDay(for: now)
    let dayDelta = calendar.dateComponents([.day], from: today, to: dueDay).day ?? 0
    let timeZone = calendar.timeZone

    let dayText: String
    switch dayDelta {
    case -1:
      dayText = "yesterday"
    case 0:
      dayText = "today"
    case 1:
      dayText = "tomorrow"
    case 2...6:
      dayText = formatted(dueDay, template: nil, format: "EEEE", locale: locale, timeZone: timeZone)
    default:
      let sameYear = calendar.component(.year, from: dueDay)
        == calendar.component(.year, from: today)
      dayText = sameYear
        ? formatted(dueDay, template: "MMMd", locale: locale, timeZone: timeZone)
        : formatted(dueDay, template: "yMMMd", locale: locale, timeZone: timeZone)
    }

    let isOverdue = dueDay < today
    return DueDateDescription(
      text: isOverdue ? "Overdue · \(dayText)" : "Due \(dayText)",
      isOverdue: isOverdue,
      isToday: dayDelta == 0
    )
  }

  /// Short wording for chips and carousel rows, without the "Due" prefix.
  public static func short(
    dueAt: Date,
    now: Date = .now,
    calendar: Calendar = .current,
    locale: Locale = .current
  ) -> String {
    let description = describe(dueAt: dueAt, now: now, calendar: calendar, locale: locale)
    for prefix in ["Overdue · ", "Due "] where description.text.hasPrefix(prefix) {
      return String(description.text.dropFirst(prefix.count))
    }
    return description.text
  }

  private static func formatted(
    _ date: Date,
    template: String?,
    format: String? = nil,
    locale: Locale,
    timeZone: TimeZone
  ) -> String {
    let formatter = DateFormatter()
    formatter.locale = locale
    formatter.timeZone = timeZone
    if let template {
      formatter.setLocalizedDateFormatFromTemplate(template)
    } else if let format {
      formatter.dateFormat = format
    }
    return formatter.string(from: date)
  }
}
