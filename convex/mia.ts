"use node";
import { action, internalAction } from './_generated/server';
import { v, ConvexError } from 'convex/values';
import { internal } from './_generated/api';
import { miaInstructions } from '../shared/miaKnowledge';
import { sendSupportMail } from './lib/email';
const api:any=internal;
function pagePath(value:string) {return /^\/[a-z0-9/-]*$/i.test(value) ? value.slice(0,180) : '/';}
function clean(value:string,max:number,label:string){const text=value.trim();if(!text||text.length>max||/[\0]/.test(text))throw new ConvexError(`Check ${label}.`);return text;}
export const chat=action({args:{token:v.optional(v.string()),message:v.string(),history:v.array(v.object({role:v.union(v.literal('user'),v.literal('assistant')),content:v.string()})),page:v.string()},handler:async(ctx,args):Promise<any>=>{
 const message=clean(args.message,2000,'your message');
 if(args.history.length>12 || args.history.some(m=>m.content.length>2000) || args.history.reduce((n,m)=>n+m.content.length,0)>12000)throw new ConvexError('Please clear or shorten this conversation.');
 const auth:any=await ctx.runMutation(api.miaInternal.reserveChat,{token:args.token});
 if(!process.env.OPENAI_API_KEY)return {ok:false,error:'Mia is temporarily unavailable. You can call, WhatsApp or email Sheetpay support.'};
 try{
  const response=await fetch('https://api.openai.com/v1/responses',{method:'POST',signal:AbortSignal.timeout(25000),headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({model:process.env.MIA_SUPPORT_MODEL||'gpt-4o-mini',store:false,instructions:miaInstructions({...auth.context,currentPage:pagePath(args.page)}),input:[...args.history,{role:'user',content:message}],max_output_tokens:650,safety_identifier:await hash(auth.key)})});
  if(!response.ok)return {ok:false,error:'Mia could not connect right now. Retry, or contact Sheetpay support.'};
  const data:any=await response.json();
  const reply=(data.output||[]).filter((x:any)=>x.type==='message').flatMap((x:any)=>x.content||[]).filter((x:any)=>x.type==='output_text').map((x:any)=>x.text).join('\n').trim().slice(0,4000);
  return reply?{ok:true,reply}:{ok:false,error:'Mia could not complete that answer. Please retry or contact support.'};
 }catch{return {ok:false,error:'Mia is having a connection problem. Please retry or use the human support options.'};}
}});
async function hash(value:string){const {createHash}=await import('node:crypto');return createHash('sha256').update(value).digest('hex');}
export const submitRequest=action({args:{token:v.optional(v.string()),requestId:v.string(),name:v.string(),email:v.string(),subject:v.string(),description:v.string(),page:v.string(),transcript:v.string(),consent:v.boolean(),website:v.string()},handler:async(ctx,args):Promise<any>=>{
 if(args.website || !/^[a-f0-9-]{36}$/i.test(args.requestId))throw new ConvexError('Please check the support form.');
 const name=clean(args.name,100,'your name'),email=clean(args.email,254,'your email').toLowerCase(),subject=clean(args.subject,150,'the subject'),description=clean(args.description,4000,'the issue description');
 if(!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email)||/[\r\n]/.test(name+email+subject))throw new ConvexError('Enter a valid reply email and subject.');
 if(args.transcript.length>16000)throw new ConvexError('Shorten the transcript before sending.');
 if(!args.consent && args.transcript)throw new ConvexError('Transcript consent is required.');
 if(!process.env.RESEND_API_KEY)return {ok:false,error:'Support email is temporarily unavailable. Use email, phone or WhatsApp.'};
 const {request,send}:any=await ctx.runMutation(api.miaInternal.reserveTicket,{token:args.token,requestId:args.requestId,name,email,subject,description,page:pagePath(args.page),transcript:args.transcript,consent:args.consent});
 if(send){
  const text=`Support reference: ${request.reference}\nName: ${name}\nReply email: ${email}\nSubject: ${subject}\nIssue: ${description}\nPage: ${request.page}\nCreated: ${new Date(request.createdAt).toISOString()}\nAccount context: ${JSON.stringify(request.context)}\nTranscript consent: ${request.consent?'Yes':'No'}\n${request.consent?request.transcript:'No transcript included.'}`;
  const delivered=await sendSupportMail({to:'support@sheetpay.app',replyTo:email,subject:`[${request.reference}] ${subject}`,text,idempotencyKey:`mia-ticket-${request._id}`});
  await ctx.runMutation(api.miaInternal.markDelivery,{id:request._id,status:delivered.ok?'accepted':'failed',...(delivered.id?{providerId:delivered.id}:{})});
  if(!delivered.ok)return {ok:false,reference:request.reference,error:'The email service did not confirm acceptance. Retry this request or contact support with the reference.'};
 }
 try { await ctx.runAction(api.mia.acknowledge,{id:request._id}); } catch { /* accepted request remains accepted; cron retries acknowledgement */ }
 const updated:any=await ctx.runQuery(api.miaInternal.getTicket,{id:request._id});
 return {ok:true,reference:request.reference,acknowledged:updated?.ackStatus==='accepted'};
}});
export const acknowledge=internalAction({args:{id:v.id('miaRequests')},handler:async(ctx,args)=>{
 const row:any=await ctx.runQuery(api.miaInternal.getTicket,args);
 if(!row || row.status!=='accepted'||row.ackStatus==='accepted')return;
 const sent=await sendSupportMail({to:row.email,replyTo:'support@sheetpay.app',subject:`Sheetpay support request ${row.reference}`,text:`Hi ${row.name},\n\nYour support request (${row.reference}) has been accepted by our email service for delivery to Sheetpay support. Keep this reference for follow-up.\n\nPhone: +1 868 292 3787\nEmail: support@sheetpay.app\nWhatsApp: https://wa.me/18682923787\n\nMia is Sheetpay's AI support assistant.`,idempotencyKey:`mia-ack-${row._id}`});
 await ctx.runMutation(api.miaInternal.markAck,{id:row._id,status:sent.ok?'accepted':'pending'});
}});
export const retryAcknowledgements=internalAction({args:{},handler:async ctx=>{
 const rows:any=await ctx.runQuery(api.miaInternal.pendingAcks,{});
 for(const row of rows){if(Date.now()-row.createdAt>=23*3600000){await ctx.runMutation(api.miaInternal.markAck,{id:row._id,status:'failed'});continue;}if(row.status==='accepted')await ctx.runAction(api.mia.acknowledge,{id:row._id});}
}});
