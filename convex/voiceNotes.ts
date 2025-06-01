import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Get all voice notes (most recent first)
export const getVoiceNotes = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("voiceNotes"),
      _creationTime: v.number(),
      transcript: v.string(),
      audioUri: v.string(),
      createdAt: v.number(),
    })
  ),
  handler: async (ctx) => {
    return await ctx.db.query("voiceNotes").order("desc").collect();
  },
});

// Add a new voice note
export const addVoiceNote = mutation({
  args: {
    transcript: v.string(),
    audioUri: v.string(),
  },
  returns: v.id("voiceNotes"),
  handler: async (ctx, args) => {
    const newNote = await ctx.db.insert("voiceNotes", {
      transcript: args.transcript,
      audioUri: args.audioUri,
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
