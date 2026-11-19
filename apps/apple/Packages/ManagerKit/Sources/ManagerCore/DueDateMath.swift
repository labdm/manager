import Foundation

/// Conversions between `Date` and the backend's epoch milliseconds.
///
/// The backend validates `dueAt` with `Number.isSafeInteger`, and the web client
/// stores local midnight of the chosen day (`new Date("2026-11-19T00:00:00")`).
/// Apple clients must do the same so a task due "today" is due today on every
/// device, not at the moment it was typed.
public enum DueDateMath {
  /// Epoch milliseconds for the start of `date`'s day.
  public static func millisecondsForDay(
    _ date: Date,
    calendar: Calendar = .current
  ) -> Int64 {
    milliseconds(sinceEpoch: calendar.startOfDay(for: date))
  }

  /// Epoch milliseconds for an exact instant, rounded to the nearest millisecond.
  public static func milliseconds(sinceEpoch date: Date) -> Int64 {
    Int64((date.timeIntervalSince1970 * 1000).rounded())
  }

  /// Converts the backend's milliseconds into a `Date`.
  public static func date(fromMilliseconds milliseconds: Double) -> Date {
    Date(timeIntervalSince1970: milliseconds / 1000)
  }

  /// Converts the backend's milliseconds into the start of that local day.
  public static func day(fromMilliseconds milliseconds: Double, calendar: Calendar = .current) -> Date {
    calendar.startOfDay(for: date(fromMilliseconds: milliseconds))
  }
}
