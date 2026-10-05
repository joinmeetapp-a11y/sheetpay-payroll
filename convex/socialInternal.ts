import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { isAdminEmail } from "./admin";

const id=v.id("socialPosts");
export const attempt = internalMutation({args:{id,operationId:v.string(),model:v.string()},handler:async(ctx,a)=>{
  const p=await ctx.db.get(a.id);if(!p||p.operationId!==a.operationId||p.status!=="generating")throw new Error("Generation cancelled");
  await ctx.db.patch(p._id,{generationAttempts:p.generationAttempts+1,openAIModel:a.model,leaseUntil:Date.now()+600000});
}});
export const completeGeneration = internalMutation({args:{id,operationId:v.string(),caption:v.string(),hook:v.string(),imageText:v.string(),
  lesson:v.string(),storyAngle:v.string(),phrases:v.array(v.string()),embedding:v.array(v.number()),storageId:v.id("_storage"),portraitId:v.id("_storage")},
  handler:async(ctx,a)=>{
    const p=await ctx.db.get(a.id);
    if(!p||p.operationId!==a.operationId||p.status!=="generating"){await ctx.storage.delete(a.storageId);return false;}
    const settings=await ctx.db.query("socialSettings").withIndex("by_key",q=>q.eq("key","kurt-prince")).unique();
    if(settings?.portraitId!==a.portraitId){await ctx.storage.delete(a.storageId);throw new Error("Portrait changed during rendering. Regenerate.");}
    const approvalRequired=settings.mode==="approval";
    const old=p.imageStorageId;
    await ctx.db.patch(p._id,{caption:a.caption,hook:a.hook,imageText:a.imageText,lesson:a.lesson,
      storyAngle:a.storyAngle,phrases:a.phrases,embedding:a.embedding,imageStorageId:a.storageId,imageRevision:p.revision,
      status:approvalRequired?"awaiting_approval":"scheduled",approvalRequired,imagePortraitId:a.portraitId,hashtags:a.caption.match(/#\w+/g)||[],
      sheetpayMentioned:/sheetpay/i.test(a.caption),sheetpayUrlIncluded:a.caption.includes("https://sheetpay.app/accountant"),
      error:undefined,errorPhase:undefined,leaseUntil:undefined,updatedAt:Date.now()});
    if(old)await ctx.storage.delete(old);
    await ctx.db.insert("socialGenerationLogs",{postId:p._id,event:"generated",phase:"generation",createdAt:Date.now()});
    if(approvalRequired){
      const key="social-ready:"+p._id+":"+p.revision;
      const exists=await ctx.db.query("notifications").withIndex("by_user_dedupe",q=>q.eq("userId",p.ownerId).eq("dedupeKey",key)).first();
      if(!exists)await ctx.db.insert("notifications",{userId:p.ownerId,category:"social",type:"social_approval",
        title:"Today's LinkedIn post is ready.",message:"Review your story and image before publishing.",
        actionUrl:"/admin/social",dedupeKey:key,createdAt:Date.now()});
    }
    return true;
  }
});
export const fail = internalMutation({args:{id,operationId:v.optional(v.string()),phase:v.string(),message:v.string(),unknown:v.optional(v.boolean())},handler:async(ctx,a)=>{
  const p=await ctx.db.get(a.id);if(!p||p.status==="published"||p.status==="skipped"||(a.operationId&&p.operationId!==a.operationId))return;
  await ctx.db.patch(p._id,{status:"failed",error:a.message.slice(0,500),errorPhase:a.phase,
    outcomeUnknown:!!a.unknown,leaseUntil:undefined,updatedAt:Date.now()});
  await ctx.db.insert("socialGenerationLogs",{postId:p._id,event:"failed",phase:a.phase,message:a.message.slice(0,500),createdAt:Date.now()});
}});
export const claimPublish = internalMutation({args:{id,operationId:v.string(),manual:v.optional(v.boolean())},handler:async(ctx,a)=>{
  const p=await ctx.db.get(a.id);if(!p||!["scheduled","approved","failed"].includes(p.status)||p.outcomeUnknown||p.publishRequestStartedAt||p.linkedinPostId)return null;
  const s=await ctx.db.query("socialSettings").withIndex("by_key",q=>q.eq("key","kurt-prince")).unique();
  if(!s||s.ownerId!==p.ownerId)throw new Error("Settings unavailable");
  if(!a.manual&&!s.postingEnabled)return null;
  if((s.mode==="approval"||p.approvalRequired)&&!p.approvedAt)throw new Error("Approval required");
  if(!p.caption||!p.imageStorageId||p.imageRevision!==p.revision)throw new Error("Caption and current image required");
  if(p.imagePortraitId!==s.portraitId)throw new Error("Portrait changed. Regenerate the image.");
  if(!s.testMode&&process.env.SOCIAL_LIVE_PUBLISH_APPROVED!=="true")throw new Error("Live publishing is locked");
  await ctx.db.patch(p._id,{status:"publishing",operationId:a.operationId,leaseUntil:Date.now()+600000,
    error:undefined,errorPhase:undefined,publishAttemptId:a.operationId,updatedAt:Date.now()});
  return {testMode:s.testMode};
}});
export const testComplete = internalMutation({args:{id,operationId:v.string()},handler:async(ctx,a)=>{
  const p=await ctx.db.get(a.id);if(!p||p.operationId!==a.operationId||p.status!=="publishing")return;
  await ctx.db.patch(p._id,{status:"approved",testCompletedAt:Date.now(),leaseUntil:undefined,updatedAt:Date.now()});
  await ctx.db.insert("socialGenerationLogs",{postId:p._id,event:"test_complete",phase:"publishing",message:"TEST MODE — no LinkedIn upload or post request sent",createdAt:Date.now()});
}});
export const beginPostRequest = internalMutation({args:{id,operationId:v.string(),connectionId:v.id("linkedinConnections"),imageUrn:v.string(),manual:v.optional(v.boolean())},handler:async(ctx,a)=>{
  const p=await ctx.db.get(a.id),c=await ctx.db.get(a.connectionId);
  const s=await ctx.db.query("socialSettings").withIndex("by_key",q=>q.eq("key","kurt-prince")).unique();
  if(!p||p.operationId!==a.operationId||p.status!=="publishing"||p.publishRequestStartedAt||
    !s||s.testMode||process.env.SOCIAL_LIVE_PUBLISH_APPROVED!=="true"||!c||c.ownerId!==p.ownerId||
    c.status!=="connected"||c.expiresAt<=Date.now()||p.imagePortraitId!==s.portraitId||
    (!a.manual&&!s.postingEnabled)||(s.mode==="approval"&&!p.approvedAt))throw new Error("Live publication guard rejected the request");
  const user=await ctx.db.get(p.ownerId),role=await ctx.db.query("adminRoles").withIndex("by_user",q=>q.eq("userId",p.ownerId)).first();
  if(!user?.emailVerified||(role?!["super_admin","admin"].includes(role.role):!isAdminEmail(user.email)))throw new Error("Live publishing owner is no longer authorized");
  await ctx.db.patch(p._id,{linkedinImageUrn:a.imageUrn,publishRequestStartedAt:Date.now(),outcomeUnknown:true});
}});
export const definiteRejection = internalMutation({args:{id,operationId:v.string()},handler:async(ctx,a)=>{
  const p=await ctx.db.get(a.id);if(p?.operationId===a.operationId)
    await ctx.db.patch(p._id,{publishRequestStartedAt:undefined,outcomeUnknown:false});
}});
export const published = internalMutation({args:{id,operationId:v.string(),linkedinPostId:v.string(),status:v.number(),requestId:v.optional(v.string())},handler:async(ctx,a)=>{
  const p=await ctx.db.get(a.id);if(!p||p.operationId!==a.operationId)return;
  // A late response after timeout recovery still reconciles this same attempt.
  await ctx.db.patch(p._id,{status:"published",linkedinPostId:a.linkedinPostId,
    linkedinPostUrl:"https://www.linkedin.com/feed/update/"+a.linkedinPostId,
    publishedAt:Date.now(),outcomeUnknown:false,leaseUntil:undefined,error:undefined,updatedAt:Date.now(),
    linkedinResponse:{status:a.status,requestId:a.requestId}});
  const c=await ctx.db.query("linkedinConnections").withIndex("by_owner",q=>q.eq("ownerId",p.ownerId)).unique();
  if(c)await ctx.db.patch(c._id,{lastSuccessfulPostAt:Date.now()});
  await ctx.db.insert("socialGenerationLogs",{postId:p._id,event:"published",phase:"publishing",createdAt:Date.now()});
}});
export const newOAuthState = internalMutation({args:{actorId:v.id("users"),hash:v.string()},handler:async(ctx,a)=>{
  await ctx.db.insert("socialOAuthStates",{ownerId:a.actorId,hash:a.hash,expiresAt:Date.now()+600000});
}});
export const consumeOAuthState = internalMutation({args:{actorId:v.id("users"),hash:v.string()},handler:async(ctx,a)=>{
  const row=await ctx.db.query("socialOAuthStates").withIndex("by_hash",q=>q.eq("hash",a.hash)).unique();
  if(!row||row.ownerId!==a.actorId||row.expiresAt<=Date.now()||row.consumedAt)throw new Error("Invalid or expired OAuth state");
  await ctx.db.patch(row._id,{consumedAt:Date.now()});
}});
export const storeConnection = internalMutation({args:{ownerId:v.id("users"),memberUrn:v.string(),name:v.string(),
  encryptedAccessToken:v.string(),encryptedRefreshToken:v.optional(v.string()),expiresAt:v.number(),
  refreshExpiresAt:v.optional(v.number()),scopes:v.array(v.string())},handler:async(ctx,a)=>{
  const user=await ctx.db.get(a.ownerId),role=await ctx.db.query("adminRoles").withIndex("by_user",q=>q.eq("userId",a.ownerId)).first();
  if(!user?.emailVerified||(role?!["super_admin","admin"].includes(role.role):!isAdminEmail(user.email)))throw new Error("Admin no longer authorized");
  const old=await ctx.db.query("linkedinConnections").withIndex("by_owner",q=>q.eq("ownerId",a.ownerId)).unique();
  const row={...a,connectedAt:Date.now(),verifiedAt:Date.now(),status:"connected"};
  if(old)await ctx.db.replace(old._id,{...row,lastSuccessfulPostAt:old.lastSuccessfulPostAt});
  else await ctx.db.insert("linkedinConnections",row);
}});
export const updateConnection = internalMutation({args:{id:v.id("linkedinConnections"),encryptedAccessToken:v.optional(v.string()),
  encryptedRefreshToken:v.optional(v.string()),expiresAt:v.optional(v.number()),refreshExpiresAt:v.optional(v.number()),status:v.optional(v.string()),verifiedAt:v.optional(v.number())},
  handler:async(ctx,a)=>{
    if(!await ctx.db.get(a.id))throw new Error("LinkedIn disconnected");
    const {id,...patch}=a;await ctx.db.patch(id,Object.fromEntries(Object.entries(patch).filter(([,value])=>value!==undefined)));
  }
});
export const connection = internalQuery({args:{ownerId:v.id("users")},handler:async(ctx,a)=>
  ctx.db.query("linkedinConnections").withIndex("by_owner",q=>q.eq("ownerId",a.ownerId)).unique()
});
