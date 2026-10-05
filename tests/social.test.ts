/// <reference types="vite/client" />
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";
import { anyApi } from "convex/server";
import { readFileSync } from "node:fs";
import { webcrypto } from "node:crypto";
import { internalAction } from "../convex/_generated/server";
import { v } from "convex/values";
import schema from "../convex/schema";
import { localClock, scheduledInstant, validateSchedule, lexicalDuplicate, cosine, validateCaption, validateImageText } from "../convex/lib/socialContent";
import { cardLayout, initializeRenderer, renderSocialCard } from "../convex/lib/socialCard";
import { encryptToken, decryptToken, imageUploadUrl, postPayload } from "../convex/lib/socialLinkedIn";

const modules=import.meta.glob("../convex/**/*.{ts,js}");
const caption="The workday ends, but payroll still needs me.\n\nI check the hours before I put the tools away.\n\nOne missing entry means another question to ask.\n\nRates and overtime need the same attention.\n\nThe crew depends on me getting those details right.\n\nI try to collect hours earlier so the evening is easier.\n\n#Payroll #Construction #SmallBusiness";
const imageText="The workday ends, but payroll still needs me.\n\nI check the hours before I put the tools away, then go through the rates and overtime.\n\nThe crew depends on me getting those details right. Collecting hours earlier makes the evening easier.";
const hook="The workday ends, but payroll still needs me.";
vi.stubGlobal("crypto",webcrypto);

