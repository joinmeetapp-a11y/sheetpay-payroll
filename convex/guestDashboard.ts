import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days
const MAX_CLIENTS = 1;
const MAX_EMPLOYEES = 50;
const MAX_PAYROLL_RUNS = 1;
const MAX_OCR_SCANS = 6; // guard against runaway upload loops
const MAX_PAYLOAD_BYTES = 512 * 1024; // ~0.5MB per patch

function estimateSize(value: unknown): number {
  try {
    return JSON.stringify(value ?? null).length;
  } catch {
    return 0;
  }
}

function assertPayloadSize(value: unknown) {
  if (estimateSize(value) > MAX_PAYLOAD_BYTES) {
    throw new Error("GUEST_PAYLOAD_TOO_LARGE");
  }
}

/**
 * Look up (or create on first read) the guest session row keyed by the
 * opaque anonymous session id the client generates and stores in
 * sessionStorage. All guest funnel state is scoped to this row so nothing
 * leaks between visitors.
 */
export const getOrCreate = mutation({
  args: { anonSessionId: v.string(), utm: v.optional(v.any()) },
  handler: async (ctx, { anonSessionId, utm }) => {
    if (!anonSessionId || anonSessionId.length < 8 || anonSessionId.length > 128) {
      throw new Error("INVALID_SESSION_ID");
    }
    const existing = await ctx.db
      .query("guestSessions")
      .withIndex("by_anon", (q) => q.eq("anonSessionId", anonSessionId))
      .unique();
    if (existing) return existing._id;

    const now = Date.now();
    return await ctx.db.insert("guestSessions", {
      anonSessionId,
      createdAt: now,
      updatedAt: now,
      expiresAt: now + SESSION_TTL_MS,
      guestClientsUsed: 0,
      guestEmployeesUsed: 0,
      guestPayrollRunsUsed: 0,
      ocrScansUsed: 0,
      utm,
    });
  },
});

export const get = query({
  args: { anonSessionId: v.string() },
  handler: async (ctx, { anonSessionId }) => {
    if (!anonSessionId) return null;
    const row = await ctx.db
      .query("guestSessions")
      .withIndex("by_anon", (q) => q.eq("anonSessionId", anonSessionId))
      .unique();
    return row ?? null;
  },
});

async function loadSession(ctx: any, anonSessionId: string) {
  const row = await ctx.db
    .query("guestSessions")
    .withIndex("by_anon", (q: any) => q.eq("anonSessionId", anonSessionId))
    .unique();
  if (!row) throw new Error("GUEST_SESSION_NOT_FOUND");
  if (row.converted) throw new Error("GUEST_SESSION_ALREADY_CONVERTED");
  if (row.expiresAt < Date.now()) throw new Error("GUEST_SESSION_EXPIRED");
  return row;
}

/**
 * Create the single allowed guest client. Server-side enforcement of the
 * "one client" limit — the UI hides the Add-Client button after the first,
 * but any attempt to write a second one from a tampered request rejects here.
 */
export const upsertClient = mutation({
  args: { anonSessionId: v.string(), client: v.any() },
  handler: async (ctx, { anonSessionId, client }) => {
    assertPayloadSize(client);
    const row = await loadSession(ctx, anonSessionId);
    const wasEmpty = !row.client;
    if (wasEmpty && row.guestClientsUsed >= MAX_CLIENTS) {
      throw new Error("GUEST_LIMIT_CLIENTS");
    }
    await ctx.db.patch(row._id, {
      client,
      guestClientsUsed: wasEmpty ? row.guestClientsUsed + 1 : row.guestClientsUsed,
      updatedAt: Date.now(),
    });
    return { ok: true };
  },
});

/**
 * Replace the guest employees array. Enforces the 50-employee cap regardless
 * of how the client claims the list was built (manual, CSV, OCR — the cap is
 * on the final stored count, not per import method).
 */
