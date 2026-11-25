import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { proofArgs, requireMcpUser } from "./mcpTasks";
import { boardSlice } from "./lib/boardService";
import { attach, detach, pin, unpin, setOverride, clearOverride } from "./lib/linkService";
import { createGroup } from "./lib/groupService";
import { createInvite } from "./lib/inviteService";
import { applyOverdueForOwner } from "./lib/overdueService";
import {
  createAlert,
  addQuestStep,
  answerQuestion,
  createProgression,
  createQuestion,
  createQuest,
  logProgress,
} from "./lib/phase2Service";
import { createRecurrence, listRecurrences, reconcileOwner } from "./lib/recurrenceService";
import * as resourceService from "./lib/resourceService";
import { createRouting, listRoutings } from "./lib/routingService";
import { routingExecution, routingTrigger } from "./schema";
import {
  createCustomView,
  enableComputedView,
  installTemplate,
} from "./lib/viewService";

export const createGroupTool = mutation({
  args: {
    ...proofArgs,
    name: v.string(),
    icon: v.optional(v.string()),
    color: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireMcpUser(ctx, args);
    return await createGroup(ctx.db, user._id, {
      name: args.name,
      icon: args.icon,
      color: args.color,
    });
  },
});

export const inviteTool = mutation({
  args: {
    ...proofArgs,
    groupId: v.optional(v.id("spaces")),
    email: v.string(),
    origin: v.optional(
      v.union(v.literal("self"), v.literal("agent"), v.literal("member")),
    ),
  },
  handler: async (ctx, args) => {
    const user = await requireMcpUser(ctx, args);
    return await createInvite(ctx.db, user._id, {
      groupId: args.groupId,
      email: args.email,
      origin: args.origin,
    });
  },
});

export const createRoutingTool = mutation({
  args: {
    ...proofArgs,
    name: v.string(),
    trigger: routingTrigger,
    execution: routingExecution,
    groupId: v.optional(v.id("spaces")),
  },
  handler: async (ctx, args) => {
    const user = await requireMcpUser(ctx, args);
    return await createRouting(ctx.db, user._id, {
      name: args.name,
      trigger: args.trigger,
      execution: args.execution,
      groupId: args.groupId,
    });
  },
});

export const listRoutingsTool = mutation({
  args: proofArgs,
  handler: async (ctx, args) => {
    const user = await requireMcpUser(ctx, args);
    return await listRoutings(ctx.db, user._id);
  },
});

export const createRecurrenceTool = mutation({
  args: {
    ...proofArgs,
    behavior: v.union(v.literal("replace"), v.literal("stack")),
    cadence: v.string(),
    timezone: v.string(),
    title: v.string(),
    notes: v.optional(v.string()),
    plannedTime: v.optional(v.number()),
    location: v.optional(v.string()),
    priority: v.optional(v.string()),
    overduePolicy: v.optional(v.string()),
    presentation: v.optional(v.string()),
    resourceEffect: v.optional(
      v.object({ resourceId: v.id("resources"), delta: v.number() }),
    ),
    anchorOn: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireMcpUser(ctx, args);
    return await createRecurrence(ctx.db, user._id, {
      behavior: args.behavior,
      cadence: args.cadence,
      timezone: args.timezone,
      title: args.title,
      notes: args.notes,
      plannedTime: args.plannedTime,
      location: args.location,
      priority: args.priority,
      overduePolicy: args.overduePolicy,
      presentation: args.presentation,
      resourceEffect: args.resourceEffect,
      anchorOn: args.anchorOn,
    });
  },
});

export const listRecurrencesTool = mutation({
  args: proofArgs,
  handler: async (ctx, args) => {
    const user = await requireMcpUser(ctx, args);
    await reconcileOwner(ctx.db, user._id);
    return await listRecurrences(ctx.db, user._id);
  },
});

export const getSlice = mutation({
  args: {
    ...proofArgs,
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
    const user = await requireMcpUser(ctx, args);
    return await boardSlice(ctx.db, user._id, {
      tab: args.tab,
      viewId: args.viewId,
      timezone: args.timezone,
      groupId: args.groupId,
      eventId: args.eventId,
    });
  },
});

const createViewArgs = {
  ...proofArgs,
  slug: v.optional(v.string()),
  key: v.optional(v.string()),
  title: v.optional(v.string()),
  icon: v.optional(v.string()),
  color: v.optional(v.string()),
};

export const createViewTool = mutation({
  args: createViewArgs,
  handler: async (ctx, args) => {
    const user = await requireMcpUser(ctx, args);
    if (args.slug) return await installTemplate(ctx.db, user._id, args.slug);
    if (args.key) return await enableComputedView(ctx.db, user._id, args.key);
    if (!args.title) throw new Error("Title is required");
    return await createCustomView(ctx.db, user._id, {
      title: args.title,
      icon: args.icon,
      color: args.color,
    });
  },
});

const subjectArgs = {
  ...proofArgs,
  viewId: v.id("views"),
  subjectType: v.string(),
  subjectId: v.string(),
};

export const attachTool = mutation({
  args: {
    ...proofArgs,
    subjectType: v.string(),
    subjectId: v.string(),
    targetType: v.string(),
    targetId: v.string(),
    role: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireMcpUser(ctx, args);
    return await attach(ctx.db, user._id, {
      subjectType: args.subjectType,
      subjectId: args.subjectId,
      targetType: args.targetType,
      targetId: args.targetId,
      role: args.role,
    });
  },
});

