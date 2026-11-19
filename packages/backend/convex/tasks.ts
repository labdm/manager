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

/**
 * Sets a task's completion state explicitly.
 *
 * The Apple client shows a checkbox rather than a toggle, so a late retry or a
 * double tap must not flip the opposite way. `toggle` stays for the web UI.
 */
export const setDone = mutation({
  args: { id: v.id("tasks"), done: v.boolean() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    return await taskService.setTaskDone(ctx.db, user._id, args.id, args.done);
  },
});

export const remove = mutation({
  args: { id: v.id("tasks") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    return await taskService.deleteTask(ctx.db, user._id, args.id);
  },
});

