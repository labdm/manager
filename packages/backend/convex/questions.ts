import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { requireUser } from "./users";
import { answerQuestion, createQuestion } from "./lib/phase2Service";

export const create = mutation({
  args: {
    prompt: v.string(),
    options: v.array(
      v.object({
        id: v.optional(v.string()),
        label: v.string(),
        effect: v.optional(v.any()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    return await createQuestion(ctx.db, user._id, args);
  },
});

export const answer = mutation({
  args: { questionId: v.id("questions"), optionId: v.string() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    return await answerQuestion(ctx.db, user._id, args);
  },
});
