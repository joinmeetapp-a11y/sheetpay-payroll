import { action, internalMutation, mutation, query } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { internal as _internal } from "./_generated/api";
import { requireBusinessAccess, recordAccountantActivity } from "./lib/accountantAccess";
import { createWorkspaceNotification } from "./notifications";

const internal = _internal as any;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const safeFilePart = (value: string) => value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 70) || "Sheetpay";
const acceptedStatuses = ["sent", "delivered", "delayed", "bounced", "complained"];
const periodOf = (run: any) => run.periodLabel || `${run.month} ${run.year}`;

async function requireRun(ctx: any, businessId: any, payrollRunId: any, capability: "read" | "sendPayslips") {
  const business = await ctx.db.get(businessId);
  const access = await requireBusinessAccess(ctx, business, capability);
  const run = await ctx.db.get(payrollRunId);
  if (!run || run.businessId !== businessId || run.userId !== access.owner._id) throw new ConvexError("Payroll run is outside the selected client.");
  return { business, run, ...access };
}

function snapshotRow(run: any, employeeId: any) {
  return (run.employeesSnapshot || []).find((row: any) => String(row._id || "") === String(employeeId));
}

function ready(row: any) {
  return !!row?.name && Number.isFinite(Number(row.grossPay ?? row.basicPay)) && Number(row.grossPay ?? row.basicPay) > 0 &&
    [row.netPay, row.paye, row.nis, row.healthSurcharge, row.otherDeductions].every((value) => value == null || Number.isFinite(Number(value)));
}

async function priorRecipients(ctx: any, runId: any, employeeId: any) {
  return ctx.db.query("bulkEmailRecipients").withIndex("by_run_employee", (q: any) => q.eq("payrollRunId", runId).eq("employeeId", employeeId)).collect();
}

export const reviewRun = query({
  args: { businessId: v.id("businesses"), payrollRunId: v.id("payrollRuns") },
  handler: async (ctx, args) => {
    const { run, business } = await requireRun(ctx, args.businessId, args.payrollRunId, "read");
    let canSend = true;
    try { await requireBusinessAccess(ctx, business, "sendPayslips"); } catch { canSend = false; }
    const seen = new Set<string>();
    const rows: any[] = [];
    for (const row of run.employeesSnapshot || []) {
      const id = ctx.db.normalizeId("employees", String(row._id || ""));
      if (id && seen.has(String(id))) continue;
      if (id) seen.add(String(id));
      const employee = id ? await ctx.db.get(id) : null;
      const validEmployee = employee?.businessId === args.businessId;
      const email = validEmployee ? String(employee.email || "").trim().toLowerCase() : "";
      const previous = id ? await priorRecipients(ctx, run._id, id) : [];
      const accepted = previous.some((item: any) => acceptedStatuses.includes(item.status));
      const pending = previous.some((item: any) => ["queued", "sending"].includes(item.status));
      const failed = previous.some((item: any) => item.status === "failed");
      rows.push({ employeeId: id, name: row.name || "Unknown employee", email,
        status: !validEmployee || !ready(row) ? "not_ready" : !emailPattern.test(email) ? "missing_email" : accepted ? "already_sent" : pending ? "pending" : failed ? "failed" : "ready" });
    }
    return { canSend, periodLabel: periodOf(run), rows };
  },
});

// PDF bytes cross the authenticated action boundary, never a public file URL.
// Only this action can register storage IDs, so another tenant's storage ID
// cannot be substituted by a browser request.
export const authorizeUpload = internalMutation({
  args: { businessId: v.id("businesses"), payrollRunId: v.id("payrollRuns"), employeeId: v.id("employees"), payrollRunUpdatedAt: v.number() },
  handler: async (ctx, args) => {
    const access = await requireRun(ctx, args.businessId, args.payrollRunId, "sendPayslips");
    if (access.run.updatedAt !== args.payrollRunUpdatedAt) throw new ConvexError("Payroll run changed. Refresh the preview and generate the attachment again.");
    const employee = await ctx.db.get(args.employeeId);
    if (!employee || employee.businessId !== args.businessId || !ready(snapshotRow(access.run, args.employeeId))) throw new ConvexError("Employee payslip is not ready in this payroll run.");
    return { ownerId: access.owner._id, actorId: access.actor._id };
  },
});

