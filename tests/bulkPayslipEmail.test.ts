import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";
import { anyApi } from "convex/server";
import schema from "../convex/schema";
const modules = import.meta.glob("../convex/**/*.{ts,js}");
const api = anyApi;
const pdfBytes = new TextEncoder().encode("%PDF-1.4\nsynthetic employee payslip test attachment\n%%EOF").buffer;

async function fixture() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const owner = await ctx.db.insert("users", { firebaseUid: "owner", email: "owner@example.com" });
    const outsider = await ctx.db.insert("users", { firebaseUid: "outsider", email: "outsider@example.com" });
    const viewer = await ctx.db.insert("users", { firebaseUid: "viewer", email: "viewer@example.com" });
    const business = await ctx.db.insert("businesses", { userId: owner, name: "Trini Builders", currency: "TTD", currencySymbol: "$", updatedAt: Date.now() });
    const otherBusiness = await ctx.db.insert("businesses", { userId: outsider, name: "Other Client", currency: "TTD", currencySymbol: "$", updatedAt: Date.now() });
    await ctx.db.insert("accountantMemberships", { workspaceOwnerId: owner, memberUserId: viewer, email: "viewer@example.com", role: "Viewer", status: "active", allClients: false, clientIds: [business], canSendPayslips: false, createdAt: Date.now(), updatedAt: Date.now() });
    const employee = (name: string, email?: string) => ({ userId: owner, businessId: business, name, email, employeeId: name, position: "Worker", department: "Construction", payFrequency: "monthly", basicPay: 7000, frequencySalary: 7000, overtimeHours: 5, overtimeRate: 100, bonus: 100, commission: 0, allowances: 200, paye: 400, nis: 200, healthSurcharge: 20, otherDeductions: 50, grossPay: 7800, netPay: 7130, status: "active", localId: name, createdAt: Date.now() });
    const john = await ctx.db.insert("employees", employee("John Smith", "john@example.com"));
    const jane = await ctx.db.insert("employees", employee("Jane Doe", "jane@example.com"));
    const missing = await ctx.db.insert("employees", employee("Missing Email"));
    const invalid = await ctx.db.insert("employees", employee("Invalid Email", "invalid"));
    const notReady = await ctx.db.insert("employees", { ...employee("Needs Review", "review@example.com"), grossPay: 0 });
    const snapshots = await Promise.all([john, jane, missing, invalid, notReady].map((id) => ctx.db.get(id)));
    const runFields = { businessId: business, userId: owner, month: "September", year: 2026, status: "review", periodLabel: "September 2026", employeesSnapshot: snapshots, totalGross: 31200, totalPaye: 1600, totalNis: 800, totalHealthSurcharge: 80, totalDeductions: 2680, totalNet: 28520, createdAt: Date.now(), updatedAt: Date.now() };
    const run = await ctx.db.insert("payrollRuns", runFields);
    const olderRun = await ctx.db.insert("payrollRuns", { ...runFields, month: "August", periodLabel: "August 2026" });
    return { owner, outsider, viewer, business, otherBusiness, john, jane, missing, invalid, notReady, run, olderRun, runUpdatedAt: runFields.updatedAt };
  });
  const owner = t.withIdentity({ subject: "owner" });
  const upload = async (employeeId = ids.john, runId = ids.run) => {
    const uploadId = await owner.action(api.bulkPayslipEmail.storePayslip, { businessId: ids.business, payrollRunId: runId, employeeId, payrollRunUpdatedAt: ids.runUpdatedAt, pdf: new TextEncoder().encode(`%PDF-1.4\nemployee:${employeeId}\n%%EOF`).buffer });
    // convex-test currently omits Blob.type from stored file metadata.
    await t.run(async (ctx) => { const upload = await ctx.db.get(uploadId); await ctx.db.patch(upload.storageId, { contentType: "application/pdf" } as any); });
    return uploadId;
  };
  const job = async (employeeIds = [ids.john, ids.jane], uploadIds?: any[], key = "initial") => owner.mutation(api.bulkPayslipEmail.createBulkEmailJob, {
    businessId: ids.business, payrollRunId: ids.run, employeeIds, uploadIds: uploadIds || await Promise.all(employeeIds.map((id) => upload(id))),
    subject: "Your Payslip — Trini Builders — September 2026", message: "Your payslip is attached.", idempotencyKey: key,
  });
  return { t, ids, owner, upload, job };
}

