import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { findCurrentUser, requireUser } from "./users";
import { assertEpoch, normalizeTitle } from "./lib/taskFields";

function optionalString(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

export const list = query({
  args: { kind: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const user = await findCurrentUser(ctx);
    if (!user) return [];
    const rows = await ctx.db
      .query("events")
      .withIndex("by_owner", (q) => q.eq("ownerId", user._id))
      .collect();
    return rows
      .filter(
        (row) =>
          row.deletedAt === undefined &&
          (args.kind === undefined || row.kind === args.kind),
      )
      .sort((a, b) => a.startsAt - b.startsAt);
  },
});

export const create = mutation({
  args: {
    title: v.string(),
    kind: v.string(),
    startsAt: v.number(),
    endsAt: v.number(),
    icon: v.optional(v.string()),
    color: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const kind = optionalString(args.kind);
    if (!kind) throw new Error("Invalid kind");
    assertEpoch(args.startsAt, "startsAt");
    assertEpoch(args.endsAt, "endsAt");
    if (args.endsAt < args.startsAt) throw new Error("Invalid endsAt");
    return await ctx.db.insert("events", {
      ownerId: user._id,
      title: normalizeTitle(args.title),
      kind,
      startsAt: args.startsAt,
      endsAt: args.endsAt,
      icon: optionalString(args.icon),
      color: optionalString(args.color),
      deletedAt: undefined,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("events"),
    title: v.optional(v.string()),
    kind: v.optional(v.string()),
    startsAt: v.optional(v.number()),
    endsAt: v.optional(v.number()),
    icon: v.optional(v.string()),
    color: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const row = await ctx.db.get(args.id);
    if (!row || row.ownerId !== user._id || row.deletedAt !== undefined) {
      throw new Error("Event not found");
    }
    const patch: Partial<Doc<"events">> = {};
    const title = optionalString(args.title);
    if (title !== undefined) patch.title = normalizeTitle(title);
    const kind = optionalString(args.kind);
    if (kind !== undefined) patch.kind = kind;
    const icon = optionalString(args.icon);
    if (icon !== undefined) patch.icon = icon;
    const color = optionalString(args.color);
    if (color !== undefined) patch.color = color;
    if (args.startsAt !== undefined) {
      assertEpoch(args.startsAt, "startsAt");
      patch.startsAt = args.startsAt;
    }
    if (args.endsAt !== undefined) {
      assertEpoch(args.endsAt, "endsAt");
      patch.endsAt = args.endsAt;
    }
    if ((patch.endsAt ?? row.endsAt) < (patch.startsAt ?? row.startsAt)) {
      throw new Error("Invalid endsAt");
    }
    await ctx.db.patch(args.id, patch);
    return await ctx.db.get(args.id);
  },
});

/** Soft delete. Trashed events stop seeding rhythm tabs. */
export const remove = mutation({
  args: { id: v.id("events") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const row = await ctx.db.get(args.id);
    if (!row || row.ownerId !== user._id || row.deletedAt !== undefined) {
      throw new Error("Event not found");
    }
    await ctx.db.patch(args.id, { deletedAt: Date.now() });
    return { success: true, id: args.id };
  },
});
