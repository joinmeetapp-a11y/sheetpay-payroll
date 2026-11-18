import type { MutationCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import { localClock, scheduledInstant } from "./socialContent";

export async function cancelPending(ctx: MutationCtx, id: import("../_generated/dataModel").Id<"_scheduled_functions"> | undefined) {
  if (!id) return;
  const job = await ctx.db.system.get(id);
  if (job?.state.kind === "pending") await ctx.scheduler.cancel(id);
}
export async function syncSocialPost(ctx: MutationCtx, old: any, post: any) {
  const eligible = post && ["scheduled", "approved"].includes(post.status) && !post.testCompletedAt && !post.publishRequestStartedAt && !post.outcomeUnknown && !post.linkedinPostId && (!post.approvalRequired || post.approvedAt);
  const same = old && eligible && old.revision === post.revision && old.scheduledFor === post.scheduledFor && old.status === post.status && old.scheduledFunctionId;
  if (same) { const job=await ctx.db.system.get(old.scheduledFunctionId as import("../_generated/dataModel").Id<"_scheduled_functions">); if(job && ["pending","inProgress"].includes(job.state.kind))return; }
  await cancelPending(ctx, old?.scheduledFunctionId);
  if (!post) return;
  let scheduledFunctionId;
  if (eligible) scheduledFunctionId = await ctx.scheduler.runAt(Math.max(Date.now(), post.scheduledFor), (internal as any).social.publishScheduled, { id: post._id, revision: post.revision, scheduledFor: post.scheduledFor });
  if (post.scheduledFunctionId !== scheduledFunctionId) await ctx.db.patch(post._id, { scheduledFunctionId });
}

/** One future generation wakeup for the configured local calendar; no minute polling. */
export async function scheduleGeneration(ctx: MutationCtx, settings: any) {
  await cancelPending(ctx, settings.generationFunctionId);
  if (!settings.postingEnabled || !settings.portraitId) {
    if (settings.generationFunctionId) await ctx.db.patch(settings._id, { generationFunctionId: undefined, nextGenerationAt: undefined });
    return;
  }
  const now = Date.now();
  for (let offset = 0; offset <= 8; offset++) {
    const reference = now + offset * 86400000, clock = localClock(reference, settings.timezone);
    if (!settings.postingDays.includes(clock.day)) continue;
    const target = scheduledInstant(reference, settings.timezone, settings.postingTime);
    if (target === null || target + 1800000 <= now) continue;
    if (await ctx.db.query("socialPosts").withIndex("by_day", q => q.eq("dayKey", clock.date)).first()) continue;
    const wakeAt = Math.max(now, target - settings.generationLeadMinutes * 60000);
    const generationFunctionId = await ctx.scheduler.runAt(wakeAt, (internal as any).social.generateScheduled, { targetAt: target, wakeAt });
    await ctx.db.patch(settings._id, { generationFunctionId, nextGenerationAt: wakeAt });
    return;
  }
}
