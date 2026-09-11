import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

async function currentUser(ctx: any) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Unauthorized");
  const user = await ctx.db
    .query("users")
    .withIndex("by_firebase_uid", (q: any) => q.eq("firebaseUid", identity.subject))
    .first();
  if (!user) throw new Error("Unauthorized");
  return user;
}

async function ownedBusiness(ctx: any, businessId: any) {
  const user = await currentUser(ctx);
  const business = await ctx.db.get(businessId);
  if (!business || business.userId !== user._id) throw new Error("Forbidden");
  return { user, business };
}

async function ownedBatch(ctx: any, batchId: any) {
  const user = await currentUser(ctx);
  const batch = await ctx.db.get(batchId);
  if (!batch || batch.userId !== user._id) throw new Error("Forbidden");
  return { user, batch };
}

const batchEmployee = v.object({
  employeeId: v.optional(v.id("employees")),
  employeeKey: v.string(),
  employeeSnapshot: v.any(),
  payrollData: v.any(),
  confidence: v.optional(v.any()),
  issues: v.array(v.string()),
  status: v.string(),
});

export const createOrResume = mutation({
  args: {
    businessId: v.id("businesses"),
    idempotencyKey: v.string(),
    source: v.string(),
    sourcePayrollRunId: v.optional(v.id("payrollRuns")),
    payPeriodStart: v.string(),
    payPeriodEnd: v.string(),
    payDate: v.string(),
    selectedTemplateId: v.optional(v.string()),
    employees: v.array(batchEmployee),
  },
  handler: async (ctx, args) => {
    const { user } = await ownedBusiness(ctx, args.businessId);
    const existing = await ctx.db
      .query("payrollBatches")
      .withIndex("by_idempotency", (q: any) => q.eq("idempotencyKey", args.idempotencyKey))
      .first();
    if (existing) {
      if (existing.userId !== user._id) throw new Error("Forbidden");
      return { batchId: existing._id, duplicate: true };
    }
    const duplicatePeriod = await ctx.db
      .query("payrollBatches")
      .withIndex("by_business_period", (q: any) =>
        q.eq("businessId", args.businessId)
          .eq("payPeriodStart", args.payPeriodStart)
          .eq("payPeriodEnd", args.payPeriodEnd)
      )
      .filter((q: any) => q.neq(q.field("status"), "deleted"))
      .first();
    if (duplicatePeriod) return { batchId: duplicatePeriod._id, duplicate: true };
    const now = Date.now();
    const readyCount = args.employees.filter((x) => x.status === "ready").length;
    const batchId = await ctx.db.insert("payrollBatches", {
      businessId: args.businessId,
      userId: user._id,
      idempotencyKey: args.idempotencyKey,
      source: args.source,
      sourcePayrollRunId: args.sourcePayrollRunId,
      payPeriodStart: args.payPeriodStart,
      payPeriodEnd: args.payPeriodEnd,
      payDate: args.payDate,
      status: "draft",
      employeeCount: args.employees.length,
      readyCount,
      issueCount: args.employees.length - readyCount,
      generatedCount: 0,
      failedCount: 0,
      selectedTemplateId: args.selectedTemplateId,
      createdAt: now,
      updatedAt: now,
    });
    for (const row of args.employees) {
      if (row.employeeId) {
        const employee = await ctx.db.get(row.employeeId);
        if (!employee || employee.businessId !== args.businessId) throw new Error("Invalid employee");
      }
      await ctx.db.insert("payrollBatchEmployees", {
        batchId,
        businessId: args.businessId,
        ...row,
        updatedAt: now,
      });
    }
    await ctx.db.insert("payrollAuditEvents", {
      batchId, businessId: args.businessId, userId: user._id,
      action: "payroll_imported", count: args.employees.length, createdAt: now,
    });
    return { batchId, duplicate: false };
  },
});

