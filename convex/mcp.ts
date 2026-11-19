import { v, ConvexError } from "convex/values";
import { query, internalQuery } from "./_generated/server";
import { mutation, internalMutation } from "./functions";
import { anyApi } from "convex/server";
import {
  getActor,
  requireBusinessAccess,
  recordAccountantActivity,
} from "./lib/accountantAccess";
import {
  beginDashboardReviewImpl,
  beginRequestImpl,
  savePlanImpl,
  startPreparationImpl,
  prepareBatchImpl,
} from "./caylaAgent";
import { validateMcpInput } from "../shared/mcpInputs";
import { historyAccessible } from "./usage";
import { validatePeriod } from "./lib/caylaAgentPolicy";
const api: any = anyApi;
export const SCOPES = [
  "clients:read",
  "documents:read",
  "payroll:read",
  "payroll:prepare",
  "reminders:prepare",
];
function fail(code: string): never {
  throw new ConvexError({
    code,
    message:
      code === "RATE_LIMITED"
        ? "Too many requests. Try again later."
        : "The requested Sheetpay operation is not authorized or is unavailable.",
  });
}
export function scopedContext(ctx: any, user: any) {
  return {
    ...ctx,
    mcpClientOnly: true,
    auth: {
      ...ctx.auth,
      getUserIdentity: async () => ({
        subject: user.firebaseUid,
        email: user.email,
        emailVerified: user.emailVerified === true,
        issuer: "https://securetoken.google.com/myglowtext",
        tokenIdentifier: `mcp|${user.firebaseUid}`,
      }),
    },
  };
}
async function membership(ctx: any, actor: any, ownerId: any) {
  const owner = await ctx.db.get(ownerId);
  if (!owner) fail("ACCESS_DENIED");
  if (actor._id !== ownerId) {
    const member = await ctx.db
      .query("accountantMemberships")
      .withIndex("by_workspace_member", (q: any) =>
        q.eq("workspaceOwnerId", ownerId).eq("memberUserId", actor._id),
      )
      .first();
    if (member?.status !== "active") fail("ACCESS_DENIED");
  }
  return owner;
}
export const configuration = query({
  args: {},
  handler: async (ctx) => {
    await getActor(ctx);
    const issuer = process.env.MCP_ISSUER_URL;
    return { endpoint: issuer ? `${issuer.replace(/\/$/, "")}/mcp` : null };
  },
});
export const organizations = query({
  args: {},
  handler: async (ctx) => {
    const { actor } = await getActor(ctx);
    const members = await ctx.db
      .query("accountantMemberships")
      .withIndex("by_member", (q) => q.eq("memberUserId", actor._id))
      .take(101);
    if (members.length > 100) fail("WORKSPACE_LIMIT");
    const ids = [
      actor._id,
      ...members
        .filter((m) => m.status === "active")
        .map((m) => m.workspaceOwnerId),
    ];
    const result = [];
    for (const id of new Set(ids)) {
      const u: any = await ctx.db.get(id);
      if (u) result.push({ id, name: u.displayName || "Accounting workspace" });
    }
    return result;
  },
});
export const connections = query({
  args: { cursor: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const { actor } = await getActor(ctx);
    const page = await ctx.db
      .query("mcpConnections")
      .withIndex("by_actor", (q) => q.eq("actorId", actor._id))
      .order("desc")
      .paginate({ cursor: args.cursor || null, numItems: 20 });
    const items = await Promise.all(
      page.page.map(async (r) => ({
        id: r._id,
        application: r.clientName,
        organizationId: r.ownerId,
        organization:
          (await ctx.db.get(r.ownerId))?.displayName || "Accounting workspace",
        scopes: r.scopes,
        createdAt: r.createdAt,
        expiresAt: r.expiresAt,
        lastUsedAt: r.lastUsedAt,
        revokedAt: r.revokedAt,
      })),
    );
    return { items, nextCursor: page.isDone ? null : page.continueCursor };
  },
});
export const connect = mutation({
  args: {
    ownerId: v.id("users"),
    clientId: v.string(),
    clientName: v.string(),
    grantId: v.string(),
    scopes: v.array(v.string()),
    proof: v.string(),
  },
  handler: async (ctx, a) => {
    const { actor } = await getActor(ctx);
    await membership(ctx, actor, a.ownerId);
    if (
      a.clientId.length > 200 ||
      a.clientName.length > 120 ||
      a.grantId.length > 200 ||
      !a.scopes.length ||
      a.scopes.some((s) => !SCOPES.includes(s))
    )
      fail("INVALID_REQUEST");
    const secret = process.env.MCP_STORAGE_SECRET;
    if (!secret || secret.length < 32) fail("NOT_CONFIGURED");
    if (!/^[a-f0-9]{64}$/.test(a.proof)) fail("ACCESS_DENIED");
    const message = JSON.stringify([
      actor.firebaseUid,
      a.ownerId,
      a.clientId,
      a.grantId,
      [...a.scopes].sort(),
    ]);
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    );
    const sig = Uint8Array.from(a.proof.match(/.{2}/g) || [], (x) =>
      parseInt(x, 16),
    );
    if (
      !(await crypto.subtle.verify(
        "HMAC",
        key,
        sig,
        new TextEncoder().encode(message),
      ))
    )
      fail("ACCESS_DENIED");
    const prior = await ctx.db
      .query("mcpConnections")
      .withIndex("by_grant", (q) => q.eq("grantId", a.grantId))
      .first();
    if (prior) {
      if (
        prior.actorId !== actor._id ||
        prior.ownerId !== a.ownerId ||
        prior.clientId !== a.clientId ||
        prior.revokedAt ||
        JSON.stringify([...prior.scopes].sort()) !==
          JSON.stringify([...a.scopes].sort())
      )
        fail("ACCESS_DENIED");
      return prior._id;
    }
    const id = await ctx.db.insert("mcpConnections", {
      actorId: actor._id,
      ownerId: a.ownerId,
      firebaseUid: actor.firebaseUid!,
      clientId: a.clientId,
      clientName: a.clientName,
      grantId: a.grantId,
      scopes: a.scopes,
      createdAt: Date.now(),
      expiresAt: Date.now() + 2592000000,
    });
    await recordAccountantActivity(
      ctx,
      a.ownerId,
      actor._id,
      "mcp.connection_authorized",
    );
    return id;
  },
});
export const revoke = mutation({
  args: { id: v.id("mcpConnections") },
  handler: async (ctx, { id }) => {
    const { actor } = await getActor(ctx),
      r = await ctx.db.get(id);
    if (!r || r.actorId !== actor._id) fail("ACCESS_DENIED");
    await ctx.db.patch(id, { revokedAt: Date.now() });
    await recordAccountantActivity(
      ctx,
      r.ownerId,
      actor._id,
      "mcp.connection_revoked",
    );
  },
});
export const principal = v.object({
  sub: v.string(),
  connectionId: v.id("mcpConnections"),
  clientId: v.string(),
  grantId: v.string(),
  jti: v.string(),
  scopes: v.array(v.string()),
});
export async function access(ctx: any, p: any, scope?: string) {
  const c = await ctx.db.get(p.connectionId);
  if (
    !c ||
    c.revokedAt ||
    (c.expiresAt && c.expiresAt <= Date.now()) ||
    c.firebaseUid !== p.sub ||
    c.clientId !== p.clientId ||
    c.grantId !== p.grantId
  )
    fail("ACCESS_DENIED");
  const token = await ctx.db
    .query("mcpOAuthRecords")
    .withIndex("by_key", (q: any) =>
      q.eq("model", "AccessToken").eq("key", p.jti),
    )
    .first();
  const grant = await ctx.db
    .query("mcpOAuthRecords")
    .withIndex("by_key", (q: any) =>
      q.eq("model", "Grant").eq("key", p.grantId),
    )
    .first();
  if (
    !token ||
    token.grantId !== p.grantId ||
    token.expiresAt <= Date.now() ||
    !grant ||
    grant.expiresAt <= Date.now()
  )
    fail("TOKEN_REVOKED");
  if (scope && (!c.scopes.includes(scope) || !p.scopes.includes(scope)))
    fail("INSUFFICIENT_SCOPE");
  const user = await ctx.db.get(c.actorId);
  if (!user || user.firebaseUid !== p.sub) fail("ACCESS_DENIED");
  const owner = await membership(ctx, user, c.ownerId);
  return { c, user, owner, ctx: scopedContext(ctx, user) };
}
const required: Record<string, string> = {
  list_clients: "clients:read",
  get_missing_documents: "documents:read",
  get_payroll_status: "payroll:read",
  get_payroll_preview: "payroll:read",
  get_preparation_status: "payroll:read",
  prepare_payroll: "payroll:prepare",
  prepare_client_reminders: "reminders:prepare",
};
async function clientAccess(ctx: any, a: any, id: any, cap = "read") {
  const b = id ? await ctx.db.get(id) : null;
  if (!b || b.userId !== a.c.ownerId) fail("ACCESS_DENIED");
  await requireBusinessAccess(a.ctx, b, cap as any);
  return b;
}
function compactJob(job: any, command: any) {
  return {
    jobId: job._id,
    clientId: job.businessId,
    commandId: job.commandId,
    status: job.status,
    approvalStatus: command.approvalStatus,
    version: command.updatedAt,
    expiresAt: command.expiresAt,
    reviewRequired: true,
  };
}
export const execute = internalMutation({
  args: { principal, tool: v.string(), input: v.any(), requestId: v.string() },
  handler: async (ctx, a) => {
    if (!required[a.tool]) fail("UNKNOWN_TOOL");
    const x = await access(ctx, a.principal, required[a.tool]);
    const window = Math.floor(Date.now() / 60000),
      r = await ctx.db
        .query("mcpRateWindows")
        .withIndex("by_actor_owner", (q) =>
          q.eq("actorId", x.c.actorId).eq("ownerId", x.c.ownerId),
        )
        .first();
    if (r?.window === window && r.count >= 60) fail("RATE_LIMITED");
    if (r)
      await ctx.db.patch(r._id, {
        window,
        count: r.window === window ? r.count + 1 : 1,
      });
    else
      await ctx.db.insert("mcpRateWindows", {
        actorId: x.c.actorId,
        ownerId: x.c.ownerId,
        window,
        count: 1,
      });
    const i = validateMcpInput(a.tool, a.input);
    let result: any;
    if (a.tool === "list_clients") {
      const directory = i.search
        ? ctx.db
            .query("businessDirectory")
            .withSearchIndex("search_name", (q) =>
              q.search("name", i.search).eq("userId", x.c.ownerId),
            )
        : ctx.db
            .query("businessDirectory")
            .withIndex("by_user", (q) => q.eq("userId", x.c.ownerId));
      const page = await directory.paginate({
        cursor: i.cursor || null,
        numItems: i.limit,
      });
      const items = [];
      for (const row of page.page) {
        try {
          await clientAccess(ctx, x, row.sourceId);
          items.push({
            id: row.sourceId,
            name: row.name.slice(0, 200),
            country: row.countryCode,
            currency: row.currency,
          });
        } catch {
          /* Do not disclose unassigned clients. */
        }
      }
      result = { items, nextCursor: page.isDone ? null : page.continueCursor };
    } else if (
      ["get_preparation_status", "get_payroll_preview"].includes(a.tool)
    ) {
      const jobId = ctx.db.normalizeId("mcpJobs", i.jobId);
      if (!jobId) fail("INVALID_REQUEST");
      const job = await ctx.db.get(jobId);
      if (!job || job.connectionId !== x.c._id) fail("ACCESS_DENIED");
      const client = await clientAccess(ctx, x, job.businessId);
      const command = await ctx.db.get(job.commandId);
      if (!command || command.actorId !== x.user._id) fail("ACCESS_DENIED");
      const prepared = await ctx.db
        .query("caylaPreparedClients")
        .withIndex("by_command", (q) => q.eq("commandId", job.commandId))
        .take(2);
      result = {
        ...compactJob(job, command),
        status:
          command.expiresAt < Date.now()
            ? "expired"
            : job.sourceRevision !== (client.complianceRevision || 0)
              ? "stale"
              : job.status,
        summary: command.summary,
        totals: prepared.map((p) => ({
          gross: p.totalGross,
          deductions: p.totalDeductions,
          net: p.totalNet,
          currency: p.currency,
          period: {
            start: p.periodStart,
            end: p.periodEnd,
            payDate: p.payDate,
          },
          ready: p.ready,
          needsReview: p.review,
          blocked: p.blocking,
        })),
        error: job.error,
      };
    } else {
      const b = await clientAccess(
        ctx,
        x,
        i.clientId,
        ["prepare_payroll", "prepare_client_reminders"].includes(a.tool)
          ? "runPayroll"
          : "read",
      );
      if (a.tool === "get_missing_documents") {
        const page = await ctx.db
          .query("practiceRequests")
          .withIndex("by_business_status_due", (q) =>
            q.eq("businessId", b._id).eq("status", "requested"),
          )
          .paginate({
            cursor: i.cursor || null,
            numItems: Math.min(i.limit || 20, 50),
          });
        result = {
          items: page.page
            .filter((d) => d.ownerId === x.c.ownerId)
            .map((d) => ({
              id: d._id,
              title: d.title.slice(0, 200),
              dueAt: d.dueAt,
              status: d.status,
            })),
          nextCursor: page.isDone ? null : page.continueCursor,
        };
      } else if (a.tool === "get_payroll_status") {
        const page = await ctx.db
          .query("payrollRunSummaries")
          .withIndex("by_business_created", (q) => q.eq("businessId", b._id))
          .order("desc")
          .paginate({
            cursor: i.cursor || null,
            numItems: Math.min(i.limit || 10, 20),
          });
        result = {
          clientId: b._id,
          runs: page.page
            .filter((p) => historyAccessible(x.owner, p.createdAt))
            .map((p) => ({
              id: p.runId,
              period: p.periodLabel,
              month: p.month,
              year: p.year,
              status: p.status,
              gross: p.totalGross,
              deductions: p.totalDeductions,
              net: p.totalNet,
              currency: p.currencyCode,
              employeeCount: p.employeeCount,
            })),
          nextCursor: page.isDone ? null : page.continueCursor,
        };
      } else {
        const key = `${a.tool}:${i.idempotencyKey}`,
          serialized = JSON.stringify(
            Object.fromEntries(
              Object.entries(i).sort(([a], [b]) => a.localeCompare(b)),
            ),
          ),
          prior = await ctx.db
            .query("mcpJobs")
            .withIndex("by_key", (q) =>
              q.eq("connectionId", x.c._id).eq("key", key),
            )
            .first();
        if (prior) {
          if (prior.input !== serialized) fail("IDEMPOTENCY_CONFLICT");
          const c = await ctx.db.get(prior.commandId);
          result = compactJob(prior, c);
          if (a.tool === "prepare_client_reminders")
            result = {
              ...result,
              recipients: [{ role: "accountant", workspaceId: x.c.ownerId }],
              messagePreview: `Payroll reminder for ${b.name} on ${i.reminderDate} at ${i.reminderTime} (${i.timezone})`,
              delivery: "in_app_after_review_only",
            };
        } else {
          validatePeriod(i.periodStart, i.periodEnd, i.payDate);
          const requestKey = crypto.randomUUID().replace(/-/g, "");
          let begun: any;
          if (a.tool === "prepare_client_reminders") {
            begun = await beginRequestImpl(x.ctx, {
              businessId: b._id,
              requestKey,
              timezone: i.timezone,
              source: "text",
              context: { view: "Reminders" },
            });
            await savePlanImpl(x.ctx, {
              commandId: begun.commandId,
              intent: {
                action: "reminder",
                scope: "current",
                clientIds: [b._id],
                periodStart: i.periodStart,
                periodEnd: i.periodEnd,
                payDate: i.payDate,
                reminderDate: i.reminderDate,
                reminderTime: i.reminderTime,
              },
            });
          } else {
            const employees = await ctx.db
              .query("employees")
              .withIndex("by_business", (q) => q.eq("businessId", b._id))
              .take(2501);
            if (employees.length > 2500) fail("CLIENT_TOO_LARGE");
            const ids = employees
              .filter(
                (e) => !["inactive", "deleted"].includes(String(e.status)),
              )
              .map((e) => e._id);
            if (!ids.length) fail("NO_EMPLOYEES");
            begun = await beginDashboardReviewImpl(x.ctx, {
              businessId: b._id,
              employeeIds: ids,
              periodStart: i.periodStart,
              periodEnd: i.periodEnd,
              payDate: i.payDate,
              timezone: i.timezone,
              requestKey,
            });
          }
          const jobId = await ctx.db.insert("mcpJobs", {
            connectionId: x.c._id,
            actorId: x.user._id,
            ownerId: x.c.ownerId,
            businessId: b._id,
            key,
            input: serialized,
            kind: a.tool,
            sourceRevision: b.complianceRevision || 0,
            commandId: begun.commandId,
            status: "queued",
            token: crypto.randomUUID(),
            createdAt: Date.now(),
            updatedAt: Date.now(),
          });
          await ctx.scheduler.runAfter(0, api.mcp.advance, { id: jobId });
          const job = await ctx.db.get(jobId),
            c = await ctx.db.get(begun.commandId);
          result = compactJob(job, c);
          if (a.tool === "prepare_client_reminders")
            result = {
              ...result,
              recipients: [{ role: "accountant", workspaceId: x.c.ownerId }],
              messagePreview: `Payroll reminder for ${b.name} on ${i.reminderDate} at ${i.reminderTime} (${i.timezone})`,
              delivery: "in_app_after_review_only",
            };
        }
      }
    }
    if (!x.c.lastUsedAt || Date.now() - x.c.lastUsedAt > 60000)
      await ctx.db.patch(x.c._id, { lastUsedAt: Date.now() });
    await recordAccountantActivity(
      ctx,
      x.c.ownerId,
      x.user._id,
      `mcp.${a.tool}`,
      i.clientId,
      {
        requestId: a.requestId,
        status: "success",
        resourceId: i.jobId || i.clientId || "",
      },
    );
    return result;
  },
});
export const advance = internalMutation({
  args: { id: v.id("mcpJobs") },
  handler: async (ctx, { id }) => {
    const job = await ctx.db.get(id);
    if (!job || !["queued", "running"].includes(job.status)) return;
    try {
      const connection = await ctx.db.get(job.connectionId);
      if (
        !connection ||
        connection.revokedAt ||
        !connection.scopes.includes(required[job.kind])
      )
        fail("CONNECTION_REVOKED");
      const user = await ctx.db.get(job.actorId);
      if (!user) fail("ACCESS_DENIED");
      await membership(ctx, user, job.ownerId);
      const scoped = scopedContext(ctx, user);
      await requireBusinessAccess(
        scoped,
        await ctx.db.get(job.businessId),
        "runPayroll",
      );
      if (job.status === "queued") {
        await startPreparationImpl(scoped, {
          commandId: job.commandId,
          token: job.token,
        });
        await ctx.db.patch(id, { status: "running", updatedAt: Date.now() });
      }
      const progress = await prepareBatchImpl(scoped, {
        commandId: job.commandId,
        token: job.token,
      });
      if (progress.done) {
        const c = await ctx.db.get(job.commandId);
        await ctx.db.patch(id, {
          status: c?.status === "review" ? "review" : "needs_attention",
          updatedAt: Date.now(),
        });
      } else await ctx.scheduler.runAfter(100, api.mcp.advance, { id });
    } catch {
      await ctx.db.patch(id, {
        status: "needs_attention",
        error:
          "Preparation stopped. Review access, dates and source records in Sheetpay.",
        updatedAt: Date.now(),
      });
    }
  },
});

