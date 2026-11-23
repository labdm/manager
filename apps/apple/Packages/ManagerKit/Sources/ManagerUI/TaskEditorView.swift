import ManagerCore
import SwiftUI

/// The explicit row editor. It writes the M1 task facts without ever treating
/// a deadline as the planned day.
public struct TaskEditorView: View {
  private let taskID: String
  private let model: TaskBoardModel

  @Environment(\.dismiss) private var dismiss
  @State private var draft: TaskDraft
  @State private var hasPlannedOn: Bool
  @State private var hasPlannedTime: Bool
  @State private var hasLocation: Bool
  @State private var hasDeadline: Bool
  @State private var hasReminder: Bool

  public init(taskID: String, model: TaskBoardModel) {
    self.taskID = taskID
    self.model = model

    let task = model.tasks.first { $0.id == taskID }
      ?? TaskItem(id: taskID, title: "", done: false)
    let initial = TaskDraft(task: task)
    _draft = State(initialValue: initial)
    _hasPlannedOn = State(initialValue: initial.plannedOn != nil)
    _hasPlannedTime = State(initialValue: initial.plannedTime != nil)
    _hasLocation = State(initialValue: !(initial.location?.isEmpty ?? true))
    _hasDeadline = State(initialValue: initial.deadlineAt != nil)
    _hasReminder = State(initialValue: initial.remindAt != nil)
  }

  public var body: some View {
    NavigationStack {
      Form {
        Section("Task") {
          TextField("Title", text: $draft.title, axis: .vertical)
            .lineLimit(1...3)
          TextField("Notes", text: notesBinding, axis: .vertical)
            .lineLimit(2...6)
        }

        Section("Planned day") {
          Toggle("Planned day", isOn: $hasPlannedOn)
          if hasPlannedOn {
            DatePicker(
              "Day",
              selection: plannedDayBinding,
              displayedComponents: .date
            )
            .datePickerStyle(.compact)
          }
          Toggle("Clock time", isOn: $hasPlannedTime)
          if hasPlannedTime {
            DatePicker(
              "Time",
              selection: plannedTimeBinding,
              displayedComponents: .hourAndMinute
            )
            .datePickerStyle(.compact)
          }
          Text("The planned day is the due date shown in the list. A deadline is separate.")
            .font(ManagerFont.meta)
            .foregroundStyle(Color.managerMuted)
        }

        Section("Place and notifications") {
          Toggle("Location", isOn: $hasLocation)
          if hasLocation {
            TextField("Location", text: locationBinding)
          }
          Toggle("Deadline", isOn: $hasDeadline)
          if hasDeadline {
            DatePicker(
              "Deadline",
              selection: deadlineBinding,
              displayedComponents: [.date, .hourAndMinute]
            )
            .datePickerStyle(.compact)
          }
          Toggle("Remind me", isOn: $hasReminder)
          if hasReminder {
            DatePicker(
              "Remind at",
              selection: reminderBinding,
              displayedComponents: [.date, .hourAndMinute]
            )
            .datePickerStyle(.compact)
          }
        }

        Section("Priority and overdue") {
          Picker("Priority", selection: $draft.priority) {
            ForEach(TaskPriority.seeds, id: \.rawValue) { priority in
              Text(priority.rawValue.capitalized).tag(priority)
            }
            if !TaskPriority.seeds.contains(draft.priority) {
              Text(draft.priority.rawValue).tag(draft.priority)
            }
          }
          Picker("Overdue policy", selection: $draft.overduePolicy) {
            ForEach(OverduePolicy.allCases, id: \.self) { policy in
              Text(policy.rawValue.capitalized).tag(policy)
            }
          }
        }

        if let outcome = model.tasks.first(where: { $0.id == taskID })?.outcome {
          Section("Outcome") {
            Text(outcome.capitalized)
              .foregroundStyle(Color.managerMuted)
          }
        }
      }
      .navigationTitle("Task details")
      #if os(macOS)
        .frame(minWidth: 420, minHeight: 480)
      #endif
      .toolbar {
        ToolbarItem(placement: .cancellationAction) {
          Button("Cancel") { dismiss() }
        }
        ToolbarItem(placement: .confirmationAction) {
          Button("Save", action: save)
            .disabled(!TaskTitle.isValid(draft.title))
        }
      }
    }
  }

  private var notesBinding: Binding<String> {
    Binding(
      get: { draft.notes ?? "" },
      set: { draft.notes = $0.isEmpty ? nil : $0 }
    )
  }

  private var locationBinding: Binding<String> {
    Binding(
      get: { draft.location ?? "" },
      set: { draft.location = $0.isEmpty ? nil : $0 }
    )
  }

  private var plannedDayBinding: Binding<Date> {
    Binding(
      get: { draft.plannedOn ?? Calendar.current.startOfDay(for: Date()) },
      set: { draft.plannedOn = Calendar.current.startOfDay(for: $0) }
    )
  }

  private var plannedTimeBinding: Binding<Date> {
    Binding(
      get: {
        TaskFacts.date(fromPlannedTime: draft.plannedTime ?? 9 * 60) ?? Date()
      },
      set: { draft.plannedTime = TaskFacts.minutes(from: $0) }
    )
  }

  private var deadlineBinding: Binding<Date> {
    Binding(
      get: { draft.deadlineAt ?? Date() },
      set: { draft.deadlineAt = $0 }
    )
  }

  private var reminderBinding: Binding<Date> {
    Binding(
      get: { draft.remindAt ?? Date() },
      set: { draft.remindAt = $0 }
    )
  }

  private func save() {
    var resolved = draft
    if !TaskPriority.seeds.contains(resolved.priority) {
      resolved.priorityRank = resolved.priority.seedRank
    }
    resolved.plannedOn = hasPlannedOn ? resolved.plannedOn : nil
    resolved.plannedTime = hasPlannedTime ? resolved.plannedTime : nil
    resolved.location = hasLocation ? resolved.location : nil
    resolved.deadlineAt = hasDeadline ? resolved.deadlineAt : nil
    resolved.remindAt = hasReminder ? resolved.remindAt : nil

    guard TaskTitle.isValid(resolved.title) else { return }
    Task { @MainActor in
      if let task = model.tasks.first(where: { $0.id == taskID }) {
        await model.save(task, draft: resolved)
      }
      dismiss()
    }
  }
}
