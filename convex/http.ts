import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { planForPriceId } from "./subscriptions";

const http = httpRouter();

/**
 * Verify a Paddle webhook signature.
 * Header format: `Paddle-Signature: ts=<unix>;h1=<hex hmac-sha256 of "ts:body">`
 * Secret is the notification destination's secret (PADDLE_WEBHOOK_SECRET).
 */
async function verifyPaddleSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string
): Promise<boolean> {
  if (!signatureHeader) return false;
  const parts = Object.fromEntries(
    signatureHeader.split(";").map((kv) => {
      const idx = kv.indexOf("=");
      return [kv.slice(0, idx).trim(), kv.slice(idx + 1).trim()];
    })
  ) as Record<string, string>;

  const ts = parts["ts"];
  const h1 = parts["h1"];
  if (!ts || !h1) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sigBuf = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${ts}:${rawBody}`)
  );
  const computed = Array.from(new Uint8Array(sigBuf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // Constant-time-ish comparison
  if (computed.length !== h1.length) return false;
  let mismatch = 0;
  for (let i = 0; i < computed.length; i++) {
    mismatch |= computed.charCodeAt(i) ^ h1.charCodeAt(i);
  }
  return mismatch === 0;
}

/**
 * Verify a Resend webhook signature.
 * Resend uses Svix — signature header: `svix-signature: v1,<base64(hmac-sha256)>`
 * along with `svix-id` and `svix-timestamp`. The signed payload is
 * `${svix-id}.${svix-timestamp}.${rawBody}`.
 */
async function verifyResendSignature(
  rawBody: string,
  svixId: string | null,
  svixTimestamp: string | null,
  svixSignature: string | null,
  secretBase64: string
): Promise<boolean> {
  if (!svixId || !svixTimestamp || !svixSignature) return false;
  // Reject events older than 5 minutes to blunt replay attacks.
  const ts = Number(svixTimestamp);
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > 300) return false;
  const secret = secretBase64.startsWith("whsec_")
    ? secretBase64.slice("whsec_".length)
    : secretBase64;
  const rawSecret = Uint8Array.from(atob(secret), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    "raw",
    rawSecret,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signed = `${svixId}.${svixTimestamp}.${rawBody}`;
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signed));
  const expected = btoa(String.fromCharCode(...new Uint8Array(sig)));
  // Svix header may contain multiple space-separated `vN,<b64>` entries.
  const provided = svixSignature
    .split(" ")
    .map((s) => s.split(",")[1])
    .filter(Boolean);
  // Constant-time comparison
  for (const p of provided) {
    if (p.length !== expected.length) continue;
    let mismatch = 0;
    for (let i = 0; i < expected.length; i++) mismatch |= p.charCodeAt(i) ^ expected.charCodeAt(i);
    if (mismatch === 0) return true;
  }
  return false;
}

http.route({
  path: "/resend/webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const secret = process.env.RESEND_WEBHOOK_SECRET;
    const rawBody = await request.text();

    if (secret) {
      const ok = await verifyResendSignature(
        rawBody,
        request.headers.get("svix-id"),
        request.headers.get("svix-timestamp"),
        request.headers.get("svix-signature"),
        secret
      );
      if (!ok) return new Response("Invalid signature", { status: 401 });
    }

    let event: any;
    try {
      event = JSON.parse(rawBody);
    } catch {
      return new Response("Invalid JSON", { status: 400 });
    }

    const type: string = event?.type ?? "";
    const data = event?.data ?? {};
    const emailId: string | undefined = data?.email_id ?? data?.id;
    if (!emailId) return new Response("No email id", { status: 200 });

    let newStatus: string | null = null;
    let deliveredAt: number | undefined;
    let errorMessage: string | undefined;

    switch (type) {
      case "email.sent":
        newStatus = "sent";
        break;
      case "email.delivered":
        newStatus = "delivered";
        deliveredAt = Date.now();
        break;
      case "email.delivery_delayed":
        newStatus = "delayed";
        break;
      case "email.bounced":
        newStatus = "bounced";
        errorMessage = data?.bounce?.reason || "Bounced";
        break;
      case "email.complained":
        newStatus = "complained";
        errorMessage = "Recipient complaint";
        break;
    }

    if (newStatus) {
      await ctx.runMutation(internal.emailLogs.updateStatusByResendId, {
        resendMessageId: emailId,
        status: newStatus,
        errorMessage,
        deliveredAt,
      });
    }

    // Suppress bounced or complained addresses so we don't keep sending.
    if (type === "email.bounced" || type === "email.complained") {
      const to = Array.isArray(data?.to) ? data.to[0] : data?.to;
      if (typeof to === "string") {
        await ctx.runMutation(internal.emailLogs.addSuppression, {
          emailAddress: to.toLowerCase(),
          reason: type === "email.bounced" ? "bounce" : "complaint",
        });
      }
    }

    return new Response("OK", { status: 200 });
  }),
});

http.route({
  path: "/paddle/webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const secret = process.env.PADDLE_WEBHOOK_SECRET;
    const rawBody = await request.text();

    if (secret) {
      const ok = await verifyPaddleSignature(
        rawBody,
        request.headers.get("Paddle-Signature"),
        secret
      );
      if (!ok) return new Response("Invalid signature", { status: 401 });
    }

    let event: any;
    try {
      event = JSON.parse(rawBody);
    } catch {
      return new Response("Invalid JSON", { status: 400 });
    }

    const type: string = event?.event_type ?? "";
    const data = event?.data ?? {};
    const eventId: string | undefined = event?.event_id ?? event?.notification_id;

    // Every delivered event must carry an id we can dedupe on. Without one we
    // cannot guarantee idempotency, so we refuse to process it.
    if (!eventId) {
      return new Response("Missing event_id", { status: 400 });
    }

    // Full lifecycle coverage per the admin brief.
    const relevant = new Set([
      "transaction.completed",
      "transaction.paid",
      "subscription.created",
      "subscription.activated",
      "subscription.updated",
      "subscription.past_due",
      "subscription.paused",
      "subscription.resumed",
      "subscription.canceled",
    ]);

    const paddleCustomerId: string | undefined = data?.customer_id ?? undefined;
    const paddleSubscriptionId: string | undefined = type.startsWith("subscription")
      ? data?.id
      : data?.subscription_id;
    const paddleTransactionId: string | undefined = type.startsWith("transaction")
      ? data?.id
      : undefined;

    // Idempotency guard — insert a placeholder for this event_id or bail if
    // we've already handled it. This survives at-least-once webhook delivery.
    const guard = await ctx.runMutation(internal.subscriptions.beginPaddleEvent, {
      eventId,
      eventType: type,
      paddleCustomerId,
      paddleSubscriptionId,
      paddleTransactionId,
      rawEvent: rawBody,
    });
    if (guard.alreadyProcessed) {
      return new Response("Duplicate", { status: 200 });
    }

    if (!relevant.has(type)) {
      await ctx.runMutation(internal.subscriptions.finishPaddleEvent, {
        docId: guard.docId,
        status: "ignored",
      });
      return new Response("Ignored", { status: 200 });
    }

    const customData = data?.custom_data ?? {};
    const firebaseUid: string | undefined = customData?.firebaseUid;

    const priceId: string | undefined = data?.items?.[0]?.price?.id;
    const plan =
      (customData?.plan as "pro" | "accountant" | undefined) ??
      planForPriceId(priceId) ??
      "pro";

    // Map Paddle event/status → our planStatus.
    let planStatus = "active";
    if (type === "subscription.canceled") planStatus = "canceled";
    else if (type === "subscription.paused") planStatus = "paused";
    else if (type === "subscription.past_due" || data?.status === "past_due")
      planStatus = "past_due";
    else if (type === "subscription.resumed" || type === "subscription.activated")
      planStatus = "active";
    else if (data?.status === "trialing") planStatus = "active";

    try {
      await ctx.runMutation(internal.subscriptions.applyPaddleEvent, {
        firebaseUid,
        paddleCustomerId,
        plan,
        planStatus,
        paddleSubscriptionId,
        paddleTransactionId,
      });
      await ctx.runMutation(internal.subscriptions.finishPaddleEvent, {
        docId: guard.docId,
        status: "processed",
        firebaseUid,
        plan,
        planStatus,
      });
    } catch (err: any) {
      await ctx.runMutation(internal.subscriptions.finishPaddleEvent, {
        docId: guard.docId,
        status: "failed",
        errorMessage: String(err?.message ?? err),
      });
      // Return 500 so Paddle retries. Our idempotency guard already noted the
      // event id, so we clear the failed row on retry — see beginPaddleEvent
      // when the row status is 'failed' we allow reprocessing.
      throw err;
    }

    return new Response("OK", { status: 200 });
  }),
});

export default http;
