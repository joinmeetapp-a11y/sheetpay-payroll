/// <reference types="vite/client" />
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { convexTest } from 'convex-test';
import { anyApi } from 'convex/server';
import schema from '../convex/schema';
import { createHmac } from 'node:crypto';
import { ACCOUNTANT_PLANS, effectiveAccountantPlan } from '../shared/accountantPlans';
const modules = import.meta.glob('../convex/**/*.{ts,js}');
const api = anyApi;
const end = Date.now() + 86400000;
async function fixture(plan = 'accountant_monthly') {
  const t = convexTest(schema, modules);
  const id = await t.run(ctx => ctx.db.insert('users', { firebaseUid: 'owner', email: 'owner@example.com', accountType: 'accountant', plan: plan as any, planStatus: plan === 'free' ? 'none' : 'active', ...(plan === 'free' ? {} : { paddleCustomerId: 'ctm_own', paddleSubscriptionId: 'sub_own' }) }));
  await t.run(ctx => ctx.db.insert('users', { firebaseUid: 'other', email: 'other@example.com', accountType: 'accountant', plan: 'free' }));
  const owner = t.withIdentity({ subject: 'owner' });
  const subscription = (extra = {}) => ({ id: 'sub_own', customer_id: 'ctm_own', status: 'active', custom_data: { firebaseUid: 'owner' }, items: [{ price: { id: ACCOUNTANT_PLANS[plan === 'accountant_yearly' ? 'accountant_yearly' : 'accountant_monthly'].paddlePriceId } }], current_billing_period: { starts_at: new Date(end - 86400000).toISOString(), ends_at: new Date(end).toISOString() }, updated_at: new Date().toISOString(), scheduled_change: null, ...extra });
  return { t, owner, id, subscription };
}
beforeEach(() => { vi.useFakeTimers(); vi.stubEnv('PADDLE_API_KEY', 'test-server-secret'); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
describe('Existing account profile and Paddle lifecycle', () => {
  it('updates only the authenticated name and rejects user IDs as inputs', async () => {
    const { t, owner, id } = await fixture();
    await owner.mutation(api.profile.updateName, { displayName: 'Kurt Prince' });
    expect((await t.run(ctx => ctx.db.get(id)))?.displayName).toBe('Kurt Prince');
    await expect(owner.mutation(api.profile.updateName, { displayName: 'Wrong', userId: id })).rejects.toThrow();
    await expect(t.mutation(api.profile.updateName, { displayName: 'Wrong' })).rejects.toThrow();
  });
  it('persists image storage to its owner and returns its URL in new sessions', async () => {
    const { t, owner, id } = await fixture();
    const bytes = Uint8Array.from([137,80,78,71,13,10,26,10,0]).buffer;
    await owner.action(api.profile.uploadPhoto, { bytes });
    const stored = await t.run(ctx => ctx.db.get(id));
    expect(stored?.profilePhotoStorageId).toBeTruthy();
    const refreshed = await t.withIdentity({ subject: 'owner' }).query(api.users.getCurrentUser, {});
    expect(refreshed.profilePhotoUrl).toBeTruthy();
    expect((await t.withIdentity({ subject: 'other' }).query(api.users.getCurrentUser, {})).profilePhotoUrl).toBeNull();
    await expect(owner.action(api.profile.uploadPhoto, { bytes, storageId: stored?.profilePhotoStorageId })).rejects.toThrow();
  });
  it('rejects invalid and oversized photos and unauthenticated uploads', async () => {
    const { t, owner } = await fixture();
    await expect(owner.action(api.profile.uploadPhoto, { bytes: new ArrayBuffer(10) })).rejects.toThrow('Choose a JPG');
    await expect(owner.action(api.profile.uploadPhoto, { bytes: new ArrayBuffer(524289) })).rejects.toThrow('smaller');
    await expect(t.action(api.profile.uploadPhoto, { bytes: new ArrayBuffer(10) })).rejects.toThrow('sign in');
  });
  for (const plan of ['accountant_monthly', 'accountant_yearly']) it(`${plan} cancellation saves provider state and retains access until expiry`, async () => {
    const { t, owner, id, subscription } = await fixture(plan);
    const mock = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ data: subscription() }))).mockResolvedValueOnce(new Response(JSON.stringify({ data: subscription({ scheduled_change: { action: 'cancel', effective_at: new Date(end).toISOString() } }) })));
    vi.stubGlobal('fetch', mock);
    const result = await owner.action(api.paddle.cancelSubscription, {});
    expect(result).toMatchObject({ success: true, scheduledCancelAt: end, status: 'active' });
    expect(JSON.parse(mock.mock.calls[1][1].body)).toEqual({ effective_from: 'next_billing_period' });
    const user = await t.run(ctx => ctx.db.get(id));
    expect(effectiveAccountantPlan(user)).toBe(plan);
    vi.setSystemTime(end);
    expect(effectiveAccountantPlan(user)).toBe('free');
    await t.mutation(api.subscriptions.expireScheduledAccess, { userId: id, subscriptionId: 'sub_own', effectiveAt: end });
    expect((await owner.query(api.subscriptions.getEntitlement, { firebaseUid: 'owner' })).isAccountant).toBe(false);
  });
  it('does not call cancel twice for a provider scheduled or canceled subscription', async () => {
    for (const status of ['active', 'canceled']) {
      const { owner, subscription } = await fixture();
      const mock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: subscription({ status, scheduled_change: status === 'active' ? { action: 'cancel', effective_at: new Date(end).toISOString() } : null }) })));
      vi.stubGlobal('fetch', mock);
      expect((await owner.action(api.paddle.cancelSubscription, {})).alreadyScheduled).toBe(true);
      expect(mock).toHaveBeenCalledTimes(1);
    }
  });
  it('blocks free, unauthenticated and cross-account cancellation before mutation', async () => {
    const { t, owner } = await fixture('free');
    const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock);
    await expect(owner.action(api.paddle.cancelSubscription, {})).rejects.toThrow("couldn't update");
    await expect(t.action(api.paddle.cancelSubscription, {})).rejects.toThrow();
    await expect(t.withIdentity({ subject: 'other' }).action(api.paddle.cancelSubscription, {})).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('rejects provider ownership mismatch, arbitrary subscription inputs and raw API failures', async () => {
    const { t, owner, id, subscription } = await fixture();
    for (const extra of [{ customer_id: 'ctm_other' }, { custom_data: { firebaseUid: 'other' } }, { id: 'sub_other' }]) {
      const mock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: subscription(extra) }))); vi.stubGlobal('fetch', mock);
      await expect(owner.action(api.paddle.cancelSubscription, {})).rejects.toThrow("couldn't update"); expect(mock).toHaveBeenCalledTimes(1);
    }
    await expect(owner.action(api.paddle.cancelSubscription, { subscriptionId: 'sub_other' })).rejects.toThrow();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ data: subscription() }))).mockResolvedValueOnce(new Response('secret raw provider error', { status: 503 })));
    await expect(owner.action(api.paddle.cancelSubscription, {})).rejects.toThrow("couldn't update");
    const user = await t.run(ctx => ctx.db.get(id)); expect(user?.planStatus).toBe('active'); expect(user?.scheduledCancelAt).toBeUndefined();
  });
  it('signed-provider updates schedule, clear cancellation on resume and ignore older events', async () => {
    const { t, id } = await fixture();
    const base = { firebaseUid: 'owner', paddleCustomerId: 'ctm_own', paddleSubscriptionId: 'sub_own', plan: 'accountant_monthly', priceId: ACCOUNTANT_PLANS.accountant_monthly.paddlePriceId, planStatus: 'active' };
    await t.mutation(api.subscriptions.applyPaddleEvent, { ...base, occurredAt: 100, scheduledCancelAt: end });
    await t.mutation(api.subscriptions.applyPaddleEvent, { ...base, occurredAt: 200, scheduledCancelAt: null });
    await t.mutation(api.subscriptions.applyPaddleEvent, { ...base, occurredAt: 150, scheduledCancelAt: end });
    expect((await t.run(ctx => ctx.db.get(id)))?.scheduledCancelAt).toBeUndefined();
    vi.setSystemTime(end); await t.mutation(api.subscriptions.expireScheduledAccess, { userId: id, subscriptionId: 'sub_own', effectiveAt: end });
    expect((await t.run(ctx => ctx.db.get(id)))?.planStatus).toBe('active');
    for (const status of ['past_due','paused','active','canceled']) { await t.mutation(api.subscriptions.applyPaddleEvent, { ...base, planStatus: status, occurredAt: 300 + ['past_due','paused','active','canceled'].indexOf(status), scheduledCancelAt: null }); expect((await t.run(ctx => ctx.db.get(id)))?.planStatus).toBe(status); }
  });
  it('opens only the current customer portal with authenticated server-side calls', async () => {
    const { owner, subscription } = await fixture();
    const mock = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ data: subscription() }))).mockResolvedValueOnce(new Response(JSON.stringify({ data: { urls: { general: { overview: 'https://customer-portal.paddle.com/test' } } } })));
    vi.stubGlobal('fetch', mock); expect(await owner.action(api.paddle.getBillingPortal, {})).toEqual({ url: 'https://customer-portal.paddle.com/test' });
    expect(mock.mock.calls[1][0]).toContain('/customers/ctm_own/portal-sessions');
  });
  it('verifies actual signed lifecycle webhook requests and rejects forged requests', async () => {
    const { t, id, subscription } = await fixture();
    vi.stubEnv('PADDLE_WEBHOOK_SECRET', 'webhook-test-secret');
    const send = async (type: string, data: any, index: number, valid = true) => {
      const ts = Math.floor(Date.now() / 1000);
      const body = JSON.stringify({ event_id: `evt-${index}`, event_type: type, occurred_at: new Date(Date.now() + index).toISOString(), data });
      const signature = createHmac('sha256', 'webhook-test-secret').update(`${ts}:${body}`).digest('hex');
      return t.fetch('/paddle/webhook', { method: 'POST', body, headers: { 'Paddle-Signature': `ts=${ts};h1=${valid ? signature : 'invalid'}` } });
    };
    expect((await send('subscription.updated', subscription(), 0, false)).status).toBe(401);
    const events = [ ['subscription.created','active'], ['subscription.activated','active'], ['subscription.updated','active'], ['subscription.past_due','past_due'], ['subscription.paused','paused'], ['subscription.resumed','active'], ['subscription.canceled','canceled'] ];
    for (let i = 0; i < events.length; i++) {
      const [type, status] = events[i];
      const data = subscription({ status, scheduled_change: i === 2 ? { action: 'cancel', effective_at: new Date(end).toISOString() } : null });
      expect((await send(type, data, i + 1)).status).toBe(200);
      const user = await t.run(ctx => ctx.db.get(id));
      expect(user?.planStatus).toBe(status);
      expect(user?.scheduledCancelAt).toBe(i === 2 ? end : undefined);
    }
  });

});
