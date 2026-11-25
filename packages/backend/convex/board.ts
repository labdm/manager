import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { requireUser } from "./users";
import { boardSlice } from "./lib/boardService";

export const slice = mutation({
  args: {
    tab: v.union(
      v.literal("tasks"),
      v.literal("daily"),
      v.literal("weekly"),
      v.literal("monthly"),
      v.literal("events"),
    ),
    viewId: v.optional(v.id("views")),
    timezone: v.string(),
    groupId: v.optional(v.id("spaces")),
    eventId: v.optional(v.id("events")),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    return await boardSlice(ctx.db, user._id, args);
  },
});
