import { internalMutation, internalQuery, query } from "./_generated/server";
import { v } from "convex/values";

/** Insert an email log row and return the id (used by lib/email.ts). */
export const logEmail = internalMutation({
  args: {
    recipient: v.string(),
    emailType: v.string(),
    subject: v.string(),
    status: v.string(),
    resendMessageId: v.optional(v.string()),
    userId: v.optional(v.string()),
    businessId: v.optional(v.string()),
    clientId: v.optional(v.string()),
    relatedEntityId: v.optional(v.string()),
    idempotencyKey: v.optional(v.string()),
    category: v.optional(v.string()),
    attempts: v.optional(v.number()),
    sentAt: v.optional(v.number()),
    failedReason: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("emailLogs", {
      ...args,
      createdAt: Date.now(),
    });
    return id;
  },
});

/**
 * Update an existing log row from a Resend webhook event.
 * Falls back to inserting a placeholder row so we never drop a delivery event
 * (e.g. if the original log was purged).
 */
export const updateStatusByResendId = internalMutation({
  args: {
    resendMessageId: v.string(),
    status: v.string(),
    errorMessage: v.optional(v.string()),
    deliveredAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("emailLogs")
      .withIndex("by_resend_message", (q) => q.eq("resendMessageId", args.resendMessageId))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        status: args.status,
        errorMessage: args.errorMessage,
        deliveredAt: args.deliveredAt ?? existing.deliveredAt,
      });
      return existing._id;
    }
    return null;
  },
});

/**
 * Look up an existing send by idempotency key within a rolling window.
 * Returns the log id if the send already happened successfully.
 */
export const findByIdempotencyKey = internalQuery({
  args: { idempotencyKey: v.string(), windowMs: v.number() },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("emailLogs")
      .withIndex("by_idempotency", (q) => q.eq("idempotencyKey", args.idempotencyKey))
      .collect();
    const cutoff = Date.now() - args.windowMs;
    const recent = rows.find(
      (r) => r.createdAt >= cutoff && (r.status === "sent" || r.status === "delivered")
    );
    return recent ? recent._id : null;
  },
});

/** Suppression check — used before every send. */
export const isSuppressed = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const hit = await ctx.db
      .query("emailSuppressions")
      .withIndex("by_email", (q) => q.eq("emailAddress", args.email))
      .first();
    return hit !== null;
  },
});

/** Add an address to the suppression list. */
export const addSuppression = internalMutation({
  args: { emailAddress: v.string(), reason: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("emailSuppressions")
      .withIndex("by_email", (q) => q.eq("emailAddress", args.emailAddress))
      .first();
    if (existing) return existing._id;
    return ctx.db.insert("emailSuppressions", {
      emailAddress: args.emailAddress,
      reason: args.reason,
      createdAt: Date.now(),
    });
  },
});

/** Public: list recent logs for the admin UI. */
export const getEmailLogs = query({
  args: {
    userId: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    if (args.userId) {
      return ctx.db
        .query("emailLogs")
        .withIndex("by_user", (q) => q.eq("userId", args.userId!))
        .order("desc")
        .take(limit);
    }
    return ctx.db.query("emailLogs").order("desc").take(limit);
  },
});
