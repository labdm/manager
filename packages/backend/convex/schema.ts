import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    tokenIdentifier: v.string(),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    role: v.union(v.literal("user"), v.literal("admin")),
  }).index("by_token", ["tokenIdentifier"]),

  recurrences: defineTable({
    ownerId: v.id("users"),
    behavior: v.union(v.literal("replace"), v.literal("stack")),
    cadence: v.string(),
    timezone: v.string(),
    title: v.string(),
    notes: v.optional(v.string()),
    plannedTime: v.optional(v.number()),
    location: v.optional(v.string()),
    priority: v.optional(v.string()),
    priorityRank: v.optional(v.number()),
    overduePolicy: v.optional(v.string()),
    presentationHint: v.optional(v.string()),
    anchorOn: v.number(),
    deletedAt: v.optional(v.number()),
    createdAt: v.number(),
  }).index("by_owner", ["ownerId"]),

  tasks: defineTable({
    title: v.string(),
    done: v.boolean(),
    dueAt: v.optional(v.number()),
    ownerId: v.id("users"),
    deletedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    notes: v.optional(v.string()),
    plannedOn: v.optional(v.number()),
    plannedTime: v.optional(v.number()),
    location: v.optional(v.string()),
    deadlineAt: v.optional(v.number()),
    remindAt: v.optional(v.number()),
    priority: v.optional(v.string()),
    priorityRank: v.optional(v.number()),
    overduePolicy: v.optional(v.string()),
    outcome: v.optional(v.string()),
    seenAt: v.optional(v.number()),
    origin: v.optional(v.string()),
    presentationHint: v.optional(v.string()),
    recurrenceId: v.optional(v.id("recurrences")),
    periodStart: v.optional(v.number()),
    open: v.optional(v.boolean()),
    escalatedAt: v.optional(v.number()),
  })
    .index("by_owner", ["ownerId"])
    .index("by_recurrence_period", ["recurrenceId", "periodStart"]),

  categories: defineTable({
    ownerId: v.id("users"),
    name: v.string(),
    slug: v.string(),
    hidden: v.optional(v.boolean()),
    icon: v.optional(v.string()),
    color: v.optional(v.string()),
    presentationId: v.optional(v.string()),
    deletedAt: v.optional(v.number()),
  }).index("by_owner", ["ownerId"]),

  events: defineTable({
    ownerId: v.id("users"),
    title: v.string(),
    kind: v.string(),
    startsAt: v.number(),
    endsAt: v.number(),
    catalogRole: v.optional(v.string()),
    presentationId: v.optional(v.string()),
    icon: v.optional(v.string()),
    color: v.optional(v.string()),
    deletedAt: v.optional(v.number()),
  }).index("by_owner", ["ownerId"]),

  views: defineTable({
    ownerId: v.id("users"),
    title: v.string(),
    icon: v.optional(v.string()),
    color: v.optional(v.string()),
    kind: v.string(),
    filter: v.optional(v.any()),
    categoryId: v.optional(v.id("categories")),
    computedKey: v.optional(v.string()),
    deletedAt: v.optional(v.number()),
  }).index("by_owner", ["ownerId"]),

  attachments: defineTable({
    ownerId: v.id("users"),
    subjectType: v.string(),
    subjectId: v.string(),
    targetType: v.string(),
    targetId: v.string(),
    role: v.optional(v.string()),
    deletedAt: v.optional(v.number()),
  })
    .index("by_owner", ["ownerId"])
    .index("by_subject", ["ownerId", "subjectType", "subjectId"])
    .index("by_target", ["ownerId", "targetType", "targetId"]),

  viewPins: defineTable({
    ownerId: v.id("users"),
    viewId: v.id("views"),
    subjectType: v.string(),
    subjectId: v.string(),
    deletedAt: v.optional(v.number()),
  }).index("by_owner_view", ["ownerId", "viewId"]),

  viewOverrides: defineTable({
    ownerId: v.id("users"),
    viewId: v.id("views"),
    subjectType: v.string(),
    subjectId: v.string(),
    mode: v.string(),
    deletedAt: v.optional(v.number()),
  }).index("by_owner_view", ["ownerId", "viewId"]),

  progressions: defineTable({
    ownerId: v.id("users"),
    title: v.string(),
    mode: v.string(),
    target: v.number(),
    unit: v.string(),
    current: v.number(),
    deletedAt: v.optional(v.number()),
  }).index("by_owner", ["ownerId"]),

  quests: defineTable({
    ownerId: v.id("users"),
    title: v.string(),
    status: v.string(),
    scripting: v.optional(v.string()),
    deletedAt: v.optional(v.number()),
  }).index("by_owner", ["ownerId"]),

  questSteps: defineTable({
    ownerId: v.id("users"),
    questId: v.id("quests"),
    taskId: v.id("tasks"),
    position: v.number(),
    gate: v.string(),
    deletedAt: v.optional(v.number()),
  })
    .index("by_owner", ["ownerId"])
    .index("by_quest", ["ownerId", "questId", "position"])
    .index("by_task", ["ownerId", "taskId"]),

  alerts: defineTable({
    ownerId: v.id("users"),
    title: v.string(),
    body: v.optional(v.string()),
    source: v.string(),
    seenAt: v.optional(v.number()),
    deletedAt: v.optional(v.number()),
  }).index("by_owner", ["ownerId"]),

  questions: defineTable({
    ownerId: v.id("users"),
    prompt: v.string(),
    options: v.array(
      v.object({
        id: v.string(),
        label: v.string(),
        effect: v.optional(v.any()),
      }),
    ),
    answeredAt: v.optional(v.number()),
    seenAt: v.optional(v.number()),
    deletedAt: v.optional(v.number()),
  }).index("by_owner", ["ownerId"]),
});
