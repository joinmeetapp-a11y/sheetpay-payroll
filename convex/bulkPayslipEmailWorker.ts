"use node";
import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal as _internal } from "./_generated/api";
import { Buffer } from "node:buffer";

const internal = _internal as any;

function esc(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char] as string));
}

function errorText(value: unknown) {
  return String(value || "Email provider rejected the message.").replace(/[\r\n]+/g, " ").slice(0, 400);
}

export const processJob = internalAction({
  args: { jobId: v.id("bulkEmailJobs") },
  handler: async (ctx, args) => {
    const batch = await ctx.runMutation(internal.bulkPayslipEmail.takeQueued, { jobId: args.jobId, limit: 10 }) as any;
    if (!batch?.job) return;
    const apiKey = process.env.RESEND_API_KEY;
    for (const item of batch.recipients) {
      try {
        if (!apiKey) throw new Error("Resend is not configured.");
        const pdf = await ctx.storage.get(item.storageId);
        if (!pdf) throw new Error("Payslip PDF expired. Generate a new preview to resend.");
        const bytes = Buffer.from(await pdf.arrayBuffer());
        if (bytes.length > 5 * 1024 * 1024) throw new Error("Payslip PDF exceeds the delivery size limit.");
        const businessName = esc(batch.business?.name || "Sheetpay Client");
        const employeeName = esc(item.employeeName);
        const message = esc(batch.job.message || "Your payslip is attached.").replace(/\n/g, "<br>");
        const period = esc(batch.run?.periodLabel || (batch.run ? batch.run.month + " " + batch.run.year : "Payroll period"));
        const html = `<!doctype html><html><body style="margin:0;background:#f3f8f5;font-family:Arial,sans-serif;color:#24372d"><div style="max-width:560px;margin:28px auto;padding:30px;background:#fff;border:1px solid #e3eee7;border-radius:20px"><div style="font-size:12px;font-weight:700;letter-spacing:.12em;color:#16815f">SHEETPAY</div><h1 style="font-size:23px;margin:16px 0 10px">Your payslip is ready</h1><p>Hello ${employeeName},</p><p>${message}</p><div style="padding:14px;border-radius:12px;background:#f3f8f5"><b>${businessName}</b><br><span>Pay period: ${period}</span></div><p style="font-size:12px;color:#718078;margin-top:24px">This message was sent securely by your employer using Sheetpay Accountant.</p></div></body></html>`;
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: "Bearer " + apiKey,
            "Content-Type": "application/json",
            "Idempotency-Key": item.idempotencyKey,
          },
          body: JSON.stringify({
            from: process.env.RESEND_FROM_EMAIL || "Sheetpay <notifications@sheetpay.app>",
            to: [item.recipient],
            subject: batch.job.subject,
            html,
            reply_to: batch.job.replyTo || process.env.RESEND_REPLY_TO || "support@sheetpay.app",
            attachments: [{ filename: item.filename, content: bytes.toString("base64") }],
          }),
        });
        if (!response.ok) throw new Error("Resend returned " + response.status + ": " + await response.text());
        const sent = await response.json();
        await ctx.runMutation(internal.bulkPayslipEmail.updateRecipient, {
          recipientId: item._id, status: "sent", resendMessageId: sent.id,
        });
        await ctx.runMutation(internal.emailLogs.logEmail, {
          recipient: item.recipient, employeeId: String(item.employeeId), payrollRunId: String(item.payrollRunId),
          jobId: String(item.jobId), emailType: "employee_payslip", subject: batch.job.subject,
          status: "sent", resendMessageId: sent.id, userId: String(batch.job.requestedByUserId),
          businessId: String(item.businessId), clientId: String(item.businessId),
          relatedEntityId: String(item.payrollRunId), idempotencyKey: item.idempotencyKey,
          category: "payslip", attempts: item.attemptCount, sentAt: Date.now(),
        });
      } catch (error) {
        const message = errorText(error);
        await ctx.runMutation(internal.bulkPayslipEmail.updateRecipient, {
          recipientId: item._id, status: "failed", errorMessage: message,
        });
        await ctx.runMutation(internal.emailLogs.logEmail, {
          recipient: item.recipient, employeeId: String(item.employeeId), payrollRunId: String(item.payrollRunId),
          jobId: String(item.jobId), emailType: "employee_payslip", subject: batch.job.subject,
          status: "failed", userId: String(batch.job.requestedByUserId), businessId: String(item.businessId),
          clientId: String(item.businessId), relatedEntityId: String(item.payrollRunId),
          idempotencyKey: item.idempotencyKey, category: "payslip", attempts: item.attemptCount,
          failedReason: message, errorMessage: message,
        });
      }
    }
    await ctx.runMutation(internal.bulkPayslipEmail.finishBatch, { jobId: args.jobId });
  },
});
