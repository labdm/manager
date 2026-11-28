import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { findCurrentUser, requireUser } from "./users";
import * as taskService from "./lib/taskService";
import * as resourceService from "./lib/resourceService";
import { reconcileOwner } from "./lib/recurrenceService";
import { armReminder } from "./push";

const routineArgs = {
  routineKind: v.optional(
    v.union(
      v.literal("none"),
      v.literal("daily"),
      v.literal("weekly"),
      v.literal("monthly"),
      v.literal("interval"),
    ),
  ),
  intervalEvery: v.optional(v.number()),
  intervalUnit: v.optional(v.union(v.literal("days"), v.literal("weeks"))),
  timezone: v.optional(v.string()),
  waiting: v.optional(v.boolean()),
  waitingReason: v.optional(v.string()),
  remindMinutes: v.optional(v.number()),
};

/** Tasks owned by the signed-in user. Signed-out callers get an empty list. */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const user = await findCurrentUser(ctx);
    if (!user) return [];
    return await taskService.listTasks(ctx.db, user._id);
  },
});

/**
 * Lazy mint for clients. `list` stays a query so subscriptions keep working;
 * call this before or alongside a list to move a series forward immediately.
 * The cron covers the closed-app case.
 */
export const reconcile = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    await reconcileOwner(ctx.db, user._id);
    return { success: true };
  },
});

export const create = mutation({
  args: {
    title: v.string(),
    dueAt: v.optional(v.number()),
    notes: v.optional(v.string()),
    plannedOn: v.optional(v.number()),
    plannedTime: v.optional(v.number()),
    location: v.optional(v.string()),
    deadlineAt: v.optional(v.number()),
    remindAt: v.optional(v.number()),
    priority: v.optional(v.string()),
    priorityRank: v.optional(v.number()),
    overduePolicy: v.optional(v.string()),
    presentation: v.optional(v.string()),
    ...routineArgs,
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const created = await taskService.createTask(ctx.db, user._id, {
      ...args,
      origin: "self",
    });
    await armReminder(ctx, created);
    return created;
  },
});

export const update = mutation({
  args: {
    id: v.id("tasks"),
    title: v.optional(v.string()),
    notes: v.optional(v.string()),
    plannedOn: v.optional(v.number()),
    plannedTime: v.optional(v.number()),
    dueAt: v.optional(v.number()),
    location: v.optional(v.string()),
    deadlineAt: v.optional(v.number()),
    remindAt: v.optional(v.number()),
    priority: v.optional(v.string()),
    priorityRank: v.optional(v.number()),
    overduePolicy: v.optional(v.string()),
    presentation: v.optional(v.string()),
    done: v.optional(v.boolean()),
    ...routineArgs,
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const { id, ...patch } = args;
    const updated = await taskService.updateTask(ctx.db, user._id, id, patch);
    await armReminder(ctx, updated);
    return updated;
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
export const setWaiting = mutation({
  args: {
    id: v.id("tasks"),
    waiting: v.boolean(),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    return await taskService.setTaskWaiting(
      ctx.db,
      user._id,
      args.id,
      args.waiting,
      args.reason,
    );
  },
});

export const setDone = mutation({
  args: { id: v.id("tasks"), done: v.boolean() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    return await taskService.setTaskDone(ctx.db, user._id, args.id, args.done);
  },
});

/** Attaches the task's single stock effect. A negative delta uses stock. */
export const setResourceEffect = mutation({
  args: {
    taskId: v.id("tasks"),
    resourceId: v.id("resources"),
    delta: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    return await resourceService.setTaskResourceEffect(
      ctx.db,
      user._id,
      args.taskId,
      args.resourceId,
      args.delta,
    );
  },
});

export const clearResourceEffect = mutation({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    return await resourceService.clearTaskResourceEffect(
      ctx.db,
      user._id,
      args.taskId,
    );
  },
});

export const markSeen = mutation({
  args: { id: v.id("tasks") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    return await taskService.markTaskSeen(ctx.db, user._id, args.id);
  },
});

export const remove = mutation({
  args: { id: v.id("tasks") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    return await taskService.deleteTask(ctx.db, user._id, args.id);
  },
});
