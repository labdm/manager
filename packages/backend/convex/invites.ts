import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { findCurrentUser, requireUser } from "./users";
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
    if (!user) return [];
    return await listInvites(ctx.db, user._id);
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
    return await createInvite(ctx.db, user._id, args);
  },
});

export const accept = mutation({
  args: { id: v.id("invites") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    return await acceptInvite(ctx.db, user._id, args.id);
  },
});

export const decline = mutation({
  args: { id: v.id("invites") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    return await declineInvite(ctx.db, user._id, args.id);
  },
});

export const markSeen = mutation({
  args: { id: v.id("invites") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    return await markInviteSeen(ctx.db, user._id, args.id);
  },
});
