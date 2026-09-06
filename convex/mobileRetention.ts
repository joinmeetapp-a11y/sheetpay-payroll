import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

async function requireAuthenticatedUser(ctx: any) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity?.subject) throw new Error("Unauthorized");
  const user = await ctx.db
    .query("users")
    .withIndex("by_firebase_uid", (q: any) => q.eq("firebaseUid", identity.subject))
    .first();
  if (!user) throw new Error("Unauthorized");
  return user;
}

async function requireOwnedBusiness(ctx: any, businessId: Id<"businesses">) {
  const user = await requireAuthenticatedUser(ctx);
  const business = await ctx.db.get(businessId);
  if (!business || business.userId !== user._id) throw new Error("Forbidden");
  return { user, business };
}

async function requireOwnedRun(ctx: any, runId: Id<"payrollRuns">) {
  const user = await requireAuthenticatedUser(ctx);
  const run = await ctx.db.get(runId);
  if (!run || run.userId !== user._id) throw new Error("Forbidden");
  return { user, run };
}

const safeEventNames = new Set([
  "first_payroll_completed",
  "second_payroll_completed",
  "repeat_payroll_used",
  "bulk_payslips_generated",
  "payslips_delivered",
  "recurring_payroll_enabled",
  "report_generated",
  "year_end_opened",
  "year_end_completed",
  "employee_portal_enabled",
]);

export const getWorkspace = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireAuthenticatedUser(ctx);
    const businesses = await ctx.db.query("businesses").withIndex("by_user", (q) => q.eq("userId", user._id)).collect();
    const employees = await ctx.db.query("employees").withIndex("by_user", (q) => q.eq("userId", user._id)).collect();
    const payrollRuns = await ctx.db.query("payrollRuns").withIndex("by_user", (q) => q.eq("userId", user._id)).order("desc").collect();
    const schedules = await ctx.db.query("recurringPayrollSchedules").withIndex("by_user", (q) => q.eq("userId", user._id)).collect();
    const deliveries = await ctx.db.query("payslipDeliveryRecords").withIndex("by_user", (q) => q.eq("userId", user._id)).collect();
    const documents = await ctx.db.query("generatedDocuments").withIndex("by_user", (q) => q.eq("userId", user._id)).collect();
    return { businesses, employees, payrollRuns, schedules, deliveries, documents };
  },
});

export const listPayrollRuns = query({
  args: { businessId: v.id("businesses"), year: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requireOwnedBusiness(ctx, args.businessId);
    if (args.year !== undefined) {
      return ctx.db.query("payrollRuns")
        .withIndex("by_business_year", (q) => q.eq("businessId", args.businessId).eq("year", args.year!))
        .order("desc").collect();
    }
    return ctx.db.query("payrollRuns").withIndex("by_business", (q) => q.eq("businessId", args.businessId)).order("desc").collect();
  },
});

export const getLatestCompletedPayroll = query({
  args: { businessId: v.id("businesses") },
  handler: async (ctx, args) => {
    await requireOwnedBusiness(ctx, args.businessId);
    const runs = await ctx.db.query("payrollRuns").withIndex("by_business", (q) => q.eq("businessId", args.businessId)).order("desc").take(50);
    return runs.find((r) => ["completed", "payslips_generated", "delivered", "approved", "finalized", "paid"].includes(r.status)) ?? null;
  },
});

