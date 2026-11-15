/// <reference types="vite/client" />
import { it, expect, vi, afterEach } from "vitest";
import { convexTest } from "convex-test";
import { anyApi } from "convex/server";
import schema from "../convex/schema";
import { calculateTrinidadPayroll } from "../convex/lib/countryTaxRules/trinidad_and_tobago";
const api = anyApi,
  modules = import.meta.glob("../convex/**/*.{ts,js}");
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});
async function fixture() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const owner = await ctx.db.insert("users", {
      firebaseUid: "api-owner",
      email: "owner@example.com",
      accountType: "accountant",
      plan: "accountant_monthly",
      planStatus: "active",
    });
    const business = await ctx.db.insert("businesses", {
      userId: owner,
      name: "Portal Client",
      currency: "TTD",
      currencySymbol: "$",
      countryCode: "TT",
      updatedAt: 1,
    });
    const employee = await ctx.db.insert("employees", {
      userId: owner,
      businessId: business,
      name: "Payroll Employee",
      employeeId: "EMP001",
      position: "Worker",
      department: "General",
      payFrequency: "monthly",
      basicPay: 10000,
      frequencySalary: 10000,
      overtimeHours: 0,
      overtimeRate: 0,
      bonus: 0,
      commission: 0,
      allowances: 0,
      paye: 0,
      nis: 0,
      healthSurcharge: 0,
      otherDeductions: 0,
      grossPay: 10000,
      netPay: 10000,
      status: "active",
      localId: "emp-one",
      createdAt: 1,
      email: "employee@example.com",
      payrollIdentifiers: { primaryId: "TAX1", secondaryId: "NIS1" },
    });
    return { owner, business, employee };
  });
  const actor = t.withIdentity({
    subject: "api-owner",
    email: "owner@example.com",
    emailVerified: true,
  });
  const credential = await actor.mutation(api.portalPayroll.createConnection, {
    businessId: ids.business,
    portalOrganizationId: "portal-org",
  });
  const call = (body: any, token = credential.apiKey) =>
    t.mutation(api.portalPayroll.execute, {
      token,
      body: { organizationId: "portal-org", ...body },
    });
  const prepare = (extra: any = {}) =>
    call({
      operation: "prepare",
      key: "review-one",
      employeeIds: [ids.employee],
      period: { start: "2026-10-01", end: "2026-10-31", payDate: "2026-10-31" },
      ...extra,
    });
  return { t, ids, actor, credential, call, prepare };
}
it("issues only hashed credentials to a verified owner and enforces revocation", async () => {
  const { t, ids, actor, credential, call } = await fixture();
  const saved: any = await t.run((ctx) => ctx.db.get(credential.connectionId));
  expect(saved!.tokenHash).not.toBe(credential.apiKey);
  expect(JSON.stringify(saved)).not.toContain(credential.apiKey);
  await expect(
    t
      .withIdentity({ subject: "api-owner", email: "owner@example.com" })
      .mutation(api.portalPayroll.createConnection, {
        businessId: ids.business,
        portalOrganizationId: "portal-org",
      }),
  ).rejects.toThrow("verified");
  await expect(
    call({ operation: "status", organizationId: "foreign-org" }),
  ).rejects.toThrow("UNAUTHORIZED");
  await actor.mutation(api.portalPayroll.revokeConnection, {
    id: credential.connectionId,
  });
  await expect(call({ operation: "status" })).rejects.toThrow("UNAUTHORIZED");
});
it("calculates with the existing engine and approves one immutable run on retries", async () => {
  const { t, call, prepare } = await fixture();
  const draft = await prepare();
  expect(draft.rows).toHaveLength(1);
  expect(draft.totals.gross).toBe(10000);
  expect(draft.totals.net).toBeLessThan(10000);
  const expected = calculateTrinidadPayroll({
    grossIncome: 10000,
    frequency: "monthly",
    taxYear: 2026,
    allowances: 0,
    otherDeductions: 0,
  });
  expect(draft.rows[0].paye).toBe(expected.payeTax);
  expect(draft.rows[0].nis).toBe(expected.employeeNIS);
  expect(await prepare()).toEqual(draft);
  await expect(
    prepare({
      period: { start: "2026-10-01", end: "2026-10-30", payDate: "2026-10-31" },
    }),
  ).rejects.toThrow("different");
  const request = {
    operation: "approve",
    draftId: draft.id,
    reviewHash: draft.reviewHash,
    confirmed: true,
    acknowledgeWarnings: true,
  };
  const receipt = await call(request);
  expect(receipt.status).toBe("approved");
  expect(await call(request)).toEqual(receipt);
  const runs = await t.run((ctx) => ctx.db.query("payrollRuns").take(10));
  expect(runs).toHaveLength(1);
  expect(runs[0].totalNet).toBe(draft.totals.net);
});
it("rejects substituted approval hashes, cross-business employees and changed rosters", async () => {
  const { t, ids, call, prepare } = await fixture();
  const draft = await prepare();
  await expect(
    call({
      operation: "approve",
      draftId: draft.id,
      reviewHash: "changed",
      confirmed: true,
    }),
  ).rejects.toThrow("confirmation");
  const foreign = await t.run(async (ctx) => {
    const business = await ctx.db.insert("businesses", {
      userId: ids.owner,
      name: "Other",
      currency: "TTD",
      currencySymbol: "$",
      countryCode: "TT",
      updatedAt: 1,
    });
    const employee = await ctx.db.get(ids.employee);
    const { _id, _creationTime, ...data } = employee!;
    return ctx.db.insert("employees", { ...data, businessId: business });
  });
  await expect(
    prepare({ key: "foreign", employeeIds: [foreign] }),
  ).rejects.toThrow("belonging");
  await t.run((ctx) => ctx.db.patch(ids.employee, { basicPay: 12000 }));
  await expect(
    call({
      operation: "approve",
      draftId: draft.id,
      reviewHash: draft.reviewHash,
      confirmed: true,
      acknowledgeWarnings: true,
    }),
  ).rejects.toThrow("changed");
  expect(
    await t.run((ctx) => ctx.db.query("payrollRuns").take(10)),
  ).toHaveLength(0);
});
it("refuses blocked and expired drafts and preserves the existing free-plan limit", async () => {
  const { t, ids, call, prepare } = await fixture();
  await t.run((ctx) => ctx.db.patch(ids.employee, { basicPay: 0 }));
  const blocked = await prepare();
  expect(blocked.issues.some((i: any) => i.severity === "BLOCKING")).toBe(true);
  await expect(
    call({
      operation: "approve",
      draftId: blocked.id,
      reviewHash: blocked.reviewHash,
      confirmed: true,
      acknowledgeWarnings: true,
    }),
  ).rejects.toThrow("blocking");
  await t.run((ctx) => ctx.db.patch(ids.employee, { basicPay: 10000 }));
  const valid = await prepare({ key: "valid" });
  await t.run((ctx) =>
    ctx.db.patch(valid.id as any, { expiresAt: Date.now() - 1 }),
  );
  await expect(
    call({
      operation: "approve",
      draftId: valid.id,
      reviewHash: valid.reviewHash,
      confirmed: true,
      acknowledgeWarnings: true,
    }),
  ).rejects.toThrow("expired");
});
it("bounds employee pages and rate limits even invalid payroll attempts", async () => {
  const { t, credential, call } = await fixture();
  expect((await call({ operation: "employees" })).page).toHaveLength(1);
  for (let i = 0; i < 30; i++)
    await t.mutation(api.portalPayroll.consumeRate, {
      token: credential.apiKey,
      organizationId: "portal-org",
    });
  await expect(
    t.mutation(api.portalPayroll.consumeRate, {
      token: credential.apiKey,
      organizationId: "portal-org",
    }),
  ).rejects.toThrow("RATE_LIMITED");
});
it("rejects unauthenticated HTTP calls and provides no cross-origin browser bypass", async () => {
  const { t } = await fixture();
  const response = await t.fetch("/v1/portal-payroll", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ operation: "status", organizationId: "portal-org" }),
  });
  expect(response.status).toBe(401);
  expect(response.headers.get("access-control-allow-origin")).toBeNull();
});
it("enforces the existing payroll quota and cancels draft cleanup after approval", async () => {
  const { t, ids, call, prepare } = await fixture();
  await t.run((ctx) =>
    ctx.db.patch(ids.owner, { plan: "free", planStatus: "active" }),
  );
  for (let i = 0; i < 3; i++) {
    const draft = await prepare({ key: "quota-" + i });
    const before: any = await t.run((ctx) => ctx.db.get(draft.id as any));
    await call({
      operation: "approve",
      draftId: draft.id,
      reviewHash: draft.reviewHash,
      confirmed: true,
      acknowledgeWarnings: true,
    });
    const task: any = await t.run((ctx) => ctx.db.system.get(before.cleanupId));
    expect(task.state.kind).toBe("canceled");
  }
  const fourth = await prepare({ key: "quota-four" });
  await expect(
    call({
      operation: "approve",
      draftId: fourth.id,
      reviewHash: fourth.reviewHash,
      confirmed: true,
      acknowledgeWarnings: true,
    }),
  ).rejects.toThrow();
  expect(
    await t.run((ctx) => ctx.db.query("payrollRuns").take(10)),
  ).toHaveLength(3);
});
it("blocks expiry, currency changes and cross-business payroll downloads", async () => {
  const { t, ids, call, prepare, credential } = await fixture();
  const draft = await prepare();
  await t.run((ctx) => ctx.db.patch(ids.business, { currency: "USD" }));
  await expect(
    call({
      operation: "approve",
      draftId: draft.id,
      reviewHash: draft.reviewHash,
      confirmed: true,
      acknowledgeWarnings: true,
    }),
  ).rejects.toThrow("changed");
  await expect(call({ operation: "run", runId: "not-a-run" })).rejects.toThrow(
    "not found",
  );
  await t.run((ctx) =>
    ctx.db.patch(credential.connectionId, { expiresAt: Date.now() - 1 }),
  );
  await expect(call({ operation: "status" })).rejects.toThrow("UNAUTHORIZED");
});
it("returns only a matching, current saved payslip PDF", async () => {
  const { t, ids, call, prepare } = await fixture();
  const draft = await prepare();
  const receipt = await call({
    operation: "approve",
    draftId: draft.id,
    reviewHash: draft.reviewHash,
    confirmed: true,
    acknowledgeWarnings: true,
  });
  await expect(
    call({
      operation: "payslip",
      runId: receipt.runId,
      employeeId: ids.employee,
    }),
  ).rejects.toThrow("No saved PDF");
  const fileId = await t.run(async (ctx) => {
    const run: any = await ctx.db.get(receipt.runId as any);
    const storageId = await ctx.storage.store(
      new Blob(["%PDF-1.4\nTest saved attachment"]),
    );
    return ctx.db.insert("bulkPayslipUploads", {
      workspaceOwnerId: ids.owner,
      businessId: ids.business,
      employeeId: ids.employee,
      payrollRunId: run._id,
      payrollRunUpdatedAt: run.updatedAt,
      storageId,
      status: "ready",
      createdAt: Date.now(),
      expiresAt: Date.now() + 86400000,
    });
  });
  expect(
    (
      await call({
        operation: "payslip",
        runId: receipt.runId,
        employeeId: ids.employee,
      })
    ).url,
  ).toMatch(/^https:/);
  await t.run((ctx) => ctx.db.patch(fileId, { expiresAt: Date.now() - 1 }));
  await expect(
    call({
      operation: "payslip",
      runId: receipt.runId,
      employeeId: ids.employee,
    }),
  ).rejects.toThrow("No saved PDF");
});
it("serves the versioned JSON HTTP contract using the scoped bearer credential", async () => {
  const { t, credential } = await fixture();
  const response = await t.fetch("/v1/portal-payroll", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + credential.apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ operation: "status", organizationId: "portal-org" }),
  });
  expect(response.status).toBe(200);
  const metadata = await response.json();
  expect(metadata.version).toBe(1);
  expect(metadata.business.name).toBe("Portal Client");
  expect(JSON.stringify(metadata)).not.toContain(credential.apiKey);
});
