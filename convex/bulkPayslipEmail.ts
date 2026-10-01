import { internalMutation, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { internal as _internal } from "./_generated/api";
import { requireBusinessAccess, recordAccountantActivity } from "./lib/accountantAccess";
import { createWorkspaceNotification } from "./notifications";

const internal = _internal as any;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const safeFilePart = (value: string) => value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 70) || "Sheetpay";

export const generatePayslipUploadUrl = mutation({
  args: { businessId: v.id("businesses"), employeeId: v.id("employees") },
  handler: async (ctx, args) => {
    const business = await ctx.db.get(args.businessId);
    const { owner } = await requireBusinessAccess(ctx, business, "sendPayslips");
    const employee = await ctx.db.get(args.employeeId);
    if (!employee || employee.businessId !== args.businessId) throw new Error("Employee is outside the selected client.");
    const uploadUrl = await ctx.storage.generateUploadUrl();
    return { uploadUrl };
  },
});

export const registerPayslipUpload = mutation({
  args: {
    businessId: v.id("businesses"),
    employeeId: v.id("employees"),
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    const business = await ctx.db.get(args.businessId);
    const { owner } = await requireBusinessAccess(ctx, business, "sendPayslips");
    const employee = await ctx.db.get(args.employeeId);
    if (!employee || employee.businessId !== args.businessId) throw new Error("Employee is outside the selected client.");
    const metadata = await ctx.storage.getMetadata(args.storageId);
    if (!metadata || metadata.contentType !== "application/pdf" || metadata.size > 5 * 1024 * 1024) {
      throw new Error("Upload a valid payslip PDF under 5 MB.");
    }
    const existing = await ctx.db.query("bulkPayslipUploads")
      .withIndex("by_business_employee", (q) => q.eq("businessId", args.businessId).eq("employeeId", args.employeeId))
      .collect();
    const now = Date.now();
    for (const old of existing) {
      if (old.status === "ready" && old.expiresAt > now) await ctx.db.patch(old._id, { status: "superseded" });
    }
    return ctx.db.insert("bulkPayslipUploads", {
      workspaceOwnerId: owner._id, businessId: args.businessId, employeeId: args.employeeId,
      storageId: args.storageId, status: "ready", createdAt: now, expiresAt: now + 7 * 24 * 60 * 60 * 1000,
    });
  },
});

