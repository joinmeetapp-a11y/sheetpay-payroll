"use node";
import { action, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { sendEmail as sendEmailImpl } from "./lib/email";

/**
 * Backwards-compatible façade for existing callers (`api.emailService.sendEmail`,
 * `internal.emailService.sendEmailInternal`). New code should call
 * `convex/emails.ts` or `convex/lib/email.ts` directly.
 */

export const sendEmailInternal = internalAction({
  args: {
    to: v.string(),
    emailType: v.string(),
    data: v.any(),
    userId: v.optional(v.string()),
    businessId: v.optional(v.string()),
    clientId: v.optional(v.string()),
    idempotencyKey: v.optional(v.string()),
  },
  handler: async (ctx, args) =>
    sendEmailImpl(ctx, {
      to: args.to,
      emailType: args.emailType,
      data: args.data ?? {},
      userId: args.userId,
      businessId: args.businessId,
      idempotencyKey: args.idempotencyKey,
    }),
});

export const sendEmail = action({
  args: {
    to: v.string(),
    emailType: v.string(),
    data: v.any(),
    userId: v.optional(v.string()),
    businessId: v.optional(v.string()),
    clientId: v.optional(v.string()),
    idempotencyKey: v.optional(v.string()),
  },
  handler: async (ctx, args) =>
    sendEmailImpl(ctx, {
      to: args.to,
      emailType: args.emailType,
      data: args.data ?? {},
      userId: args.userId,
      businessId: args.businessId,
      idempotencyKey: args.idempotencyKey,
    }),
});
