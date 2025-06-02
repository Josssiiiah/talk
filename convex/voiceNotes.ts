import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";

// List all voice notes (most recent first)
export const list = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("voiceNotes"),
      _creationTime: v.number(),
      content: v.string(),
      type: v.union(v.literal("note"), v.literal("todo")),
      folderId: v.optional(v.id("folders")),
      completed: v.optional(v.boolean()),
      createdAt: v.number(),
    })
  ),
  handler: async (ctx) => {
    return await ctx.db.query("voiceNotes").order("desc").collect();
  },
});

// Add a placeholder voice note
export const addPlaceholder = mutation({
  args: {},
  returns: v.id("voiceNotes"),
  handler: async (ctx) => {
    const newNote = await ctx.db.insert("voiceNotes", {
      content: "Processing...",
      type: "note" as const,
      createdAt: Date.now(),
    });
    return newNote;
  },
});

// Delete a voice note
export const deleteVoiceNote = mutation({
  args: { id: v.id("voiceNotes") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
    return null;
  },
});

// Internal: finalize a placeholder note with actual content
export const finalizeNote = internalMutation({
  args: {
    noteId: v.id("voiceNotes"),
    content: v.string(),
    type: v.literal("note"),
    folderId: v.optional(v.id("folders")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.noteId, {
      content: args.content,
      type: args.type,
      folderId: args.folderId,
    });
    return null;
  },
});