export const createBulkEmailJob = mutation({
  args: {
    businessId: v.id("businesses"),
    payrollRunId: v.id("payrollRuns"),
    employeeIds: v.array(v.id("employees")),
    subject: v.string(),
    message: v.string(),
    replyTo: v.optional(v.string()),
    idempotencyKey: v.string(),
  },
  handler: async (ctx, args) => {
    const business = await ctx.db.get(args.businessId);
    const { actor, owner } = await requireBusinessAccess(ctx, business, "sendPayslips");
    if (!args.employeeIds.length || args.employeeIds.length > 100) throw new Error("Send 1 to 100 payslips per batch.");
    const subject = args.subject.trim();
    const message = args.message.trim();
    if (!subject || subject.length > 180 || message.length > 2000) throw new Error("Check the email subject and message length.");
    const replyTo = args.replyTo?.trim().toLowerCase();
    if (replyTo && !emailPattern.test(replyTo)) throw new Error("Enter a valid reply-to email address.");
    if (!args.idempotencyKey || args.idempotencyKey.length > 180) throw new Error("Invalid send request.");
    const duplicate = await ctx.db.query("bulkEmailJobs")
      .withIndex("by_idempotency", (q) => q.eq("idempotencyKey", args.idempotencyKey)).first();
    if (duplicate) return { jobId: duplicate._id, status: duplicate.status, duplicate: true };

    const run = await ctx.db.get(args.payrollRunId);
    if (!run || run.businessId !== args.businessId || run.userId !== owner._id) throw new Error("Payroll run is outside the selected client.");
    const uniqueIds = Array.from(new Set(args.employeeIds.map(String)));
    if (uniqueIds.length !== args.employeeIds.length) throw new Error("Remove duplicate employees before sending.");
    const eligible = new Set((run.employeesSnapshot || []).map((row: any) => String(row._id || row.employeeId || "")));
    const recipients: any[] = [];
    for (const employeeId of args.employeeIds) {
      const employee = await ctx.db.get(employeeId);
      if (!employee || employee.businessId !== args.businessId || !eligible.has(String(employee._id)) || !employee.email || !emailPattern.test(employee.email.trim())) {
        throw new Error("Every recipient must be a valid employee with an email in this payroll run.");
      }
      const uploads = await ctx.db.query("bulkPayslipUploads")
        .withIndex("by_business_employee", (q) => q.eq("businessId", args.businessId).eq("employeeId", employeeId)).collect();
      const upload = uploads.filter((item) => item.status === "ready" && item.expiresAt > Date.now()).sort((a, b) => b.createdAt - a.createdAt)[0];
      if (!upload) throw new Error("Generate a PDF preview for " + employee.name + " before sending.");
      recipients.push({ employee, upload });
    }

    const now = Date.now();
    const jobId = await ctx.db.insert("bulkEmailJobs", {
      workspaceOwnerId: owner._id, requestedByUserId: actor._id,
      businessId: args.businessId, payrollRunId: args.payrollRunId,
      status: "queued", subject, message, replyTo, employeeCount: recipients.length,
      sentCount: 0, failedCount: 0, idempotencyKey: args.idempotencyKey,
      createdAt: now, updatedAt: now,
    });
    for (const { employee, upload } of recipients) {
      await ctx.db.insert("bulkEmailRecipients", {
        jobId, workspaceOwnerId: owner._id, businessId: args.businessId,
        payrollRunId: args.payrollRunId, employeeId: employee._id, employeeName: employee.name,
        recipient: employee.email.trim().toLowerCase(), storageId: upload.storageId,
        filename: safeFilePart(business.name) + "_" + safeFilePart(employee.name) + "_" + safeFilePart(run.periodLabel || (run.month + " " + run.year)) + ".pdf",
        status: "queued", attemptCount: 0,
        idempotencyKey: "payslip:" + String(args.payrollRunId) + ":" + String(employee._id) + ":" + args.idempotencyKey,
        createdAt: now,
      });
      await ctx.db.patch(upload._id, { status: "queued" });
    }
    await recordAccountantActivity(ctx, owner._id, actor._id, "payslips.queued", args.businessId, { payrollRunId: String(args.payrollRunId), count: recipients.length });
    await ctx.scheduler.runAfter(0, internal.bulkPayslipEmailWorker.processJob, { jobId });
    return { jobId, status: "queued", duplicate: false };
  },
});

export const getEmailJobs = query({
  args: { businessId: v.id("businesses"), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const business = await ctx.db.get(args.businessId);
    const { owner } = await requireBusinessAccess(ctx, business, "read");
    const jobs = await ctx.db.query("bulkEmailJobs")
      .withIndex("by_business", (q) => q.eq("businessId", args.businessId))
      .order("desc").take(Math.max(1, Math.min(30, args.limit ?? 10)));
    return Promise.all(jobs.map(async (job) => ({
      ...job,
      recipients: (await ctx.db.query("bulkEmailRecipients").withIndex("by_job", (q) => q.eq("jobId", job._id)).collect())
        .map((recipient) => ({ ...recipient })),
      ownerId: owner._id,
    })));
  },
});

export const retryFailed = mutation({
  args: { jobId: v.id("bulkEmailJobs"), idempotencyKey: v.string() },
  handler: async (ctx, args) => {
    const prior = await ctx.db.get(args.jobId);
    if (!prior) throw new Error("Send job not found.");
    const business = await ctx.db.get(prior.businessId);
    const { actor, owner } = await requireBusinessAccess(ctx, business, "sendPayslips");
    const previousRows = await ctx.db.query("bulkEmailRecipients").withIndex("by_job", (q) => q.eq("jobId", prior._id)).collect();
    const failedRows = previousRows.filter((recipient) => recipient.status === "failed");
    if (!failedRows.length) throw new Error("There are no failed payslips to retry.");
    const duplicate = await ctx.db.query("bulkEmailJobs").withIndex("by_idempotency", (q) => q.eq("idempotencyKey", args.idempotencyKey)).first();
    if (duplicate) return { jobId: duplicate._id, duplicate: true };
    const now = Date.now();
    const retryJobId = await ctx.db.insert("bulkEmailJobs", {
      workspaceOwnerId: owner._id, requestedByUserId: actor._id, businessId: prior.businessId,
      payrollRunId: prior.payrollRunId, status: "queued", subject: prior.subject,
      message: prior.message, replyTo: prior.replyTo, employeeCount: failedRows.length,
      sentCount: 0, failedCount: 0, idempotencyKey: args.idempotencyKey, createdAt: now, updatedAt: now,
    });
    for (const item of failedRows) {
      await ctx.db.insert("bulkEmailRecipients", {
        jobId: retryJobId, workspaceOwnerId: owner._id, businessId: prior.businessId,
        payrollRunId: prior.payrollRunId, employeeId: item.employeeId, employeeName: item.employeeName,
        recipient: item.recipient, storageId: item.storageId, filename: item.filename, status: "queued",
        attemptCount: item.attemptCount, idempotencyKey: item.idempotencyKey, createdAt: now,
      });
      await ctx.db.patch(item._id, { status: "retry_queued" });
    }
    await ctx.scheduler.runAfter(0, internal.bulkPayslipEmailWorker.processJob, { jobId: retryJobId });
    return { jobId: retryJobId, duplicate: false };
  },
});

