/// <reference types="vite/client" />
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { convexTest } from 'convex-test';
import { anyApi } from 'convex/server';
import { createHash } from 'node:crypto';
import schema from '../convex/schema';
const modules = import.meta.glob('../convex/**/*.{ts,js}');
const api = anyApi;
const hash = (token: string) => createHash('sha256').update(token).digest('hex');
beforeEach(() => { vi.useFakeTimers(); vi.stubEnv('RESEND_API_KEY', 'test'); vi.stubEnv('CONVEX_SITE_URL', 'https://example.convex.site'); });
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
async function fixture() {
 const t = convexTest(schema, modules);
 const actor = t.withIdentity({subject:'new',email:'new@example.com',emailVerified:false});
 const userId = await actor.mutation(api.users.createOrUpdate, {firebaseUid:'new',email:'new@example.com',accountType:'accountant'});
 return {t,actor,userId};
}
describe('new accountant email verification', () => {
 it('requires verification on new signup, delays welcome/campaign, and blocks direct workspace API access', async () => {
  const {t,actor,userId}=await fixture();
  expect(await actor.query(api.users.getCurrentUser, {})).toMatchObject({emailVerificationRequired:true,accountantEmailAccess:false});
  const jobs=await t.run(ctx=>ctx.db.system.query('_scheduled_functions').collect());
  expect(jobs.map(j=>j.name)).toEqual(['accountantVerificationEmails:sendForUser']);
  expect(await t.run(ctx=>ctx.db.query('accountantEmailCampaigns').collect())).toHaveLength(0);
  await expect(actor.query(api.businesses.getAccessibleByUser,{userId})).rejects.toThrow('EMAIL_VERIFICATION_REQUIRED');
  await expect(actor.mutation(api.businesses.create,{userId,name:'Company',currency:'TTD',currencySymbol:'$'})).rejects.toThrow('EMAIL_VERIFICATION_REQUIRED');
  await expect(actor.action(api.caylaAgentActions.prepare,{commandId:'invalid'})).rejects.toThrow();
  await expect(t.action(api.accountantVerificationEmails.resend,{})).rejects.toThrow('Sign in');
 });
 it('sends the security template through Resend despite optional optout, exposes no bearer token, and validates POST only', async () => {
  const {t,actor,userId}=await fixture(), sent:any[]=[];
  await t.run(ctx=>ctx.db.insert('emailSubscriptions',{email:'new@example.com',token:'a'.repeat(64),tokenHash:hash('a'.repeat(64)),createdAt:Date.now(),unsubscribedAt:Date.now()}));
  vi.stubGlobal('fetch',vi.fn(async (_url,init:any)=>{sent.push(JSON.parse(init.body));return new Response(JSON.stringify({id:'email-1'}));}));
  const result=await actor.action(api.accountantVerificationEmails.resend,{});
  expect(result).toEqual({status:'sent',retryAfter:60});
  expect(sent).toHaveLength(1);expect(sent[0].to).toEqual(['new@example.com']);
  expect(sent[0].headers['X-Sheetpay-Template']).toBe('verification');
  const link=sent[0].html.match(/href="(https:\/\/example\.convex\.site\/accountant\/verify-email\?token=([a-f0-9]{64}))"/);
  expect(link).not.toBeNull();const token=link![2],route=new URL(link![1]).pathname+new URL(link![1]).search;
  const record=await t.run(ctx=>ctx.db.query('accountantEmailVerifications').first());
  expect(record!.tokenHash).toBe(hash(token));expect(JSON.stringify(record)).not.toContain(token);
  expect(JSON.stringify(await t.run(ctx=>ctx.db.query('emailLogs').collect()))).not.toContain(token);
  expect(await (await t.fetch(route)).text()).toContain('Verify your email address');
  expect((await actor.query(api.users.getCurrentUser,{}))!.accountantEmailAccess).toBe(false);
  for(let i=0;i<2;i++) {const res=await t.fetch(route,{method:'POST'});expect(res.status).toBe(303);expect(res.headers.get('Location')).toBe('https://sheetpay.app/accountant?emailVerified=1');}
  expect(await actor.query(api.users.getCurrentUser,{})).toMatchObject({accountantEmailAccess:true,verifiedEmail:'new@example.com'});
  expect(await actor.query(api.businesses.getAccessibleByUser,{userId})).toEqual([]);
  await actor.mutation(api.users.createOrUpdate,{firebaseUid:'new',email:'new@example.com',accountType:'accountant'});
  expect((await actor.query(api.users.getCurrentUser,{}))!.emailVerified).toBe(true);
  const jobs=await t.run(ctx=>ctx.db.system.query('_scheduled_functions').collect());
  expect(jobs.filter(j=>j.name==='emails:sendWelcomeInternal')).toHaveLength(1);
  expect(await t.run(ctx=>ctx.db.query('accountantEmailCampaigns').collect())).toHaveLength(1);
 });
 it('rejects invalid, expired, replaced and changed-address tokens', async () => {
  const {t,actor,userId}=await fixture();
  const first='b'.repeat(64),second='c'.repeat(64);
  await t.mutation(api.accountantVerification.issue,{userId,tokenHash:hash(first)});
  const record=await t.run(ctx=>ctx.db.query('accountantEmailVerifications').first());
  const post=(token:string)=>t.fetch('/accountant/verify-email?token='+token,{method:'POST'});
  for(const token of ['bad','0'.repeat(64)])expect(await (await post(token)).text()).toContain('unavailable');
  await t.run(ctx=>ctx.db.patch(record!._id,{expiresAt:Date.now()-1,createdAt:Date.now()-61_000}));
  expect(await (await post(first)).text()).toContain('unavailable');
  await t.mutation(api.accountantVerification.issue,{userId,tokenHash:hash(second)});
  expect(await (await post(first)).text()).toContain('unavailable');
  await t.run(ctx=>ctx.db.patch(userId,{email:'other@example.com'}));
  expect(await (await post(second)).text()).toContain('unavailable');
  expect((await actor.query(api.users.getCurrentUser,{}))!.accountantEmailAccess).toBe(false);
 });
 it('limits resends per authenticated account and refuses callers from another identity', async () => {
  const {t,actor,userId}=await fixture();
  await t.mutation(api.accountantVerification.issue,{userId,tokenHash:hash('d'.repeat(64))});
  expect(await actor.action(api.accountantVerificationEmails.resend,{})).toMatchObject({status:'rate_limited'});
  const record=await t.run(ctx=>ctx.db.query('accountantEmailVerifications').first());
  await t.run(ctx=>ctx.db.patch(record!._id,{createdAt:Date.now()-61_000,attempts:5}));
  expect(await actor.action(api.accountantVerificationEmails.resend,{})).toMatchObject({status:'rate_limited'});
  await expect(t.withIdentity({subject:'other',email:'new@example.com'}).action(api.accountantVerificationEmails.resend,{})).rejects.toThrow('Sign in');
 });
 it('preserves existing account access and accepts an email already verified by Firebase', async () => {
  const t=convexTest(schema,modules);
  const oldId=await t.run(ctx=>ctx.db.insert('users',{firebaseUid:'old',email:'old@example.com',accountType:'accountant'}));
  const old=t.withIdentity({subject:'old',email:'old@example.com',emailVerified:false});
  await old.mutation(api.users.createOrUpdate,{firebaseUid:'old',email:'old@example.com',accountType:'accountant'});
  expect((await old.query(api.users.getCurrentUser,{}))!.accountantEmailAccess).toBe(true);
  expect(await old.query(api.businesses.getAccessibleByUser,{userId:oldId})).toEqual([]);
  const verified=t.withIdentity({subject:'verified',email:'verified@example.com',emailVerified:true});
  const userId=await verified.mutation(api.users.createOrUpdate,{firebaseUid:'verified',email:'verified@example.com',accountType:'accountant'});
  expect((await verified.query(api.users.getCurrentUser,{}))!.accountantEmailAccess).toBe(true);
  expect(await verified.query(api.businesses.getAccessibleByUser,{userId})).toEqual([]);
 });
});
