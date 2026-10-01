"use node";
import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal as _internal } from "./_generated/api";
import { Buffer } from "node:buffer";

const internal = _internal as any;
const esc = (value: string) => value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char] as string));

export const processJob = internalAction({
  args: { jobId: v.id("bulkEmailJobs") },
  handler: async (ctx, args) => {
    const batch = await ctx.runMutation(internal.bulkPayslipEmail.takeQueued, args) as any;
    if (!batch?.job) return;
    const item = batch.recipient;
    if (!item) { await ctx.runMutation(internal.bulkPayslipEmail.finishBatch, args); return; }
    let unknown = false;
    try {
      const apiKey = process.env.RESEND_API_KEY;
      if (!apiKey) throw new Error("Resend is not configured. Add RESEND_API_KEY to the Accountant Convex deployment.");
      const pdf = await ctx.storage.get(item.storageId);
      if (!pdf) throw new Error("Payslip attachment is no longer available.");
      const bytes = Buffer.from(await pdf.arrayBuffer());
      if (bytes.length > 5 * 1024 * 1024 || bytes.subarray(0, 5).toString() !== "%PDF-") throw new Error("Invalid PDF attachment.");
      const businessName = esc(item.businessName || "Sheetpay Client");
      const firstName = esc(item.employeeName.trim().split(/\s+/)[0] || item.employeeName);
      const message = esc(batch.job.message || "Your payslip is attached. Contact your employer if you have any questions.").replace(/\n/g, "<br>");
      const period = esc(item.periodLabel || "Payroll period");
      const html = `<!doctype html><html><body style="margin:0;background:#f3f8f5;font-family:Arial,sans-serif;color:#24372d"><div style="max-width:560px;margin:28px auto;padding:30px;background:#fff;border:1px solid #e3eee7;border-radius:20px"><div style="font-size:12px;font-weight:700;letter-spacing:.12em;color:#16815f">SHEETPAY</div><h1 style="font-size:23px;margin:16px 0 10px">Your payslip is ready</h1><p>Hello ${firstName},</p><p>${message}</p><div style="padding:14px;border-radius:12px;background:#f3f8f5"><b>${businessName}</b><br><span>Pay period: ${period}</span></div><p style="font-size:12px;color:#718078;margin-top:24px">Sent by your employer using Sheetpay Accountant.</p></div></body></html>`;
      unknown = true;
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST", signal: AbortSignal.timeout(15000),
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "Idempotency-Key": item.idempotencyKey },
        body: JSON.stringify({ from: item.fromEmail || process.env.RESEND_FROM_EMAIL || "Sheetpay <notifications@sheetpay.app>",
          to: [item.recipient], subject: batch.job.subject, html,
          reply_to: item.replyToEmail || batch.job.replyTo || process.env.RESEND_REPLY_TO || "support@sheetpay.app",
          attachments: [{ filename: item.filename, content: bytes.toString("base64"), content_type: "application/pdf" }] }),
      });
      if (!response.ok) {
        unknown = response.status >= 500 || response.status === 409;
        const details = await response.json().catch(() => ({}));
        throw new Error(`Resend returned ${response.status}: ${String(details.message || "Message rejected").slice(0, 240)}`);
      }
      const sent = await response.json();
      if (!sent?.id || typeof sent.id !== "string") throw new Error("Resend did not confirm this email with a message ID.");
      await ctx.runMutation(internal.bulkPayslipEmail.updateRecipient, { recipientId: item._id, status: "sent", resendMessageId: sent.id });
      // A logging failure must never turn an accepted email into a failed send.
      try { await ctx.runMutation(internal.emailLogs.logEmail, { recipient: item.recipient, emailType: "employee_payslip",
        subject: batch.job.subject, status: "sent", resendMessageId: sent.id, userId: String(batch.job.requestedByUserId),
        businessId: String(item.businessId), relatedEntityId: String(item.payrollRunId), idempotencyKey: item.idempotencyKey,
        category: "payslip", attempts: item.attemptCount + 1, sentAt: Date.now() }); } catch { console.error("Payslip sent; email audit log update failed."); }
    } catch (error) {
      const message = String(error instanceof Error ? error.message : "Email request failed.").replace(/[\r\n]+/g, " ").slice(0, 400);
      await ctx.runMutation(internal.bulkPayslipEmail.updateRecipient, { recipientId: item._id, status: "failed", errorMessage: message, outcomeUnknown: unknown });
    }
    await ctx.runMutation(internal.bulkPayslipEmail.finishBatch, args);
  },
});
