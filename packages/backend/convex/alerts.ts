import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { findCurrentUser, requireUser } from "./users";
import { createAlert, listAlertHistory } from "./lib/phase2Service";

export const create = mutation({
  args: {
    title: v.string(),
    body: v.optional(v.string()),
    source: v.optional(v.string()),
    groupId: v.optional(v.id("spaces")),
    kind: v.optional(v.union(v.literal("note"), v.literal("activity"))),
    authorOrigin: v.optional(
      v.union(v.literal("self"), v.literal("agent"), v.literal("member")),
    ),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    return await createAlert(ctx.db, user._id, args);
  },
});

/** History ignores the Tasks-page activity setting. It shows every record. */
export const history = query({
  args: {},
  handler: async (ctx) => {
    const user = await findCurrentUser(ctx);
    if (!user) return [];
    const rows = await listAlertHistory(ctx.db, user._id);
    return rows.map((row) => ({
      id: row._id,
      title: row.title,
      body: row.body ?? "",
      kind: row.kind,
      authorOrigin: row.authorOrigin,
      source: row.source,
      seenAt: row.seenAt,
      groupId: row.groupId,
      resourceId: row.resourceId,
      createdAt: row._creationTime,
    }));
  },
});

/** Mark seen only after the caller's mutation has succeeded. */
export const read = mutation({
  args: { id: v.id("alerts") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const alert = await ctx.db.get(args.id);
    if (!alert || alert.deletedAt !== undefined) {
      throw new Error("Alert not found");
    }
    const rows = await listAlertHistory(ctx.db, user._id);
    if (!rows.some((row) => row._id === args.id)) {
      throw new Error("Alert not found");
    }
    if (alert.seenAt === undefined) {
      await ctx.db.patch(args.id, { seenAt: Date.now() });
    }
    return { success: true };
  },
});
