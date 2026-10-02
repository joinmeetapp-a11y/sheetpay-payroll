/// <reference types="vite/client" />
import {describe,it,expect,vi,beforeEach,afterEach} from "vitest";
import {convexTest} from "convex-test";
import {anyApi} from "convex/server";
import schema from "../convex/schema";
import {getGoogleAccessToken} from "../convex/lib/googleAuth";
vi.mock("../convex/lib/googleAuth",()=>({getGoogleAccessToken:vi.fn()}));
const modules=import.meta.glob("../convex/**/*.{ts,js}"),api=anyApi;
beforeEach(()=>{vi.stubEnv("FIREBASE_PROJECT_ID","myglowtext");vi.mocked(getGoogleAccessToken).mockReset();vi.mocked(getGoogleAccessToken).mockResolvedValue(null);});
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();});
async function fixture(){
 const t=convexTest(schema,modules);
 const user=await t.run(ctx=>ctx.db.insert("users",{firebaseUid:"push-owner",email:"push@example.com"}));
 const other=await t.run(ctx=>ctx.db.insert("users",{firebaseUid:"push-other",email:"other@example.com"}));
 const actor=t.withIdentity({subject:"push-owner"});
 await actor.mutation(api.notifications.updatePreferences,{channels:{inApp:true,push:true,email:false},categories:{payrollReminders:true,payslipReminders:true,failedPayslipAlerts:true,ocrReviewAlerts:true,teamActivity:true,billingAlerts:true,yearlyTaxReminders:true},timezone:"UTC"});
 await actor.mutation(api.reminders.registerDeviceToken,{requesterUid:"push-owner",token:"test-owner-token"});
 await t.withIdentity({subject:"push-other"}).mutation(api.reminders.registerDeviceToken,{requesterUid:"push-other",token:"test-other-token"});
 const event=await t.mutation(api.notifications.createUserEvent,{userId:user,category:"payroll",type:"push_test",title:"Test",message:"Test",dedupeKey:"push-test",channels:["push"]});
 return {t,user,other,actor,id:event.id};
}
describe("Firebase push delivery authorization and authentication",()=>{
 it("records safe authentication failure without submitting a null bearer token",async()=>{const{t,id}=await fixture();const fetch=vi.fn();vi.stubGlobal("fetch",fetch);await t.action(api.fcm.deliverNotification,{notificationId:id});expect(fetch).not.toHaveBeenCalled();expect(await t.query(api.notifications.listDeliveriesForNotification,{notificationId:id})).toEqual(expect.arrayContaining([expect.objectContaining({status:"failed",errorCode:"FCM_AUTH_FAILED"})]));});
 it("records provider rejection and never sends another account's token",async()=>{const{t,id}=await fixture();vi.mocked(getGoogleAccessToken).mockResolvedValue("test-access-token");const fetch=vi.fn(async()=>new Response(JSON.stringify({error:{status:"UNAUTHENTICATED"}}),{status:401}));vi.stubGlobal("fetch",fetch);await t.action(api.fcm.deliverNotification,{notificationId:id});expect(fetch).toHaveBeenCalledTimes(1);const payload=JSON.parse((fetch.mock.calls[0] as any)[1].body);expect(payload.message.token).toBe("test-owner-token");expect(JSON.stringify(payload)).not.toContain("test-other-token");expect(await t.query(api.notifications.listDeliveriesForNotification,{notificationId:id})).toEqual(expect.arrayContaining([expect.objectContaining({status:"failed",errorCode:"UNAUTHENTICATED"})]));});
 it("preserves ownership when unregistering a device",async()=>{const{t,user,actor}=await fixture();await actor.mutation(api.reminders.unregisterDeviceToken,{requesterUid:"push-owner",token:"test-other-token"});expect(await t.query(api.reminders.getUserDeviceTokens,{userId:user})).toHaveLength(1);await expect(actor.mutation(api.reminders.unregisterDeviceToken,{requesterUid:"push-other",token:"test-other-token"})).rejects.toThrow();});
});