export const setEmployees = mutation({
  args: { anonSessionId: v.string(), employees: v.array(v.any()) },
  handler: async (ctx, { anonSessionId, employees }) => {
    assertPayloadSize(employees);
    const row = await loadSession(ctx, anonSessionId);
    if (employees.length > MAX_EMPLOYEES) {
      throw new Error(`GUEST_LIMIT_EMPLOYEES:${employees.length}`);
    }
    await ctx.db.patch(row._id, {
      employees,
      guestEmployeesUsed: employees.length,
      updatedAt: Date.now(),
    });
    return { ok: true, count: employees.length };
  },
});

/**
 * Record the single allowed payroll run. A second attempt throws so the UI
 * can present the paywall — the stored row keeps the first payroll intact.
 */
export const savePayrollRun = mutation({
  args: { anonSessionId: v.string(), payrollRun: v.any() },
  handler: async (ctx, { anonSessionId, payrollRun }) => {
    assertPayloadSize(payrollRun);
    const row = await loadSession(ctx, anonSessionId);
    const wasEmpty = !row.payrollRun;
    if (wasEmpty && row.guestPayrollRunsUsed >= MAX_PAYROLL_RUNS) {
      throw new Error("GUEST_LIMIT_PAYROLL_RUNS");
    }
    await ctx.db.patch(row._id, {
      payrollRun,
      guestPayrollRunsUsed: wasEmpty
        ? row.guestPayrollRunsUsed + 1
        : row.guestPayrollRunsUsed,
      updatedAt: Date.now(),
    });
    return { ok: true };
  },
});

export const savePayslipCustomization = mutation({
  args: { anonSessionId: v.string(), customization: v.any() },
  handler: async (ctx, { anonSessionId, customization }) => {
    assertPayloadSize(customization);
    const row = await loadSession(ctx, anonSessionId);
    await ctx.db.patch(row._id, {
      payslipCustomization: customization,
      updatedAt: Date.now(),
    });
    return { ok: true };
  },
});

export const appendCaylaMessages = mutation({
  args: { anonSessionId: v.string(), messages: v.array(v.any()) },
  handler: async (ctx, { anonSessionId, messages }) => {
    assertPayloadSize(messages);
    const row = await loadSession(ctx, anonSessionId);
    const merged = [...(row.caylaMessages ?? []), ...messages].slice(-200);
    await ctx.db.patch(row._id, { caylaMessages: merged, updatedAt: Date.now() });
    return { ok: true };
  },
});

export const setPendingAction = mutation({
  args: { anonSessionId: v.string(), pendingAction: v.optional(v.string()) },
  handler: async (ctx, { anonSessionId, pendingAction }) => {
    const row = await loadSession(ctx, anonSessionId);
    await ctx.db.patch(row._id, { pendingAction, updatedAt: Date.now() });
    return { ok: true };
  },
});

/**
 * OCR quota check — throws before an expensive vision call so guests cannot
 * grind through OpenAI on the marketing page. Increments after success.
 */
export const assertAndIncrementOcr = mutation({
  args: { anonSessionId: v.string() },
  handler: async (ctx, { anonSessionId }) => {
    const row = await loadSession(ctx, anonSessionId);
    if (row.ocrScansUsed >= MAX_OCR_SCANS) {
      throw new Error("GUEST_LIMIT_OCR");
    }
    await ctx.db.patch(row._id, {
      ocrScansUsed: row.ocrScansUsed + 1,
      updatedAt: Date.now(),
    });
    return { ok: true, used: row.ocrScansUsed + 1, max: MAX_OCR_SCANS };
  },
});

export const guestLimitsPublic = query({
  args: {},
  handler: async () => ({
    maxClients: MAX_CLIENTS,
    maxEmployees: MAX_EMPLOYEES,
    maxPayrollRuns: MAX_PAYROLL_RUNS,
    maxOcrScans: MAX_OCR_SCANS,
  }),
});
