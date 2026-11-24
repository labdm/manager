import ManagerCore
import SwiftUI

/// Routes each sheet target to its form. Task targets use `TaskSheetView`;
/// every other entity uses one form with a title, optional details and the
/// shared appearance picker. No target pushes a view onto the board.
public struct EntitySheetView: View {
  private let target: BoardSheet
  @Bindable private var model: TaskBoardModel
  private let onDismiss: () -> Void

  @State private var title: String
  @State private var details: String
  @State private var icon: String
  @State private var color: String
  @State private var targetCount: Int

  public init(target: BoardSheet, model: TaskBoardModel, onDismiss: @escaping () -> Void) {
    self.target = target
    self.model = model
    self.onDismiss = onDismiss

    let entity = Self.existingEntity(for: target, in: model)
    _title = State(initialValue: entity?.title ?? "")
    _details = State(initialValue: "")
    _icon = State(initialValue: entity?.icon ?? Appearance.fallbackIcon)
    _color = State(initialValue: entity?.color ?? Appearance.fallbackColor)
    _targetCount = State(initialValue: 10)
  }

  public var body: some View {
    Group {
      switch target {
      case .createTask, .editTask:
        TaskSheetView(target: target, model: model, onDismiss: onDismiss)
      default:
        Form {
          Section("Details") {
            TextField("Title", text: $title)
            if entityKind == .event {
              TextField("Span (for example, this season)", text: $details)
            } else if entityKind == .resource {
              TextField("Where it lives", text: $details)
            } else {
              TextField("Notes (optional)", text: $details)
            }
          }

          if entityKind == .progression {
            Section("Track") {
              Stepper("Steps: \(targetCount)", value: $targetCount, in: 1...1000)
            }
          }

          Section("Appearance") {
            AppearancePicker(
              icon: $icon,
              color: $color,
              previewTitle: title.isEmpty ? "Preview" : title
            )
          }
        }
        .navigationTitle(target.title)
        #if os(macOS)
          .frame(minWidth: 440, minHeight: 520)
        #endif
        .toolbar {
          ToolbarItem(placement: .cancellationAction) {
            Button("Cancel", action: onDismiss)
          }
          ToolbarItem(placement: .confirmationAction) {
            Button("Save", action: save)
              .disabled(title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
          }
        }
      }
    }
  }

  private var entityKind: BoardEntityKind? {
    switch target {
    case .category: .category
    case .event: .event
    case .view: .view
    case .progression: .progression
    case .resource: .resource
    case .createTask, .editTask: nil
    }
  }

  private static func existingEntity(
    for target: BoardSheet,
    in model: TaskBoardModel
  ) -> BoardEntity? {
    let id: String?
    switch target {
    case let .category(value): id = value
    case let .event(value): id = value
    case let .view(value): id = value
    case let .progression(value): id = value
    case let .resource(value): id = value
    case .createTask, .editTask: id = nil
    }
    guard let id else { return nil }
    return model.localEntities.first { $0.id == id }
  }

  private func save() {
    guard let kind = entityKind else { return }
    Task { @MainActor in
      await model.saveEntity(
        kind: kind,
        title: title,
        icon: icon,
        color: color
      )
      onDismiss()
    }
  }
}
