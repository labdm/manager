import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { assertDueAt, normalizeTitle } from "./lib/taskFields";
import { findCurrentUser, requireUser } from "./users";

function taskView(task: Doc<"tasks">) {
  return {
    id: task._id,
    title: task.title,
    done: task.done,
    dueAt: task.dueAt ?? null,
    ownerId: task.ownerId,
  };
}

/** Tasks owned by the signed-in user. Signed-out callers get an empty list. */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const user = await findCurrentUser(ctx);
    if (!user) return [];
    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_owner", (q) => q.eq("ownerId", user._id))
      .collect();
    tasks.sort((a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1;
      return b._creationTime - a._creationTime;
    });
    return tasks.map(taskView);
  },
});

export const create = mutation({
  args: {
    title: v.string(),
    dueAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const title = normalizeTitle(args.title);
    assertDueAt(args.dueAt);
    const id = await ctx.db.insert("tasks", {
      title,
      done: false,
      dueAt: args.dueAt,
      ownerId: user._id,
    });
    const task = await ctx.db.get(id);
    if (!task) throw new Error("Task not found");
    return taskView(task);
  },
});

export const toggle = mutation({
  args: { id: v.id("tasks") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const task = await ctx.db.get(args.id);
    if (!task || task.ownerId !== user._id) throw new Error("Task not found");
    const done = !task.done;
    await ctx.db.patch(task._id, { done });
    return taskView({ ...task, done });
  },
});
