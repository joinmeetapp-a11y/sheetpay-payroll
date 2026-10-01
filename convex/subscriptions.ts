import { mutation, query, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { ACCOUNTANT_PLANS, effectiveAccountantPlan } from "../shared/accountantPlans";
import { isAdminEmail } from "./admin";

/**
 * Paddle price → internal plan mapping.
 * Keep in sync with PADDLE_PRICE_IDS in src/App.tsx and convex/paddle.ts.
 */
export function planForPriceId(priceId?: string | null): "pro" | "accountant_monthly" | "accountant_yearly" | null {
  if (!priceId) return null;
  if (priceId === (process.env.PADDLE_ACCOUNTANT_MONTHLY_PRICE || ACCOUNTANT_PLANS.accountant_monthly.paddlePriceId)) return "accountant_monthly";
  if (priceId === (process.env.PADDLE_ACCOUNTANT_YEARLY_PRICE || ACCOUNTANT_PLANS.accountant_yearly.paddlePriceId)) return "accountant_yearly";
  return priceId === "pri_01m00gw728zjvw770d1k94fh6y" ? "pro" : null;
}

/**
 * Reactive entitlement lookup for the current user.
 * The frontend subscribes to this so features unlock the instant the plan changes
 * (whether from the checkout redirect or a Paddle webhook).
 */
export const getEntitlement = query({
  args: { firebaseUid: v.optional(v.string()) },
  handler: async (ctx, args) => {
    if (!args.firebaseUid) {
      return { plan: "free" as const, planStatus: "none", isPro: false, isAccountant: false };
    }
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || identity.subject !== args.firebaseUid) throw new Error("Unauthenticated");
    const user = await ctx.db
      .query("users")
      .withIndex("by_firebase_uid", (q) => q.eq("firebaseUid", args.firebaseUid!))
      .first();

    // Admin accounts get full access to every feature, regardless of billing.
    if (user && isAdminEmail(user.email)) {
      return {
        plan: "accountant" as const,
        planStatus: "active",
        isPro: true,
        isAccountant: true,
        isAdmin: true,
        paddleSubscriptionId: user.paddleSubscriptionId,
        planUpdatedAt: user.planUpdatedAt,
      };
    }

    const plan = user?.plan === "pro" ? "pro" : effectiveAccountantPlan(user);
    const planStatus = user?.planStatus ?? "none";
    const isActive = planStatus === "active";
    return {
      plan,
      planStatus,
      isPro: isActive && (plan === "pro" || plan.startsWith("accountant")),
      isAccountant: isActive && plan.startsWith("accountant"),
      isAdmin: false,
      paddleSubscriptionId: user?.paddleSubscriptionId,
      planUpdatedAt: user?.planUpdatedAt,
    };
  },
});

/**
 * Idempotency guard for Paddle webhooks. Returns { alreadyProcessed: true } if
 * we've already seen this event_id; otherwise records a placeholder row and
 * returns { alreadyProcessed: false, docId }. The webhook handler then applies
 * the effect and calls markPaddleEventProcessed / markPaddleEventFailed.
 */
export const beginPaddleEvent = internalMutation({
  args: {
    eventId: v.string(),
    eventType: v.string(),
    paddleCustomerId: v.optional(v.string()),
    paddleSubscriptionId: v.optional(v.string()),
    paddleTransactionId: v.optional(v.string()),
    rawEvent: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("paddleEvents")
      .withIndex("by_event_id", (q) => q.eq("eventId", args.eventId))
      .first();
    if (existing) {
      // Allow a Paddle retry to reprocess if the previous attempt errored.
      if (existing.status === "failed" || (existing.status === "pending" && existing.receivedAt < Date.now() - 300000)) {
        await ctx.db.patch(existing._id, { status: "pending", receivedAt: Date.now(), errorMessage: undefined });
        return { alreadyProcessed: false as const, docId: existing._id };
      }
      return { alreadyProcessed: true as const, docId: existing._id };
    }
    const docId = await ctx.db.insert("paddleEvents", {
      eventId: args.eventId,
      eventType: args.eventType,
      status: "pending",
      paddleCustomerId: args.paddleCustomerId,
      paddleSubscriptionId: args.paddleSubscriptionId,
      paddleTransactionId: args.paddleTransactionId,
      rawEvent: args.rawEvent,
      receivedAt: Date.now(),
    });
    return { alreadyProcessed: false as const, docId };
  },
});

