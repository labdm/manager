import Foundation
import Testing
@testable import ManagerCore

// MARK: - Fixtures

func utcCalendar() -> Calendar {
  var calendar = Calendar(identifier: .gregorian)
  calendar.timeZone = TimeZone(identifier: "UTC")!
  calendar.locale = Locale(identifier: "en_US_POSIX")
  return calendar
}

func utcDate(_ year: Int, _ month: Int, _ day: Int, hour: Int = 12) -> Date {
  utcCalendar().date(from: DateComponents(year: year, month: month, day: day, hour: hour))!
}

// MARK: - Task lists

@Suite("Task lists")
struct TaskListTest {
  let now = utcDate(2026, 11, 19)
  let calendar = utcCalendar()

  @Test("Today includes overdue work")
  func todayIncludesOverdue() {
    let overdue = TaskItem(id: "1", title: "Old", done: false, dueAt: utcDate(2026, 11, 12))
    let today = TaskItem(id: "2", title: "Now", done: false, dueAt: utcDate(2026, 11, 19))
    let future = TaskItem(id: "3", title: "Later", done: false, dueAt: utcDate(2026, 11, 25))
    let undated = TaskItem(id: "4", title: "Someday", done: false)

    #expect(TaskList.today.includes(overdue, now: now, calendar: calendar))
    #expect(TaskList.today.includes(today, now: now, calendar: calendar))
    #expect(!TaskList.today.includes(future, now: now, calendar: calendar))
    #expect(!TaskList.today.includes(undated, now: now, calendar: calendar))
  }

  @Test("Upcoming starts tomorrow")
  func upcomingStartsTomorrow() {
    let today = TaskItem(id: "1", title: "Now", done: false, dueAt: utcDate(2026, 11, 19))
    let tomorrow = TaskItem(id: "2", title: "Tomorrow", done: false, dueAt: utcDate(2026, 11, 20))
    #expect(!TaskList.upcoming.includes(today, now: now, calendar: calendar))
    #expect(TaskList.upcoming.includes(tomorrow, now: now, calendar: calendar))
  }

  @Test("Done lists finished work only")
  func doneList() {
    let open = TaskItem(id: "1", title: "Open", done: false)
    let closed = TaskItem(id: "2", title: "Closed", done: true)
    #expect(!TaskList.done.includes(open, now: now, calendar: calendar))
    #expect(TaskList.done.includes(closed, now: now, calendar: calendar))
    #expect(TaskList.all.includes(open, now: now, calendar: calendar))
    #expect(TaskList.all.includes(closed, now: now, calendar: calendar))
  }

  @Test("Missing due dates are not today or upcoming")
  func undated() {
    let task = TaskItem(id: "1", title: "Someday", done: false)
    #expect(!TaskList.today.includes(task, now: now, calendar: calendar))
    #expect(!TaskList.upcoming.includes(task, now: now, calendar: calendar))
  }
}

// MARK: - Sections

@Suite("Sections")
struct TaskSectionTest {
  let now = utcDate(2026, 11, 19)
  let calendar = utcCalendar()

  @Test("Buckets by done and due day")
  func buckets() {
    let items = [
      TaskItem(id: "overdue", title: "Overdue", done: false, dueAt: utcDate(2026, 11, 18)),
      TaskItem(id: "today", title: "Today", done: false, dueAt: utcDate(2026, 11, 19)),
      TaskItem(id: "upcoming", title: "Upcoming", done: false, dueAt: utcDate(2026, 12, 1)),
      TaskItem(id: "anytime", title: "Anytime", done: false),
      TaskItem(id: "done", title: "Done", done: true, dueAt: utcDate(2026, 11, 1)),
    ]

    #expect(TaskOrganizer.section(for: items[0], now: now, calendar: calendar) == .overdue)
    #expect(TaskOrganizer.section(for: items[1], now: now, calendar: calendar) == .today)
    #expect(TaskOrganizer.section(for: items[2], now: now, calendar: calendar) == .upcoming)
    #expect(TaskOrganizer.section(for: items[3], now: now, calendar: calendar) == .anytime)
    #expect(TaskOrganizer.section(for: items[4], now: now, calendar: calendar) == .completed)
  }

  @Test("Groups drop empty sections and keep section order")
  func groupOrder() {
    let items = [
      TaskItem(id: "anytime", title: "Anytime", done: false),
      TaskItem(id: "today", title: "Today", done: false, dueAt: utcDate(2026, 11, 19)),
    ]

    let groups = TaskOrganizer.groups(for: items, now: now, calendar: calendar)
    #expect(groups.map(\.section) == [.today, .anytime])
  }

