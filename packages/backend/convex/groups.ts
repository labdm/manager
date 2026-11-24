import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { findCurrentUser, requireUser } from "./users";
import { groupWire } from "./lib/clientWire";
import {
  createGroup,
  defaultGroupForUser,
  listGroups,
  listMembers,
  membershipFor,
  removeGroup,
  renameGroup,
} from "./lib/groupService";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const user = await findCurrentUser(ctx);
    if (!user) return { groups: [] };
    const rows = await listGroups(ctx.db, user._id);
    const groups = [];
    for (const row of rows) {
      const member = await membershipFor(ctx.db, user._id, row._id);
      groups.push(groupWire(row, member));
    }
    return { groups };
  },
});

export const defaultGroup = query({
  args: {},
  handler: async (ctx) => {
    const user = await findCurrentUser(ctx);
    if (!user) return null;
    return await defaultGroupForUser(ctx.db, user._id);
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    icon: v.optional(v.string()),
    color: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const created = await createGroup(ctx.db, user._id, args);
    return { id: created._id };
  },
});

export const rename = mutation({
  args: {
    id: v.id("spaces"),
    name: v.optional(v.string()),
    icon: v.optional(v.string()),
    color: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const { id, ...patch } = args;
    return await renameGroup(ctx.db, user._id, id, patch);
  },
});

/** Soft delete. The default group is the one group that cannot be removed. */
export const remove = mutation({
  args: { id: v.id("spaces") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    return await removeGroup(ctx.db, user._id, args.id);
  },
});

export const members = query({
  args: { groupId: v.id("spaces") },
  handler: async (ctx, args) => {
    const user = await findCurrentUser(ctx);
    if (!user) return [];
    return await listMembers(ctx.db, user._id, args.groupId);
  },
});
