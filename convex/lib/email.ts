/**
 * Reusable Sheetpay email service. All send paths go through here so that
 * templates, logging, idempotency, preferences, and retry logic stay
 * consistent across every feature.
 *
 * Import boundary: this file is imported by `"use node";` Convex actions
 * (`convex/emailService.ts` and `convex/emails.ts`) — it must never be pulled
 * into browser bundles.
 */

import { internal } from "../_generated/api";
import { renderTemplate, TemplateKey, EmailCategory } from "./emailTemplates";

export interface SendEmailOptions {
  /** Recipient email address. Must be a single validated address. */
  to: string;
  /** Template registry key OR alias (see emailTemplates.ts). */
  emailType: TemplateKey | string;
  /** Data passed to the template renderer. */
  data: Record<string, any>;
  /**
   * Unique key to guarantee at-most-once delivery. If the same key is passed
   * twice within the idempotency window, the second call is a no-op.
   * Example: `payslip-ready:<payslipId>`, `payroll-complete:<runId>`.
   */
  idempotencyKey?: string;
  /** For logging: the requesting user. */
  userId?: string;
  /** For logging: the organization / business. */
  businessId?: string;
  /** For logging: the related entity (payroll run id, invitation id, etc.). */
  relatedEntityId?: string;
  /** For preferences: authenticated user id whose preferences apply. */
  preferencesUserId?: string;
  /** Reply-to override. Defaults to RESEND_REPLY_TO env. */
  replyTo?: string;
  /** Skip preference checks — used for critical security emails. */
  bypassPreferences?: boolean;
}

export interface SendEmailResult {
  success: boolean;
  status: "sent" | "skipped" | "failed" | "duplicate";
  messageId?: string;
  error?: string;
  emailLogId?: string;
}

const RESEND_ENDPOINT = "https://api.resend.com/emails";
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 400;
const IDEMPOTENCY_WINDOW_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

/** Env resolution kept private to this module. */
function resolveEnv() {
  return {
    apiKey: process.env.RESEND_API_KEY,
    fromEmail: process.env.RESEND_FROM_EMAIL || "notifications@sheetpay.app",
    fromName: process.env.RESEND_FROM_NAME || "Sheetpay",
    replyTo: process.env.RESEND_REPLY_TO || "support@sheetpay.app",
  };
}

/** Basic RFC-5321 sanity check to catch obvious malformed addresses early. */
function isValidEmail(addr: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addr);
}

/** Sleep helper for backoff. */
function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Classify Resend response bodies so we know whether to retry. */
function isTransientResendError(status: number, body: any): boolean {
  if (status >= 500) return true;
  if (status === 408 || status === 429) return true;
  const name = body?.name || body?.error?.name;
  if (typeof name === "string") {
    // Permanent failures — never retry these
    const permanent = [
      "validation_error",
      "invalid_recipient",
      "invalid_from_address",
      "invalid_api_key",
    ];
    if (permanent.includes(name)) return false;
  }
  return false;
}

/**
 * Post one email through Resend with retry-on-transient-error.
 * Returns the raw Resend response body plus final http status.
 */
async function postResend(
  apiKey: string,
  payload: Record<string, any>
): Promise<{ ok: boolean; status: number; body: any; attempts: number }> {
  let attempts = 0;
  let lastBody: any = null;
  let lastStatus = 0;
  while (attempts < MAX_RETRIES) {
    attempts++;
    try {
      const res = await fetch(RESEND_ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok) return { ok: true, status: res.status, body, attempts };
      lastStatus = res.status;
      lastBody = body;
      if (!isTransientResendError(res.status, body)) break;
      await sleep(RETRY_BASE_DELAY_MS * Math.pow(2, attempts - 1));
    } catch (err: any) {
      lastBody = { error: err?.message ?? "network error" };
      lastStatus = 0;
      if (attempts >= MAX_RETRIES) break;
      await sleep(RETRY_BASE_DELAY_MS * Math.pow(2, attempts - 1));
    }
  }
  return { ok: false, status: lastStatus, body: lastBody, attempts };
}