describe("social content and timezones",()=>{
  it("uses 10 AM Port of Spain rather than UTC",()=>{
    const now=Date.parse("2026-10-05T13:00:00Z");
    expect(scheduledInstant(now,"America/Port_of_Spain","10:00")).toBe(Date.parse("2026-10-05T14:00:00Z"));
    expect(localClock(now,"America/Port_of_Spain")).toEqual({date:"2026-10-05",minute:540,day:1});
  });
  it("handles changed timezones, DST gaps and repeats safely",()=>{
    expect(scheduledInstant(Date.parse("2026-03-08T16:00Z"),"America/New_York","02:30")).toBeNull();
    expect(scheduledInstant(Date.parse("2026-11-01T16:00Z"),"America/New_York","01:30")).toBe(Date.parse("2026-11-01T05:30Z"));
    expect(scheduledInstant(Date.parse("2026-10-05T12:00Z"),"Asia/Kathmandu","10:00")).toBe(Date.parse("2026-10-05T04:15Z"));
  });
  it("rejects invalid schedule settings",()=>{
    expect(()=>validateSchedule("24:00","UTC",[1])).toThrow();
    expect(()=>validateSchedule("10:00","Made/Up",[1])).toThrow();
    expect(()=>validateSchedule("10:00","UTC",[])).toThrow();
    expect(()=>validateSchedule("10:00","UTC",[1,1])).toThrow();
  });
  it("detects repeated hooks, wording and semantic vectors",()=>{
    expect(lexicalDuplicate(caption,hook,[{caption,hook}])).toBe(true);
    expect(lexicalDuplicate(caption,hook,[{caption:"I now check employee deductions earlier.",hook:"Overtime needs its own check."}])).toBe(false);
    expect(cosine([1,2,3],[1,2,3])).toBeCloseTo(1);
    expect(cosine([1,0],[0,1])).toBe(0);
  });
  it("validates caption and shortened image independently",()=>{
    expect(()=>validateCaption(caption,hook)).not.toThrow();
    expect(()=>validateImageText(imageText,hook)).not.toThrow();
    expect(()=>validateCaption("One sentence. #Payroll",hook)).toThrow();
    expect(()=>validateImageText(imageText+" #Payroll",hook)).toThrow();
    expect(()=>validateImageText(imageText,"Wrong hook.")).toThrow();
  });
});
describe("deterministic card and credentials",()=>{
  it("fits long text and rejects an unbreakable overwide token",()=>{
    for(const text of [imageText,Array(90).fill("hours").join(" ").replace(/^(\S+\s+){30}/,m=>m+"\n\n")]){
      const layout=cardLayout(text);expect(layout.height).toBeLessThanOrEqual(840);
      expect(Math.max(...layout.widths)).toBeLessThanOrEqual(1056);
    }
    expect(()=>cardLayout(imageText+" "+ "x".repeat(160))).toThrow();
  });
  it("renders a 1200 square PNG with a fixed template",async()=>{
    await initializeRenderer(new Uint8Array(readFileSync(new URL("../convex/socialAssets/resvg.wasm",import.meta.url))));
    // PNG fixture; no external portrait or network needed for regression checks.
    const portrait=readFileSync(new URL("./fixtures/social-portrait.png",import.meta.url));
    const result=await renderSocialCard(imageText,portrait,"image/png");
    expect(Buffer.from(result.png).subarray(1,4).toString()).toBe("PNG");
    expect(Buffer.from(result.png).readUInt32BE(16)).toBe(1200);
    expect(Buffer.from(result.png).readUInt32BE(20)).toBe(1200);
    expect(result.portraitPixels).toBeGreaterThan(64);
    const mislabeled=readFileSync(new URL("./fixtures/social-portrait.jpg",import.meta.url));
    expect((await renderSocialCard(imageText,mislabeled,"image/png")).portraitPixels).toBeGreaterThan(64);
  });
  it("encrypts credentials with owner binding",()=>{
    vi.stubEnv("SOCIAL_TOKEN_ENCRYPTION_KEY",Buffer.alloc(32,7).toString("base64"));
    const value=encryptToken("secret-access-token","owner");
    expect(value).not.toContain("secret-access-token");
    expect(decryptToken(value,"owner")).toBe("secret-access-token");
    expect(()=>decryptToken(value,"different-owner")).toThrow();
  });
  it("restricts upload hosts and always requires image content",()=>{
    expect(()=>imageUploadUrl("https://evil.example/upload")).toThrow();
    expect(()=>imageUploadUrl("http://www.linkedin.com/upload")).toThrow();
    expect(imageUploadUrl("https://www.linkedin.com/dms-uploads/abc")).toContain("linkedin.com");
    expect(postPayload("urn:li:person:person","A thought.","urn:li:image:img").content.media.id).toBe("urn:li:image:img");
    expect(()=>postPayload("urn:li:person:person","A thought.","")).toThrow();
  });
});
async function setup(customModules=modules){
  const t=convexTest(schema,customModules);
  const ownerId=await t.run(ctx=>ctx.db.insert("users",{firebaseUid:"social-owner",email:"Surebookme@gmail.com",emailVerified:true}));
  const admin=t.withIdentity({subject:"social-owner",email:"surebookme@gmail.com",emailVerified:true});
  await admin.mutation(anyApi.social.initialize,{});
  const postId=await t.run(async ctx=>{
    const settings=await ctx.db.query("socialSettings").first(),topic=await ctx.db.query("socialTopics").first();
    const imageStorageId=await ctx.storage.store(new Blob([new Uint8Array([1,2,3])],{type:"image/png"}));
    await ctx.db.patch(settings!._id,{portraitId:imageStorageId});
    return ctx.db.insert("socialPosts",{ownerId,dayKey:"2026-10-05",createdAt:Date.now(),updatedAt:Date.now(),scheduledFor:Date.now(),
      topicId:topic!._id,topic:topic!.name,status:"awaiting_approval",caption,hook,imageText,imageStorageId,imagePortraitId:imageStorageId,imageRevision:1,revision:1,generationAttempts:1,approvalRequired:true});
  });
  return {t,admin,ownerId,postId};
}
describe("private workflow",()=>{
  beforeEach(()=>vi.stubEnv("SOCIAL_LIVE_PUBLISH_APPROVED","false"));
  afterEach(()=>{vi.unstubAllEnvs();vi.restoreAllMocks();});
  it("initializes safe defaults and 20 categories",async()=>{
    const {admin}=await setup(),d=await admin.query(anyApi.social.dashboard,{});
    expect(d.settings).toMatchObject({testMode:true,postingEnabled:false,mode:"approval",postingTime:"10:00",timezone:"America/Port_of_Spain"});
    expect(d.topics).toHaveLength(20);
  });
  it("denies anonymous and non-admin users every sensitive operation",async()=>{
    const {t,postId}=await setup(),outsider=t.withIdentity({subject:"outsider",email:"outsider@example.com",emailVerified:true});
    for(const client of [t,outsider]){
      await expect(client.query(anyApi.social.dashboard,{})).rejects.toThrow();
      await expect(client.query(anyApi.social.authorizedContext,{})).rejects.toThrow();
      await expect(client.mutation(anyApi.social.generateNew,{})).rejects.toThrow();
      await expect(client.mutation(anyApi.social.saveDraft,{id:postId,caption,imageText})).rejects.toThrow();
      await expect(client.mutation(anyApi.social.approve,{id:postId})).rejects.toThrow();
      await expect(client.mutation(anyApi.social.publishNow,{id:postId})).rejects.toThrow();
      await expect(client.mutation(anyApi.social.uploadPortrait,{})).rejects.toThrow();
      await expect(client.mutation(anyApi.social.disconnect,{})).rejects.toThrow();
      await expect(client.action(anyApi.socialWorker.beginOAuth,{})).rejects.toThrow();
    }
    await expect(t.withIdentity({subject:"social-owner",email:"surebookme@gmail.com",emailVerified:false}).query(anyApi.social.dashboard,{})).rejects.toThrow();
    await expect(t.withIdentity({subject:"social-owner",email:"different@example.com",emailVerified:true}).query(anyApi.social.dashboard,{})).rejects.toThrow();
  });
  it("blocks unapproved publication and revokes approval on edits",async()=>{
    const {admin,postId}=await setup();
    await expect(admin.mutation(anyApi.social.publishNow,{id:postId})).rejects.toThrow("Approve");
    await admin.mutation(anyApi.social.approve,{id:postId});
    await admin.mutation(anyApi.social.saveDraft,{id:postId,caption,imageText});
    const d=await admin.query(anyApi.social.dashboard,{});
    expect(d.posts[0].approvedAt).toBeUndefined();expect(d.posts[0].status).toBe("draft");
    await expect(admin.mutation(anyApi.social.approve,{id:postId})).rejects.toThrow("Render");
  });
  it("claims publishing only once and never retries an unknown result",async()=>{
    const {t,admin,postId}=await setup();
    await admin.mutation(anyApi.social.approve,{id:postId});
    expect(await t.mutation(anyApi.socialInternal.claimPublish,{id:postId,manual:true,operationId:"attempt-1"})).toEqual({testMode:true});
    expect(await t.mutation(anyApi.socialInternal.claimPublish,{id:postId,manual:true,operationId:"attempt-2"})).toBeNull();
    await t.mutation(anyApi.socialInternal.fail,{id:postId,operationId:"attempt-1",phase:"publishing",message:"Unknown",unknown:true});
    await expect(admin.mutation(anyApi.social.retry,{id:postId})).rejects.toThrow("Reconcile");
    await expect(admin.mutation(anyApi.social.reconcile,{id:postId,outcome:"not_published",confirmed:false})).rejects.toThrow("Confirm");
    await admin.mutation(anyApi.social.reconcile,{id:postId,outcome:"not_published",confirmed:true});
    const d=await admin.query(anyApi.social.dashboard,{});expect(d.posts[0].status).toBe("draft");
  });
  it("keeps credentials out of dashboard and blocks live mode until approval",async()=>{
    const {t,admin,ownerId}=await setup();
    await t.run(ctx=>ctx.db.insert("linkedinConnections",{ownerId,name:"Kurt Prince",memberUrn:"urn:li:person:123",
      encryptedAccessToken:"DO-NOT-EXPOSE",scopes:["w_member_social"],expiresAt:Date.now()+3600000,connectedAt:Date.now(),verifiedAt:Date.now(),status:"connected"}));
    const d=await admin.query(anyApi.social.dashboard,{});
    expect(JSON.stringify(d)).not.toContain("DO-NOT-EXPOSE");
    await expect(admin.mutation(anyApi.social.configure,{postingEnabled:true,testMode:false,mode:"automatic",postingTime:"10:00",timezone:"America/Port_of_Spain",postingDays:[1]})).rejects.toThrow("explicit approval");
  });
  it("validates OAuth state, user binding, expiry and replay",async()=>{
    const {t,ownerId}=await setup();
    await t.mutation(anyApi.socialInternal.newOAuthState,{actorId:ownerId,hash:"test-hash"});
    await expect(t.mutation(anyApi.socialInternal.consumeOAuthState,{actorId:ownerId,hash:"bad"})).rejects.toThrow();
    await t.mutation(anyApi.socialInternal.consumeOAuthState,{actorId:ownerId,hash:"test-hash"});
    await expect(t.mutation(anyApi.socialInternal.consumeOAuthState,{actorId:ownerId,hash:"test-hash"})).rejects.toThrow();
    await t.mutation(anyApi.socialInternal.newOAuthState,{actorId:ownerId,hash:"expired"});
    await t.run(async ctx=>{const row=await ctx.db.query("socialOAuthStates").withIndex("by_hash",q=>q.eq("hash","expired")).first();await ctx.db.patch(row!._id,{expiresAt:0});});
    await expect(t.mutation(anyApi.socialInternal.consumeOAuthState,{actorId:ownerId,hash:"expired"})).rejects.toThrow();
  });
  it("exchanges the authorized code server-side and stores only encrypted tokens",async()=>{
    const {admin}=await setup();
    vi.stubEnv("LINKEDIN_CLIENT_ID","client");vi.stubEnv("LINKEDIN_CLIENT_SECRET","mock-client-secret");
    vi.stubEnv("LINKEDIN_REDIRECT_URI","https://sheetpay.app/admin/social/settings");
    vi.stubEnv("SOCIAL_TOKEN_ENCRYPTION_KEY",Buffer.alloc(32,9).toString("base64"));
    const start=await admin.action(anyApi.socialWorker.beginOAuth,{});
    expect(new URL(start.url).searchParams.get("scope")).toBe("openid profile w_member_social");
    const fetch=vi.spyOn(globalThis,"fetch").mockImplementation(async input=>
      String(input).includes("accessToken")?Response.json({access_token:"private-token",expires_in:3600,scope:"openid%20profile%20w_member_social"}):
        Response.json({sub:"kurt123",name:"Kurt Prince"}));
    expect(await admin.action(anyApi.socialWorker.completeOAuth,{state:start.state,code:"authorized-code"})).toEqual({connected:true});
    const dashboard=await admin.query(anyApi.social.dashboard,{});
    expect(dashboard.connection).toMatchObject({name:"Kurt Prince",memberUrn:"urn:li:person:kurt123",status:"connected"});
    expect(JSON.stringify(dashboard)).not.toContain("private-token");
    await expect(admin.action(anyApi.socialWorker.completeOAuth,{state:start.state,code:"authorized-code"})).rejects.toThrow("state");
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it("invalidates approval when switching from test to live",async()=>{
    const {t,admin,postId,ownerId}=await setup();
    await admin.mutation(anyApi.social.approve,{id:postId});
    vi.stubEnv("SOCIAL_LIVE_PUBLISH_APPROVED","true");
    await t.run(ctx=>ctx.db.insert("linkedinConnections",{ownerId,name:"Kurt Prince",memberUrn:"urn:li:person:123",
      encryptedAccessToken:"encrypted",scopes:["w_member_social"],expiresAt:Date.now()+3600000,connectedAt:Date.now(),verifiedAt:Date.now(),status:"connected"}));
    await admin.mutation(anyApi.social.configure,{postingEnabled:false,testMode:false,mode:"approval",postingTime:"10:00",timezone:"America/Port_of_Spain",postingDays:[0,1,2,3,4,5,6]});
    expect((await admin.query(anyApi.social.dashboard,{})).posts[0].approvedAt).toBeUndefined();
  });
  it("test mode makes zero LinkedIn network requests",async()=>{
    const {t,admin,postId}=await setup();
    await admin.mutation(anyApi.social.approve,{id:postId});
    const fetch=vi.spyOn(globalThis,"fetch").mockRejectedValue(new Error("No network permitted"));
    await t.action(anyApi.socialWorker.publish,{id:postId,manual:true});
    expect(fetch).not.toHaveBeenCalled();
    const d=await admin.query(anyApi.social.dashboard,{});
    expect(d.posts[0].testCompletedAt).toBeGreaterThan(0);expect(d.posts[0].status).toBe("approved");
    expect(d.analytics.published).toBe(0);
  });
  it("expired token without refresh fails before uploading",async()=>{
    const {t,admin,postId,ownerId}=await setup();
    vi.stubEnv("SOCIAL_LIVE_PUBLISH_APPROVED","true");
    await t.run(async ctx=>{
      const settings=await ctx.db.query("socialSettings").first();await ctx.db.patch(settings!._id,{testMode:false});
      await ctx.db.insert("linkedinConnections",{ownerId,name:"Kurt",memberUrn:"urn:li:person:123",
        encryptedAccessToken:"unused",scopes:["w_member_social"],expiresAt:0,connectedAt:1,verifiedAt:1,status:"connected"});
    });
    await admin.mutation(anyApi.social.approve,{id:postId});
    const fetch=vi.spyOn(globalThis,"fetch").mockRejectedValue(new Error("No network"));
    await t.action(anyApi.socialWorker.publish,{id:postId,manual:true});
    expect(fetch).not.toHaveBeenCalled();
    expect((await admin.query(anyApi.social.dashboard,{})).posts[0]).toMatchObject({status:"failed",outcomeUnknown:false});
  });
});

async function liveSetup(){
  const result=await setup();vi.stubEnv("SOCIAL_LIVE_PUBLISH_APPROVED","true");
  vi.stubEnv("SOCIAL_TOKEN_ENCRYPTION_KEY",Buffer.alloc(32,3).toString("base64"));
  await result.t.run(async ctx=>{
    const s=await ctx.db.query("socialSettings").first();await ctx.db.patch(s!._id,{testMode:false});
    await ctx.db.insert("linkedinConnections",{ownerId:result.ownerId,name:"Kurt",memberUrn:"urn:li:person:123",
      encryptedAccessToken:encryptToken("test-token",result.ownerId),scopes:["w_member_social"],
      expiresAt:Date.now()+3600000,connectedAt:Date.now(),verifiedAt:Date.now(),status:"connected"});
  });
  await result.admin.mutation(anyApi.social.approve,{id:result.postId});return result;
}
describe("LinkedIn publishing with official API fixtures",()=>{
  afterEach(()=>{vi.unstubAllEnvs();vi.restoreAllMocks();});
  it("uploads the image then creates exactly one post",async()=>{
    const {t,admin,postId}=await liveSetup();
    const fetch=vi.spyOn(globalThis,"fetch").mockImplementation(async(input,init)=>{
      const url=String(input);
      if(url.includes("initializeUpload"))return Response.json({value:{image:"urn:li:image:asset123",uploadUrl:"https://www.linkedin.com/dms-uploads/test"}});
      if(url.includes("dms-uploads"))return new Response(null,{status:201});
      if(url.endsWith("/rest/posts")){
        expect(JSON.parse(String(init?.body)).content.media.id).toBe("urn:li:image:asset123");
        return new Response(null,{status:201,headers:{"x-restli-id":"urn:li:share:123456789"}});
      }
      throw new Error("Unexpected request");
    });
    await t.action(anyApi.socialWorker.publish,{id:postId,manual:true});
    await t.action(anyApi.socialWorker.publish,{id:postId,manual:true});
    expect(fetch).toHaveBeenCalledTimes(3);
    expect((await admin.query(anyApi.social.dashboard,{})).posts[0]).toMatchObject({status:"published",linkedinPostId:"urn:li:share:123456789"});
  });
  it("upload failure never creates a text-only post",async()=>{
    const {t,admin,postId}=await liveSetup();
    const fetch=vi.spyOn(globalThis,"fetch").mockImplementation(async input=>String(input).includes("initializeUpload")?
      Response.json({value:{image:"urn:li:image:asset",uploadUrl:"https://www.linkedin.com/dms-uploads/test"}}):new Response(null,{status:503}));
    await t.action(anyApi.socialWorker.publish,{id:postId,manual:true});
    expect(fetch).toHaveBeenCalledTimes(2);
    expect((await admin.query(anyApi.social.dashboard,{})).posts[0]).toMatchObject({status:"failed",outcomeUnknown:false});
  });
  it("ambiguous network failure blocks duplicate retries",async()=>{
    const {t,admin,postId}=await liveSetup();
    const fetch=vi.spyOn(globalThis,"fetch").mockImplementation(async input=>{
      if(String(input).includes("initializeUpload"))return Response.json({value:{image:"urn:li:image:asset",uploadUrl:"https://www.linkedin.com/dms-uploads/test"}});
      if(String(input).includes("dms-uploads"))return new Response(null,{status:201});
      throw new Error("Connection lost after sending the request");
    });
    await t.action(anyApi.socialWorker.publish,{id:postId,manual:true});
    expect((await admin.query(anyApi.social.dashboard,{})).posts[0]).toMatchObject({status:"failed",outcomeUnknown:true});
    await expect(admin.mutation(anyApi.social.retry,{id:postId})).rejects.toThrow("Reconcile");
    await t.action(anyApi.socialWorker.publish,{id:postId,manual:true});expect(fetch).toHaveBeenCalledTimes(3);
  });
  it("a definite 4xx rejection allows safe retry of the approved post",async()=>{
    const {t,admin,postId}=await liveSetup();
    const fetch=vi.spyOn(globalThis,"fetch").mockImplementation(async input=>{
      if(String(input).includes("initializeUpload"))return Response.json({value:{image:"urn:li:image:asset",uploadUrl:"https://www.linkedin.com/dms-uploads/test"}});
      if(String(input).includes("dms-uploads"))return new Response(null,{status:201});
      return new Response(null,{status:422});
    });
    await t.action(anyApi.socialWorker.publish,{id:postId,manual:true});
    const p=(await admin.query(anyApi.social.dashboard,{})).posts[0];expect(p.status).toBe("failed");expect(p.outcomeUnknown).toBe(false);expect(p.publishRequestStartedAt).toBeUndefined();
    await expect(admin.mutation(anyApi.social.retry,{id:postId})).resolves.toBeNull();
    expect(fetch).toHaveBeenCalledTimes(3);
  });
});
describe("generation safety and daily dispatch",()=>{
  afterEach(()=>{vi.unstubAllEnvs();vi.restoreAllMocks();vi.useRealTimers();});
  it("checks 30 previous posts, reviews grounding and creates both caption and PNG",async()=>{
    const custom={...modules,"../convex/socialRender.ts":async()=>({
      render:internalAction({args:{id:v.id("socialPosts"),operationId:v.string(),imageText:v.string()},
        handler:async ctx=>{
          await initializeRenderer(new Uint8Array(readFileSync(new URL("../convex/socialAssets/resvg.wasm",import.meta.url))));
          const portrait=readFileSync(new URL("./fixtures/social-portrait.png",import.meta.url));
          const rendered=await renderSocialCard(imageText,portrait,"image/png");
          const settings=await ctx.runQuery(anyApi.social.workerContext,{});
          return {storageId:await ctx.storage.store(new Blob([new Uint8Array(rendered.png)],{type:"image/png"})),portraitId:settings.settings.portraitId};
        }})
    })};
    const {t,admin,postId,ownerId}=await setup(custom);vi.stubEnv("OPENAI_API_KEY","mock-test-key");
    await t.run(async ctx=>{
      const base=await ctx.db.get(postId);
      await ctx.db.patch(postId,{status:"generating",operationId:"gen-1",revision:2});
      for(let i=0;i<31;i++)await ctx.db.insert("socialPosts",{ownerId,dayKey:"prior-"+i,createdAt:i,updatedAt:i,
        scheduledFor:i,status:"published",topicId:base!.topicId,topic:"Topic "+i,caption:"A different payroll observation "+i,
        hook:"A different opener "+i,lesson:"Lesson "+i,storyAngle:"Angle "+i,revision:1,generationAttempts:1,
        approvalRequired:true,embedding:[0,1]});
    });
    let checked30=false,reviewedGrounding=false;
    const fetch=vi.spyOn(globalThis,"fetch").mockImplementation(async(input,init)=>{
      if(String(input).endsWith("/embeddings"))return Response.json({data:[{embedding:[1,0]}]});
      const request=JSON.parse(String(init?.body)),system=request.messages[0].content;
      const inputData=JSON.parse(request.messages[1].content);
      let result;
      if(system.startsWith("You write")){checked30=inputData.recentPosts.length===30;result={caption,hook,lesson:"Collect hours earlier",storyAngle:"Admin after a workday",phrases:["the workday ends"]};}
      else if(system.startsWith("Review")){reviewedGrounding=true;result={duplicate:false,unsupportedFacts:false};}
      else result={imageText};
      return Response.json({choices:[{message:{content:JSON.stringify(result)}}]});
    });
    await t.action(anyApi.socialWorker.generate,{id:postId,operationId:"gen-1",kind:"caption"});
    const p=(await admin.query(anyApi.social.dashboard,{})).posts.find((p:any)=>p._id===postId);
    expect(checked30).toBe(true);expect(reviewedGrounding).toBe(true);
    expect(p).toMatchObject({status:"awaiting_approval",caption,imageText,imageRevision:2});
    expect(p.imageStorageId).toBeDefined();expect(fetch).toHaveBeenCalledTimes(4);
  });
  it("OpenAI failure stops generation and never calls LinkedIn",async()=>{
    const {t,admin,postId}=await setup();vi.stubEnv("OPENAI_API_KEY","mock-test-key");
    await t.run(ctx=>ctx.db.patch(postId,{status:"generating",operationId:"gen-fail"}));
    const fetch=vi.spyOn(globalThis,"fetch").mockResolvedValue(new Response(null,{status:503}));
    await t.action(anyApi.socialWorker.generate,{id:postId,operationId:"gen-fail",kind:"caption"});
    expect((await admin.query(anyApi.social.dashboard,{})).posts[0]).toMatchObject({status:"failed",errorPhase:"generation"});
    expect(fetch).toHaveBeenCalledTimes(3);expect(fetch.mock.calls.every(([url])=>String(url).includes("openai.com"))).toBe(true);
  });
  it("image-render failure prevents publication",async()=>{
    const custom={...modules,"../convex/socialRender.ts":async()=>({
      render:internalAction({args:{id:v.id("socialPosts"),operationId:v.string(),imageText:v.string()},handler:async()=>{throw new Error("Image rendering failed");}})
    })};
    const {t,admin,postId}=await setup(custom);vi.stubEnv("OPENAI_API_KEY","mock-test-key");
    await t.run(ctx=>ctx.db.patch(postId,{status:"generating",operationId:"image-fail"}));
    vi.spyOn(globalThis,"fetch").mockResolvedValue(Response.json({data:[{embedding:[1,0]}]}));
    await t.action(anyApi.socialWorker.generate,{id:postId,operationId:"image-fail",kind:"image"});
    expect((await admin.query(anyApi.social.dashboard,{})).posts[0]).toMatchObject({status:"failed",errorPhase:"generation"});
  });
  it("does not publish unapproved posts when the publishing time arrives",async()=>{
    vi.useFakeTimers();vi.setSystemTime(new Date("2026-10-05T14:00:00Z"));
    const {t,postId}=await setup();
    await t.run(async ctx=>{const s=await ctx.db.query("socialSettings").first();await ctx.db.patch(s!._id,{postingEnabled:true});});
    await t.mutation(anyApi.social.tick,{});
    const tasks=await t.run(ctx=>ctx.db.system.query("_scheduled_functions").collect());
    expect(tasks).toHaveLength(0);
    expect((await t.run(ctx=>ctx.db.get(postId)))?.status).toBe("awaiting_approval");
  });
  it("automatic mode dispatches once due and test mode still prevents LinkedIn requests",async()=>{
    vi.useFakeTimers();vi.setSystemTime(new Date("2026-10-05T14:00:00Z"));
    const {t,admin,postId}=await setup();
    await t.run(async ctx=>{
      const s=await ctx.db.query("socialSettings").first();await ctx.db.patch(s!._id,{postingEnabled:true,mode:"automatic"});
      await ctx.db.patch(postId,{status:"scheduled",approvalRequired:false});
    });
    await t.mutation(anyApi.social.tick,{});
    const tasks=await t.run(ctx=>ctx.db.system.query("_scheduled_functions").collect());
    expect(tasks).toHaveLength(1);
    const fetch=vi.spyOn(globalThis,"fetch").mockRejectedValue(new Error("No network"));
    await t.action(anyApi.socialWorker.publish,{id:postId});
    expect(fetch).not.toHaveBeenCalled();
    await t.mutation(anyApi.social.tick,{});
    expect((await t.run(ctx=>ctx.db.system.query("_scheduled_functions").collect()))).toHaveLength(1);
    expect((await admin.query(anyApi.social.dashboard,{})).posts[0].testCompletedAt).toBeGreaterThan(0);
  });
  it("disabled schedule stops queued automatic publishing",async()=>{
    const {t,admin,postId}=await setup();await admin.mutation(anyApi.social.approve,{id:postId});
    expect(await t.mutation(anyApi.socialInternal.claimPublish,{id:postId,operationId:"queued"})).toBeNull();
  });
  it("generates before midnight for the next enabled posting day",async()=>{
    vi.useFakeTimers();vi.setSystemTime(new Date("2026-10-06T03:40:00Z"));
    const {t,admin,postId}=await setup();
    await t.run(async ctx=>{
      const settings=await ctx.db.query("socialSettings").first();
      await ctx.db.patch(settings!._id,{postingEnabled:true,postingTime:"00:10",postingDays:[2]});
      await ctx.db.delete(postId);
    });
    await t.mutation(anyApi.social.tick,{});
    const posts=await t.run(ctx=>ctx.db.query("socialPosts").collect());
    expect(posts).toHaveLength(1);expect(posts[0].dayKey).toBe("2026-10-06");
    expect(posts[0].scheduledFor).toBe(Date.parse("2026-10-06T04:10:00Z"));
  });
});
