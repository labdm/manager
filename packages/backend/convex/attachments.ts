import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { requireUser } from "./users";
import { attach as attachSubject, detach as detachSubject } from "./lib/linkService";

export const attach = mutation({
  args: {
    subjectType: v.string(),
    subjectId: v.string(),
    targetType: v.string(),
    targetId: v.string(),
    role: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    return await attachSubject(ctx.db, user._id, args);
  },
});

export const detach = mutation({
  args: { attachmentId: v.id("attachments") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    return await detachSubject(ctx.db, user._id, args.attachmentId);
  },
});