export const get = query({
  args: { batchId: v.id("payrollBatches") },
  handler: async (ctx, args) => {
    const { batch } = await ownedBatch(ctx, args.batchId);
    const employees = await ctx.db.query("payrollBatchEmployees")
      .withIndex("by_batch", (q: any) => q.eq("batchId", args.batchId)).collect();
    const deliveries = await ctx.db.query("payslipDeliveries")
      .withIndex("by_batch", (q: any) => q.eq("batchId", args.batchId)).collect();
    return { batch, employees, deliveries };
  },
});

export const list = query({
  args: { businessId: v.id("businesses"), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await ownedBusiness(ctx, args.businessId);
    return ctx.db.query("payrollBatches")
      .withIndex("by_business", (q: any) => q.eq("businessId", args.businessId))
      .order("desc").take(Math.min(args.limit ?? 30, 100));
  },
});

export const saveDraft = mutation({
  args: { batchId: v.id("payrollBatches"), payload: v.any() },
  handler: async (ctx, args) => {
    const { user, batch } = await ownedBatch(ctx, args.batchId);
    const existing = await ctx.db.query("payrollDrafts")
      .withIndex("by_batch", (q: any) => q.eq("batchId", args.batchId)).first();
    const now = Date.now();
    if (existing) await ctx.db.patch(existing._id, { payload: args.payload, updatedAt: now });
    else await ctx.db.insert("payrollDrafts", {
      batchId: batch._id, businessId: batch.businessId, userId: user._id,
      payload: args.payload, updatedAt: now,
    });
    await ctx.db.patch(batch._id, { updatedAt: now });
    return { updatedAt: now };
  },
});

export const updateEmployees = mutation({
  args: {
    batchId: v.id("payrollBatches"),
    updates: v.array(v.object({
      employeeKey: v.string(), payrollData: v.optional(v.any()),
      confidence: v.optional(v.any()), issues: v.optional(v.array(v.string())),
      status: v.optional(v.string()), payslipId: v.optional(v.string()),
      generationError: v.optional(v.string()),
    })),
  },
  handler: async (ctx, args) => {
    const { user, batch } = await ownedBatch(ctx, args.batchId);
    const rows = await ctx.db.query("payrollBatchEmployees")
      .withIndex("by_batch", (q: any) => q.eq("batchId", args.batchId)).collect();
    const map = new Map(rows.map((row: any) => [row.employeeKey, row]));
    const now = Date.now();
    for (const update of args.updates) {
      const row: any = map.get(update.employeeKey);
      if (!row) continue;
      const { employeeKey: _employeeKey, ...fields } = update;
      await ctx.db.patch(row._id, { ...fields, updatedAt: now });
    }
    const next = rows.map((row: any) => ({ ...row, ...(args.updates.find(x => x.employeeKey === row.employeeKey) || {}) }));
    await ctx.db.patch(batch._id, {
      readyCount: next.filter((x: any) => x.status === "ready" || x.status === "generated").length,
      issueCount: next.filter((x: any) => x.status === "needs_review" || x.status === "failed").length,
      generatedCount: next.filter((x: any) => x.status === "generated").length,
      failedCount: next.filter((x: any) => x.status === "failed").length,
      updatedAt: now,
    });
    await ctx.db.insert("payrollAuditEvents", {
      batchId: batch._id, businessId: batch.businessId, userId: user._id,
      action: "payroll_edited", count: args.updates.length, createdAt: now,
    });
    return { updated: args.updates.length };
  },
});

export const complete = mutation({
  args: { batchId: v.id("payrollBatches") },
  handler: async (ctx, args) => {
    const { user, batch } = await ownedBatch(ctx, args.batchId);
    if (batch.completedAt) return { completedAt: batch.completedAt, duplicate: true };
    const now = Date.now();
    await ctx.db.patch(batch._id, { status: "completed", completedAt: now, updatedAt: now });
    await ctx.db.insert("payrollAuditEvents", {
      batchId: batch._id, businessId: batch.businessId, userId: user._id,
      action: "payroll_completed", count: batch.employeeCount, createdAt: now,
    });
    return { completedAt: now, duplicate: false };
  },
});
