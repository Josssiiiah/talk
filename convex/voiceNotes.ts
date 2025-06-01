import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Get all voice notes (most recent first)
export const getVoiceNotes = query({
  args: {},
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
  handler: async (ctx, args) => {
    const newNote = await ctx.db.insert("voiceNotes", {
      transcript: args.transcript,
      audioUri: args.audioUri,
      createdAt: Date.now(),
    });
    return newNote;
  },
});
