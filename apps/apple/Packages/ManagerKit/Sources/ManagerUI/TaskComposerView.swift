import ManagerCore
import SwiftUI

/// Wraps a row's content so it stays centered and readable in wide windows
/// (Mac, iPad landscape, unfolded iPhone Duo) instead of stretching edge to edge.
public struct CenteredRow<Content: View>: View {
  private let maxWidth: CGFloat
  private let content: Content

  public init(maxWidth: CGFloat = ManagerMetrics.contentMaxWidth, @ViewBuilder content: () -> Content) {
    self.maxWidth = maxWidth
    self.content = content()
  }

  public var body: some View {
    HStack(spacing: 0) {
      Spacer(minLength: 0)
      content.frame(maxWidth: maxWidth)
      Spacer(minLength: 0)
    }
  }
}

/// The composer card: title field, optional due date, add button.
public struct TaskComposerView: View {
  @Bindable var model: TaskBoardModel
  @FocusState private var isTitleFocused: Bool
  @State private var isPickingDueDate = false

  public init(model: TaskBoardModel) {
    self.model = model
  }

  public var body: some View {
    VStack(alignment: .leading, spacing: 10) {
      HStack(spacing: 10) {
        Image(systemName: "plus")
          .font(.system(size: 13, weight: .semibold))
          .foregroundStyle(Color.managerMuted)

        TextField("Add a task", text: $model.draftTitle, axis: .vertical)
          .textFieldStyle(.plain)
          .lineLimit(1...3)
          .font(ManagerFont.rowTitle)
          .foregroundStyle(Color.managerInk)
          .focused($isTitleFocused)
          .submitLabel(.done)
          .onSubmit(submit)

        dueChip

        Button(action: submit) {
          if model.isSaving {
            ProgressView().controlSize(.small)
          } else {
            Text("Add").font(ManagerFont.button)
          }
        }
        .managerPrimaryButton()
        .disabled(!model.canSubmitDraft)
        .keyboardShortcut(.return, modifiers: [.command])
      }

      if let message = model.draftValidationMessage {
        Text(message)
          .font(ManagerFont.meta)
          .foregroundStyle(Color.managerDanger)
      }

      if isPickingDueDate {
        dueDatePicker
      }
    }
    .padding(.horizontal, 14)
    .padding(.vertical, 12)
    .background {
      RoundedRectangle(cornerRadius: 16, style: .continuous)
        .fill(Color.managerSurface)
        .overlay {
          RoundedRectangle(cornerRadius: 16, style: .continuous)
            .strokeBorder(Color.managerBorder, lineWidth: 1)
        }
    }
  }

  private var dueChip: some View {
    Button {
      withAnimation(.snappy(duration: 0.18)) {
        isPickingDueDate.toggle()
        if isPickingDueDate, model.draftDueDate == nil {
          model.draftDueDate = Calendar.current.startOfDay(for: .now)
        }
      }
    } label: {
      HStack(spacing: 4) {
        Image(systemName: "calendar")
          .font(.system(size: 11, weight: .semibold))
        Text(model.draftDueDate.map { DueDateLabel.short(dueAt: $0) } ?? "Date")
          .font(ManagerFont.meta)
        if model.draftDueDate != nil {
          Image(systemName: "xmark.circle.fill")
            .font(.system(size: 10))
            .foregroundStyle(Color.managerMuted)
            .onTapGesture {
              model.draftDueDate = nil
              isPickingDueDate = false
            }
            .accessibilityLabel("Remove due date")
        }
      }
      .foregroundStyle(model.draftDueDate == nil ? Color.managerMuted : Color.managerAccent)
      .padding(.horizontal, 10)
      .padding(.vertical, 6)
      .background(
        Capsule(style: .continuous)
          .strokeBorder(
            model.draftDueDate == nil ? Color.managerBorder : Color.managerAccent.opacity(0.6),
            lineWidth: 1
          )
      )
    }
    .buttonStyle(.plain)
    .accessibilityLabel(model.draftDueDate == nil ? "Add a due date" : "Change due date")
  }

  private var dueDatePicker: some View {
    HStack(spacing: 12) {
      DatePicker(
        "Due date",
        selection: Binding(
          get: { model.draftDueDate ?? Calendar.current.startOfDay(for: .now) },
          set: { model.draftDueDate = Calendar.current.startOfDay(for: $0) }
        ),
        displayedComponents: .date
      )
      .datePickerStyle(.compact)
      .labelsHidden()

      Spacer(minLength: 0)

      Button("Clear") {
        model.draftDueDate = nil
        isPickingDueDate = false
      }
      .buttonStyle(.plain)
      .font(ManagerFont.meta)
      .foregroundStyle(Color.managerMuted)

      Button("Done") {
        withAnimation(.snappy(duration: 0.18)) { isPickingDueDate = false }
      }
      .buttonStyle(.plain)
      .font(ManagerFont.meta.weight(.semibold))
      .foregroundStyle(Color.managerAccent)
    }
    .transition(.opacity.combined(with: .move(edge: .top)))
  }

  private func submit() {
    guard model.canSubmitDraft else { return }
    Task {
      await model.addTask()
      isTitleFocused = true
    }
  }
}
