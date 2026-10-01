import { query, mutation, internalMutation, QueryCtx, MutationCtx } from './_generated/server';
import { ConvexError, v } from 'convex/values';
import { Id } from './_generated/dataModel';
import { isAdminEmail } from './admin';
import { ACCOUNTANT_PLANS, effectiveAccountantPlan, usagePeriod, limitMessage, type AccountantLimitKind } from '../shared/accountantPlans';
export { ACCOUNTANT_PLANS } from '../shared/accountantPlans';
export const FREE_LIMITS = ACCOUNTANT_PLANS.free.limits;
export type UsageKind = 'payslip' | 'payroll' | 'ocr' | 'cayla' | 'email';
const fields = { payslip: 'payslipsUsed', payroll: 'payrollRunsUsed', ocr: 'ocrScansUsed', cayla: 'caylaActionsUsed', email: 'emailsReserved' } as const;
const kinds = v.union(v.literal('payslip'), v.literal('payroll'), v.literal('ocr'), v.literal('cayla'), v.literal('email'));
export function accountantPlanFor(user: any) {
  return isAdminEmail(user?.email || '') ? 'accountant_monthly' as const : effectiveAccountantPlan(user);
}
export function historyAccessible(user: any, createdAt: number) {
  const days = ACCOUNTANT_PLANS[accountantPlanFor(user)].historyDays;
  return days === null || createdAt >= Date.now() - days * 86400000;
}
export function throwLimit(user: any, kind: AccountantLimitKind, used: number, limit: number): never {
  throw new ConvexError({ code: 'PLAN_LIMIT_REACHED', kind, used, limit, message: limitMessage(accountantPlanFor(user), kind, used, limit) });
}
async function resolveCallerUser(ctx: QueryCtx | MutationCtx, requesterUid?: string) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity || (requesterUid && identity.subject !== requesterUid)) return null;
  return ctx.db.query('users').withIndex('by_firebase_uid', q => q.eq('firebaseUid', identity.subject)).first();
}
async function counter(ctx: QueryCtx | MutationCtx, userId: Id<'users'>) {
  return ctx.db.query('usageCounters').withIndex('by_user_period', q => q.eq('userId', userId).eq('period', usagePeriod())).first();
}
async function writableCounter(ctx: MutationCtx, userId: Id<'users'>) {
  const row = await counter(ctx, userId);
  if (row) return row;
  const id = await ctx.db.insert('usageCounters', { userId, period: usagePeriod(), payslipsUsed: 0, payrollRunsUsed: 0, ocrScansUsed: 0, caylaActionsUsed: 0, emailsReserved: 0, payslipEmailsUsed: 0, updatedAt: Date.now() });
  return (await ctx.db.get(id))!;
}
export async function assertWithinLimit(ctx: MutationCtx, user: any, kind: UsageKind, amount = 1) {
  if (!Number.isSafeInteger(amount) || amount < 0) throw new ConvexError('Invalid usage amount.');
  // Keep existing non-accountant Pro users entitled; accountant plans have finite allowances.
  if (user.accountType !== 'accountant' && user.plan === 'pro' && user.planStatus === 'active') return;
  const limit = ACCOUNTANT_PLANS[accountantPlanFor(user)].limits[kind];
  const row = await counter(ctx, user._id);
  const used = row?.[fields[kind]] || 0;
  if (limit !== null && used + amount > limit) throwLimit(user, kind, used, limit);
}
async function increment(ctx: MutationCtx, userId: Id<'users'>, kind: UsageKind, opId: string, amount = 1, enforce = false) {
  if (!Number.isSafeInteger(amount) || amount < 0 || amount > 10000 || !opId || opId.length > 300) throw new ConvexError('Invalid usage request.');
  const scopedOp = `${userId}:${kind}:${kind === "email" ? usagePeriod() + ":" : ""}${opId}`;
  const existing = await ctx.db.query('usageIncrements').withIndex('by_op', q => q.eq('opId', scopedOp)).first();
  const row = await writableCounter(ctx, userId);
  if (existing) return { counted: false, used: row[fields[kind]] || 0 };
  const user = await ctx.db.get(userId);
  if (!user) throw new ConvexError('Account not found.');
  if (enforce) await assertWithinLimit(ctx, user, kind, amount);
  await ctx.db.insert('usageIncrements', { userId, period: usagePeriod(), kind, opId: scopedOp, amount, createdAt: Date.now() });
  const used = (row[fields[kind]] || 0) + amount;
  await ctx.db.patch(row._id, { [fields[kind]]: used, updatedAt: Date.now() });
  return { counted: true, used };
}
export const incrementUsageIdempotent = (ctx: MutationCtx, userId: Id<'users'>, kind: UsageKind, opId: string, amount = 1) => increment(ctx, userId, kind, opId, amount);
export const reserveUsage = (ctx: MutationCtx, userId: Id<'users'>, kind: UsageKind, opId: string, amount = 1) => increment(ctx, userId, kind, opId, amount, true);
export async function assertCapacity(ctx: MutationCtx, user: any, kind: 'clients' | 'employees' | 'team', amount: number) {
  let used = 0;
  if (kind === 'clients') used = (await ctx.db.query('businesses').withIndex('by_user', q => q.eq('userId', user._id)).collect()).length + (await ctx.db.query('accountantClients').withIndex('by_accountant_user', q => q.eq('accountantUserId', user._id)).collect()).length;
  if (kind === 'employees') used = (await ctx.db.query('employees').withIndex('by_user', q => q.eq('userId', user._id)).collect()).length;
  if (kind === 'team') {
    const members = await ctx.db.query('accountantMemberships').withIndex('by_workspace', q => q.eq('workspaceOwnerId', user._id)).collect();
    const invites = await ctx.db.query('accountantInvites').withIndex('by_workspace', q => q.eq('workspaceOwnerId', user._id)).collect();
    const emails = new Set(members.filter(m => m.status === 'active').map(m => m.email.toLowerCase()));
    for (const invite of invites) if (['pending', 'failed'].includes(invite.status) && invite.expiresAt > Date.now()) emails.add(invite.email.toLowerCase());
    used = 1 + emails.size;
  }
  const limit = ACCOUNTANT_PLANS[accountantPlanFor(user)].limits[kind];
  if (used + amount > limit) throwLimit(user, kind, used, limit);
}
export const getMonthlyUsage = query({ args: { requesterUid: v.optional(v.string()), businessId: v.optional(v.id('businesses')) }, handler: async (ctx, args) => {
  const actor = await resolveCallerUser(ctx, args.requesterUid);
  if (!actor) return null;
  let user = actor;
  if (args.businessId) {
    const { requireBusinessAccess } = await import('./lib/accountantAccess');
    user = (await requireBusinessAccess(ctx, await ctx.db.get(args.businessId), 'read')).owner;
  }
  const row = await counter(ctx, user._id);
  const [clients, employees, members, legacyClients] = await Promise.all([
    ctx.db.query('businesses').withIndex('by_user', q => q.eq('userId', user._id)).collect(),
    ctx.db.query('employees').withIndex('by_user', q => q.eq('userId', user._id)).collect(),
    ctx.db.query('accountantMemberships').withIndex('by_workspace', q => q.eq('workspaceOwnerId', user._id)).collect(),
    ctx.db.query('accountantClients').withIndex('by_accountant_user', q => q.eq('accountantUserId', user._id)).collect(),
  ]);
  const plan = accountantPlanFor(user);
  return { plan, planStatus: user.planStatus || 'none', period: usagePeriod(), resetsAt: Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() + 1, 1), billingPeriodStart: user.billingPeriodStart, billingPeriodEnd: user.billingPeriodEnd,
    clientCount: clients.length + legacyClients.length, employeeCount: employees.length, teamMemberCount: 1 + members.filter(m => m.status === 'active').length,
    payslipsUsed: row?.payslipsUsed || 0, payrollRunsUsed: row?.payrollRunsUsed || 0, ocrScansUsed: row?.ocrScansUsed || 0, caylaActionsUsed: row?.caylaActionsUsed || 0, emailsReserved: row?.emailsReserved || 0, payslipEmailsUsed: row?.payslipEmailsUsed || 0, limits: ACCOUNTANT_PLANS[plan].limits };
} });
async function byUid(ctx: MutationCtx, firebaseUid: string) {
  const user = await ctx.db.query('users').withIndex('by_firebase_uid', q => q.eq('firebaseUid', firebaseUid)).first();
  if (!user) throw new ConvexError('Unauthorized');
  return user;
}
export async function assertWithinLimitByUid(ctx: MutationCtx, uid: string, kind: UsageKind) { const user = await byUid(ctx, uid); await assertWithinLimit(ctx, user, kind); return { userId: user._id }; }
export async function incrementByUidIdempotent(ctx: MutationCtx, uid: string, kind: UsageKind, opId: string) { return incrementUsageIdempotent(ctx, (await byUid(ctx, uid))._id, kind, opId); }
export const internalReserveByUid = internalMutation({ args: { firebaseUid: v.string(), kind: kinds, opId: v.string(), amount: v.optional(v.number()) }, handler: async (ctx, args) => reserveUsage(ctx, (await byUid(ctx, args.firebaseUid))._id, args.kind, args.opId, args.amount) });
export const internalIncrementByUid = internalMutation({ args: { firebaseUid: v.string(), kind: kinds, opId: v.string() }, handler: (ctx, args) => incrementByUidIdempotent(ctx, args.firebaseUid, args.kind, args.opId) });
export const internalAssertLimitByUid = internalMutation({ args: { firebaseUid: v.string(), kind: kinds }, handler: async (ctx, args) => { await assertWithinLimitByUid(ctx, args.firebaseUid, args.kind); return { ok: true }; } });
export const internalIncrement = internalMutation({ args: { userId: v.id('users'), kind: kinds, opId: v.string() }, handler: (ctx, args) => incrementUsageIdempotent(ctx, args.userId, args.kind, args.opId) });
export const trackUsage = mutation({ args: { requesterUid: v.string(), kind: kinds, opId: v.string() }, handler: async (ctx, args) => { const user = await resolveCallerUser(ctx, args.requesterUid); if (!user) throw new ConvexError('Unauthorized'); return reserveUsage(ctx, user._id, args.kind, args.opId); } });
export async function requirePlan(ctx: QueryCtx | MutationCtx, requesterUid: string, minPlan: 'pro' | 'accountant') {
  const user = await resolveCallerUser(ctx, requesterUid);
  if (!user) throw new ConvexError('Unauthorized');
  const paid = accountantPlanFor(user) !== 'free';
  if (!paid && !(minPlan === 'pro' && user.plan === 'pro' && user.planStatus === 'active')) throw new ConvexError(`PLAN_REQUIRED:${minPlan}`);
  return { userId: user._id, plan: paid ? 'accountant' as const : 'pro' as const };
}

