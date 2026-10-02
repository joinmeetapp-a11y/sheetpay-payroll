"use node";
import { randomBytes,createHash,randomUUID } from "node:crypto";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { campaignSender,sendCampaignMail } from "./lib/email";
const api=internal as any;
export const readiness=internalAction({args:{},handler:()=>{
 const sender=campaignSender(),site=process.env.CONVEX_SITE_URL;
 return {ready:sender.configured&&!!site?.startsWith("https://")&&!!site?.endsWith(".convex.site"),resendConfigured:sender.configured,unsubscribeHostConfigured:!!site?.endsWith(".convex.site"),campaign:"accountant_free_7_day_v1"};
}});
export const enrollNewUser=internalAction({
 args:{userId:v.id("users")},
 handler:async(ctx,args)=>{
  const token=randomBytes(32).toString("hex");
  return ctx.runMutation(api.accountantCampaign.enroll,{userId:args.userId,token,tokenHash:createHash("sha256").update(token).digest("hex")});
 }
});
export const sendDay=internalAction({
 args:{campaign:v.id("accountantEmailCampaigns")},
 handler:async(ctx,args)=>{
  const sender=campaignSender();
  // The existing deployment supplies this automatically; never invent an endpoint.
  const site=process.env.CONVEX_SITE_URL;
  if(!site?.startsWith("https://")||!site.endsWith(".convex.site"))return {skipped:"site_configuration"};
  const leaseId=randomUUID();
  // Repairs token initialization if the signup background action was interrupted.
  const record=await ctx.runQuery(api.accountantCampaign.getTokenInitialization,{campaign:args.campaign});
  if(record?.needsToken)await ctx.runAction(api.accountantCampaignWorker.enrollNewUser,{userId:record.userId});
  const send=await ctx.runMutation(api.accountantCampaign.claim,{campaign:args.campaign,leaseId,from:sender.from,replyTo:sender.replyTo,site});
  if(!send?.payload)return {skipped:"ineligible_or_not_due"};
  const result=await sendCampaignMail(send.payload,send.key,()=>ctx.runMutation(api.accountantCampaign.shouldSendFreeUserCampaignEmail,{eventId:send.eventId,leaseId}));
  await ctx.runMutation(api.accountantCampaign.finish,{eventId:send.eventId,leaseId,...result});
  return {sent:!!result.messageId};
 }
});
export const dispatch=internalAction({
 args:{},
 handler:async(ctx)=>{
  const rows=await ctx.runQuery(api.accountantCampaign.due,{});
  for(const row of rows){
   try{await ctx.runAction(api.accountantCampaignWorker.sendDay,{campaign:row._id});}
   catch{ /* A persisted lease is recovered by the next cron; no raw provider errors. */ }
   await new Promise(resolve=>setTimeout(resolve,600));
  }
  return {processed:rows.length};
 }
});
