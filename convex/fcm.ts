"use node";

import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal as _internal } from "./_generated/api";
import { getGoogleAccessToken } from "./lib/googleAuth";

/**
 * Firebase Cloud Messaging sender (server-side).
 *
 * Auth: reuses GOOGLE_SERVICE_ACCOUNT_JSON with the FCM scope. That service
 * account must be granted the "Firebase Cloud Messaging API" role on the
 * Firebase project. Alternatively set FIREBASE_ADMIN_JSON to a dedicated
 * Firebase Admin service account JSON.
 *
 * Requires FIREBASE_PROJECT_ID env var (already used elsewhere).
 *
 * No client secret ever ships to the browser: this action runs in Convex.
 */

const FCM_SCOPE = "https://www.googleapis.com/auth/firebase.messaging";
const internal = _internal as any;

interface DeviceToken {
  id: any;
  token: string;
}

async function sendFcmMessage(
  projectId: string,
  accessToken: string,
  token: string,
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<{ ok: true; messageId: string } | { ok: false; error: string; code?: string }> {
  const resp = await fetch(
    `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: {
          token,
          notification: { title, body },
          data: data ?? {},
          android: {
            priority: "high",
            notification: {
              channel_id: "sheetpay_payroll_reminders",
              sound: "default",
            },
          },
          webpush: {
            fcm_options: data?.deepLink ? { link: data.deepLink.startsWith("http") ? data.deepLink : `https://sheetpay.app${data.deepLink.startsWith("/") ? data.deepLink : `/${data.deepLink}`}` } : undefined,
          },
        },
      }),
    }
  );
  if (resp.ok) {
    const json = (await resp.json()) as { name?: string };
    return { ok: true, messageId: json.name ?? "" };
  }
  const text = await resp.text();
  let code: string | undefined;
  try {
    const parsed = JSON.parse(text);
    code = parsed?.error?.details?.[0]?.errorCode ?? parsed?.error?.status;
  } catch {}
  return { ok: false, error: text, code };
}

/**
 * Deliver one reminder occurrence: fan out to every registered device for the
 * user, disable invalid tokens, and record status back on the occurrence row.
 */
export const deliverOccurrence = internalAction({
  args: {
    occurrenceId: v.string(),
    reminderId: v.id("reminders"),
    userId: v.id("users"),
    title: v.string(),
    body: v.string(),
    deepLink: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const firebaseAdminJson = process.env.FIREBASE_ADMIN_JSON;
    let adminProjectId: string | undefined;
    if (firebaseAdminJson) {
      try { adminProjectId = JSON.parse(firebaseAdminJson).project_id; } catch {}
    }
    const projectId = process.env.FIREBASE_PROJECT_ID || adminProjectId || "mysheetpay";
    const accessToken = await getGoogleAccessToken(FCM_SCOPE, firebaseAdminJson);

    if (!projectId || !accessToken) {
      await ctx.runMutation(internal.reminders.markOccurrenceStatus, {
        occurrenceId: args.occurrenceId,
        status: "skipped",
        skippedReason: "FCM not configured (set FIREBASE_ADMIN_JSON, or FIREBASE_PROJECT_ID + GOOGLE_SERVICE_ACCOUNT_JSON)",
      });
      return;
    }

    const tokens: DeviceToken[] = await ctx.runQuery(internal.reminders.getUserDeviceTokens, {
      userId: args.userId,
    });
    if (tokens.length === 0) {
      await ctx.runMutation(internal.reminders.markOccurrenceStatus, {
        occurrenceId: args.occurrenceId,
        status: "skipped",
        skippedReason: "No registered devices",
      });
      return;
    }

    const messageIds: string[] = [];
    const errors: string[] = [];

    for (const t of tokens) {
      const result = await sendFcmMessage(projectId, accessToken, t.token, args.title, args.body, {
        deepLink: args.deepLink ?? "/",
        reminderId: String(args.reminderId),
        occurrenceId: args.occurrenceId,
      });
      if (result.ok === true) {
        messageIds.push(result.messageId);
      } else {
        errors.push(result.code ?? "FCM_SEND_FAILED");
        // Invalid or unregistered → disable so we stop trying.
        if (
          result.code === "UNREGISTERED" ||
          result.code === "INVALID_ARGUMENT" ||
          result.code === "NOT_FOUND"
        ) {
          await ctx.runMutation(internal.reminders.disableDeviceToken, {
            tokenId: t.id,
            reason: result.code,
          });
        }
      }
    }

    await ctx.runMutation(internal.reminders.markOccurrenceStatus, {
      occurrenceId: args.occurrenceId,
      status: messageIds.length > 0 ? "sent" : "failed",
      fcmMessageIds: messageIds,
      errorMessage: errors.length > 0 ? errors.join(" | ") : undefined,
    });
  },
});


