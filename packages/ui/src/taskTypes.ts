import type { Id } from "@manager/backend/convex/_generated/dataModel";

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
  /** Stored presentation hints are ignored by the row-first board. */
  presentation?: string | null;
  resourceEffect?: { resourceId: string; delta: number } | null;
}

export interface TaskDraftInput {
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

export interface TaskCreatePayload {
  [key: string]: unknown;
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
}

/** Convex update args are optional, not nullable; cleared dates are omitted. */
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
}
