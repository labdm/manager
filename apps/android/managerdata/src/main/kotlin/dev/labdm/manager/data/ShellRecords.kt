package dev.labdm.manager.data

import dev.convex.android.Float64
import dev.labdm.manager.kit.BoardAlert
import dev.labdm.manager.kit.BoardQuestion
import dev.labdm.manager.kit.BoardQuestionOption
import dev.labdm.manager.kit.BoardSnapshot
import dev.labdm.manager.kit.GroupItem
import dev.labdm.manager.kit.InviteItem
import dev.labdm.manager.kit.ProgressionState
import dev.labdm.manager.kit.QuestState
import dev.labdm.manager.kit.QuestStep
import dev.labdm.manager.kit.RoutingItem
import dev.labdm.manager.kit.TaskOrigin
import dev.labdm.manager.kit.TaskView
import dev.labdm.manager.kit.TaskViewKind
import kotlinx.serialization.Serializable

/**
 * Tolerant wire records for the row-first shell. Every optional field has a
 * default, so a partially deployed backend cannot blank the screen. Convex
 * numbers arrive tagged, so timestamps and meters use `Float64`, never a plain
 * `Double`.
 */

@Serializable
data class BoardSliceRecord(
    val rail: List<ViewWireRecord>? = null,
    val views: List<ViewWireRecord>? = null,
    val alerts: List<AlertWireRecord>? = null,
    val questions: List<QuestionWireRecord>? = null,
    val progressions: List<ProgressionWireRecord>? = null,
    val quests: List<QuestWireRecord>? = null,
) {
    fun toSnapshot(): BoardSnapshot = BoardSnapshot(
        views = (rail ?: views ?: emptyList()).map(ViewWireRecord::toView),
        alerts = (alerts ?: emptyList()).map(AlertWireRecord::toAlert),
        questions = (questions ?: emptyList()).map(QuestionWireRecord::toQuestion),
        progressions = (progressions ?: emptyList()).map(ProgressionWireRecord::toProgression),
        quests = (quests ?: emptyList()).map(QuestWireRecord::toQuest),
    )
}

@Serializable
data class ViewWireRecord(
    val id: String,
    val title: String? = null,
    val icon: String? = null,
    val color: String? = null,
    val kind: String? = null,
) {
    fun toView(): TaskView = TaskView(
        id = id,
        title = title?.takeIf(String::isNotBlank) ?: id,
        icon = icon.orEmpty(),
        color = color.orEmpty(),
        kind = TaskViewKind.entries.firstOrNull { it.wire == kind } ?: TaskViewKind.CUSTOM,
    )
}

@Serializable
data class AlertWireRecord(
    val id: String,
    val title: String? = null,
    val body: String? = null,
    val source: String? = null,
    val seenAt: Float64? = null,
) {
    fun toAlert(): BoardAlert = BoardAlert(
        id = id,
        title = title?.takeIf(String::isNotBlank) ?: "Message",
        body = body,
        source = TaskOrigin.fromWire(source),
        seenAt = seenAt?.toLong(),
    )
}

@Serializable
data class QuestionWireRecord(
    val id: String,
    val prompt: String? = null,
    val options: List<QuestionOptionWireRecord>? = null,
    val answeredAt: Float64? = null,
) {
    fun toQuestion(): BoardQuestion = BoardQuestion(
        id = id,
        prompt = prompt?.takeIf(String::isNotBlank) ?: "Question",
        options = (options ?: emptyList()).mapIndexed { index, option -> option.toOption(index) },
        answeredAt = answeredAt?.toLong(),
    )
}

@Serializable
data class QuestionOptionWireRecord(
    val id: String? = null,
    val label: String? = null,
    val position: Float64? = null,
) {
    fun toOption(index: Int): BoardQuestionOption = BoardQuestionOption(
        id = id ?: label ?: "option-$index",
        label = label?.takeIf(String::isNotBlank) ?: id ?: "Option",
        position = position?.toInt() ?: index,
    )
}

@Serializable
data class ProgressionWireRecord(
    val id: String? = null,
    val title: String? = null,
    val current: Float64? = null,
    val target: Float64? = null,
    val unit: String? = null,
) {
    fun toProgression(): ProgressionState = ProgressionState(
        id = id ?: title ?: "progression",
        title = title?.takeIf(String::isNotBlank) ?: "Progression",
        current = current?.toInt() ?: 0,
        target = target?.toInt() ?: 1,
        unit = unit,
    )
}

@Serializable
data class QuestWireRecord(
    val id: String,
    val title: String? = null,
    val steps: List<QuestStepWireRecord>? = null,
) {
    fun toQuest(): QuestState = QuestState(
        id = id,
        title = title?.takeIf(String::isNotBlank) ?: "Quest",
        steps = (steps ?: emptyList()).mapIndexed { index, step -> step.toStep(index) },
    )
}

@Serializable
data class QuestStepWireRecord(
    val title: String? = null,
    val gate: String? = null,
    val taskId: String? = null,
    val position: Float64? = null,
) {
    fun toStep(index: Int): QuestStep = QuestStep(
        position = position?.toInt() ?: index,
        title = title?.takeIf(String::isNotBlank) ?: "Step",
        gate = if (gate == "locked") QuestStep.QuestGate.LOCKED else QuestStep.QuestGate.AVAILABLE,
        taskId = taskId,
    )
}

@Serializable
data class GroupsRecord(
    val groups: List<GroupWireRecord>? = null,
    val spaces: List<GroupWireRecord>? = null,
    val invites: List<InviteWireRecord>? = null,
) {
    val allGroups: List<GroupWireRecord> get() = groups ?: spaces ?: emptyList()
}

@Serializable
data class GroupWireRecord(
    val id: String,
    val name: String? = null,
    val icon: String? = null,
    val color: String? = null,
    val isDefault: Boolean? = null,
    val default: Boolean? = null,
) {
    fun toGroup(): GroupItem = GroupItem(
        id = id,
        name = name?.takeIf(String::isNotBlank) ?: id,
        icon = icon.orEmpty(),
        color = color.orEmpty(),
        isDefault = isDefault ?: default ?: false,
    )
}

@Serializable
data class InviteWireRecord(
    val id: String,
    val groupId: String? = null,
    val groupName: String? = null,
    val title: String? = null,
    val body: String? = null,
    val invitee: String? = null,
    val seenAt: Float64? = null,
) {
    fun toInvite(): InviteItem = InviteItem(
        id = id,
        groupId = groupId.orEmpty(),
        groupName = groupName ?: groupId.orEmpty(),
        title = title?.takeIf(String::isNotBlank) ?: "Group invitation",
        body = body ?: invitee,
        seenAt = seenAt?.toLong(),
    )
}

@Serializable
data class RoutingsRecord(
    val routings: List<RoutingWireRecord>? = null,
)

@Serializable
data class RoutingWireRecord(
    val id: String,
    val title: String? = null,
    val trigger: String? = null,
    val execution: String? = null,
) {
    fun toRouting(): RoutingItem = RoutingItem(
        id = id,
        title = title?.takeIf(String::isNotBlank) ?: "Routing",
        trigger = trigger.orEmpty(),
        execution = execution.orEmpty(),
    )
}
