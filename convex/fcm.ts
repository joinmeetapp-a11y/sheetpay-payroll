"use node";

import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
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
          webpush: {
            fcm_options: data?.deepLink ? { link: data.deepLink } : undefined,
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
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const accessToken = await getGoogleAccessToken(FCM_SCOPE);

    if (!projectId || !accessToken) {
      await ctx.runMutation(internal.reminders.markOccurrenceStatus, {
        occurrenceId: args.occurrenceId,
        status: "skipped",
        skippedReason: "FCM not configured (FIREBASE_PROJECT_ID + GOOGLE_SERVICE_ACCOUNT_JSON required)",
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
      if (result.ok) {
        messageIds.push(result.messageId);
      } else {
        errors.push(`${t.token.slice(0, 12)}…: ${result.code ?? result.error.slice(0, 80)}`);
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

/**
 * Cron entry point. Called every minute. Claims due reminders (idempotent via
 * the reminderOccurrences ledger) and schedules a delivery action per claim.
 */
export const dispatchDueReminders = internalAction({
  args: {},
  handler: async (ctx) => {
    const claimed: Array<{
      reminderId: any;
      userId: any;
      occurrenceId: string;
      scheduledFor: number;
      type: string;
      title: string;
      messageTemplate?: string;
      deepLink?: string;
    }> = await ctx.runMutation(internal.reminders.claimDueReminders, {
      now: Date.now(),
      limit: 200,
    });

    // Templates cover the common case with no LLM cost. Personalized bodies
    // via Cayla can layer on later — see the §8 cost-control brief.
    const defaultBodyByType: Record<string, string> = {
      payroll: "It's time to run this pay period's payroll. Tap to review and process.",
      attendance: "Review this pay period's attendance before payroll runs.",
      timesheet: "Check pending timesheets so payroll can be processed on time.",
      payslip: "Payslips are ready. Tap to review and send.",
      tax_deadline: "A statutory payment or filing deadline is approaching.",
      custom: "Reminder from Sheetpay.",
    };

    for (const c of claimed) {
      const body =
        c.messageTemplate?.trim() ||
        defaultBodyByType[c.type] ||
        defaultBodyByType.custom;
      await ctx.scheduler.runAfter(0, internal.fcm.deliverOccurrence, {
        occurrenceId: c.occurrenceId,
        reminderId: c.reminderId,
        userId: c.userId,
        title: c.title,
        body,
        deepLink: c.deepLink,
      });
    }
    return { claimed: claimed.length };
  },
});
