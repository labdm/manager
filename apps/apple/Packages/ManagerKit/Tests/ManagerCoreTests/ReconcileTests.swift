import Foundation
import Testing
@testable import ManagerCore

/// Dishes (replace) and journal (stack), from docs/plan.md's user flows.
@Suite("Recurrence reconcile")
@MainActor
struct ReconcileTests {
  let calendar = utcCalendar()
  let monday = utcDate(2026, 11, 16)
  let tuesday = utcDate(2026, 11, 17)
  let wednesday = utcDate(2026, 11, 18)

  private func series(
    id: String,
    title: String,
    behavior: String,
    periodStart: Date,
    done: Bool = false
  ) -> TaskItem {
    TaskItem(
      id: "\(id)-seed",
      title: title,
      done: done,
      dueAt: periodStart,
      origin: .selfCreated,
      seenAt: periodStart,
      recurrenceId: id,
      behavior: behavior,
      periodStart: periodStart
    )
  }

  private func rows(_ backend: InMemoryTaskBackend, id: String) -> [TaskItem] {
    backend.storedTasks.filter { $0.recurrenceId == id }
  }

  private func openRows(_ backend: InMemoryTaskBackend, id: String) -> [TaskItem] {
    rows(backend, id: id).filter { !$0.done && $0.outcome == nil && $0.deletedAt == nil }
  }

  @Test("Dishes supersedes Monday and leaves one open row on Tuesday")
  func dishes() {
    let backend = InMemoryTaskBackend(
      tasks: [series(id: "dishes", title: "Dishes", behavior: "replace", periodStart: monday)]
    )

    backend.reconcile(now: tuesday, calendar: calendar)

    let all = rows(backend, id: "dishes")
    #expect(all.count == 2)
    #expect(all.first?.outcome == "superseded")
    #expect(all.first?.done == false)

    let open = openRows(backend, id: "dishes")
    #expect(open.count == 1)
    #expect(calendar.startOfDay(for: open[0].periodStart!) == calendar.startOfDay(for: tuesday))
    #expect(open[0].dueAt == calendar.startOfDay(for: tuesday))
    #expect(open[0].plannedOn == open[0].dueAt)
    #expect(open[0].deadlineAt == nil)
    #expect(open[0].origin == .selfCreated)
    #expect(open[0].seenAt != nil)
    #expect(open[0].isNew == false)
    #expect(backend.lastReconcileBehavior == "replace")
    #expect(backend.lastReconcileRecurrenceId == "dishes")
  }

  @Test("Journal stacks three open rows across two skipped days")
  func journal() {
    let backend = InMemoryTaskBackend(
      tasks: [series(id: "journal", title: "Journal", behavior: "stack", periodStart: monday)]
    )

    backend.reconcile(now: wednesday, calendar: calendar)

    let all = rows(backend, id: "journal")
    #expect(all.count == 3)
    #expect(openRows(backend, id: "journal").count == 3)
    #expect(all.allSatisfy { $0.outcome == nil })

    let days = Set(all.compactMap { $0.periodStart }.map { calendar.startOfDay(for: $0) })
    #expect(days == [
      calendar.startOfDay(for: monday),
      calendar.startOfDay(for: tuesday),
      calendar.startOfDay(for: wednesday),
    ])
    #expect(all.filter { $0.isNew }.isEmpty)
  }

  @Test("A second reconcile adds nothing, even after Tuesday is finished")
  func idempotent() {
    let backend = InMemoryTaskBackend(
      tasks: [series(id: "dishes", title: "Dishes", behavior: "replace", periodStart: monday)]
    )

    backend.reconcile(now: tuesday, calendar: calendar)
    let first = rows(backend, id: "dishes").map(\.id)
    #expect(first.count == 2)

    backend.reconcile(now: tuesday, calendar: calendar)
    #expect(rows(backend, id: "dishes").map(\.id) == first)

    // Finishing Tuesday must not mint a second Tuesday: the idempotency key
    // covers done rows too.
    if let index = backend.storedTasks.firstIndex(where: { $0.id == first.last }) {
      backend.storedTasks[index] = backend.storedTasks[index].withDone(true)
    }
    backend.reconcile(now: tuesday, calendar: calendar)
    #expect(rows(backend, id: "dishes").map(\.id) == first)
    #expect(openRows(backend, id: "dishes").isEmpty)
    #expect(backend.reconcileCallCount == 3)
  }

  @Test("A stack reconcile is idempotent on a second run")
  func stackIdempotent() {
    let backend = InMemoryTaskBackend(
      tasks: [series(id: "journal", title: "Journal", behavior: "stack", periodStart: monday)]
    )

    backend.reconcile(now: wednesday, calendar: calendar)
    let first = rows(backend, id: "journal").map(\.id)
    backend.reconcile(now: wednesday, calendar: calendar)
    #expect(rows(backend, id: "journal").map(\.id) == first)
  }

  @Test("Civil days compare by calendar, not raw time")
  func civilDayComparison() {
    // A seed stamped later in the same Tuesday still counts as Tuesday, so no
    // duplicate is minted for the period.
    let lateTuesday = utcDate(2026, 11, 17, hour: 23)
    let backend = InMemoryTaskBackend(
      tasks: [series(id: "dishes", title: "Dishes", behavior: "replace", periodStart: lateTuesday)]
    )

    backend.reconcile(now: tuesday, calendar: calendar)
    #expect(rows(backend, id: "dishes").count == 1)
    #expect(backend.storedTasks[0].outcome == nil)
    #expect(openRows(backend, id: "dishes").count == 1)
  }
}
