import { query, mutation, internalQuery, internalMutation, QueryCtx } from "./_generated/server";
import { anyApi } from "convex/server";
import { v, ConvexError } from "convex/values";
import { requireSocialAdmin } from "./social";
import { campaignFields } from "./ugcSchema";
import { activeJob, latestJobs, validateCampaign, MODEL_IDS } from "./lib/ugcPolicy";
import { Id } from "./_generated/dataModel";
const f=anyApi;
export const requireUgcAdmin=requireSocialAdmin;
async function campaign(ctx:QueryCtx,id:any){const row=await ctx.db.get(id);if(!row||!("revision" in row))throw new ConvexError("Campaign not found.");return row as any;}
async function jobsFor(ctx:QueryCtx,id:any){return ctx.db.query("ugcJobs").withIndex("by_campaign",q=>q.eq("campaignId",id)).collect();}
async function editable(ctx:QueryCtx,id:any){if((await jobsFor(ctx,id)).some(activeJob))throw new ConvexError("Resolve active or uncertain generation requests before editing this campaign.");}
export const access=query({args:{},handler:async ctx=>{try{const a=await requireUgcAdmin(ctx);return {authorized:true,ownerId:a.userId,providerConfigured:!!process.env.MUAPI_API_KEY,openaiConfigured:!!process.env.OPENAI_API_KEY};}catch{return {authorized:false};}}});
export const dashboard=query({args:{},handler:async ctx=>{
  await requireUgcAdmin(ctx);
  const [campaigns,media,creators,jobs]=await Promise.all([ctx.db.query("ugcCampaigns").order("desc").take(500),ctx.db.query("ugcMedia").order("desc").take(500),ctx.db.query("ugcCreators").order("desc").take(200),ctx.db.query("ugcJobs").order("desc").take(1000)]);
  // No provider payloads, storage download URLs or internal credentials in the dashboard.
  return {campaigns,media,creators,jobs:jobs.map(({payload,outputUrl,...j})=>j),summary:{window:"Latest 500 campaigns / 1000 jobs",videosGenerated:campaigns.filter(c=>!!c.videoStorageId).length,drafts:campaigns.filter(c=>["draft","ready"].includes(c.status)).length,completed:campaigns.filter(c=>c.status==="completed").length,failed:jobs.filter(j=>j.status==="failed").length,estimatedSpend:jobs.reduce((n,j)=>n+j.estimatedCost,0),actualSpend:jobs.filter(j=>j.actualCost!==undefined).reduce((n,j)=>n+(j.refunded?0:j.actualCost!),0),actualKnown:jobs.filter(j=>j.actualCost!==undefined).length}};
}});
export const save=mutation({args:{id:v.optional(v.id("ugcCampaigns")),expectedRevision:v.optional(v.number()),...campaignFields},handler:async(ctx,a)=>{
  const admin=await requireUgcAdmin(ctx);try{validateCampaign(a);}catch(e){throw new ConvexError((e as Error).message);}
  if(a.creatorId&&!await ctx.db.get(a.creatorId))throw new ConvexError("Creator not found.");
  for(const s of a.scenes)if(s.assetId){const asset=await ctx.db.get(s.assetId);if(!asset||asset.category==="actor")throw new ConvexError("Select real product footage from the media library.");}
  const {id,expectedRevision,...data}=a,now=Date.now();
  if(id){const row=await campaign(ctx,id);await editable(ctx,id);if(row.revision!==expectedRevision)throw new ConvexError("Campaign changed in another window. Reload before saving.");await ctx.db.patch(id,{...data,revision:row.revision+1,status:a.reviewApproved?"ready":"draft",videoStorageId:undefined,thumbnailStorageId:undefined,updatedAt:now});return id;}
  return ctx.db.insert("ugcCampaigns",{...data,ownerId:admin.userId,revision:1,status:a.reviewApproved?"ready":"draft",createdAt:now,updatedAt:now});
}});
export const duplicate=mutation({args:{id:v.id("ugcCampaigns"),hook:v.optional(v.string())},handler:async(ctx,a)=>{
  const admin=await requireUgcAdmin(ctx),row=await campaign(ctx,a.id);
  const {_id,_creationTime,videoStorageId,thumbnailStorageId,...copy}=row;
  const hook=a.hook??row.hook;if(hook.length>300)throw new ConvexError("Hook is too long.");
  return ctx.db.insert("ugcCampaigns",{...copy,title:(row.title+" — variation").slice(0,160),ownerId:admin.userId,hook,script:row.script.replace(row.hook,hook),captions:row.captions.replace(row.hook,hook),scenes:row.scenes.map((s:any,i:number)=>i===0&&s.kind==="creator"?{...s,text:hook}:s),reviewApproved:false,revision:1,status:"draft",createdAt:Date.now(),updatedAt:Date.now()});
}});
export const remove=mutation({args:{id:v.id("ugcCampaigns")},handler:async(ctx,a)=>{
  await requireUgcAdmin(ctx);const row=await campaign(ctx,a.id);await editable(ctx,a.id);
  // Keep paid-generation audit rows. Remove associated generated blobs and preview access.
  const jobs=await jobsFor(ctx,a.id),ids=new Set([row.videoStorageId,row.thumbnailStorageId,...jobs.map(j=>j.storageId)].filter(Boolean));
  for(const id of ids)await ctx.storage.delete(id as any);
  for(const j of jobs)await ctx.db.patch(j._id,{storageId:undefined,outputUrl:undefined,payload:{},updatedAt:Date.now()});
  for(const q of await ctx.db.query("ugcQuotes").filter(q=>q.eq(q.field("campaignId"),a.id)).collect())await ctx.db.delete(q._id);
  await ctx.db.delete(a.id);
}});
export const saveCreator=mutation({args:{id:v.optional(v.id("ugcCreators")),label:v.string(),persona:v.string(),notes:v.string(),preferredModel:v.string(),referenceId:v.optional(v.id("ugcMedia")),rightsConfirmed:v.boolean()},handler:async(ctx,a)=>{
  const admin=await requireUgcAdmin(ctx);if(!a.label.trim()||a.label.length>100||a.persona.length>120||a.notes.length>2000||!a.rightsConfirmed||!MODEL_IDS.includes(a.preferredModel))throw new ConvexError("Add a short label, choose a supported model, and confirm rights/consent to this creator.");
  if(a.referenceId){const asset=await ctx.db.get(a.referenceId);if(!asset||!asset.contentType.startsWith("image/")||asset.category!=="actor")throw new ConvexError("Select an actor reference image.");}
  const {id,...data}=a;if(id){if(!await ctx.db.get(id))throw new ConvexError("Creator not found.");await ctx.db.patch(id,{...data,updatedAt:Date.now()});return id;}
  return ctx.db.insert("ugcCreators",{...data,ownerId:admin.userId,createdAt:Date.now(),updatedAt:Date.now()});
}});
export const removeCreator=mutation({args:{id:v.id("ugcCreators")},handler:async(ctx,a)=>{await requireUgcAdmin(ctx);if(await ctx.db.query("ugcCampaigns").filter(q=>q.eq(q.field("creatorId"),a.id)).first())throw new ConvexError("Remove this creator from campaigns first.");await ctx.db.delete(a.id);}});
export const beginUpload=mutation({args:{contentType:v.string(),size:v.number(),sha256:v.string()},handler:async(ctx,a)=>{
  const admin=await requireUgcAdmin(ctx);if(!["image/png","image/jpeg","image/webp","video/mp4","video/webm"].includes(a.contentType)||!Number.isInteger(a.size)||a.size<=0||a.size>100*1024*1024||! /^[A-Za-z0-9+/]{43}=$/.test(a.sha256))throw new ConvexError("Upload PNG, JPG, WebP, MP4 or WebM up to 100 MB.");
  const ticket=await ctx.db.insert("ugcUploads",{...a,ownerId:admin.userId,expiresAt:Date.now()+600000,used:false});return {ticket,url:await ctx.storage.generateUploadUrl()};
}});
async function consumeUpload(ctx:any,a:any,ownerId:any){
  const t=await ctx.db.get(a.ticket),meta=await ctx.db.system.get(a.storageId);
  if(!t||t.ownerId!==ownerId||t.used||t.expiresAt<Date.now()||!meta||meta.contentType!==t.contentType||meta.size!==t.size||meta.sha256!==t.sha256)throw new ConvexError("Upload could not be verified. Upload the file again.");
  if(await ctx.db.query("ugcMedia").withIndex("by_storage",(q:any)=>q.eq("storageId",a.storageId)).first())throw new ConvexError("Asset already registered.");
  await ctx.db.patch(t._id,{used:true});return t;
}
export const finishUpload=mutation({args:{ticket:v.id("ugcUploads"),storageId:v.id("_storage"),label:v.string(),category:v.string()},handler:async(ctx,a)=>{
  const admin=await requireUgcAdmin(ctx);if(!a.label.trim()||a.label.length>160||!["screenshot","dashboard","cayla","payroll","payslips","clients","employees","actor"].includes(a.category))throw new ConvexError("Add a label and media category.");
  const t=await consumeUpload(ctx,a,admin.userId);if(a.category==="actor"&&!t.contentType.startsWith("image/"))throw new ConvexError("Actor references must be images.");
  return ctx.db.insert("ugcMedia",{ownerId:admin.userId,label:a.label,category:a.category,storageId:a.storageId,contentType:t.contentType,size:t.size,createdAt:Date.now()});
}});
export const removeMedia=mutation({args:{id:v.id("ugcMedia")},handler:async(ctx,a)=>{
  await requireUgcAdmin(ctx);const row=await ctx.db.get(a.id);if(!row)return;
  if((await ctx.db.query("ugcCampaigns").collect()).some(c=>c.scenes.some(s=>s.assetId===a.id))||await ctx.db.query("ugcCreators").filter(q=>q.eq(q.field("referenceId"),a.id)).first())throw new ConvexError("Remove this asset from campaigns and creators first.");
  await ctx.storage.delete(row.storageId);await ctx.db.delete(a.id);
}});
export const exportVideo=mutation({args:{id:v.id("ugcCampaigns"),revision:v.number(),ticket:v.id("ugcUploads"),storageId:v.id("_storage"),thumbnailTicket:v.optional(v.id("ugcUploads")),thumbnailStorageId:v.optional(v.id("_storage"))},handler:async(ctx,a)=>{
  const admin=await requireUgcAdmin(ctx),row=await campaign(ctx,a.id);if(row.revision!==a.revision)throw new ConvexError("Campaign changed. Export again.");
  const t=await consumeUpload(ctx,a,admin.userId);if(!t.contentType.startsWith("video/"))throw new ConvexError("Export must be a video.");
  if(a.thumbnailTicket&&a.thumbnailStorageId){const tt=await consumeUpload(ctx,{ticket:a.thumbnailTicket,storageId:a.thumbnailStorageId},admin.userId);if(!tt.contentType.startsWith("image/"))throw new ConvexError("Thumbnail must be an image.");}
  if(row.videoStorageId)await ctx.storage.delete(row.videoStorageId);if(row.thumbnailStorageId)await ctx.storage.delete(row.thumbnailStorageId);
  await ctx.db.patch(a.id,{videoStorageId:a.storageId,thumbnailStorageId:a.thumbnailStorageId,status:"completed",updatedAt:Date.now()});
}});
export const asset=query({args:{id:v.id("_storage")},handler:async(ctx,a)=>{
  await requireUgcAdmin(ctx);
  const media=await ctx.db.query("ugcMedia").withIndex("by_storage",q=>q.eq("storageId",a.id)).first();
  const job=await ctx.db.query("ugcJobs").filter(q=>q.eq(q.field("storageId"),a.id)).first();
  const c=await ctx.db.query("ugcCampaigns").filter(q=>q.or(q.eq(q.field("videoStorageId"),a.id),q.eq(q.field("thumbnailStorageId"),a.id))).first();
  if(!media&&!c&&(!job||!await ctx.db.get(job.campaignId)))throw new ConvexError("Asset not found.");return a.id;
}});
export const context=query({args:{id:v.id("ugcCampaigns")},handler:async(ctx,a)=>{
  const admin=await requireUgcAdmin(ctx),c=await campaign(ctx,a.id),creator=c.creatorId?await ctx.db.get(c.creatorId as Id<"ugcCreators">):null;
  const reference=creator?.referenceId?await ctx.db.get(creator.referenceId):null;
  return {admin,campaign:c,creator,referenceUrl:reference?await ctx.storage.getUrl(reference.storageId):null,jobs:await jobsFor(ctx,a.id)};
}});
export const storeQuote=internalMutation({args:{campaignId:v.id("ugcCampaigns"),ownerId:v.id("users"),revision:v.number(),amount:v.number(),items:v.any()},handler:async(ctx,a)=>{
  const c=await campaign(ctx,a.campaignId);if(c.revision!==a.revision)throw new ConvexError("Campaign changed. Estimate again.");
  return ctx.db.insert("ugcQuotes",{...a,createdAt:Date.now(),expiresAt:Date.now()+300000,consumed:false});
}});
export const generate=mutation({args:{quoteId:v.id("ugcQuotes"),confirmed:v.boolean()},handler:async(ctx,a)=>{
  const admin=await requireUgcAdmin(ctx),q=await ctx.db.get(a.quoteId);if(!a.confirmed||!q||q.ownerId!==admin.userId)throw new ConvexError("Review the estimate and click Generate Video.");
  if(q.consumed)return {accepted:true};
  if(!process.env.MUAPI_API_KEY)throw new ConvexError("Configure MUAPI_API_KEY in production Convex.");
  const c=await campaign(ctx,q.campaignId);if(q.expiresAt<Date.now()||c.revision!==q.revision||!c.reviewApproved)throw new ConvexError("Estimate expired or campaign changed. Review and estimate again.");
  await editable(ctx,c._id);
  for(const item of q.items){const id=await ctx.db.insert("ugcJobs",{campaignId:c._id,ownerId:admin.userId,revision:q.revision,sceneKey:item.sceneKey,model:item.model,payload:item.payload,estimatedCost:item.amount,status:"queued",outcomeUnknown:false,pollCount:0,createdAt:Date.now(),updatedAt:Date.now()});await ctx.scheduler.runAfter(0,f.ugcWorker.submit,{id});}
  await ctx.db.patch(q._id,{consumed:true});await ctx.db.patch(c._id,{status:"queued",updatedAt:Date.now()});return {accepted:true};
}});
export const retryStatus=mutation({args:{id:v.id("ugcJobs")},handler:async(ctx,a)=>{
  await requireUgcAdmin(ctx);const j=await ctx.db.get(a.id);if(!j||!await ctx.db.get(j.campaignId)||!j.providerJobId)throw new ConvexError("Find the request in MuAPI history and reconcile it first.");
  await ctx.scheduler.runAfter(0,f.ugcWorker.poll,{id:j._id,manual:true});
}});
export const reconcile=mutation({args:{id:v.id("ugcJobs"),providerJobId:v.string()},handler:async(ctx,a)=>{
  await requireUgcAdmin(ctx);const j=await ctx.db.get(a.id);if(!j?.outcomeUnknown||j.providerJobId||! /^[a-zA-Z0-9_-]{1,200}$/.test(a.providerJobId))throw new ConvexError("Only an uncertain request can be reconciled. Use its exact MuAPI request ID.");
  if(await ctx.db.query("ugcJobs").filter(q=>q.eq(q.field("providerJobId"),a.providerJobId)).first())throw new ConvexError("Request is already attached.");
  await ctx.db.patch(a.id,{providerJobId:a.providerJobId,status:"generating",outcomeUnknown:false,error:undefined,updatedAt:Date.now()});await ctx.scheduler.runAfter(0,f.ugcWorker.poll,{id:a.id,manual:true});
}});
export const workerContext=internalQuery({args:{id:v.id("ugcJobs")},handler:async(ctx,a)=>ctx.db.get(a.id)});
export const claimSubmit=internalMutation({args:{id:v.id("ugcJobs")},handler:async(ctx,a)=>{
  const j=await ctx.db.get(a.id);if(!j||j.status!=="queued"||!await ctx.db.get(j.campaignId))return null;
  // Mark uncertain BEFORE calling the paid endpoint. Never reset this lease and resubmit.
  await ctx.db.patch(a.id,{status:"submitting",outcomeUnknown:true,submittedAt:Date.now(),updatedAt:Date.now()});return j;
}});
export const claimPoll=internalMutation({args:{id:v.id("ugcJobs"),manual:v.boolean()},handler:async(ctx,a)=>{
  const j=await ctx.db.get(a.id);if(!j||!j.providerJobId||j.status==="completed"||!await ctx.db.get(j.campaignId)||(j.pollLeaseUntil??0)>Date.now())return null;
  if(!a.manual&&j.status==="failed")return null;
  await ctx.db.patch(j._id,{pollLeaseUntil:Date.now()+120000});return j;
}});
export const updateJob=internalMutation({args:{id:v.id("ugcJobs"),patch:v.any(),schedule:v.optional(v.boolean())},handler:async(ctx,a)=>{
  const j=await ctx.db.get(a.id);if(!j)return;const c=await ctx.db.get(j.campaignId);if(!c)return;
  await ctx.db.patch(a.id,{...a.patch,pollLeaseUntil:undefined,updatedAt:Date.now()});
  const jobs=latestJobs((await jobsFor(ctx,j.campaignId)).filter(x=>x.revision===c.revision));
  const state=jobs.some(x=>x.outcomeUnknown)?"failed":jobs.some(x=>["queued","submitting","generating","saving"].includes(x.status))?"generating":jobs.some(x=>x.status==="failed")?"failed":"ready";
  await ctx.db.patch(c._id,{status:c.videoStorageId?"completed":state,updatedAt:Date.now()});
  if(a.schedule)await ctx.scheduler.runAfter(30000,f.ugcWorker.poll,{id:j._id,manual:false});
}});
