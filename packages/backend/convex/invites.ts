import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { findCurrentUser, requireUser } from "./users";
import { inviteWire } from "./lib/clientWire";
import {
  acceptInvite,
  createInvite,
  declineInvite,
  listInvites,
  markInviteSeen,
} from "./lib/inviteService";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const user = await findCurrentUser(ctx);
    if (!user) return { invites: [] };
    const rows = await listInvites(ctx.db, user._id);
    const invites = [];
    for (const row of rows) {
      const group = await ctx.db.get(row.groupId);
      invites.push(
        inviteWire(
          row,
          group && group.deletedAt === undefined ? group.name : undefined,
        ),
      );
    }
    return { invites };
  },
});

export const create = mutation({
  args: {
    groupId: v.optional(v.id("spaces")),
    email: v.string(),
    origin: v.optional(
      v.union(v.literal("self"), v.literal("agent"), v.literal("member")),
    ),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const created = await createInvite(ctx.db, user._id, args);
    return { id: created._id };
  },
});

export const accept = mutation({
  args: { inviteId: v.id("invites") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    return await acceptInvite(ctx.db, user._id, args.inviteId);
  },
});

export const decline = mutation({
  args: { inviteId: v.id("invites") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    return await declineInvite(ctx.db, user._id, args.inviteId);
  },
});

export const markSeen = mutation({
  args: { id: v.id("invites") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    return await markInviteSeen(ctx.db, user._id, args.id);
  },
});
