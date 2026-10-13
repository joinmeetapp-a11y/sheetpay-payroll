import { randomBytes, createHash } from 'node:crypto';
import { internal } from '../_generated/api';
import { esc } from './emailComponents';

export async function emailUnsubscribe(ctx: any, email: string) {
  const site = process.env.CONVEX_SITE_URL;
  if (!site || !/^https:\/\/[a-z0-9-]+\.convex\.site$/.test(site)) throw new Error('Email unsubscribe endpoint is not configured.');
  const token = randomBytes(32).toString('hex');
  const record = await ctx.runMutation((internal as any).emailSubscriptions.ensure, { email, token, tokenHash: createHash('sha256').update(token).digest('hex') });
  return { allowed: record.allowed, url: `${site}/email/unsubscribe?token=${record.token}` };
}

export function withUnsubscribeButton(html: string, url: string, marketing = false) {
  if (/<[a-z][^>]*\bdata-sheetpay-unsubscribe(?:\s|=|>)/i.test(html)) return html;
  const footer = `<div data-sheetpay-unsubscribe style="max-width:560px;margin:0 auto;padding:20px;text-align:center;font-family:Arial,sans-serif"><a href="${esc(url)}" role="button" style="display:inline-block;padding:12px 22px;border:1px solid #087b58;border-radius:10px;background:#fff;color:#087b58;font-size:13px;font-weight:700;text-decoration:none">Unsubscribe</a><p style="font-size:11px;line-height:1.6;color:#617269">${marketing ? 'Stop marketing emails from Sheetpay.' : 'Stop optional Sheetpay emails. Essential account and security messages remain available.'}</p></div>`;
  return /<\/body\s*>/i.test(html) ? html.replace(/<\/body\s*>/i, footer + '</body>') : html + footer;
}

export const unsubscribeHeaders = (url: string) => ({ 'List-Unsubscribe': `<${url}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' });
