import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const create = mutation({
  args: { text: v.string() },
  returns: v.id("todos"),
  handler: async (ctx, { text }) =>
    ctx.db.insert("todos", { text, done: false, createdAt: Date.now() }),
});

export const list = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("todos"),
      _creationTime: v.number(),
      text: v.string(),
      done: v.boolean(),
      createdAt: v.number(),
    })
  ),
  handler: async (ctx) => ctx.db.query("todos").order("desc").collect(),
});

export const toggleTodo = mutation({
  args: { id: v.id("todos") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const todo = await ctx.db.get(args.id);
    if (!todo) {
      throw new Error("Todo not found");
    }
    await ctx.db.patch(args.id, {
      done: !todo.done,
    });
    return null;
  },
});

export const deleteTodo = mutation({
  args: { id: v.id("todos") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
    return null;
  },
});
