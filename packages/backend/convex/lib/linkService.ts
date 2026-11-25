import type { DatabaseWriter } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { assertCanWriteGroup, readableGroupIds } from "./groupService";
import { SUBJECT_TYPES, TARGET_TYPES } from "./viewService";

function assertSubjectType(type: string): void {
  if (!SUBJECT_TYPES.has(type)) throw new Error("Invalid subject type");
}

function assertTargetType(type: string): void {
  if (!TARGET_TYPES.has(type)) throw new Error("Invalid target type");
}

const GROUPED_TABLES: Record<string, "tasks" | "progressions" | "quests" | "events" | "categories"> = {
  task: "tasks",
  progression: "progressions",
  quest: "quests",
  event: "events",
  category: "categories",
};

async function groupForRef(
  db: DatabaseWriter,
  type: string,
  id: string,
): Promise<Id<"spaces"> | null> {
  if (type === "space") return id as Id<"spaces">;
  const table = GROUPED_TABLES[type];
  if (!table) return null;
  const row = (await db.get(id as never)) as { groupId?: Id<"spaces"> } | null;
  return row?.groupId ?? null;
}

/** Links cannot bridge groups. One group per item, visibility one hop. */
async function assertSameGroup(
  db: DatabaseWriter,
  ownerId: Id<"users">,
  subjectType: string,
  subjectId: string,
  targetType: string,
  targetId: string,
): Promise<Id<"spaces">> {
  const subjectGroup = await groupForRef(db, subjectType, subjectId);
  const targetGroup = await groupForRef(db, targetType, targetId);
  if (!subjectGroup || !targetGroup || subjectGroup !== targetGroup) {
    throw new Error("Invalid attachment group");
  }
  const groups = await readableGroupIds(db, ownerId);
  if (!groups.has(String(subjectGroup))) throw new Error("Invalid attachment group");
  await assertCanWriteGroup(db, ownerId, subjectGroup);
  return subjectGroup;
}

export async function attach(
  db: DatabaseWriter,
  ownerId: Id<"users">,
  input: {
    subjectType: string;
    subjectId: string;
    targetType: string;
    targetId: string;
    role?: string;
  },
): Promise<Doc<"attachments">> {
  assertSubjectType(input.subjectType);
  assertTargetType(input.targetType);
  const role = input.role ?? "extra";
  if (role !== "primary" && role !== "extra") {
    throw new Error("Invalid role");
  }
  await assertSameGroup(
    db,
    ownerId,
    input.subjectType,
    input.subjectId,
    input.targetType,
    input.targetId,
  );
  const id = await db.insert("attachments", {
    ownerId,
    subjectType: input.subjectType,
    subjectId: input.subjectId,
    targetType: input.targetType,
    targetId: input.targetId,
    role,
    deletedAt: undefined,
  });
  const created = await db.get(id);
  if (!created) throw new Error("Attachment not found");
  return created;
}

export async function detach(
  db: DatabaseWriter,
  ownerId: Id<"users">,
  attachmentId: Id<"attachments">,
): Promise<{ success: true; id: Id<"attachments"> }> {
  const row = await db.get(attachmentId);
  if (!row || row.ownerId !== ownerId || row.deletedAt !== undefined) {
    throw new Error("Attachment not found");
  }
  await db.patch(attachmentId, { deletedAt: Date.now() });
  return { success: true, id: attachmentId };
}

async function ownedView(
  db: DatabaseWriter,
  ownerId: Id<"users">,
  viewId: Id<"views">,
): Promise<Doc<"views">> {
  const view = await db.get(viewId);
  if (!view || view.ownerId !== ownerId || view.deletedAt !== undefined) {
    throw new Error("View not found");
  }
  return view;
}

/** A pin or override cannot name a row the caller cannot read. */
async function assertVisibleSubject(
  db: DatabaseWriter,
  ownerId: Id<"users">,
  view: Doc<"views">,
  subjectType: string,
  subjectId: string,
): Promise<void> {
  const groupId = await groupForRef(db, subjectType, subjectId);
  if (!groupId) throw new Error("Invalid subject group");
  const groups = await readableGroupIds(db, ownerId);
  if (!groups.has(String(groupId)) || String(view.groupId) !== String(groupId)) {
    throw new Error("Invalid subject group");
  }
}