// Internal facade for older email tools. Validate real employee recipients and
// reserve the complete batch atomically before any provider request.
export const authorizeLegacyEmail = internalMutation({
  args: { firebaseUid: v.string(), businessId: v.optional(v.string()), recipients: v.array(v.string()), opId: v.string() },
  handler: async (ctx, args) => {
    const actor = await byUid(ctx, args.firebaseUid);
    if (!args.businessId || !args.recipients.length || args.recipients.length > 2500) throw new ConvexError('Select a client and employee recipients.');
    const businessId = ctx.db.normalizeId('businesses', args.businessId);
    const business = businessId ? await ctx.db.get(businessId) : null;
    const { requireBusinessAccess } = await import('./lib/accountantAccess');
    const access = await requireBusinessAccess(ctx, business, 'sendPayslips');
    if (access.actor._id !== actor._id) throw new ConvexError('Unauthorized');
    const employees = await ctx.db.query('employees').withIndex('by_business', q => q.eq('businessId', business!._id)).collect();
    const unique = [...new Set(args.recipients.map(email => email.trim().toLowerCase()))];
    for (const email of unique) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ConvexError('Invalid employee email.');
      const employee = employees.find(row => row.email?.trim().toLowerCase() === email);
      if (!employee) throw new ConvexError('Recipient does not belong to the selected client.');
      await reserveUsage(ctx, access.owner._id, 'email', `legacy:${args.opId}:${employee._id}`);
    }
    return { userId: access.owner._id };
  },
});
