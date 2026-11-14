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
    createdBy: v.id("users"),
  }).index("by_createdBy", ["createdBy"]),
});
