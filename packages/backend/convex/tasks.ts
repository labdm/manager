import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { findCurrentUser, requireUser } from "./users";
import * as taskService from "./lib/taskService";

/** Tasks owned by the signed-in user. Signed-out callers get an empty list. */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const user = await findCurrentUser(ctx);
    if (!user) return [];
    return await taskService.listTasks(ctx.db, user._id);
  },
});

export const create = mutation({
  args: {
    title: v.string(),
    dueAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    return await taskService.createTask(ctx.db, user._id, {
      title: args.title,
      dueAt: args.dueAt,
    });
  },
});

export const toggle = mutation({
  args: { id: v.id("tasks") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    return await taskService.toggleTask(ctx.db, user._id, args.id);
  },
});

