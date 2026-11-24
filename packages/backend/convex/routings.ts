import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation, mutation, query } from "./_generated/server";
import { findCurrentUser, requireUser } from "./users";
import {
  createRouting,
  listRoutings,
  removeRouting,
  runCronRouting,
} from "./lib/routingService";
import { routingExecution, routingTrigger } from "./schema";

export const create = mutation({
  args: {
    name: v.string(),
    trigger: routingTrigger,
    execution: routingExecution,
    groupId: v.optional(v.id("spaces")),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    return await createRouting(ctx.db, user._id, args);
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    const user = await findCurrentUser(ctx);
    if (!user) return [];
    return await listRoutings(ctx.db, user._id);
  },
});

export const remove = mutation({
  args: { id: v.id("routings") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    return await removeRouting(ctx.db, user._id, args.id);
  },
});

/** One routing runs in its own transaction, so one failure cannot block the tick. */
export const runOne = internalMutation({
  args: { routingId: v.id("routings") },
  handler: async (ctx, args) => {
    const routing = await ctx.db.get(args.routingId);
    if (!routing || routing.deletedAt !== undefined || routing.trigger.type !== "cron") {
      return { ran: false };
    }
    return await runCronRouting(ctx.db, routing);
  },
});

/** The cron calls this beside recurrence reconcile. */
export const runDue = internalMutation({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("routings").collect();
    const due = rows.filter(
      (row) => row.deletedAt === undefined && row.trigger.type === "cron",
    );
    for (const row of due) {
      await ctx.scheduler.runAfter(0, internal.routings.runOne, {
        routingId: row._id,
      });
    }
    return { scheduled: due.length };
  },
});
