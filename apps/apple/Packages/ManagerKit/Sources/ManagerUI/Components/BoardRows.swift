import ManagerCore
import SwiftUI

/// An unread note from an agent or person. There is deliberately no checkbox:
/// reading it dismisses it from the band and leaves it in the log.
public struct AlertBandView: View {
  public let alert: BoardAlert
  public let onDismiss: () -> Void

  public init(alert: BoardAlert, onDismiss: @escaping () -> Void) {
    self.alert = alert
    self.onDismiss = onDismiss
  }

  public var body: some View {
    HStack(alignment: .top, spacing: 10) {
      Image(systemName: "bell.badge.fill")
        .font(.system(size: 13, weight: .semibold))
        .foregroundStyle(Color.managerAccent)
        .padding(.top, 2)

      VStack(alignment: .leading, spacing: 2) {
        Text(alert.title)
          .font(ManagerFont.rowTitle.weight(.semibold))
          .foregroundStyle(Color.managerInk)
        Text(alert.body)
          .font(ManagerFont.meta)
          .foregroundStyle(Color.managerMuted)
      }
      .frame(maxWidth: .infinity, alignment: .leading)

      Button(action: onDismiss) {
        Image(systemName: "xmark")
          .font(.system(size: 10, weight: .bold))
          .foregroundStyle(Color.managerMuted)
      }
      .buttonStyle(.plain)
      .accessibilityLabel("Mark alert read")
    }
    .padding(.horizontal, 12)
    .padding(.vertical, 10)
    .background(
      RoundedRectangle(cornerRadius: 12, style: .continuous)
        .fill(Color.managerRaised)
    )
    .accessibilityElement(children: .contain)
  }
}

/// An open question with one default answer. Answering clears the row and may
/// append a quest step or create a task later.
public struct QuestionView: View {
  public let question: BoardQuestion
  public let onAnswer: (String) -> Void

  public init(question: BoardQuestion, onAnswer: @escaping (String) -> Void) {
    self.question = question
    self.onAnswer = onAnswer
  }

  public var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      Text(question.prompt)
        .font(ManagerFont.rowTitle.weight(.semibold))
        .foregroundStyle(Color.managerInk)

      ForEach(question.options) { option in
        Button {
          onAnswer(option.id)
        } label: {
          HStack(spacing: 8) {
            Image(systemName: "circle")
              .font(.system(size: 10))
            Text(option.label)
              .font(ManagerFont.meta)
            Spacer(minLength: 0)
          }
          .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .foregroundStyle(Color.managerAccent)
      }
    }
    .frame(maxWidth: .infinity, alignment: .leading)
    .padding(.horizontal, 12)
    .padding(.vertical, 10)
    .background(
      RoundedRectangle(cornerRadius: 12, style: .continuous)
        .fill(Color.managerRaised)
    )
    .accessibilityElement(children: .contain)
  }
}

/// A known-size track drawn as a bar with a `current/target` caption.
public struct ProgressionView: View {
  public let progression: BoardProgression

  public init(progression: BoardProgression) {
    self.progression = progression
  }

  public var body: some View {
    VStack(alignment: .leading, spacing: 6) {
      HStack {
        Text(progression.title)
          .font(ManagerFont.rowTitle.weight(.semibold))
          .foregroundStyle(Color.managerInk)
        Spacer(minLength: 8)
        Text("\(progression.current)/\(progression.target)")
          .font(ManagerFont.meta)
          .monospacedDigit()
          .foregroundStyle(Color.managerMuted)
      }
      ProgressView(value: progression.fraction)
        .tint(Color.managerAccent)
        .accessibilityLabel("\(progression.title): \(progression.current) of \(progression.target)")
    }
    .padding(.horizontal, 12)
    .padding(.vertical, 10)
    .background(
      RoundedRectangle(cornerRadius: 12, style: .continuous)
        .fill(Color.managerRaised)
    )
  }
}

/// A quest drawn as a stepper, with an empty next step while it waits.
public struct QuestView: View {
  public let quest: BoardQuest

  public init(quest: BoardQuest) {
    self.quest = quest
  }

  public var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      Text(quest.title)
        .font(ManagerFont.rowTitle.weight(.semibold))
        .foregroundStyle(Color.managerInk)

      ForEach(quest.steps) { step in
        HStack(spacing: 8) {
          Image(systemName: step.done ? "checkmark.circle.fill" : "circle")
            .font(.system(size: 13))
            .foregroundStyle(step.done ? Color.managerAccent : Color.managerMuted)
          Text(step.title)
            .font(ManagerFont.meta)
            .foregroundStyle(step.done ? Color.managerMuted : Color.managerInk)
            .strikethrough(step.done, color: Color.managerMuted)
        }
      }

      if quest.isWaiting || quest.steps.isEmpty {
        HStack(spacing: 8) {
          Image(systemName: "circle.dashed")
            .font(.system(size: 13))
            .foregroundStyle(Color.managerMuted)
          Text("Next step")
            .font(ManagerFont.meta)
            .foregroundStyle(Color.managerMuted)
            .italic()
        }
        .accessibilityLabel("Waiting for the next step")
      }
    }
    .frame(maxWidth: .infinity, alignment: .leading)
    .padding(.horizontal, 12)
    .padding(.vertical, 10)
    .background(
      RoundedRectangle(cornerRadius: 12, style: .continuous)
        .fill(Color.managerRaised)
    )
  }
}
