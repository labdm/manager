import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { findCurrentUser, requireUser } from "./users";
import {
  createCategory,
  listCategories,
  removeCategory,
  updateCategory,
} from "./lib/categoryService";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const user = await findCurrentUser(ctx);
    if (!user) return [];
    return await listCategories(ctx.db, user._id);
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    icon: v.optional(v.string()),
    color: v.optional(v.string()),
    groupId: v.optional(v.id("spaces")),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    return await createCategory(ctx.db, user._id, args);
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
    const { id, ...patch } = args;
    return await updateCategory(ctx.db, user._id, id, patch);
  },
});

/** Soft delete. The row stays for views that still point at it. */
export const remove = mutation({
  args: { id: v.id("categories") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    return await removeCategory(ctx.db, user._id, args.id);
  },
});
