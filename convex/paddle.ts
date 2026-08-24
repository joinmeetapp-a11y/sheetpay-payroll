"use node";
import { action } from "./_generated/server";
import { v } from "convex/values";

const PADDLE_BASE = "https://api.paddle.com";

/**
 * Creates a live Paddle Billing checkout.
 *
 * Paddle Billing has no "/checkout-sessions" endpoint — the correct server-side
 * flow is to create a Transaction and use the hosted `checkout.url` it returns.
 * That URL requires a default payment link to be configured once in the Paddle
 * dashboard (Checkout settings → Default payment link).
 *
 * `custom_data.firebaseUid` / `custom_data.plan` are echoed back on the Paddle
 * webhook (convex/http.ts) so we can unlock the exact plan the user paid for.
 */
export const createCheckoutSession = action({
  args: {
    priceId: v.string(),
    plan: v.optional(v.union(v.literal("pro"), v.literal("accountant"))),
    firebaseUid: v.optional(v.string()),
    customerEmail: v.optional(v.string()),
    successUrl: v.optional(v.string()),
  },
  handler: async (_ctx, args) => {
    const apiKey = process.env.PADDLE_API_KEY;
    if (!apiKey) throw new Error("PADDLE_API_KEY not configured");

    const customData: Record<string, string> = {};
    if (args.firebaseUid) customData.firebaseUid = args.firebaseUid;
    if (args.plan) customData.plan = args.plan;

    const body: Record<string, unknown> = {
      items: [{ price_id: args.priceId, quantity: 1 }],
      collection_mode: "automatic",
    };
    if (Object.keys(customData).length > 0) body.custom_data = customData;

    const res = await fetch(`${PADDLE_BASE}/transactions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Paddle transaction error ${res.status}: ${err}`);
    }

    const json = await res.json();
    const url = json?.data?.checkout?.url as string | undefined;
    if (!url) {
      throw new Error(
        "Paddle did not return a checkout URL. Configure a default payment link in the Paddle dashboard (Checkout settings → Default payment link)."
      );
    }
    return { url, transactionId: json?.data?.id as string | undefined };
  },
});