beforeEach(() => { vi.useFakeTimers(); vi.stubEnv("RESEND_API_KEY", "test-server-only-key"); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("private bulk payslip delivery", () => {
  it("reviews valid, missing, invalid and not-ready employee emails", async () => {
    const { owner, ids } = await fixture();
    const result = await owner.query(api.bulkPayslipEmail.reviewRun, { businessId: ids.business, payrollRunId: ids.run });
    expect(result.rows.map((row: any) => row.status)).toEqual(["ready", "ready", "missing_email", "missing_email", "not_ready"]);
    expect(result.periodLabel).toBe("September 2026");
  });
  it("denies anonymous, cross-tenant and viewer sends; allows assigned viewer reads", async () => {
    const { t, ids, owner } = await fixture();
    const args = { businessId: ids.business, payrollRunId: ids.run };
    await expect(t.query(api.bulkPayslipEmail.reviewRun, args)).rejects.toThrow("Unauthenticated");
    await expect(t.withIdentity({ subject: "outsider" }).query(api.bulkPayslipEmail.reviewRun, args)).rejects.toThrow("Forbidden");
    await expect(owner.query(api.bulkPayslipEmail.reviewRun, { ...args, businessId: ids.otherBusiness })).rejects.toThrow();
    const viewer = t.withIdentity({ subject: "viewer" });
    expect((await viewer.query(api.bulkPayslipEmail.reviewRun, args)).canSend).toBe(false);
    expect((await viewer.query(api.payrollRuns.getByBusiness, { businessId: ids.business })).length).toBe(2);
    await expect(viewer.action(api.bulkPayslipEmail.storePayslip, { ...args, employeeId: ids.john, payrollRunUpdatedAt: ids.runUpdatedAt, pdf: pdfBytes })).rejects.toThrow("PERMISSION_DENIED");
  });
  it("rejects invalid PDFs, swapped employee attachments and wrong payroll periods", async () => {
    const { owner, ids, upload, job } = await fixture();
    await expect(owner.action(api.bulkPayslipEmail.storePayslip, { businessId: ids.business, payrollRunId: ids.run, employeeId: ids.john, payrollRunUpdatedAt: ids.runUpdatedAt, pdf: new TextEncoder().encode("bad file").buffer })).rejects.toThrow("valid PDF");
    const john = await upload(ids.john), jane = await upload(ids.jane), oldJohn = await upload(ids.john, ids.olderRun);
    await expect(job([ids.john, ids.jane], [jane, john])).rejects.toThrow("does not match");
    await expect(job([ids.john], [oldJohn])).rejects.toThrow("does not match");
    await expect(job([ids.missing])).rejects.toThrow("valid employee email");
  });
  it("blocks replay keys, new keys and double-click requests from duplicating recipients", async () => {
    const { job, owner, ids } = await fixture();
    const first = await job();
    expect((await job()).jobId).toBe(first.jobId);
    await expect(job([ids.john], undefined, "new-key")).rejects.toThrow("already queued");
    const jobs = await owner.query(api.bulkPayslipEmail.getEmailJobs, { businessId: ids.business });
    expect(jobs).toHaveLength(1); expect(jobs[0].recipients).toHaveLength(2);
    expect(jobs[0].recipients[0].storageId).toBeUndefined();
  });
  it("sends exactly one recipient and their own PDF per Resend request", async () => {
    const { t, job, owner, ids } = await fixture();
    const requests: any[] = [];
    vi.stubGlobal("fetch", vi.fn(async (_url, init) => { const body = JSON.parse(init.body); requests.push({ body, headers: init.headers }); return new Response(JSON.stringify({ id: `resend-${body.to[0]}` }), { status: 200 }); }));
    await job();
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(requests).toHaveLength(2);
    for (const { body, headers } of requests) {
      expect(body.to).toHaveLength(1); expect(body.attachments).toHaveLength(1);
      expect(Buffer.from(body.attachments[0].content, "base64").subarray(0, 5).toString()).toBe("%PDF-");
      expect(body.attachments[0].filename).toBe(body.to[0] === "john@example.com" ? "Trini-Builders_John-Smith_September-2026.pdf" : "Trini-Builders_Jane-Doe_September-2026.pdf");
      expect(headers["Idempotency-Key"]).toContain(ids.run);
      expect(Buffer.from(body.attachments[0].content, "base64").toString()).toContain(body.to[0] === "john@example.com" ? ids.john : ids.jane);
    }
    const results = await owner.query(api.bulkPayslipEmail.getEmailJobs, { businessId: ids.business });
    expect(results[0].sentCount).toBe(2); expect(results[0].failedCount).toBe(0);
  });
  it("marks rejection as failed and retries only failures, preserving provider idempotency", async () => {
    const { t, job, owner, ids } = await fixture();
    const requests: any[] = []; let failing = true;
    vi.stubGlobal("fetch", vi.fn(async (_url, init) => { const body = JSON.parse(init.body); requests.push({ to: body.to[0], key: init.headers["Idempotency-Key"] }); return body.to[0] === "jane@example.com" && failing ? new Response(JSON.stringify({ message: "Provider temporarily unavailable" }), { status: 503 }) : new Response(JSON.stringify({ id: `resend-${body.to[0]}` }), { status: 200 }); }));
    const first = await job(); await t.finishAllScheduledFunctions(vi.runAllTimers);
    let jobs = await owner.query(api.bulkPayslipEmail.getEmailJobs, { businessId: ids.business });
    expect(jobs[0].sentCount).toBe(1); expect(jobs[0].failedCount).toBe(1);
    failing = false;
    const retry = await owner.mutation(api.bulkPayslipEmail.retryFailed, { jobId: first.jobId, idempotencyKey: "retry" });
    expect((await owner.mutation(api.bulkPayslipEmail.retryFailed, { jobId: first.jobId, idempotencyKey: "retry" })).jobId).toBe(retry.jobId);
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(requests.filter((r) => r.to === "john@example.com")).toHaveLength(1);
    const jane = requests.filter((r) => r.to === "jane@example.com"); expect(jane).toHaveLength(2); expect(jane[0].key).toBe(jane[1].key);
    jobs = await owner.query(api.bulkPayslipEmail.getEmailJobs, { businessId: ids.business }); expect(jobs[0].sentCount).toBe(1);
  });
  it("never reports success without a provider message ID", async () => {
    const { t, job, owner, ids } = await fixture();
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 200 })));
    await job(); await t.finishAllScheduledFunctions(vi.runAllTimers);
    const jobs = await owner.query(api.bulkPayslipEmail.getEmailJobs, { businessId: ids.business });
    expect(jobs[0].sentCount).toBe(0); expect(jobs[0].failedCount).toBe(2);
  });
  it("rejects an attachment after its payroll snapshot changes", async () => {
    const { t, ids, upload, job } = await fixture();
    const attachment = await upload(ids.john);
    await t.run(async (ctx) => { await ctx.db.patch(ids.run, { updatedAt: ids.runUpdatedAt + 1 }); });
    await expect(job([ids.john], [attachment])).rejects.toThrow("does not match");
  });
  it("claims one worker at a time and recovers interrupted sends", async () => {
    const { t, job } = await fixture();
    const first = await job();
    const claimed = await t.mutation(api.bulkPayslipEmail.takeQueued, { jobId: first.jobId });
    expect(claimed.recipient.status).toBe("queued");
    expect(await t.mutation(api.bulkPayslipEmail.takeQueued, { jobId: first.jobId })).toBeNull();
    vi.setSystemTime(Date.now() + 61000);
    const recovered = await t.mutation(api.bulkPayslipEmail.takeQueued, { jobId: first.jobId });
    expect(recovered.recipient.employeeId).not.toBe(claimed.recipient.employeeId);
  });
  it("protects sent status from late errors and blocks ambiguous retries after expiry", async () => {
    const { t, job, owner, ids } = await fixture();
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("Connection interrupted"); }));
    const first = await job([ids.john]); await t.finishAllScheduledFunctions(vi.runAllTimers);
    vi.setSystemTime(Date.now() + 24 * 60 * 60 * 1000);
    await expect(owner.mutation(api.bulkPayslipEmail.retryFailed, { jobId: first.jobId, idempotencyKey: "expired" })).rejects.toThrow("duplicate protection window");
  });
  it("requires signed delivery webhooks and retains final delivered statuses", async () => {
    const { t, job, owner, ids } = await fixture();
    expect((await t.fetch("/resend/webhook", { method: "POST", body: JSON.stringify({ type: "email.sent", data: { email_id: "fake" } }) })).status).toBe(503);
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ id: "confirmed-id" }), { status: 200 })));
    await job([ids.john]); await t.finishAllScheduledFunctions(vi.runAllTimers);
    await t.mutation(api.bulkPayslipEmail.updateDeliveryFromWebhook, { resendMessageId: "confirmed-id", status: "delivered", deliveredAt: Date.now() });
    await t.mutation(api.bulkPayslipEmail.updateDeliveryFromWebhook, { resendMessageId: "confirmed-id", status: "sent" });
    const jobs = await owner.query(api.bulkPayslipEmail.getEmailJobs, { businessId: ids.business }); expect(jobs[0].recipients[0].status).toBe("delivered");
  });
});
