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
    ),
    viewId: v.optional(v.id("views")),
    timezone: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    return await boardSlice(ctx.db, user._id, args);
  },
});
