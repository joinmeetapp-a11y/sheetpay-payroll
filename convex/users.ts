import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { enrollAfterSignup } from "./accountantCampaign";

function requireOwnIdentity(identity: { subject: string } | null, firebaseUid: string) {
  if (!identity || identity.subject !== firebaseUid) throw new Error("Unauthenticated");
}

export const getByFirebaseUid = query({
  args: { firebaseUid: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    requireOwnIdentity(identity, args.firebaseUid);
    return ctx.db.query("users")
      .withIndex("by_firebase_uid", (q) => q.eq("firebaseUid", args.firebaseUid))
      .first();
  },
});

export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    return ctx.db.query("users")
      .withIndex("by_firebase_uid", (q) => q.eq("firebaseUid", identity.subject))
      .first();
  },
});

/** Server-only billing lookup used by the Paddle cancellation action. */
export const getBillingDetailsInternal = internalQuery({
  args: { firebaseUid: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db.query("users")
      .withIndex("by_firebase_uid", (q) => q.eq("firebaseUid", args.firebaseUid))
      .first();
    if (!user) return null;
    return {
      userId: user._id,
      plan: user.plan,
      planStatus: user.planStatus,
      paddleSubscriptionId: user.paddleSubscriptionId,
      paddleCustomerId: user.paddleCustomerId,
    };
  },
});

export const createOrUpdate = mutation({
  args: {
    firebaseUid: v.string(),
    email: v.string(),
    displayName: v.optional(v.string()),
    accountType: v.union(v.literal("business"), v.literal("accountant")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    requireOwnIdentity(identity, args.firebaseUid);
    const tokenEmail = typeof identity.email === "string" ? identity.email.trim().toLowerCase() : "";
    if (!tokenEmail || tokenEmail !== args.email.trim().toLowerCase()) {
      throw new Error("Authenticated email does not match the Firebase identity");
    }

    const existing = await ctx.db.query("users")
      .withIndex("by_firebase_uid", (q) => q.eq("firebaseUid", identity.subject))
      .first();

    if (existing) {
      const patch: Record<string, unknown> = { emailVerified: identity.emailVerified === true };
      if (existing.email !== tokenEmail) patch.email = tokenEmail;
      if (args.displayName && args.displayName !== existing.displayName) patch.displayName = args.displayName;
      if (Object.keys(patch).length) await ctx.db.patch(existing._id, patch);
      return existing._id;
    }

    const id = await ctx.db.insert("users", {
      firebaseUid: identity.subject,
      email: tokenEmail,
      emailVerified: identity.emailVerified === true,
      displayName: args.displayName,
      accountType: args.accountType,
      createdAt: Date.now(),
    });

    await ctx.scheduler.runAfter(0, internal.emails.sendWelcomeInternal, {
      to: tokenEmail,
      displayName: args.displayName,
      userId: String(id),
    });
    if (args.accountType === "accountant") {
      await enrollAfterSignup(ctx, (await ctx.db.get(id))!);
      await ctx.scheduler.runAfter(0, (internal as any).accountantCampaignWorker.enrollNewUser, { userId: id });
    }
    return id;
  },
});

export const updateAccountType = mutation({
  args: {
    firebaseUid: v.string(),
    accountType: v.union(v.literal("business"), v.literal("accountant")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    requireOwnIdentity(identity, args.firebaseUid);
    const user = await ctx.db.query("users")
      .withIndex("by_firebase_uid", (q) => q.eq("firebaseUid", identity.subject))
      .first();
    if (!user) return;
    if (user.accountType !== args.accountType) {
      throw new Error("Account type is set at signup and cannot be changed here");
    }
  },
});

export const setOnboardingCompleted = mutation({
  args: { firebaseUid: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    requireOwnIdentity(identity, args.firebaseUid);
    const user = await ctx.db.query("users")
      .withIndex("by_firebase_uid", (q) => q.eq("firebaseUid", identity.subject))
      .first();
    if (user) await ctx.db.patch(user._id, { onboardingCompleted: true });
  },
});


export const legacyAccountantBilling = internalQuery({ args: {}, handler: async ctx => {
  const users = await ctx.db.query('users').filter(q => q.and(q.eq(q.field('plan'), 'accountant'), q.eq(q.field('planStatus'), 'active'))).take(500);
  return users.filter(user => user.paddleSubscriptionId).map(user => ({ userId: user._id, subscriptionId: user.paddleSubscriptionId!, customerId: user.paddleCustomerId }));
} });
export const recordVerifiedLegacyPlan = internalMutation({
  args: { userId: v.id('users'), subscriptionId: v.string(), plan: v.union(v.literal('accountant_monthly'), v.literal('accountant_yearly')), priceId: v.string(), billingPeriodStart: v.optional(v.number()), billingPeriodEnd: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user || user.plan !== 'accountant' || user.planStatus !== 'active' || user.paddleSubscriptionId !== args.subscriptionId) return { updated: false };
    await ctx.db.patch(user._id, { plan: args.plan, paddlePriceId: args.priceId, ...(args.billingPeriodStart ? { billingPeriodStart: args.billingPeriodStart } : {}), ...(args.billingPeriodEnd ? { billingPeriodEnd: args.billingPeriodEnd } : {}) });
    return { updated: true };
  },
});
