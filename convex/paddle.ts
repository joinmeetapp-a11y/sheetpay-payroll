"use node";
import { action, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { billingError, verifiedSubscription } from "./lib/paddleSubscription";
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
async function ownSubscription(ctx: any) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity?.subject) throw new ConvexError("Please sign in again.");
  const user = await ctx.runQuery(internal.users.getBillingDetailsInternal, { firebaseUid: identity.subject });
  if (!user?.plan?.startsWith("accountant") || !user.paddleCustomerId || !user.paddleSubscriptionId) throw billingError();
  const key = process.env.PADDLE_API_KEY;
  if (!key) throw billingError();
  const request = async (path: string, body?: any) => {
    const result = await fetch(`${getPaddleBase(key)}${path}`, { method: body ? "POST" : "GET", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(15000) });
    if (!result.ok) throw billingError();
    const data = (await result.json()).data;
    if (!data) throw billingError();
    return data;
  };
  const data = await request(`/subscriptions/${encodeURIComponent(user.paddleSubscriptionId)}`);
  const state = verifiedSubscription(data, user, identity.subject);
  return { user, subject: identity.subject, data, state, request };
}
async function saveVerifiedSubscription(ctx: any, own: any, data: any) {
  const state = verifiedSubscription(data, own.user, own.subject);
  const result = await ctx.runMutation(internal.subscriptions.applyPaddleEvent, { firebaseUid: own.subject, paddleCustomerId: own.user.paddleCustomerId, paddleSubscriptionId: own.user.paddleSubscriptionId, ...state });
  if (!result.ok || result.ignored) throw billingError();
  return { success: true, plan: state.plan, status: state.planStatus, scheduledCancelAt: state.scheduledCancelAt, billingPeriodEnd: state.billingPeriodEnd ?? null };
}
export const getSubscriptionDetails = action({ args: {}, handler: async ctx => {
  try { const own = await ownSubscription(ctx); return await saveVerifiedSubscription(ctx, own, own.data); }
  catch { throw billingError(); }
} });
export const cancelSubscription = action({ args: { effectiveFrom: v.optional(v.literal("next_billing_period")) }, handler: async ctx => {
  try {
    const own = await ownSubscription(ctx);
    if (own.state.scheduledCancelAt || own.state.planStatus === "canceled") return { ...await saveVerifiedSubscription(ctx, own, own.data), alreadyScheduled: true };
    if (!["active", "trialing", "past_due"].includes(own.state.planStatus)) throw billingError();
    const data = await own.request(`/subscriptions/${encodeURIComponent(own.user.paddleSubscriptionId)}/cancel`, { effective_from: "next_billing_period" });
    const state = verifiedSubscription(data, own.user, own.subject);
    if (!state.scheduledCancelAt && state.planStatus !== "canceled") throw billingError();
    return { ...await saveVerifiedSubscription(ctx, own, data), alreadyScheduled: false };
  } catch { throw billingError(); }
} });
export const getBillingPortal = action({ args: {}, handler: async ctx => {
  try {
    const own = await ownSubscription(ctx);
    const data = await own.request(`/customers/${encodeURIComponent(own.user.paddleCustomerId)}/portal-sessions`, { subscription_ids: [own.user.paddleSubscriptionId] });
    const url = new URL(data.urls?.general?.overview);
    if (url.protocol !== "https:" || !["customer-portal.paddle.com", "sandbox-customer-portal.paddle.com", "buyer-portal.paddle.com", "sandbox-buyer-portal.paddle.com"].includes(url.hostname)) throw billingError();
    return { url: url.href };
  } catch { throw billingError(); }
} });

