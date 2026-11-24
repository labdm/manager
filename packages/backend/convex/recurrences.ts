import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { findCurrentUser, requireUser } from "./users";
import { applyOverdueForOwner } from "./lib/overdueService";
import {
  createRecurrence,
  listRecurrences,
  reconcileOwner,
} from "./lib/recurrenceService";

export const create = mutation({
  args: {
    behavior: v.union(v.literal("replace"), v.literal("stack")),
    cadence: v.string(),
    timezone: v.string(),
    title: v.string(),
    notes: v.optional(v.string()),
    plannedTime: v.optional(v.number()),
    location: v.optional(v.string()),
    priority: v.optional(v.string()),
    overduePolicy: v.optional(v.string()),
    presentation: v.optional(v.string()),
    resourceEffect: v.optional(
      v.object({ resourceId: v.id("resources"), delta: v.number() }),
    ),
    anchorOn: v.optional(v.number()),
    groupId: v.optional(v.id("spaces")),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    return await createRecurrence(ctx.db, user._id, args);
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    const user = await findCurrentUser(ctx);
    if (!user) return [];
    return await listRecurrences(ctx.db, user._id);
  },
});

/** Idempotent lazy mint for a signed-in user. The cron does this when closed. */
export const reconcile = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    await reconcileOwner(ctx.db, user._id);
    return { success: true };
  },
});

/** One sweep for every user. Called by the cron, never by a client. */
export const reconcileAll = internalMutation({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    const now = Date.now();
    for (const user of users) {
      await reconcileOwner(ctx.db, user._id, now);
      await applyOverdueForOwner(ctx.db, user._id, now);
    }
    return { users: users.length };
  },
});
