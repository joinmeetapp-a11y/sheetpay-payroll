import type { MutationCtx } from '../_generated/server';
import type { Id } from '../_generated/dataModel';
const DAY = 86400000;
export const uiEvents = ['signup_started','accountant_onboarding_started','dashboard_entered','employee_import_started','ocr_started','payslip_previewed','paywall_viewed','mobile_cta_clicked','accountant_cta_clicked','calculator_used','payslip_generator_cta_clicked','product_selection_viewed','product_selected','mobile_launch_notification_clicked','product_switched','operation_failed'] as const;
export const errors = ['firebase_auth','convex_mutation','ocr_import','cayla_tool','payroll_processing','paddle_checkout'] as const;
export function safePath(value: string) {
  const path = value.split(/[?#]/)[0].toLowerCase();
  if (path === '/accountant') return path;
  if (/^\/(admin|accountant|app|auth)(\/|$)/.test(path)) return '/private';
  return /^\/[a-z-]*(?:\/[a-z-]+){0,3}$/.test(path) && path.length <= 160 ? path : '/unknown';
}
export function campaign(value?: string) { return value && /^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/.test(value) && !/\d{6}|token|password|email/i.test(value) ? value.toLowerCase() : undefined; }
export function sanitizeTouch(t: any) {
  const source = ['google_organic','bing_organic','direct','social','referral','paid','unknown'].includes(t.source) ? t.source : 'unknown';
  const referrer = /^(?:[a-z0-9-]+\.)+[a-z]{2,24}$/.test(t.referrer) && t.referrer.length <= 100 ? t.referrer : '';
  return { path: safePath(t.path), source, referrer, ...Object.fromEntries(['utmSource','utmMedium','utmCampaign','utmContent','utmTerm'].map(k=>[k,campaign(t[k])]).filter(([,v])=>v !== undefined)) };
}
export async function hash(value: string) { const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)); return Array.from(new Uint8Array(bytes), b=>b.toString(16).padStart(2,'0')).join(''); }
export async function budget(ctx: MutationCtx, key: string, limit: number) {
  const bucket = `rate:${key}:${Math.floor(Date.now()/60000)}`;
  const row = await ctx.db.query('growthState').withIndex('by_key', q=>q.eq('key',bucket)).unique();
  if ((row?.value || 0) >= limit) return false;
  if(row) await ctx.db.patch(row._id,{value:row.value+1}); else await ctx.db.insert('growthState',{key:bucket,value:1,expiresAt:Date.now()+10*60000});
  return true;
}
export async function ensureSummary(ctx: MutationCtx, userId: Id<'users'>) {
  const row = await ctx.db.query('growthUsers').withIndex('by_user',q=>q.eq('userId',userId)).unique();
  if(row) return row;
  const user = await ctx.db.get(userId); if(!user) throw new Error('User unavailable');
  const id = await ctx.db.insert('growthUsers',{userId,joinedAt:user.createdAt ?? user._creationTime,interest:'unknown',milestones:{},counts:{},historical:[],lastAt:user.createdAt ?? user._creationTime,onboardingKnown:user.onboardingCompleted===true,accountType:user.accountType||'unknown',verification: user.emailVerified === true ? 'verified' : user.emailVerified === false ? 'unverified' : 'unknown',payrollCycles:[],paid:false,billingVerified:false});
  return (await ctx.db.get(id))!;
}
/** Only trusted mutations call this; never accept arbitrary metadata or transcripts. */
export async function recordGrowth(ctx: MutationCtx, userId: Id<'users'>, name: string, key: string, at = Date.now(), errorCategory?: string, origin = 'server') {
  if(!errorCategory && name.startsWith('error_') && errors.includes(name.slice(6) as any))errorCategory=name.slice(6);
  const dedupe = `${userId}:${name}:${key}`;
  if(await ctx.db.query('growthEvents').withIndex('by_key',q=>q.eq('key',dedupe)).unique()) return;
  const s = await ensureSummary(ctx,userId);
  if(key==='once' && s.milestones[name]!==undefined)return;
  await ctx.db.insert('growthEvents',{userId,name,key:dedupe,at,origin,...(origin==='server'?{product:'accountant'}:{}),...(errorCategory ? {errorCategory}:{}),expiresAt:Date.now()+180*DAY});
  await ctx.db.patch(s._id,{milestones:{...s.milestones,[name]:Math.min(s.milestones[name] ?? at,at)},counts:{...s.counts,[name]:(s.counts[name] || 0)+1},lastAt:Math.max(s.lastAt,at)});
}
/** This path follows the server statutory engine and persisted review approval. */
export async function recordApprovedPayroll(ctx: MutationCtx, runId: Id<'payrollRuns'>) {
  const run = await ctx.db.get(runId); if(!run || run.status !== 'approved' || !run.employeesSnapshot.length) return;
  for(const row of run.employeesSnapshot) { const id=ctx.db.normalizeId('employees',String(row._id||'')); const e=id ? await ctx.db.get(id):null; if(!e || e.isDemo || e.businessId !== run.businessId) return; }
  const s = await ensureSummary(ctx,run.userId);
  const cycle = `${run.businessId}:${run.periodLabel || `${run.month}-${run.year}`}`;
  // A second payroll means a different client-period, not a repeated click or duplicate run.
  if(await ctx.db.query('growthPayrollCycles').withIndex('by_cycle',q=>q.eq('userId',run.userId).eq('cycle',cycle)).unique())return;
  await ctx.db.insert('growthPayrollCycles',{userId:run.userId,cycle,at:run.createdAt});
  await recordGrowth(ctx,run.userId,'real_payroll_completed',cycle,run.createdAt);
  const updated = (await ctx.db.get(s._id))!;
  await ctx.db.patch(s._id,{payrollCycles:[...updated.payrollCycles,cycle].slice(-120)});
  await recordGrowth(ctx,run.userId,'first_real_payroll_completed','once',run.createdAt);
  if(updated.payrollCycles.length) await recordGrowth(ctx,run.userId,'second_payroll_completed','once',run.createdAt);
}