export const takeQueued = internalMutation({
  args: { jobId: v.id("bulkEmailJobs"), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) return null;
    const recipients = await ctx.db.query("bulkEmailRecipients").withIndex("by_job", (q) => q.eq("jobId", args.jobId)).collect();
    const queued = recipients.filter((row) => row.status === "queued").slice(0, Math.min(10, args.limit ?? 10));
    const business = await ctx.db.get(job.businessId);
    const run = await ctx.db.get(job.payrollRunId);
    for (const row of queued) await ctx.db.patch(row._id, { status: "sending", attemptCount: row.attemptCount + 1 });
    if (queued.length && job.status === "queued") await ctx.db.patch(job._id, { status: "sending", updatedAt: Date.now() });
    return { job, recipients: queued, business, run };
  },
});

export const updateRecipient = internalMutation({
  args: {
    recipientId: v.id("bulkEmailRecipients"),
    status: v.string(),
    resendMessageId: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.recipientId);
    if (!row) return;
    await ctx.db.patch(row._id, {
      status: args.status, resendMessageId: args.resendMessageId,
      errorMessage: args.errorMessage, sentAt: args.status === "sent" ? Date.now() : row.sentAt,
    });
    return row;
  },
});

export const finishBatch = internalMutation({
  args: { jobId: v.id("bulkEmailJobs") },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) return;
    const recipients = await ctx.db.query("bulkEmailRecipients").withIndex("by_job", (q) => q.eq("jobId", args.jobId)).collect();
    const sentCount = recipients.filter((row) => ["sent", "delivered"].includes(row.status)).length;
    const failedCount = recipients.filter((row) => ["failed", "bounced", "complained"].includes(row.status)).length;
    const pending = recipients.some((row) => ["queued", "sending"].includes(row.status));
    const status = pending ? "sending" : failedCount ? (sentCount ? "sent_with_errors" : "failed") : "sent";
    await ctx.db.patch(job._id, {
      status, sentCount, failedCount, updatedAt: Date.now(),
      finishedAt: pending ? undefined : Date.now(),
    });
    if (pending) {
      await ctx.scheduler.runAfter(0, internal.bulkPayslipEmailWorker.processJob, { jobId: args.jobId });
    } else {
      const business = await ctx.db.get(job.businessId);
      if (business) {
        const label = failedCount ? `${sentCount} payslips sent successfully; ${failedCount} need attention.` : `${sentCount} payslips sent successfully.`;
        await createWorkspaceNotification(ctx, {
          businessId: job.businessId,
          category: failedCount ? "failedPayslip" : "payslip",
          type: failedCount ? "payslips_failed" : "payslips_sent",
          title: failedCount ? "Payslip delivery needs review" : "Payslips sent",
          message: label,
          actionUrl: `/accountant?tab=Bulk%20Payslips&clientId=${String(job.businessId)}`,
          dedupeKey: `bulk-payslip-result:${String(job._id)}`,
          payrollId: job.payrollRunId,
          metadata: { sentCount, failedCount, jobId: String(job._id) },
          channels: ["in_app", "push", "email"],
        });
      }
    }
  },
});

export const updateDeliveryFromWebhook = internalMutation({
  args: { resendMessageId: v.string(), status: v.string(), deliveredAt: v.optional(v.number()), errorMessage: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const row = await ctx.db.query("bulkEmailRecipients")
      .withIndex("by_resend_message", (q) => q.eq("resendMessageId", args.resendMessageId)).first();
    if (row) await ctx.db.patch(row._id, {
      status: args.status, deliveredAt: args.deliveredAt ?? row.deliveredAt,
      errorMessage: args.errorMessage ?? row.errorMessage,
    });
  },
});
