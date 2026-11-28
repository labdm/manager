import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  internalMutation,
  internalQuery,
  mutation,
  type MutationCtx,
} from "./_generated/server";
import { nextReminderAt, periodId, readRoutine, DEFAULT_TIMEZONE } from "./lib/routinePeriod";
import { requireUser } from "./users";

export const subscribe = mutation({
  args: {
    endpoint: v.string(),
    p256dh: v.string(),
    auth: v.string(),
    expirationTime: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const endpoint = args.endpoint.trim();
    if (!endpoint || !args.p256dh.trim() || !args.auth.trim()) {
      throw new Error("Invalid push subscription");
    }
    const existing = await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_endpoint", (q) => q.eq("endpoint", endpoint))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, {
        ownerId: user._id,
        p256dh: args.p256dh,
        auth: args.auth,
        expirationTime: args.expirationTime,
      });
      return { id: existing._id };
    }
    const id = await ctx.db.insert("pushSubscriptions", {
      ownerId: user._id,
      endpoint,
      p256dh: args.p256dh,
      auth: args.auth,
      expirationTime: args.expirationTime,
      createdAt: Date.now(),
    });
    return { id };
  },
});

export const unsubscribe = mutation({
  args: { endpoint: v.string() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const existing = await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_endpoint", (q) => q.eq("endpoint", args.endpoint))
      .unique();
    if (existing && existing.ownerId === user._id) await ctx.db.delete(existing._id);
    return { success: true };
  },
});

export const sendTest = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const subs = await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_owner", (q) => q.eq("ownerId", user._id))
      .collect();
    if (subs.length === 0) throw new Error("No push subscription");
    await ctx.scheduler.runAfter(0, internal.pushNode.sendToUser, {
      userId: user._id,
      title: "Manager",
      body: "Test notification",
      url: "/",
    });
    return { scheduled: subs.length };
  },
});

export const listForUser = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_owner", (q) => q.eq("ownerId", args.userId))
      .collect();
    return rows.map((row) => ({
      id: row._id,
      endpoint: row.endpoint,
      p256dh: row.p256dh,
      auth: row.auth,
    }));
  },
});

export const removeSubscription = internalMutation({
  args: { id: v.id("pushSubscriptions") },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.id);
    if (row) await ctx.db.delete(args.id);
  },
});

export async function armReminder(
  ctx: MutationCtx,
  task: { id: Id<"tasks">; remindAt?: number },
): Promise<void> {
  if (task.remindAt === undefined || task.remindAt <= Date.now()) return;
  await ctx.scheduler.runAt(task.remindAt, internal.push.deliverOne, {
    taskId: task.id,
    remindAt: task.remindAt,
  });
}

async function claimReminder(
  ctx: MutationCtx,
  taskId: Id<"tasks">,
  expectedRemindAt: number,
): Promise<boolean> {
  const task = await ctx.db.get(taskId);
  if (!task || task.deletedAt !== undefined) return false;
  if (task.remindAt !== expectedRemindAt) return false;
  if (task.remindedAt === expectedRemindAt) return false;
  const routine = readRoutine(task);
  const zone = task.routineTimezone || DEFAULT_TIMEZONE;
  const current = routine.kind === "none" ? null : periodId(routine, Date.now(), zone);
  let alreadyDone = routine.kind === "none" && task.done === true;
  if (current) {
    const rows = await ctx.db
      .query("taskCompletions")
      .withIndex("by_task_period", (q) => q.eq("taskId", task._id).eq("periodId", current))
      .collect();
    alreadyDone = rows.length > 0;
    const storedDone = rows.length > 0;
    if (task.done !== storedDone) {
      await ctx.db.patch(task._id, {
        done: storedDone,
        completedAt: storedDone ? task.completedAt : undefined,
      });
    }
  }
  await ctx.db.patch(task._id, { remindedAt: expectedRemindAt });
  if (task.remindMinutes !== undefined && routine.kind !== "none") {
    const next = nextReminderAt(
      expectedRemindAt + 1,
      zone,
      { ...routine, anchorOn: task.routineAnchor },
      task.remindMinutes,
    );
    await ctx.db.patch(task._id, { remindAt: next, remindedAt: expectedRemindAt });
    await ctx.scheduler.runAt(next, internal.push.deliverOne, {
      taskId: task._id,
      remindAt: next,
    });
  }
  if (alreadyDone) return true;
  await ctx.scheduler.runAfter(0, internal.pushNode.sendToUser, {
    userId: task.ownerId,
    title: task.title,
    body: "Reminder",
    url: `/?task=${task._id}`,
  });
  return true;
}

export const deliverOne = internalMutation({
  args: { taskId: v.id("tasks"), remindAt: v.number() },
  handler: async (ctx, args) => {
    await claimReminder(ctx, args.taskId, args.remindAt);
  },
});

export const deliverDue = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const tasks = await ctx.db.query("tasks").collect();
    for (const task of tasks) {
      if (task.deletedAt !== undefined || task.remindAt === undefined) continue;
      if (task.remindAt > now) continue;
      await claimReminder(ctx, task._id, task.remindAt);
    }
  },
});