export const registerPrivateUpload = internalMutation({
  args: { businessId: v.id("businesses"), payrollRunId: v.id("payrollRuns"), employeeId: v.id("employees"), storageId: v.id("_storage"), payrollRunUpdatedAt: v.number() },
  handler: async (ctx, args) => {
    const { owner, actor, run } = await requireRun(ctx, args.businessId, args.payrollRunId, "sendPayslips");
    if (run.updatedAt !== args.payrollRunUpdatedAt) throw new ConvexError("Payroll run changed. Generate the attachment again.");
    const employee = await ctx.db.get(args.employeeId);
    if (employee?.businessId !== args.businessId || !ready(snapshotRow(run, args.employeeId))) throw new ConvexError("Employee is outside this payroll run.");
    const now = Date.now();
    return ctx.db.insert("bulkPayslipUploads", { workspaceOwnerId: owner._id, uploadedByUserId: actor._id,
      ...args, status: "ready", createdAt: now, expiresAt: now + 7 * 24 * 60 * 60 * 1000 });
  },
});

export const storePayslip = action({
  args: { businessId: v.id("businesses"), payrollRunId: v.id("payrollRuns"), employeeId: v.id("employees"), payrollRunUpdatedAt: v.number(), pdf: v.bytes() },
  handler: async (ctx, { pdf, ...args }): Promise<any> => {
    await ctx.runMutation(internal.bulkPayslipEmail.authorizeUpload, args);
    const bytes = new Uint8Array(pdf);
    if (bytes.length < 8 || bytes.length > 5 * 1024 * 1024 || new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-") throw new ConvexError("Generate a valid PDF under 5 MB before sending.");
    const storageId = await ctx.storage.store(new Blob([pdf], { type: "application/pdf" }));
    try { return await ctx.runMutation(internal.bulkPayslipEmail.registerPrivateUpload, { ...args, storageId }); }
    catch (error) { await ctx.storage.delete(storageId); throw error; }
  },
});

export const createBulkEmailJob = mutation({
  args: {
    businessId: v.id("businesses"), payrollRunId: v.id("payrollRuns"), employeeIds: v.array(v.id("employees")),
    uploadIds: v.array(v.id("bulkPayslipUploads")), subject: v.string(), message: v.string(),
    replyTo: v.optional(v.string()), idempotencyKey: v.string(),
  },
  handler: async (ctx, args) => {
    const { actor, owner, business, run } = await requireRun(ctx, args.businessId, args.payrollRunId, "sendPayslips");
    if (!args.employeeIds.length || args.employeeIds.length > 100 || args.uploadIds.length !== args.employeeIds.length) throw new ConvexError("Send 1 to 100 matching payslips per batch.");
    const subject = args.subject.trim();
    const message = args.message.trim();
    const replyTo = args.replyTo?.trim().toLowerCase();
    if (!subject || subject.length > 180 || /[\r\n]/.test(subject) || message.length > 2000) throw new ConvexError("Check the email subject and message length.");
    if (replyTo && !emailPattern.test(replyTo)) throw new ConvexError("Enter a valid reply-to email address.");
    if (!args.idempotencyKey || args.idempotencyKey.length > 180) throw new ConvexError("Invalid send request.");
    const key = `${args.businessId}:${args.payrollRunId}:${args.idempotencyKey}`;
    const duplicate = await ctx.db.query("bulkEmailJobs").withIndex("by_idempotency", (q) => q.eq("idempotencyKey", key)).first();
    if (duplicate) return { jobId: duplicate._id, status: duplicate.status, duplicate: true };
    if (new Set(args.employeeIds).size !== args.employeeIds.length || new Set(args.uploadIds).size !== args.uploadIds.length) throw new ConvexError("Remove duplicate employees or attachments.");
    const recipients: any[] = [];
    for (let i = 0; i < args.employeeIds.length; i++) {
      const employeeId = args.employeeIds[i];
      const employee = await ctx.db.get(employeeId);
      const snapshot = snapshotRow(run, employeeId);
      if (!employee || employee.businessId !== args.businessId || !ready(snapshot) || !emailPattern.test(String(employee.email || "").trim())) throw new ConvexError("Every recipient needs a ready payslip and a valid employee email in this payroll run.");
      const upload = await ctx.db.get(args.uploadIds[i]);
      if (!upload || upload.businessId !== args.businessId || upload.payrollRunId !== args.payrollRunId || upload.employeeId !== employeeId || upload.workspaceOwnerId !== owner._id || upload.uploadedByUserId !== actor._id || upload.payrollRunUpdatedAt !== run.updatedAt || upload.expiresAt <= Date.now()) throw new ConvexError("PDF attachment does not match this employee and payroll run. Generate it again.");
      const previous = await priorRecipients(ctx, run._id, employeeId);
      if (previous.length) throw new ConvexError(`${employee.name}'s payslip was already queued. Use Retry Failed for failed emails.`);
      const metadata = await ctx.db.system.get(upload.storageId);
      if (!metadata || metadata.contentType !== "application/pdf" || metadata.size > 5 * 1024 * 1024) throw new ConvexError("Payslip attachment is no longer available. Generate it again.");
      recipients.push({ employee, upload, snapshot });
    }
    const now = Date.now();
    const jobId = await ctx.db.insert("bulkEmailJobs", { workspaceOwnerId: owner._id, requestedByUserId: actor._id,
      businessId: args.businessId, payrollRunId: args.payrollRunId, status: "queued", subject, message, replyTo,
      employeeCount: recipients.length, sentCount: 0, failedCount: 0, idempotencyKey: key, createdAt: now, updatedAt: now });
    for (const { employee, upload, snapshot } of recipients) {
      await ctx.db.insert("bulkEmailRecipients", { jobId, workspaceOwnerId: owner._id, businessId: args.businessId,
        payrollRunId: run._id, employeeId: employee._id, employeeName: snapshot.name,
        recipient: employee.email.trim().toLowerCase(), storageId: upload.storageId,
        businessName: business.name, periodLabel: periodOf(run),
        fromEmail: process.env.RESEND_FROM_EMAIL || "Sheetpay <notifications@sheetpay.app>",
        replyToEmail: replyTo || process.env.RESEND_REPLY_TO || "support@sheetpay.app",
        filename: `${safeFilePart(business.name)}_${safeFilePart(snapshot.name)}_${safeFilePart(periodOf(run))}.pdf`,
        status: "queued", attemptCount: 0, idempotencyKey: `payslip:${run._id}:${employee._id}`, createdAt: now });
      await ctx.db.patch(upload._id, { status: "queued" });
    }
    await recordAccountantActivity(ctx, owner._id, actor._id, "payslips.queued", args.businessId, { payrollRunId: String(run._id), count: recipients.length });
    await ctx.scheduler.runAfter(0, internal.bulkPayslipEmailWorker.processJob, { jobId });
    return { jobId, status: "queued", duplicate: false };
  },
});

export const getEmailJobs = query({
  args: { businessId: v.id("businesses"), payrollRunId: v.optional(v.id("payrollRuns")), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requireBusinessAccess(ctx, await ctx.db.get(args.businessId), "read");
    if (args.payrollRunId) await requireRun(ctx, args.businessId, args.payrollRunId, "read");
    const jobQuery = args.payrollRunId
      ? ctx.db.query("bulkEmailJobs").withIndex("by_run", (q) => q.eq("payrollRunId", args.payrollRunId!))
      : ctx.db.query("bulkEmailJobs").withIndex("by_business", (q) => q.eq("businessId", args.businessId));
    const jobs = await jobQuery.order("desc").take(Math.max(1, Math.min(100, args.limit ?? 30)));
    return Promise.all(jobs.map(async (job) => ({ ...job,
      recipients: (await ctx.db.query("bulkEmailRecipients").withIndex("by_job", (q) => q.eq("jobId", job._id)).collect())
        .map(({ _id, employeeId, employeeName, recipient, status, errorMessage, resendMessageId, outcomeUnknown, createdAt }) =>
          ({ _id, employeeId, employeeName, recipient, status, errorMessage, resendMessageId, outcomeUnknown, createdAt })),
    })));
  },
});

export const retryFailed = mutation({
  args: { jobId: v.id("bulkEmailJobs"), idempotencyKey: v.string() },
  handler: async (ctx, args) => {
    const prior = await ctx.db.get(args.jobId);
    if (!prior) throw new ConvexError("Send job not found.");
    const { actor, owner } = await requireRun(ctx, prior.businessId, prior.payrollRunId, "sendPayslips");
    if (!args.idempotencyKey || args.idempotencyKey.length > 180) throw new ConvexError("Invalid retry request.");
    const key = `retry:${prior._id}:${args.idempotencyKey}`;
    const duplicate = await ctx.db.query("bulkEmailJobs").withIndex("by_idempotency", (q) => q.eq("idempotencyKey", key)).first();
    if (duplicate) return { jobId: duplicate._id, duplicate: true };
    const previousRows = await ctx.db.query("bulkEmailRecipients").withIndex("by_job", (q) => q.eq("jobId", prior._id)).collect();
    const failedRows = previousRows.filter((row) => row.status === "failed");
    if (!failedRows.length) throw new ConvexError("There are no failed payslips to retry.");
    const now = Date.now();
    for (const item of failedRows) {
      const other = await priorRecipients(ctx, prior.payrollRunId, item.employeeId);
      if (other.some((row: any) => row._id !== item._id && [...acceptedStatuses, "queued", "sending"].includes(row.status))) throw new ConvexError("This employee's payslip was already sent or queued for retry.");
      if (item.outcomeUnknown && now - item.createdAt >= 23 * 60 * 60 * 1000) throw new ConvexError("The provider did not confirm this email. Check Resend delivery logs before resending; its duplicate protection window has expired.");
      if (!await ctx.db.system.get(item.storageId)) throw new ConvexError("PDF attachment is no longer available.");
    }
    const jobId = await ctx.db.insert("bulkEmailJobs", { workspaceOwnerId: owner._id, requestedByUserId: actor._id,
      businessId: prior.businessId, payrollRunId: prior.payrollRunId, status: "queued", subject: prior.subject,
      message: prior.message, replyTo: prior.replyTo, employeeCount: failedRows.length, sentCount: 0, failedCount: 0,
      idempotencyKey: key, createdAt: now, updatedAt: now });
    for (const item of failedRows) {
      const { _id, _creationTime, ...fields } = item;
      await ctx.db.insert("bulkEmailRecipients", { ...fields, jobId, status: "queued", sendingAt: undefined, errorMessage: undefined });
      await ctx.db.patch(item._id, { status: "retry_queued" });
    }
    await ctx.scheduler.runAfter(0, internal.bulkPayslipEmailWorker.processJob, { jobId });
    return { jobId, duplicate: false };
  },
});

export const takeQueued = internalMutation({
  args: { jobId: v.id("bulkEmailJobs") },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job || job.finishedAt) return null;
    const rows = await ctx.db.query("bulkEmailRecipients").withIndex("by_job", (q) => q.eq("jobId", job._id)).collect();
    const sending = rows.find((row) => row.status === "sending");
    if (sending) {
      if (Date.now() - (sending.sendingAt || 0) < 60000) return null;
      await ctx.db.patch(sending._id, { status: "failed", outcomeUnknown: true, errorMessage: "Email request interrupted. Retry Failed will check the same provider request without duplicating it." });
    }
    const recipient = rows.find((row) => row.status === "queued");
    if (recipient) {
      await ctx.db.patch(recipient._id, { status: "sending", sendingAt: Date.now(), attemptCount: recipient.attemptCount + 1 });
      await ctx.db.patch(job._id, { status: "sending", updatedAt: Date.now() });
      // Watchdog recovers a crashed action; the claim prevents duplicate workers.
      await ctx.scheduler.runAfter(61000, internal.bulkPayslipEmailWorker.processJob, { jobId: job._id });
    }
    return { job, recipient };
  },
});

