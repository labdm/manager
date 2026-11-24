import { v } from "convex/values";
import { mutation, query, type DatabaseReader } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { findCurrentUser, requireUser } from "./users";
import { normalizeTitle } from "./lib/taskFields";

function slugify(name: string): string {
  return (
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "category"
  );
}

async function uniqueSlug(
  db: DatabaseReader,
  ownerId: Id<"users">,
  name: string,
): Promise<string> {
  const base = slugify(name);
  const rows = await db
    .query("categories")
    .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
    .collect();
  const used = new Set(rows.map((row) => row.slug));
  if (!used.has(base)) return base;
  let suffix = 2;
  while (used.has(`${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
}

function optionalString(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

export const list = query({
  args: {},
  handler: async (ctx) => {
    const user = await findCurrentUser(ctx);
    if (!user) return [];
    const rows = await ctx.db
      .query("categories")
      .withIndex("by_owner", (q) => q.eq("ownerId", user._id))
      .collect();
    return rows
      .filter((row) => row.deletedAt === undefined)
      .sort((a, b) => a.name.localeCompare(b.name));
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    icon: v.optional(v.string()),
    color: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const name = normalizeTitle(args.name);
    return await ctx.db.insert("categories", {
      ownerId: user._id,
      name,
      slug: await uniqueSlug(ctx.db, user._id, name),
      icon: optionalString(args.icon),
      color: optionalString(args.color),
      deletedAt: undefined,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("categories"),
    name: v.optional(v.string()),
    icon: v.optional(v.string()),
    color: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const row = await ctx.db.get(args.id);
    if (!row || row.ownerId !== user._id || row.deletedAt !== undefined) {
      throw new Error("Category not found");
    }
    const patch: Partial<Doc<"categories">> = {};
    const name = optionalString(args.name);
    if (name !== undefined) patch.name = normalizeTitle(name);
    const icon = optionalString(args.icon);
    if (icon !== undefined) patch.icon = icon;
    const color = optionalString(args.color);
    if (color !== undefined) patch.color = color;
    await ctx.db.patch(args.id, patch);
    return await ctx.db.get(args.id);
  },
});

/** Soft delete. The row stays for views that still point at it. */
export const remove = mutation({
  args: { id: v.id("categories") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const row = await ctx.db.get(args.id);
    if (!row || row.ownerId !== user._id || row.deletedAt !== undefined) {
      throw new Error("Category not found");
    }
    await ctx.db.patch(args.id, { deletedAt: Date.now() });
    return { success: true, id: args.id };
  },
});
