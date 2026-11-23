import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    tokenIdentifier: v.string(),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    role: v.union(v.literal("user"), v.literal("admin")),
  }).index("by_token", ["tokenIdentifier"]),

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
  }).index("by_owner", ["ownerId"]),
});
