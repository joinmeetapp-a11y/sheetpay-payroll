import { mutation, query, internalMutation } from './_generated/server';
import { v } from 'convex/values';
import { internal } from './_generated/api';
import { resolveAdmin } from './admin';
import { touchValidator } from './growthSchema';
import { budget, hash, sanitizeTouch, uiEvents, errors, ensureSummary, recordGrowth, recordApprovedPayroll } from './lib/growth';
const DAY=86400000;
const interestValidator=v.union(v.literal('mobile'),v.literal('accountant'),v.literal('calculator'),v.literal('unknown'));
const uiValidator=v.union(...uiEvents.map(x=>v.literal(x)));
const errorValidator=v.union(...errors.map(x=>v.literal(x)));
const validKey=(s:string)=>/^[a-f0-9]{64}$/.test(s);
export const visit = mutation({
 args:{key:v.string(),session:v.string(),touch:touchValidator},
 handler:async(ctx,args)=>{
  if(!validKey(args.key)||!validKey(args.session)) return {accepted:false};
  const keyHash=await hash(args.key);
  if(!await budget(ctx,'anonymous-global',3000)||!await budget(ctx,keyHash,30)) return {accepted:false};
  const now=Date.now(),touch=sanitizeTouch(args.touch),sessionHash=await hash(args.session);
  if(touch.path==='/private') return {accepted:false};
  const previous=await ctx.db.query('growthVisitors').withIndex('by_key',q=>q.eq('keyHash',keyHash)).unique();
  if(previous){
   const newSession=previous.sessionHash!==sessionHash;
   await ctx.db.patch(previous._id,{lastAt:now,expiresAt:now+365*DAY,sessionHash,sessions:previous.sessions+(newSession?1:0),...(newSession ? {last:touch}:{})});
   return {accepted:true};
  }
  await ctx.db.insert('growthVisitors',{keyHash,first:touch,last:touch,firstAt:now,lastAt:now,interest:'unknown',sessions:1,sessionHash,expiresAt:now+365*DAY});
  return {accepted:true};
 }
});
export const associate = mutation({args:{key:v.string()},handler:async(ctx,args)=>{
 const identity=await ctx.auth.getUserIdentity(); if(!identity||!validKey(args.key))return;
 const user=await ctx.db.query('users').withIndex('by_firebase_uid',q=>q.eq('firebaseUid',identity.subject)).unique();if(!user)return;
 const awaitHash=await hash(args.key);
 const visitor=await ctx.db.query('growthVisitors').withIndex('by_key',q=>q.eq('keyHash',awaitHash)).unique();
 if(!visitor || visitor.userId && visitor.userId!==user._id)return;
 const summary=await ensureSummary(ctx,user._id);
 await ctx.db.patch(visitor._id,{userId:user._id});
 const priorEvents = await ctx.db.query('growthEvents').withIndex('by_visitor',q=>q.eq('visitorId',visitor._id)).take(200);
 for(const event of priorEvents) if(uiEvents.includes(event.name as any))await recordGrowth(ctx,user._id,event.name,String(event._id),event.at,event.errorCategory,'browser');
 await ctx.db.patch(summary._id,{...(summary.first || visitor.firstAt>summary.joinedAt || summary.joinedAt-visitor.firstAt>7*DAY ? {} : {first:visitor.first,visitorId:visitor._id}),last:visitor.last,...(summary.firstInterest?{}:visitor.firstInterest?{firstInterest:visitor.firstInterest}:{}),interest:visitor.interest==='unknown'?summary.interest:visitor.interest});
}});
export const uiEvent=mutation({args:{key:v.optional(v.string()),name:uiValidator,requestKey:v.string(),interest:v.optional(interestValidator),errorCategory:v.optional(errorValidator)},handler:async(ctx,args)=>{
 if(!/^[a-zA-Z0-9:_-]{1,100}$/.test(args.requestKey))return;
 const identity=await ctx.auth.getUserIdentity();
 const user=identity ? await ctx.db.query('users').withIndex('by_firebase_uid',q=>q.eq('firebaseUid',identity.subject)).unique():null;
 const h=args.key && validKey(args.key)?await hash(args.key):null;
 const visitor=h?await ctx.db.query('growthVisitors').withIndex('by_key',q=>q.eq('keyHash',h)).unique():null;
 if(!user && !visitor)return;
 if(!await budget(ctx,'events-global',6000)||!await budget(ctx, user?String(user._id):h!,60))return;
 if(user) {
  await recordGrowth(ctx,user._id,args.name,args.requestKey,Date.now(),args.errorCategory,'browser');
  if(args.interest){const event=await ctx.db.query('growthEvents').withIndex('by_key',q=>q.eq('key',`${user._id}:${args.name}:${args.requestKey}`)).unique();if(event)await ctx.db.patch(event._id,{product:args.interest});}
  if(args.errorCategory)await recordGrowth(ctx,user._id,'error_'+args.errorCategory,args.requestKey,Date.now(),args.errorCategory,'browser');
  if(args.interest && ['product_selected','product_switched','mobile_cta_clicked','accountant_cta_clicked','calculator_used','payslip_generator_cta_clicked','mobile_launch_notification_clicked'].includes(args.name)){
   const s=await ensureSummary(ctx,user._id);
   // Calculator use does not override a declared product choice.
   if(args.interest!=='calculator' && s.interest!=='unknown' && s.interest!==args.interest)await recordGrowth(ctx,user._id,'product_switched',args.requestKey,Date.now(),undefined,'browser');
   if(args.interest!=='calculator'||s.interest==='unknown')await ctx.db.patch(s._id,{interest:args.interest,...(s.firstInterest||args.interest==='calculator'?{}:{firstInterest:args.interest})});
  }
 }
 if(visitor && (!visitor.userId || !user || visitor.userId===user._id)){
  const dedupe=`visitor:${visitor._id}:${args.name}:${args.requestKey}`;
  if(!await ctx.db.query('growthEvents').withIndex('by_key',q=>q.eq('key',dedupe)).unique())await ctx.db.insert('growthEvents',{visitorId:visitor._id,name:args.name,key:dedupe,at:Date.now(),origin:'browser',...(args.interest?{product:args.interest}:{}),...(args.errorCategory?{errorCategory:args.errorCategory}:{}),expiresAt:Date.now()+180*DAY});
  if(args.interest && (args.interest!=='calculator'||visitor.interest==='unknown'))await ctx.db.patch(visitor._id,{interest:args.interest,...(visitor.firstInterest||args.interest==='calculator'?{}:{firstInterest:args.interest})});
 }
}});
export const forget=mutation({args:{key:v.string()},handler:async(ctx,args)=>{
 if(!validKey(args.key))return;const h=await hash(args.key);
 const visitor=await ctx.db.query('growthVisitors').withIndex('by_key',q=>q.eq('keyHash',h)).unique();if(!visitor)return;
 if(visitor.userId){const s=await ctx.db.query('growthUsers').withIndex('by_user',q=>q.eq('userId',visitor.userId!)).unique();if(s?.visitorId===visitor._id)await ctx.db.patch(s._id,{first:undefined,last:undefined,visitorId:undefined,interest:'unknown',firstInterest:undefined});}
 // Remove bounded batches of optional visitor events in the scheduled purge.
 await ctx.db.patch(visitor._id,{expiresAt:0});
}});
export const generatedPayslip=mutation({args:{runId:v.id('payrollRuns')},handler:async(ctx,args)=>{
 const identity=await ctx.auth.getUserIdentity();if(!identity)throw new Error('Unauthenticated');
 const run=await ctx.db.get(args.runId);if(!run)throw new Error('Not found');
 const {requireBusinessAccess}=await import('./lib/accountantAccess');
 const access=await requireBusinessAccess(ctx,await ctx.db.get(run.businessId),'read');
 // The PDF exists client-side; this is a validated client acknowledgement, never payroll completion proof.
 await recordGrowth(ctx,access.owner._id,'payslip_generated',String(run._id),Date.now(),undefined,'browser');
}});
async function authorize(ctx:any,uid:string){const admin=await resolveAdmin(ctx,uid);if(!admin||!['super_admin','admin','analytics'].includes(admin.role))throw new Error('Forbidden');return admin;}
export const stages=['signup_completed','email_verification_completed','accountant_onboarding_completed','client_created','employee_added','first_real_payroll_completed','payslip_generated','paywall_viewed','checkout_started','subscription_activated','second_payroll_completed'];
const median=(values:number[])=>{if(!values.length)return null;values.sort((a,b)=>a-b);const i=Math.floor(values.length/2);return values.length%2?values[i]:(values[i-1]+values[i])/2;};
const ratio=(a:number,b:number)=>b?a/b:null;
const filters={requesterUid:v.string(),from:v.number(),to:v.number(),source:v.optional(v.string()),interest:v.optional(v.string()),country:v.optional(v.string()),cohort:v.union(v.literal('signup'),v.literal('acquisition'))};
export const report=query({args:filters,handler:async(ctx,args)=>{
 const admin=await authorize(ctx,args.requesterUid);
 const canViewRevenue=['super_admin','admin'].includes(admin.role);
 if(args.to<args.from||args.to-args.from>366*DAY||args.to>Date.now()+DAY)throw new Error('Choose a date range of up to 366 days');
 const LIMIT=5000;
 const visitors=await ctx.db.query('growthVisitors').withIndex('by_first',q=>q.gte('firstAt',args.from).lt('firstAt',args.to)).take(LIMIT+1);
 const registered=await ctx.db.query('growthUsers').withIndex('by_joined',q=>q.gte('joinedAt',args.from).lt('joinedAt',args.to)).take(LIMIT+1);
 const newlyPaid=await ctx.db.query('growthUsers').withIndex('by_paid_at',q=>q.gte('paidAt',Date.now()-30*DAY)).take(LIMIT+1);
 const allPaid=await ctx.db.query('growthUsers').withIndex('by_paid',q=>q.eq('paid',true)).take(LIMIT+1);
 const matches=(row:any)=> (!args.source|| (row.first?.source||'unknown')===args.source)&&(!args.interest||row.interest===args.interest)&&(!args.country||(row.country||'unknown')===args.country);
 let users:any[]=registered.slice(0,LIMIT);
 if(args.cohort==='acquisition'){
  users=[];
  for(const visitor of visitors.slice(0,LIMIT))if(visitor.userId){const s=await ctx.db.query('growthUsers').withIndex('by_user',q=>q.eq('userId',visitor.userId!)).unique();if(s?.visitorId===visitor._id)users.push(s);}
 }
 users=users.filter(matches);
 const visitorRows=visitors.slice(0,LIMIT).filter(v=>matches({...v,country:users.find(u=>u.visitorId===v._id)?.country}));
 const coverage=await ctx.db.query('growthState').withIndex('by_key',q=>q.eq('key','started')).unique();
 const uncertainOrder=users.some(u=>!coverage || u.joinedAt<coverage.value);
 const counts=stages.map(stage=>users.filter(u=>u.milestones[stage]!==undefined || u.historical.includes(stage) || stage==='email_verification_completed' && u.verification==='verified').length);
 // Ordered funnel: later steps count only when all preceding milestones exist in chronological order.
 let remaining=users;
 const funnel=stages.map((stage,i)=>{remaining=remaining.filter(u=>u.milestones[stage]!==undefined && (!i || u.milestones[stage]>=u.milestones[stages[i-1]]));return {stage,count:remaining.length,observed:counts[i],conversion:null as number|null,dropoff:null as number|null};});
 funnel.forEach((row,i)=>{const denominator=i?funnel[i-1].count:args.cohort==='acquisition'?visitorRows.length:users.length;row.conversion=ratio(row.count,denominator);row.dropoff=row.conversion===null?null:1-row.conversion;});
 const livePaid=[];
 for(const s of allPaid.slice(0,LIMIT)) {const user=await ctx.db.get(s.userId);if(s.billingVerified && user?.paddleSubscriptionId && user.planStatus==='active' && user.plan?.startsWith('accountant') && (!user.scheduledCancelAt || user.scheduledCancelAt>Date.now()))livePaid.push(s);}
 const currencies=Array.from(new Set(livePaid.map(s=>s.currency).filter(Boolean)));
 const mrr=livePaid.every(s=>s.monthlyRevenue!==undefined)&&currencies.length<=1?livePaid.reduce((n,s)=>n+s.monthlyRevenue!,0):null;
 const baseline=await ctx.db.query('growthState').withIndex('by_key',q=>q.eq('key','billingBaseline')).unique();
 const transitions=await ctx.db.query('growthBillingSnapshots').withIndex('by_at',q=>q.gte('at',args.from).lte('at',Date.now())).take(10001);
 let churnRate:number|null=null,retentionRate:number|null=null,revenueChurn:number|null=null;
 let cancellations:number|null=null,reactivations:number|null=null;
 if(baseline && args.from>=baseline.value && transitions.length<=10000){
  const atStart=new Map(livePaid.map(s=>[String(s.userId),{paid:true,revenue:s.monthlyRevenue,currency:s.currency}]));
  for(const change of [...transitions].reverse())atStart.set(String(change.userId),{paid:change.beforePaid,revenue:change.beforeRevenue,currency:change.currency});
  const starters=new Set([...atStart].filter(([,v])=>v.paid).map(([id])=>id));
  const inPeriod=transitions.filter(c=>c.at<args.to);
  const lost=new Set(inPeriod.filter(c=>c.beforePaid&&!c.afterPaid&&starters.has(String(c.userId))).map(c=>String(c.userId)));
  churnRate=ratio(lost.size,starters.size);retentionRate=churnRate===null?null:1-churnRate;
  cancellations=inPeriod.filter(c=>c.status==='canceled'||c.status==='expired').length;
  reactivations=inPeriod.filter(c=>!c.beforePaid&&c.afterPaid&&c.beforeKnown).length;
  const startRevenue=[...atStart.values()].filter(v=>v.paid);
  if(startRevenue.length && startRevenue.every(v=>v.revenue!==undefined) && new Set(startRevenue.map(v=>v.currency)).size===1){
   const losses=inPeriod.filter(c=>starters.has(String(c.userId))&&c.beforePaid);
   if(losses.every(c=>c.beforeRevenue!==undefined && (!c.afterPaid||c.afterRevenue!==undefined)))revenueChurn=ratio(losses.reduce((n,c)=>n+Math.max(0,c.beforeRevenue!-(c.afterPaid?c.afterRevenue!:0)),0),startRevenue.reduce((n,v)=>n+v.revenue!,0));
  }
 }
 const rows=new Map<string,any>();
 for(const visitor of visitorRows){let r=rows.get(visitor.first.path);if(!r){r={path:visitor.first.path,visitors:0,sessions:0,signups:0,activated:0,paying:0,revenue:null};rows.set(r.path,r);}r.visitors++;r.sessions+=visitor.sessions;const u=users.find(u=>u.visitorId===visitor._id);if(u){r.signups++;if(u.milestones.first_real_payroll_completed!==undefined)r.activated++;if(livePaid.some(s=>s.userId===u.userId))r.paying++;}}
 const breakdown=(key:'source'|'interest')=>{const m=new Map<string,any>();for(const v of visitorRows){const k=key==='source'?v.first.source:v.interest;const r=m.get(k)||{label:k,visitors:0,signups:0,activated:0};r.visitors++;m.set(k,r);}for(const u of users){const k=key==='source'?(u.first?.source||'unknown'):u.interest;const r=m.get(k)||{label:k,visitors:0,signups:0,activated:0};r.signups++;if(u.milestones.first_real_payroll_completed!==undefined)r.activated++;m.set(k,r);}return [...m.values()];};
 const has=(u:any,n:string)=>u.milestones[n]!==undefined;
 const specs:[string,(u:any)=>boolean,(u:any)=>boolean][]=[
 ['Registered, email unverified',u=>u.verification==='unverified',()=>true],
 ['Verified, no dashboard entry observed',u=>u.verification==='verified'&&!has(u,'dashboard_entered'),u=>u.verification==='verified'],
 ['Dashboard entered, no client observed',u=>has(u,'dashboard_entered')&&!has(u,'client_created'),u=>has(u,'dashboard_entered')],
 ['Client created, no employees observed',u=>has(u,'client_created')&&!has(u,'employee_added'),u=>has(u,'client_created')],
 ['Import completed, no payroll start observed',u=>has(u,'employee_import_completed')&&!has(u,'payroll_started'),u=>has(u,'employee_import_completed')],
 ['Payroll started with a processing error',u=>has(u,'payroll_started')&&has(u,'error_payroll_processing')&&!has(u,'first_real_payroll_completed'),u=>has(u,'payroll_started')],
 ['Cayla used, no successful action observed',u=>has(u,'cayla_interaction_started')&&!has(u,'cayla_tool_action_completed'),u=>has(u,'cayla_interaction_started')],
 ['Payroll completed, no payslip export observed',u=>has(u,'first_real_payroll_completed')&&!has(u,'payslip_generated'),u=>has(u,'first_real_payroll_completed')],
 ['Paywall observed, no paid subscription',u=>has(u,'paywall_viewed')&&!has(u,'subscription_activated'),u=>has(u,'paywall_viewed')],
 ];
 const diagnostics=specs.map(([label,predicate,base])=>{const affected=users.filter(predicate);return {label,count:affected.length,rate:ratio(affected.length,users.filter(base).length),lastAt:affected.length?Math.max(...affected.map(u=>u.lastAt)):null,daysInactiveMedian:median(affected.map(u=>(Date.now()-u.lastAt)/DAY)),provisional:affected.some(u=>u.historical.length>0)};});
 const errorCategories=[];
 for(const category of errors){const events=await ctx.db.query('growthEvents').withIndex('by_error_at',q=>q.eq('errorCategory',category).gte('at',args.from).lt('at',args.to)).filter(q=>q.or(q.eq(q.field('name'),'error_'+category),q.and(q.eq(q.field('name'),'operation_failed'),q.eq(q.field('userId'),undefined)))).take(5001);errorCategories.push({category,count:events.length>5000?null:events.length});}
 const now=Date.now(),state=await ctx.db.query('growthState').withIndex('by_key',q=>q.eq('key','backfill')).unique();
 return {countries:[...new Set(registered.map(u=>u.country||'unknown'))].sort(),partial:visitors.length>LIMIT||registered.length>LIMIT||allPaid.length>LIMIT,cohort:args.cohort,observedThrough:now,coverageStartedAt:coverage?.value??null,backfillComplete:state?.value===1,
 totals:{visitors:visitorRows.length,sessions:visitorRows.reduce((n,v)=>n+v.sessions,0),users:users.length,activated:counts[5],caylaUsers:users.filter(u=>has(u,'cayla_interaction_started')).length,caylaSuccessful:users.filter(u=>has(u,'cayla_tool_action_completed')).length,secondPayroll:counts[10],paying:livePaid.length,mrr:canViewRevenue?mrr:null,arr:canViewRevenue && mrr!==null?mrr*12:null,currency:currencies[0]||null,monthly:livePaid.filter(s=>s.plan==='accountant_monthly').length,yearly:livePaid.filter(s=>s.plan==='accountant_yearly').length,newPaid30:newlyPaid.length>LIMIT?null:newlyPaid.length,activationRate:ratio(counts[5],users.length),paidConversion:ratio(counts[9],users.length),repeatRate:ratio(counts[10],counts[5]),medianPayrollHours:median(users.filter(u=>has(u,'first_real_payroll_completed')).map(u=>(u.milestones.first_real_payroll_completed-u.joinedAt)/3600000).filter(x=>x>=0)),medianPaymentHours:median(users.filter(u=>u.paidAt).map(u=>(u.paidAt-u.joinedAt)/3600000).filter(x=>x>=0)),retentionRate,churnRate,revenueChurn:canViewRevenue?revenueChurn:null,cancellations,reactivations,cac:null,estimateTo100:null},
 funnel:funnel.map((row,i)=>uncertainOrder && i>0 ? {...row,count:null,conversion:null,dropoff:null}:row),seo:[...rows.values()].map(r=>({...r,signupRate:ratio(r.signups,r.visitors)})),sources:breakdown('source'),interests:breakdown('interest'),diagnostics,
 errorCategories,
 historical:(canViewRevenue?users.slice(0,100):[]).map(u=>({userId:u.userId,joinedAt:u.joinedAt,verification:u.verification,accountType:u.accountType||'unknown',historyPartial:u.historyPartial||false,interest:u.interest,source:u.first?.source||'Unknown — not previously tracked',milestones:u.milestones,historical:u.historical,lastAt:u.lastAt,paid:u.paid})),historicalMore:users.length>100,
 unavailable:['Search Console impressions, rankings and clicks: no verified integration in this report','CAC: no attributable spend ledger','Customer/revenue churn and cycle retention: historical billing and cycle baselines incomplete','Time to 100: insufficient paid acquisition history','SEO revenue: transaction/refund attribution is not yet available','Historical dashboard entry, reviews, paywall and failed authentication may be untracked'],};
}});
/** Paginated reconstruction: no payroll values, names, emails or conversations copied. */
export const backfill=internalMutation({args:{cursor:v.optional(v.string())},handler:async(ctx,args)=>{
 const page=await ctx.db.query('users').paginate({cursor:args.cursor??null,numItems:5});
 for(const user of page.page){
  const s=await ensureSummary(ctx,user._id), m={...s.milestones},historical=new Set(s.historical);
  const set=(name:string,at:number)=>{if(m[name]===undefined||at<m[name]){m[name]=at;historical.add(name);}};
  set('signup_completed',user.createdAt??user._creationTime);
  // Verification boolean is trustworthy; its historical timestamp is not recoverable.
  if(user.emailVerified && m.email_verification_completed===undefined)historical.add('email_verification_completed');
  if(user.onboardingCompleted && m.accountant_onboarding_completed===undefined)historical.add('accountant_onboarding_completed');
  const clients=await ctx.db.query('businesses').withIndex('by_user',q=>q.eq('userId',user._id)).take(501);
  let country:string|undefined;
  for(const client of clients.slice(0,500)){
   set('client_created',client._creationTime);country=country??client.countryCode;
   const employee=await ctx.db.query('employees').withIndex('by_business',q=>q.eq('businessId',client._id)).filter(q=>q.neq(q.field('isDemo'),true)).order('asc').first();
   if(employee)set('employee_added',employee.createdAt??employee._creationTime);
  }
  const activity=await ctx.db.query('accountantActivity').withIndex('by_workspace',q=>q.eq('workspaceOwnerId',user._id)).order('asc').take(500);
  const map:Record<string,string>={'payroll.review_started':'payroll_started','cayla.payroll_approved':'payroll_reviewed','cayla.payslips_generated':'payslip_generated','employees.imported':'employee_import_completed'};
  for(const a of activity){if(map[a.action])set(map[a.action],a.createdAt);}
  const cayla=await ctx.db.query('caylaEvents').withIndex('by_workspace',q=>q.eq('workspaceOwnerId',user._id)).order('asc').take(500);
  for(const e of cayla){if(e.name==='cayla_command_started')set('cayla_interaction_started',e.createdAt);if(['cayla_payroll_approved','cayla_payslips_generated','cayla_reminder_approved'].includes(e.name))set('cayla_tool_action_completed',e.createdAt);}
  await ctx.db.patch(s._id,{milestones:m,historical:[...historical],verification:user.emailVerified===true?'verified':user.emailVerified===false?'unverified':'unknown',...(country?{country}:{}),lastAt:Math.max(s.lastAt,...activity.map(a=>a.createdAt),...cayla.map(e=>e.createdAt))});
  const runs=await ctx.db.query('payrollRuns').withIndex('by_user',q=>q.eq('userId',user._id)).order('asc').take(100);
  await ctx.db.patch(s._id,{accountType:user.accountType||'unknown',historyPartial:clients.length>500||activity.length===500||cayla.length===500||runs.length===100});
  for(const run of runs){
   // Historical 'approved' client snapshots alone do not prove server calculation.
   const proof=await ctx.db.query('caylaPreparedClients').withIndex('by_run',q=>q.eq('runId',run._id)).first();
   if(proof?.status==='approved'){await recordApprovedPayroll(ctx,run._id);const updated=(await ctx.db.get(s._id))!;await ctx.db.patch(s._id,{historical:[...new Set([...updated.historical,'first_real_payroll_completed',...(updated.milestones.second_payroll_completed?['second_payroll_completed']:[])])]});}
  }
  // Billing verification requires a processed subscription event or verified subscription refresh.
  const billing=user.paddleSubscriptionId?await ctx.db.query('paddleEvents').withIndex('by_subscription',q=>q.eq('paddleSubscriptionId',user.paddleSubscriptionId)).order('desc').take(50):[];
  const verified=billing.find(e=>e.status==='processed'&&e.eventType.startsWith('subscription.'));
  if(verified)await summarizeBilling(ctx,user._id,verified.rawEvent,true);
  else if(user.billingSubscriptionUpdatedAt!==undefined)await summarizeBilling(ctx,user._id,undefined,true);
 }
 let state=await ctx.db.query('growthState').withIndex('by_key',q=>q.eq('key','backfill')).unique();
 const fields={key:'backfill',value:page.isDone?1:0,cursor:page.isDone?undefined:page.continueCursor};
 if(state)await ctx.db.replace(state._id,fields);else await ctx.db.insert('growthState',fields);
 if(page.isDone && !await ctx.db.query('growthState').withIndex('by_key',q=>q.eq('key','billingBaseline')).unique())await ctx.db.insert('growthState',{key:'billingBaseline',value:Date.now()});
 if(!page.isDone)await ctx.scheduler.runAfter(0,(internal as any).growthAnalytics.backfill,{cursor:page.continueCursor});
 return {processed:page.page.length,complete:page.isDone};
}});
export const initialize=internalMutation({args:{},handler:async(ctx)=>{
 let started=await ctx.db.query('growthState').withIndex('by_key',q=>q.eq('key','started')).unique();if(!started)await ctx.db.insert('growthState',{key:'started',value:Date.now()});
 const state=await ctx.db.query('growthState').withIndex('by_key',q=>q.eq('key','backfill')).unique();if(!state)await ctx.scheduler.runAfter(0,(internal as any).growthAnalytics.backfill,{});
 await ensureAnalyticsTicker(ctx);
}});
export const purge=internalMutation({args:{},handler:async(ctx)=>{
 const now=Date.now();
 for(const table of ['growthEvents','growthVisitors'] as const){const rows=await ctx.db.query(table).withIndex('by_expiry',q=>q.lt('expiresAt',now)).take(100);for(const row of rows){
  if(table==='growthVisitors'){const events=await ctx.db.query('growthEvents').withIndex('by_visitor',q=>q.eq('visitorId',row._id as any)).take(100);for(const e of events)await ctx.db.delete(e._id);if(events.length===100)continue;}
  await ctx.db.delete(row._id);
 }}
 const rates=await ctx.db.query('growthState').withIndex('by_expiry',q=>q.gt('expiresAt',0).lt('expiresAt',now)).take(500);
 for(const r of rates){const minute=Number(r.key.split(':').at(-1));if(minute<Math.floor(now/60000)-2)await ctx.db.delete(r._id);}
 const cleanup=await ctx.db.query('growthState').withIndex('by_key',q=>q.eq('key','cleanup')).unique();
 const summaries=await ctx.db.query('growthUsers').paginate({cursor:cleanup?.cursor??null,numItems:25});
 for(const s of summaries.page)if(!await ctx.db.get(s.userId)){
  const events=await ctx.db.query('growthEvents').withIndex('by_user',q=>q.eq('userId',s.userId)).take(100);
  const cycles=await ctx.db.query('growthPayrollCycles').withIndex('by_cycle',q=>q.eq('userId',s.userId)).take(100);
  const billing=await ctx.db.query('growthBillingSnapshots').withIndex('by_user',q=>q.eq('userId',s.userId)).take(100);
  const visitors=await ctx.db.query('growthVisitors').withIndex('by_user',q=>q.eq('userId',s.userId)).take(100);
  for(const row of [...events,...cycles,...billing])await ctx.db.delete(row._id);
  for(const visitor of visitors)await ctx.db.patch(visitor._id,{expiresAt:0});
  if(events.length<100&&cycles.length<100&&billing.length<100&&visitors.length<100)await ctx.db.delete(s._id);
 }
 const fields={key:'cleanup',value:Date.now(),cursor:summaries.isDone?undefined:summaries.continueCursor};
 if(cleanup)await ctx.db.replace(cleanup._id,fields);else await ctx.db.insert('growthState',fields);
}});
export async function summarizeBilling(ctx:any,userId:any,raw?:string,reconstructed=false){
 const user=await ctx.db.get(userId);if(!user)return;const s=await ensureSummary(ctx,userId);
 if(!raw && !s.billingVerified && user.billingSubscriptionUpdatedAt===undefined)return;
 const sandbox=process.env.PADDLE_SANDBOX==='true'||String(process.env.PADDLE_API_KEY||'').startsWith('pdl_sdbx_');
 const paid=!sandbox && !!user.paddleSubscriptionId && user.planStatus==='active' && String(user.plan||'').startsWith('accountant') && (!user.scheduledCancelAt||user.scheduledCancelAt>Date.now());
 let monthlyRevenue:number|undefined,currency:string|undefined, firstPaidAt:number|undefined;
 if(raw){try{const parsed=JSON.parse(raw), data=parsed.data; if(['subscription.created','subscription.activated'].includes(parsed.event_type) && Number.isFinite(Date.parse(parsed.occurred_at)))firstPaidAt=Date.parse(parsed.occurred_at); const items=data?.items;const amounts=(items||[]).map((item:any)=>{const price=item.price,cycle=price?.billing_cycle,amount=Number(price?.unit_price?.amount),qty=Number(item.quantity||1);if(!Number.isFinite(amount)||amount<0||!Number.isFinite(qty)||qty<1||!['month','year'].includes(cycle?.interval)||cycle.frequency!==1)return null;return {amount:amount/100*qty/(cycle.interval==='year'?12:1),currency:price.unit_price.currency_code};});if(amounts.length&&amounts.every((x:any)=>x)&&new Set(amounts.map((x:any)=>x.currency)).size===1){monthlyRevenue=amounts.reduce((n:number,x:any)=>n+x.amount,0);currency=amounts[0].currency;}}catch{}}
 await ctx.db.patch(s._id,{paid,billingVerified:!sandbox,plan:user.plan,subscriptionStatus:user.planStatus,...(monthlyRevenue!==undefined?{monthlyRevenue,currency}:{}),...(paid&&!s.paidAt && (!reconstructed||firstPaidAt!==undefined)?{paidAt:firstPaidAt??user.billingEventAt??Date.now()}: {})});
 const snapshotKey=`${userId}:${user.paddleSubscriptionId}:${user.billingSubscriptionUpdatedAt ?? user.billingEventAt ?? 'initial'}:${user.planStatus}`;
 const snapshot=await ctx.db.query('growthBillingSnapshots').withIndex('by_key',(q:any)=>q.eq('key',snapshotKey)).unique();
 const after={afterPaid:paid,status:user.planStatus||'unknown',...(monthlyRevenue!==undefined?{afterRevenue:monthlyRevenue,currency}: {})};
 if(snapshot)await ctx.db.patch(snapshot._id,after);else await ctx.db.insert('growthBillingSnapshots',{key:snapshotKey,userId,at:Date.now(),beforePaid:s.paid,beforeKnown:s.billingVerified,beforeRevenue:s.monthlyRevenue,currency:s.currency,...after});
 if(paid && !reconstructed)await recordGrowth(ctx,userId,'subscription_activated','once',s.paidAt??firstPaidAt??user.billingEventAt??Date.now());
 if(paid && reconstructed){const current=(await ctx.db.get(s._id))!;await ctx.db.patch(s._id,{historical:[...new Set([...current.historical,'subscription_activated'])]});}
}
export const actionEvent=internalMutation({args:{name:v.union(v.literal('ocr_started'),v.literal('ocr_completed'),v.literal('error_ocr_import')),requestKey:v.string()},handler:async(ctx,args)=>{
 const identity=await ctx.auth.getUserIdentity();if(!identity)return;
 const user=await ctx.db.query('users').withIndex('by_firebase_uid',q=>q.eq('firebaseUid',identity.subject)).unique();if(!user)return;
 await recordGrowth(ctx,user._id,args.name,args.requestKey);
}});
/** Observe authoritative account state without invoking signup, verification or any email flow. */
export const observeAccount=mutation({args:{},handler:async(ctx)=>{
 const identity=await ctx.auth.getUserIdentity();if(!identity)return;
 const user=await ctx.db.query('users').withIndex('by_firebase_uid',q=>q.eq('firebaseUid',identity.subject)).unique();if(!user)return;
 if(!await budget(ctx,'observe:'+String(user._id),30))return;
 await recordGrowth(ctx,user._id,'signup_completed','once',user.createdAt??user._creationTime);
 const summary=await ensureSummary(ctx,user._id);
 const verified=user.emailVerified===true||user.verifiedEmail===user.email;
 const newlyCreated=Date.now()-(user.createdAt??user._creationTime)<5*60000;
 const historical=new Set(summary.historical);
 if(verified && (newlyCreated||summary.verification==='unverified') && !historical.has('email_verification_completed'))await recordGrowth(ctx,user._id,'email_verification_completed','once');
 else if(verified && summary.milestones.email_verification_completed===undefined)historical.add('email_verification_completed');
 if(user.onboardingCompleted && (newlyCreated||summary.onboardingKnown===false) && !historical.has('accountant_onboarding_completed'))await recordGrowth(ctx,user._id,'accountant_onboarding_completed','once');
 else if(user.onboardingCompleted && summary.milestones.accountant_onboarding_completed===undefined)historical.add('accountant_onboarding_completed');
 await ctx.db.patch(summary._id,{historical:[...historical],onboardingKnown:user.onboardingCompleted===true,verification:verified?'verified':user.emailVerified===false?'unverified':'unknown'});
}});
/** Dedicated analytics-only maintenance loop; it never dispatches emails or invokes existing cron jobs. */
async function ensureAnalyticsTicker(ctx:any){
 const state=await ctx.db.query('growthState').withIndex('by_key',(q:any)=>q.eq('key','ticker')).unique();
 if(state && state.value>Date.now())return;
 const expectedAt=Date.now()+60000;
 if(state)await ctx.db.patch(state._id,{value:expectedAt});else await ctx.db.insert('growthState',{key:'ticker',value:expectedAt});
 await ctx.scheduler.runAfter(60000,(internal as any).growthAnalytics.tick,{expectedAt});
}
export const tick=internalMutation({args:{expectedAt:v.number()},handler:async(ctx,args)=>{
 const state=await ctx.db.query('growthState').withIndex('by_key',q=>q.eq('key','ticker')).unique();
 if(!state||state.value!==args.expectedAt)return;
 await ctx.scheduler.runAfter(0,(internal as any).growthAnalytics.purge,{});
 await ctx.db.patch(state._id,{value:0});
 await ensureAnalyticsTicker(ctx);
}});
export const startCollection=mutation({args:{requesterUid:v.string()},handler:async(ctx,args)=>{
 await authorize(ctx,args.requesterUid);
 await ctx.scheduler.runAfter(0,(internal as any).growthAnalytics.initialize,{});
}});