export async function pin(
  db: DatabaseWriter,
  ownerId: Id<"users">,
  input: { viewId: Id<"views">; subjectType: string; subjectId: string },
): Promise<Doc<"viewPins">> {
  const view = await ownedView(db, ownerId, input.viewId);
  assertSubjectType(input.subjectType);
  await assertVisibleSubject(db, ownerId, view, input.subjectType, input.subjectId);
  const rows = await db
    .query("viewPins")
    .withIndex("by_owner_view", (q) =>
      q.eq("ownerId", ownerId).eq("viewId", input.viewId),
    )
    .collect();
  const existing = rows.find(
    (row) =>
      row.deletedAt === undefined &&
      row.subjectType === input.subjectType &&
      row.subjectId === input.subjectId,
  );
  if (existing) return existing;
  const id = await db.insert("viewPins", {
    ownerId,
    viewId: input.viewId,
    subjectType: input.subjectType,
    subjectId: input.subjectId,
    deletedAt: undefined,
  });
  const created = await db.get(id);
  if (!created) throw new Error("Pin not found");
  return created;
}

export async function unpin(
  db: DatabaseWriter,
  ownerId: Id<"users">,
  input: { viewId: Id<"views">; subjectType: string; subjectId: string },
): Promise<{ success: true }> {
  await ownedView(db, ownerId, input.viewId);
  const rows = await db
    .query("viewPins")
    .withIndex("by_owner_view", (q) =>
      q.eq("ownerId", ownerId).eq("viewId", input.viewId),
    )
    .collect();
  const row = rows.find(
    (item) =>
      item.deletedAt === undefined &&
      item.subjectType === input.subjectType &&
      item.subjectId === input.subjectId,
  );
  if (row) await db.patch(row._id, { deletedAt: Date.now() });
  return { success: true };
}

export async function setOverride(
  db: DatabaseWriter,
  ownerId: Id<"users">,
  input: {
    viewId: Id<"views">;
    subjectType: string;
    subjectId: string;
    mode: string;
  },
): Promise<Doc<"viewOverrides">> {
  const view = await ownedView(db, ownerId, input.viewId);
  assertSubjectType(input.subjectType);
  await assertVisibleSubject(db, ownerId, view, input.subjectType, input.subjectId);
  if (input.mode !== "include" && input.mode !== "exclude") {
    throw new Error("Invalid override mode");
  }
  const rows = await db
    .query("viewOverrides")
    .withIndex("by_owner_view", (q) =>
      q.eq("ownerId", ownerId).eq("viewId", input.viewId),
    )
    .collect();
  const existing = rows.find(
    (row) =>
      row.deletedAt === undefined &&
      row.subjectType === input.subjectType &&
      row.subjectId === input.subjectId,
  );
  if (existing) {
    await db.patch(existing._id, { mode: input.mode });
    const updated = await db.get(existing._id);
    if (!updated) throw new Error("Override not found");
    return updated;
  }
  const id = await db.insert("viewOverrides", {
    ownerId,
    viewId: input.viewId,
    subjectType: input.subjectType,
    subjectId: input.subjectId,
    mode: input.mode,
    deletedAt: undefined,
  });
  const created = await db.get(id);
  if (!created) throw new Error("Override not found");
  return created;
}

export async function clearOverride(
  db: DatabaseWriter,
  ownerId: Id<"users">,
  input: { viewId: Id<"views">; subjectType: string; subjectId: string },
): Promise<{ success: true }> {
  await ownedView(db, ownerId, input.viewId);
  const rows = await db
    .query("viewOverrides")
    .withIndex("by_owner_view", (q) =>
      q.eq("ownerId", ownerId).eq("viewId", input.viewId),
    )
    .collect();
  const row = rows.find(
    (item) =>
      item.deletedAt === undefined &&
      item.subjectType === input.subjectType &&
      item.subjectId === input.subjectId,
  );
  if (row) await db.patch(row._id, { deletedAt: Date.now() });
  return { success: true };
}
