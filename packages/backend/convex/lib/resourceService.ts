import type { DatabaseReader, DatabaseWriter } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { normalizeTitle } from "./taskFields";

export type ResourceView = {
  id: Id<"resources">;
  title: string;
  unit: string | null;
  quantity: number;
  lowAt: number | null;
  icon: string | null;
  color: string | null;
};

export type ResourceEffect = {
  resourceId: Id<"resources">;
  delta: number;
};

export type ResourceInput = {
  title: string;
  unit?: string;
  quantity: number;
  lowAt?: number;
  icon?: string;
  color?: string;
};

export type ResourceUpdate = Partial<ResourceInput>;

function optionalString(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function optionalNumber(value: number | undefined, name: string): number | undefined {
  if (value === undefined) return undefined;
  if (!Number.isFinite(value)) throw new Error(`Invalid ${name}`);
  return value;
}

function requiredNumber(value: number, name: string): number {
  const normalized = optionalNumber(value, name);
  if (normalized === undefined) throw new Error(`Invalid ${name}`);
  return normalized;
}

export function resourceView(resource: Doc<"resources">): ResourceView {
  return {
    id: resource._id,
    title: resource.title,
    unit: resource.unit ?? null,
    quantity: resource.quantity,
    lowAt: resource.lowAt ?? null,
    icon: resource.icon ?? null,
    color: resource.color ?? null,
  };
}

export async function listResources(
  db: DatabaseReader,
  ownerId: Id<"users">,
): Promise<ResourceView[]> {
  const rows = await db
    .query("resources")
    .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
    .collect();
  return rows
    .filter((row) => row.deletedAt === undefined)
    .sort((a, b) => a.title.localeCompare(b.title) || a._creationTime - b._creationTime)
    .map(resourceView);
}

async function liveResource(
  db: DatabaseReader,
  ownerId: Id<"users">,
  resourceId: Id<"resources">,
): Promise<Doc<"resources">> {
  const resource = await db.get(resourceId);
  if (!resource || resource.ownerId !== ownerId || resource.deletedAt !== undefined) {
    throw new Error("Resource not found");
  }
  return resource;
}

/** Keeps at most one unread low-stock alert for a resource. */
async function syncLowStockAlert(
  db: DatabaseWriter,
  ownerId: Id<"users">,
  resource: Doc<"resources">,
  now: number,
): Promise<void> {
  const owned = await db
    .query("alerts")
    .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
    .collect();
  const unread = owned.filter(
    (alert) =>
      alert.deletedAt === undefined &&
      alert.seenAt === undefined &&
      (alert.resourceId === resource._id || alert.source === String(resource._id)),
  );
  const low = resource.lowAt !== undefined && resource.quantity <= resource.lowAt;

  if (!low) {
    for (const alert of unread) await db.patch(alert._id, { seenAt: now });
    return;
  }

  if (unread.length > 0) {
    for (const alert of unread.slice(1)) await db.patch(alert._id, { seenAt: now });
    return;
  }

  const unit = resource.unit ? ` ${resource.unit}` : "";
  await db.insert("alerts", {
    ownerId,
    title: `Low stock: ${resource.title}`,
    body: `${resource.quantity}${unit} left (low at ${resource.lowAt}${unit})`,
    source: String(resource._id),
    resourceId: resource._id,
    deletedAt: undefined,
  });
}

async function changeQuantity(
  db: DatabaseWriter,
  ownerId: Id<"users">,
  resourceId: Id<"resources">,
  amount: number,
  now: number,
): Promise<void> {
  const resource = await db.get(resourceId);
  if (!resource || resource.ownerId !== ownerId || resource.deletedAt !== undefined) return;
  const quantity = resource.quantity + amount;
  await db.patch(resourceId, { quantity });
  await syncLowStockAlert(db, ownerId, { ...resource, quantity }, now);
}

export async function createResource(
  db: DatabaseWriter,
  ownerId: Id<"users">,
  input: ResourceInput,
  now = Date.now(),
): Promise<ResourceView> {
  const quantity = requiredNumber(input.quantity, "quantity");
  const lowAt = optionalNumber(input.lowAt, "lowAt");
  const id = await db.insert("resources", {
    ownerId,
    title: normalizeTitle(input.title),
    unit: optionalString(input.unit),
    quantity,
    lowAt,
    icon: optionalString(input.icon),
    color: optionalString(input.color),
    deletedAt: undefined,
    createdAt: now,
  });
  const created = await liveResource(db, ownerId, id);
  await syncLowStockAlert(db, ownerId, created, now);
  return resourceView(created);
}

export async function updateResource(
  db: DatabaseWriter,
  ownerId: Id<"users">,
  resourceId: Id<"resources">,
  input: ResourceUpdate,
  now = Date.now(),
): Promise<ResourceView> {
  await liveResource(db, ownerId, resourceId);
  const patch: Partial<Doc<"resources">> = {};

  // A blank string is not a clear, and a missing number is not a zero.
  const title = optionalString(input.title);
  if (title !== undefined) patch.title = normalizeTitle(title);
  const unit = optionalString(input.unit);
  if (unit !== undefined) patch.unit = unit;
  const icon = optionalString(input.icon);
  if (icon !== undefined) patch.icon = icon;
  const color = optionalString(input.color);
  if (color !== undefined) patch.color = color;
  const quantity = optionalNumber(input.quantity, "quantity");
  if (quantity !== undefined) patch.quantity = quantity;
  const lowAt = optionalNumber(input.lowAt, "lowAt");
  if (lowAt !== undefined) patch.lowAt = lowAt;

  await db.patch(resourceId, patch);
  const updated = await liveResource(db, ownerId, resourceId);
  if (quantity !== undefined || lowAt !== undefined || unit !== undefined) {
    await syncLowStockAlert(db, ownerId, updated, now);
  }
  return resourceView(updated);
}

export async function removeResource(
  db: DatabaseWriter,
  ownerId: Id<"users">,
  resourceId: Id<"resources">,
  now = Date.now(),
): Promise<{ success: true; id: Id<"resources"> }> {
  await liveResource(db, ownerId, resourceId);
  await db.patch(resourceId, { deletedAt: now });
  const effects = await db
    .query("taskResourceEffects")
    .withIndex("by_resource", (q) => q.eq("ownerId", ownerId))
    .collect();
  for (const effect of effects) {
    if (effect.resourceId === resourceId && effect.deletedAt === undefined) {
      await db.patch(effect._id, { deletedAt: now });
    }
  }
  const alerts = await db
    .query("alerts")
    .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
    .collect();
  for (const alert of alerts) {
    if (alert.resourceId === resourceId && alert.seenAt === undefined) {
      await db.patch(alert._id, { seenAt: now });
    }
  }
  return { success: true, id: resourceId };
}

async function liveEffectsForTask(
  db: DatabaseReader,
  ownerId: Id<"users">,
  taskId: Id<"tasks">,
): Promise<Doc<"taskResourceEffects">[]> {
  const rows = await db
    .query("taskResourceEffects")
    .withIndex("by_task", (q) => q.eq("ownerId", ownerId))
    .collect();
  return rows.filter(
    (row) => row.taskId === taskId && row.deletedAt === undefined,
  );
}

/** Apply (or reverse) every live effect on a task on a done-state transition. */
export async function applyTaskResourceEffects(
  db: DatabaseWriter,
  ownerId: Id<"users">,
  taskId: Id<"tasks">,
  done: boolean,
  now = Date.now(),
): Promise<void> {
  const effects = await liveEffectsForTask(db, ownerId, taskId);
  for (const effect of effects) {
    if (done && !effect.applied) {
      await changeQuantity(db, ownerId, effect.resourceId, effect.delta, now);
      await db.patch(effect._id, { applied: true });
    } else if (!done && effect.applied) {
      await changeQuantity(db, ownerId, effect.resourceId, -effect.delta, now);
      await db.patch(effect._id, { applied: false });
    }
  }
}

/** A trashed done task must not keep consuming stock. */
export async function reverseAppliedTaskEffects(
  db: DatabaseWriter,
  ownerId: Id<"users">,
  taskId: Id<"tasks">,
  now = Date.now(),
): Promise<void> {
  const effects = await liveEffectsForTask(db, ownerId, taskId);
  for (const effect of effects) {
    if (!effect.applied) continue;
    await changeQuantity(db, ownerId, effect.resourceId, -effect.delta, now);
    await db.patch(effect._id, { applied: false });
  }
}

/** Attaches one effect to a task. Reattaching reverses the previous one first. */
export async function setTaskResourceEffect(
  db: DatabaseWriter,
  ownerId: Id<"users">,
  taskId: Id<"tasks">,
  resourceId: Id<"resources">,
  delta: number,
  now = Date.now(),
): Promise<ResourceEffect> {
  const task = await db.get(taskId);
  if (!task || task.ownerId !== ownerId || task.deletedAt !== undefined) {
    throw new Error("Task not found");
  }
  await liveResource(db, ownerId, resourceId);
  if (!Number.isFinite(delta)) throw new Error("Invalid delta");

  const [existing] = await liveEffectsForTask(db, ownerId, taskId);
  if (existing?.applied) {
    await changeQuantity(db, ownerId, existing.resourceId, -existing.delta, now);
  }

  const applied = task.done === true;
  const effect: ResourceEffect = { resourceId, delta };
  if (existing) {
    await db.patch(existing._id, { resourceId, delta, applied, deletedAt: undefined });
  } else {
    await db.insert("taskResourceEffects", {
      ownerId,
      taskId,
      resourceId,
      delta,
      applied,
      deletedAt: undefined,
    });
  }
  if (applied) await changeQuantity(db, ownerId, resourceId, delta, now);
  await db.patch(taskId, { resourceEffect: effect });
  return effect;
}

export async function clearTaskResourceEffect(
  db: DatabaseWriter,
  ownerId: Id<"users">,
  taskId: Id<"tasks">,
  now = Date.now(),
): Promise<{ success: true; id: Id<"tasks"> }> {
  const task = await db.get(taskId);
  if (!task || task.ownerId !== ownerId || task.deletedAt !== undefined) {
    throw new Error("Task not found");
  }
  const effects = await liveEffectsForTask(db, ownerId, taskId);
  for (const effect of effects) {
    if (effect.applied) {
      await changeQuantity(db, ownerId, effect.resourceId, -effect.delta, now);
    }
    await db.patch(effect._id, { deletedAt: now });
  }
  await db.patch(taskId, { resourceEffect: undefined });
  return { success: true, id: taskId };
}