export const createPayrollRun = mutation({
  args: {
    businessId: v.id("businesses"),
    month: v.string(),
    year: v.number(),
    status: v.string(),
    periodLabel: v.optional(v.string()),
    countryCode: v.optional(v.string()),
    currencyCode: v.string(),
    payPeriodStart: v.string(),
    payPeriodEnd: v.string(),
    payDate: v.string(),
    employeeIds: v.array(v.string()),
    employeesSnapshot: v.array(v.any()),
    totalGross: v.number(),
    totalPaye: v.number(),
    totalNis: v.number(),
    totalHealthSurcharge: v.number(),
    totalDeductions: v.number(),
    totalNet: v.number(),
    sourcePayrollRunId: v.optional(v.id("payrollRuns")),
    generationKey: v.string(),
  },
  handler: async (ctx, args) => {
    const { user } = await requireOwnedBusiness(ctx, args.businessId);
    if (args.sourcePayrollRunId) {
      const source = await ctx.db.get(args.sourcePayrollRunId);
      if (!source || source.userId !== user._id || source.businessId !== args.businessId) throw new Error("Invalid source payroll");
    }
    const duplicate = await ctx.db.query("payrollRuns")
      .withIndex("by_generation_key", (q) => q.eq("generationKey", args.generationKey)).first();
    if (duplicate) {
      if (duplicate.userId !== user._id) throw new Error("Forbidden");
      return duplicate._id;
    }
    const now = Date.now();
    return ctx.db.insert("payrollRuns", {
      businessId: args.businessId,
      userId: user._id,
      month: args.month,
      year: args.year,
      status: args.status,
      periodLabel: args.periodLabel,
      employeesSnapshot: args.employeesSnapshot,
      totalGross: args.totalGross,
      totalPaye: args.totalPaye,
      totalNis: args.totalNis,
      totalHealthSurcharge: args.totalHealthSurcharge,
      totalDeductions: args.totalDeductions,
      totalNet: args.totalNet,
      countryCode: args.countryCode,
      currencyCode: args.currencyCode,
      payPeriodStart: args.payPeriodStart,
      payPeriodEnd: args.payPeriodEnd,
      payDate: args.payDate,
      employeeIds: args.employeeIds,
      sourcePayrollRunId: args.sourcePayrollRunId,
      generationKey: args.generationKey,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updatePayrollStatus = mutation({
  args: { runId: v.id("payrollRuns"), status: v.string() },
  handler: async (ctx, args) => {
    const { run } = await requireOwnedRun(ctx, args.runId);
    const now = Date.now();
    const patch: any = { status: args.status, updatedAt: now };
    if (args.status === "approved" && !run.approvedAt) patch.approvedAt = now;
    if (args.status === "completed" && !run.completedAt) patch.completedAt = now;
    await ctx.db.patch(args.runId, patch);
    return { ok: true };
  },
});

export const upsertRecurringSchedule = mutation({
  args: {
    businessId: v.id("businesses"),
    payFrequency: v.string(),
    nextPayDate: v.string(),
    timezone: v.string(),
    reminderSchedule: v.string(),
    enabled: v.boolean(),
  },
  handler: async (ctx, args) => {
    const { user } = await requireOwnedBusiness(ctx, args.businessId);
    const existing = await ctx.db.query("recurringPayrollSchedules")
      .withIndex("by_business", (q) => q.eq("businessId", args.businessId)).first();
    const now = Date.now();
    if (existing) {
      if (existing.userId !== user._id) throw new Error("Forbidden");
      await ctx.db.patch(existing._id, { ...args, updatedAt: now });
      return existing._id;
    }
    return ctx.db.insert("recurringPayrollSchedules", {
      ...args, userId: user._id, createdAt: now, updatedAt: now,
    });
  },
});

export const getEmployeeYtd = query({
  args: { employeeId: v.id("employees"), year: v.number() },
  handler: async (ctx, args) => {
    const user = await requireAuthenticatedUser(ctx);
    const employee = await ctx.db.get(args.employeeId);
    if (!employee || employee.userId !== user._id) throw new Error("Forbidden");
    const runs = await ctx.db.query("payrollRuns")
      .withIndex("by_business_year", (q) => q.eq("businessId", employee.businessId).eq("year", args.year))
      .collect();
    let gross = 0, deductions = 0, net = 0, paye = 0, nis = 0, healthSurcharge = 0, payslips = 0;
    for (const run of runs) {
      if (!["completed", "payslips_generated", "delivered", "approved", "finalized", "paid"].includes(run.status)) continue;
      const snap = (run.employeesSnapshot ?? []).find((x: any) =>
        String(x?._id ?? x?.id ?? x?.employeeId ?? x?.localId ?? "") === String(employee._id) ||
        String(x?.employeeId ?? "") === employee.employeeId
      );
      if (!snap) continue;
      gross += Number(snap.grossPay ?? 0);
      deductions += Number(snap.totalDeductions ?? snap.deductions ?? 0);
      net += Number(snap.netPay ?? 0);
      paye += Number(snap.paye ?? 0);
      nis += Number(snap.nis ?? 0);
      healthSurcharge += Number(snap.healthSurcharge ?? 0);
      payslips += 1;
    }
    return { year: args.year, currency: (await ctx.db.get(employee.businessId))?.currency ?? "", gross, deductions, net, paye, nis, healthSurcharge, payslips };
  },
});

export const recordRetentionEvent = mutation({
  args: { eventName: v.string(), businessId: v.optional(v.id("businesses")), payrollRunId: v.optional(v.id("payrollRuns")) },
  handler: async (ctx, args) => {
    const user = await requireAuthenticatedUser(ctx);
    if (!safeEventNames.has(args.eventName)) throw new Error("Unsupported event");
    if (args.businessId) await requireOwnedBusiness(ctx, args.businessId);
    if (args.payrollRunId) await requireOwnedRun(ctx, args.payrollRunId);
    await ctx.db.insert("retentionEvents", { userId: user._id, businessId: args.businessId, payrollRunId: args.payrollRunId, eventName: args.eventName, createdAt: Date.now() });
    return { ok: true };
  },
});
