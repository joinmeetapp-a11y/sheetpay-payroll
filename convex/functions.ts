import { syncBackgroundSchedule } from "./lib/backgroundScheduling";
import { syncSocialPost, scheduleGeneration } from "./lib/socialScheduling";
import { mutation as rawMutation, internalMutation as rawInternalMutation } from "./_generated/server";
import { customCtx, customMutation } from "convex-helpers/server/customFunctions";
import { Triggers } from "convex-helpers/server/triggers";
import type { DataModel } from "./_generated/dataModel";
import { PERFORMANCE_TABLES, syncPerformance } from "./lib/performance";

const triggers = new Triggers<DataModel>();
for (const table of PERFORMANCE_TABLES) {
  triggers.register(table, async (ctx, change) => syncPerformance(ctx, table, String(change.id), change.newDoc));
}
triggers.register('socialPosts', async (ctx, change) => syncSocialPost({...ctx, db:ctx.innerDb}, change.oldDoc, change.newDoc));
triggers.register('socialSettings', async (ctx, change) => {
  const old=change.oldDoc, next=change.newDoc;
  if (next && (!old || ['postingEnabled','postingTime','timezone','postingDays','generationLeadMinutes','portraitId'].some(key=>JSON.stringify((old as any)[key])!==JSON.stringify((next as any)[key])))) await scheduleGeneration({...ctx,db:ctx.innerDb},next);
});
for (const table of ['reminders','accountantEmailCampaigns'] as const) triggers.register(table, async (ctx,change)=>syncBackgroundSchedule({...ctx,db:ctx.innerDb},table,change.oldDoc,change.newDoc));
// Filing caches are invalidated atomically with relevant source changes. No polling.
for(const table of ['payrollRuns','employees','complianceReviews','complianceSupportingData','complianceSettlements'] as const) triggers.register(table,async(ctx,change)=>{
 const before=change.oldDoc as any,next=change.newDoc as any;
 for(const id of new Set([before?.businessId,next?.businessId].filter(Boolean))){const b=await ctx.innerDb.get(id);if(b)await ctx.innerDb.patch(id,{complianceRevision:((b as any).complianceRevision||0)+1});}
});
triggers.register('businesses',async(ctx,change)=>{const a=change.oldDoc as any,b=change.newDoc as any;if(a&&b&&['name','address','countryCode','currency','taxRegistrationId','nisNumber','compliancePayeNumber','compliancePhone','complianceServiceCentreCode'].some(k=>a[k]!==b[k]))await ctx.innerDb.patch(b._id,{complianceRevision:(b.complianceRevision||0)+1});});
// Every backend mutation imports these constructors. Financial and access checks
// stay in their existing handlers; summary updates commit or roll back with them.
export const mutation = customMutation(rawMutation, customCtx(triggers.wrapDB));
export const internalMutation = customMutation(rawInternalMutation, customCtx(triggers.wrapDB));
