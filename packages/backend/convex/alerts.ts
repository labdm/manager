import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { requireUser } from "./users";
import { createAlert } from "./lib/phase2Service";

export const create = mutation({
  args: {
    title: v.string(),
    body: v.optional(v.string()),
    source: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    return await createAlert(ctx.db, user._id, args);
  },
});

export const read = mutation({
  args: { id: v.id("alerts") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const alert = await ctx.db.get(args.id);
    if (!alert || alert.ownerId !== user._id || alert.deletedAt !== undefined) {
      throw new Error("Alert not found");
    }
    if (alert.seenAt === undefined) {
      await ctx.db.patch(args.id, { seenAt: Date.now() });
    }
    return { success: true };
  },
});
