import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";

export const getEmailContext = internalQuery({
  args: { firebaseUid: v.string(), batchId: v.id("payrollBatches") },
  handler: async (ctx, args) => {
    const user = await ctx.db.query("users")
      .withIndex("by_firebase_uid", (q) => q.eq("firebaseUid", args.firebaseUid)).first();
    const batch = await ctx.db.get(args.batchId);
    if (!user || !batch || batch.userId !== user._id) throw new Error("Forbidden");
    const business = await ctx.db.get(batch.businessId);
    if (!business) throw new Error("Business not found");
    const rows = await ctx.db.query("payrollBatchEmployees")
      .withIndex("by_batch", (q) => q.eq("batchId", args.batchId)).collect();
    const rowsWithUrls = await Promise.all(rows.map(async (row) => ({
      ...row,
      payslipUrl: row.payslipStorageId ? await ctx.storage.getUrl(row.payslipStorageId) : null,
    })));
    return { user, batch, business, rows: rowsWithUrls };
  },
});

export const recordDelivery = internalMutation({
  args: {
    batchId: v.id("payrollBatches"), businessId: v.id("businesses"),
    employeeId: v.optional(v.id("employees")), employeeKey: v.string(),
    payslipId: v.string(), attempt: v.number(), idempotencyKey: v.string(),
    payslipStorageId: v.id("_storage"),
    recipient: v.string(), status: v.string(), resendMessageId: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("payslipDeliveries")
      .withIndex("by_idempotency", (q) => q.eq("idempotencyKey", args.idempotencyKey)).first();
    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, {
        status: args.status, resendMessageId: args.resendMessageId,
        errorMessage: args.errorMessage, sentAt: args.status === "sent" ? now : existing.sentAt,
        updatedAt: now,
      });
      return existing._id;
    }
    return ctx.db.insert("payslipDeliveries", {
      ...args, sentAt: args.status === "sent" ? now : undefined,
      createdAt: now, updatedAt: now,
    });
  },
});

export const recordEmailAudit = internalMutation({
  args: { batchId: v.id("payrollBatches"), businessId: v.id("businesses"), userId: v.id("users"), action: v.string(), count: v.number() },
  handler: (ctx, args) => ctx.db.insert("payrollAuditEvents", { ...args, createdAt: Date.now() }),
});
