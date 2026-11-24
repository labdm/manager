import type { Id } from "@manager/backend/convex/_generated/dataModel";

/** How one task is drawn. A missing value always means `check`. */
export type TaskLook = "check" | "row" | "card";

export const TASK_LOOKS: ReadonlyArray<{ id: TaskLook; label: string }> = [
  { id: "check", label: "Check" },
  { id: "row", label: "Row" },
  { id: "card", label: "Card" },
];

/** A series declares its own behavior; cadence never implies one. */
export type SeriesBehavior = "none" | "replace" | "stack";

export const SERIES_BEHAVIORS: ReadonlyArray<{
  id: SeriesBehavior;
  label: string;
  detail: string;
}> = [
  { id: "none", label: "None", detail: "One task" },
  {
    id: "replace",
    label: "Replace",
    detail: "One open task. A missed period leaves the board.",
  },
  {
    id: "stack",
    label: "Stack",
    detail: "One open task per period. Missed periods stay.",
  },
];

/** `biweekly` is the stored id; the UI label is `Every 14 days`. */
export type SeriesCadence = "daily" | "weekly" | "monthly" | "biweekly";

export const SERIES_CADENCES: ReadonlyArray<{
  id: SeriesCadence;
  label: string;
}> = [
  { id: "daily", label: "Daily" },
  { id: "weekly", label: "Weekly" },
  { id: "monthly", label: "Monthly" },
  { id: "biweekly", label: "Every 14 days" },
];

export type EntityKind =
  | "category"
  | "event"
  | "view"
  | "progression"
  | "resource";

export const ENTITY_KINDS: ReadonlyArray<{
  id: EntityKind;
  label: string;
  icon: string;
  color: string;
}> = [
  { id: "category", label: "Category", icon: "shapes", color: "violet" },
  { id: "event", label: "Event", icon: "calendar-range", color: "amber" },
  { id: "view", label: "View", icon: "layers", color: "sky" },
  { id: "progression", label: "Progression", icon: "target", color: "green" },
  { id: "resource", label: "Resource", icon: "package", color: "orange" },
];

/** Every write starts from one of these targets. */
export type SheetTarget =
  | { kind: "createTask" }
  | { kind: "editTask"; id: Id<"tasks"> }
  | { kind: "entity"; entity: EntityKind; id?: string };

export function sheetTitle(target: SheetTarget): string {
  switch (target.kind) {
    case "createTask":
      return "New task";
    case "editTask":
      return "Task details";
    case "entity": {
      const label =
        ENTITY_KINDS.find((entry) => entry.id === target.entity)?.label ??
        "Entity";
      return target.id ? `Edit ${label.toLowerCase()}` : `New ${label.toLowerCase()}`;
    }
  }
}

/** One entity form writes to one Convex mutation chosen by `kind`. */
export interface EntityInput {
  kind: EntityKind;
  title: string;
  icon: string;
  color: string;
  eventKind?: string;
  startsAt?: number;
  endsAt?: number;
  mode?: "steps" | "meter";
  target?: number;
  unit?: string;
  quantity?: number;
  lowAt?: number;
}

/** Draft for `recurrences:create`. The nested effect is the deployed shape. */
export interface SeriesInput {
  behavior: "replace" | "stack";
  cadence: string;
  timezone: string;
  title: string;
  notes?: string;
  plannedTime?: number;
  location?: string;
  priority?: string;
  priorityRank?: number;
  overduePolicy?: "none" | "retire" | "escalate";
  presentation?: TaskLook;
  anchorOn?: number;
  resourceEffect?: { resourceId: string; delta: number };
  /** Older draft vocabulary, kept for callers that still pass flat fields. */
  resourceId?: string;
  resourceDelta?: number;
}

export interface ResourceEffectInput {
  taskId: Id<"tasks">;
  resourceId: string;
  delta: number;
}

/** Rows returned by `resources:list`; ids are strings across client tables. */
export interface ResourceItem {
  id: string;
  title: string;
  quantity?: number | null;
  unit?: string | null;
  lowAt?: number | null;
  icon?: string | null;
  color?: string | null;
}

export interface CategoryItem {
  id: string;
  name?: string;
  title?: string;
  slug?: string;
  icon?: string | null;
  color?: string | null;
}

export interface EventItem {
  id: string;
  title: string;
  kind: string;
  startsAt: number;
  endsAt: number;
  icon?: string | null;
  color?: string | null;
}

export interface DashboardData {
  categories: CategoryItem[];
  events: EventItem[];
  resources: ResourceItem[];
}

export interface DashboardTile {
  id: string;
  title: string;
  icon: string;
  color: string;
  kind: "view" | EntityKind;
  target?: SheetTarget;
  viewId?: string;
  isAddTile: boolean;
}
