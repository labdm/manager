import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { requireUser } from "./users";
import { createProgression, logProgress } from "./lib/phase2Service";

export const create = mutation({
  args: {
    title: v.string(),
    mode: v.optional(v.string()),
    target: v.number(),
    unit: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    return await createProgression(ctx.db, user._id, args);
  },
});

export const log = mutation({
  args: { progressionId: v.id("progressions"), amount: v.number() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    return await logProgress(ctx.db, user._id, args);
  },
});
