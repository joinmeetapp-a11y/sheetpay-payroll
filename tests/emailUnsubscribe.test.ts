/// <reference types="vite/client" />
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { convexTest } from 'convex-test';
import { anyApi } from 'convex/server';
import { createHash } from 'node:crypto';
import schema from '../convex/schema';
import { EMAIL_TEMPLATES } from '../convex/lib/emailTemplates';
import { withUnsubscribeButton } from '../convex/lib/emailUnsubscribe';
const modules = import.meta.glob('../convex/**/*.{ts,js}');
const api = anyApi;
beforeEach(() => { vi.stubEnv('RESEND_API_KEY', 'test'); vi.stubEnv('CONVEX_SITE_URL', 'https://example.convex.site'); });
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe('Resend unsubscribe buttons and recipient preferences', () => {
  it.each(Object.keys(EMAIL_TEMPLATES))('includes a working unsubscribe button in the %s template', async emailType => {
    const t = convexTest(schema, modules), sent: any[] = [];
    vi.stubGlobal('fetch', vi.fn(async (_url, init: any) => { sent.push(JSON.parse(init.body)); return new Response(JSON.stringify({ id: 'email-1' })); }));
    expect(await t.action(api.emailService.sendEmailInternal, { to: 'employee@example.com', emailType, data: {} })).toMatchObject({ success: true });
    expect(sent).toHaveLength(1);
    const html = sent[0].html;
    expect(html).toContain('data-sheetpay-unsubscribe'); expect(html).toContain('role="button"');
    const match = html.match(/href="(https:\/\/example\.convex\.site\/email\/unsubscribe\?token=[a-f0-9]{64})"/);
    expect(match).not.toBeNull();
    const response = await t.fetch(new URL(match![1]).pathname + new URL(match![1]).search);
    expect(await response.text()).toContain('Unsubscribe from Sheetpay emails?');
    expect(await t.query(api.emailSubscriptions.allowed, { email: 'employee@example.com' })).toBe(true);
  });
  it('requires confirmation, is idempotent and stops optional mail while preserving essential messages', async () => {
    const t = convexTest(schema, modules), sent: any[] = [];
    vi.stubGlobal('fetch', vi.fn(async (_url, init: any) => { sent.push(JSON.parse(init.body)); return new Response(JSON.stringify({ id: 'mail-' + sent.length })); }));
    const send = (emailType: string) => t.action(api.emailService.sendEmailInternal, { to: 'worker@example.com', emailType, data: {} });
    await send('welcome');
    const header = sent[0].headers['List-Unsubscribe'];
    expect(sent[0].headers['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click');
    const url = new URL(header.slice(1, -1)), route = url.pathname + url.search;
    await t.fetch(route); expect(await t.query(api.emailSubscriptions.allowed, { email: 'worker@example.com' })).toBe(true);
    for (let attempt = 0; attempt < 2; attempt++) expect(await (await t.fetch(route, { method: 'POST', body: 'List-Unsubscribe=One-Click' })).text()).toContain('You are unsubscribed');
    expect(await t.query(api.emailSubscriptions.allowed, { email: ' WORKER@EXAMPLE.COM ' })).toBe(false);
    for (const emailType of ['welcome', 'payrollCompleted', 'payslipReady', 'teamInvite']) expect(await send(emailType)).toMatchObject({ status: 'skipped', error: 'recipient unsubscribed' });
    expect(sent).toHaveLength(1);
    expect(await send('passwordReset')).toMatchObject({ success: true });
    expect(sent[1].html).toContain('data-sheetpay-unsubscribe');
    expect(sent[1].headers['List-Unsubscribe']).toBeUndefined();
    expect(await (await t.fetch(route)).text()).toContain('You are unsubscribed');
  });
  it('reuses the same token and rejects forged or unknown links without changing preferences', async () => {
    const t = convexTest(schema, modules), token = 'a'.repeat(64);
    const args = { email: 'worker@example.com', token, tokenHash: createHash('sha256').update(token).digest('hex') };
    const first = await t.mutation(api.emailSubscriptions.ensure, args);
    const second = await t.mutation(api.emailSubscriptions.ensure, { ...args, email: 'WORKER@example.com', token: 'b'.repeat(64), tokenHash: 'c'.repeat(64) });
    expect(first.token).toBe(second.token);
    expect(await t.run(ctx => ctx.db.query('emailSubscriptions').collect())).toHaveLength(1);
    for (const value of ['bad', '0'.repeat(64), token.slice(1)]) expect(await (await t.fetch('/email/unsubscribe?token=' + value, { method: 'POST' })).text()).toContain('Link unavailable');
    expect(await t.query(api.emailSubscriptions.allowed, { email: args.email })).toBe(true);
  });
  it('escapes footer URLs and never duplicates its button', () => {
    const html = withUnsubscribeButton('<html><body>Message</body></html>', 'https://example.convex.site/email/unsubscribe?token="<bad>');
    expect(html).toContain('&quot;&lt;bad&gt;');
    expect(withUnsubscribeButton(html, 'https://example.convex.site')).toBe(html);
    expect(withUnsubscribeButton('<p>data-sheetpay-unsubscribe</p>', 'https://example.convex.site')).toContain('role="button"');
  });
});
