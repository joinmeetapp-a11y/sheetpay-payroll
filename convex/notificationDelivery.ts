"use node";

import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal as _internal } from "./_generated/api";

const internal = _internal as any;

export const dispatchNotification = internalAction({
  args: { notificationId: v.id("notifications") },
  handler: async (ctx, args) => {
    const context = await ctx.runQuery(internal.notifications.getDeliveryContext, {
      notificationId: args.notificationId,
    }) as any;
    if (!context) return { skipped: "notification or recipient unavailable" };

    const deliveries = await ctx.runQuery(internal.notifications.listDeliveriesForNotification, {
      notificationId: args.notificationId,
    }) as any[];
    const categoryKey: Record<string, string> = { payroll: "payrollReminders", reminder: "payrollReminders", payslip: "payslipReminders", failedPayslip: "failedPayslipAlerts", import: "ocrReviewAlerts", ocrReview: "ocrReviewAlerts", team: "teamActivity", billing: "billingAlerts", tax: "yearlyTaxReminders" };
    const preferenceKey = categoryKey[context.notification.category] || "payrollReminders";
    const categoryEnabled = context.preferences?.categories?.[preferenceKey] !== false;
    const results: Record<string, string> = {};

    for (const delivery of deliveries) {
      if (delivery.status !== "queued") continue;
      const channelEnabled = delivery.channel === "push" ? context.preferences?.channels?.push !== false : context.preferences?.channels?.email !== false;
      if (!categoryEnabled || !channelEnabled) {
        await ctx.runMutation(internal.notifications.updateDelivery, { deliveryId: delivery._id, status: "skipped", errorCode: !categoryEnabled ? "CATEGORY_DISABLED" : "CHANNEL_DISABLED" });
        continue;
      }
      if (delivery.channel === "push") {
        try {
          const result = await ctx.runAction(internal.fcm.deliverNotification, {
            notificationId: args.notificationId,
          }) as any;
          results.push = result?.status || "processed";
        } catch {
          await ctx.runMutation(internal.notifications.updateDelivery, {
            deliveryId: delivery._id,
            status: "failed",
            errorCode: "FCM_DELIVERY_ERROR",
            errorMessage: "Firebase could not process this notification.",
          });
          results.push = "failed";
        }
        continue;
      }
      if (delivery.channel !== "email") continue;

      const claim = await ctx.runMutation(internal.notifications.claimDelivery, {
        deliveryId: delivery._id,
      }) as any;
      if (!claim?.claimed) continue;

      try {
        const sent = await ctx.runAction(internal.emails.sendAccountantReminder, {
          notificationId: args.notificationId,
          to: context.user.email,
          userId: String(context.user._id),
          businessId: context.business ? String(context.business._id) : undefined,
          title: context.notification.title,
          message: context.notification.message,
          businessName: context.business?.name,
          category: context.notification.category,
          actionUrl: context.notification.actionUrl || "/accountant",
          employeeCount: context.notification.metadata?.employeeCount,
          payPeriod: context.notification.metadata?.payPeriod,
          scheduledLabel: context.notification.metadata?.scheduledLabel,
        }) as any;
        const status = sent?.success ? "sent" : sent?.status === "skipped" ? "skipped" : "failed";
        await ctx.runMutation(internal.notifications.updateDelivery, {
          deliveryId: delivery._id,
          status,
          messageId: sent?.messageId ? String(sent.messageId) : undefined,
          errorCode: status === "failed" ? "RESEND_FAILED" : undefined,
          errorMessage: status === "failed" ? String(sent?.error || "Resend could not send this reminder.").slice(0, 400) : undefined,
        });
        results.email = status;
      } catch (error: any) {
        await ctx.runMutation(internal.notifications.updateDelivery, {
          deliveryId: delivery._id,
          status: "failed",
          errorCode: "RESEND_ERROR",
          errorMessage: String(error?.message || "Resend delivery failed.").slice(0, 400),
        });
        results.email = "failed";
      }
    }
    await ctx.runMutation(internal.reminders.syncReminderOccurrenceFromNotification, { notificationId: args.notificationId });
    return { results };
  },
});