/** Deployment-only setup for the existing Accountant webhook. Never public. */
export const prepareAccountantWebhook = internalAction({ args: {}, handler: async () => {
  if (process.env.PADDLE_WEBHOOK_SECRET) return { ok: true, alreadyConfigured: true };
  const apiKey = process.env.PADDLE_API_KEY;
  const site = process.env.CONVEX_SITE_URL;
  if (!apiKey || !site?.startsWith('https://') || !site.endsWith('.convex.site')) return { ok: false, reason: 'Existing Paddle key or Convex site URL is unavailable.' };
  const destination = `${site}/paddle/webhook`;
  const events = ['transaction.completed', 'transaction.paid', 'subscription.created', 'subscription.activated', 'subscription.updated', 'subscription.past_due', 'subscription.paused', 'subscription.resumed', 'subscription.canceled'];
  const headers = { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' };
  const response = await fetch(`${getPaddleBase(apiKey)}/notification-settings?per_page=200`, { headers });
  if (!response.ok) return { ok: false, destination, reason: `Paddle notification settings cannot be read (${response.status}). The existing API key needs notification_setting.read permission.` };
  const settings = (await response.json()).data || [];
  let setting = settings.find((item: any) => item.type === 'url' && item.destination === destination && item.active && ['platform', 'all'].includes(item.traffic_source));
  let created = false;
  if (!setting) {
    const result = await fetch(`${getPaddleBase(apiKey)}/notification-settings`, { method: 'POST', headers, body: JSON.stringify({ description: 'Sheetpay Accountant production billing', type: 'url', destination, subscribed_events: events, traffic_source: 'platform', include_sensitive_fields: false }) });
    if (!result.ok) return { ok: false, destination, reason: `Paddle webhook could not be created (${result.status}). Configure this existing Convex endpoint in Paddle Notifications and save its signing secret in Convex.` };
    setting = (await result.json()).data; created = true;
  } else {
    const existingEvents = (setting.subscribed_events || []).map((event: any) => typeof event === 'string' ? event : event.name);
    if (events.some(event => !existingEvents.includes(event))) {
      const updated = await fetch(`${getPaddleBase(apiKey)}/notification-settings/${setting.id}`, { method: 'PATCH', headers, body: JSON.stringify({ subscribed_events: [...new Set([...existingEvents, ...events])] }) });
      if (!updated.ok) return { ok: false, destination, reason: `Paddle webhook events could not be updated (${updated.status}). Subscribe this endpoint to the subscription lifecycle and transaction.completed events.` };
      setting = (await updated.json()).data;
    }
  }
  if (typeof setting?.endpoint_secret_key !== 'string' || setting.endpoint_secret_key.length < 16) {
    const details = await fetch(`${getPaddleBase(apiKey)}/notification-settings/${setting.id}`, { headers });
    if (details.ok) setting = (await details.json()).data;
  }
  if (typeof setting?.endpoint_secret_key !== 'string' || setting.endpoint_secret_key.length < 16 || setting.endpoint_secret_key.length > 500 || /[\r\n\0]/.test(setting.endpoint_secret_key)) return { ok: false, destination, notificationSettingId: setting?.id, created, secretLength: typeof setting?.endpoint_secret_key === 'string' ? setting.endpoint_secret_key.length : 0, reason: 'Paddle did not return a usable notification signing secret. Copy the existing destination signing secret from Paddle Notifications to the Convex PADDLE_WEBHOOK_SECRET setting.' };
  // The deployment redirects this internal result to a private temporary file,
  // installs the secret in Convex, and prints only sanitized status.
  return { ok: true, destination, notificationSettingId: setting.id, created, endpointSecret: setting.endpoint_secret_key };
} });

/** Read the provider to identify legacy billing cadence; never reprice or cancel. */
export const reconcileLegacyAccountantPlans = internalAction({ args: {}, handler: async ctx => {
  const key = process.env.PADDLE_API_KEY;
  if (!key) return { inspected: 0, updated: 0, skipped: 0, failed: 0 };
  const users = await ctx.runQuery((internal as any).users.legacyAccountantBilling, {}) as any[];
  let updated = 0, skipped = 0, failed = 0;
  for (const user of users) {
    const response = await fetch(`${getPaddleBase(key)}/subscriptions/${encodeURIComponent(user.subscriptionId)}`, { headers: { Authorization: `Bearer ${key}` } });
    if (!response.ok) { failed++; continue; }
    const subscription = (await response.json()).data;
    const priceId = subscription?.items?.[0]?.price?.id;
    const plan = priceId === priceFor('accountant_yearly') ? 'accountant_yearly' : priceId === priceFor('accountant_monthly') ? 'accountant_monthly' : null;
    if (!plan || !['active', 'trialing'].includes(subscription.status) || (user.customerId && user.customerId !== subscription.customer_id)) { skipped++; continue; }
    const starts = Date.parse(subscription.current_billing_period?.starts_at), ends = Date.parse(subscription.current_billing_period?.ends_at);
    const result = await ctx.runMutation((internal as any).users.recordVerifiedLegacyPlan, { userId: user.userId, subscriptionId: user.subscriptionId, plan, priceId, ...(Number.isFinite(starts) ? { billingPeriodStart: starts } : {}), ...(Number.isFinite(ends) ? { billingPeriodEnd: ends } : {}) });
    if (result.updated) updated++; else skipped++;
  }
  return { inspected: users.length, updated, skipped, failed };
} });