export const auditDenied = internalMutation({
  args: {
    principal,
    tool: v.string(),
    requestId: v.string(),
    resourceReference: v.optional(v.string()),
  },
  handler: async (ctx, a) => {
    const c = await ctx.db.get(a.principal.connectionId);
    if (
      c &&
      c.firebaseUid === a.principal.sub &&
      c.clientId === a.principal.clientId &&
      c.grantId === a.principal.grantId
    ) {
      const window = Math.floor(Date.now() / 60000);
      const r = await ctx.db
        .query("mcpRateWindows")
        .withIndex("by_actor_owner", (q) =>
          q.eq("actorId", c.actorId).eq("ownerId", c.ownerId),
        )
        .first();
      if (r)
        await ctx.db.patch(r._id, {
          window,
          count: r.window === window ? Math.min(61, r.count + 1) : 1,
        });
      else
        await ctx.db.insert("mcpRateWindows", {
          actorId: c.actorId,
          ownerId: c.ownerId,
          window,
          count: 1,
        });
      await recordAccountantActivity(
        ctx,
        c.ownerId,
        c.actorId,
        `mcp.denied.${a.tool.slice(0, 80)}`,
        undefined,
        {
          requestId: a.requestId,
          status: "denied",
          resourceId: a.resourceReference?.slice(0, 128) || "",
        },
      );
    }
  },
});
