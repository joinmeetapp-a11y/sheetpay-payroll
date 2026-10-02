/// <reference types="vite/client" />
import { describe,it,expect,vi,afterEach,beforeEach } from "vitest";
import { convexTest } from "convex-test";
import { anyApi } from "convex/server";
import schema from "../convex/schema";
import { CAMPAIGN_ID,FIRST_DELAY,DAY_DELAY,RETRY_BUDGET,renderCampaign,destination } from "../shared/accountantCampaign";
const modules=import.meta.glob("../convex/**/*.{ts,js}");
const api=anyApi;
beforeEach(()=>{vi.stubEnv("RESEND_API_KEY","test-key");vi.stubEnv("CONVEX_SITE_URL","https://example.convex.site");});
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();});
async function fixture(plan?: "accountant_monthly"|"accountant_yearly"){
 const t=convexTest(schema,modules);
 const user=await t.run(ctx=>ctx.db.insert("users",{firebaseUid:"campaign-user",email:"accountant@example.com",accountType:"accountant",createdAt:Date.now(),...(plan?{plan,planStatus:"active"}:{})}));
 const campaign=await t.mutation(api.accountantCampaign.enroll,{userId:user,token:"a".repeat(64),tokenHash:"test-hash"});
 return {t,user,campaign};
}
async function due(t:any,campaign:any){await t.run((ctx:any)=>ctx.db.patch(campaign,{nextSendAt:Date.now()-1}));}
async function state(t:any,user:any){return t.query(api.accountantCampaign.inspect,{userId:user});}
function provider(){const fetch=vi.fn(async()=>new Response(JSON.stringify({id:"resend-"+Math.random()}),{status:200}));vi.stubGlobal("fetch",fetch);return fetch;}
describe("Accountant seven-day marketing campaign",()=>{
 it("enrolls once with a delayed first send; existing callbacks do not restart",async()=>{
  const {t,user,campaign}=await fixture();const s=await state(t,user);
  expect(s.state.nextSendAt-s.state.enrolledAt).toBe(FIRST_DELAY);
  expect(await t.mutation(api.accountantCampaign.enroll,{userId:user,token:"b".repeat(64),tokenHash:"different"})).toBe(campaign);
  expect((await state(t,user)).events.filter((e:any)=>e.eventType==="enrolled")).toHaveLength(1);
  expect(JSON.stringify(s)).not.toContain("a".repeat(64));
 });
 it.each(["accountant_monthly","accountant_yearly"] as const)("does not enroll paid %s",async(plan)=>{expect((await fixture(plan)).campaign).toBeNull();});
 it("only new authenticated Accountant creation schedules enrollment",async()=>{
  const t=convexTest(schema,modules),actor=t.withIdentity({subject:"new-user",email:"new@example.com"});
  const args={firebaseUid:"new-user",email:"new@example.com",accountType:"accountant" as const};
  const id=await actor.mutation(api.users.createOrUpdate,args);
  expect((await state(t,id)).state.status).toBe("active");
  expect(await actor.mutation(api.users.createOrUpdate,args)).toBe(id);
  const jobs=await t.run(ctx=>ctx.db.system.query("_scheduled_functions").collect());
  expect(jobs.filter(j=>j.name.includes("accountantCampaignWorker:enrollNewUser"))).toHaveLength(1);
  await expect(t.mutation(api.users.createOrUpdate,args)).rejects.toThrow();
 });
 it("sends day 1 then day 2 once each; repeated or early jobs do not send",async()=>{
  const {t,user,campaign}=await fixture();const fetch=provider();
  await t.action(api.accountantCampaignWorker.sendDay,{campaign});expect(fetch).not.toHaveBeenCalled();
  await due(t,campaign);await t.action(api.accountantCampaignWorker.sendDay,{campaign});
  let s=await state(t,user);expect(s.state.currentDay).toBe(2);expect(s.state.nextSendAt-s.state.lastSentAt).toBe(DAY_DELAY);
  await t.action(api.accountantCampaignWorker.sendDay,{campaign});expect(fetch).toHaveBeenCalledTimes(1);
  await due(t,campaign);await Promise.all([t.action(api.accountantCampaignWorker.sendDay,{campaign}),t.action(api.accountantCampaignWorker.sendDay,{campaign})]);
  expect(fetch).toHaveBeenCalledTimes(2);s=await state(t,user);expect(s.events.filter((e:any)=>e.eventType==="email_sent")).toHaveLength(2);
 });
 it.each(["accountant_monthly","accountant_yearly"] as const)("stops %s in verified billing mutation after day 2",async(plan)=>{
  const {t,user,campaign}=await fixture();const fetch=provider();
  for(let i=0;i<2;i++){await due(t,campaign);await t.action(api.accountantCampaignWorker.sendDay,{campaign});}
  await t.mutation(api.subscriptions.applyPaddleEvent,{firebaseUid:"campaign-user",plan,planStatus:"active"});
  expect((await state(t,user)).state).toMatchObject({status:"converted",stopReason:"upgraded"});
  await due(t,campaign);await t.action(api.accountantCampaignWorker.sendDay,{campaign});
  await t.finishInProgressScheduledFunctions();
  const campaignCalls=fetch.mock.calls.filter((call:any)=>call[1]?.headers?.["Idempotency-Key"]?.includes(":day:"));
  expect(campaignCalls).toHaveLength(2);
 });
 it("rechecks upgrade and unsubscribe immediately before Resend",async()=>{
  const {t,campaign,user}=await fixture();const fetch=provider();await due(t,campaign);
  const send=await t.mutation(api.accountantCampaign.claim,{campaign,leaseId:"lease",from:"Sheetpay <notifications@sheetpay.app>",replyTo:"support@sheetpay.app",site:"https://example.convex.site"});
  await t.run(ctx=>ctx.db.patch(user,{plan:"accountant_monthly",planStatus:"active"}));
  expect(await t.mutation(api.accountantCampaign.shouldSendFreeUserCampaignEmail,{eventId:send.eventId,leaseId:"lease"})).toBe(false);
  expect(fetch).not.toHaveBeenCalled();expect((await state(t,user)).state.status).toBe("converted");
 });
 it("retries transient failures with identical body/key, never past provider window",async()=>{
  const {t,user,campaign}=await fixture();
  const fetch=vi.fn().mockRejectedValueOnce(Error("network")).mockResolvedValue(new Response(JSON.stringify({id:"accepted"}),{status:200}));vi.stubGlobal("fetch",fetch);
  await due(t,campaign);await t.action(api.accountantCampaignWorker.sendDay,{campaign});
  expect((await state(t,user)).events.some((e:any)=>e.eventType==="email_failed")).toBe(true);
  await due(t,campaign);await t.action(api.accountantCampaignWorker.sendDay,{campaign});
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(fetch.mock.calls[0][1].body).toBe(fetch.mock.calls[1][1].body);
  expect(fetch.mock.calls[0][1].headers["Idempotency-Key"]).toBe(fetch.mock.calls[1][1].headers["Idempotency-Key"]);
  expect((await state(t,user)).state.currentDay).toBe(2);
 });
 it("pauses ambiguous sends past 20 hours without a new request",async()=>{
  const {t,user,campaign}=await fixture();const fetch=vi.fn().mockRejectedValue(Error("network"));vi.stubGlobal("fetch",fetch);
  await due(t,campaign);await t.action(api.accountantCampaignWorker.sendDay,{campaign});
  await t.run(async ctx=>{const events=await ctx.db.query("accountantCampaignEvents").collect();const e=events.find(e=>e.day===1&&e.payload)!;await ctx.db.patch(e._id,{firstAttemptAt:Date.now()-RETRY_BUDGET-1});});
  await due(t,campaign);await t.action(api.accountantCampaignWorker.sendDay,{campaign});
  expect(fetch).toHaveBeenCalledTimes(1);expect((await state(t,user)).state.status).toBe("failed");
 });
 it("unsubscribe is idempotent and keeps transactional preferences separate",async()=>{
  const {t,user,campaign}=await fixture();const fetch=provider();
  expect(await t.mutation(api.accountantCampaign.unsubscribe,{tokenHash:"wrong"})).toBe(false);
  expect(await t.mutation(api.accountantCampaign.unsubscribe,{tokenHash:"test-hash"})).toBe(true);
  expect(await t.mutation(api.accountantCampaign.unsubscribe,{tokenHash:"test-hash"})).toBe(true);
  await due(t,campaign);await t.action(api.accountantCampaignWorker.sendDay,{campaign});expect(fetch).not.toHaveBeenCalled();
  expect(await t.run(ctx=>ctx.db.query("notificationPreferences").collect())).toHaveLength(0);
  expect((await state(t,user)).state.status).toBe("unsubscribed");
 });
 it("deleted user stops; changed recipient on retry cannot reuse a send incorrectly",async()=>{
  const {t,user,campaign}=await fixture();await t.run(ctx=>ctx.db.delete(user));const fetch=provider();
  await due(t,campaign);await t.action(api.accountantCampaignWorker.sendDay,{campaign});expect(fetch).not.toHaveBeenCalled();
  expect((await state(t,user)).state.stopReason).toBe("account_deleted");
  const f=await fixture();vi.stubGlobal("fetch",vi.fn().mockRejectedValue(Error("timeout")));
  await due(f.t,f.campaign);await f.t.action(api.accountantCampaignWorker.sendDay,{campaign:f.campaign});
  await f.t.run(ctx=>ctx.db.patch(f.user,{email:"changed@example.com"}));await due(f.t,f.campaign);
  await f.t.action(api.accountantCampaignWorker.sendDay,{campaign:f.campaign});
  expect((await state(f.t,f.user)).state.status).toBe("paused");
 });
 it("completes seven days using test-only clock advancement",async()=>{
  const {t,user,campaign}=await fixture();const fetch=provider();
  for(let day=1;day<=7;day++){await due(t,campaign);await t.action(api.accountantCampaignWorker.sendDay,{campaign});}
  expect(fetch).toHaveBeenCalledTimes(7);expect((await state(t,user)).state.status).toBe("completed");
  await due(t,campaign);await t.action(api.accountantCampaignWorker.sendDay,{campaign});expect(fetch).toHaveBeenCalledTimes(7);
 });
 it("renders safely without names and targets supported mobile-friendly routes",()=>{
  const target=destination(7,{client:true,employees:true,payroll:true});
  expect(target.url).toBe("https://sheetpay.app/accountant?upgrade=1");
  const email=renderCampaign(3,undefined,destination(3,{client:false,employees:false,payroll:false}),"https://example.convex.site/marketing/unsubscribe?token=abc");
  expect(email.text).toContain("Hi there,");expect(email.html).toContain('name="viewport"');expect(email.html).not.toMatch(/undefined|null/);
  expect(renderCampaign(1,"<script>",target,"https://example.com").html).not.toContain("<script>");
  expect(destination(2,{client:true,employees:false,payroll:false}).url).toContain("tab=Employees");
  expect(CAMPAIGN_ID).toBe("accountant_free_7_day_v1");
 });
 it("recovers a crash after provider acceptance using the original key and payload",async()=>{
  const {t,user,campaign}=await fixture();await due(t,campaign);
  const first=await t.mutation(api.accountantCampaign.claim,{campaign,leaseId:"crashed",from:"Sheetpay <notifications@sheetpay.app>",replyTo:"support@sheetpay.app",site:"https://example.convex.site"});
  // Model a provider-accepted send followed by an interrupted database acknowledgement.
  const accepted=new Map([[first.key,JSON.stringify(first.payload)]]);
  await t.run(async ctx=>{await ctx.db.patch(first.eventId,{leaseUntil:Date.now()-1});await ctx.db.patch(campaign!,{nextSendAt:Date.now()-1});});
  const fetch=vi.fn(async (_url:any,options:any)=>{
    expect(options.body).toBe(accepted.get(options.headers["Idempotency-Key"]));
    return new Response(JSON.stringify({id:"original-provider-id"}),{status:200});
  });vi.stubGlobal("fetch",fetch);
  await t.action(api.accountantCampaignWorker.sendDay,{campaign});
  expect((await state(t,user)).events.find((e:any)=>e.day===1&&e.eventType==="email_sent").resendMessageId).toBe("original-provider-id");
  await t.action(api.accountantCampaignWorker.sendDay,{campaign});expect(fetch).toHaveBeenCalledTimes(1);
 });
 it("repairs interrupted token setup and never enrolls existing users on login",async()=>{
  const t=convexTest(schema,modules);const id=await t.run(ctx=>ctx.db.insert("users",{firebaseUid:"old",email:"old@example.com",accountType:"accountant"}));
  await t.withIdentity({subject:"old",email:"old@example.com"}).mutation(api.users.createOrUpdate,{firebaseUid:"old",email:"old@example.com",accountType:"accountant"});
  expect(await state(t,id)).toBeNull();
 });
 it("rejects invalid email enrollment and honors suppression",async()=>{
  const {t,user,campaign}=await fixture();const fetch=provider();
  await t.run(ctx=>ctx.db.insert("emailSuppressions",{emailAddress:"accountant@example.com",reason:"bounce",createdAt:Date.now()}));
  await due(t,campaign);await t.action(api.accountantCampaignWorker.sendDay,{campaign});expect(fetch).not.toHaveBeenCalled();expect((await state(t,user)).state.status).toBe("paused");
  const bad=await t.run(ctx=>ctx.db.insert("users",{email:"not-an-email",accountType:"accountant"}));
  expect(await t.mutation(api.accountantCampaign.enroll,{userId:bad,token:"b".repeat(64),tokenHash:"bad"})).toBeNull();
 });
});
