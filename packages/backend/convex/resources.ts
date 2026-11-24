import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { findCurrentUser, requireUser } from "./users";
import * as resourceService from "./lib/resourceService";

/** Live resources for the signed-in user. Signed-out callers get an empty list. */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const user = await findCurrentUser(ctx);
    if (!user) return [];
    return await resourceService.listResources(ctx.db, user._id);
  },
});

export const create = mutation({
  args: {
    title: v.string(),
    unit: v.optional(v.string()),
    quantity: v.number(),
    lowAt: v.optional(v.number()),
    icon: v.optional(v.string()),
    color: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    return await resourceService.createResource(ctx.db, user._id, args);
  },
});

export const update = mutation({
  args: {
    id: v.id("resources"),
    title: v.optional(v.string()),
    unit: v.optional(v.string()),
    quantity: v.optional(v.number()),
    lowAt: v.optional(v.number()),
    icon: v.optional(v.string()),
    color: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const { id, ...patch } = args;
    return await resourceService.updateResource(ctx.db, user._id, id, patch);
  },
});

/** Soft delete. A removed resource keeps its row and drops its live effects. */
export const remove = mutation({
  args: { id: v.id("resources") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    return await resourceService.removeResource(ctx.db, user._id, args.id);
  },
});
