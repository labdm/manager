import type { DatabaseReader, DatabaseWriter } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { SEED_PRIORITIES, isSeedPriority } from "./taskFields";

/**
 * Persist an overdue outcome exactly once. `none` stays derived on read;
 * `retire` writes an outcome (never deletedAt); `escalate` bumps a seed rank
 * once and leaves custom priorities alone.
 */
export async function applyOverdue(
  db: DatabaseWriter,
  task: Doc<"tasks">,
  now = Date.now(),
): Promise<boolean> {
  if (
    task.deletedAt !== undefined ||
    task.done ||
    task.outcome !== undefined ||
    task.deadlineAt === undefined ||
    task.deadlineAt >= now
  ) {
    return false;
  }

  if (task.overduePolicy === "retire") {
    await db.patch(task._id, { outcome: "missed", open: false });
    return true;
  }

  if (
    task.overduePolicy === "escalate" &&
    task.escalatedAt === undefined &&
    isSeedPriority(task.priority)
  ) {
    await db.patch(task._id, {
      priorityRank: Math.min(SEED_PRIORITIES[task.priority] + 10, 30),
      escalatedAt: now,
    });
    return true;
  }

  return false;
}

export async function applyOverdueForOwner(
  db: DatabaseWriter,
  ownerId: Id<"users">,
  now = Date.now(),
  reader: DatabaseReader = db,
): Promise<number> {
  const tasks = await reader
    .query("tasks")
    .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
    .collect();
  let changed = 0;
  for (const task of tasks) {
    if (await applyOverdue(db, task, now)) changed += 1;
  }
  return changed;
}
