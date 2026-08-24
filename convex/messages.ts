import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const getByUser = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return ctx.db
      .query("messages")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("asc")
      .take(200);
  },
});

export const create = mutation({
  args: {
    userId: v.id("users"),
    businessId: v.optional(v.id("businesses")),
    sender: v.union(v.literal("user"), v.literal("cayla")),
    text: v.string(),
    timestamp: v.string(),
  },
  handler: async (ctx, args) => {
    return ctx.db.insert("messages", { ...args, createdAt: Date.now() });
  },
});

export const clearByUser = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const msgs = await ctx.db
      .query("messages")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    for (const msg of msgs) {
      await ctx.db.delete(msg._id);
    }
  },
});