/** Look up notification preferences for a user; missing = allow everything. */
async function isCategoryAllowed(
  ctx: any,
  userId: string | undefined,
  category: EmailCategory,
  critical: boolean
): Promise<boolean> {
  if (critical) return true;
  if (!userId) return true;
  try {
    const prefs = await ctx.runQuery(internal.emailPreferences.getForUser, {
      userId,
    });
    if (!prefs) return true;
    // schema: map from category -> boolean; default true when unset.
    return prefs[category] !== false;
  } catch {
    return true;
  }
}

/** Check idempotency key; returns existing log id if this was already sent. */
async function findExistingByIdempotency(
  ctx: any,
  idempotencyKey: string | undefined
): Promise<string | null> {
  if (!idempotencyKey) return null;
  try {
    return (await ctx.runQuery(internal.emailLogs.findByIdempotencyKey, {
      idempotencyKey,
      windowMs: IDEMPOTENCY_WINDOW_MS,
    })) as string | null;
  } catch {
    return null;
  }
}

/** Insert a new email log row and return its id. */
async function logEmail(ctx: any, args: Record<string, any>): Promise<string | undefined> {
  try {
    return (await ctx.runMutation(internal.emailLogs.logEmail, args)) as
      | string
      | undefined;
  } catch {
    return undefined;
  }
}

/**
 * Reusable, low-level primitive: renders a template, checks preferences and
 * idempotency, sends via Resend with retry, and logs the outcome.
 * Every other helper (`sendTeamInviteEmail`, `sendPayslipEmail`, …) delegates
 * here so behavior stays uniform.
 */
export async function sendEmail(
  ctx: any,
  options: SendEmailOptions
): Promise<SendEmailResult> {
  const env = resolveEnv();
  if (!env.apiKey) {
    console.warn("[email] RESEND_API_KEY not configured — email skipped");
    return { success: false, status: "failed", error: "email service not configured" };
  }
  if (!isValidEmail(options.to)) {
    return { success: false, status: "failed", error: "invalid recipient email" };
  }

  const rendered = renderTemplate(options.emailType, options.data || {});

  // Preferences
  const allowed = await isCategoryAllowed(
    ctx,
    options.preferencesUserId || options.userId,
    rendered.category,
    rendered.critical || !!options.bypassPreferences
  );
  if (!allowed) {
    await logEmail(ctx, {
      recipient: options.to,
      emailType: String(options.emailType),
      subject: rendered.subject,
      status: "skipped",
      userId: options.userId,
      businessId: options.businessId,
      relatedEntityId: options.relatedEntityId,
      idempotencyKey: options.idempotencyKey,
      failedReason: "user disabled category",
      category: rendered.category,
    });
    return { success: false, status: "skipped", error: "user disabled category" };
  }

  // Idempotency
  const existing = await findExistingByIdempotency(ctx, options.idempotencyKey);
  if (existing) {
    return { success: true, status: "duplicate", emailLogId: existing };
  }

  // Suppression — never re-send to addresses that previously bounced/complained.
  try {
    const suppressed = await ctx.runQuery(internal.emailLogs.isSuppressed, {
      email: options.to.toLowerCase(),
    });
    if (suppressed) {
      await logEmail(ctx, {
        recipient: options.to,
        emailType: String(options.emailType),
        subject: rendered.subject,
        status: "skipped",
        userId: options.userId,
        businessId: options.businessId,
        relatedEntityId: options.relatedEntityId,
        idempotencyKey: options.idempotencyKey,
        failedReason: "recipient suppressed",
        category: rendered.category,
      });
      return { success: false, status: "skipped", error: "recipient suppressed" };
    }
  } catch {
    // suppression check is best-effort — never block sends on lookup failure
  }

  const payload = {
    from: `${env.fromName} <${env.fromEmail}>`,
    to: [options.to],
    reply_to: options.replyTo || env.replyTo,
    subject: rendered.subject,
    html: rendered.html,
    headers: { "X-Sheetpay-Template": String(options.emailType) },
  };

  const { ok, body, attempts } = await postResend(env.apiKey, payload);

  const logId = await logEmail(ctx, {
    recipient: options.to,
    emailType: String(options.emailType),
    subject: rendered.subject,
    status: ok ? "sent" : "failed",
    resendMessageId: ok ? body?.id : undefined,
    userId: options.userId,
    businessId: options.businessId,
    relatedEntityId: options.relatedEntityId,
    idempotencyKey: options.idempotencyKey,
    category: rendered.category,
    attempts,
    sentAt: ok ? Date.now() : undefined,
    failedReason: ok ? undefined : body?.message || body?.name || "resend error",
  });

  if (!ok) {
    return {
      success: false,
      status: "failed",
      error: body?.message || "resend error",
      emailLogId: logId,
    };
  }
  return {
    success: true,
    status: "sent",
    messageId: body?.id as string | undefined,
    emailLogId: logId,
  };
}

