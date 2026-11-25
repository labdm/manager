import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const groupId = v.id("spaces");

export const routingTrigger = v.union(
  v.object({
    type: v.literal("cron"),
    cadence: v.union(
      v.literal("daily"),
      v.literal("weekly"),
      v.literal("monthly"),
    ),
    timezone: v.string(),
    anchorOn: v.number(),
  }),
  v.object({
    type: v.literal("state"),
    subjectType: v.union(
      v.literal("task"),
      v.literal("resource"),
      v.literal("questStep"),
    ),
    event: v.union(
      v.literal("completed"),
      v.literal("reopened"),
      v.literal("deleted"),
      v.literal("low"),
    ),
  }),
);

export const routingExecution = v.union(
  v.object({
    type: v.literal("createTask"),
    title: v.string(),
    notes: v.optional(v.string()),
    plannedOn: v.optional(v.number()),
  }),
  v.object({
    type: v.literal("logProgress"),
    progressionId: v.id("progressions"),
    amount: v.number(),
  }),
  v.object({
    type: v.literal("createMessage"),
    title: v.string(),
    body: v.optional(v.string()),
  }),
  v.object({
    type: v.literal("resourceDelta"),
    resourceId: v.id("resources"),
    delta: v.number(),
  }),
  v.object({
    type: v.literal("addQuestStep"),
    questId: v.id("quests"),
    title: v.string(),
    gate: v.optional(v.string()),
  }),
);

