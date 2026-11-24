import type { Id } from "@manager/backend/convex/_generated/dataModel";
import type {
  OverduePolicy,
  TaskCreatePayload,
  TaskUpdatePayload,
} from "./taskTypes";

export const PRIORITY_SEEDS: Record<string, { rank: number; label: string }> = {
  low: { rank: 0, label: "low" },
  normal: { rank: 10, label: "normal" },
  high: { rank: 20, label: "high" },
  urgent: { rank: 30, label: "urgent" },
};

export const DEFAULT_PRIORITY = "normal";
export const DEFAULT_PRIORITY_RANK = 10;
export const DEFAULT_OVERDUE_POLICY: OverduePolicy = "none";

/**
 * NEW when origin is agent or member and seenAt is null or absent.
 * Missing origin is not NEW.
 * Rows created by self are not NEW.
 */
export function isTaskNew(task: {
  origin?: string | null;
  seenAt?: number | null;
}): boolean {
  if (task.origin === "agent" || task.origin === "member") {
    return task.seenAt === null || task.seenAt === undefined;
  }
  return false;
}

/**
 * Civil day string (YYYY-MM-DD) to local epoch ms at the start of that day.
 */
export function civilDayToTimestamp(dateStr: string | null | undefined): number | null {
  if (!dateStr || !dateStr.trim()) return null;
  const parts = dateStr.trim().split("-");
  if (parts.length !== 3) return null;
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  if (isNaN(year) || isNaN(month) || isNaN(day)) return null;
  const date = new Date(year, month, day, 0, 0, 0, 0);
  const time = date.getTime();
  return Number.isFinite(time) ? time : null;
}

/**
 * Local epoch ms to civil day string (YYYY-MM-DD).
 */
