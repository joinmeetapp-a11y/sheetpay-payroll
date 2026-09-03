"use node";
import { action } from "./_generated/server";
import { v } from "convex/values";

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
    if (!apiKey) throw new Error("PADDLE_API_KEY not configured in Convex environment variables");

    const paddleBase = getPaddleBase(apiKey);

    const customData: Record<string, string> = {};
    if (args.firebaseUid) customData.firebaseUid = args.firebaseUid;
    if (args.plan) customData.plan = args.plan;

    const body: Record<string, unknown> = {
      items: [{ price_id: args.priceId, quantity: 1 }],
      collection_mode: "automatic",
    };

    // Associate the purchase with the customer's email so Paddle shows it on
    // the hosted checkout page and the customer receives a receipt email.
    if (args.customerEmail) {
      body.customer = { email: args.customerEmail };
    }

    // Set the success redirect URL directly on the checkout — this also causes
    // Paddle to always return checkout.url in the transaction response.
    if (args.successUrl) {
      body.checkout = { success_url: args.successUrl };
    }

    if (Object.keys(customData).length > 0) {
      body.custom_data = customData;
    }

    const res = await fetch(`${paddleBase}/transactions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Paddle API error ${res.status}: ${errText}`);
    }

    const json = await res.json();
    const txnId = json?.data?.id as string | undefined;
    let url = json?.data?.checkout?.url as string | undefined;

    // Fallback: construct a hosted-checkout URL from the transaction ID when
    // Paddle omits checkout.url (e.g. no default payment link configured).
    if (!url && txnId) {
      const checkoutBase = paddleBase.includes("sandbox")
        ? "https://sandbox-checkout.paddle.com"
        : "https://checkout.paddle.com";
      url = `${checkoutBase}/checkout/custom/${txnId}`;
    }

    if (!url) {
      throw new Error("Paddle did not return a checkout URL for this transaction.");
    }

    return { url, transactionId: txnId };
  },
});