export const updateRecipient = internalMutation({
  args: { recipientId: v.id("bulkEmailRecipients"), status: v.string(), resendMessageId: v.optional(v.string()), errorMessage: v.optional(v.string()), outcomeUnknown: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.recipientId);
    if (!row || acceptedStatuses.includes(row.status)) return;
    if (args.status === "sent" && !args.resendMessageId) throw new ConvexError("Provider confirmation is required.");
    await ctx.db.patch(row._id, { status: args.status, resendMessageId: args.resendMessageId,
      errorMessage: args.errorMessage, outcomeUnknown: args.outcomeUnknown, sentAt: args.status === "sent" ? Date.now() : row.sentAt });
  },
});

export const finishBatch = internalMutation({
  args: { jobId: v.id("bulkEmailJobs") },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job || job.finishedAt) return;
    const rows = await ctx.db.query("bulkEmailRecipients").withIndex("by_job", (q) => q.eq("jobId", job._id)).collect();
    const sentCount = rows.filter((row) => acceptedStatuses.includes(row.status)).length;
    const failedCount = rows.filter((row) => row.status === "failed").length;
    const pending = rows.some((row) => ["queued", "sending"].includes(row.status));
    await ctx.db.patch(job._id, { status: pending ? "sending" : failedCount ? "sent_with_errors" : "sent", sentCount, failedCount, updatedAt: Date.now(), finishedAt: pending ? undefined : Date.now() });
    if (pending) await ctx.scheduler.runAfter(700, internal.bulkPayslipEmailWorker.processJob, { jobId: job._id });
    else await createWorkspaceNotification(ctx, { businessId: job.businessId, category: failedCount ? "failedPayslip" : "payslip",
      type: failedCount ? "payslips_failed" : "payslips_sent", title: failedCount ? "Payslip sending needs review" : "Payslips sent",
      message: `${sentCount} payslips accepted by Resend; ${failedCount} failed.`, actionUrl: `/accountant?tab=Payslips&clientId=${job.businessId}`,
      dedupeKey: `bulk-payslip-result:${job._id}`, payrollId: job.payrollRunId, metadata: { sentCount, failedCount, jobId: String(job._id) }, channels: ["in_app"] });
  },
});

export const updateDeliveryFromWebhook = internalMutation({
  args: { resendMessageId: v.string(), status: v.string(), deliveredAt: v.optional(v.number()), errorMessage: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const rows = await ctx.db.query("bulkEmailRecipients").withIndex("by_resend_message", (q) => q.eq("resendMessageId", args.resendMessageId)).collect();
    for (const row of rows) {
      // Out-of-order sent/delayed events must not erase final delivery outcomes.
      if (["bounced", "complained"].includes(row.status) || (row.status === "delivered" && ["sent", "delayed"].includes(args.status))) continue;
      await ctx.db.patch(row._id, { status: args.status, deliveredAt: args.deliveredAt ?? row.deliveredAt, errorMessage: args.errorMessage ?? row.errorMessage });
    }
  },
});
