import { internalQuery, mutation, query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Notification preferences per user, keyed by category.
 * Security-critical templates ignore these flags at the send layer.
 */

const CATEGORIES = [
  "payroll",
  "payslip",
  "team",
  "import",
  "billing",
  "security",
  "product",
  "account",
] as const;

/** Public read for the settings UI. */
export const getMine = query({
  args: { userId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    if (!args.userId) return null;
    const prefs = await ctx.db
      .query("notificationPreferences")
      .withIndex("by_user", (q) => q.eq("userId", args.userId!))
      .first();
    return prefs ?? null;
  },
});

/** Server-only read used by the email service. */
export const getForUser = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return ctx.db
      .query("notificationPreferences")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();
  },
});

/** Upsert preferences for the logged-in user. */
export const updateMine = mutation({
  args: {
    userId: v.string(),
    payroll: v.optional(v.boolean()),
    payslip: v.optional(v.boolean()),
    team: v.optional(v.boolean()),
    import: v.optional(v.boolean()),
    billing: v.optional(v.boolean()),
    security: v.optional(v.boolean()),
    product: v.optional(v.boolean()),
    account: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { userId, ...rest } = args;
    const existing = await ctx.db
      .query("notificationPreferences")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    // Security-critical categories cannot be disabled from this endpoint.
    // Force security = true regardless of what was passed.
    const patch: Record<string, any> = { ...rest, security: true, updatedAt: Date.now() };
    if (existing) {
      await ctx.db.patch(existing._id, patch);
      return existing._id;
    }
    const defaults: Record<string, boolean> = {};
    for (const c of CATEGORIES) defaults[c] = true;
    return ctx.db.insert("notificationPreferences", {
      userId,
      ...defaults,
      ...patch,
    });
  },
});