/** Deliver the queued push channel for a persisted notification. */
export const deliverNotification = internalAction({
  args: { notificationId: v.id("notifications") },
  handler: async (ctx, args) => {
    const internalApi = internal as any;
    const context: any = await ctx.runQuery(internalApi.notifications.getDeliveryContext, { notificationId: args.notificationId });
    if (!context) return { status: "skipped" };
    const delivery = context.deliveries.find((item: any) => item.channel === "push");
    if (!delivery || delivery.status !== "queued") return { status: delivery?.status || "missing" };
    if (context.preferences?.channels?.push === false) {
      await ctx.runMutation(internalApi.notifications.updateDelivery, { deliveryId: delivery._id, status: "skipped", errorCode: "PUSH_DISABLED" });
      return { status: "skipped" };
    }
    const claimed: any = await ctx.runMutation(internalApi.notifications.claimDelivery, { deliveryId: delivery._id });
    if (!claimed?.claimed) return { status: "already_claimed" };

    const firebaseAdminJson = process.env.FIREBASE_ADMIN_JSON;
    let adminProjectId: string | undefined;
    if (firebaseAdminJson) {
      try { adminProjectId = JSON.parse(firebaseAdminJson).project_id; } catch {}
    }
    const projectId = process.env.FIREBASE_PROJECT_ID || adminProjectId;
    if (!projectId) {
      await ctx.runMutation(internalApi.notifications.updateDelivery, {
        deliveryId: delivery._id, status: "failed", errorCode: "FCM_NOT_CONFIGURED",
        errorMessage: "Firebase project ID is not configured.",
      });
      return { status: "failed" };
    }

    let accessToken: string;
    try { accessToken = await getGoogleAccessToken(FCM_SCOPE, firebaseAdminJson); }
    catch {
      await ctx.runMutation(internalApi.notifications.updateDelivery, {
        deliveryId: delivery._id, status: "failed", errorCode: "FCM_AUTH_FAILED",
        errorMessage: "Firebase notification service could not authenticate.",
      });
      return { status: "failed" };
    }
    const tokens: DeviceToken[] = await ctx.runQuery(internalApi.reminders.getUserDeviceTokens, { userId: context.user._id });
    if (!tokens.length) {
      await ctx.runMutation(internalApi.notifications.updateDelivery, {
        deliveryId: delivery._id, status: "skipped", errorCode: "NO_DEVICE",
        errorMessage: "No active notification devices are registered.",
      });
      return { status: "skipped" };
    }

    const messageIds: string[] = [];
    const failures: string[] = [];
    for (const token of tokens) {
      const result = await sendFcmMessage(projectId, accessToken, token.token, context.notification.title, context.notification.message, {
        notificationId: String(context.notification._id),
        category: String(context.notification.category),
        deepLink: context.notification.actionUrl || "/accountant",
      });
      if (result.ok) messageIds.push(result.messageId);
      else {
        const code = result.code || "FCM_SEND_FAILED";
        failures.push(code);
        if (["UNREGISTERED", "INVALID_ARGUMENT", "NOT_FOUND"].includes(code)) {
          await ctx.runMutation(internalApi.reminders.disableDeviceToken, { tokenId: token.id, reason: code });
        }
      }
    }
    if (messageIds.length) {
      await ctx.runMutation(internalApi.notifications.updateDelivery, {
        deliveryId: delivery._id, status: "sent", messageId: messageIds.join(",").slice(0, 1000),
      });
      return { status: "sent", deviceCount: messageIds.length };
    }
    await ctx.runMutation(internalApi.notifications.updateDelivery, {
      deliveryId: delivery._id, status: failures.some((code) => ["UNREGISTERED", "INVALID_ARGUMENT", "NOT_FOUND"].includes(code)) ? "invalid" : "failed",
      errorCode: failures[0] || "FCM_SEND_FAILED",
      errorMessage: "Firebase could not deliver this notification to the registered devices.",
    });
    return { status: "failed" };
  },
});

/**
 * Cron entry point. Claiming a due reminder creates its notification and
 * schedules its own per-channel delivery, so this job must not send a second
 * copy through the legacy direct-push path.
 */
export const dispatchDueReminders = internalAction({
  args: {},
  handler: async (ctx) => {
    const claimed = await ctx.runMutation(internal.reminders.claimDueReminders, {
      now: Date.now(),
      limit: 200,
    });
    return { claimed: claimed.length };
  },
});