export const detachTool = mutation({
  args: { ...proofArgs, attachmentId: v.id("attachments") },
  handler: async (ctx, args) => {
    const user = await requireMcpUser(ctx, args);
    return await detach(ctx.db, user._id, args.attachmentId);
  },
});

export const pinTool = mutation({
  args: subjectArgs,
  handler: async (ctx, args) => {
    const user = await requireMcpUser(ctx, args);
    return await pin(ctx.db, user._id, {
      viewId: args.viewId,
      subjectType: args.subjectType,
      subjectId: args.subjectId,
    });
  },
});

export const unpinTool = mutation({
  args: subjectArgs,
  handler: async (ctx, args) => {
    const user = await requireMcpUser(ctx, args);
    return await unpin(ctx.db, user._id, {
      viewId: args.viewId,
      subjectType: args.subjectType,
      subjectId: args.subjectId,
    });
  },
});

export const includeTool = mutation({
  args: subjectArgs,
  handler: async (ctx, args) => {
    const user = await requireMcpUser(ctx, args);
    return await setOverride(ctx.db, user._id, {
      viewId: args.viewId,
      subjectType: args.subjectType,
      subjectId: args.subjectId,
      mode: "include",
    });
  },
});

export const excludeTool = mutation({
  args: subjectArgs,
  handler: async (ctx, args) => {
    const user = await requireMcpUser(ctx, args);
    return await setOverride(ctx.db, user._id, {
      viewId: args.viewId,
      subjectType: args.subjectType,
      subjectId: args.subjectId,
      mode: "exclude",
    });
  },
});

export const clearOverrideTool = mutation({
  args: subjectArgs,
  handler: async (ctx, args) => {
    const user = await requireMcpUser(ctx, args);
    return await clearOverride(ctx.db, user._id, {
      viewId: args.viewId,
      subjectType: args.subjectType,
      subjectId: args.subjectId,
    });
  },
});

export const createProgressionTool = mutation({
  args: {
    ...proofArgs,
    title: v.string(),
    mode: v.optional(v.string()),
    target: v.number(),
    unit: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireMcpUser(ctx, args);
    return await createProgression(ctx.db, user._id, {
      title: args.title,
      mode: args.mode,
      target: args.target,
      unit: args.unit,
    });
  },
});

export const logProgressTool = mutation({
  args: { ...proofArgs, progressionId: v.id("progressions"), amount: v.number() },
  handler: async (ctx, args) => {
    const user = await requireMcpUser(ctx, args);
    return await logProgress(ctx.db, user._id, {
      progressionId: args.progressionId,
      amount: args.amount,
    });
  },
});

export const createQuestTool = mutation({
  args: {
    ...proofArgs,
    title: v.string(),
    status: v.optional(v.string()),
    scripting: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireMcpUser(ctx, args);
    return await createQuest(ctx.db, user._id, {
      title: args.title,
      status: args.status,
      scripting: args.scripting,
    });
  },
});

export const addQuestStepTool = mutation({
  args: {
    ...proofArgs,
    questId: v.id("quests"),
    taskId: v.id("tasks"),
    position: v.optional(v.number()),
    gate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireMcpUser(ctx, args);
    return await addQuestStep(ctx.db, user._id, {
      questId: args.questId,
      taskId: args.taskId,
      position: args.position,
      gate: args.gate,
    });
  },
});

export const createQuestionTool = mutation({
  args: {
    ...proofArgs,
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
    const user = await requireMcpUser(ctx, args);
    return await createQuestion(ctx.db, user._id, {
      prompt: args.prompt,
      options: args.options,
    });
  },
});

export const answerQuestionTool = mutation({
  args: { ...proofArgs, questionId: v.id("questions"), optionId: v.string() },
  handler: async (ctx, args) => {
    const user = await requireMcpUser(ctx, args);
    return await answerQuestion(ctx.db, user._id, {
      questionId: args.questionId,
      optionId: args.optionId,
    });
  },
});

export const createAlertTool = mutation({
  args: {
    ...proofArgs,
    title: v.string(),
    body: v.optional(v.string()),
    source: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireMcpUser(ctx, args);
    return await createAlert(ctx.db, user._id, {
      title: args.title,
      body: args.body,
      source: args.source,
    });
  },
});

export const createResourceTool = mutation({
  args: {
    ...proofArgs,
    title: v.string(),
    unit: v.optional(v.string()),
    quantity: v.number(),
    lowAt: v.optional(v.number()),
    icon: v.optional(v.string()),
    color: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireMcpUser(ctx, args);
    return await resourceService.createResource(ctx.db, user._id, {
      title: args.title,
      unit: args.unit,
      quantity: args.quantity,
      lowAt: args.lowAt,
      icon: args.icon,
      color: args.color,
    });
  },
});

export const listResourcesTool = mutation({
  args: proofArgs,
  handler: async (ctx, args) => {
    const user = await requireMcpUser(ctx, args);
    return await resourceService.listResources(ctx.db, user._id);
  },
});

export const setTaskResourceEffectTool = mutation({
  args: {
    ...proofArgs,
    taskId: v.id("tasks"),
    resourceId: v.id("resources"),
    delta: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await requireMcpUser(ctx, args);
    return await resourceService.setTaskResourceEffect(
      ctx.db,
      user._id,
      args.taskId,
      args.resourceId,
      args.delta,
    );
  },
});

export const sweepOverdueTool = mutation({
  args: proofArgs,
  handler: async (ctx, args) => {
    const user = await requireMcpUser(ctx, args);
    return await applyOverdueForOwner(ctx.db, user._id);
  },
});
