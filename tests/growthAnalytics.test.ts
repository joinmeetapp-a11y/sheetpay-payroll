/// <reference types="vite/client" />
import { describe, it, expect, vi } from 'vitest';
import { convexTest } from 'convex-test';
import schema from '../convex/schema';
import { anyApi } from 'convex/server';
import { recordGrowth, recordApprovedPayroll } from '../convex/lib/growth';
import { summarizeBilling } from '../convex/growthAnalytics';
const modules=import.meta.glob('../convex/**/*.{ts,js}');
const touch={path:'/nis-calculator-trinidad',referrer:'www.google.com',source:'google_organic'};
const key='a'.repeat(64),session='b'.repeat(64);
async function setup(){const t=convexTest(schema,modules);const userId=await t.run(ctx=>ctx.db.insert('users',{firebaseUid:'alice',email:'alice@example.test',accountType:'accountant',createdAt:Date.now(),emailVerified:true}));return {t,userId,alice:t.withIdentity({subject:'alice',email:'alice@example.test',emailVerified:true})};}
describe('growth analytics security, privacy and counting',()=>{
 it('preserves first touch, separates last touch, strips secrets and counts sessions once',async()=>{
  const {t}=await setup();await t.mutation(anyApi.growthAnalytics.visit,{key,session,touch:{...touch,path:'/nis-calculator-trinidad?token=secret',utmCampaign:'payroll-fall',utmTerm:'employee@example.com'}});
  await t.mutation(anyApi.growthAnalytics.visit,{key,session,touch:{path:'/',referrer:'',source:'direct'}});
  await t.mutation(anyApi.growthAnalytics.visit,{key,session:'c'.repeat(64),touch:{path:'/payslip',referrer:'',source:'direct'}});
  const rows=await t.run(ctx=>ctx.db.query('growthVisitors').collect());expect(rows).toHaveLength(1);expect(rows[0].sessions).toBe(2);expect(rows[0].first.path).toBe('/nis-calculator-trinidad');expect(rows[0].last.path).toBe('/payslip');expect(rows[0].first.utmTerm).toBeUndefined();expect(JSON.stringify(rows)).not.toContain('secret');expect(rows[0].keyHash).not.toBe(key);
 });
 it('requires authentication for association, disallows another account claiming the same visitor',async()=>{
  const {t,alice,userId}=await setup();await t.mutation(anyApi.growthAnalytics.visit,{key,session,touch});await t.mutation(anyApi.growthAnalytics.associate,{key});expect((await t.run(ctx=>ctx.db.query('growthVisitors').first()))?.userId).toBeUndefined();
  await alice.mutation(anyApi.growthAnalytics.associate,{key});const bob=t.withIdentity({subject:'bob',email:'bob@example.test'});await t.run(ctx=>ctx.db.insert('users',{firebaseUid:'bob',email:'bob@example.test'}));await bob.mutation(anyApi.growthAnalytics.associate,{key});expect((await t.run(ctx=>ctx.db.query('growthVisitors').first()))?.userId).toBe(userId);
 });
 it('rejects client-forged authoritative completion and deduplicates allowed UI events',async()=>{
  const {t,alice}=await setup();await expect(alice.mutation(anyApi.growthAnalytics.uiEvent,{name:'first_real_payroll_completed',requestKey:'fake'})).rejects.toThrow();
  for(let i=0;i<2;i++)await alice.mutation(anyApi.growthAnalytics.uiEvent,{name:'paywall_viewed',requestKey:'once'});
  const s=await t.run(ctx=>ctx.db.query('growthUsers').first());expect(s?.counts.paywall_viewed).toBe(1);expect(s?.milestones.first_real_payroll_completed).toBeUndefined();
 });
 it('never grants regular users analytics access using a forged admin UID',async()=>{
  const {alice,t}=await setup();await t.run(ctx=>ctx.db.insert('users',{firebaseUid:'admin',email:'surebookme@gmail.com',emailVerified:true}));
  await expect(alice.query(anyApi.growthAnalytics.report,{requesterUid:'admin',from:Date.now()-86400000,to:Date.now()+1000,cohort:'signup'})).rejects.toThrow('Forbidden');
 });
 it('counts real approved client-periods once, excludes demos and preserves cycle dedupe after event cleanup',async()=>{
  const {t,userId}=await setup();
  const ids=await t.run(async ctx=>{const businessId=await ctx.db.insert('businesses',{userId,name:'Sensitive client',currency:'TTD',currencySymbol:'$',updatedAt:Date.now()});const e=await ctx.db.insert('employees',{businessId,userId,name:'Sensitive worker',employeeId:'E1',department:'',position:'Worker',payFrequency:'weekly',basicPay:1,frequencySalary:1,overtimeHours:0,overtimeRate:0,bonus:0,commission:0,allowances:0,paye:0,nis:0,healthSurcharge:0,otherDeductions:0,grossPay:1,netPay:1,status:'active',localId:'real',createdAt:Date.now()});const demo=await ctx.db.insert('employees',{businessId,userId,name:'Demo worker',employeeId:'D1',department:'',position:'Worker',payFrequency:'weekly',basicPay:1,frequencySalary:1,overtimeHours:0,overtimeRate:0,bonus:0,commission:0,allowances:0,paye:0,nis:0,healthSurcharge:0,otherDeductions:0,grossPay:1,netPay:1,status:'active',localId:'demo',isDemo:true,createdAt:Date.now()});return {businessId,e,demo};});
  const run=async(employee:any,periodLabel:string)=>t.run(ctx=>ctx.db.insert('payrollRuns',{userId,businessId:ids.businessId,month:'October',year:2026,status:'approved',periodLabel,employeesSnapshot:[{_id:employee,grossPay:12345,name:'Sensitive worker'}],totalGross:12345,totalPaye:1,totalNis:1,totalHealthSurcharge:1,totalDeductions:3,totalNet:12342,createdAt:Date.now(),updatedAt:Date.now()}));
  const demoRun=await run(ids.demo,'demo');await t.run(ctx=>recordApprovedPayroll(ctx,demoRun));expect(await t.run(ctx=>ctx.db.query('growthPayrollCycles').collect())).toHaveLength(0);
  const real=await run(ids.e,'1-7');await t.run(ctx=>recordApprovedPayroll(ctx,real));await t.run(ctx=>recordApprovedPayroll(ctx,real));
  await t.run(async ctx=>{for(const event of await ctx.db.query('growthEvents').collect())await ctx.db.delete(event._id);});
  const duplicate=await run(ids.e,'1-7');await t.run(ctx=>recordApprovedPayroll(ctx,duplicate));const second=await run(ids.e,'8-14');await t.run(ctx=>recordApprovedPayroll(ctx,second));
  const s=await t.run(ctx=>ctx.db.query('growthUsers').first());expect(s?.counts.real_payroll_completed).toBe(2);expect(s?.counts.first_real_payroll_completed).toBe(1); // milestone remains unique; event cleanup does not remove milestone.
  expect(s?.milestones.second_payroll_completed).toBeDefined();expect(JSON.stringify(s)).not.toContain('12345');expect(JSON.stringify(s)).not.toContain('Sensitive worker');expect(await t.run(ctx=>ctx.db.query('growthPayrollCycles').collect())).toHaveLength(2);
 });
 it('uses live verified subscription state, excludes sandbox and does not infer revenue from a checkout',async()=>{
  const {t,userId}=await setup();await t.run(ctx=>recordGrowth(ctx,userId,'checkout_started','txn'));expect((await t.run(ctx=>ctx.db.query('growthUsers').first()))?.paid).toBe(false);
  await t.run(async ctx=>{await ctx.db.patch(userId,{plan:'accountant_yearly',planStatus:'active',paddleSubscriptionId:'sub',billingPeriodStart:Date.now()});await summarizeBilling(ctx,userId,JSON.stringify({data:{items:[{quantity:1,price:{unit_price:{amount:'120000',currency_code:'USD'},billing_cycle:{interval:'year',frequency:1}}}]}}));});
  let s=await t.run(ctx=>ctx.db.query('growthUsers').first());expect(s?.paid).toBe(true);expect(s?.monthlyRevenue).toBe(100);
  vi.stubEnv('PADDLE_SANDBOX','true');await t.run(ctx=>summarizeBilling(ctx,userId));s=await t.run(ctx=>ctx.db.query('growthUsers').first());expect(s?.paid).toBe(false);vi.unstubAllEnvs();
 });
});
describe('verified production boundaries',()=>{
 it('does not give a historical user a new signup landing page or invent onboarding timestamps',async()=>{
  const {t,alice,userId}=await setup();await t.run(ctx=>ctx.db.patch(userId,{createdAt:Date.now()-86400000,onboardingCompleted:true}));
  await t.mutation(anyApi.growthAnalytics.visit,{key,session,touch});await alice.mutation(anyApi.growthAnalytics.associate,{key});
  expect((await t.run(ctx=>ctx.db.query('growthUsers').first()))?.first).toBeUndefined();
  await t.mutation(anyApi.growthAnalytics.backfill,{});
  const s=await t.run(ctx=>ctx.db.query('growthUsers').first());expect(s?.first).toBeUndefined();expect(s?.milestones.accountant_onboarding_completed).toBeUndefined();expect(s?.historical).toContain('accountant_onboarding_completed');
 });
 it('deduplicates Paddle webhooks and activation even when verified state is refreshed',async()=>{
  const {t,userId}=await setup();const args={eventId:'evt_1',eventType:'subscription.activated',paddleCustomerId:'ctm_1',paddleSubscriptionId:'sub_1',rawEvent:JSON.stringify({event_type:'subscription.activated',occurred_at:new Date().toISOString(),data:{items:[{quantity:1,price:{unit_price:{amount:'9700',currency_code:'USD'},billing_cycle:{interval:'month',frequency:1}}}]}})};
  const first=await t.mutation(anyApi.subscriptions.beginPaddleEvent,args);expect(first.alreadyProcessed).toBe(false);
  const timestamp=Date.now();await t.mutation(anyApi.subscriptions.applyPaddleEvent,{firebaseUid:'alice',paddleCustomerId:'ctm_1',paddleSubscriptionId:'sub_1',plan:'accountant_monthly',planStatus:'active',subscriptionUpdatedAt:timestamp,occurredAt:timestamp});
  await t.mutation(anyApi.subscriptions.finishPaddleEvent,{docId:first.docId,status:'processed'});
  const second=await t.mutation(anyApi.subscriptions.beginPaddleEvent,args);expect(second.alreadyProcessed).toBe(true);
  await t.mutation(anyApi.subscriptions.applyPaddleEvent,{firebaseUid:'alice',paddleCustomerId:'ctm_1',paddleSubscriptionId:'sub_1',plan:'accountant_monthly',planStatus:'active',subscriptionUpdatedAt:timestamp,occurredAt:timestamp});
  const s=await t.run(ctx=>ctx.db.query('growthUsers').first());expect(s?.counts.subscription_activated).toBe(1);expect(s?.monthlyRevenue).toBe(97);expect(await t.run(ctx=>ctx.db.query('growthBillingSnapshots').collect())).toHaveLength(1);
 });
});
describe('billing baselines and future churn',()=>{
 it('shows churn only with a dated baseline and uses verified lost recurring revenue',async()=>{
  vi.useFakeTimers();try{
   const base=Date.now();vi.setSystemTime(base-5*86400000);const {t,userId}=await setup();
   await t.run(async ctx=>{await ctx.db.patch(userId,{plan:'accountant_monthly',planStatus:'active',paddleSubscriptionId:'sub_churn',billingSubscriptionUpdatedAt:Date.now()});await summarizeBilling(ctx,userId,JSON.stringify({data:{items:[{quantity:1,price:{unit_price:{amount:'9700',currency_code:'USD'},billing_cycle:{interval:'month',frequency:1}}}]}}));await ctx.db.insert('growthState',{key:'billingBaseline',value:Date.now()});await ctx.db.insert('users',{firebaseUid:'admin',email:'surebookme@gmail.com',emailVerified:true});});
   vi.setSystemTime(base);await t.run(async ctx=>{await ctx.db.patch(userId,{planStatus:'canceled',billingSubscriptionUpdatedAt:Date.now()});await summarizeBilling(ctx,userId);});
   const admin=t.withIdentity({subject:'admin',email:'surebookme@gmail.com',emailVerified:true});const r=await admin.query(anyApi.growthAnalytics.report,{requesterUid:'admin',from:base-86400000,to:base+1000,cohort:'signup'});
   expect(r.totals.churnRate).toBe(1);expect(r.totals.retentionRate).toBe(0);expect(r.totals.revenueChurn).toBe(1);expect(r.totals.paying).toBe(0);
   const old=await admin.query(anyApi.growthAnalytics.report,{requesterUid:'admin',from:base-10*86400000,to:base+1000,cohort:'signup'});expect(old.totals.churnRate).toBeNull();
  }finally{vi.useRealTimers();}
 });
});

 it('observes only persisted own-account milestones without running authentication or email flows',async()=>{const {t,alice,userId}=await setup();await alice.mutation(anyApi.growthAnalytics.observeAccount,{});await alice.mutation(anyApi.growthAnalytics.observeAccount,{});const s=await t.run(ctx=>ctx.db.query('growthUsers').first());expect(s?.counts.signup_completed).toBe(1);expect(s?.counts.email_verification_completed).toBe(1);expect(s?.milestones.accountant_onboarding_completed).toBeUndefined();await t.run(ctx=>ctx.db.patch(userId,{onboardingCompleted:true}));await alice.mutation(anyApi.growthAnalytics.observeAccount,{});expect((await t.run(ctx=>ctx.db.query('growthUsers').first()))?.counts.accountant_onboarding_completed).toBe(1);});
