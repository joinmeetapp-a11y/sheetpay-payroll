"use node";
import { action, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal as _internal } from "./_generated/api";
import {
  sendEmail,
  sendPayrollCompletedEmail,
  sendPayslipEmail,
  sendSubscriptionEmail,
  sendTeamInviteEmail,
  sendWelcomeEmail,
} from "./lib/email";
import { renderTemplate } from "./lib/emailTemplates";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const internal = _internal as any;

// ─── Team invitations ────────────────────────────────────────────────────────

/**
 * Create an invitation and email it to the recipient.
 * Called from the frontend (Team Settings → Invite).
 */
export const inviteTeamMember = action({
  args: {
    organizationId: v.string(),
    businessName: v.string(),
    invitedByUserId: v.string(),
    inviterName: v.string(),
    inviteeEmail: v.string(),
    role: v.string(),
    appOrigin: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // 1. Create the invitation record with a fresh token.
    const created: any = await ctx.runMutation(internal.invitations.create, {
      organizationId: args.organizationId,
      invitedByUserId: args.invitedByUserId,
      inviterName: args.inviterName,
      inviteeEmail: args.inviteeEmail,
      role: args.role,
    });
    // 2. Send the invitation email.
    const origin = (args.appOrigin || "https://sheetpay.app").replace(/\/$/, "");
    const inviteLink = `${origin}/invite/${created.token}`;
    const result = await sendTeamInviteEmail(ctx, args.inviteeEmail, {
      inviterName: args.inviterName,
      businessName: args.businessName,
      role: args.role,
      inviteeEmail: args.inviteeEmail,
      token: created.token,
      inviteLink,
      expiresLabel: new Date(created.expiresAt).toDateString(),
      inviterUserId: args.invitedByUserId,
      invitationId: created.id,
      businessId: args.organizationId,
    });
    return { ok: result.success, invitationId: created.id, ...result };
  },
});

/** Resend a pending invitation with a fresh token + new email. */
export const resendInvitation = action({
  args: {
    invitationId: v.string(),
    businessName: v.string(),
    resendingUserId: v.string(),
    resendingUserName: v.string(),
    appOrigin: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const prep: any = await ctx.runMutation(internal.invitations.prepareResend, {
      invitationId: args.invitationId as any,
      resendingUserId: args.resendingUserId,
    });
    const invite: any = await ctx.runQuery(internal.invitations.getById, {
      invitationId: args.invitationId as any,
    });
    if (!invite) return { ok: false, error: "invitation not found" };
    const origin = (args.appOrigin || "https://sheetpay.app").replace(/\/$/, "");
    const inviteLink = `${origin}/invite/${prep.token}`;
    const result = await sendTeamInviteEmail(ctx, invite.inviteeEmail, {
      inviterName: args.resendingUserName,
      businessName: args.businessName,
      role: invite.role,
      inviteeEmail: invite.inviteeEmail,
      token: prep.token,
      inviteLink,
      expiresLabel: new Date(prep.expiresAt).toDateString(),
      inviterUserId: args.resendingUserId,
      invitationId: args.invitationId,
      businessId: invite.organizationId,
    });
    return { ok: result.success, ...result };
  },
});

/** Revoke a pending invitation. Wrapper so the frontend can call one action. */
export const revokeInvitation = action({
  args: { invitationId: v.string(), revokingUserId: v.string() },
  handler: async (ctx, args) => {
    return ctx.runMutation(internal.invitations.revoke, {
      invitationId: args.invitationId as any,
      revokingUserId: args.revokingUserId,
    });
  },
});

// ─── Direct template send used by feature code ──────────────────────────────

/** Public generic send — used from frontend for opt-in flows. */
export const send = action({
  args: {
    to: v.string(),
    emailType: v.string(),
    data: v.any(),
    userId: v.optional(v.string()),
    businessId: v.optional(v.string()),
    idempotencyKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return sendEmail(ctx, {
      to: args.to,
      emailType: args.emailType,
      data: args.data ?? {},
      userId: args.userId,
      businessId: args.businessId,
      idempotencyKey: args.idempotencyKey,
    });
  },
});

/** Fire-and-forget welcome email after signup. */
export const sendWelcome = action({
  args: { to: v.string(), displayName: v.optional(v.string()), userId: v.optional(v.string()) },
  handler: async (ctx, args) =>
    sendWelcomeEmail(ctx, args.to, {
      displayName: args.displayName,
      userId: args.userId,
    }),
});

/** One-shot payslip send used by Cayla's `send_payslip_email` tool. */
export const sendPayslip = action({
  args: {
    to: v.string(),
    employeeName: v.string(),
    period: v.string(),
    businessName: v.optional(v.string()),
    payslipLink: v.optional(v.string()),
    payslipId: v.string(),
    detailed: v.optional(v.boolean()),
    grossPay: v.optional(v.string()),
    netPay: v.optional(v.string()),
    currency: v.optional(v.string()),
    deductions: v.optional(v.array(v.object({ label: v.string(), amount: v.string() }))),
    userId: v.optional(v.string()),
    businessId: v.optional(v.string()),
  },
  handler: async (ctx, args) => sendPayslipEmail(ctx, args.to, args as any),
});

/** Internal action — payroll completion. Called from payrollRuns.update. */
export const notifyPayrollCompleted = internalAction({
  args: {
    to: v.string(),
    period: v.string(),
    employeeCount: v.number(),
    currency: v.string(),
    totalGross: v.number(),
    totalDeductions: v.number(),
    totalNet: v.number(),
    payrollLink: v.optional(v.string()),
    payrollRunId: v.string(),
    userId: v.optional(v.string()),
    businessId: v.optional(v.string()),
  },
  handler: async (ctx, args) =>
    sendPayrollCompletedEmail(ctx, args.to, {
      period: args.period,
      employeeCount: args.employeeCount,
      currency: args.currency,
      totalGross: args.totalGross.toFixed(2),
      totalDeductions: args.totalDeductions.toFixed(2),
      totalNet: args.totalNet.toFixed(2),
      payrollLink: args.payrollLink,
      payrollRunId: args.payrollRunId,
      userId: args.userId,
      businessId: args.businessId,
    }),
});

/** Internal action — subscription lifecycle emails from webhook handler. */
export const notifySubscription = internalAction({
  args: {
    to: v.string(),
    kind: v.string(),
    data: v.any(),
    userId: v.optional(v.string()),
    businessId: v.optional(v.string()),
    eventId: v.optional(v.string()),
  },
  handler: async (ctx, args) =>
    sendSubscriptionEmail(ctx, args.to, args.kind as any, {
      ...(args.data || {}),
      userId: args.userId,
      businessId: args.businessId,
      eventId: args.eventId,
    }),
});

// ─── Dev-only template preview ───────────────────────────────────────────────

/**
 * Return the rendered subject + HTML for a template WITHOUT sending it.
 * Used by the /dev/email-preview page. Never touches Resend.
 *
 * Refuses to run when `NODE_ENV === "production"` to prevent inspection of
 * templates from the deployed app.
 */
export const previewTemplate = action({
  args: { emailType: v.string(), data: v.optional(v.any()) },
  handler: async (_ctx, args) => {
    if (process.env.NODE_ENV === "production") {
      return { ok: false, error: "Preview disabled in production" };
    }
    const rendered = renderTemplate(args.emailType, args.data ?? {});
    return { ok: true, ...rendered };
  },
});
