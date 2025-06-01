import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  todos: defineTable({
    text: v.string(),
    isCompleted: v.boolean(),
    createdAt: v.number(),
  }),
  voiceNotes: defineTable({
    transcript: v.string(),
    audioUri: v.string(),
    createdAt: v.number(),
  }),
});
