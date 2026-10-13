import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { enrollAfterSignup } from "./accountantCampaign";

const tokenArgs = { tokenHash: v.string() };
const HOUR = 60 * 60 * 1000;

export const issue = internalMutation({
  args: { userId: v.id("users"), tokenHash: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user?.emailVerificationRequired || user.emailVerified || user.verifiedEmail === user.email) return { status: "verified" as const };
    const previous = await ctx.db.query("accountantEmailVerifications").withIndex("by_user", q => q.eq("userId", user._id)).unique();
    const now = Date.now();
    const inWindow = !!previous && previous.windowStart > now - HOUR;
    const retryAt = Math.max(previous ? previous.createdAt + 60_000 : 0, inWindow && previous.attempts >= 5 ? previous.windowStart + HOUR : 0);
    if (retryAt > now) return { status: "rate_limited" as const, retryAfter: Math.ceil((retryAt - now) / 1000) };
    const record = { userId: user._id, email: user.email, tokenHash: args.tokenHash, createdAt: now, expiresAt: now + 24 * HOUR, windowStart: inWindow ? previous!.windowStart : now, attempts: inWindow ? previous!.attempts + 1 : 1, consumedAt: undefined };
    if (previous) await ctx.db.replace(previous._id, record);
    else await ctx.db.insert("accountantEmailVerifications", record);
    return { status: "ready" as const, email: user.email, displayName: user.displayName };
  },
});

async function validRecord(ctx: any, tokenHash: string) {
  const record = await ctx.db.query("accountantEmailVerifications").withIndex("by_token", (q: any) => q.eq("tokenHash", tokenHash)).unique();
  if (!record || record.expiresAt < Date.now()) return null;
  const user = await ctx.db.get(record.userId);
  if (!user || !user.emailVerificationRequired || user.email !== record.email) return null;
  return { record, user };
}

export const inspect = internalQuery({ args: tokenArgs, handler: async (ctx, args) => !!await validRecord(ctx, args.tokenHash) });
export const consume = internalMutation({
  args: tokenArgs,
  handler: async (ctx, args) => {
    const result = await validRecord(ctx, args.tokenHash);
    if (!result) return false;
    const { record, user } = result;
    if (record.consumedAt) return user.verifiedEmail === user.email;
    await ctx.db.patch(record._id, { consumedAt: Date.now() });
    await ctx.db.patch(user._id, { verifiedEmail: user.email, emailVerified: true });
    // Enroll only once, after the address owner confirms the account.
    if (!user.emailVerified) {
      await ctx.scheduler.runAfter(0, internal.emails.sendWelcomeInternal, { to: user.email, displayName: user.displayName, userId: String(user._id) });
      await enrollAfterSignup(ctx, { ...user, emailVerified: true });
      await ctx.scheduler.runAfter(0, (internal as any).accountantCampaignWorker.enrollNewUser, { userId: user._id });
    }
    return true;
  },
});
