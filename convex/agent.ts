"use node";

import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import { action } from "./_generated/server";

/** ONE action that transcribes & routes */
export const processTranscript = action({
  args: { noteId: v.id("voiceNotes"), audioBase64: v.string() },
  returns: v.null(),
  handler: async (ctx, { noteId, audioBase64 }) => {
    const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("Missing OpenAI API key");
    }

    /* 1️⃣ Whisper transcription */
    const audioBuf = Buffer.from(audioBase64, "base64");
    const formData = new FormData();
    const audioBlob = new Blob([audioBuf], { type: "audio/wav" });
    formData.append("model", "gpt-4o-transcribe");
    formData.append("file", audioBlob, "speech.wav");

    const transcriptRes = await fetch(
      "https://api.openai.com/v1/audio/transcriptions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        body: formData,
      }
    );

    if (!transcriptRes.ok) {
      const error = await transcriptRes.text();
      throw new Error(`Whisper API error: ${error}`);
    }

    const { text } = await transcriptRes.json();
    console.log("Transcribed:", text);

    /* 2️⃣ Decide via function-calling */
    const fcRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4.1-nano-2025-04-14",
        temperature: 0,
        tools: [
          {
            type: "function",
            function: {
              name: "decide",
              description:
                "Categorize the transcribed text and extract relevant information",
              parameters: {
                type: "object",
                properties: {
                  action: {
                    type: "string",
                    enum: ["create_folder", "categorize_note", "none"],
                    description: "The action to take based on the text content",
                  },
                  noteType: {
                    type: "string",
                    enum: ["note", "todo"],
                    description:
                      "Whether this should be categorized as a regular note or a todo item",
                  },
                  folder: {
                    type: "string",
                    description:
                      "The folder name if action is create_folder or categorize_note",
                  },
                  content: {
                    type: "string",
                    description: "The cleaned up content of the note",
                  },
                },
                required: ["action", "content", "noteType"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "decide" } },
        messages: [
          {
            role: "system",
            content: `You are a smart voice-note assistant that classifies the user's spoken text and extracts structured information.

Determine two things from the user's sentence:
1. noteType — "todo" when the user is asking to remember or do something, otherwise "note".
2. action — how (if at all) the note should be organised.

Rules for noteType:
• Treat requests that contain phrases such as "todo", "to-do", "to do", "task", "remind me to", "remember to", "don't let me forget", "I need to", "I have to", "we should", or any imperative verb directed at the assistant as a TODO.  
• Everything else is a regular "note".

Rules for action:
• If the user explicitly asks for a new folder (e.g. "create a folder called ___", "new folder ___") → action: "create_folder" with that folder name.
• If the user references an existing folder (e.g. "Put this in ___", "Save under ___") → action: "categorize_note" with that folder name.
• Otherwise → action: "none".

Always return JSON that matches the function schema exactly and NEVER add extra keys.  
Important: The "content" property must be a cleaned-up, user-friendly text version of the note with no filler words ("uh", "um") and no leading or trailing whitespace.`,
          },
          { role: "user", content: text },
        ],
      }),
    });

    if (!fcRes.ok) {
      const error = await fcRes.text();
      throw new Error(`OpenAI API error: ${error}`);
    }

    const fcData = await fcRes.json();
    const toolCall = fcData.choices[0].message.tool_calls?.[0];

    if (!toolCall || toolCall.function.name !== "decide") {
      throw new Error("No valid function call in response");
    }

    const args = JSON.parse(toolCall.function.arguments);
    console.log("Decision:", args);

    /* 3️⃣ Route */

    // Special handling for real to-do items: store them in the separate todos table
    if (args.noteType === "todo") {
      // Persist as a todo
      await ctx.runMutation(api.todos.create, { text: args.content });

      // Remove the placeholder voice note we created earlier
      await ctx.runMutation(api.voiceNotes.deleteVoiceNote, { id: noteId });

      return null;
    }

    const baseNoteData = {
      noteId,
      content: args.content,
      type: "note" as const,
    };

    switch (args.action) {
      case "create_folder":
        const folderId = await ctx.runMutation(api.folders.create, {
          name: args.folder,
        });
        await ctx.runMutation(internal.voiceNotes.finalizeNote, {
          ...baseNoteData,
          folderId,
        });
        break;

      case "categorize_note":
        // Check if folder exists first
        const folders = await ctx.runQuery(api.folders.list, {});
        let existingFolder = folders.find(
          (f) => f.name.toLowerCase() === args.folder.toLowerCase()
        );

        if (!existingFolder) {
          // Create folder if it doesn't exist
          const newFolderId = await ctx.runMutation(api.folders.create, {
            name: args.folder,
          });
          await ctx.runMutation(internal.voiceNotes.finalizeNote, {
            ...baseNoteData,
            folderId: newFolderId,
          });
        } else {
          await ctx.runMutation(internal.voiceNotes.finalizeNote, {
            ...baseNoteData,
            folderId: existingFolder._id,
          });
        }
        break;

      default:
        await ctx.runMutation(internal.voiceNotes.finalizeNote, baseNoteData);
    }

    return null;
  },
});