/** Template-oriented wrapper (used by callers who don't care about the low-level result). */
export async function sendTemplateEmail(
  ctx: any,
  emailType: TemplateKey | string,
  to: string,
  data: Record<string, any>,
  extras: Partial<SendEmailOptions> = {}
): Promise<SendEmailResult> {
  return sendEmail(ctx, { to, emailType, data, ...extras });
}

// ─── High-level typed helpers ────────────────────────────────────────────────
export async function sendWelcomeEmail(
  ctx: any,
  to: string,
  data: { displayName?: string; userId?: string; businessId?: string }
) {
  return sendEmail(ctx, {
    to,
    emailType: "welcome",
    data: { displayName: data.displayName },
    userId: data.userId,
    businessId: data.businessId,
    idempotencyKey: data.userId ? `welcome:${data.userId}` : undefined,
  });
}

export async function sendTeamInviteEmail(
  ctx: any,
  to: string,
  data: {
    inviterName: string;
    businessName: string;
    role: string;
    inviteeEmail: string;
    token: string;
    inviteLink: string;
    expiresLabel?: string;
    inviterUserId?: string;
    invitationId: string;
    businessId?: string;
  }
) {
  return sendEmail(ctx, {
    to,
    emailType: "teamInvite",
    data,
    userId: data.inviterUserId,
    businessId: data.businessId,
    relatedEntityId: data.invitationId,
    idempotencyKey: `team-invite:${data.invitationId}`,
  });
}

export async function sendPayrollCompletedEmail(
  ctx: any,
  to: string,
  data: {
    period: string;
    employeeCount: number;
    currency: string;
    totalGross: string | number;
    totalDeductions: string | number;
    totalNet: string | number;
    payrollLink?: string;
    payrollRunId: string;
    userId?: string;
    businessId?: string;
  }
) {
  return sendEmail(ctx, {
    to,
    emailType: "payrollCompleted",
    data,
    userId: data.userId,
    businessId: data.businessId,
    relatedEntityId: data.payrollRunId,
    idempotencyKey: `payroll-complete:${data.payrollRunId}:${to}`,
  });
}

export async function sendPayslipEmail(
  ctx: any,
  to: string,
  data: {
    employeeName: string;
    period: string;
    businessName?: string;
    payslipLink?: string;
    payslipId: string;
    detailed?: boolean;
    grossPay?: string;
    netPay?: string;
    currency?: string;
    deductions?: Array<{ label: string; amount: string }>;
    userId?: string;
    businessId?: string;
  }
) {
  return sendEmail(ctx, {
    to,
    emailType: data.detailed ? "payslipDetailed" : "payslipReady",
    data,
    userId: data.userId,
    businessId: data.businessId,
    relatedEntityId: data.payslipId,
    idempotencyKey: `payslip-ready:${data.payslipId}`,
  });
}

export async function sendPasswordOrSecurityEmail(
  ctx: any,
  to: string,
  kind: "passwordReset" | "security" | "verification" | "employeeProfileUpdated" | "accountDeletionRequested" | "accountDeleted",
  data: Record<string, any> & { userId?: string; idempotencyKey?: string }
) {
  return sendEmail(ctx, {
    to,
    emailType: kind,
    data,
    userId: data.userId,
    idempotencyKey: data.idempotencyKey,
    bypassPreferences: true,
  });
}

export async function sendSubscriptionEmail(
  ctx: any,
  to: string,
  kind:
    | "subscriptionStarted"
    | "subscriptionUpgraded"
    | "subscriptionDowngraded"
    | "subscriptionCancelled"
    | "paymentReceipt"
    | "paymentFailed"
    | "trialEnding"
    | "usageLimitWarning",
  data: Record<string, any> & { userId?: string; businessId?: string; eventId?: string }
) {
  return sendEmail(ctx, {
    to,
    emailType: kind,
    data,
    userId: data.userId,
    businessId: data.businessId,
    idempotencyKey: data.eventId ? `${kind}:${data.eventId}` : undefined,
  });
}
