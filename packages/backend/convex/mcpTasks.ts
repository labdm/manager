import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { mutation } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { armReminder } from "./push";
import { boardSlice, type SliceTab } from "./lib/boardService";
import { assertMcpRoleProof } from "./lib/mcpRoleSignature";
import { reconcileOwner } from "./lib/recurrenceService";
import { DEFAULT_TIMEZONE } from "./lib/routinePeriod";
import * as taskService from "./lib/taskService";
import { findUserByTokenIdentifier, upsertUserByTokenIdentifier } from "./users";

export const proofArgs = {
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
export async function findMcpUser(
  ctx: QueryCtx,
  args: Proof,
): Promise<Doc<"users"> | null> {
  await assertMcpRoleProof(args);
  const tokenIdentifier = `${mcpIssuer()}|${args.clerkUserId}`;
  return await findUserByTokenIdentifier(ctx, tokenIdentifier);
}

/** Ensures the user exists for mutations, auto-provisioning if first MCP interaction. */
export async function requireMcpUser(
  ctx: MutationCtx,
  args: Proof,
): Promise<Doc<"users">> {
  await assertMcpRoleProof(args);
  const tokenIdentifier = `${mcpIssuer()}|${args.clerkUserId}`;
  return await upsertUserByTokenIdentifier(ctx, tokenIdentifier, {
    clerkUserId: args.clerkUserId,
  });
}

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

const sectionArg = v.optional(
  v.union(
    v.literal("quests"),
    v.literal("daily"),
    v.literal("weekly"),
    v.literal("monthly"),
    v.literal("events"),
  ),
);

/** Mutation so a lazy reconcile can happen before the list is returned. */
export const list = mutation({
  args: {
    ...proofArgs,
    section: sectionArg,
    timezone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireMcpUser(ctx, args);
    await reconcileOwner(ctx.db, user._id);
    await taskService.syncRoutineDoneFlags(ctx.db, user._id);
    if (!args.section) return await taskService.listTasks(ctx.db, user._id);
    const tab: SliceTab = args.section === "quests" ? "tasks" : args.section;
    const slice = await boardSlice(ctx.db, user._id, {
      tab,
      timezone: args.timezone?.trim() || DEFAULT_TIMEZONE,
    });
    return slice.tasks;
  },
});

export const create = mutation({
  args: {
    ...proofArgs,
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
    const user = await requireMcpUser(ctx, args);
    const created = await taskService.createTask(ctx.db, user._id, {
      title: args.title,
      dueAt: args.dueAt,
      notes: args.notes,
      plannedOn: args.plannedOn,
      plannedTime: args.plannedTime,
      location: args.location,
      deadlineAt: args.deadlineAt,
      remindAt: args.remindAt,
      priority: args.priority,
      priorityRank: args.priorityRank,
      overduePolicy: args.overduePolicy,
      presentation: args.presentation,
      routineKind: args.routineKind,
      intervalEvery: args.intervalEvery,
      intervalUnit: args.intervalUnit,
      timezone: args.timezone,
      waiting: args.waiting,
      waitingReason: args.waitingReason,
      remindMinutes: args.remindMinutes,
      origin: "agent",
    });
    await armReminder(ctx, created);
    return created;
  },
});

export const update = mutation({
  args: {
    ...proofArgs,
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
    const user = await requireMcpUser(ctx, args);
    const updated = await taskService.updateTask(ctx.db, user._id, args.id, {
      title: args.title,
      notes: args.notes,
      plannedOn: args.plannedOn,
      plannedTime: args.plannedTime,
      dueAt: args.dueAt,
      location: args.location,
      deadlineAt: args.deadlineAt,
      remindAt: args.remindAt,
      priority: args.priority,
      priorityRank: args.priorityRank,
      overduePolicy: args.overduePolicy,
      presentation: args.presentation,
      done: args.done,
      routineKind: args.routineKind,
      intervalEvery: args.intervalEvery,
      intervalUnit: args.intervalUnit,
      timezone: args.timezone,
      waiting: args.waiting,
      waitingReason: args.waitingReason,
      remindMinutes: args.remindMinutes,
    });
    await armReminder(ctx, updated);
    return updated;
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

export const setWaiting = mutation({
  args: {
    ...proofArgs,
    id: v.id("tasks"),
    waiting: v.boolean(),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireMcpUser(ctx, args);
    return await taskService.setTaskWaiting(
      ctx.db,
      user._id,
      args.id,
      args.waiting,
      args.reason,
    );
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