export default defineSchema({
  users: defineTable({
    tokenIdentifier: v.string(),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    role: v.union(v.literal("user"), v.literal("admin")),
    activityOnTasks: v.union(
      v.literal("others"),
      v.literal("all"),
      v.literal("none"),
    ),
  }).index("by_token", ["tokenIdentifier"]),

  spaces: defineTable({
    ownerId: v.id("users"),
    name: v.string(),
    isDefault: v.boolean(),
    icon: v.optional(v.string()),
    color: v.optional(v.string()),
    deletedAt: v.optional(v.number()),
    createdAt: v.number(),
  }).index("by_owner", ["ownerId"]),

  spaceMembers: defineTable({
    spaceId: v.id("spaces"),
    userId: v.id("users"),
    role: v.union(
      v.literal("owner"),
      v.literal("admin"),
      v.literal("editor"),
      v.literal("viewer"),
    ),
    canInvite: v.boolean(),
    deletedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_space", ["spaceId"])
    .index("by_user", ["userId"])
    .index("by_space_user", ["spaceId", "userId"]),

  invites: defineTable({
    groupId: v.id("spaces"),
    inviterId: v.id("users"),
    email: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("accepted"),
      v.literal("declined"),
    ),
    origin: v.union(v.literal("self"), v.literal("agent"), v.literal("member")),
    seenAt: v.optional(v.number()),
    deletedAt: v.optional(v.number()),
  })
    .index("by_group", ["groupId"])
    .index("by_email", ["email"])
    .index("by_inviter", ["inviterId"]),

  routings: defineTable({
    ownerId: v.id("users"),
    groupId,
    name: v.string(),
    trigger: routingTrigger,
    execution: routingExecution,
    deletedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_owner", ["ownerId"])
    .index("by_group", ["groupId"]),

  routingRuns: defineTable({
    routingId: v.id("routings"),
    key: v.string(),
    ownerId: v.id("users"),
    groupId,
    ranAt: v.number(),
  })
    .index("by_routing_key", ["routingId", "key"])
    .index("by_owner", ["ownerId"]),

  recurrences: defineTable({
    ownerId: v.id("users"),
    groupId,
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
    presentation: v.optional(v.string()),
    resourceEffect: v.optional(
      v.object({ resourceId: v.id("resources"), delta: v.number() }),
    ),
    anchorOn: v.number(),
    deletedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_owner", ["ownerId"])
    .index("by_group", ["groupId"]),

  tasks: defineTable({
    title: v.string(),
    done: v.boolean(),
    dueAt: v.optional(v.number()),
    ownerId: v.id("users"),
    groupId,
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
    presentation: v.optional(v.string()),
    resourceEffect: v.optional(
      v.object({ resourceId: v.id("resources"), delta: v.number() }),
    ),
    recurrenceId: v.optional(v.id("recurrences")),
    periodStart: v.optional(v.number()),
    open: v.optional(v.boolean()),
    escalatedAt: v.optional(v.number()),
  })
    .index("by_owner", ["ownerId"])
    .index("by_group", ["groupId"])
    .index("by_recurrence_period", ["recurrenceId", "periodStart"]),

  resources: defineTable({
    ownerId: v.id("users"),
    groupId,
    title: v.string(),
    unit: v.optional(v.string()),
    quantity: v.number(),
    lowAt: v.optional(v.number()),
    icon: v.optional(v.string()),
    color: v.optional(v.string()),
    deletedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_owner", ["ownerId"])
    .index("by_group", ["groupId"]),

  taskResourceEffects: defineTable({
    ownerId: v.id("users"),
    taskId: v.id("tasks"),
    resourceId: v.id("resources"),
    delta: v.number(),
    applied: v.optional(v.boolean()),
    deletedAt: v.optional(v.number()),
  })
    .index("by_owner", ["ownerId"])
    .index("by_task", ["ownerId", "taskId"])
    .index("by_resource", ["ownerId", "resourceId"]),

  categories: defineTable({
    ownerId: v.id("users"),
    groupId,
    name: v.string(),
    slug: v.string(),
    hidden: v.optional(v.boolean()),
    icon: v.optional(v.string()),
    color: v.optional(v.string()),
    presentationId: v.optional(v.string()),
    deletedAt: v.optional(v.number()),
  })
    .index("by_owner", ["ownerId"])
    .index("by_group", ["groupId"]),

  events: defineTable({
    ownerId: v.id("users"),
    groupId,
    title: v.string(),
    kind: v.string(),
    startsAt: v.number(),
    endsAt: v.number(),
    catalogRole: v.optional(v.string()),
    presentationId: v.optional(v.string()),
    icon: v.optional(v.string()),
    color: v.optional(v.string()),
    deletedAt: v.optional(v.number()),
  })
    .index("by_owner", ["ownerId"])
    .index("by_group", ["groupId"]),

  views: defineTable({
    ownerId: v.id("users"),
    groupId,
    title: v.string(),
    icon: v.optional(v.string()),
    color: v.optional(v.string()),
    kind: v.string(),
    filter: v.optional(v.any()),
    categoryId: v.optional(v.id("categories")),
    computedKey: v.optional(v.string()),
    deletedAt: v.optional(v.number()),
  })
    .index("by_owner", ["ownerId"])
    .index("by_group", ["groupId"]),

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
    groupId,
    title: v.string(),
    mode: v.string(),
    target: v.number(),
    unit: v.string(),
    current: v.number(),
    deletedAt: v.optional(v.number()),
  })
    .index("by_owner", ["ownerId"])
    .index("by_group", ["groupId"]),

  quests: defineTable({
    ownerId: v.id("users"),
    groupId,
    title: v.string(),
    status: v.string(),
    scripting: v.optional(v.string()),
    deletedAt: v.optional(v.number()),
  })
    .index("by_owner", ["ownerId"])
    .index("by_group", ["groupId"]),

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
    groupId,
    title: v.string(),
    body: v.optional(v.string()),
    source: v.string(),
    kind: v.union(v.literal("note"), v.literal("activity")),
    authorOrigin: v.union(
      v.literal("self"),
      v.literal("agent"),
      v.literal("member"),
    ),
    resourceId: v.optional(v.id("resources")),
    seenAt: v.optional(v.number()),
    deletedAt: v.optional(v.number()),
  })
    .index("by_owner", ["ownerId"])
    .index("by_group", ["groupId"]),

  questions: defineTable({
    ownerId: v.id("users"),
    groupId,
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
  })
    .index("by_owner", ["ownerId"])
    .index("by_group", ["groupId"]),
});