export const finishPaddleEvent = internalMutation({
  args: {
    docId: v.id("paddleEvents"),
    status: v.string(), // 'processed' | 'ignored' | 'failed'
    firebaseUid: v.optional(v.string()),
    plan: v.optional(v.string()),
    planStatus: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.docId, {
      status: args.status,
      firebaseUid: args.firebaseUid,
      plan: args.plan,
      planStatus: args.planStatus,
      errorMessage: args.errorMessage,
    });
  },
});

/**
 * Authoritative plan update from the verified Paddle webhook (see convex/http.ts).
 * Matches the user by custom_data.firebaseUid first, then by Paddle customer id.
 */
export const applyPaddleEvent = internalMutation({
  args: {
    firebaseUid: v.optional(v.string()),
    paddleCustomerId: v.optional(v.string()),
    plan: v.union(v.literal("pro"), v.literal("accountant"), v.literal("accountant_monthly"), v.literal("accountant_yearly")),
    occurredAt: v.optional(v.number()),
    billingPeriodStart: v.optional(v.number()),
    billingPeriodEnd: v.optional(v.number()),
    planStatus: v.string(),
    paddleSubscriptionId: v.optional(v.string()),
    paddleTransactionId: v.optional(v.string()),
    priceId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let user = args.firebaseUid
      ? await ctx.db
          .query("users")
          .withIndex("by_firebase_uid", (q) => q.eq("firebaseUid", args.firebaseUid!))
          .first()
      : null;

    if (!user && args.paddleCustomerId) {
      user = await ctx.db
        .query("users")
        .withIndex("by_paddle_customer", (q) =>
          q.eq("paddleCustomerId", args.paddleCustomerId!)
        )
        .first();
    }

    if (!user) return { ok: false, reason: "user_not_found" };

    if (args.occurredAt && user.billingEventAt && args.occurredAt < user.billingEventAt) return { ok: true, ignored: "older_event" };
    if (user.paddleSubscriptionId && args.paddleSubscriptionId && args.paddleSubscriptionId !== user.paddleSubscriptionId && user.planStatus === "active") return { ok: true, ignored: "different_active_subscription" };
    const previousPlan = user.plan ?? "free";
    const previousStatus = user.planStatus ?? "none";
    await ctx.db.patch(user._id, {
      plan: args.plan,
      planStatus: args.planStatus,
      paddleCustomerId: args.paddleCustomerId ?? user.paddleCustomerId,
      paddleSubscriptionId: args.paddleSubscriptionId ?? user.paddleSubscriptionId,
      paddleTransactionId: args.paddleTransactionId ?? user.paddleTransactionId,
      planUpdatedAt: Date.now(),
      paddlePriceId: args.priceId ?? user.paddlePriceId,
      billingPeriodStart: args.billingPeriodStart ?? user.billingPeriodStart,
      billingPeriodEnd: args.billingPeriodEnd ?? user.billingPeriodEnd,
      billingEventAt: args.occurredAt ?? user.billingEventAt,
    });

    // Fire the appropriate subscription email based on the state transition.
    // internal.emails.notifySubscription is idempotent via eventId (the
    // transaction/subscription id), so replaying webhooks won't double-send.
    const planName =
      args.plan.startsWith("accountant") ? "Sheetpay Accountant" : "Sheetpay Pro";
    let kind: string | null = null;
    if (args.planStatus === "canceled") kind = "subscriptionCancelled";
    else if (previousPlan === "free") kind = "subscriptionStarted";
    else if (previousPlan !== args.plan && args.plan === "accountant") kind = "subscriptionUpgraded";
    else if (previousPlan !== args.plan && previousPlan === "accountant") kind = "subscriptionDowngraded";
    else if (previousStatus !== "active" && args.planStatus === "active") kind = "subscriptionStarted";
    else if (args.planStatus === "past_due") kind = "paymentFailed";

    if (kind) {
      await ctx.scheduler.runAfter(0, internal.emails.notifySubscription, {
        to: user.email,
        kind,
        data: {
          planName,
          amount: args.plan.startsWith("accountant")
            ? ACCOUNTANT_PLANS[planForPriceId(args.priceId) === "accountant_yearly" ? "accountant_yearly" : "accountant_monthly"].price.toFixed(2)
            : "29.00",
          currency: "USD",
          billingPeriod: planForPriceId(args.priceId) === "accountant_yearly" ? "yearly" : "monthly",
          displayName: user.displayName,
        },
        userId: user._id,
        eventId:
          args.paddleTransactionId ??
          args.paddleSubscriptionId ??
          `${args.plan}:${args.planStatus}:${user._id}`,
      });
    }
    return { ok: true };
  },
});

