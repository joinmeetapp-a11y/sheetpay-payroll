/// <reference types="vite/client" />
import { createHmac } from "node:crypto";
import { afterEach, describe, it, expect, vi } from "vitest";
import { convexTest } from "convex-test";
import { anyApi } from "convex/server";
import schema from "../convex/schema";
import { validateMcpInput } from "../shared/mcpInputs";
const api: any = anyApi,
  modules = import.meta.glob("../convex/**/*.{ts,js}");
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});
async function fixture() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const user = await ctx.db.insert("users", {
      firebaseUid: "mcp-owner",
      email: "owner@example.com",
      emailVerified: true,
      accountType: "accountant",
      plan: "accountant_monthly",
      planStatus: "active",
    });
    const other = await ctx.db.insert("users", {
      firebaseUid: "mcp-other",
      email: "other@example.com",
      emailVerified: true,
      accountType: "accountant",
    });
    const business = await ctx.db.insert("businesses", {
      userId: user,
      name: "MCP Client",
      currency: "TTD",
      currencySymbol: "$",
      countryCode: "TT",
      updatedAt: 1,
    });
    await ctx.db.insert("businessDirectory", {
      sourceId: business,
      userId: user,
      name: "MCP Client",
      currency: "TTD",
      currencySymbol: "$",
      countryCode: "TT",
    });
    const foreign = await ctx.db.insert("businesses", {
      userId: other,
      name: "Private Client",
      currency: "TTD",
      currencySymbol: "$",
      countryCode: "TT",
      updatedAt: 1,
    });
    await ctx.db.insert("employees", {
      userId: user,
      businessId: business,
      name: "Employee",
      email: "employee@example.com",
      employeeId: "E1",
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
      localId: "mcp-employee",
      createdAt: 1,
      payrollIdentifiers: { primaryId: "TAX1", secondaryId: "NIS1" },
    });
    const scopes = [
      "clients:read",
      "documents:read",
      "payroll:read",
      "payroll:prepare",
      "reminders:prepare",
    ];
    const connection = await ctx.db.insert("mcpConnections", {
      actorId: user,
      ownerId: user,
      firebaseUid: "mcp-owner",
      clientId: "inspector",
      clientName: "Inspector",
      grantId: "grant-test",
      scopes,
      createdAt: Date.now(),
    });
    for (const [model, key] of [
      ["Grant", "grant-test"],
      ["AccessToken", "token-test"],
    ])
      await ctx.db.insert("mcpOAuthRecords", {
        model,
        key,
        payload: "encrypted-fixture",
        grantId: "grant-test",
        expiresAt: Date.now() + 600000,
      });
    return { user, other, business, foreign, connection, scopes };
  });
  const principal = {
    sub: "mcp-owner",
    connectionId: ids.connection,
    clientId: "inspector",
    grantId: "grant-test",
    jti: "token-test",
    scopes: ids.scopes,
  };
  const call = (tool: string, input: any, p = principal) =>
    t.mutation(api.mcp.execute, {
      principal: p,
      tool,
      input,
      requestId: crypto.randomUUID(),
    });
  return {
    t,
    ids,
    principal,
    call,
    owner: t.withIdentity({
      subject: "mcp-owner",
      email: "owner@example.com",
      emailVerified: true,
    }),
  };
}
const preparation = {
  periodStart: "2026-11-01",
  periodEnd: "2026-11-30",
  payDate: "2026-11-30",
  timezone: "America/Port_of_Spain",
  idempotencyKey: "unique-request-1",
};
describe("MCP backend authorization and preparation", () => {
  it("requires existing authenticated identity for settings and consent", async () => {
    const { t, ids } = await fixture();
    await expect(t.query(api.mcp.connections, {})).rejects.toThrow(
      "Unauthenticated",
    );
    await expect(
      t.mutation(api.mcp.connect, {
        ownerId: ids.user,
        clientId: "x",
        clientName: "x",
        grantId: "x",
        scopes: ["clients:read"],
        proof: "bad",
      }),
    ).rejects.toThrow();
  });
  it("rejects cross-organization client IDs and wrong token bindings", async () => {
    const { call, ids, principal } = await fixture();
    await expect(
      call("get_payroll_status", { clientId: ids.foreign }),
    ).rejects.toThrow();
    await expect(
      call("list_clients", {}, { ...principal, sub: "mcp-other" }),
    ).rejects.toThrow();
    await expect(
      call("list_clients", {}, { ...principal, grantId: "another" }),
    ).rejects.toThrow();
  });
  it("enforces scopes and immediate connection revocation", async () => {
    const { call, principal, owner, ids } = await fixture();
    await expect(
      call("list_clients", {}, { ...principal, scopes: [] }),
    ).rejects.toThrow("INSUFFICIENT_SCOPE");
    await owner.mutation(api.mcp.revoke, { id: ids.connection });
    await expect(call("list_clients", {})).rejects.toThrow();
  });
  it("rejects expired or revoked token artifacts", async () => {
    const { t, call } = await fixture();
    await t.run(async (ctx) => {
      const r = await ctx.db
        .query("mcpOAuthRecords")
        .withIndex("by_key", (q) =>
          q.eq("model", "AccessToken").eq("key", "token-test"),
        )
        .first();
      await ctx.db.patch(r!._id, { expiresAt: 1 });
    });
    await expect(call("list_clients", {})).rejects.toThrow("TOKEN_REVOKED");
  });
  it("bounds schemas and excludes unsupported tasks and arbitrary functions", () => {
    expect(() => validateMcpInput("list_tasks", {})).toThrow();
    expect(() => validateMcpInput("list_clients", { limit: 500 })).toThrow();
    expect(() =>
      validateMcpInput("list_clients", { function: "payroll:approve" }),
    ).toThrow();
    expect(() =>
      validateMcpInput("prepare_payroll", {
        ...preparation,
        clientId: "valididentifier",
        timezone: "bogus",
      }),
    ).toThrow();
  });
  it("paginates compact authorized clients", async () => {
    const { call } = await fixture();
    const r = await call("list_clients", { limit: 1 });
    expect(r.items).toHaveLength(1);
    expect(r.items[0].name).toBe("MCP Client");
    expect(r.items[0].email).toBeUndefined();
  });
  it("prepares actual payroll once, never finalizes, and identifies changed source", async () => {
    vi.useFakeTimers();
    const { t, ids, call, owner } = await fixture();
    const input = { ...preparation, clientId: ids.business };
    const first = await call("prepare_payroll", input),
      again = await call("prepare_payroll", input);
    expect(again.jobId).toBe(first.jobId);
    await expect(
      call("prepare_payroll", { ...input, payDate: "2026-11-29" }),
    ).rejects.toThrow("IDEMPOTENCY_CONFLICT");
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const preview = await call("get_payroll_preview", { jobId: first.jobId });
    expect(preview.status).toBe("review");
    expect(preview.approvalStatus).toBe("pending");
    expect(preview.totals[0].gross).toBe(10000);
    expect(preview.totals[0].net).toBeGreaterThan(0);
    expect(
      await t.run((ctx) => ctx.db.query("payrollRuns").collect()),
    ).toHaveLength(0);
    expect(
      await t.run((ctx) => ctx.db.query("bulkEmailJobs").collect()),
    ).toHaveLength(0);
    await t.run(async (ctx) => {
      await ctx.db.patch(ids.business, { complianceRevision: 1 });
      const e = await ctx.db.query("employees").first();
      await ctx.db.patch(e!._id, { basicPay: 12000 });
    });
    expect(
      (await call("get_payroll_preview", { jobId: first.jobId })).status,
    ).toBe("stale");
    await expect(
      owner.mutation(api.caylaAgent.approveClient, {
        commandId: first.commandId,
        businessId: ids.business,
        expectedReviewUpdatedAt: preview.version,
      }),
    ).rejects.toThrow("Payroll data changed");
  });
  it("prepares existing reminder drafts, includes honest recipients, and never schedules delivery before review", async () => {
    vi.useFakeTimers();
    const { t, ids, call } = await fixture();
    const input = {
      ...preparation,
      clientId: ids.business,
      reminderDate: "2026-11-27",
      reminderTime: "09:00",
    };
    const draft = await call("prepare_client_reminders", input);
    expect(draft.delivery).toBe("in_app_after_review_only");
    expect(draft.recipients[0].role).toBe("accountant");
    expect((await call("prepare_client_reminders", input)).messagePreview).toBe(
      draft.messagePreview,
    );
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(
      (await call("get_preparation_status", { jobId: draft.jobId }))
        .approvalStatus,
    ).toBe("pending");
    expect(
      await t.run((ctx) => ctx.db.query("reminders").collect()),
    ).toHaveLength(0);
    expect(
      await t.run((ctx) => ctx.db.query("bulkEmailJobs").collect()),
    ).toHaveLength(0);
  });
  it("blocks unassigned clients and preparation by Viewer role", async () => {
    const { t, call, ids } = await fixture();
    await t.run(async (ctx) => {
      await ctx.db.patch(ids.connection, {
        actorId: ids.other,
        firebaseUid: "mcp-other",
      });
      await ctx.db.insert("accountantMemberships", {
        workspaceOwnerId: ids.user,
        memberUserId: ids.other,
        email: "other@example.com",
        role: "Viewer",
        status: "active",
        allClients: true,
        clientIds: [],
        canSendPayslips: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });
    const p = {
      sub: "mcp-other",
      connectionId: ids.connection,
      clientId: "inspector",
      grantId: "grant-test",
      jti: "token-test",
      scopes: ids.scopes,
    };
    await expect(
      call("prepare_payroll", { ...preparation, clientId: ids.business }, p),
    ).rejects.toThrow("PERMISSION_DENIED");
    await t.run(async (ctx) => {
      const m = await ctx.db.query("accountantMemberships").first();
      await ctx.db.patch(m!._id, { allClients: false });
    });
    await expect(
      call("get_payroll_status", { clientId: ids.business }, p),
    ).rejects.toThrow("CLIENT_ACCESS_DENIED");
  });
  it("uses atomic one-use OAuth artifacts and bounded revocation", async () => {
    const { t, ids, call } = await fixture();
    const args = { model: "AuthorizationCode", key: "once" };
    await t.mutation(api.mcpStore.operate, {
      ...args,
      operation: "upsert",
      payload: "encrypted",
      expiresIn: 60,
    });
    await t.mutation(api.mcpStore.operate, { ...args, operation: "consume" });
    await expect(
      t.mutation(api.mcpStore.operate, { ...args, operation: "consume" }),
    ).rejects.toThrow("ALREADY_CONSUMED");
    await t.mutation(api.mcpStore.operate, {
      model: "Grant",
      operation: "revoke",
      grantId: "grant-test",
    });
    expect(
      (await t.run((ctx) => ctx.db.get(ids.connection)))?.revokedAt,
    ).toBeTruthy();
    await expect(call("list_clients", {})).rejects.toThrow();
  });
  it("blocks pending jobs immediately after revocation", async () => {
    vi.useFakeTimers();
    const { t, ids, call, owner } = await fixture();
    const job = await call("prepare_payroll", {
      ...preparation,
      clientId: ids.business,
    });
    await owner.mutation(api.mcp.revoke, { id: ids.connection });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const row: any = await t.run((ctx) => ctx.db.get(job.jobId));
    expect(row.status).toBe("needs_attention");
    expect(
      await t.run((ctx) => ctx.db.query("caylaPreparedEmployees").collect()),
    ).toHaveLength(0);
  });
  it("applies a shared per-actor workspace request budget", async () => {
    const { call } = await fixture();
    for (let n = 0; n < 60; n++) await call("list_clients", { limit: 1 });
    await expect(call("list_clients", { limit: 1 })).rejects.toThrow(
      "RATE_LIMITED",
    );
  });
  it("returns outstanding request metadata without document contents or private notes", async () => {
    const { t, ids, call } = await fixture();
    await t.run(async (ctx) => {
      for (const status of ["requested", "uploaded"])
        await ctx.db.insert("practiceRequests", {
          ownerId: ids.user,
          businessId: ids.business,
          title: "November statement",
          details: "Sensitive client instructions",
          dueAt: Date.now() + 86400000,
          status,
          createdAt: Date.now(),
        });
    });
    const result = await call("get_missing_documents", {
      clientId: ids.business,
      limit: 1,
    });
    expect(result.items).toHaveLength(1);
    expect(result.items[0].status).toBe("requested");
    expect(result.items[0].details).toBeUndefined();
    expect(result.items[0].ownerId).toBeUndefined();
  });
  it("records real Firebase-authenticated consent only with a matching gateway proof", async () => {
    const { t, owner, ids } = await fixture();
    const secret = "test-storage-secret-with-at-least-32-characters";
    vi.stubEnv("MCP_STORAGE_SECRET", secret);
    const scopes = ["payroll:prepare", "clients:read"],
      clientId = "chatgpt-test",
      grantId = "grant-new";
    const proof = createHmac("sha256", secret)
      .update(
        JSON.stringify([
          "mcp-owner",
          ids.user,
          clientId,
          grantId,
          [...scopes].sort(),
        ]),
      )
      .digest("hex");
    const args = {
      ownerId: ids.user,
      clientId,
      clientName: "ChatGPT",
      grantId,
      scopes,
      proof,
    };
    const id = await owner.mutation(api.mcp.connect, args);
    expect(await owner.mutation(api.mcp.connect, args)).toBe(id);
    const records = await owner.query(api.mcp.connections, {});
    expect(records.items.find((c: any) => c.id === id)).toMatchObject({
      application: "ChatGPT",
      organizationId: ids.user,
      scopes,
    });
    await expect(
      owner.mutation(api.mcp.connect, { ...args, scopes: ["documents:read"] }),
    ).rejects.toThrow("ACCESS_DENIED");
    const outsider = t.withIdentity({
      subject: "mcp-other",
      email: "other@example.com",
      emailVerified: true,
    });
    await expect(outsider.mutation(api.mcp.revoke, { id })).rejects.toThrow(
      "ACCESS_DENIED",
    );
  });
});
