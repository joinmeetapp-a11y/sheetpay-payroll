import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

export const getByBusiness = query({
  args: { businessId: v.id("businesses") },
  handler: async (ctx, args) => {
    return ctx.db
      .query("payrollRuns")
      .withIndex("by_business", (q) => q.eq("businessId", args.businessId))
      .order("desc")
      .collect();
  },
});

export const create = mutation({
  args: {
    businessId: v.id("businesses"),
    userId: v.id("users"),
    month: v.string(),
    year: v.number(),
    status: v.string(),
    periodLabel: v.optional(v.string()),
    employeesSnapshot: v.array(v.any()),
    totalGross: v.number(),
    totalPaye: v.number(),
    totalNis: v.number(),
    totalHealthSurcharge: v.number(),
    totalDeductions: v.number(),
    totalNet: v.number(),
  },
  handler: async (ctx, args) => {
    return ctx.db.insert("payrollRuns", {
      ...args,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

export const update = mutation({
  args: {
    runId: v.id("payrollRuns"),
    status: v.optional(v.string()),
    employeesSnapshot: v.optional(v.array(v.any())),
    totalGross: v.optional(v.number()),
    totalPaye: v.optional(v.number()),
    totalNis: v.optional(v.number()),
    totalHealthSurcharge: v.optional(v.number()),
    totalDeductions: v.optional(v.number()),
    totalNet: v.optional(v.number()),
  },
  handler: async (ctx, { runId, ...fields }) => {
    const before = await ctx.db.get(runId);
    await ctx.db.patch(runId, { ...fields, updatedAt: Date.now() });

    // Fire payroll-completed email once, when the run transitions to a
    // finalized status. Idempotency at the send layer keys on runId so
    // retries and duplicate mutations do not double-send.
    if (before && fields.status && before.status !== fields.status) {
      const isCompleted = ["completed", "finalized", "paid"].includes(fields.status);
      if (isCompleted) {
        const business = await ctx.db.get(before.businessId);
        const user = await ctx.db.get(before.userId);
        if (business && user?.email) {
          const period = before.periodLabel || `${before.month} ${before.year}`;
          await ctx.scheduler.runAfter(0, internal.emails.notifyPayrollCompleted, {
            to: user.email,
            period,
            employeeCount: before.employeesSnapshot?.length ?? 0,
            currency: business.currency || "TTD",
            totalGross: fields.totalGross ?? before.totalGross,
            totalDeductions: fields.totalDeductions ?? before.totalDeductions,
            totalNet: fields.totalNet ?? before.totalNet,
            payrollLink: `https://sheetpay.app/app/payroll/${runId}`,
            payrollRunId: String(runId),
            userId: String(before.userId),
            businessId: String(before.businessId),
          });
        }
      }
    }
  },
});
