import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { assertWithinLimit, incrementUsageIdempotent, historyAccessible, reserveUsage } from "./usage";
import { createWorkspaceNotification } from "./notifications";
import { requireBusinessAccess } from "./lib/accountantAccess";

async function requirePayrollOwner(ctx: any, userId: any, businessId?: any) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Unauthenticated");
  const user = await ctx.db.get(userId);
  if (!user || user.firebaseUid !== identity.subject) throw new Error("Forbidden");
  if (businessId) {
    const business = await ctx.db.get(businessId);
    if (!business || business.userId !== userId) throw new Error("Forbidden");
  }
  return user;
}

export const getByBusiness = query({
  args: { businessId: v.id("businesses") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const business = await ctx.db.get(args.businessId);
    let owner;
    try { owner = (await requireBusinessAccess(ctx, business, "read")).owner; } catch { return []; }
    const runs = await ctx.db
      .query("payrollRuns")
      .withIndex("by_business", (q) => q.eq("businessId", args.businessId))
      .order("desc")
      .collect();
    return runs.filter(run => historyAccessible(owner, run.createdAt));
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
    // Enforce free-plan limit BEFORE inserting; throws FREE_LIMIT_REACHED:payroll
    // which the UI translates into an upgrade prompt.
    const user = await requirePayrollOwner(ctx, args.userId, args.businessId);
    await assertWithinLimit(ctx, user, "payroll");
    await assertWithinLimit(ctx, user, "payslip", args.employeesSnapshot.length);
    await validatePayrollSnapshot(ctx, args.businessId, args.employeesSnapshot);

    const runId = await ctx.db.insert("payrollRuns", {
      ...args,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    // Increment usage idempotently on the run id — a retried mutation with a
    // fresh runId would count twice, but rerunning the same insert isn't
    // possible (Convex assigns a new id per insert). This still deduplicates
    // if any orchestration layer replays the increment step.
    await incrementUsageIdempotent(ctx, args.userId, "payroll", `payroll:${runId}`);
    await incrementUsageIdempotent(ctx, args.userId, "payslip", `payslips:${runId}`, args.employeesSnapshot.length);
    return runId;
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
    if (!before) throw new Error("Payroll run not found");
    const owner = await requirePayrollOwner(ctx, before.userId, before.businessId);
    if (fields.employeesSnapshot) {
      await validatePayrollSnapshot(ctx, before.businessId, fields.employeesSnapshot);
      const oldIds = new Set(before.employeesSnapshot.map((row: any) => row._id));
      const added = fields.employeesSnapshot.filter((row: any) => !oldIds.has(row._id));
      for (const employee of added) await reserveUsage(ctx, owner._id, "payslip", `payslips-added:${runId}:${employee._id}`);
    }
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
        if (business) {
          const period = before.periodLabel || `${before.month} ${before.year}`;
          await createWorkspaceNotification(ctx, {
            businessId: before.businessId,
            category: "payroll",
            type: "payroll_completed",
            title: "Payroll completed",
            message: `${business.name} payroll for ${period} was completed.`,
            actionUrl: `/accountant?tab=Payroll&clientId=${String(before.businessId)}`,
            dedupeKey: `payroll-completed:${String(runId)}`,
            payrollId: runId,
            metadata: { employeeCount: before.employeesSnapshot?.length ?? 0, period },
            channels: ["in_app"],
          });
        }
      }
    }
  },
});

export async function validatePayrollSnapshot(ctx: any, businessId: any, rows: any[]) {
  if (!rows.length || rows.length > 2500) throw new Error("Choose 1 to 2,500 employees for payroll.");
  const seen = new Set<string>();
  for (const row of rows) {
    const id = ctx.db.normalizeId("employees", String(row._id || ''));
    const employee = id ? await ctx.db.get(id) : null;
    if (!employee || employee.businessId !== businessId || seen.has(String(id))) throw new Error("Payroll employees must be unique and belong to this client.");
    seen.add(String(id));
  }
}
