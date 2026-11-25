import type { DatabaseReader, DatabaseWriter } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import {
  assertCanWriteGroup,
  readableDocs,
  readableGroupIds,
  resolveGroupId,
} from "./groupService";
import { normalizeTitle } from "./taskFields";

function slugify(name: string): string {
  return (
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "category"
  );
}

function optionalString(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

async function uniqueSlug(
  db: DatabaseReader,
  groupId: Id<"spaces">,
  name: string,
): Promise<string> {
  const base = slugify(name);
  const rows = await db
    .query("categories")
    .withIndex("by_group", (q) => q.eq("groupId", groupId))
    .collect();
  const used = new Set(rows.map((row) => row.slug));
  if (!used.has(base)) return base;
  let suffix = 2;
  while (used.has(`${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
}

export async function listCategories(
  db: DatabaseReader,
  userId: Id<"users">,
): Promise<Doc<"categories">[]> {
  const rows = await readableDocs(db, userId, "categories");
  return rows
    .filter((row) => row.deletedAt === undefined)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function createCategory(
  db: DatabaseWriter,
  userId: Id<"users">,
  input: { name: string; icon?: string; color?: string; groupId?: Id<"spaces"> },
): Promise<Doc<"categories">> {
  const groupId = await resolveGroupId(db, userId, input.groupId);
  await assertCanWriteGroup(db, userId, groupId);
  const name = normalizeTitle(input.name);
  const id = await db.insert("categories", {
    ownerId: userId,
    groupId,
    name,
    slug: await uniqueSlug(db, groupId, name),
    icon: optionalString(input.icon),
    color: optionalString(input.color),
    deletedAt: undefined,
  });
  const created = await db.get(id);
  if (!created) throw new Error("Category not found");
  return created;
}

export async function updateCategory(
  db: DatabaseWriter,
  userId: Id<"users">,
  categoryId: Id<"categories">,
  input: { name?: string; icon?: string; color?: string },
): Promise<Doc<"categories">> {
  const row = await db.get(categoryId);
  if (!row || row.deletedAt !== undefined) throw new Error("Category not found");
  await assertCanWriteGroup(db, userId, row.groupId);
  const patch: Partial<Doc<"categories">> = {};
  const name = optionalString(input.name);
  if (name !== undefined) patch.name = normalizeTitle(name);
  const icon = optionalString(input.icon);
  if (icon !== undefined) patch.icon = icon;
  const color = optionalString(input.color);
  if (color !== undefined) patch.color = color;
  await db.patch(categoryId, patch);
  const updated = await db.get(categoryId);
  if (!updated) throw new Error("Category not found");
  return updated;
}

export async function removeCategory(
  db: DatabaseWriter,
  userId: Id<"users">,
  categoryId: Id<"categories">,
  now = Date.now(),
): Promise<{ success: true; id: Id<"categories"> }> {
  const row = await db.get(categoryId);
  if (!row || row.deletedAt !== undefined) throw new Error("Category not found");
  await assertCanWriteGroup(db, userId, row.groupId);
  await db.patch(categoryId, { deletedAt: now });
  return { success: true, id: categoryId };
}

/** Used by template installs, which also need the caller's readable groups. */
export async function groupSlugsInScope(
  db: DatabaseReader,
  userId: Id<"users">,
): Promise<Set<string>> {
  const groups = await readableGroupIds(db, userId);
  const rows = await db.query("categories").collect();
  return new Set(
    rows
      .filter((row) => row.deletedAt === undefined && groups.has(String(row.groupId)))
      .map((row) => row.slug),
  );
}
