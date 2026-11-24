import type { AchievementCounts, AlertItem, BoardSlice, BoardTask, QuestionItem } from "./homeTypes";
import { ZERO_ACHIEVEMENTS } from "./homeApi";
import type { Chip, FeedRow, GroupItem, InviteItem, ActivityValue, TaskFormDraft } from "./shellTypes";
import { formatInstant, formatPlannedDay, isOverdue, isTaskNew, mapDraftToCreatePayload } from "./taskFacts";

export function resolvedTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

/** Only the palette tokens the shell draws. Unknown tokens fall back to gray. */
export const COLOR_CLASSES: Record<string, string> = {
  gray: "bg-gray-100 text-gray-700",
  red: "bg-red-100 text-red-700",
  orange: "bg-orange-100 text-orange-700",
  amber: "bg-amber-100 text-amber-700",
  yellow: "bg-yellow-100 text-yellow-700",
  lime: "bg-lime-100 text-lime-700",
  green: "bg-green-100 text-green-700",
  emerald: "bg-emerald-100 text-emerald-700",
  teal: "bg-teal-100 text-teal-700",
  cyan: "bg-cyan-100 text-cyan-700",
  sky: "bg-sky-100 text-sky-700",
  blue: "bg-blue-100 text-blue-700",
  indigo: "bg-indigo-100 text-indigo-700",
  violet: "bg-violet-100 text-violet-700",
  purple: "bg-purple-100 text-purple-700",
  fuchsia: "bg-fuchsia-100 text-fuchsia-700",
  pink: "bg-pink-100 text-pink-700",
  rose: "bg-rose-100 text-rose-700",
};

export function colorClass(token: string | null | undefined): string {
  return COLOR_CLASSES[token ?? ""] ?? COLOR_CLASSES.gray;
}

export function dueTextFor(task: BoardTask): string | null {
  const planned = formatPlannedDay(task.plannedOn ?? task.dueAt, task.plannedTime);
  const deadline = formatInstant(task.deadlineAt);
  const overdue = task.overdue ?? isOverdue(task.deadlineAt, task.done);
  const parts: string[] = [];
  if (planned) parts.push(`Planned ${planned}`);
  if (deadline) parts.push(`${overdue ? "Overdue" : "Deadline"} ${deadline}`);
  return parts.length ? parts.join(" · ") : null;
}

function recordIsNew(record: {
  origin?: string | null;
  seenAt?: number | null;
}): boolean {
  return record.origin !== "self" && record.seenAt == null;
}

export function taskToRow(task: BoardTask, locallySeen: ReadonlySet<string>): FeedRow {
  const isNew = !locallySeen.has(String(task.id)) && isTaskNew(task);
  return {
    id: `task:${task.id}`,
    type: "task",
    title: task.title,
    body: task.notes,
    isNew,
    categoryIcon: task.categoryIcon,
    categoryColor: task.categoryColor,
    progress:
      task.progression?.current != null && task.progression?.target != null
        ? `${task.progression.current} / ${task.progression.target}`
        : null,
    action: task.done ? null : "Done",
    groupMark: Boolean((task as { groupId?: string | null }).groupId),
    dueText: dueTextFor(task),
    resourceDelta:
      task.resourceDelta != null
        ? formatDelta(task.resourceDelta)
        : task.resourceEffect?.delta != null
          ? formatDelta(task.resourceEffect.delta)
          : null,
    questMark: Boolean(task.questMark),
    taskId: task.id,
    done: task.done,
  };
}

function formatDelta(delta: number): string {
  return delta > 0 ? `+${delta}` : String(delta);
}

export function alertToRow(alert: AlertItem): FeedRow {
  return {
    id: `message:${alert.id}`,
    type: "message",
    title: alert.title,
    body: alert.body,
    isNew: recordIsNew(alert),
    action: "Mark as read",
    groupMark: Boolean(alert.groupId),
    alertId: alert.id,
    origin: alert.origin ?? null,
  };
}

export function questionToRow(question: QuestionItem): FeedRow {
  return {
    id: `question:${question.id}`,
    type: "question",
    title: question.prompt,
    body: question.options.map((option) => option.label).join(" · "),
    isNew: recordIsNew(question),
    action: "Answer",
    groupMark: Boolean(question.groupId),
    questMark: true,
  };
}

export function inviteToRow(invite: InviteItem, groups: GroupItem[]): FeedRow {
  const groupName = invite.groupName ?? groups.find((group) => group.id === invite.groupId)?.name;
  return {
    id: `invite:${invite.id}`,
    type: "invite",
    title: invite.email ? `Invite ${invite.email}` : "Group invite",
    body: groupName ? `To ${groupName}` : null,
    isNew: recordIsNew(invite),
    action: "Accept",
    groupMark: true,
    inviteId: invite.id,
  };
}

export function progressionToRow(progression: {
  id: string;
  title: string;
  current: number;
  target: number;
  unit?: string | null;
  icon?: string | null;
  color?: string | null;
  questMark?: boolean;
}): FeedRow {
  return {
    id: `progression:${progression.id}`,
    type: "progression",
    title: progression.title,
    isNew: false,
    categoryIcon: progression.icon,
    categoryColor: progression.color,
    progress: `${progression.current} / ${progression.target}${progression.unit ? ` ${progression.unit}` : ""}`,
    action: "Log",
    groupMark: false,
    questMark: Boolean(progression.questMark),
    progressionId: progression.id,
  };
}

/** Activity rows follow the Tasks-page setting. Your own tasks always stay. */
export function activityVisible(row: FeedRow, activity: ActivityValue): boolean {
  if (row.type !== "message") return true;
  if (activity === "none") return false;
  if (activity === "all") return true;
  return row.origin !== "self";
}

export function chipTab(chip: Chip): "tasks" | "daily" | "weekly" | "monthly" | "events" {
  return chip === "all" ? "tasks" : chip;
}

export function chipBadge(
  board: BoardSlice | null,
  chip: Chip,
  rows: FeedRow[]
): number {
  const fromBoard = board?.unseen?.[chip === "events" ? "events" : chip === "all" ? "all" : chip];
  if (typeof fromBoard === "number") return fromBoard;
  return rows.filter((row) => row.isNew).length;
}

export function achievementCounts(board: BoardSlice | null): AchievementCounts {
  const counts = { ...ZERO_ACHIEVEMENTS };
  const payload = board?.achievements;
  if (!payload) return counts;
  for (const key of Object.keys(counts) as Array<keyof AchievementCounts>) {
    const value = payload[key];
    if (typeof value === "number" && Number.isFinite(value)) counts[key] = value;
  }
  return counts;
}

export function taskPayloadFromForm(draft: TaskFormDraft) {
  return mapDraftToCreatePayload({ title: draft.title, plannedDay: draft.plannedDay });
}

export function recurrenceArgsFromForm(draft: TaskFormDraft, timezone: string) {
  return {
    behavior: draft.series as "replace" | "stack",
    cadence: draft.cadence === "every 14 days" ? "biweekly" : draft.cadence,
    timezone: timezone || "UTC",
    title: draft.title.trim(),
    anchorOn: mapDraftToCreatePayload({ title: draft.title, plannedDay: draft.plannedDay }).plannedOn,
  };
}
