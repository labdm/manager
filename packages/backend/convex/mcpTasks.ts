import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { assertMcpRoleProof } from "./lib/mcpRoleSignature";
import * as taskService from "./lib/taskService";
import { findUserByTokenIdentifier, upsertUserByTokenIdentifier } from "./users";

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

function mcpIssuer(): string {
  const issuer = process.env.CLERK_FRONTEND_API_URL?.trim() ?? "";
  if (!issuer) throw new Error("CLERK_FRONTEND_API_URL is not set");
  if (issuer.endsWith("/")) {
    throw new Error("CLERK_FRONTEND_API_URL must not have a trailing slash");
  }
  return issuer;
}

/** Looks up the user for queries. Returns null if user has not yet interacted with the system. */
async function findMcpUser(
  ctx: QueryCtx,
  args: Proof,
): Promise<Doc<"users"> | null> {
  await assertMcpRoleProof(args);
  const tokenIdentifier = `${mcpIssuer()}|${args.clerkUserId}`;
  return await findUserByTokenIdentifier(ctx, tokenIdentifier);
}

/** Ensures the user exists for mutations, auto-provisioning if first MCP interaction. */
async function requireMcpUser(
  ctx: MutationCtx,
  args: Proof,
): Promise<Doc<"users">> {
  await assertMcpRoleProof(args);
  const tokenIdentifier = `${mcpIssuer()}|${args.clerkUserId}`;
  return await upsertUserByTokenIdentifier(ctx, tokenIdentifier, {
    clerkUserId: args.clerkUserId,
  });
}

export const list = query({
  args: proofArgs,
  handler: async (ctx, args) => {
    const user = await findMcpUser(ctx, args);
    if (!user) return [];
    return await taskService.listTasks(ctx.db, user._id);
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
    return await taskService.createTask(ctx.db, user._id, {
      title: args.title,
      dueAt: args.dueAt,
    });
  },
});

export const complete = mutation({
  args: {
    ...proofArgs,
    id: v.id("tasks"),
  },
  handler: async (ctx, args) => {
    const user = await requireMcpUser(ctx, args);
    return await taskService.setTaskDone(ctx.db, user._id, args.id, true);
  },
});

export const reopen = mutation({
  args: {
    ...proofArgs,
    id: v.id("tasks"),
  },
  handler: async (ctx, args) => {
    const user = await requireMcpUser(ctx, args);
    return await taskService.setTaskDone(ctx.db, user._id, args.id, false);
  },
});

export const remove = mutation({
  args: {
    ...proofArgs,
    id: v.id("tasks"),
  },
  handler: async (ctx, args) => {
    const user = await requireMcpUser(ctx, args);
    return await taskService.deleteTask(ctx.db, user._id, args.id);
  },
});
