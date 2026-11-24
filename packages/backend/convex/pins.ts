import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { requireUser } from "./users";
import { pin as addPin, unpin as removePin } from "./lib/linkService";

const subjectArgs = {
  viewId: v.id("views"),
  subjectType: v.string(),
  subjectId: v.string(),
};

export const pin = mutation({
  args: subjectArgs,
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    return await addPin(ctx.db, user._id, args);
  },
});

export const unpin = mutation({
  args: subjectArgs,
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    return await removePin(ctx.db, user._id, args);
  },
});
