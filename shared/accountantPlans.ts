// Canonical Accountant pricing contract. The landing repository consumes a generated
// copy; its deployment compares that copy with this file before publishing.
export const ACCOUNTANT_PLAN_IDS = ['free', 'accountant_monthly', 'accountant_yearly'] as const;
export type AccountantPlanId = typeof ACCOUNTANT_PLAN_IDS[number];
const paidLimits = { clients: 25, employees: 2500, payroll: null, payslip: 2500, cayla: 1000, ocr: 1000, email: 5000, team: 5 };
export const ACCOUNTANT_PLANS = {
  free: { id: 'free', name: 'Free', price: 0, interval: null, priceLabel: '$0', monthlyEquivalent: null, savings: 0, freeMonths: 0, paddlePriceId: null, limits: { clients: 1, employees: 10, payroll: 1, payslip: 10, cayla: 10, ocr: 10, email: 10, team: 1 }, watermark: true, historyDays: 30, fullBranding: false },
  accountant_monthly: { id: 'accountant_monthly', name: 'Accountant Monthly', price: 197, interval: 'month', priceLabel: '$197/month', monthlyEquivalent: 197, savings: 0, freeMonths: 0, paddlePriceId: 'pri_01m0r19pgkx604y5q3gp1trhqh', limits: paidLimits, watermark: false, historyDays: null, fullBranding: true },
  accountant_yearly: { id: 'accountant_yearly', name: 'Accountant Yearly', price: 1970, interval: 'year', priceLabel: '$1,970/year', monthlyEquivalent: Math.round(1970 / 12), savings: 197 * 12 - 1970, freeMonths: 2, paddlePriceId: 'pri_01m3mjv9jcjphn3545x04c5gyk', limits: paidLimits, watermark: false, historyDays: null, fullBranding: true },
} as const;
export const isAccountantPlanId = (value: unknown): value is AccountantPlanId => ACCOUNTANT_PLAN_IDS.includes(value as AccountantPlanId);
export function effectiveAccountantPlan(user: { plan?: string; planStatus?: string; paddlePriceId?: string } | null | undefined): AccountantPlanId {
  if (!user || !['active', 'trialing'].includes(user.planStatus || '')) return 'free';
  if (user.plan === 'accountant_yearly') return 'accountant_yearly';
  if (user.plan === 'accountant_monthly') return 'accountant_monthly';
  // Read legacy subscriptions without rewriting, cancelling or repricing them.
  if (user.plan === 'accountant') return user.paddlePriceId === ACCOUNTANT_PLANS.accountant_yearly.paddlePriceId ? 'accountant_yearly' : 'accountant_monthly';
  return 'free';
}
export function usagePeriod(now = Date.now()) {
  const date = new Date(now);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}
export const LIMIT_LABELS = { clients: 'clients', employees: 'employees', payroll: 'payroll runs', payslip: 'payslips', cayla: 'Cayla requests', ocr: 'OCR pages', email: 'payslip emails', team: 'team members' } as const;
export type AccountantLimitKind = keyof typeof LIMIT_LABELS;
export function limitMessage(planId: AccountantPlanId, kind: AccountantLimitKind, used: number, limit: number) {
  const monthly = ['payroll', 'payslip', 'cayla', 'ocr', 'email'].includes(kind);
  return `You've reached your ${ACCOUNTANT_PLANS[planId].name} plan limit of ${limit.toLocaleString('en-US')} ${LIMIT_LABELS[kind]}${monthly ? ' this month' : ''}. ${used.toLocaleString('en-US')} used. Your work is saved.`;
}
export function planFeatures(id: AccountantPlanId) {
  const p = ACCOUNTANT_PLANS[id], l = p.limits, n = (v: number) => v.toLocaleString('en-US');
  return [`${n(l.clients)} ${l.clients === 1 ? 'client' : 'clients'} · ${n(l.employees)} employees`, `${l.payroll === null ? 'Unlimited' : l.payroll} payroll runs${l.payroll === null ? '' : '/month'}`, `${n(l.payslip)} payslips/month`, `${n(l.cayla)} Cayla requests/month`, `${n(l.ocr)} OCR pages/month`, `${n(l.email)} payslip emails/month`, `${l.team} team ${l.team === 1 ? 'member' : 'members'} (including owner)`, id === 'free' ? 'Limited bulk generation, email, print & PDF download' : 'Full bulk generation, email, print & PDF download', 'Automatic statutory calculations', p.fullBranding ? 'Full custom branding · no watermark' : 'Basic branding · Sheetpay watermark', p.historyDays === null ? 'Full payroll history' : `${p.historyDays}-day payroll history`];
}
