import { normalizeColorToken } from "./homeCatalog";
import type { BoardView, ProgressionItem } from "./homeTypes";
import type { TaskDraft } from "./taskTypes";
import type {
  CategoryItem,
  DashboardData,
  DashboardTile,
  EntityInput,
  EntityKind,
  EventItem,
  ResourceItem,
  SeriesBehavior,
  SeriesCadence,
  SeriesInput,
  SheetTarget,
  TaskLook,
} from "./sheetTypes";
import { ENTITY_KINDS } from "./sheetTypes";

const PRIORITY_RANK: Record<string, number> = {
  low: 0,
  normal: 10,
  high: 20,
  urgent: 30,
};

export function normalizeTaskLook(value: string | null | undefined): TaskLook {
  return value === "row" || value === "card" ? value : "check";
}

export function normalizeSeriesBehavior(
  value: string | null | undefined
): SeriesBehavior {
  return value === "replace" || value === "stack" ? value : "none";
}

/** Accepts the UI label, the stored id, and the old draft word `fourteen`. */
export function normalizeSeriesCadence(
  value: string | null | undefined
): SeriesCadence {
  const normalized = (value ?? "").trim().toLowerCase();
  if (normalized === "weekly" || normalized === "monthly" || normalized === "biweekly") {
    return normalized;
  }
  if (
    normalized === "every 14 days" ||
    normalized === "fourteen" ||
    normalized === "fortnightly"
  ) {
    return "biweekly";
  }
  return "daily";
}

/** The only cadence label the sheet shows. The backend normalizes it. */
export function cadenceLabel(cadence: SeriesCadence): string {
  return cadence === "biweekly" ? "Every 14 days" : cadence;
}

export function entityTitle(item: { title?: string; name?: string }): string {
  return (item.title ?? item.name ?? "").trim() || "Untitled";
}

export function emptyTaskDraft(): TaskDraft {
  return {
    title: "",
    notes: "",
    plannedDay: "",
    plannedTime: "",
    location: "",
    deadline: "",
    remindAt: "",
    priority: "normal",
    overduePolicy: "none",
    look: "check",
    series: "none",
    cadence: "daily",
    resourceId: "",
    resourceDelta: "1",
  };
}

export function emptyEntityInput(kind: EntityKind): EntityInput {
  const seed = ENTITY_KINDS.find((entry) => entry.id === kind)!;
  const input: EntityInput = {
    kind,
    title: "",
    icon: seed.icon,
    color: seed.color,
  };
  if (kind === "event") {
    input.eventKind = "day";
  }
  if (kind === "progression") {
    input.mode = "meter";
    input.target = 1;
    input.unit = "";
  }
  if (kind === "resource") {
    input.quantity = 0;
    input.lowAt = undefined;
  }
  return input;
}

export function entityInputFromCategory(item: CategoryItem): EntityInput {
  return {
    kind: "category",
    title: entityTitle(item),
    icon: item.icon || "shapes",
    color: normalizeColorToken(item.color),
  };
}

export function entityInputFromEvent(item: EventItem): EntityInput {
  return {
    kind: "event",
    title: entityTitle(item),
    icon: item.icon || "calendar-days",
    color: normalizeColorToken(item.color),
    eventKind: item.kind || "day",
    startsAt: item.startsAt,
    endsAt: item.endsAt,
  };
}

export function entityInputFromView(view: BoardView): EntityInput {
  return {
    kind: "view",
    title: view.title,
    icon: view.icon || "circle",
    color: normalizeColorToken(view.color),
  };
}

export function entityInputFromProgression(item: ProgressionItem): EntityInput {
  return {
    kind: "progression",
    title: entityTitle(item),
    icon: "target",
    color: "green",
    mode: item.mode === "steps" ? "steps" : "meter",
    target: item.target,
    unit: item.unit || "",
  };
}

export function entityInputFromResource(item: ResourceItem): EntityInput {
  return {
    kind: "resource",
    title: entityTitle(item),
    icon: item.icon || "package",
    color: normalizeColorToken(item.color),
    quantity: item.quantity ?? 0,
    lowAt: item.lowAt ?? undefined,
    unit: item.unit || "",
  };
}

/** Resolve the sheet's starting input from a tile, including edit targets. */
export function entityInputForTarget(
  target: Extract<SheetTarget, { kind: "entity" }>,
  input: {
    views?: BoardView[];
    categories?: CategoryItem[];
    events?: EventItem[];
    progressions?: ProgressionItem[];
    resources?: ResourceItem[];
  }
): EntityInput {
  if (!target.id) return emptyEntityInput(target.entity);
  const id = target.id;
  switch (target.entity) {
    case "category": {
      const found = (input.categories ?? []).find((item) => item.id === id);
      return found ? entityInputFromCategory(found) : emptyEntityInput("category");
    }
    case "event": {
      const found = (input.events ?? []).find((item) => item.id === id);
      return found ? entityInputFromEvent(found) : emptyEntityInput("event");
    }
    case "view": {
      const found = (input.views ?? []).find((item) => item.id === id);
      return found ? entityInputFromView(found) : emptyEntityInput("view");
    }
    case "progression": {
      const found = (input.progressions ?? []).find((item) => item.id === id);
      return found
        ? entityInputFromProgression(found)
        : emptyEntityInput("progression");
    }
    case "resource": {
      const found = (input.resources ?? []).find((item) => item.id === id);
      return found ? entityInputFromResource(found) : emptyEntityInput("resource");
    }
  }
}

