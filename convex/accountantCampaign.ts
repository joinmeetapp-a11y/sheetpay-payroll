import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { CAMPAIGN_ID, FIRST_DELAY, DAY_DELAY, RETRY_BUDGET, campaignFree, validEmail, destination, renderCampaign } from "../shared/accountantCampaign";
import { isAdminEmail } from "./admin";

export async function event(ctx:any,c:any,type:string,reason?:string) {
 const key=String(c._id)+":"+type;
 if(await ctx.db.query("accountantCampaignEvents").withIndex("by_key",(q:any)=>q.eq("key",key)).first()) return;
 await ctx.db.insert("accountantCampaignEvents",{campaign:c._id,userId:c.userId,campaignId:c.campaignId,key,eventType:type,status:type,scheduledAt:Date.now(),...(reason?{failureReason:reason}:{})});
}
export async function stopCampaign(ctx:any,c:any,status:"converted"|"unsubscribed"|"paused"|"failed",reason:string) {
 if(c.status!=="active") return;
 await ctx.db.patch(c._id,{status,stoppedAt:Date.now(),stopReason:reason});
 await event(ctx,c,status==="converted"?"upgraded":status,reason);
}
export async function stopForUpgrade(ctx:any,userId:any) {
 const c=await ctx.db.query("accountantEmailCampaigns").withIndex("by_user_campaign",(q:any)=>q.eq("userId",userId).eq("campaignId",CAMPAIGN_ID)).first();
 if(c) await stopCampaign(ctx,c,"converted","upgraded");
}
/** Called only inside the authenticated new-user transaction. Old logins never backfill. */
export async function enrollAfterSignup(ctx:any,user:any) {
 if(user.accountType!=="accountant" || !campaignFree(user) || !validEmail(user.email))return;
 if(user.emailVerified && isAdminEmail(user.email))return;
 const id=await ctx.db.insert("accountantEmailCampaigns",{userId:user._id,campaignId:CAMPAIGN_ID,enrolledAt:Date.now(),currentDay:1,nextSendAt:Date.now()+FIRST_DELAY,status:"active",tokenHash:"",unsubscribeToken:""});
 await event(ctx,{_id:id,userId:user._id,campaignId:CAMPAIGN_ID},"enrolled");
}
export const enroll=internalMutation({
 args:{userId:v.id("users"),token:v.string(),tokenHash:v.string()},
 handler:async(ctx,args)=>{
  const existing=await ctx.db.query("accountantEmailCampaigns").withIndex("by_user_campaign",q=>q.eq("userId",args.userId).eq("campaignId",CAMPAIGN_ID)).first();
  if(existing){
   if(existing.status==="active" && !existing.unsubscribeToken)await ctx.db.patch(existing._id,{unsubscribeToken:args.token,tokenHash:args.tokenHash});
   return existing._id;
  }
  const user=await ctx.db.get(args.userId);
  if(!user || user.accountType!=="accountant" || !campaignFree(user) || user.marketingUnsubscribedAt || !validEmail(user.email) || (user.emailVerified && isAdminEmail(user.email))) return null;
  const id=await ctx.db.insert("accountantEmailCampaigns",{userId:user._id,campaignId:CAMPAIGN_ID,enrolledAt:Date.now(),currentDay:1,nextSendAt:Date.now()+FIRST_DELAY,status:"active",tokenHash:args.tokenHash,unsubscribeToken:args.token});
  await event(ctx,{_id:id,userId:user._id,campaignId:CAMPAIGN_ID},"enrolled");return id;
 }
});
export const due=internalQuery({args:{},handler:ctx=>ctx.db.query("accountantEmailCampaigns").withIndex("by_due",q=>q.eq("status","active").lte("nextSendAt",Date.now())).take(20)});
export const getTokenInitialization=internalQuery({args:{campaign:v.id("accountantEmailCampaigns")},handler:async(ctx,args)=>{
 const c=await ctx.db.get(args.campaign);return c?{userId:c.userId,needsToken:c.status==="active"&&!c.unsubscribeToken}:null;
}});
async function eligible(ctx:any,c:any){
 if(!c||c.status!=="active")return null;
 const user=await ctx.db.get(c.userId);
 if(!user){await stopCampaign(ctx,c,"paused","account_deleted");return null;}
 if(!campaignFree(user)){await stopCampaign(ctx,c,"converted","upgraded");return null;}
 if(user.marketingUnsubscribedAt){await stopCampaign(ctx,c,"unsubscribed","marketing_opt_out");return null;}
 if(!validEmail(user.email)){await stopCampaign(ctx,c,"paused","invalid_email");return null;}
 const suppressed=await ctx.db.query("emailSuppressions").withIndex("by_email",(q:any)=>q.eq("emailAddress",user.email.toLowerCase())).first();
 if(suppressed){await stopCampaign(ctx,c,"paused","recipient_suppressed");return null;}
 const prefs=await ctx.db.query("notificationPreferences").withIndex("by_user",(q:any)=>q.eq("userId",String(user._id))).first();
 const uidPrefs=user.firebaseUid?await ctx.db.query("notificationPreferences").withIndex("by_user",(q:any)=>q.eq("userId",user.firebaseUid)).first():null;
 if(prefs?.product===false || uidPrefs?.product===false){await stopCampaign(ctx,c,"unsubscribed","product_email_opt_out");return null;}
 return user;
}
export const claim=internalMutation({
 args:{campaign:v.id("accountantEmailCampaigns"),leaseId:v.string(),from:v.string(),replyTo:v.string(),site:v.string()},
 handler:async(ctx,args)=>{
  const c=await ctx.db.get(args.campaign);const user=await eligible(ctx,c);
  if(!c||!user||c.nextSendAt>Date.now()||!c.unsubscribeToken)return null;
  const key=String(c._id)+":day:"+c.currentDay;
  let e=await ctx.db.query("accountantCampaignEvents").withIndex("by_key",q=>q.eq("key",key)).first();
  if(e?.status==="email_sent")return null;
  if(e?.firstAttemptAt && Date.now()-e.firstAttemptAt>=RETRY_BUDGET){await stopCampaign(ctx,c,"failed","delivery_uncertain_review_required");return null;}
  if(e?.leaseUntil && e.leaseUntil>Date.now())return null;
  if(!e){
   const client=await ctx.db.query("businesses").withIndex("by_user",q=>q.eq("userId",user._id)).first();
   const employee=await ctx.db.query("employees").withIndex("by_user",q=>q.eq("userId",user._id)).filter(q=>q.neq(q.field("isDemo"),true)).first();
   const payroll=await ctx.db.query("payrollRuns").withIndex("by_user",q=>q.eq("userId",user._id)).first();
   const target=destination(c.currentDay,{client:!!client,employees:!!employee,payroll:!!payroll});
   const unsubscribe=args.site+"/marketing/unsubscribe?token="+encodeURIComponent(c.unsubscribeToken);
   const content=renderCampaign(c.currentDay,user.displayName,target,unsubscribe);
   const id=await ctx.db.insert("accountantCampaignEvents",{campaign:c._id,userId:user._id,campaignId:CAMPAIGN_ID,key,eventType:"email_scheduled",day:c.currentDay,status:"email_scheduled",scheduledAt:c.nextSendAt,payload:{from:args.from,to:[user.email.toLowerCase()],reply_to:args.replyTo,...content,headers:{"List-Unsubscribe":"<"+unsubscribe+">","List-Unsubscribe-Post":"List-Unsubscribe=One-Click"}}});
   e=(await ctx.db.get(id))!;
  }
  // A retry must reuse the identical recipient/body required by provider idempotency.
  if(e.payload?.to[0]!==user.email.toLowerCase()){await stopCampaign(ctx,c,"paused","email_changed_during_delivery_review_required");return null;}
  await ctx.db.patch(e._id,{status:"sending",leaseId:args.leaseId,leaseUntil:Date.now()+120000,firstAttemptAt:e.firstAttemptAt??Date.now(),attempts:(e.attempts??0)+1});
  await ctx.db.patch(c._id,{nextSendAt:Date.now()+120000});
  return {eventId:e._id,key:e.key,payload:e.payload};
 }
});
export const shouldSendFreeUserCampaignEmail=internalMutation({
 args:{eventId:v.id("accountantCampaignEvents"),leaseId:v.string()},
 handler:async(ctx,args)=>{
  const e=await ctx.db.get(args.eventId);if(!e||e.status!=="sending"||e.leaseId!==args.leaseId||!e.leaseUntil||e.leaseUntil<=Date.now())return false;
  const c=await ctx.db.get(e.campaign);const user=await eligible(ctx,c);
  if(!user||!c||c.currentDay!==e.day||e.payload?.to[0]!==user.email.toLowerCase())return false;
  if(!e.firstAttemptAt||Date.now()-e.firstAttemptAt>=RETRY_BUDGET)return false;
  return true;
 }
});
export const finish=internalMutation({
 args:{eventId:v.id("accountantCampaignEvents"),leaseId:v.string(),messageId:v.optional(v.string()),reason:v.optional(v.string()),retryable:v.boolean()},
 handler:async(ctx,args)=>{
  const e=await ctx.db.get(args.eventId);if(!e||e.leaseId!==args.leaseId||e.status==="email_sent")return;
  const c=await ctx.db.get(e.campaign);if(!c)return;
  if(args.messageId){
   await ctx.db.patch(e._id,{status:"email_sent",eventType:"email_sent",sentAt:Date.now(),resendMessageId:args.messageId,leaseUntil:0});
   await ctx.db.insert("emailLogs",{recipient:e.payload!.to[0],emailType:CAMPAIGN_ID,subject:e.payload!.subject,status:"sent",resendMessageId:args.messageId,userId:String(e.userId),category:"product",idempotencyKey:e.key,sentAt:Date.now(),createdAt:Date.now()});
   if(c.status!=="active")return;
   if(e.day===7){await ctx.db.patch(c._id,{status:"completed",completedAt:Date.now(),lastSentAt:Date.now()});await event(ctx,c,"campaign_completed");}
   else await ctx.db.patch(c._id,{currentDay:(e.day??0)+1,lastSentAt:Date.now(),nextSendAt:Date.now()+DAY_DELAY});
  }else{
   await ctx.db.patch(e._id,{status:"email_failed",failureReason:args.reason??"send_failed",leaseUntil:0});
   // Record failure attempts separately from the canonical per-day send record.
   await ctx.db.insert("accountantCampaignEvents",{campaign:c._id,userId:e.userId,campaignId:CAMPAIGN_ID,key:e.key+":failure:"+e.attempts,eventType:"email_failed",day:e.day,status:"email_failed",scheduledAt:Date.now(),failureReason:args.reason??"send_failed"});
   if(c.status!=="active")return;
   if(args.retryable && Date.now()-(e.firstAttemptAt??0)<RETRY_BUDGET && (e.attempts??0)<10) await ctx.db.patch(c._id,{nextSendAt:Date.now()+Math.min(3600000,60000*2**Math.min(e.attempts??1,6))});
   else await stopCampaign(ctx,c,"failed",args.reason??"send_failed_review_required");
  }
 }
});
export const unsubscribe=internalMutation({
 args:{tokenHash:v.string()},
 handler:async(ctx,args)=>{
  const c=await ctx.db.query("accountantEmailCampaigns").withIndex("by_token",q=>q.eq("tokenHash",args.tokenHash)).first();
  if(!c)return false;
  const user=await ctx.db.get(c.userId);if(user)await ctx.db.patch(user._id,{marketingUnsubscribedAt:Date.now()});
  await stopCampaign(ctx,c,"unsubscribed","marketing_opt_out");return true;
 }
});
// Operator-only diagnostic. Never expose tokens or frozen email content to browsers.
export const inspect=internalQuery({args:{userId:v.id("users")},handler:async(ctx,args)=>{
 const c=await ctx.db.query("accountantEmailCampaigns").withIndex("by_user_campaign",q=>q.eq("userId",args.userId).eq("campaignId",CAMPAIGN_ID)).first();
 if(!c)return null;
 const {unsubscribeToken,tokenHash,...state}=c;
 const rows=await ctx.db.query("accountantCampaignEvents").withIndex("by_campaign",q=>q.eq("campaign",c._id)).order("desc").take(100);
 return {state,events:rows.map(({payload,...e})=>e)};
}});
/** Release smoke-test cleanup only; cannot act on ordinary customer accounts. */
export const cleanVerification=internalMutation({args:{userId:v.id("users")},handler:async(ctx,args)=>{
 const user=await ctx.db.get(args.userId);
 if(!user||!/^delivered\+campaign-[a-f0-9-]+@resend\.dev$/.test(user.email)||!user.createdAt||Date.now()-user.createdAt>1800000)throw Error("Not a fresh synthetic campaign verification account");
 const c=await ctx.db.query("accountantEmailCampaigns").withIndex("by_user_campaign",q=>q.eq("userId",user._id).eq("campaignId",CAMPAIGN_ID)).first();
 if(c)await stopCampaign(ctx,c,"unsubscribed","verification_cleanup");
 await ctx.db.patch(user._id,{marketingUnsubscribedAt:Date.now()});
 const businesses=await ctx.db.query("businesses").withIndex("by_user",q=>q.eq("userId",user._id)).collect();
 for(const business of businesses){
  if(business.name!=="Sheetpay Campaign Verification")throw Error("Verification account has unexpected client data");
  const employee=await ctx.db.query("employees").withIndex("by_business",q=>q.eq("businessId",business._id)).first();
  const payroll=await ctx.db.query("payrollRuns").withIndex("by_business",q=>q.eq("businessId",business._id)).first();
  if(employee||payroll)throw Error("Verification account has unexpected payroll data");
  await ctx.db.delete(business._id);
 }
 if(c){for(const e of await ctx.db.query("accountantCampaignEvents").withIndex("by_campaign",q=>q.eq("campaign",c._id)).collect())await ctx.db.delete(e._id);await ctx.db.delete(c._id);}
 if(user.profilePhotoStorageId)await ctx.storage.delete(user.profilePhotoStorageId);
 await ctx.db.delete(user._id);
 return {cleaned:true};
}});
