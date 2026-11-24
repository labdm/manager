import ManagerCore
import SwiftUI

/// One sheet for creating and editing a task. Nothing here is mounted in the
/// board column: a create action presents this sheet and a row tap presents it
/// with an id. The M1 facts stay intact — a deadline never becomes a planned
/// day, and opening a NEW row still goes through `TaskBoardModel.openTask`.
public struct TaskSheetView: View {
  private let target: BoardSheet
  @Bindable private var model: TaskBoardModel
  private let onDismiss: () -> Void

  @State private var draft: TaskDraft
  @State private var hasNotes: Bool
  @State private var hasPlannedOn: Bool
  @State private var hasPlannedTime: Bool
  @State private var hasLocation: Bool
  @State private var hasDeadline: Bool
  @State private var hasReminder: Bool
  @State private var look: TaskLook
  @State private var series: SeriesBehavior
  @State private var cadence: SeriesCadence
  @FocusState private var isTitleFocused: Bool

  public init(target: BoardSheet, model: TaskBoardModel, onDismiss: @escaping () -> Void) {
    self.target = target
    self.model = model
    self.onDismiss = onDismiss

    let initial: TaskDraft
    switch target {
    case .createTask:
      initial = TaskDraft(title: model.draftTitle, plannedOn: model.draftDueDate)
    case let .editTask(id):
      let task = model.tasks.first { $0.id == id }
        ?? TaskItem(id: id, title: "", done: false)
      initial = TaskDraft(task: task)
    default:
      initial = TaskDraft(title: "")
    }

    _draft = State(initialValue: initial)
    _hasNotes = State(initialValue: initial.notes != nil)
    _hasPlannedOn = State(initialValue: initial.plannedOn != nil)
    _hasPlannedTime = State(initialValue: initial.plannedTime != nil)
    _hasLocation = State(initialValue: !(initial.location?.isEmpty ?? true))
    _hasDeadline = State(initialValue: initial.deadlineAt != nil)
    _hasReminder = State(initialValue: initial.remindAt != nil)
    _look = State(initialValue: initial.look)
    _series = State(initialValue: initial.series)
    _cadence = State(initialValue: initial.cadence)
  }

  public var body: some View {
    Form {
      Section("Task") {
        TextField("Title", text: $draft.title, axis: .vertical)
          .lineLimit(1...3)
          .focused($isTitleFocused)
          .submitLabel(.done)
        Toggle("Notes", isOn: $hasNotes)
        if hasNotes {
          TextField("Notes", text: notesBinding, axis: .vertical)
            .lineLimit(2...6)
        }
      }

      Section("Look") {
        Picker("Task look", selection: $look) {
          ForEach(TaskLook.allCases, id: \.self) { look in
            Text(look.title).tag(look)
          }
        }
        .pickerStyle(.segmented)
        Text("Check is compact, row is a single line, card shows the details.")
          .font(ManagerFont.meta)
          .foregroundStyle(Color.managerMuted)
      }

      Section("Series") {
        Picker("Behavior", selection: $series) {
          ForEach(SeriesBehavior.allCases, id: \.self) { behavior in
            Text(behavior.title).tag(behavior)
          }
        }
        .pickerStyle(.segmented)
        Text(series.detail)
          .font(ManagerFont.meta)
          .foregroundStyle(Color.managerMuted)

        if series != .none {
          Picker("Cadence", selection: $cadence) {
            ForEach(SeriesCadence.allCases, id: \.self) { cadence in
              Text(cadence.title).tag(cadence)
            }
          }
        }
      }

      Section("Planned day") {
        Toggle("Planned day", isOn: $hasPlannedOn)
        if hasPlannedOn {
          DatePicker("Day", selection: plannedDayBinding, displayedComponents: .date)
            .datePickerStyle(.compact)
        }
        Toggle("Clock time", isOn: $hasPlannedTime)
        if hasPlannedTime {
          DatePicker("Time", selection: plannedTimeBinding, displayedComponents: .hourAndMinute)
            .datePickerStyle(.compact)
        }
        Text("The planned day is the due date on the board. A deadline is separate.")
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

      if let outcome = editedTask?.outcome {
        Section("Outcome") {
          Text(outcome.capitalized)
            .foregroundStyle(Color.managerMuted)
        }
      }
    }
    .navigationTitle(target.title)
    #if os(macOS)
      .frame(minWidth: 440, minHeight: 520)
    #endif
    .onChange(of: model.composerFocusRequest) { _ in
      isTitleFocused = true
    }
    .toolbar {
      ToolbarItem(placement: .cancellationAction) {
        Button("Cancel", action: onDismiss)
      }
      ToolbarItem(placement: .confirmationAction) {
        Button("Save", action: save)
          .disabled(!TaskTitle.isValid(draft.title))
      }
    }
  }

  private var editedTask: TaskItem? {
    guard case let .editTask(id) = target else { return nil }
    return model.tasks.first { $0.id == id }
  }

  private var notesBinding: Binding<String> {
    Binding(get: { draft.notes ?? "" }, set: { draft.notes = $0.isEmpty ? nil : $0 })
  }

  private var locationBinding: Binding<String> {
    Binding(get: { draft.location ?? "" }, set: { draft.location = $0.isEmpty ? nil : $0 })
  }

  private var plannedDayBinding: Binding<Date> {
    Binding(
      get: { draft.plannedOn ?? Calendar.current.startOfDay(for: Date()) },
      set: { draft.plannedOn = Calendar.current.startOfDay(for: $0) }
    )
  }

  private var plannedTimeBinding: Binding<Date> {
    Binding(
      get: { TaskFacts.date(fromPlannedTime: draft.plannedTime ?? 9 * 60) ?? Date() },
      set: { draft.plannedTime = TaskFacts.minutes(from: $0) }
    )
  }

  private var deadlineBinding: Binding<Date> {
    Binding(get: { draft.deadlineAt ?? Date() }, set: { draft.deadlineAt = $0 })
  }

  private var reminderBinding: Binding<Date> {
    Binding(get: { draft.remindAt ?? Date() }, set: { draft.remindAt = $0 })
  }

  private func save() {
    var resolved = draft
    resolved.title = draft.title.trimmingCharacters(in: .whitespacesAndNewlines)
    resolved.look = look
    resolved.series = series
    resolved.cadence = cadence
    resolved.notes = hasNotes ? resolved.notes : nil
    resolved.plannedOn = hasPlannedOn ? resolved.plannedOn : nil
    resolved.plannedTime = hasPlannedTime ? resolved.plannedTime : nil
    resolved.location = hasLocation ? resolved.location : nil
    resolved.deadlineAt = hasDeadline ? resolved.deadlineAt : nil
    resolved.remindAt = hasReminder ? resolved.remindAt : nil
    resolved.plannedOn = resolved.plannedOn.map { Calendar.current.startOfDay(for: $0) }
    if !TaskPriority.seeds.contains(resolved.priority) {
      resolved.priorityRank = resolved.priority.seedRank
    }
    guard TaskTitle.isValid(resolved.title) else { return }

    Task { @MainActor in
      let succeeded: Bool
      switch target {
      case .createTask:
        if series == .none {
          succeeded = await model.createTask(from: resolved)
        } else {
          succeeded = await model.createSeriesTask(from: resolved)
        }
      case let .editTask(id):
        guard let task = model.tasks.first(where: { $0.id == id }) else {
          succeeded = false
          break
        }
        await model.save(task, draft: resolved)
        succeeded = true
      default:
        succeeded = false
      }
      if succeeded {
        model.clearDraft()
        onDismiss()
      }
    }
  }
}
