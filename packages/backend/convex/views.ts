import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { requireUser } from "./users";
import {
  createCustomView,
  enableComputedView,
  installTemplate as installTemplateView,
  removeView,
} from "./lib/viewService";

export const installTemplate = mutation({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    return await installTemplateView(ctx.db, user._id, args.slug);
  },
});

export const createCustom = mutation({
  args: {
    title: v.string(),
    icon: v.optional(v.string()),
    color: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    return await createCustomView(ctx.db, user._id, args);
  },
});

export const enableComputed = mutation({
  args: {
    key: v.union(v.literal("new"), v.literal("high"), v.literal("today")),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    return await enableComputedView(ctx.db, user._id, args.key);
  },
});

export const remove = mutation({
  args: { viewId: v.id("views") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    return await removeView(ctx.db, user._id, args.viewId);
  },
});
