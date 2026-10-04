import { internalMutation, internalQuery, mutation } from './_generated/server';
import { ConvexError, v } from 'convex/values';
import { accountantPlanFor, accountantLimitsFor, accountantRemindersFor, hasUnlimitedAccountantAccess } from './usage';
import { usagePeriod } from '../shared/accountantPlans';
const DAY = 86400000;
export async function tokenHash(token: string) {
 return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token)))).map(x=>x.toString(16).padStart(2,'0')).join('');
}
export async function principal(ctx: any, token?: string) {
 const identity = await ctx.auth.getUserIdentity();
 if (identity) return { key: `user:${identity.subject}`, signedIn: true };
 if (!token || !/^[a-f0-9-]{72,80}$/.test(token)) throw new ConvexError('SUPPORT_SESSION_EXPIRED');
 const hash = await tokenHash(token);
 const row = await ctx.db.query('miaSessions').withIndex('by_hash',(q:any)=>q.eq('tokenHash', hash)).first();
 if (!row || row.expiresAt <= Date.now()) throw new ConvexError('SUPPORT_SESSION_EXPIRED');
 return { key: `anon:${hash}`, signedIn: false };
}
export async function takeRate(ctx:any, key:string, periodMs:number, limit:number) {
 const bucket = `${key}:${Math.floor(Date.now()/periodMs)}`;
 const row = await ctx.db.query('miaRates').withIndex('by_key',(q:any)=>q.eq('key',bucket)).first();
 if ((row?.count || 0) >= limit) throw new ConvexError('SUPPORT_RATE_LIMITED: Please wait before trying again, or use phone/WhatsApp/email support.');
 if (row) await ctx.db.patch(row._id,{count:row.count+1});
 else await ctx.db.insert('miaRates',{key:bucket,count:1,expiresAt:Date.now()+2*DAY});
}
export const issueSession = mutation({ args:{}, handler:async ctx=>{
 // Anonymous token rotation cannot bypass the site-wide cost ceiling.
 await takeRate(ctx,'sessions:global-hour',3600000,50);
 await takeRate(ctx,'sessions:global-day',DAY,200);
 const token = `${crypto.randomUUID()}${crypto.randomUUID()}`;
 await ctx.db.insert('miaSessions',{tokenHash:await tokenHash(token),expiresAt:Date.now()+DAY});
 return { token, expiresAt:Date.now()+DAY };
}});
export async function accountContext(ctx:any) {
 const identity = await ctx.auth.getUserIdentity();
 if (!identity) return { signedIn:false };
 const user = await ctx.db.query('users').withIndex('by_firebase_uid',(q:any)=>q.eq('firebaseUid',identity.subject)).first();
 if (!user) return {signedIn:true, accountReady:false};
 const plan = accountantPlanFor(user);
 const row = await ctx.db.query('usageCounters').withIndex('by_user_period',(q:any)=>q.eq('userId',user._id).eq('period',usagePeriod())).first();
 return {signedIn:true,plan,subscriptionStatus:user.planStatus || 'none', unlimitedAccess:hasUnlimitedAccountantAccess(user), limits:accountantLimitsFor(user), reminderLimits:accountantRemindersFor(user), usage:{payslips:row?.payslipsUsed || 0,cayla:row?.caylaActionsUsed || 0,ocr:row?.ocrScansUsed || 0,emails:row?.emailsReserved || 0,reminderEmails:row?.reminderEmailsReserved || 0}};
}
export const reserveChat = internalMutation({args:{token:v.optional(v.string())},handler:async(ctx,args)=>{
 const actor = await principal(ctx,args.token);
 await takeRate(ctx,`chat:minute:${actor.key}`,60000,actor.signedIn?10:4);
 await takeRate(ctx,`chat:day:${actor.key}`,DAY,actor.signedIn?100:20);
 await takeRate(ctx,`chat:global:${actor.signedIn?'user':'anon'}`,DAY,actor.signedIn?1000:200);
 return {key:actor.key,context:await accountContext(ctx)};
}});
const ticketArgs={token:v.optional(v.string()),requestId:v.string(),name:v.string(),email:v.string(),subject:v.string(),description:v.string(),page:v.string(),transcript:v.string(),consent:v.boolean()};
export const reserveTicket = internalMutation({args:ticketArgs,handler:async(ctx,args)=>{
 const actor=await principal(ctx,args.token);
 const key=`${actor.key}:${args.requestId}`;
 const existing=await ctx.db.query('miaRequests').withIndex('by_key',(q:any)=>q.eq('key',key)).first();
 if(existing){
  if (existing.expiresAt<=Date.now()) throw new ConvexError('SUPPORT_REQUEST_EXPIRED');
  if (existing.name!==args.name || existing.email!==args.email || existing.subject!==args.subject || existing.description!==args.description || existing.transcript!==(args.consent?args.transcript:'') || existing.consent!==args.consent) throw new ConvexError('Use a new support request for changed details.');
  if (existing.status==='accepted') return {request:existing,send:false};
  if (existing.status==='sending' && existing.updatedAt>Date.now()-60000) throw new ConvexError('Support request is already being sent. Please wait.');
  // Resend deduplicates only for 24 hours. Never retry an uncertain request after that window.
  if (Date.now()-existing.createdAt>23*3600000) throw new ConvexError('This request needs manual delivery review. Contact support with its reference.');
  await takeRate(ctx,`ticket-retry:${actor.key}`,60000,2);
  await ctx.db.patch(existing._id,{status:'sending',updatedAt:Date.now()});
  return {request:existing,send:true};
 }
 await takeRate(ctx,`tickets:${actor.key}`,DAY,actor.signedIn?5:2);
 await takeRate(ctx,`tickets:global:${actor.signedIn?'user':'anon'}`,DAY,actor.signedIn?100:20);
 const data={key,principal:actor.key,reference:`MIA-${crypto.randomUUID().slice(0,8).toUpperCase()}`,name:args.name,email:args.email,subject:args.subject,description:args.description,page:args.page,transcript:args.consent?args.transcript:'',consent:args.consent,context:await accountContext(ctx),status:'sending',ackStatus:'pending',createdAt:Date.now(),updatedAt:Date.now(),expiresAt:Date.now()+90*DAY};
 const id=await ctx.db.insert('miaRequests',data);
 return {request:{...data,_id:id},send:true};
}});
export const markDelivery = internalMutation({args:{id:v.id('miaRequests'),status:v.string(),providerId:v.optional(v.string())},handler:async(ctx,args)=>{
 const row=await ctx.db.get(args.id); if(!row)return;
 // Provider failures must never downgrade a previously accepted delivery.
 if(row.status==='accepted' && args.status!=='accepted')return;
 await ctx.db.patch(args.id,{status:args.status,providerId:args.providerId,updatedAt:Date.now()});
}});
export const markAck = internalMutation({args:{id:v.id('miaRequests'),status:v.string()},handler:async(ctx,args)=>{const row=await ctx.db.get(args.id);if(!row)return;const attempts=(row.ackAttempts||0)+1;await ctx.db.patch(args.id,{ackStatus:args.status==='pending'&&attempts>=8?'failed':args.status,ackAttempts:attempts});}});
export const getTicket = internalQuery({args:{id:v.id('miaRequests')},handler:(ctx,args)=>ctx.db.get(args.id)});
export const pendingAcks = internalQuery({args:{},handler:async ctx=>await ctx.db.query('miaRequests').withIndex('by_delivery_ack',(q:any)=>q.eq('status','accepted').eq('ackStatus','pending')).take(50)});
export const purgeExpired = internalMutation({args:{},handler:async ctx=>{
 for(const table of ['miaSessions','miaRates','miaRequests'] as const){
  const rows=await ctx.db.query(table).withIndex('by_expiry',(q:any)=>q.lt('expiresAt',Date.now())).take(300);
  for(const row of rows)await ctx.db.delete(row._id);
 }
}});

