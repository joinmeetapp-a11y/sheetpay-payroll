import { mutation, query, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { isAdminEmail } from "./admin";

/**
 * Paddle price → internal plan mapping.
 * Keep in sync with PADDLE_PRICE_IDS in src/App.tsx and convex/paddle.ts.
 */
export const PRICE_TO_PLAN: Record<string, "pro" | "accountant"> = {
  pri_01m00gw728zjvw770d1k94fh6y: "pro",
  pri_01m0r19pgkx604y5q3gp1trhqh: "accountant",
};

export function planForPriceId(priceId?: string | null): "pro" | "accountant" | null {
  if (!priceId) return null;
  return PRICE_TO_PLAN[priceId] ?? null;
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

    const plan = (user?.plan ?? "free") as "free" | "pro" | "accountant";
    const planStatus = user?.planStatus ?? (plan === "free" ? "none" : "active");
    const isActive = planStatus === "active" || planStatus === "pending";
    return {
      plan,
      planStatus,
      isPro: isActive && (plan === "pro" || plan === "accountant"),
      isAccountant: isActive && plan === "accountant",
      isAdmin: false,
      paddleSubscriptionId: user?.paddleSubscriptionId,
      planUpdatedAt: user?.planUpdatedAt,
    };
  },
});

/**
 * Optimistic activation called by the client when Paddle redirects back after a
 * successful payment (successUrl carries ?upgraded=<plan>). The Paddle webhook is
 * the authoritative source and will reconcile status/subscription id afterward.
 */
export const activateFromCheckout = mutation({
  args: {
    firebaseUid: v.string(),
    plan: v.union(v.literal("pro"), v.literal("accountant")),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_firebase_uid", (q) => q.eq("firebaseUid", args.firebaseUid))
      .first();
    if (!user) return { ok: false, reason: "user_not_found" };

    await ctx.db.patch(user._id, {
      plan: args.plan,
      // 'pending' until the webhook confirms 'active'; both count as entitled.
      planStatus: user.planStatus === "active" ? "active" : "pending",
      planUpdatedAt: Date.now(),
    });
    return { ok: true };
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
      if (existing.status === "failed") {
        await ctx.db.patch(existing._id, { status: "pending", errorMessage: undefined });
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
    plan: v.union(v.literal("pro"), v.literal("accountant")),
    planStatus: v.string(),
    paddleSubscriptionId: v.optional(v.string()),
    paddleTransactionId: v.optional(v.string()),
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

    const previousPlan = user.plan ?? "free";
    const previousStatus = user.planStatus ?? "none";
    await ctx.db.patch(user._id, {
      plan: args.plan,
      planStatus: args.planStatus,
      paddleCustomerId: args.paddleCustomerId ?? user.paddleCustomerId,
      paddleSubscriptionId: args.paddleSubscriptionId ?? user.paddleSubscriptionId,
      paddleTransactionId: args.paddleTransactionId ?? user.paddleTransactionId,
      planUpdatedAt: Date.now(),
    });

    // Fire the appropriate subscription email based on the state transition.
    // internal.emails.notifySubscription is idempotent via eventId (the
    // transaction/subscription id), so replaying webhooks won't double-send.
    const planName =
      args.plan === "accountant" ? "Sheetpay Accountant" : "Sheetpay Pro";
    let kind: string | null = null;
    if (args.planStatus === "canceled") kind = "subscriptionCancelled";
    else if (previousPlan === "free" && args.plan !== "free") kind = "subscriptionStarted";
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
          amount: args.plan === "accountant" ? "99.00" : "29.00",
          currency: "USD",
          billingPeriod: "monthly",
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
