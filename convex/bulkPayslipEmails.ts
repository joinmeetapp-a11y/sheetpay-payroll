"use node";

import { action } from "./_generated/server";
import { anyApi } from "convex/server";
import { v } from "convex/values";
import { sendEmail } from "./lib/email";

const internal = anyApi as any;

const emailItem = v.object({
  employeeKey: v.string(),
  payslipId: v.string(),
  filename: v.string(),
  intentionalResend: v.optional(v.boolean()),
});

export const sendBatch = action({
  args: { batchId: v.id("payrollBatches"), items: v.array(emailItem) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    if (args.items.length > 50) throw new Error("Send at most 50 payslips per batch request");
    const context: any = await ctx.runQuery(internal.bulkPayrollInternal.getEmailContext, {
      firebaseUid: identity.subject, batchId: args.batchId,
    });
    const rowMap = new Map(context.rows.map((row: any) => [row.employeeKey, row]));
    const results: any[] = [];
    for (const item of args.items) {
      const row: any = rowMap.get(item.employeeKey);
      if (!row || row.payslipId !== item.payslipId) {
        results.push({ employeeKey: item.employeeKey, status: "failed", error: "Payslip does not match employee" });
        continue;
      }
      const employee = row.employeeSnapshot;
      const to = String(employee?.email || row.employeeSnapshot?.email || "").trim();
      if (!to) {
        results.push({ employeeKey: item.employeeKey, status: "skipped", error: "Email missing" });
        continue;
      }
      if (!row.payslipStorageId || !row.payslipUrl) {
        results.push({ employeeKey: item.employeeKey, status: "failed", error: "Payslip PDF is not stored" });
        continue;
      }
      const pdfResponse = await fetch(row.payslipUrl);
      if (!pdfResponse.ok) {
        results.push({ employeeKey: item.employeeKey, status: "failed", error: "Stored payslip could not be read" });
        continue;
      }
      const pdfBase64 = Buffer.from(await pdfResponse.arrayBuffer()).toString("base64");
      const attempt = item.intentionalResend ? Date.now() : 1;
      const idempotencyKey = `bulk-payslip:${args.batchId}:${item.payslipId}:${attempt}`;
      const result = await sendEmail(ctx, {
        to, emailType: "payslipReady",
        data: {
          employeeName: employee?.name || "Employee",
          period: `${context.batch.payPeriodStart} to ${context.batch.payPeriodEnd}`,
          businessName: context.business.name,
        },
        attachments: [{ filename: item.filename, content: pdfBase64, contentType: "application/pdf" }],
        idempotencyKey, userId: String(context.user._id), businessId: String(context.business._id),
        relatedEntityId: item.payslipId,
      });
      await ctx.runMutation(internal.bulkPayrollInternal.recordDelivery, {
        batchId: args.batchId, businessId: context.business._id,
        employeeId: row.employeeId, employeeKey: item.employeeKey, payslipId: item.payslipId,
        payslipStorageId: row.payslipStorageId, attempt, idempotencyKey, recipient: to,
        status: result.status === "duplicate" ? "sent" : result.status,
        resendMessageId: result.messageId, errorMessage: result.error,
      });
      results.push({ employeeKey: item.employeeKey, status: result.status, error: result.error });
    }
    const sent = results.filter((x) => x.status === "sent" || x.status === "duplicate").length;
    await ctx.runMutation(internal.bulkPayrollInternal.recordEmailAudit, {
      batchId: args.batchId, businessId: context.business._id, userId: context.user._id,
      action: "payslips_emailed", count: sent,
    });
    return {
      sent, failed: results.filter((x) => x.status === "failed").length,
      skipped: results.filter((x) => x.status === "skipped").length, results,
    };
  },
});
