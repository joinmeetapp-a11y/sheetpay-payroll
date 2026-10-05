import { query, mutation, internalQuery, internalMutation, QueryCtx, MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { v, ConvexError } from "convex/values";
import { Id, Doc } from "./_generated/dataModel";
import { resolveAdmin } from "./admin";
import { SOCIAL_DEFAULTS, SOCIAL_TOPICS, localClock, scheduledInstant, validateSchedule, validateCaption, validateImageText } from "./lib/socialContent";

export async function requireSocialAdmin(ctx: QueryCtx) {
  const identity = await ctx.auth.getUserIdentity();
  const admin = await resolveAdmin(ctx, identity?.subject);
  if (!admin || !["super_admin", "admin"].includes(admin.role)) throw new ConvexError("SOCIAL_ADMIN_REQUIRED");
  if (!identity?.email || identity.email.toLowerCase() !== admin.email.toLowerCase()) throw new ConvexError("SOCIAL_ADMIN_REQUIRED");
  return admin;
}
async function settingsRow(ctx: QueryCtx) {
  return ctx.db.query("socialSettings").withIndex("by_key", q => q.eq("key", "kurt-prince")).unique();
}
async function ownedPost(ctx: QueryCtx, id: Id<"socialPosts">) {
  const post = await ctx.db.get(id);
  const settings = await settingsRow(ctx);
  if (!post || !settings || post.ownerId !== settings.ownerId) throw new ConvexError("Post not found");
  return post;
}
function editable(post: Doc<"socialPosts">) {
  if (["generating","publishing","published","skipped"].includes(post.status) || post.outcomeUnknown || post.publishRequestStartedAt) throw new ConvexError("Post is locked");
}
async function log(ctx: MutationCtx, event: string, phase: string, postId?: Id<"socialPosts">, message?: string) {
  await ctx.db.insert("socialGenerationLogs", {event,phase,postId,message,createdAt:Date.now()});
}
export const access = query({args:{},handler:async ctx => {
  try { await requireSocialAdmin(ctx); return { authorized: true }; } catch { return { authorized: false }; }
}});
export const initialize = mutation({args:{},handler:async ctx => {
  const actor = await requireSocialAdmin(ctx);
  if (!await settingsRow(ctx)) {
    await ctx.db.insert("socialSettings",{ key:"kurt-prince",ownerId:actor.userId,...SOCIAL_DEFAULTS,updatedAt:Date.now() });
    for (const name of SOCIAL_TOPICS) {
      if (!await ctx.db.query("socialTopics").withIndex("by_name",q=>q.eq("name",name)).first())
        await ctx.db.insert("socialTopics",{name,enabled:true,useCount:0,createdAt:Date.now()});
    }
  }
}});
export const dashboard = query({args:{},handler:async ctx => {
  await requireSocialAdmin(ctx);
  const settings = await settingsRow(ctx);
  if (!settings) return null;
  const connection = await ctx.db.query("linkedinConnections").withIndex("by_owner",q=>q.eq("ownerId",settings.ownerId)).unique();
  const posts = await ctx.db.query("socialPosts").order("desc").take(500);
  const logs = await ctx.db.query("socialGenerationLogs").order("desc").take(500);
  const topics = await ctx.db.query("socialTopics").take(100);
  const today = localClock(Date.now(),settings.timezone).date;
  // Deliberately project connection fields. Never spread the credentials row.
  return {settings,topics,posts:posts.map(({embedding,...p})=>p),
    today:posts.find(p=>p.dayKey===today)?._id,
    livePublishingApproved:process.env.SOCIAL_LIVE_PUBLISH_APPROVED==="true",
    connection:connection?{name:connection.name,memberUrn:connection.memberUrn,
      expiresAt:connection.expiresAt,status:connection.expiresAt<=Date.now()?"expired":connection.status,
      verifiedAt:connection.verifiedAt,lastSuccessfulPostAt:connection.lastSuccessfulPostAt}:null,
    analytics:{window:"Latest 500 posts/events",generated:posts.filter(p=>p.caption).length,
      published:posts.filter(p=>p.status==="published").length,skipped:posts.filter(p=>p.status==="skipped").length,
      generationFailures:logs.filter(l=>l.event==="failed"&&l.phase==="generation").length,
      publishingFailures:logs.filter(l=>l.event==="failed"&&l.phase==="publishing").length,
      topicsUsed:new Set(posts.filter(p=>p.caption).map(p=>p.topic)).size,
      sheetpayMentions:posts.filter(p=>p.sheetpayMentioned).length}
  };
}});
export const configure = mutation({
  args:{postingEnabled:v.boolean(),testMode:v.boolean(),mode:v.union(v.literal("approval"),v.literal("automatic")),
    postingTime:v.string(),timezone:v.string(),postingDays:v.array(v.number())},
  handler:async(ctx,args)=>{
    await requireSocialAdmin(ctx); validateSchedule(args.postingTime,args.timezone,args.postingDays);
    const s=await settingsRow(ctx);if(!s)throw new ConvexError("Initialize settings first");
    const c=await ctx.db.query("linkedinConnections").withIndex("by_owner",q=>q.eq("ownerId",s.ownerId)).unique();
    if(!args.testMode && (process.env.SOCIAL_LIVE_PUBLISH_APPROVED!=="true" || !c?.verifiedAt || c.expiresAt<=Date.now() || c.status!=="connected")) throw new ConvexError("First live test needs explicit approval and a tested LinkedIn connection");
    // Invalidate approvals when publishing policy or schedule changes.
    if(s.testMode!==args.testMode || s.mode!==args.mode || s.postingTime!==args.postingTime || s.timezone!==args.timezone || JSON.stringify(s.postingDays)!==JSON.stringify(args.postingDays)){
      const pending=await ctx.db.query("socialPosts").order("desc").take(100);
      for(const p of pending)if(["approved","scheduled","awaiting_approval","draft"].includes(p.status)&&!p.publishRequestStartedAt){
        await ctx.db.patch(p._id,{status:"draft",approvedAt:undefined,approvedBy:undefined,testCompletedAt:undefined,approvalRequired:args.mode==="approval"});
      }
    }
    await ctx.db.patch(s._id,{...args,updatedAt:Date.now()});await log(ctx,"settings_updated","admin");
  }
});
export const updateTopic = mutation({args:{id:v.optional(v.id("socialTopics")),name:v.string(),enabled:v.boolean()},handler:async(ctx,a)=>{
  await requireSocialAdmin(ctx);const name=a.name.trim();if(!name||name.length>100)throw new ConvexError("Topic needs a short name");
  if(a.id){if(!await ctx.db.get(a.id))throw new ConvexError("Topic not found");await ctx.db.patch(a.id,{name,enabled:a.enabled});}
  else {if(await ctx.db.query("socialTopics").withIndex("by_name",q=>q.eq("name",name)).first())throw new ConvexError("Topic already exists");
    await ctx.db.insert("socialTopics",{name,enabled:a.enabled,useCount:0,createdAt:Date.now()});}
}});
async function createPost(ctx: MutationCtx,s:Doc<"socialSettings">,topicId?:Id<"socialTopics">,storyIdea?:string,targetAt?:number) {
  const now=Date.now(), dayKey=localClock(targetAt??now,s.timezone).date;
  const existing=await ctx.db.query("socialPosts").withIndex("by_day",q=>q.eq("dayKey",dayKey)).unique();
  if(existing)throw new ConvexError("Today's post already exists. Edit or regenerate it.");
  const topics=(await ctx.db.query("socialTopics").take(100)).filter(t=>t.enabled);
  const selected=topicId?topics.find(t=>t._id===topicId):topics.sort((a,b)=>(a.lastUsedAt||0)-(b.lastUsedAt||0)||a.name.localeCompare(b.name)).find(t=>t._id!==s.lastTopicId)||topics[0];
  if(!selected)throw new ConvexError("Enable at least one topic");
  const scheduledFor=scheduledInstant(targetAt??now,s.timezone,s.postingTime);
  if(scheduledFor===null)throw new ConvexError("This local posting time does not exist today");
  const operationId=crypto.randomUUID();
  const id=await ctx.db.insert("socialPosts",{dayKey,ownerId:s.ownerId,createdAt:now,updatedAt:now,scheduledFor,
    topicId:selected._id,topic:selected.name,storyIdea:storyIdea?.trim(),status:"generating",
    revision:1,generationAttempts:0,approvalRequired:s.mode==="approval",operationId,leaseUntil:now+600000});
  await ctx.db.patch(selected._id,{lastUsedAt:now,useCount:selected.useCount+1});
  await ctx.db.patch(s._id,{lastTopicId:selected._id});
  await ctx.scheduler.runAfter(0,internal.socialWorker.generate,{id,operationId,kind:"caption"});
  await log(ctx,"started","generation",id);return id;
}
export const generateNew = mutation({args:{topicId:v.optional(v.id("socialTopics")),storyIdea:v.optional(v.string())},handler:async(ctx,a)=>{
  await requireSocialAdmin(ctx);if((a.storyIdea?.length||0)>2000)throw new ConvexError("Story idea too long");
  const s=await settingsRow(ctx);if(!s?.portraitId)throw new ConvexError("Upload Kurt's original portrait in Settings first");
  return createPost(ctx,s,a.topicId,a.storyIdea);
}});
export const saveDraft = mutation({args:{id:v.id("socialPosts"),caption:v.string(),imageText:v.string()},handler:async(ctx,a)=>{
  await requireSocialAdmin(ctx);const p=await ownedPost(ctx,a.id);editable(p);
  const hook=a.caption.split(/\n/)[0].trim();validateCaption(a.caption,hook);validateImageText(a.imageText);
  await ctx.db.patch(p._id,{caption:a.caption,imageText:a.imageText,hook,status:"draft",revision:p.revision+1,
    imageRevision:undefined,approvedAt:undefined,approvedBy:undefined,embedding:undefined,testCompletedAt:undefined,
    hashtags:a.caption.match(/#\w+/g)||[],sheetpayMentioned:/sheetpay/i.test(a.caption),
    sheetpayUrlIncluded:a.caption.includes("https://sheetpay.app/accountant"),updatedAt:Date.now(),error:undefined});
}});
export const regenerate = mutation({args:{id:v.id("socialPosts"),kind:v.union(v.literal("caption"),v.literal("imageText"),v.literal("image"))},handler:async(ctx,a)=>{
  await requireSocialAdmin(ctx);const p=await ownedPost(ctx,a.id);editable(p);
  const operationId=crypto.randomUUID();
  await ctx.db.patch(p._id,{status:"generating",operationId,leaseUntil:Date.now()+600000,revision:p.revision+1,
    approvedAt:undefined,approvedBy:undefined,imageRevision:undefined,testCompletedAt:undefined,error:undefined,updatedAt:Date.now()});
  await ctx.scheduler.runAfter(0,internal.socialWorker.generate,{...a,operationId});
}});
export const approve = mutation({args:{id:v.id("socialPosts")},handler:async(ctx,a)=>{
  const actor=await requireSocialAdmin(ctx),p=await ownedPost(ctx,a.id);editable(p);
  if(!p.caption||!p.imageStorageId||p.imageRevision!==p.revision)throw new ConvexError("Render the current image before approving");
  const s=await settingsRow(ctx);if(!s)throw new ConvexError("Settings missing");
  validateCaption(p.caption,p.hook||"");validateImageText(p.imageText||"",p.hook);
  const reference=p.dayKey===localClock(Date.now(),s.timezone).date?Date.now():p.scheduledFor;
  const time=scheduledInstant(reference,s.timezone,s.postingTime);if(time===null)throw new ConvexError("Invalid local posting time");
  await ctx.db.patch(p._id,{status:"scheduled",approvedAt:Date.now(),approvedBy:actor.userId,
    approvalRequired:s.mode==="approval",scheduledFor:Math.max(Date.now(),time),testCompletedAt:undefined,updatedAt:Date.now()});
}});
export const skip = mutation({args:{id:v.id("socialPosts")},handler:async(ctx,a)=>{
  await requireSocialAdmin(ctx);const p=await ownedPost(ctx,a.id);editable(p);
  await ctx.db.patch(p._id,{status:"skipped",updatedAt:Date.now()});await log(ctx,"skipped","admin",p._id);
}});
export const publishNow = mutation({args:{id:v.id("socialPosts")},handler:async(ctx,a)=>{
  await requireSocialAdmin(ctx);const p=await ownedPost(ctx,a.id);editable(p);
  if(!["scheduled","approved","failed"].includes(p.status))throw new ConvexError("Approve the post before publishing");
  if(p.approvalRequired&&!p.approvedAt)throw new ConvexError("Approval required");
  await ctx.scheduler.runAfter(0,internal.socialWorker.publish,{id:p._id,manual:true});
}});
export const retry = mutation({args:{id:v.id("socialPosts")},handler:async(ctx,a)=>{
  await requireSocialAdmin(ctx);const p=await ownedPost(ctx,a.id);
  if(p.outcomeUnknown||p.publishRequestStartedAt)throw new ConvexError("Reconcile the previous LinkedIn attempt before retrying");
  if(p.status!=="failed")throw new ConvexError("Only failed posts can be retried");
  if(p.errorPhase==="generation"){
    const operationId=crypto.randomUUID();await ctx.db.patch(p._id,{status:"generating",operationId,leaseUntil:Date.now()+600000,error:undefined});
    await ctx.scheduler.runAfter(0,internal.socialWorker.generate,{id:p._id,operationId,kind:"caption"});
  } else {
    if(p.approvalRequired&&!p.approvedAt)throw new ConvexError("Approve the post before retrying publication");
    await ctx.scheduler.runAfter(0,internal.socialWorker.publish,{id:p._id,manual:true});
  }
}});
// Unknown outcome is never retried automatically. A verified returned ID can be
// reconciled with the API; otherwise the owner must inspect LinkedIn manually.
export const reconcile = mutation({args:{id:v.id("socialPosts"),outcome:v.union(v.literal("published"),v.literal("not_published")),linkedinPostId:v.optional(v.string()),confirmed:v.boolean()},handler:async(ctx,a)=>{
  await requireSocialAdmin(ctx);const p=await ownedPost(ctx,a.id);
  if(!p.outcomeUnknown||!a.confirmed)throw new ConvexError("Confirm that you inspected your LinkedIn profile");
  if(a.outcome==="published"&&!/^urn:li:(share|ugcPost):\d+$/.test(a.linkedinPostId||""))throw new ConvexError("Supply the LinkedIn post URN");
  await ctx.db.patch(p._id,{status:a.outcome==="published"?"published":"draft",outcomeUnknown:false,
    linkedinPostId:a.linkedinPostId,linkedinPostUrl:a.linkedinPostId?"https://www.linkedin.com/feed/update/"+a.linkedinPostId:undefined,
    publishedAt:a.outcome==="published"?Date.now():undefined,publishRequestStartedAt:undefined,
    approvedAt:undefined,approvedBy:undefined,error:undefined,updatedAt:Date.now()});
  await log(ctx,"manual_reconciliation","publishing",p._id,a.outcome);
}});
export const uploadPortrait = mutation({args:{},handler:async ctx=>{
  const actor=await requireSocialAdmin(ctx);
  const uploadId=await ctx.db.insert("socialUploads",{ownerId:actor.userId,expiresAt:Date.now()+600000});
  return {uploadId,url:await ctx.storage.generateUploadUrl()};
}});
export const attachPortrait = mutation({args:{uploadId:v.id("socialUploads"),storageId:v.id("_storage")},handler:async(ctx,a)=>{
  const actor=await requireSocialAdmin(ctx),ticket=await ctx.db.get(a.uploadId);
  if(!ticket||ticket.ownerId!==actor.userId||ticket.expiresAt<Date.now()||ticket.storageId)throw new ConvexError("Upload expired");
  const meta=await ctx.db.system.get(a.storageId);
  if(!meta||!["image/png","image/jpeg"].includes(meta.contentType||"")||meta.size>4*1024*1024||meta._creationTime<ticket._creationTime)throw new ConvexError("Use an original PNG/JPEG under 4 MB");
  const s=await settingsRow(ctx);if(!s)throw new ConvexError("Settings missing");
  await ctx.db.patch(ticket._id,{storageId:a.storageId});
  await ctx.db.patch(s._id,{portraitId:a.storageId,updatedAt:Date.now()});
  // A portrait change requires image regeneration and fresh approval.
  for(const p of await ctx.db.query("socialPosts").order("desc").take(100))if(["draft","scheduled","approved","awaiting_approval","failed"].includes(p.status)&&!p.publishRequestStartedAt)
    await ctx.db.patch(p._id,{status:"draft",revision:p.revision+1,imageRevision:undefined,approvedAt:undefined,approvedBy:undefined,testCompletedAt:undefined});
}});
export const asset = query({args:{id:v.id("_storage")},handler:async(ctx,a)=>{
  await requireSocialAdmin(ctx);const s=await settingsRow(ctx);
  if(s?.portraitId===a.id)return a.id;
  const posts=await ctx.db.query("socialPosts").order("desc").take(500);
  if(!posts.some(p=>p.imageStorageId===a.id))throw new ConvexError("Asset not found");
  return a.id;
}});
export const disconnect = mutation({args:{},handler:async ctx=>{
  await requireSocialAdmin(ctx);const s=await settingsRow(ctx);if(!s)return;
  const c=await ctx.db.query("linkedinConnections").withIndex("by_owner",q=>q.eq("ownerId",s.ownerId)).unique();
  if(c)await ctx.db.delete(c._id);
  await ctx.db.patch(s._id,{postingEnabled:false,testMode:true,updatedAt:Date.now()});
  await log(ctx,"disconnected","oauth");
}});
export const workerContext = internalQuery({args:{id:v.optional(v.id("socialPosts"))},handler:async(ctx,a)=>{
  const settings=await settingsRow(ctx);if(!settings)throw new ConvexError("Settings missing");
  const owner=await ctx.db.get(settings.ownerId);
  const role=await ctx.db.query("adminRoles").withIndex("by_user",q=>q.eq("userId",settings.ownerId)).first();
  // Scheduled jobs cannot reuse a browser identity; revalidate the owner's role.
  if(!owner?.emailVerified || (role?!["super_admin","admin"].includes(role.role):owner.email.toLowerCase()!=="surebookme@gmail.com"))throw new ConvexError("Social owner is no longer authorized");
  return {settings,post:a.id?await ownedPost(ctx,a.id):null,
    recent:await ctx.db.query("socialPosts").order("desc").take(31),
    connection:await ctx.db.query("linkedinConnections").withIndex("by_owner",q=>q.eq("ownerId",settings.ownerId)).unique()};
}});
export const authorizedContext = query({args:{},handler:async ctx=>{
  const actor=await requireSocialAdmin(ctx);const s=await settingsRow(ctx);
  if(!s)throw new ConvexError("Initialize settings first");return {actorId:actor.userId,ownerId:s.ownerId};
}});
export const tick = internalMutation({args:{},handler:async ctx=>{
  const s=await settingsRow(ctx);if(!s)return;
  // Recover crashed workers conservatively; never re-send an uncertain POST.
  const pending=await ctx.db.query("socialPosts").order("desc").take(100),now=Date.now();
  for(const p of pending)if(["generating","publishing"].includes(p.status)&&(p.leaseUntil||0)<now){
    await ctx.db.patch(p._id,{status:"failed",outcomeUnknown:!!p.publishRequestStartedAt,
      error:"Worker interrupted. "+(p.publishRequestStartedAt?"Verify LinkedIn before retrying.":"Retry is available."),
      errorPhase:p.status==="generating"?"generation":"publishing",updatedAt:now});
    await log(ctx,"failed",p.status==="generating"?"generation":"publishing",p._id,"Worker interrupted");
  }
  const expired=await ctx.db.query("socialOAuthStates").withIndex("by_expiry",q=>q.lt("expiresAt",now)).take(100);
  for(const row of expired)await ctx.db.delete(row._id);
  if(!s.postingEnabled)return;
  const clock=localClock(now,s.timezone);
  const scheduled=scheduledInstant(now,s.timezone,s.postingTime);if(scheduled===null)return;
  const existing=await ctx.db.query("socialPosts").withIndex("by_day",q=>q.eq("dayKey",clock.date)).unique();
  if(s.postingDays.includes(clock.day)&&existing&&["scheduled","approved"].includes(existing.status)&&!existing.testCompletedAt&&now>=existing.scheduledFor&&existing.scheduledFor>=scheduled-s.generationLeadMinutes*60000)
    await ctx.scheduler.runAfter(0,internal.socialWorker.publish,{id:existing._id});
  const targetAt=now+s.generationLeadMinutes*60000,targetClock=localClock(targetAt,s.timezone);
  const targetSchedule=scheduledInstant(targetAt,s.timezone,s.postingTime);
  const targetPost=targetClock.date===clock.date?existing:await ctx.db.query("socialPosts").withIndex("by_day",q=>q.eq("dayKey",targetClock.date)).unique();
  if(!targetPost&&s.portraitId&&s.postingDays.includes(targetClock.day)&&targetSchedule!==null&&
    now>=targetSchedule-s.generationLeadMinutes*60000&&now<targetSchedule+1800000)
    await createPost(ctx,s,undefined,undefined,targetAt);
}});
