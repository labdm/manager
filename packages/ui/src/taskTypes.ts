import type { Id } from "@manager/backend/convex/_generated/dataModel";
import type { SeriesBehavior, SeriesCadence, TaskLook } from "./sheetTypes";

export type Priority = "low" | "normal" | "high" | "urgent" | string;
export type OverduePolicy = "none" | "retire" | "escalate";
export type TaskOutcome = "superseded" | "missed" | null;
export type TaskOrigin = "self" | "agent" | "member";

export interface TaskItem {
  id: Id<"tasks">;
  title: string;
  done: boolean;
  dueAt: number | null;
  ownerId?: Id<"users">;
  notes?: string | null;
  plannedOn?: number | null;
  plannedTime?: number | null; // 0-1439 minutes from midnight
  location?: string | null;
  deadlineAt?: number | null;
  remindAt?: number | null;
  priority?: Priority | null;
  priorityRank?: number | null;
  effectiveRank?: number | null;
  overdue?: boolean | null;
  overduePolicy?: OverduePolicy | null;
  outcome?: TaskOutcome;
  origin?: TaskOrigin | null;
  seenAt?: number | null;
  completedAt?: number | null;
  deletedAt?: number | null;
  recurrenceId?: string | null;
  periodStart?: number | null;
  presentation?: string | null;
  resourceEffect?: { resourceId: string; delta: number } | null;
}

export interface TaskDraft {
  title: string;
  notes: string;
  plannedDay: string; // YYYY-MM-DD
  plannedTime: string; // HH:mm
  location: string;
  deadline: string; // YYYY-MM-DDTHH:mm
  remindAt: string; // YYYY-MM-DDTHH:mm
  priority: string;
  overduePolicy: OverduePolicy;
  look: TaskLook;
  series: SeriesBehavior;
  cadence: SeriesCadence;
  resourceId: string;
  resourceDelta: string;
}

export interface TaskCreatePayload {
  title: string;
  dueAt?: number;
  plannedOn?: number;
  plannedTime?: number;
  location?: string;
  notes?: string;
  deadlineAt?: number;
  remindAt?: number;
  priority?: string;
  priorityRank?: number;
  overduePolicy?: OverduePolicy;
  presentation?: TaskLook;
}

/**
 * `tasks.update` declares optional fields, not nullable ones. Cleared numeric
 * and date fields are omitted; cleared text fields are sent as empty strings.
 */
export interface TaskUpdatePayload {
  id: Id<"tasks">;
  title?: string;
  notes?: string;
  dueAt?: number;
  plannedOn?: number;
  plannedTime?: number;
  location?: string;
  deadlineAt?: number;
  remindAt?: number;
  priority?: string;
  priorityRank?: number;
  overduePolicy?: OverduePolicy;
  presentation?: TaskLook;
}
