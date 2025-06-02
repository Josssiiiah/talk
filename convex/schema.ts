import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  voiceNotes: defineTable({
    content: v.string(), // transcript text
    type: v.union(v.literal("note"), v.literal("todo")), // categorization
    folderId: v.optional(v.id("folders")),
    completed: v.optional(v.boolean()), // for todos
    createdAt: v.number(),
  }),
  todos: defineTable({
    text: v.string(),
    done: v.boolean(),
    createdAt: v.number(),
  }),
  folders: defineTable({
    name: v.string(),
    createdAt: v.number(),
  }),
});
