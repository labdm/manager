import type { DatabaseReader, DatabaseWriter } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import {
  assertCanWriteGroup,
  readableDocs,
  resolveGroupId,
} from "./groupService";
import { normalizeTitle } from "./taskFields";

export const HOME_VIEW = {
  title: "Home",
  icon: "house",
  color: "sky",
} as const;

export const COMPUTED_VIEWS = {
  new: { title: "New", icon: "sparkles", color: "violet" },
  high: { title: "High priority", icon: "flame", color: "orange" },
  today: { title: "Today", icon: "sun", color: "amber" },
} as const;

export type ComputedKey = keyof typeof COMPUTED_VIEWS;

export const TEMPLATES = [
  { slug: "household", name: "Household", icon: "house", color: "amber", drawing: "row" },
  { slug: "health", name: "Health", icon: "heart-pulse", color: "rose", drawing: "row" },
  { slug: "body", name: "Body", icon: "dumbbell", color: "orange", drawing: "card" },
  { slug: "relationships", name: "Relationships", icon: "users", color: "pink", drawing: "card" },
  { slug: "work", name: "Work", icon: "briefcase-business", color: "blue", drawing: "row" },
  { slug: "projects", name: "Projects", icon: "folder-kanban", color: "violet", drawing: "card" },
  { slug: "money", name: "Money", icon: "wallet", color: "green", drawing: "row" },
  { slug: "admin", name: "Admin", icon: "clipboard-list", color: "gray", drawing: "row" },
  { slug: "learning", name: "Learning", icon: "graduation-cap", color: "indigo", drawing: "card" },
  { slug: "social", name: "Social", icon: "messages-square", color: "cyan", drawing: "card" },
  { slug: "creative", name: "Creative", icon: "palette", color: "fuchsia", drawing: "card" },
] as const;

export const SUBJECT_TYPES = new Set([
  "task",
  "progression",
  "quest",
  "event",
  "category",
]);
export const TARGET_TYPES = new Set([
  "category",
  "event",
  "quest",
  "progression",
  "space",
]);

export function isComputedKey(value: string): value is ComputedKey {
  return value === "new" || value === "high" || value === "today";
}

export async function ownerViews(
  db: DatabaseReader,
  ownerId: Id<"users">,
): Promise<Doc<"views">[]> {
  const views = await readableDocs(db, ownerId, "views");
  return views.filter((view) => view.deletedAt === undefined);
}

/** Home exists for every group the person can read. It is never deleted. */
export async function ensureHome(
  db: DatabaseWriter,
  ownerId: Id<"users">,
  groupId?: Id<"spaces">,
): Promise<Doc<"views">> {
  const resolved = await resolveGroupId(db, ownerId, groupId);
  const views = await ownerViews(db, ownerId);
  const home = views.find(
    (view) => view.kind === "home" && view.groupId === resolved,
  );
  if (home) return home;
  await assertCanWriteGroup(db, ownerId, resolved);
  const id = await db.insert("views", {
    ownerId,
    groupId: resolved,
    title: HOME_VIEW.title,
    icon: HOME_VIEW.icon,
    color: HOME_VIEW.color,
    kind: "home",
    deletedAt: undefined,
  });
  const created = await db.get(id);
  if (!created) throw new Error("View not found");
  return created;
}

export async function installTemplate(
  db: DatabaseWriter,
  ownerId: Id<"users">,
  slug: string,
  groupId?: Id<"spaces">,
): Promise<Doc<"views">> {
  const template = TEMPLATES.find((row) => row.slug === slug);
  if (!template) throw new Error("Unknown template");
  const resolved = await resolveGroupId(db, ownerId, groupId);
  await assertCanWriteGroup(db, ownerId, resolved);

  const categories = await readableDocs(db, ownerId, "categories");
  let category = categories.find(
    (row) =>
      row.slug === slug &&
      row.groupId === resolved &&
      row.deletedAt === undefined,
  );
  if (!category) {
    const categoryId = await db.insert("categories", {
      ownerId,
      groupId: resolved,
      name: template.name,
      slug: template.slug,
      hidden: false,
      icon: template.icon,
      color: template.color,
      presentationId: template.drawing,
      deletedAt: undefined,
    });
    const created = await db.get(categoryId);
    if (!created) throw new Error("Category not found");
    category = created;
  }

  const views = await ownerViews(db, ownerId);
  const existing = views.find(
    (view) =>
      view.kind === "template" &&
      view.groupId === resolved &&
      view.categoryId === category!._id,
  );
  if (existing) return existing;

  const viewId = await db.insert("views", {
    ownerId,
    groupId: resolved,
    title: template.name,
    icon: template.icon,
    color: template.color,
    kind: "template",
    categoryId: category._id,
    deletedAt: undefined,
  });
  const view = await db.get(viewId);
  if (!view) throw new Error("View not found");
  return view;
}

export async function createCustomView(
  db: DatabaseWriter,
  ownerId: Id<"users">,
  input: { title: string; icon?: string; color?: string; groupId?: Id<"spaces"> },
): Promise<Doc<"views">> {
  const groupId = await resolveGroupId(db, ownerId, input.groupId);
  await assertCanWriteGroup(db, ownerId, groupId);
  const viewId = await db.insert("views", {
    ownerId,
    groupId,
    title: normalizeTitle(input.title),
    icon: input.icon,
    color: input.color,
    kind: "custom",
    deletedAt: undefined,
  });
  const view = await db.get(viewId);
  if (!view) throw new Error("View not found");
  return view;
}

export async function enableComputedView(
  db: DatabaseWriter,
  ownerId: Id<"users">,
  key: string,
  groupId?: Id<"spaces">,
): Promise<Doc<"views">> {
  if (!isComputedKey(key)) throw new Error("Invalid computed key");
  const resolved = await resolveGroupId(db, ownerId, groupId);
  await assertCanWriteGroup(db, ownerId, resolved);
  const views = await ownerViews(db, ownerId);
  const existing = views.find(
    (view) => view.computedKey === key && view.groupId === resolved,
  );
  if (existing) return existing;
  const seed = COMPUTED_VIEWS[key];
  const viewId = await db.insert("views", {
    ownerId,
    groupId: resolved,
    title: seed.title,
    icon: seed.icon,
    color: seed.color,
    kind: "computed",
    computedKey: key,
    filter: { key },
    deletedAt: undefined,
  });
  const view = await db.get(viewId);
  if (!view) throw new Error("View not found");
  return view;
}

export async function removeView(
  db: DatabaseWriter,
  ownerId: Id<"users">,
  viewId: Id<"views">,
): Promise<{ success: true; id: Id<"views"> }> {
  const view = await db.get(viewId);
  if (!view || view.deletedAt !== undefined) {
    throw new Error("View not found");
  }
  await assertCanWriteGroup(db, ownerId, view.groupId);
  if (view.kind === "home") throw new Error("Home cannot be deleted");
  await db.patch(viewId, { deletedAt: Date.now() });
  return { success: true, id: viewId };
}

export function viewSummary(view: Doc<"views">) {
  return {
    id: String(view._id),
    title: view.title,
    icon: view.icon ?? null,
    color: view.color ?? null,
    kind: view.kind,
  };
}
