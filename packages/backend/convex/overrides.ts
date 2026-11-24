import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { requireUser } from "./users";
import { clearOverride, setOverride } from "./lib/linkService";

const subjectArgs = {
  viewId: v.id("views"),
  subjectType: v.string(),
  subjectId: v.string(),
};

export const set = mutation({
  args: {
    ...subjectArgs,
    mode: v.union(v.literal("include"), v.literal("exclude")),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    return await setOverride(ctx.db, user._id, args);
  },
});

export const clear = mutation({
  args: subjectArgs,
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    return await clearOverride(ctx.db, user._id, args);
  },
});
