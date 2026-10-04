/// <reference types="vite/client" />
import { describe, it, expect } from 'vitest';
import { convexTest } from 'convex-test';
import { anyApi } from 'convex/server';
import schema from '../convex/schema';
import { assertCapacity, historyAccessible, reserveReminderEmail } from '../convex/usage';
import { usagePeriod } from '../shared/accountantPlans';
const modules = import.meta.glob('../convex/**/*.{ts,js}');
describe('verified admin unlimited Accountant access', () => {
  it('removes all plan quotas without changing billing and still counts operations once', async () => {
    const t = convexTest(schema, modules);
    const id = await t.run(async ctx => {
      const id = await ctx.db.insert('users', { firebaseUid: 'admin-unlimited', email: 'Surebookme@gmail.com', emailVerified: true, accountType: 'accountant', plan: 'free', planStatus: 'none' });
      await ctx.db.insert('usageCounters', { userId: id, period: usagePeriod(), payslipsUsed: 3000, payrollRunsUsed: 100, ocrScansUsed: 2000, caylaActionsUsed: 2000, emailsReserved: 6000, payslipEmailsUsed: 6000, reminderEmailsReserved: 1000, updatedAt: Date.now() });
      return id;
    });
    const admin = t.withIdentity({ subject: 'admin-unlimited', email: 'surebookme@gmail.com', emailVerified: true });
    const usage = await admin.query(anyApi.usage.getMonthlyUsage, {});
    expect(usage.unlimitedAccess).toBe(true);
    expect(Object.values(usage.limits).every(value => value === null)).toBe(true);
    expect(usage.reminderLimits.email).toBe(null);
    for (const kind of ['payslip', 'payroll', 'ocr', 'cayla', 'email']) {
      const args = { requesterUid: 'admin-unlimited', kind, opId: `admin-${kind}` };
      expect((await admin.mutation(anyApi.usage.trackUsage, args)).counted).toBe(true);
      expect((await admin.mutation(anyApi.usage.trackUsage, args)).counted).toBe(false);
    }
    await t.run(async ctx => {
      const user = (await ctx.db.get(id))!;
      for (const kind of ['clients', 'employees', 'team'] as const) await assertCapacity(ctx, user, kind, 10000);
      expect(historyAccessible(user, 0)).toBe(true);
      const notificationId = await ctx.db.insert('notifications', { userId: id, category: 'reminder', type: 'test', title: 'Reminder', message: 'Test', dedupeKey: 'admin-reminder', createdAt: Date.now() });
      expect((await reserveReminderEmail(ctx, id, notificationId)).counted).toBe(true);
      expect((await reserveReminderEmail(ctx, id, notificationId)).counted).toBe(false);
      expect(await ctx.db.get(id)).toMatchObject({ plan: 'free', planStatus: 'none' });
    });
    expect(await admin.query(anyApi.usage.getMonthlyUsage, { requesterUid: 'another-user' })).toBe(null);
  });
  for (const [email, emailVerified] of [['surebookme@gmail.com', false], ['ordinary@example.com', true]] as const) it(`keeps quotas for ${email} verified=${emailVerified}`, async () => {
    const t = convexTest(schema, modules);
    await t.run(ctx => ctx.db.insert('users', { firebaseUid: 'limited', email, emailVerified, accountType: 'accountant', plan: 'free' }));
    const user = t.withIdentity({ subject: 'limited', email, emailVerified });
    const usage = await user.query(anyApi.usage.getMonthlyUsage, {});
    expect(usage.unlimitedAccess).toBe(false);
    expect(usage.limits.cayla).toBe(10);
    for (let i = 0; i < 10; i++) await user.mutation(anyApi.usage.trackUsage, { requesterUid: 'limited', kind: 'cayla', opId: String(i) });
    await expect(user.mutation(anyApi.usage.trackUsage, { requesterUid: 'limited', kind: 'cayla', opId: 'over' })).rejects.toThrow('PLAN_LIMIT_REACHED');
  });
});