  @Test("Sorts by due date, undated last, ties keep input order")
  func sorting() {
    let items = [
      TaskItem(id: "late", title: "Late", done: false, dueAt: utcDate(2026, 11, 30)),
      TaskItem(id: "early", title: "Early", done: false, dueAt: utcDate(2026, 11, 20)),
      TaskItem(id: "first", title: "First tie", done: false, dueAt: utcDate(2026, 11, 25)),
      TaskItem(id: "second", title: "Second tie", done: false, dueAt: utcDate(2026, 11, 25)),
      TaskItem(id: "undated", title: "Undated", done: false),
    ]

    let groups = TaskOrganizer.groups(for: items, now: now, calendar: calendar)
    let upcoming = groups.first { $0.section == .upcoming }
    #expect(upcoming?.tasks.map(\.id) == ["early", "first", "second", "late"])

    let anytime = groups.first { $0.section == .anytime }
    #expect(anytime?.tasks.map(\.id) == ["undated"])
  }

  @Test("Completed starts folded")
  func completedStartsCollapsed() {
    #expect(TaskSection.completed.startsCollapsed)
    #expect(!TaskSection.today.startsCollapsed)
  }
}

// MARK: - Due dates

@Suite("Due dates")
struct DueDateTest {
  let now = utcDate(2026, 11, 19)
  let calendar = utcCalendar()
  let locale = Locale(identifier: "en_US")

  @Test("Names the recent days")
  func relativeDays() {
    #expect(DueDateLabel.describe(dueAt: utcDate(2026, 11, 19), now: now, calendar: calendar, locale: locale).text == "Due today")
    #expect(DueDateLabel.describe(dueAt: utcDate(2026, 11, 20), now: now, calendar: calendar, locale: locale).text == "Due tomorrow")
    #expect(DueDateLabel.describe(dueAt: utcDate(2026, 11, 18), now: now, calendar: calendar, locale: locale).text == "Overdue · yesterday")
  }

  @Test("Flags overdue work")
  func overdue() {
    let description = DueDateLabel.describe(dueAt: utcDate(2026, 11, 12), now: now, calendar: calendar, locale: locale)
    #expect(description.isOverdue)
    #expect(!description.isToday)
    #expect(description.text == "Overdue · Nov 12")
  }

  @Test("Uses weekday names inside the week")
  func weekday() {
    let description = DueDateLabel.describe(dueAt: utcDate(2026, 11, 25), now: now, calendar: calendar, locale: locale)
    #expect(description.text == "Due Wednesday")
    #expect(!description.isOverdue)
  }

  @Test("Adds the year when it differs")
  func yearBoundary() {
    #expect(
      DueDateLabel.describe(dueAt: utcDate(2027, 1, 8), now: now, calendar: calendar, locale: locale).text
        == "Due Jan 8, 2027"
    )
  }

  @Test("Short form drops the prefix")
  func shortForm() {
    #expect(DueDateLabel.short(dueAt: utcDate(2026, 11, 19), now: now, calendar: calendar, locale: locale) == "today")
    #expect(DueDateLabel.short(dueAt: utcDate(2026, 11, 12), now: now, calendar: calendar, locale: locale) == "Nov 12")
  }

  @Test("Milliseconds round-trip through the day boundary")
  func milliseconds() {
    let day = utcDate(2026, 11, 19, hour: 17)
    let millis = DueDateMath.millisecondsForDay(day, calendar: calendar)
    #expect(Double(millis) == utcDate(2026, 11, 19, hour: 0).timeIntervalSince1970 * 1000)
    #expect(DueDateMath.day(fromMilliseconds: Double(millis), calendar: calendar) == utcDate(2026, 11, 19, hour: 0))
  }
}

// MARK: - Titles

@Suite("Titles")
struct TaskTitleTest {
  @Test("Trims and accepts")
  func trims() {
    #expect(TaskTitle.normalized("  Buy milk \n") == "Buy milk")
    #expect(TaskTitle.isValid("Buy milk"))
  }

  @Test("Rejects empty and whitespace")
  func rejectsEmpty() {
    #expect(TaskTitle.normalized("") == nil)
    #expect(TaskTitle.normalized("   \n\t") == nil)
  }

  @Test("Rejects titles over the backend limit")
  func rejectsLongTitles() {
    let exact = String(repeating: "a", count: TaskTitle.maxLength)
    let tooLong = String(repeating: "a", count: TaskTitle.maxLength + 1)
    #expect(TaskTitle.normalized(exact) == exact)
    #expect(TaskTitle.normalized(tooLong) == nil)
    #expect(TaskTitle.remaining(tooLong) == 0)
  }
}
