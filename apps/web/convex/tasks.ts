import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { assertMcpRoleProof } from "./lib/mcpRoleSignature";

const proofArgs = {
  clerkUserId: v.string(),
  expiresAt: v.number(),
  signature: v.string(),
};

type Proof = {
  clerkUserId: string;
  expiresAt: number;
  signature: string;
};

const TITLE_MAX = 200;

async function requireMcpAdmin(
  ctx: QueryCtx | MutationCtx,
  args: Proof,
): Promise<Doc<"users">> {
  await assertMcpRoleProof(args);
  const issuer = process.env.CLERK_FRONTEND_API_URL?.trim() ?? "";
  if (!issuer) throw new Error("CLERK_FRONTEND_API_URL is not set");
  if (issuer.endsWith("/")) {
    throw new Error("CLERK_FRONTEND_API_URL must not have a trailing slash");
  }

  const user = await ctx.db
    .query("users")
    .withIndex("by_token", (q) =>
      q.eq("tokenIdentifier", `${issuer}|${args.clerkUserId}`),
    )
    .unique();

  if (!user || user.role !== "admin") throw new Error("Admin required");
  return user;
}

function taskView(task: Doc<"tasks">) {
  return {
    id: task._id,
    title: task.title,
    done: task.done,
    dueAt: task.dueAt ?? null,
    createdBy: task.createdBy,
  };
}

export const list = query({
  args: proofArgs,
  handler: async (ctx, args) => {
    const user = await requireMcpAdmin(ctx, args);
    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_createdBy", (q) => q.eq("createdBy", user._id))
      .collect();
    tasks.sort((a, b) => b._creationTime - a._creationTime);
    return tasks.map(taskView);
  },
});

export const create = mutation({
  args: {
    ...proofArgs,
    title: v.string(),
    dueAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireMcpAdmin(ctx, args);
    const title = args.title.trim();
    if (!title || title.length > TITLE_MAX) throw new Error("Title is required");
    if (args.dueAt !== undefined && !Number.isSafeInteger(args.dueAt)) {
      throw new Error("Invalid dueAt");
    }
    const id = await ctx.db.insert("tasks", {
      title,
      done: false,
      dueAt: args.dueAt,
      createdBy: user._id,
    });
    const task = await ctx.db.get(id);
    if (!task) throw new Error("Task not found");
    return taskView(task);
  },
});

export const complete = mutation({
  args: {
    ...proofArgs,
    id: v.id("tasks"),
  },
  handler: async (ctx, args) => {
    const user = await requireMcpAdmin(ctx, args);
    const task = await ctx.db.get(args.id);
    if (!task || task.createdBy !== user._id) throw new Error("Task not found");
    await ctx.db.patch(task._id, { done: true });
    return taskView({ ...task, done: true });
  },
});
