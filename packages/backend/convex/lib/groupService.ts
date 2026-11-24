import type { DatabaseReader, DatabaseWriter } from "../_generated/server";
import type { Doc, Id, TableNames } from "../_generated/dataModel";
import { normalizeTitle } from "./taskFields";

export type MemberRole = Doc<"spaceMembers">["role"];

/**
 * A group is an organization. The screen says Group; the schema keeps the
 * planned `spaces` / `spaceMembers` names. Every person gets one default
 * group inside the user upsert, on the same code path as any other group.
 */
export async function createDefaultGroup(
  db: DatabaseWriter,
  userId: Id<"users">,
  now = Date.now(),
): Promise<Doc<"spaces">> {
  const id = await db.insert("spaces", {
    ownerId: userId,
    name: "Personal",
    isDefault: true,
    deletedAt: undefined,
    createdAt: now,
  });
  await db.insert("spaceMembers", {
    spaceId: id,
    userId,
    role: "owner",
    canInvite: true,
    deletedAt: undefined,
    createdAt: now,
  });
  const created = await db.get(id);
  if (!created) throw new Error("Group not found");
  return created;
}

export async function defaultGroupForUser(
  db: DatabaseReader,
  userId: Id<"users">,
): Promise<Doc<"spaces">> {
  const rows = await db
    .query("spaces")
    .withIndex("by_owner", (q) => q.eq("ownerId", userId))
    .collect();
  const group = rows.find(
    (row) => row.isDefault && row.deletedAt === undefined,
  );
  if (!group) throw new Error("Default group not found");
  return group;
}

/** Resolves the one group id on an item. There is no group-less item. */
export async function resolveGroupId(
  db: DatabaseReader,
  userId: Id<"users">,
  requested?: Id<"spaces">,
): Promise<Id<"spaces">> {
  return requested ?? (await defaultGroupForUser(db, userId))._id;
}

export async function membershipFor(
  db: DatabaseReader,
  userId: Id<"users">,
  groupId: Id<"spaces">,
): Promise<Doc<"spaceMembers"> | null> {
  const rows = await db
    .query("spaceMembers")
    .withIndex("by_space_user", (q) =>
      q.eq("spaceId", groupId).eq("userId", userId),
    )
    .collect();
  return (
    rows.find((row) => row.deletedAt === undefined) ?? null
  );
}

/** Admin, including owner, can invite regardless of the stored flag. */
export function memberCanInvite(member: Doc<"spaceMembers"> | null): boolean {
  if (!member) return false;
  return (
    member.role === "owner" ||
    member.role === "admin" ||
    member.canInvite === true
  );
}

export function memberCanWrite(member: Doc<"spaceMembers"> | null): boolean {
  if (!member) return false;
  return member.role === "owner" || member.role === "admin" || member.role === "editor";
}

export async function assertCanReadGroup(
  db: DatabaseReader,
  userId: Id<"users">,
  groupId: Id<"spaces">,
): Promise<void> {
  const member = await membershipFor(db, userId, groupId);
  if (!member) throw new Error("Group not found");
}

export async function assertCanWriteGroup(
  db: DatabaseReader,
  userId: Id<"users">,
  groupId: Id<"spaces">,
): Promise<void> {
  const member = await membershipFor(db, userId, groupId);
  if (!memberCanWrite(member)) throw new Error("Group write denied");
}

export async function assertCanInvite(
  db: DatabaseReader,
  userId: Id<"users">,
  groupId: Id<"spaces">,
): Promise<void> {
  const member = await membershipFor(db, userId, groupId);
  if (!memberCanInvite(member)) throw new Error("Invite permission required");
}

/**
 * Visibility is one hop: a member sees rows attached to the group, and nothing
 * attached only to another group. Attachments never widen access.
 */
export async function readableGroupIds(
  db: DatabaseReader,
  userId: Id<"users">,
): Promise<Set<string>> {
  const defaultGroup = await defaultGroupForUser(db, userId);
  const groups = new Set<string>([String(defaultGroup._id)]);
  const memberships = await db
    .query("spaceMembers")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
  for (const member of memberships) {
    if (member.deletedAt !== undefined) continue;
    const group = await db.get(member.spaceId);
    if (group && group.deletedAt === undefined) groups.add(String(group._id));
  }
  return groups;
}

