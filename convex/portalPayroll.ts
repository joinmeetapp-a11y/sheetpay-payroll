import { mutation, internalMutation } from "./_generated/server";
import { anyApi } from "convex/server";
import { v, ConvexError } from "convex/values";
import {
  requireBusinessAccess,
  recordAccountantActivity,
} from "./lib/accountantAccess";
import { calculateReviewEmployee } from "./lib/payrollReview";
import { validatePeriod, fingerprint } from "./lib/caylaAgentPolicy";
import { resolveRule } from "./countryPayroll";
import { validatePayrollSnapshot } from "./payrollRuns";
import { assertWithinLimit, reserveUsage, historyAccessible } from "./usage";
const canonical = (value: any): any =>
  Array.isArray(value)
    ? value.map(canonical)
    : value && typeof value === "object"
      ? Object.fromEntries(
          Object.keys(value)
            .sort()
            .filter((key) => value[key] !== undefined)
            .map((key) => [key, canonical(value[key])]),
        )
      : value;
const hashValue = (value: any) => fingerprint(canonical(value));
const deny = (message: string): never => {
  throw new ConvexError(message);
};
export const MAX_EMPLOYEES = 100;
export const createConnection = mutation({
  args: { businessId: v.id("businesses"), portalOrganizationId: v.string() },
  handler: async (ctx, args) => {
    const business = await ctx.db.get(args.businessId);
    const { actor, owner } = await requireBusinessAccess(
      ctx,
      business,
      "manageTeam",
    );
    const identity = await ctx.auth.getUserIdentity();
    if (actor._id !== owner._id || identity?.emailVerified !== true)
      deny(
        "Only the verified workspace owner can issue payroll API credentials",
      );
    if (!/^[A-Za-z0-9_-]{3,128}$/.test(args.portalOrganizationId))
      deny("Invalid portal organization ID");
    const current = await ctx.db
      .query("portalPayrollConnections")
      .withIndex("by_business", (q) => q.eq("businessId", args.businessId))
      .take(51);
    if (current.length >= 50)
      deny("Revoke unused connections before creating more");
    const apiKey =
      "sp_portal_" +
      crypto.randomUUID().replaceAll("-", "") +
      crypto.randomUUID().replaceAll("-", "");
    const id = await ctx.db.insert("portalPayrollConnections", {
      ...args,
      ownerId: owner._id,
      tokenHash: await hashValue(apiKey),
      createdAt: Date.now(),
      expiresAt: Date.now() + 365 * 86400000,
      windowStart: Date.now(),
      requests: 0,
    });
    await recordAccountantActivity(
      ctx,
      owner._id,
      actor._id,
      "portal_payroll.connection_created",
      args.businessId,
      { connectionId: id, portalOrganizationId: args.portalOrganizationId },
    );
    return { connectionId: id, apiKey, expiresAt: Date.now() + 365 * 86400000 };
  },
});
export const revokeConnection = mutation({
  args: { id: v.id("portalPayrollConnections") },
  handler: async (ctx, { id }) => {
    const grant = await ctx.db.get(id);
    if (!grant) deny("Connection not found");
    const business = await ctx.db.get(grant.businessId);
    const { actor, owner } = await requireBusinessAccess(
      ctx,
      business,
      "manageTeam",
    );
    if (actor._id !== owner._id)
      deny("Only the workspace owner can revoke credentials");
    await ctx.db.patch(id, { revokedAt: Date.now() });
    await recordAccountantActivity(
      ctx,
      owner._id,
      actor._id,
      "portal_payroll.connection_revoked",
      grant.businessId,
      { connectionId: id },
    );
    return { ok: true };
  },
});
const safeEmployee = (e: any) => ({
  id: String(e._id),
  name: e.name,
  employeeId: e.employeeId,
  position: e.position,
  payFrequency: e.payFrequency,
  status: e.status,
  basicPay: e.basicPay,
});
const publicDraft = (d: any) => ({
  id: String(d._id),
  reviewHash: d.reviewHash,
  period: d.period,
  rows: d.rows.map((e: any) => ({
    id: String(e._id),
    name: e.name,
    position: e.position,
    grossPay: e.grossPay,
    paye: e.paye,
    nis: e.nis,
    healthSurcharge: e.healthSurcharge,
    otherDeductions: e.otherDeductions,
    netPay: e.netPay,
    ruleVersion: e.statutoryData?.ruleVersion || "",
  })),
  issues: d.issues,
  totals: d.totals,
  status: d.status,
  runId: d.runId ? String(d.runId) : null,
  expiresAt: d.expiresAt,
});
async function prepareRows(
  ctx: any,
  business: any,
  employeeIds: string[],
  period: any,
) {
  const roster = await Promise.all(employeeIds.map((id) => ctx.db.get(id)));
  if (
    roster.some(
      (e) =>
        !e ||
        e.businessId !== business._id ||
        e.status !== "active" ||
        e.isDemo,
    )
  )
    deny("Choose active, non-demo employees belonging to this business");
  const rule = await resolveRule(
    ctx,
    business,
    String(business.countryCode || "").toUpperCase(),
    Number(period.payDate.slice(0, 4)),
    period.payDate,
    100,
  );
  const calculated = await Promise.all(
    roster.map((e) =>
      calculateReviewEmployee(ctx, business, e, roster, period, {}, rule),
    ),
  );
  const rows = calculated
    .map((r) => {
      if (!r.snapshot) return null;
      const { avatar, ...snapshot } = r.snapshot;
      return { ...snapshot, reviewStatus: r.status };
    })
    .filter(Boolean);
  const issues = calculated.flatMap((r, i) =>
    r.exceptions.map((e: any) => ({
      employeeId: employeeIds[i],
      name: roster[i].name,
      ...e,
    })),
  );
  const sum = (field: string) =>
    Number(rows.reduce((n, e) => n + Number(e[field] || 0), 0).toFixed(2));
  const totals = {
    gross: sum("grossPay"),
    paye: sum("paye"),
    nis: sum("nis"),
    healthSurcharge: sum("healthSurcharge"),
    otherDeductions: sum("otherDeductions"),
    net: sum("netPay"),
  };
  if (Object.values(totals).some((n) => !Number.isFinite(n) || n < 0))
    deny("Calculated payroll totals are invalid");
  return {
    rows,
    issues,
    totals,
    rosterHash: await hashValue(roster),
    reviewHash: await hashValue({
      businessId: business._id,
      currency: business.currency,
      countryCode: business.countryCode,
      period,
      rows,
      issues,
      totals,
    }),
  };
}
/** Only the HTTP boundary calls this. Every request revalidates the revocable business grant. */
export const execute = internalMutation({
  args: { token: v.string(), body: v.any() },
  handler: async (ctx, { token, body: b }): Promise<any> => {
    if (typeof token !== "string" || !/^sp_portal_[a-f0-9]{64}$/.test(token))
      deny("PAYROLL_UNAUTHORIZED");
    const tokenHash = await hashValue(token);
    const grant = await ctx.db
      .query("portalPayrollConnections")
      .withIndex("by_hash", (q) => q.eq("tokenHash", tokenHash))
      .unique();
    if (
      !grant ||
      grant.revokedAt ||
      grant.expiresAt <= Date.now() ||
      grant.portalOrganizationId !== b.organizationId
    )
      deny("PAYROLL_UNAUTHORIZED");
    const business = await ctx.db.get(grant.businessId),
      owner = await ctx.db.get(grant.ownerId);
    if (!business || !owner || business.userId !== grant.ownerId)
      deny("PAYROLL_UNAUTHORIZED");

    if (b.operation === "status")
      return {
        version: 1,
        connectionId: String(grant._id),
        business: {
          id: String(business._id),
          name: business.name,
          currency: business.currency,
          countryCode: business.countryCode || "",
        },
        maxEmployees: MAX_EMPLOYEES,
        expiresAt: grant.expiresAt,
      };
    if (b.operation === "employees") {
      const page = await ctx.db
        .query("employees")
        .withIndex("by_business", (q) => q.eq("businessId", business._id))
        .paginate({
          cursor: typeof b.cursor === "string" ? b.cursor : null,
          numItems: 25,
        });
      return {
        ...page,
        page: page.page
          .filter((e) => e.status === "active" && !e.isDemo)
          .map(safeEmployee),
      };
    }
    if (b.operation === "prepare") {
      try {
        validatePeriod(b.period?.start, b.period?.end, b.period?.payDate);
      } catch {
        deny("Choose a valid payroll period and pay date");
      }
      if (
        typeof b.key !== "string" ||
        b.key.length < 3 ||
        b.key.length > 200 ||
        !Array.isArray(b.employeeIds) ||
        !b.employeeIds.length ||
        b.employeeIds.length > MAX_EMPLOYEES ||
        new Set(b.employeeIds).size !== b.employeeIds.length
      )
        deny("Choose 1 to 100 unique employees and a request key");
      const employeeIds = b.employeeIds.map((id: any) =>
        ctx.db.normalizeId("employees", String(id)),
      );
      if (employeeIds.some((id: any) => !id)) deny("Invalid employee ID");
      const period = {
        start: b.period.start,
        end: b.period.end,
        payDate: b.period.payDate,
      };
      const requestHash = await hashValue({ employeeIds, period });
      const old = await ctx.db
        .query("portalPayrollDrafts")
        .withIndex("by_connection_key", (q) =>
          q.eq("connectionId", grant._id).eq("key", b.key),
        )
        .unique();
      if (old) {
        if (old.requestHash !== requestHash)
          deny("This request key was used for different payroll details");
        if (old.expiresAt <= Date.now() && old.status !== "approved")
          deny("Payroll draft expired; prepare a new draft");
        return publicDraft(old);
      }
      const result = await prepareRows(ctx, business, employeeIds, period);
      if (JSON.stringify(result).length > 500000)
        deny(
          "Choose fewer employees to keep this review within the response limit",
        );
      const id = await ctx.db.insert("portalPayrollDrafts", {
        connectionId: grant._id,
        key: b.key,
        requestHash,
        period,
        employeeIds,
        ...result,
        status: "prepared",
        createdAt: Date.now(),
        expiresAt: Date.now() + 2 * 86400000,
      });
      await recordAccountantActivity(
        ctx,
        owner._id,
        owner._id,
        "portal_payroll.prepared",
        business._id,
        { draftId: id, portalOrganizationId: grant.portalOrganizationId },
      );
      const cleanupId = await ctx.scheduler.runAfter(
        2 * 86400000,
        anyApi.portalPayroll.expireDraft,
        { id },
      );
      await ctx.db.patch(id, { cleanupId });
      return publicDraft((await ctx.db.get(id))!);
    }
    if (b.operation === "approve") {
      const id = ctx.db.normalizeId(
        "portalPayrollDrafts",
        String(b.draftId || ""),
      );
      const draft = id ? await ctx.db.get(id) : null;
      if (
        !draft ||
        draft.connectionId !== grant._id ||
        b.reviewHash !== draft.reviewHash ||
        b.confirmed !== true
      )
        deny("Payroll review confirmation is invalid");
      if (draft.status === "approved")
        return {
          status: "approved",
          runId: String(draft.runId),
          draftId: String(draft._id),
        };
      if (
        draft.expiresAt <= Date.now() ||
        draft.issues.some((i: any) => i.severity === "BLOCKING") ||
        draft.rows.length !== draft.employeeIds.length
      )
        deny(
          "Payroll has blocking issues or expired; prepare and review it again",
        );
      if (draft.issues.length && b.acknowledgeWarnings !== true)
        deny("Review and acknowledge all payroll warnings");
      const nowRows = await prepareRows(
        ctx,
        business,
        draft.employeeIds,
        draft.period,
      );
      if (
        nowRows.rosterHash !== draft.rosterHash ||
        nowRows.reviewHash !== draft.reviewHash
      )
        deny(
          "Employees or statutory rules changed; prepare and review payroll again",
        );
      await validatePayrollSnapshot(ctx, business._id, draft.rows);
      await assertWithinLimit(ctx, owner, "payroll");
      await assertWithinLimit(ctx, owner, "payslip", draft.rows.length);
      const totalDeductions = Number(
        (draft.totals.gross - draft.totals.net).toFixed(2),
      );
      const runId = await ctx.db.insert("payrollRuns", {
        businessId: business._id,
        userId: owner._id,
        month: new Date(draft.period.end + "T12:00:00Z").toLocaleString("en", {
          month: "long",
          timeZone: "UTC",
        }),
        year: Number(draft.period.end.slice(0, 4)),
        periodLabel: draft.period.start + " to " + draft.period.end,
        status: "approved",
        employeesSnapshot: draft.rows,
        totalGross: draft.totals.gross,
        totalPaye: draft.totals.paye,
        totalNis: draft.totals.nis,
        totalHealthSurcharge: draft.totals.healthSurcharge,
        totalDeductions,
        totalNet: draft.totals.net,
        countryCode: business.countryCode,
        currencyCode: business.currency,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      await reserveUsage(ctx, owner._id, "payroll", "payroll:" + runId);
      await reserveUsage(
        ctx,
        owner._id,
        "payslip",
        "payslips:" + runId,
        draft.rows.length,
      );
      if (draft.cleanupId) await ctx.scheduler.cancel(draft.cleanupId);
      await ctx.db.patch(draft._id, {
        status: "approved",
        runId,
        cleanupId: undefined,
      });
      await recordAccountantActivity(
        ctx,
        owner._id,
        owner._id,
        "portal_payroll.approved",
        business._id,
        {
          runId,
          draftId: draft._id,
          portalOrganizationId: grant.portalOrganizationId,
          portalActor:
            typeof b.actor === "string" ? b.actor.slice(0, 128) : "portal",
        },
      );
      return {
        status: "approved",
        runId: String(runId),
        draftId: String(draft._id),
      };
    }
    if (b.operation === "history") {
      const page = await ctx.db
        .query("payrollRuns")
        .withIndex("by_business", (q) => q.eq("businessId", business._id))
        .order("desc")
        .paginate({
          cursor: typeof b.cursor === "string" ? b.cursor : null,
          numItems: 20,
        });
      return {
        ...page,
        page: page.page
          .filter((r) => historyAccessible(owner, r.createdAt))
          .map((r) => ({
            id: String(r._id),
            period: r.periodLabel,
            status: r.status,
            totalGross: r.totalGross,
            totalNet: r.totalNet,
            currency: r.currencyCode || business.currency,
            employeeCount: r.employeesSnapshot.length,
          })),
      };
    }
    if (b.operation === "run") {
      const id = ctx.db.normalizeId("payrollRuns", String(b.runId || ""));
      const run = id ? await ctx.db.get(id) : null;
      if (
        !run ||
        run.businessId !== business._id ||
        !historyAccessible(owner, run.createdAt)
      )
        deny("Payroll run not found");
      if (run.employeesSnapshot.length > MAX_EMPLOYEES)
        deny(
          "This run exceeds the portal response limit; open it in Sheetpay Accountant",
        );
      return {
        id: String(run._id),
        business: { name: business.name, currency: business.currency },
        period: run.periodLabel,
        status: run.status,
        rows: run.employeesSnapshot.map((e: any) => ({
          id: String(e._id),
          name: e.name,
          position: e.position,
          grossPay: e.grossPay,
          paye: e.paye,
          nis: e.nis,
          healthSurcharge: e.healthSurcharge,
          otherDeductions: e.otherDeductions,
          netPay: e.netPay,
        })),
        totalGross: run.totalGross,
        totalNet: run.totalNet,
      };
    }
    if (b.operation === "payslip") {
      const runId = ctx.db.normalizeId("payrollRuns", String(b.runId || "")),
        employeeId = ctx.db.normalizeId(
          "employees",
          String(b.employeeId || ""),
        );
      const run = runId ? await ctx.db.get(runId) : null;
      if (
        !run ||
        run.businessId !== business._id ||
        !historyAccessible(owner, run.createdAt) ||
        !employeeId ||
        !run.employeesSnapshot.some(
          (e: any) => String(e._id) === String(employeeId),
        )
      )
        deny("Payslip not found");
      const file = await ctx.db
        .query("bulkPayslipUploads")
        .withIndex("by_run_employee_version", (q) =>
          q
            .eq("payrollRunId", run._id)
            .eq("employeeId", employeeId)
            .eq("payrollRunUpdatedAt", run.updatedAt)
            .eq("status", "ready"),
        )
        .order("desc")
        .first();
      if (
        !file ||
        file.expiresAt <= Date.now() ||
        file.businessId !== business._id
      )
        deny(
          "No saved PDF is available for this employee and run. Generate and save the payslip in Sheetpay Accountant first.",
        );
      const url = await ctx.storage.getUrl(file.storageId);
      if (!url) deny("Saved payslip is no longer available");
      return { url };
    }
    deny("Unknown payroll API operation");
  },
});

export const consumeRate = internalMutation({
  args: { token: v.string(), organizationId: v.string() },
  handler: async (ctx, { token, organizationId }) => {
    if (!/^sp_portal_[a-f0-9]{64}$/.test(token)) deny("PAYROLL_UNAUTHORIZED");
    const hash = await hashValue(token);
    const grant = await ctx.db
      .query("portalPayrollConnections")
      .withIndex("by_hash", (q) => q.eq("tokenHash", hash))
      .unique();
    if (
      !grant ||
      grant.revokedAt ||
      grant.expiresAt <= Date.now() ||
      grant.portalOrganizationId !== organizationId
    )
      deny("PAYROLL_UNAUTHORIZED");
    const fresh = Date.now() - grant.windowStart >= 60000;
    if (!fresh && grant.requests >= 30) deny("PAYROLL_RATE_LIMITED");
    await ctx.db.patch(grant._id, {
      windowStart: fresh ? Date.now() : grant.windowStart,
      requests: fresh ? 1 : grant.requests + 1,
    });
    return { ok: true };
  },
});

export const expireDraft = internalMutation({
  args: { id: v.id("portalPayrollDrafts") },
  handler: async (ctx, { id }) => {
    const draft = await ctx.db.get(id);
    if (draft && draft.status !== "approved" && draft.expiresAt <= Date.now())
      await ctx.db.delete(id);
  },
});
