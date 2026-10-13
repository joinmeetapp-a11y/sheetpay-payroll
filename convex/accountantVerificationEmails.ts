"use node";
import { action, internalAction } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { v } from "convex/values";
import { randomBytes, createHash } from "node:crypto";
import { sendEmail } from "./lib/email";

async function deliver(ctx: any, userId: any) {
  const site = process.env.CONVEX_SITE_URL;
  if (!site || !/^https:\/\/[a-z0-9-]+\.convex\.site$/.test(site)) throw new Error("Email verification is not configured. Contact support@sheetpay.app.");
  const token = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const result = await ctx.runMutation((internal as any).accountantVerification.issue, { userId, tokenHash });
  if (result.status !== "ready") return result;
  const sent = await sendEmail(ctx, { to: result.email, emailType: "verification", data: { displayName: result.displayName, verifyLink: `${site}/accountant/verify-email?token=${token}` }, userId: String(userId), idempotencyKey: `accountant-verify:${tokenHash}` });
  // Keep the bearer token out of logs, public action results and user documents.
  if (!sent.success) throw new Error("We could not send your verification email. Please try again in a minute or contact support@sheetpay.app.");
  return { status: "sent" as const, retryAfter: 60 };
}

export const sendForUser = internalAction({ args: { userId: v.id("users") }, handler: (ctx, args) => deliver(ctx, args.userId) });
export const resend = action({
  args: {},
  handler: async ctx => {
    const user = await ctx.runQuery(api.users.getCurrentUser, {});
    if (!user) throw new Error("Sign in to resend your verification email.");
    const identity = await ctx.auth.getUserIdentity();
    if (identity?.email?.trim().toLowerCase() !== user.email) throw new Error("Your sign-in email has changed. Sign out and sign in again before verifying.");
    if (user.accountantEmailAccess) return { status: "verified" as const };
    return deliver(ctx, user._id);
  },
});