export function canRead(
  row: { groupId: Id<"spaces"> },
  groups: Set<string>,
): boolean {
  return groups.has(String(row.groupId));
}

export async function readableDocs<K extends TableNames>(
  db: DatabaseReader,
  userId: Id<"users">,
  table: K,
): Promise<Doc<K>[]> {
  const groups = await readableGroupIds(db, userId);
  const rows = await db.query(table).collect();
  return rows.filter((row) =>
    canRead(row as unknown as { groupId: Id<"spaces"> }, groups),
  ) as unknown as Doc<K>[];
}

export async function createGroup(
  db: DatabaseWriter,
  userId: Id<"users">,
  input: { name: string; icon?: string; color?: string },
  now = Date.now(),
): Promise<Doc<"spaces">> {
  const id = await db.insert("spaces", {
    ownerId: userId,
    name: normalizeTitle(input.name),
    isDefault: false,
    icon: input.icon,
    color: input.color,
    deletedAt: undefined,
    createdAt: now,
  });
  await db.insert("spaceMembers", {
    spaceId: id,
    userId,
    role: "owner",
    canInvite: true,
    deletedAt: undefined,
    createdAt: now,
  });
  const created = await db.get(id);
  if (!created) throw new Error("Group not found");
  return created;
}

export async function listGroups(
  db: DatabaseReader,
  userId: Id<"users">,
): Promise<Doc<"spaces">[]> {
  const groups = await readableGroupIds(db, userId);
  const rows = await db.query("spaces").collect();
  return rows.filter(
    (row) =>
      row.deletedAt === undefined && groups.has(String(row._id)),
  );
}

export async function renameGroup(
  db: DatabaseWriter,
  userId: Id<"users">,
  groupId: Id<"spaces">,
  input: { name?: string; icon?: string; color?: string },
): Promise<Doc<"spaces">> {
  await assertCanWriteGroup(db, userId, groupId);
  const group = await db.get(groupId);
  if (!group || group.deletedAt !== undefined) throw new Error("Group not found");
  const patch: Partial<Doc<"spaces">> = {};
  // Same path for the default group and every other group.
  if (input.name !== undefined) patch.name = normalizeTitle(input.name);
  if (input.icon !== undefined) patch.icon = input.icon;
  if (input.color !== undefined) patch.color = input.color;
  await db.patch(groupId, patch);
  const updated = await db.get(groupId);
  if (!updated) throw new Error("Group not found");
  return updated;
}

export async function removeGroup(
  db: DatabaseWriter,
  userId: Id<"users">,
  groupId: Id<"spaces">,
  now = Date.now(),
): Promise<{ success: true; id: Id<"spaces"> }> {
  await assertCanWriteGroup(db, userId, groupId);
  const group = await db.get(groupId);
  if (!group || group.deletedAt !== undefined) throw new Error("Group not found");
  if (group.isDefault) throw new Error("Default group cannot be deleted");
  await db.patch(groupId, { deletedAt: now });
  return { success: true, id: groupId };
}

export async function addMembership(
  db: DatabaseWriter,
  userId: Id<"users">,
  groupId: Id<"spaces">,
  input: { role?: MemberRole; canInvite?: boolean },
  now = Date.now(),
): Promise<Doc<"spaceMembers">> {
  const existing = await membershipFor(db, userId, groupId);
  if (existing) {
    await db.patch(existing._id, {
      deletedAt: undefined,
      role: input.role ?? existing.role,
      canInvite: input.canInvite ?? existing.canInvite,
    });
    const updated = await db.get(existing._id);
    if (!updated) throw new Error("Member not found");
    return updated;
  }
  const id = await db.insert("spaceMembers", {
    spaceId: groupId,
    userId,
    role: input.role ?? "editor",
    canInvite: input.canInvite ?? false,
    deletedAt: undefined,
    createdAt: now,
  });
  const created = await db.get(id);
  if (!created) throw new Error("Member not found");
  return created;
}

export async function listMembers(
  db: DatabaseReader,
  userId: Id<"users">,
  groupId: Id<"spaces">,
): Promise<Doc<"spaceMembers">[]> {
  await assertCanReadGroup(db, userId, groupId);
  const rows = await db
    .query("spaceMembers")
    .withIndex("by_space", (q) => q.eq("spaceId", groupId))
    .collect();
  return rows.filter((row) => row.deletedAt === undefined);
}
