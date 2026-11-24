import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { requireUser } from "./users";
import { addQuestStep, createQuest } from "./lib/phase2Service";

export const create = mutation({
  args: {
    title: v.string(),
    status: v.optional(v.string()),
    scripting: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    return await createQuest(ctx.db, user._id, args);
  },
});

export const addStep = mutation({
  args: {
    questId: v.id("quests"),
    taskId: v.id("tasks"),
    position: v.optional(v.number()),
    gate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    return await addQuestStep(ctx.db, user._id, args);
  },
});
