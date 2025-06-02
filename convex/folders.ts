import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const create = mutation({
  args: { name: v.string() },
  returns: v.id("folders"),
  handler: async (ctx, { name }) =>
    ctx.db.insert("folders", { name, createdAt: Date.now() }),
});

export const list = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("folders"),
      _creationTime: v.number(),
      name: v.string(),
      createdAt: v.number(),
    })
  ),
  handler: async (ctx) => ctx.db.query("folders").order("desc").collect(),
});