function civilDayToEpoch(value: string): number | undefined {
  const parts = value.trim().split("-");
  if (parts.length !== 3) return undefined;
  const year = Number(parts[0]);
  const month = Number(parts[1]) - 1;
  const day = Number(parts[2]);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return undefined;
  }
  const time = new Date(year, month, day, 0, 0, 0, 0).getTime();
  return Number.isSafeInteger(time) ? time : undefined;
}

function timeToMinutes(value: string): number | undefined {
  const parts = value.trim().split(":");
  if (parts.length < 2) return undefined;
  const hours = Number(parts[0]);
  const minutes = Number(parts[1]);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return undefined;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return undefined;
  return hours * 60 + minutes;
}

/**
 * A create mapping for `recurrences:create`. Behavior stays the user's choice;
 * cadence never picks it. The 14-day cadence is sent as `every 14 days`.
 */
export function seriesInputFromDraft(
  draft: TaskDraft,
  timezone: string
): SeriesInput {
  const behavior: SeriesBehavior = normalizeSeriesBehavior(draft.series);
  const delta = Number(draft.resourceDelta);
  const priority = draft.priority.trim() || "normal";
  return {
    behavior: behavior === "none" ? "replace" : behavior,
    cadence: cadenceLabel(normalizeSeriesCadence(draft.cadence)),
    timezone: timezone.trim() || "UTC",
    title: draft.title.trim(),
    notes: draft.notes.trim() || undefined,
    plannedTime: timeToMinutes(draft.plannedTime),
    location: draft.location.trim() || undefined,
    priority,
    priorityRank: PRIORITY_RANK[priority] ?? 10,
    overduePolicy: draft.overduePolicy,
    presentation: normalizeTaskLook(draft.look),
    anchorOn: civilDayToEpoch(draft.plannedDay),
    resourceEffect:
      draft.resourceId.trim() && Number.isFinite(delta)
        ? { resourceId: draft.resourceId.trim(), delta }
        : undefined,
  };
}

function addTile(kind: EntityKind): DashboardTile {
  const seed = ENTITY_KINDS.find((entry) => entry.id === kind)!;
  return {
    id: `add-${seed.id}`,
    title: `Add ${seed.label.toLowerCase()}`,
    icon: "plus",
    color: seed.color,
    kind,
    target: { kind: "entity", entity: seed.id },
    isAddTile: true,
  };
}

/** The full-screen grid is composed here so it can be tested without React. */
export function buildDashboardTiles(input: {
  views?: BoardView[];
  categories?: CategoryItem[];
  events?: EventItem[];
  progressions?: ProgressionItem[];
  resources?: ResourceItem[];
}): DashboardTile[] {
  const tiles: DashboardTile[] = [];

  for (const view of input.views ?? []) {
    tiles.push({
      id: `view-${view.id}`,
      title: view.title,
      icon: view.icon || "circle",
      color: normalizeColorToken(view.color),
      kind: "view",
      viewId: view.id,
      target: { kind: "entity", entity: "view", id: view.id },
      isAddTile: false,
    });
  }
  tiles.push(addTile("view"));

  for (const category of input.categories ?? []) {
    tiles.push({
      id: `category-${category.id}`,
      title: entityTitle(category),
      icon: category.icon || "shapes",
      color: normalizeColorToken(category.color),
      kind: "category",
      target: { kind: "entity", entity: "category", id: category.id },
      isAddTile: false,
    });
  }
  tiles.push(addTile("category"));

  for (const event of input.events ?? []) {
    tiles.push({
      id: `event-${event.id}`,
      title: entityTitle(event),
      icon: event.icon || "calendar-days",
      color: normalizeColorToken(event.color),
      kind: "event",
      target: { kind: "entity", entity: "event", id: event.id },
      isAddTile: false,
    });
  }
  tiles.push(addTile("event"));

  for (const progression of input.progressions ?? []) {
    tiles.push({
      id: `progression-${progression.id}`,
      title: entityTitle(progression),
      icon: "target",
      color: "green",
      kind: "progression",
      target: { kind: "entity", entity: "progression", id: progression.id },
      isAddTile: false,
    });
  }
  tiles.push(addTile("progression"));

  for (const resource of input.resources ?? []) {
    tiles.push({
      id: `resource-${resource.id}`,
      title: entityTitle(resource),
      icon: resource.icon || "package",
      color: normalizeColorToken(resource.color),
      kind: "resource",
      target: { kind: "entity", entity: "resource", id: resource.id },
      isAddTile: false,
    });
  }
  tiles.push(addTile("resource"));

  return tiles;
}

export function dashboardDataFrom(
  data: DashboardData | null | undefined,
  fallback: DashboardData
): DashboardData {
  return data ?? fallback;
}
