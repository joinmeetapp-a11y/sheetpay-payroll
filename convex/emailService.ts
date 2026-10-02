"use node";
import { action, internalAction } from "./_generated/server";
import { internal as _internal } from "./_generated/api";
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
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || (args.userId && args.userId !== identity.subject)) throw new Error("Unauthorized");
    if (args.emailType === "employeePayslip") {
      throw new Error("Use the reviewed payslip email workflow in your Accountant dashboard.");
    } else if (args.emailType !== "welcome" || args.to.trim().toLowerCase() !== String(identity.email || "").toLowerCase()) {
      throw new Error("Use the authorized Sheetpay workflow for this email.");
    }
    return sendEmailImpl(ctx, { to: String(identity.email), emailType: "welcome", userId: identity.subject, data: { displayName: identity.name || "" }, idempotencyKey: `welcome:${identity.subject}` });
  },
});

