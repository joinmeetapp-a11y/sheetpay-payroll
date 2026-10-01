"use node";
import { action, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { ConvexError, v } from "convex/values";
import { ACCOUNTANT_PLANS, type AccountantPlanId } from "../shared/accountantPlans";

// Use sandbox-api.paddle.com when PADDLE_SANDBOX=true or the key starts with
// the sandbox prefix. All other keys hit the live API.
function getPaddleBase(apiKey: string): string {
  if (process.env.PADDLE_SANDBOX === "true" || apiKey.startsWith("pdl_sdbx_")) {
    return "https://sandbox-api.paddle.com";
  }
  return "https://api.paddle.com";
}

/**
 * Creates a Paddle Billing hosted checkout session via the server-side API.
 * Returns the `checkout.url` from the transaction response, or constructs one
 * from the transaction ID when Paddle omits it (no default payment link).
 */
const paidPlanValidator = v.union(v.literal("accountant_monthly"), v.literal("accountant_yearly"));
function priceFor(plan: "accountant_monthly" | "accountant_yearly") {
  return (plan === "accountant_monthly" ? process.env.PADDLE_ACCOUNTANT_MONTHLY_PRICE : process.env.PADDLE_ACCOUNTANT_YEARLY_PRICE) || ACCOUNTANT_PLANS[plan].paddlePriceId;
}
async function verifyPrice(apiKey: string, plan: "accountant_monthly" | "accountant_yearly") {
  const priceId = priceFor(plan), expected = ACCOUNTANT_PLANS[plan];
  const response = await fetch(`${getPaddleBase(apiKey)}/prices/${priceId}`, { headers: { Authorization: `Bearer ${apiKey}` } });
  if (!response.ok) throw new ConvexError("Paddle pricing could not be verified. Contact Sheetpay support before subscribing.");
  const price = (await response.json()).data;
  if (price?.status !== "active" || price?.unit_price?.currency_code !== "USD" || Number(price?.unit_price?.amount) !== expected.price * 100 || price?.billing_cycle?.interval !== expected.interval || price?.billing_cycle?.frequency !== 1) throw new ConvexError(`Paddle ${expected.name} price must be ${expected.priceLabel} USD recurring. Checkout is unavailable until it matches.`);
  return { priceId, price };
}
export const verifyAccountantPrices = internalAction({ args: {}, handler: async () => {
  const key = process.env.PADDLE_API_KEY;
  if (!key) return { ok: false, reason: "PADDLE_API_KEY is not configured" };
  const results = [];
  for (const plan of ["accountant_monthly", "accountant_yearly"] as const) {
    try { const result = await verifyPrice(key, plan); results.push({ plan, priceId: result.priceId, ok: true, amount: ACCOUNTANT_PLANS[plan].price, currency: "USD", interval: result.price.billing_cycle.interval }); }
    catch (error: any) { results.push({ plan, priceId: priceFor(plan), ok: false, reason: error?.data || error?.message || "Price verification failed" }); }
  }
  return { ok: results.every(item => item.ok), results, signedWebhookConfigured: !!process.env.PADDLE_WEBHOOK_SECRET };
} });
export const createCheckoutSession = action({
  args: { plan: v.union(paidPlanValidator, v.literal("accountant"), v.literal("pro")), priceId: v.optional(v.string()), productId: v.optional(v.string()), firebaseUid: v.optional(v.string()), customerEmail: v.optional(v.string()), successUrl: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity?.subject || (args.firebaseUid && identity.subject !== args.firebaseUid)) throw new ConvexError("Unauthenticated");
    const plan = args.plan === "accountant" ? args.priceId === priceFor("accountant_yearly") ? "accountant_yearly" : args.priceId === priceFor("accountant_monthly") ? "accountant_monthly" : null : args.plan === "pro" ? null : args.plan;
    if (!plan) throw new ConvexError("Choose a valid Accountant plan.");
    const user = await ctx.runQuery(internal.users.getBillingDetailsInternal, { firebaseUid: identity.subject });
    if (!user) throw new ConvexError("Finish account setup before subscribing.");
    if (user.paddleSubscriptionId && ["active", "trialing", "past_due"].includes(user.planStatus || '')) throw new ConvexError("You already have a subscription. Manage it from Settings; a second subscription will not be created.");
    const apiKey = process.env.PADDLE_API_KEY;
    if (!apiKey || !process.env.PADDLE_WEBHOOK_SECRET) throw new ConvexError("Secure billing is not configured. Contact Sheetpay support.");
    const { priceId } = await verifyPrice(apiKey, plan);
    const guard = await ctx.runMutation((internal as any).accountantCheckouts.begin, { userId: user.userId, plan });
    if (guard.transactionId) return { transactionId: guard.transactionId, plan, priceId };
    if (guard.busy) throw new ConvexError("Checkout is already being prepared. Please wait a moment and try again.");
    try {
    const response = await fetch(`${getPaddleBase(apiKey)}/transactions`, { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ items: [{ price_id: priceId, quantity: 1 }], collection_mode: "automatic", custom_data: { firebaseUid: identity.subject, plan }, ...(user.paddleCustomerId ? { customer_id: user.paddleCustomerId } : {}) }) });
    if (!response.ok) throw new ConvexError("Paddle could not prepare checkout. Please try again or contact Sheetpay support.");
    const transaction = (await response.json()).data;
    if (!transaction?.id) throw new ConvexError("Paddle did not confirm the checkout transaction.");
    await ctx.runMutation((internal as any).accountantCheckouts.finish, { id: guard.id, transactionId: transaction.id });
    return { transactionId: transaction.id, plan, priceId };
    } catch (error) { await ctx.runMutation((internal as any).accountantCheckouts.finish, { id: guard.id }); throw error; }
  },
});


/**
 * Schedules cancellation of the signed-in accountant's Paddle subscription.
 * Paddle remains the billing authority; access stays active through the paid term.
 */
export const cancelSubscription = action({
  args: {
    effectiveFrom: v.optional(v.literal("next_billing_period")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity?.subject) throw new Error("Unauthenticated");

    const user = await ctx.runQuery(internal.users.getBillingDetailsInternal, {
      firebaseUid: identity.subject,
    });
    if (!user || !user.plan?.startsWith("accountant") || user.planStatus !== "active") {
      throw new Error("No active Sheetpay Accountant subscription was found for this account.");
    }
    if (!user.paddleSubscriptionId) {
      throw new Error("Paddle has not linked a subscription to this account yet. Please contact support.");
    }

    const apiKey = process.env.PADDLE_API_KEY;
    if (!apiKey) throw new Error("PADDLE_API_KEY not configured in Convex environment variables");

    const paddleBase = getPaddleBase(apiKey);
    const res = await fetch(
      `${paddleBase}/subscriptions/${encodeURIComponent(user.paddleSubscriptionId)}/cancel`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ effective_from: args.effectiveFrom ?? "next_billing_period" }),
      },
    );

    const responseText = await res.text();
    let payload: any = {};
    try { payload = responseText ? JSON.parse(responseText) : {}; } catch { /* Keep Paddle's raw error below. */ }
    if (!res.ok) {
      const detail = payload?.error?.detail || payload?.error?.message || responseText;
      throw new Error(`Paddle API error ${res.status}: ${detail || "Cancellation failed."}`);
    }

    const effectiveAt = payload?.data?.scheduled_change?.effective_at;
    return {
      success: true,
      effectiveAt,
      message: effectiveAt
        ? `Cancellation scheduled for ${effectiveAt}. Your access remains active until then.`
        : "Cancellation scheduled for the end of your current billing period. Your access remains active until then.",
    };
  },
});

