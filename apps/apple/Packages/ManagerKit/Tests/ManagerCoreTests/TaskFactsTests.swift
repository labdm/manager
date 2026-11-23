import Foundation
import Testing
@testable import ManagerCore

@Suite("M1 task facts")
struct TaskFactsTest {
  let now = utcDate(2026, 11, 19)
  let calendar = utcCalendar()

  @Test("NEW needs a foreign origin and an empty seenAt")
  func newRule() {
    let agent = TaskItem(id: "agent", title: "Install Omarchy", done: false, origin: .agent)
    let member = TaskItem(id: "member", title: "Shared", done: false, origin: .member)
    let mine = TaskItem(id: "mine", title: "Witcher", done: false, origin: .selfCreated)
    let legacy = TaskItem(id: "legacy", title: "Old row", done: false)
    let seen = TaskItem(
      id: "seen",
      title: "Opened",
      done: false,
      origin: .agent,
      seenAt: utcDate(2026, 11, 19)
    )

    #expect(agent.isNew)
    #expect(member.isNew)
    #expect(!mine.isNew)
    #expect(!legacy.isNew)
    #expect(!seen.isNew)
    #expect(seen.withSeen(at: now).seenAt == seen.seenAt)
    #expect(agent.withSeen(at: now).isNew == false)
  }

  @Test("The planned day is the due date; a deadline is a second clock")
  func plannedDayIsNotDeadline() {
    let planned = TaskFacts.plannedDay(utcDate(2026, 11, 21, hour: 17), calendar: calendar)
    let deadline = utcDate(2026, 11, 25, hour: 23)
    let draft = TaskDraft(
      title: "File taxes",
      plannedOn: planned,
      deadlineAt: deadline,
      priority: .high,
      priorityRank: 20,
      overduePolicy: .escalate
    )

    let task = TaskItem(id: "1", title: "Old", done: false).applying(draft, now: now)

    #expect(task.dueAt == planned)
    #expect(task.plannedOn == planned)
    #expect(task.deadlineAt == deadline)
    #expect(task.notes == nil)
    #expect(task.priority == .high)
    #expect(task.priorityRank == 20)
    #expect(task.overduePolicy == .escalate)
  }

  @Test("A deadline alone leaves the planned day unset")
  func deadlineAlone() {
    let deadline = utcDate(2026, 11, 25, hour: 23)
    let draft = TaskDraft(title: "Offer", deadlineAt: deadline)

    let task = TaskItem(id: "1", title: "Old", done: false).applying(draft, now: now)

    #expect(task.dueAt == nil)
    #expect(task.plannedOn == nil)
    #expect(task.deadlineAt == deadline)
    #expect(task.overdue == false)
  }

  @Test("Omitted priority is normal at rank ten")
  func defaultPriority() {
    #expect(TaskPriority(decoded: nil) == .normal)
    #expect(TaskPriority(decoded: nil).seedRank == 10)
    #expect(TaskDraft(title: "Plain").priorityRank == 10)
    #expect(OverduePolicy(decoded: nil) == .none)
  }

  @Test("Escalate raises a seed rank only while overdue")
  func escalateRank() {
    let past = utcDate(2026, 11, 18, hour: 23)
    let future = utcDate(2026, 11, 25, hour: 23)
    let overdue = TaskFacts.isOverdue(deadlineAt: past, done: false, deletedAt: nil, now: now)
    let pending = TaskFacts.isOverdue(deadlineAt: future, done: false, deletedAt: nil, now: now)

    #expect(overdue)
    #expect(!pending)
    #expect(
      TaskFacts.effectiveRank(
        priorityRank: 20,
        priority: .high,
        policy: .escalate,
        overdue: overdue
      ) == 30
    )
    #expect(
      TaskFacts.effectiveRank(
        priorityRank: 20,
        priority: .high,
        policy: .escalate,
        overdue: pending
      ) == 20
    )
    #expect(
      TaskFacts.effectiveRank(
        priorityRank: 20,
        priority: .high,
        policy: .retire,
        overdue: overdue
      ) == 20
    )
  }

  @Test("Completion records a timestamp and reopening clears it")
  func completionFacts() {
    let task = TaskItem(id: "1", title: "Ship", done: false)
    let done = task.withDone(true, at: now)
    #expect(done.done)
    #expect(done.completedAt == now)
    #expect(!done.withDone(false).done)
    #expect(done.withDone(false).completedAt == nil)
  }

  @Test("Planned time stays inside the day")
  func plannedTime() {
    #expect(TaskFacts.normalizedPlannedTime(0) == 0)
    #expect(TaskFacts.normalizedPlannedTime(1439) == 1439)
    #expect(TaskFacts.normalizedPlannedTime(1440) == nil)
    #expect(TaskFacts.normalizedPlannedTime(-1) == nil)
    #expect(TaskFacts.minutes(from: utcDate(2026, 11, 19, hour: 9), calendar: calendar) == 540)
    #expect(TaskFacts.label(forPlannedTime: 555) == "09:15")
  }
}
