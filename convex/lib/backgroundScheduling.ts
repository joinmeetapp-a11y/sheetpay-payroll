import type { MutationCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import { cancelPending } from "./socialScheduling";

export async function syncBackgroundSchedule(ctx: MutationCtx, table: "reminders" | "accountantEmailCampaigns", old: any, next: any) {
  const time = table === "reminders" ? next?.nextRunAt : next?.nextSendAt;
  const oldTime = table === "reminders" ? old?.nextRunAt : old?.nextSendAt;
  const enabled = next && (table === "reminders" ? next.enabled : next.status === "active");
  const oldEnabled = old && (table === "reminders" ? old.enabled : old.status === "active");
  if (old?.scheduledFunctionId && time === oldTime && enabled === oldEnabled) return;
  await cancelPending(ctx, old?.scheduledFunctionId);
  if (!next) return;
  let scheduledFunctionId;
  if (enabled) scheduledFunctionId = table === "reminders"
    ? await ctx.scheduler.runAt(Math.max(Date.now(), time), (internal as any).reminders.dispatchScheduled, { reminderId: next._id, scheduledFor: time })
    : await ctx.scheduler.runAt(Math.max(Date.now(), time), (internal as any).accountantCampaignWorker.sendDay, { campaign: next._id });
  await ctx.db.patch(next._id, { scheduledFunctionId });
}
