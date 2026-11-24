import type { DatabaseReader, DatabaseWriter } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import {
  assertTimezone,
  addPeriods,
  isCadence,
  normalizeCadence,
  periodsBetween,
  periodStartFor,
} from "./civilDates";
import type { ResourceEffect } from "./resourceService";
import {
  assertEpoch,
  assertPlannedTime,
  normalizePresentation,
  normalizeTitle,
  normalizeOverduePolicy,
  resolvePriorityAndRank,
} from "./taskFields";
import * as taskService from "./taskService";

export type RecurrenceInput = {
  behavior: "replace" | "stack";
  cadence: string;
  timezone: string;
  title: string;
  notes?: string;
  plannedTime?: number;
  location?: string;
  priority?: string;
  overduePolicy?: string;
  presentationHint?: string;
  presentation?: string;
  resourceEffect?: ResourceEffect;
  anchorOn?: number;
};

function normalizeBehavior(value: string): "replace" | "stack" {
  if (value !== "replace" && value !== "stack") {
    throw new Error("Invalid behavior");
  }
  return value;
}

export async function createRecurrence(
  db: DatabaseWriter,
  ownerId: Id<"users">,
  input: RecurrenceInput,
  now = Date.now(),
): Promise<Doc<"recurrences">> {
  const behavior = normalizeBehavior(input.behavior);
  const cadence = normalizeCadence(input.cadence);
  if (!isCadence(cadence)) throw new Error("Unsupported cadence");
  assertTimezone(input.timezone);
  const title = normalizeTitle(input.title);
  assertPlannedTime(input.plannedTime);
  assertEpoch(input.anchorOn, "anchorOn");
  const { priority, priorityRank } = resolvePriorityAndRank(
    input.priority,
    undefined,
  );
  const overduePolicy = normalizeOverduePolicy(input.overduePolicy);
  const presentation = normalizePresentation(input.presentation);

  let resourceEffect: ResourceEffect | undefined;
  if (input.resourceEffect !== undefined) {
    const { resourceId, delta } = input.resourceEffect;
    if (!Number.isFinite(delta)) throw new Error("Invalid delta");
    const resource = await db.get(resourceId);
    if (
      !resource ||
      resource.ownerId !== ownerId ||
      resource.deletedAt !== undefined
    ) {
      throw new Error("Resource not found");
    }
    resourceEffect = { resourceId, delta };
  }

  const initialAnchor =
    input.anchorOn ?? periodStartFor(cadence, now, input.timezone);
  const anchorOn = periodStartFor(cadence, initialAnchor, input.timezone, initialAnchor);

  const id = await db.insert("recurrences", {
    ownerId,
    behavior,
    cadence,
    timezone: input.timezone,
    title,
    notes: input.notes,
    plannedTime: input.plannedTime,
    location: input.location,
    priority,
    priorityRank,
    overduePolicy,
    presentationHint: input.presentationHint,
    presentation,
    resourceEffect,
    anchorOn,
    deletedAt: undefined,
    createdAt: now,
  });
  const created = await db.get(id);
  if (!created) throw new Error("Recurrence not found");
  // A new series starts with its anchor occurrence, usually today.
  await mint(db, created, created.anchorOn);
  return created;
}

export async function listRecurrences(
  db: DatabaseReader,
  ownerId: Id<"users">,
): Promise<Doc<"recurrences">[]> {
  const rows = await db
    .query("recurrences")
    .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
    .collect();
  return rows.filter((row) => row.deletedAt === undefined);
}

async function occurrences(
  db: DatabaseReader,
  recurrenceId: Id<"recurrences">,
): Promise<Doc<"tasks">[]> {
  return await db
    .query("tasks")
    .withIndex("by_recurrence_period", (q) =>
      q.eq("recurrenceId", recurrenceId),
    )
    .collect();
}

async function mint(
  db: DatabaseWriter,
  recurrence: Doc<"recurrences">,
  periodStart: number,
): Promise<void> {
  await taskService.createTask(
    db,
    recurrence.ownerId,
    {
      title: recurrence.title,
      notes: recurrence.notes,
      plannedOn: periodStart,
      plannedTime: recurrence.plannedTime,
      location: recurrence.location,
      priority: recurrence.priority,
      priorityRank: recurrence.priorityRank,
      overduePolicy: recurrence.overduePolicy,
      presentationHint: recurrence.presentationHint,
      presentation: recurrence.presentation,
      resourceEffect: recurrence.resourceEffect,
      recurrenceId: recurrence._id,
      periodStart,
      origin: "self",
    },
  );
}

/** Reconcile one recurrence. Safe to call any number of times. */
export async function reconcileRecurrence(
  db: DatabaseWriter,
  recurrence: Doc<"recurrences">,
  now = Date.now(),
): Promise<void> {
  if (recurrence.deletedAt !== undefined) return;
  if (!isCadence(recurrence.cadence)) return;

  const current = periodStartFor(
    recurrence.cadence,
    now,
    recurrence.timezone,
    recurrence.anchorOn,
  );
  const anchor = periodStartFor(
    recurrence.cadence,
    recurrence.anchorOn,
    recurrence.timezone,
    recurrence.anchorOn,
  );
  if (current < anchor) return;

  const existing = await occurrences(db, recurrence._id);
  const byPeriod = new Map<number, Doc<"tasks">>();
  for (const row of existing) {
    if (row.periodStart !== undefined && row.deletedAt === undefined) {
      byPeriod.set(row.periodStart, row);
    }
  }

  if (recurrence.behavior === "replace") {
    // Only the current period is minted. Older open rows leave the board.
    const rows = await occurrences(db, recurrence._id);
    for (const row of rows) {
      if (
        row.deletedAt === undefined &&
        row.outcome === undefined &&
        !row.done &&
        row.periodStart !== undefined &&
        row.periodStart < current
      ) {
        await db.patch(row._id, { outcome: "superseded", open: false });
      }
    }
    if (!byPeriod.has(current)) await mint(db, recurrence, current);
    return;
  }

  // Stack: every missed period stays open. No backfill cap in the core.
  const count = periodsBetween(recurrence.cadence, anchor, current, recurrence.timezone);
  for (let index = 0; index <= count; index += 1) {
    const start = addPeriods(recurrence.cadence, anchor, index, recurrence.timezone);
    if (!byPeriod.has(start)) await mint(db, recurrence, start);
  }
}

/** Reconcile every live recurrence owned by one user. */
export async function reconcileOwner(
  db: DatabaseWriter,
  ownerId: Id<"users">,
  now = Date.now(),
): Promise<void> {
  const rows = await listRecurrences(db, ownerId);
  for (const row of rows) await reconcileRecurrence(db, row, now);
}
