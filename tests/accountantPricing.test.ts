/// <reference types="vite/client" />
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { convexTest } from 'convex-test';
import { anyApi } from 'convex/server';
import { PDFDocument } from 'pdf-lib';
import schema from '../convex/schema';
import { ACCOUNTANT_PLANS, usagePeriod, effectiveAccountantPlan } from '../shared/accountantPlans';
const modules = import.meta.glob('../convex/**/*.{ts,js}');
const api = anyApi;
async function fixture(plan: 'free' | 'accountant_monthly' | 'accountant_yearly' = 'free') {
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const user = await ctx.db.insert('users', { firebaseUid: 'pricing-owner', email: 'owner@example.com', accountType: 'accountant', plan, planStatus: plan === 'free' ? 'none' : 'active' });
    const other = await ctx.db.insert('users', { firebaseUid: 'pricing-other', email: 'other@example.com', accountType: 'accountant', plan: 'free' });
    const business = await ctx.db.insert('businesses', { userId: user, name: 'Pricing Test', currency: 'USD', currencySymbol: '$', updatedAt: Date.now() });
    const employees = [];
    for (let i = 0; i < 10; i++) employees.push(await ctx.db.insert('employees', { userId: user, businessId: business, name: `Employee ${i}`, email: `employee${i}@example.com`, employeeId: `E-${i}`, position: 'Worker', department: 'General', payFrequency: 'monthly', basicPay: 100, frequencySalary: 100, overtimeHours: 0, overtimeRate: 0, bonus: 0, commission: 0, allowances: 0, paye: 0, nis: 0, healthSurcharge: 0, otherDeductions: 0, grossPay: 100, netPay: 100, status: 'active', localId: `${i}`, createdAt: Date.now() }));
    const rows = await Promise.all(employees.map(id => ctx.db.get(id)));
    return { user, other, business, employees, rows };
  });
  const owner = t.withIdentity({ subject: 'pricing-owner', email: 'owner@example.com' });
  const payroll = { businessId: ids.business, userId: ids.user, month: 'October', year: 2026, status: 'review', employeesSnapshot: ids.rows, totalGross: 1000, totalPaye: 0, totalNis: 0, totalHealthSurcharge: 0, totalDeductions: 0, totalNet: 1000 };
  const reserve = (kind: string, amount: number, opId: string = crypto.randomUUID()) => t.mutation(api.usage.internalReserveByUid, { firebaseUid: 'pricing-owner', kind, amount, opId });
  return { t, ids, owner, payroll, reserve };
}
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-01T00:00:00Z')); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
describe('Accountant pricing and authoritative limits', () => {
  it('uses exact prices, savings and equal monthly paid allowances', () => {
    expect(ACCOUNTANT_PLANS.accountant_yearly.price).toBe(1970);
    expect(ACCOUNTANT_PLANS.accountant_monthly.price).toBe(197);
    expect(ACCOUNTANT_PLANS.accountant_yearly.savings).toBe(394);
    expect(ACCOUNTANT_PLANS.accountant_yearly.limits).toEqual(ACCOUNTANT_PLANS.accountant_monthly.limits);
    expect(effectiveAccountantPlan({ plan: 'accountant', planStatus: 'active' })).toBe('accountant_monthly');
    expect(usagePeriod(Date.parse('2026-09-30T23:59:59Z'))).toBe('2026-09');
  });
  it('Free creates a real ten-employee payroll and preserves it on the next limit', async () => {
    const { t, owner, ids, payroll } = await fixture();
    const run = await owner.mutation(api.payrollRuns.create, payroll);
    const usage = await owner.query(api.usage.getMonthlyUsage, { requesterUid: 'pricing-owner' });
    expect(usage).toMatchObject({ plan: 'free', payrollRunsUsed: 1, payslipsUsed: 10, employeeCount: 10, clientCount: 1, teamMemberCount: 1 });
    await expect(owner.mutation(api.payrollRuns.create, payroll)).rejects.toThrow('PLAN_LIMIT_REACHED');
    expect(await t.run(ctx => ctx.db.get(run))).toBeTruthy();
    await expect(owner.mutation(api.businesses.create, { userId: ids.user, name: 'Second Client', currency: 'USD', currencySymbol: '$' })).rejects.toThrow('PLAN_LIMIT_REACHED');
    await expect(owner.mutation(api.employees.bulkCreate, { userId: ids.user, businessId: ids.business, employees: [{ ...ids.rows[0], _id: undefined, _creationTime: undefined }] })).rejects.toThrow();
  });
  for (const plan of ['accountant_monthly', 'accountant_yearly'] as const) it(`${plan} resets operations monthly, independent of yearly billing`, async () => {
    const { owner, reserve } = await fixture(plan);
    await reserve('cayla', 1000, 'first-month');
    await expect(reserve('cayla', 1)).rejects.toThrow('PLAN_LIMIT_REACHED');
    await reserve('ocr', 1000); await reserve('email', 5000);
    expect((await owner.query(api.usage.getMonthlyUsage, {})).limits).toEqual(ACCOUNTANT_PLANS[plan].limits);
    vi.setSystemTime(new Date('2026-11-01T00:00:00Z'));
    expect(await owner.query(api.usage.getMonthlyUsage, {})).toMatchObject({ caylaActionsUsed: 0, ocrScansUsed: 0, emailsReserved: 0, period: '2026-11' });
    await reserve('cayla', 1000, 'second-month');
  });
  it('idempotent reservations never consume allowance twice and failed batches roll back', async () => {
    const { owner, reserve } = await fixture();
    await reserve('ocr', 8, 'same'); await reserve('ocr', 8, 'same');
    await expect(reserve('ocr', 3)).rejects.toThrow('PLAN_LIMIT_REACHED');
    expect((await owner.query(api.usage.getMonthlyUsage, {})).ocrScansUsed).toBe(8);
  });
  it('rejects an entire email batch before attachments or Resend, without partial reservations', async () => {
    const { owner, ids, payroll, reserve } = await fixture();
    const run = await owner.mutation(api.payrollRuns.create, payroll);
    await reserve('email', 9);
    await expect(owner.mutation(api.bulkPayslipEmail.reserveEmailBatch, { businessId: ids.business, payrollRunId: run, employeeIds: ids.employees.slice(0, 2) })).rejects.toThrow('PLAN_LIMIT_REACHED');
    expect((await owner.query(api.usage.getMonthlyUsage, {})).emailsReserved).toBe(9);
    await owner.mutation(api.bulkPayslipEmail.reserveEmailBatch, { businessId: ids.business, payrollRunId: run, employeeIds: [ids.employees[0]] });
    await owner.mutation(api.bulkPayslipEmail.reserveEmailBatch, { businessId: ids.business, payrollRunId: run, employeeIds: [ids.employees[0]] });
    expect((await owner.query(api.usage.getMonthlyUsage, {})).emailsReserved).toBe(10);
  });
  it('denies cross-workspace usage, exports and employee snapshots', async () => {
    const { t, ids, owner, payroll } = await fixture();
    const run = await owner.mutation(api.payrollRuns.create, payroll);
    const outsider = t.withIdentity({ subject: 'pricing-other' });
    await expect(outsider.query(api.usage.getMonthlyUsage, { businessId: ids.business })).rejects.toThrow('Forbidden');
    await expect(outsider.mutation(api.bulkPayslipEmail.authorizeExport, { businessId: ids.business, payrollRunId: run, employeeIds: [ids.employees[0]] })).rejects.toThrow('Forbidden');
    expect(await t.query(api.usage.getMonthlyUsage, { requesterUid: 'pricing-owner' })).toBeNull();
  });
  it('counts actual PDF pages and stops over-limit OCR before OpenAI', async () => {
    const { t, reserve } = await fixture();
    vi.stubEnv('OPENAI_API_KEY', 'test-only');
    await reserve('ocr', 9);
    const document = await PDFDocument.create(); document.addPage(); document.addPage();
    const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock);
    const result = await t.withIdentity({ subject: 'pricing-owner' }).action(api.ai.extractPayrollDocument, { requesterUid: 'pricing-owner', fileBase64: Buffer.from(await document.save()).toString('base64'), mimeType: 'application/pdf', fileName: 'two-pages.pdf' });
    expect(result.ok).toBe(false); expect(result.error).toContain('PLAN_LIMIT_REACHED'); expect(fetchMock).not.toHaveBeenCalled();
  });
  it('verifies Paddle price server-side and refuses mismatched or unauthenticated checkout', async () => {
    const { t, owner } = await fixture();
    vi.stubEnv('PADDLE_API_KEY', 'test-only'); vi.stubEnv('PADDLE_WEBHOOK_SECRET', 'test-only');
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { status: 'active', unit_price: { currency_code: 'USD', amount: '100' }, billing_cycle: { interval: 'month', frequency: 1 } } }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(t.action(api.paddle.createCheckoutSession, { plan: 'accountant_monthly' })).rejects.toThrow('Unauthenticated');
    await expect(owner.action(api.paddle.createCheckoutSession, { plan: 'accountant_monthly', priceId: 'attacker-price' })).rejects.toThrow('must be $197/month');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it('Cayla stops before OpenAI after the account allowance is used', async () => {
    const { owner, reserve } = await fixture(); await reserve('cayla', 10);
    vi.stubEnv('OPENAI_API_KEY', 'test-only'); const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock);
    await expect(owner.action(api.cayla.chat, { userId: 'pricing-owner', message: 'Review my payroll' })).rejects.toThrow('PLAN_LIMIT_REACHED');
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('Paddle transactions use trusted recurring prices and reuse repeated checkout requests', async () => {
    const { owner } = await fixture(); vi.stubEnv('PADDLE_API_KEY', 'test-only'); vi.stubEnv('PADDLE_WEBHOOK_SECRET', 'test-only');
    const fetchMock = vi.fn(async (url: string, init: any) => {
      if (url.includes('/prices/')) { const yearly = url.endsWith(ACCOUNTANT_PLANS.accountant_yearly.paddlePriceId); return new Response(JSON.stringify({ data: { status: 'active', unit_price: { currency_code: 'USD', amount: yearly ? '197000' : '19700' }, billing_cycle: { interval: yearly ? 'year' : 'month', frequency: 1 } } })); }
      return new Response(JSON.stringify({ data: { id: JSON.parse(init.body).custom_data.plan === 'accountant_yearly' ? 'txn_yearly' : 'txn_monthly' } }));
    }); vi.stubGlobal('fetch', fetchMock);
    for (const plan of ['accountant_monthly', 'accountant_yearly'] as const) {
      const result = await owner.action(api.paddle.createCheckoutSession, { plan, priceId: 'untrusted', firebaseUid: 'pricing-owner' });
      expect(result.priceId).toBe(ACCOUNTANT_PLANS[plan].paddlePriceId);
      expect(await owner.action(api.paddle.createCheckoutSession, { plan })).toEqual(result);
    }
    const transactions = fetchMock.mock.calls.filter(([url])=>url.endsWith('/transactions'));
    expect(transactions).toHaveLength(2);
    expect(JSON.parse(transactions[1][1].body)).toMatchObject({ items: [{ price_id: ACCOUNTANT_PLANS.accountant_yearly.paddlePriceId, quantity: 1 }], custom_data: { firebaseUid: 'pricing-owner', plan: 'accountant_yearly' } });
  });
  it('reuses the existing production Paddle notification destination without touching subscriptions', async () => {
    const { t } = await fixture(); vi.stubEnv('PADDLE_API_KEY','test-only'); vi.stubEnv('CONVEX_SITE_URL','https://test.convex.site');
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({data:[{id:'ntfset_test',type:'url',destination:'https://test.convex.site/paddle/webhook',active:true,traffic_source:'platform',subscribed_events:['transaction.completed','transaction.paid','subscription.created','subscription.activated','subscription.updated','subscription.past_due','subscription.paused','subscription.resumed','subscription.canceled'],endpoint_secret_key:'pdl_ntfset_private_test'}]})));
    vi.stubGlobal('fetch',fetchMock);
    expect(await t.action(api.paddle.prepareAccountantWebhook,{})).toMatchObject({ok:true,created:false,notificationSettingId:'ntfset_test'});
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it('only signed Paddle webhooks can unlock a plan, replay stays idempotent', async () => {
    const { t, owner } = await fixture(); vi.stubEnv('PADDLE_WEBHOOK_SECRET', 'signing-test');
    const body = JSON.stringify({ event_id: 'evt_pricing', event_type: 'subscription.created', occurred_at: new Date().toISOString(), data: { id: 'sub_pricing', status: 'active', custom_data: { firebaseUid: 'pricing-owner', plan: 'accountant_monthly' }, items: [{ price: { id: ACCOUNTANT_PLANS.accountant_yearly.paddlePriceId } }], current_billing_period: { starts_at: '2026-10-01T00:00:00Z', ends_at: '2027-10-01T00:00:00Z' } } });
    expect((await t.fetch('/paddle/webhook', { method: 'POST', body })).status).toBe(401);
    const ts = String(Math.floor(Date.now()/1000));
    const key = await crypto.subtle.importKey('raw',new TextEncoder().encode('signing-test'),{name:'HMAC',hash:'SHA-256'},false,['sign']);
    const signature = Buffer.from(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(`${ts}:${body}`))).toString('hex');
    const request = { method: 'POST', body, headers: { 'Paddle-Signature': `ts=${ts};h1=${signature}` } };
    expect((await t.fetch('/paddle/webhook',request)).status).toBe(200);
    expect(await (await t.fetch('/paddle/webhook',request)).text()).toBe('Duplicate');
    expect(await owner.query(api.usage.getMonthlyUsage,{})).toMatchObject({plan:'accountant_yearly',billingPeriodEnd:Date.parse('2027-10-01T00:00:00Z')});
  });
  it('secure billing events map correct plans and ignore older events without deleting work', async () => {
    const { t, owner, ids } = await fixture();
    await t.mutation(api.subscriptions.applyPaddleEvent, { firebaseUid: 'pricing-owner', plan: 'accountant_yearly', planStatus: 'active', paddleSubscriptionId: 'sub_test', priceId: ACCOUNTANT_PLANS.accountant_yearly.paddlePriceId, occurredAt: 200, billingPeriodStart: 100, billingPeriodEnd: 1000 });
    await t.mutation(api.subscriptions.applyPaddleEvent, { firebaseUid: 'pricing-owner', plan: 'accountant_monthly', planStatus: 'canceled', paddleSubscriptionId: 'sub_test', occurredAt: 100 });
    expect(await owner.query(api.usage.getMonthlyUsage, {})).toMatchObject({ plan: 'accountant_yearly', employeeCount: 10, billingPeriodEnd: 1000 });
    expect(await t.run(ctx => ctx.db.get(ids.business))).toBeTruthy();
  });
});
