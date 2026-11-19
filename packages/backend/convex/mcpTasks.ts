import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { assertMcpRoleProof } from "./lib/mcpRoleSignature";
import { assertDueAt, normalizeTitle } from "./lib/taskFields";

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

async function requireMcpUser(
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

  if (!user) throw new Error("User required");
  return user;
}

function taskView(task: Doc<"tasks">) {
  return {
    id: task._id,
    title: task.title,
    done: task.done,
    dueAt: task.dueAt ?? null,
    ownerId: task.ownerId,
  };
}

export const list = query({
  args: proofArgs,
  handler: async (ctx, args) => {
    const user = await requireMcpUser(ctx, args);
    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_owner", (q) => q.eq("ownerId", user._id))
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
    const user = await requireMcpUser(ctx, args);
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

export const complete = mutation({
  args: {
    ...proofArgs,
    id: v.id("tasks"),
  },
  handler: async (ctx, args) => {
    const user = await requireMcpUser(ctx, args);
    const task = await ctx.db.get(args.id);
    if (!task || task.ownerId !== user._id) throw new Error("Task not found");
    await ctx.db.patch(task._id, { done: true });
    return taskView({ ...task, done: true });
  },
});