export function timestampToCivilDay(ts: number | null | undefined): string {
  if (ts == null || !Number.isFinite(ts)) return "";
  const d = new Date(ts);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * HH:mm string to minutes from midnight (0..1439).
 */
export function timeStrToMinutes(timeStr: string | null | undefined): number | null {
  if (!timeStr || !timeStr.trim()) return null;
  const parts = timeStr.trim().split(":");
  if (parts.length < 2) return null;
  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  if (isNaN(hours) || isNaN(minutes)) return null;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
}

/**
 * Minutes from midnight (0..1439) to HH:mm string.
 */
export function minutesToTimeStr(minutes: number | null | undefined): string {
  if (minutes == null || !Number.isFinite(minutes) || minutes < 0 || minutes > 1439) {
    return "";
  }
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * YYYY-MM-DDTHH:mm to epoch ms instant.
 */
export function dateTimeLocalToTimestamp(str: string | null | undefined): number | null {
  if (!str || !str.trim()) return null;
  const time = new Date(str).getTime();
  return Number.isFinite(time) ? time : null;
}

/**
 * Epoch ms instant to YYYY-MM-DDTHH:mm string.
 */
export function timestampToDateTimeLocal(ts: number | null | undefined): string {
  if (ts == null || !Number.isFinite(ts)) return "";
  const d = new Date(ts);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

/**
 * Format planned day (and optional planned time) for display.
 */
export function formatPlannedDay(
  plannedOn: number | null | undefined,
  plannedTime?: number | null | undefined
): string | null {
  if (plannedOn == null || !Number.isFinite(plannedOn)) return null;
  const dateStr = new Date(plannedOn).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  if (
    plannedTime != null &&
    Number.isFinite(plannedTime) &&
    plannedTime >= 0 &&
    plannedTime <= 1439
  ) {
    const timeStr = minutesToTimeStr(plannedTime);
    return `${dateStr} at ${timeStr}`;
  }
  return dateStr;
}

/**
 * Format an instant (e.g. deadlineAt, remindAt) for display.
 */
export function formatInstant(ts: number | null | undefined): string | null {
  if (ts == null || !Number.isFinite(ts)) return null;
  return new Date(ts).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Checks if a task is overdue.
 * True when deadlineAt is before now, task is not done, and deadline exists.
 */
export function isOverdue(
  deadlineAt: number | null | undefined,
  done: boolean,
  now: number = Date.now()
): boolean {
  if (done) return false;
  if (deadlineAt == null || !Number.isFinite(deadlineAt)) return false;
  return deadlineAt < now;
}

/**
 * Escalate adds 10 to seed priority rank (capped at 30) when overdue.
 */
export function computeEffectiveRank(
  priority: string | null | undefined,
  priorityRank: number | null | undefined,
  overdue: boolean,
  overduePolicy: OverduePolicy | string | null | undefined
): number | null {
  const rank =
    priorityRank ??
    (priority && priority in PRIORITY_SEEDS
      ? PRIORITY_SEEDS[priority].rank
      : null);
  if (rank == null) return null;
  const isSeed = priority != null && priority in PRIORITY_SEEDS;
  const escalate = overdue && overduePolicy === "escalate" && isSeed;
  return escalate ? Math.min(rank + 10, 30) : rank;
}

/**
 * Maps form/composer draft to backend TaskCreatePayload.
 * Invariant: dueAt and plannedOn mirror the planned day.
 * Deadline is completely separate and NEVER writes to plannedOn or dueAt.
 */
export function mapDraftToCreatePayload(draft: {
  title: string;
  notes?: string;
  plannedDay?: string;
  plannedTime?: string;
  location?: string;
  deadline?: string;
  remindAt?: string;
  priority?: string;
  overduePolicy?: OverduePolicy;
}): TaskCreatePayload {
  const plannedOn = civilDayToTimestamp(draft.plannedDay);
  const deadlineAt = dateTimeLocalToTimestamp(draft.deadline);
  const remindAt = dateTimeLocalToTimestamp(draft.remindAt);
  const plannedTime = timeStrToMinutes(draft.plannedTime);
  const priority = draft.priority?.trim() || DEFAULT_PRIORITY;
  const priorityRank = PRIORITY_SEEDS[priority]?.rank ?? DEFAULT_PRIORITY_RANK;

  return {
    title: draft.title.trim(),
    dueAt: plannedOn ?? undefined,
    plannedOn: plannedOn ?? undefined,
    plannedTime: plannedTime ?? undefined,
    location: draft.location?.trim() || undefined,
    notes: draft.notes?.trim() || undefined,
    deadlineAt: deadlineAt ?? undefined,
    remindAt: remindAt ?? undefined,
    priority,
    priorityRank,
    overduePolicy: draft.overduePolicy || DEFAULT_OVERDUE_POLICY,
  };
}

/**
 * Maps form draft to backend TaskUpdatePayload.
 * Invariant: dueAt and plannedOn mirror the planned day.
 * Deadline is completely separate and NEVER writes to plannedOn or dueAt.
 */
export function mapDraftToUpdatePayload(
  taskId: Id<"tasks">,
  draft: {
    title: string;
    notes?: string;
    plannedDay?: string;
    plannedTime?: string;
    location?: string;
    deadline?: string;
    remindAt?: string;
    priority?: string;
    overduePolicy?: OverduePolicy;
  }
): TaskUpdatePayload {
  const hasPlannedDay = Boolean(draft.plannedDay && draft.plannedDay.trim());
  const plannedOn = hasPlannedDay ? civilDayToTimestamp(draft.plannedDay) : null;

  const hasDeadline = Boolean(draft.deadline && draft.deadline.trim());
  const deadlineAt = hasDeadline ? dateTimeLocalToTimestamp(draft.deadline) : null;

  const hasRemindAt = Boolean(draft.remindAt && draft.remindAt.trim());
  const remindAt = hasRemindAt ? dateTimeLocalToTimestamp(draft.remindAt) : null;

  const hasPlannedTime = Boolean(draft.plannedTime && draft.plannedTime.trim());
  const plannedTime = hasPlannedTime ? timeStrToMinutes(draft.plannedTime) : null;

  const priority = draft.priority?.trim() || DEFAULT_PRIORITY;
  const priorityRank = PRIORITY_SEEDS[priority]?.rank ?? DEFAULT_PRIORITY_RANK;

  const payload: TaskUpdatePayload = {
    id: taskId,
    title: draft.title.trim(),
    notes: draft.notes?.trim() ?? "",
    location: draft.location?.trim() ?? "",
    priority,
    priorityRank,
    overduePolicy: draft.overduePolicy || DEFAULT_OVERDUE_POLICY,
  };

  // tasks.update uses optional (not nullable) args. Omit cleared dates so the
  // mutation validates; text fields above are cleared with empty strings.
  if (plannedOn != null) {
    payload.dueAt = plannedOn;
    payload.plannedOn = plannedOn;
  }
  if (plannedTime != null) payload.plannedTime = plannedTime;
  if (deadlineAt != null) payload.deadlineAt = deadlineAt;
  if (remindAt != null) payload.remindAt = remindAt;

  return payload;
}

/**
 * Opening a row calls tasks.markSeen with the id.
 * After a successful markSeen, returns { seenAt } so the local row has seenAt set
 * and the NEW mark leaves.
 */
export async function openTaskAction(
  task: { id: Id<"tasks">; seenAt?: number | null; origin?: string | null },
  markSeenFn: (args: { id: Id<"tasks"> }) => Promise<unknown>,
  now: number = Date.now()
): Promise<{ seenAt: number } | null> {
  if (task.seenAt != null) return null;

  const result = await markSeenFn({ id: task.id });
  const returnedSeenAt =
    typeof result === "object" && result !== null && "seenAt" in result
      ? (result as { seenAt?: unknown }).seenAt
      : undefined;

  return {
    seenAt:
      typeof returnedSeenAt === "number" && Number.isFinite(returnedSeenAt)
        ? returnedSeenAt
        : now,
  };
}
