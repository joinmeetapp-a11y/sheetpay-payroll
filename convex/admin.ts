import { query, mutation, internalMutation, QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { paginationOptsValidator } from "convex/server";

/**
 * Seed super_admin allowlist. On first read the adminRoles table is
 * consulted; if empty we fall back to this list so the founder can bootstrap.
 * All non-seed grants happen via the grantRole mutation, which writes to
 * adminRoles and to the immutable adminAuditLogs.
 */
export const ADMIN_EMAILS = ["antoniokurt23@gmail.com"];

export function isAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.map((e) => e.toLowerCase()).includes(email.toLowerCase());
}

type AdminRole = "super_admin" | "admin" | "finance" | "support" | "analytics";

interface AuthContext {
  userId: Id<"users">;
  email: string;
  role: AdminRole;
}

/**
 * Resolve the calling user's admin role. Returns null when not an admin.
 * All admin queries/mutations MUST call this before returning data. Do not
 * rely on the client hiding /admin — the browser is not a security boundary.
 */
async function resolveAdmin(
  ctx: QueryCtx,
  requesterUid: string | undefined
): Promise<AuthContext | null> {
  if (!requesterUid) return null;
  const user = await ctx.db
    .query("users")
    .withIndex("by_firebase_uid", (q) => q.eq("firebaseUid", requesterUid))
    .first();
  if (!user) return null;

  const roleRow = await ctx.db
    .query("adminRoles")
    .withIndex("by_user", (q) => q.eq("userId", user._id))
    .first();

  if (roleRow) {
    return { userId: user._id, email: user.email, role: roleRow.role };
  }
  if (isAdminEmail(user.email)) {
    return { userId: user._id, email: user.email, role: "super_admin" };
  }
  return null;
}

/** Roles allowed to see a given capability. Enforced server-side. */
const ROLE_CAPS: Record<string, ReadonlyArray<AdminRole>> = {
  overview: ["super_admin", "admin", "finance", "support", "analytics"],
  users: ["super_admin", "admin", "support"],
  subscriptions: ["super_admin", "admin", "finance"],
  revenue: ["super_admin", "admin", "finance"],
  analytics: ["super_admin", "admin", "analytics"],
  seo: ["super_admin", "admin", "analytics"],
  payroll: ["super_admin", "admin", "support"],
  cayla: ["super_admin", "admin", "analytics", "finance"],
  system: ["super_admin", "admin"],
  grantRole: ["super_admin"],
};

function can(role: AdminRole, cap: keyof typeof ROLE_CAPS): boolean {
  return ROLE_CAPS[cap].includes(role);
}

const PLAN_PRICE_USD: Record<string, number> = {
  pro: 29,
  accountant: 99,
  free: 0,
};

function isPaidUser(u: { plan?: string; planStatus?: string }): boolean {
  const plan = u.plan ?? "free";
  if (plan === "free") return false;
  const status = u.planStatus ?? "active";
  return status === "active" || status === "pending";
}

// ─── Overview ───────────────────────────────────────────────────────────────

export const getOverview = query({
  args: { requesterUid: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const auth = await resolveAdmin(ctx, args.requesterUid);
    if (!auth || !can(auth.role, "overview")) return { authorized: false as const };

    // NOTE: this scans the users/payrollRuns tables. For > ~100k rows switch
    // to reading the aggregated dailyMetrics table populated by the nightly
    // job in convex/analyticsAggregation.ts (to be added — see TODO).
    const users = await ctx.db.query("users").collect();
    const payrollRuns = await ctx.db.query("payrollRuns").collect();
    const employees = await ctx.db.query("employees").collect();
    const conversations = await ctx.db.query("caylaConversations").collect();
    const caylaUsage = await ctx.db.query("caylaUsageLogs").collect();

    let paid = 0;
    let free = 0;
    let mrr = 0;
    const byPlan: Record<string, number> = { free: 0, pro: 0, accountant: 0 };
    const byAccountType: Record<string, number> = { business: 0, accountant: 0 };
    const byStatus: Record<string, number> = {};

    for (const u of users) {
      const plan = (u.plan ?? "free") as string;
      byPlan[plan] = (byPlan[plan] ?? 0) + 1;
      byAccountType[u.accountType] = (byAccountType[u.accountType] ?? 0) + 1;
      const status = u.planStatus ?? (plan === "free" ? "none" : "active");
      byStatus[status] = (byStatus[status] ?? 0) + 1;
      if (isPaidUser(u)) {
        paid += 1;
        mrr += PLAN_PRICE_USD[plan] ?? 0;
      } else {
        free += 1;
      }
    }

    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    const signupsByDay: { date: string; count: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const start = now - i * dayMs;
      const dayStart = new Date(start).setHours(0, 0, 0, 0);
      const dayEnd = dayStart + dayMs;
      const count = users.filter((u) => u.createdAt >= dayStart && u.createdAt < dayEnd).length;
      signupsByDay.push({ date: new Date(dayStart).toISOString().slice(0, 10), count });
    }

    const newLast7 = users.filter((u) => u.createdAt >= now - 7 * dayMs).length;
    const newLast30 = users.filter((u) => u.createdAt >= now - 30 * dayMs).length;

    // Payslips ≈ total employee-rows across all runs. This is an estimate; a
    // dedicated payslips table would give exact counts and let each row track
    // delivery status separately.
    const payslipsGenerated = payrollRuns.reduce(
      (n, r) => n + (Array.isArray(r.employeesSnapshot) ? r.employeesSnapshot.length : 0),
      0
    );

    const caylaPayrollActions = caylaUsage.filter(
      (l) => l.action === "payroll_completed" || l.action === "cayla_payroll_completed"
    ).length;

    // Not yet tracked; return null so the UI can show "—" instead of "0".
    const ocrImports: number | null = null;

    return {
      authorized: true as const,
      role: auth.role,
      totals: {
        totalUsers: users.length,
        paidUsers: paid,
        freeUsers: free,
        businessAccounts: byAccountType.business ?? 0,
        accountantAccounts: byAccountType.accountant ?? 0,
        activeSubscriptions: byStatus.active ?? 0,
        canceledSubscriptions: byStatus.canceled ?? 0,
        pastDueSubscriptions: byStatus.past_due ?? 0,
        pausedSubscriptions: byStatus.paused ?? 0,
        mrr,
        arr: mrr * 12,
        monthlyRevenue: mrr,
        newUsersLast30: newLast30,
        newUsersLast7: newLast7,
        totalEmployees: employees.length,
        payrollsProcessed: payrollRuns.length,
        payslipsGenerated,
        ocrImports,
        caylaConversations: conversations.length,
        caylaPayrollActions,
      },
      byPlan,
      byAccountType,
      byStatus,
      signupsByDay,
    };
  },
});

// ─── Users ──────────────────────────────────────────────────────────────────

export const listUsers = query({
  args: {
    requesterUid: v.optional(v.string()),
    paginationOpts: paginationOptsValidator,
    search: v.optional(v.string()),
    plan: v.optional(v.string()),
    accountType: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const auth = await resolveAdmin(ctx, args.requesterUid);
    if (!auth || !can(auth.role, "users")) return { authorized: false as const };

    const page = await ctx.db.query("users").order("desc").paginate(args.paginationOpts);
    const search = args.search?.toLowerCase().trim();

    const filtered = page.page.filter((u) => {
      if (args.plan && (u.plan ?? "free") !== args.plan) return false;
      if (args.accountType && u.accountType !== args.accountType) return false;
      if (search) {
        const hay = `${u.email} ${u.displayName ?? ""}`.toLowerCase();
        if (!hay.includes(search)) return false;
      }
      return true;
    });

    // Enrich with counts per user (indexed lookups — no table scan)
    const enriched = await Promise.all(
      filtered.map(async (u) => {
        const [empCount, runCount, business] = await Promise.all([
          ctx.db
            .query("employees")
            .withIndex("by_user", (q) => q.eq("userId", u._id))
            .collect()
            .then((r) => r.length),
          ctx.db
            .query("payrollRuns")
            .withIndex("by_user", (q) => q.eq("userId", u._id))
            .collect()
            .then((r) => r.length),
          ctx.db
            .query("businesses")
            .withIndex("by_user", (q) => q.eq("userId", u._id))
            .first(),
        ]);
        return {
          id: u._id,
          email: u.email,
          displayName: u.displayName ?? "",
          accountType: u.accountType,
          plan: (u.plan ?? "free") as string,
          planStatus: u.planStatus ?? (u.plan && u.plan !== "free" ? "active" : "none"),
          country: business?.currency ?? null,
          employeeCount: empCount,
          payrollCount: runCount,
          joinedAt: u.createdAt,
          planUpdatedAt: u.planUpdatedAt ?? null,
        };
      })
    );

    return {
      authorized: true as const,
      users: enriched,
      continueCursor: page.continueCursor,
      isDone: page.isDone,
    };
  },
});

export const getUserDetail = query({
  args: { requesterUid: v.optional(v.string()), userId: v.id("users") },
  handler: async (ctx, args) => {
    const auth = await resolveAdmin(ctx, args.requesterUid);
    if (!auth || !can(auth.role, "users")) return { authorized: false as const };

    const user = await ctx.db.get(args.userId);
    if (!user) return { authorized: true as const, user: null };

    const [business, employees, runs, messages, caylaUsage] = await Promise.all([
      ctx.db
        .query("businesses")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .first(),
      ctx.db
        .query("employees")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .collect(),
      ctx.db
        .query("payrollRuns")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .collect(),
      ctx.db
        .query("messages")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .collect(),
      ctx.db
        .query("caylaUsageLogs")
        .withIndex("by_user_id", (q) => q.eq("userId", user._id))
        .collect(),
    ]);

    const paddleEvents = user.paddleCustomerId
      ? await ctx.db
          .query("paddleEvents")
          .withIndex("by_customer", (q) => q.eq("paddleCustomerId", user.paddleCustomerId!))
          .collect()
      : [];

    const caylaCostUsd = caylaUsage.reduce((s, l) => s + (l.estimatedCostUsd || 0), 0);

    return {
      authorized: true as const,
      user: {
        id: user._id,
        email: user.email,
        displayName: user.displayName ?? "",
        accountType: user.accountType,
        plan: user.plan ?? "free",
        planStatus: user.planStatus ?? "none",
        paddleCustomerId: user.paddleCustomerId ?? null,
        paddleSubscriptionId: user.paddleSubscriptionId ?? null,
        createdAt: user.createdAt,
        planUpdatedAt: user.planUpdatedAt ?? null,
      },
      business,
      employeeCount: employees.length,
      payrollCount: runs.length,
      messageCount: messages.length,
      caylaMessageCount: caylaUsage.length,
      caylaCostUsd,
      paddleEventCount: paddleEvents.length,
      recentPayrollRuns: [...runs]
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, 10)
        .map((r) => ({
          id: r._id,
          period: r.periodLabel ?? `${r.month} ${r.year}`,
          status: r.status,
          totalNet: r.totalNet,
          createdAt: r.createdAt,
        })),
    };
  },
});

// ─── Subscriptions & Revenue ────────────────────────────────────────────────

export const listSubscriptions = query({
  args: {
    requesterUid: v.optional(v.string()),
    paginationOpts: paginationOptsValidator,
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const auth = await resolveAdmin(ctx, args.requesterUid);
    if (!auth || !can(auth.role, "subscriptions")) return { authorized: false as const };

    const page = await ctx.db.query("users").order("desc").paginate(args.paginationOpts);
    const filtered = page.page.filter((u) => {
      if ((u.plan ?? "free") === "free") return false;
      if (args.status && (u.planStatus ?? "active") !== args.status) return false;
      return true;
    });

    return {
      authorized: true as const,
      subscriptions: filtered.map((u) => ({
        id: u._id,
        email: u.email,
        displayName: u.displayName ?? "",
        plan: u.plan ?? "free",
        planStatus: u.planStatus ?? "active",
        paddleCustomerId: u.paddleCustomerId ?? null,
        paddleSubscriptionId: u.paddleSubscriptionId ?? null,
        planUpdatedAt: u.planUpdatedAt ?? null,
      })),
      continueCursor: page.continueCursor,
      isDone: page.isDone,
    };
  },
});

export const getRevenue = query({
  args: { requesterUid: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const auth = await resolveAdmin(ctx, args.requesterUid);
    if (!auth || !can(auth.role, "revenue")) return { authorized: false as const };

    const users = await ctx.db.query("users").collect();
    let mrr = 0;
    const mrrByPlan: Record<string, number> = { pro: 0, accountant: 0 };
    for (const u of users) {
      if (!isPaidUser(u)) continue;
      const plan = u.plan ?? "free";
      const price = PLAN_PRICE_USD[plan] ?? 0;
      mrr += price;
      mrrByPlan[plan] = (mrrByPlan[plan] ?? 0) + price;
    }

    // Monthly cohort: users whose planUpdatedAt fell in each of the last 12
    // months, priced at their current plan. Real transaction totals come from
    // Paddle — see paddleEvents (transaction.completed) which we can sum
    // once we start storing amounts on each event row.
    const now = new Date();
    const months: { month: string; mrr: number; newPaid: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const start = d.getTime();
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime();
      const label = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const newPaid = users.filter(
        (u) =>
          isPaidUser(u) && (u.planUpdatedAt ?? u.createdAt) >= start && (u.planUpdatedAt ?? u.createdAt) < end
      ).length;
      months.push({ month: label, mrr, newPaid });
    }

    return {
      authorized: true as const,
      mrr,
      arr: mrr * 12,
      mrrByPlan,
      months,
    };
  },
});

// ─── Payroll ────────────────────────────────────────────────────────────────

export const getPayrollStats = query({
  args: { requesterUid: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const auth = await resolveAdmin(ctx, args.requesterUid);
    if (!auth || !can(auth.role, "payroll")) return { authorized: false as const };

    const runs = await ctx.db.query("payrollRuns").collect();
    const employees = await ctx.db.query("employees").collect();

    const runsByMonth: Record<string, number> = {};
    let totalNetPaid = 0;
    let totalPaye = 0;
    let totalNis = 0;
    for (const r of runs) {
      const key = `${r.year}-${String(r.month).padStart(2, "0")}`;
      runsByMonth[key] = (runsByMonth[key] ?? 0) + 1;
      totalNetPaid += r.totalNet ?? 0;
      totalPaye += r.totalPaye ?? 0;
      totalNis += r.totalNis ?? 0;
    }

    const recent = [...runs]
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 25)
      .map((r) => ({
        id: r._id,
        period: r.periodLabel ?? `${r.month} ${r.year}`,
        employeeCount: Array.isArray(r.employeesSnapshot) ? r.employeesSnapshot.length : 0,
        totalNet: r.totalNet,
        status: r.status,
        createdAt: r.createdAt,
      }));

    return {
      authorized: true as const,
      totalRuns: runs.length,
      totalEmployees: employees.length,
      totalNetPaid,
      totalPaye,
      totalNis,
      runsByMonth,
      recent,
    };
  },
});

// ─── Cayla cost analytics ───────────────────────────────────────────────────

export const getCaylaCosts = query({
  args: { requesterUid: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const auth = await resolveAdmin(ctx, args.requesterUid);
    if (!auth || !can(auth.role, "cayla")) return { authorized: false as const };

    const logs = await ctx.db.query("caylaUsageLogs").collect();

    let totalCost = 0;
    let inputTokens = 0;
    let outputTokens = 0;
    const byModel: Record<string, { calls: number; costUsd: number; inputTokens: number; outputTokens: number }> = {};
    const byUser: Record<string, { calls: number; costUsd: number }> = {};

    for (const l of logs) {
      totalCost += l.estimatedCostUsd || 0;
      inputTokens += l.inputTokens || 0;
      outputTokens += l.outputTokens || 0;
      const m = byModel[l.model] ?? { calls: 0, costUsd: 0, inputTokens: 0, outputTokens: 0 };
      m.calls += 1;
      m.costUsd += l.estimatedCostUsd || 0;
      m.inputTokens += l.inputTokens || 0;
      m.outputTokens += l.outputTokens || 0;
      byModel[l.model] = m;

      const u = byUser[l.userId] ?? { calls: 0, costUsd: 0 };
      u.calls += 1;
      u.costUsd += l.estimatedCostUsd || 0;
      byUser[l.userId] = u;
    }

    const topUsers = Object.entries(byUser)
      .map(([userId, v]) => ({ userId, ...v }))
      .sort((a, b) => b.costUsd - a.costUsd)
      .slice(0, 25);

    return {
      authorized: true as const,
      totalCalls: logs.length,
      totalCostUsd: totalCost,
      inputTokens,
      outputTokens,
      byModel,
      topUsers,
    };
  },
});

// ─── System health ──────────────────────────────────────────────────────────

export const getSystemHealth = query({
  args: { requesterUid: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const auth = await resolveAdmin(ctx, args.requesterUid);
    if (!auth || !can(auth.role, "system")) return { authorized: false as const };

    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;

    // Failed emails in last 24h — indexed scan via status field would need an
    // extra index; for now we scan by recipient index (still bounded).
    const recentEmails = await ctx.db.query("emailLogs").order("desc").take(500);
    const recentPaddle = await ctx.db.query("paddleEvents").order("desc").take(200);

    const failedEmails24h = recentEmails.filter(
      (e) =>
        (e.status === "bounced" || e.status === "failed" || e.status === "complained") &&
        e.createdAt >= now - dayMs
    ).length;

    const failedWebhooks24h = recentPaddle.filter(
      (e) => e.status === "failed" && e.receivedAt >= now - dayMs
    ).length;

    const ignoredWebhooks24h = recentPaddle.filter(
      (e) => e.status === "ignored" && e.receivedAt >= now - dayMs
    ).length;

    // Provider config presence — we don't ping the providers here (that'd be
    // a per-load fanout to 6 APIs). A separate scheduled probe should update
    // a health table; for now we report which credentials Convex sees.
    const providers = [
      { name: "Convex", ok: true, note: "Live" },
      { name: "Paddle", ok: !!process.env.PADDLE_WEBHOOK_SECRET, note: process.env.PADDLE_WEBHOOK_SECRET ? "Webhook verified" : "PADDLE_WEBHOOK_SECRET not set" },
      { name: "OpenAI", ok: !!process.env.OPENAI_API_KEY, note: process.env.OPENAI_API_KEY ? "Configured" : "OPENAI_API_KEY not set" },
      { name: "Resend", ok: !!process.env.RESEND_API_KEY, note: process.env.RESEND_API_KEY ? "Configured" : "RESEND_API_KEY not set" },
      { name: "Google Analytics", ok: !!process.env.GOOGLE_SERVICE_ACCOUNT_JSON && !!process.env.GA4_PROPERTY_ID, note: process.env.GA4_PROPERTY_ID ? `Property ${process.env.GA4_PROPERTY_ID}` : "GOOGLE_SERVICE_ACCOUNT_JSON + GA4_PROPERTY_ID required" },
      { name: "Search Console", ok: !!process.env.GOOGLE_SERVICE_ACCOUNT_JSON && !!process.env.SEARCH_CONSOLE_SITE_URL, note: process.env.SEARCH_CONSOLE_SITE_URL ? process.env.SEARCH_CONSOLE_SITE_URL : "SEARCH_CONSOLE_SITE_URL required" },
    ];

    return {
      authorized: true as const,
      failedEmails24h,
      failedWebhooks24h,
      ignoredWebhooks24h,
      providers,
      recentPaddleEvents: recentPaddle.slice(0, 20).map((e) => ({
        eventId: e.eventId,
        eventType: e.eventType,
        status: e.status,
        errorMessage: e.errorMessage ?? null,
        receivedAt: e.receivedAt,
      })),
    };
  },
});

// ─── Role management (super_admin only) ─────────────────────────────────────

export const listAdmins = query({
  args: { requesterUid: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const auth = await resolveAdmin(ctx, args.requesterUid);
    if (!auth) return { authorized: false as const };
    const rows = await ctx.db.query("adminRoles").collect();
    return {
      authorized: true as const,
      role: auth.role,
      admins: rows.map((r) => ({
        id: r._id,
        userId: r.userId,
        email: r.email,
        role: r.role,
        grantedAt: r.grantedAt,
      })),
    };
  },
});

export const grantRole = mutation({
  args: {
    requesterUid: v.string(),
    targetEmail: v.string(),
    role: v.union(
      v.literal("super_admin"),
      v.literal("admin"),
      v.literal("finance"),
      v.literal("support"),
      v.literal("analytics")
    ),
  },
  handler: async (ctx, args) => {
    const auth = await resolveAdmin(ctx, args.requesterUid);
    if (!auth || !can(auth.role, "grantRole")) throw new Error("Forbidden");

    const target = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("email"), args.targetEmail))
      .first();
    if (!target) throw new Error("User not found");

    const existing = await ctx.db
      .query("adminRoles")
      .withIndex("by_user", (q) => q.eq("userId", target._id))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, { role: args.role, grantedByUserId: auth.userId, grantedAt: Date.now() });
    } else {
      await ctx.db.insert("adminRoles", {
        userId: target._id,
        email: target.email,
        role: args.role,
        grantedByUserId: auth.userId,
        grantedAt: Date.now(),
      });
    }

    await ctx.db.insert("adminAuditLogs", {
      actorUserId: auth.userId,
      actorEmail: auth.email,
      action: "admin.role.grant",
      targetType: "user",
      targetId: target._id,
      details: JSON.stringify({ role: args.role, previous: existing?.role ?? null }),
      createdAt: Date.now(),
    });

    return { ok: true };
  },
});

export const revokeRole = mutation({
  args: { requesterUid: v.string(), targetUserId: v.id("users") },
  handler: async (ctx, args) => {
    const auth = await resolveAdmin(ctx, args.requesterUid);
    if (!auth || !can(auth.role, "grantRole")) throw new Error("Forbidden");

    const existing = await ctx.db
      .query("adminRoles")
      .withIndex("by_user", (q) => q.eq("userId", args.targetUserId))
      .first();
    if (!existing) return { ok: true };

    await ctx.db.delete(existing._id);
    await ctx.db.insert("adminAuditLogs", {
      actorUserId: auth.userId,
      actorEmail: auth.email,
      action: "admin.role.revoke",
      targetType: "user",
      targetId: args.targetUserId,
      details: JSON.stringify({ previous: existing.role }),
      createdAt: Date.now(),
    });
    return { ok: true };
  },
});

// ─── Legacy alias: keep the old getAnalytics query working ──────────────────

export const getAnalytics = query({
  args: { requesterUid: v.optional(v.string()) },
  handler: async (ctx, args) => {
    // Delegates to getOverview; the old admin dashboard component can keep
    // calling getAnalytics until its consumers are migrated.
    const auth = await resolveAdmin(ctx, args.requesterUid);
    if (!auth || !can(auth.role, "overview")) return { authorized: false as const };
    const users = await ctx.db.query("users").collect();

    let paid = 0;
    let free = 0;
    let mrr = 0;
    const byPlan: Record<string, number> = { free: 0, pro: 0, accountant: 0 };
    const byAccountType: Record<string, number> = { business: 0, accountant: 0 };
    const byStatus: Record<string, number> = {};

    for (const u of users) {
      const plan = (u.plan ?? "free") as string;
      byPlan[plan] = (byPlan[plan] ?? 0) + 1;
      byAccountType[u.accountType] = (byAccountType[u.accountType] ?? 0) + 1;
      const status = u.planStatus ?? (plan === "free" ? "none" : "active");
      byStatus[status] = (byStatus[status] ?? 0) + 1;
      if (isPaidUser(u)) {
        paid += 1;
        mrr += PLAN_PRICE_USD[plan] ?? 0;
      } else {
        free += 1;
      }
    }
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    const signupsByDay: { date: string; count: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const start = now - i * dayMs;
      const dayStart = new Date(start).setHours(0, 0, 0, 0);
      const dayEnd = dayStart + dayMs;
      const count = users.filter((u) => u.createdAt >= dayStart && u.createdAt < dayEnd).length;
      signupsByDay.push({ date: new Date(dayStart).toISOString().slice(0, 10), count });
    }
    const newLast7 = users.filter((u) => u.createdAt >= now - 7 * dayMs).length;
    const newLast30 = users.filter((u) => u.createdAt >= now - 30 * dayMs).length;
    const recentUsers = [...users]
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 100)
      .map((u) => ({
        id: u._id,
        email: u.email,
        displayName: u.displayName ?? "",
        accountType: u.accountType,
        plan: (u.plan ?? "free") as string,
        planStatus: u.planStatus ?? (u.plan && u.plan !== "free" ? "active" : "none"),
        paid: isPaidUser(u),
        createdAt: u.createdAt,
        planUpdatedAt: u.planUpdatedAt ?? null,
      }));

    return {
      authorized: true as const,
      totals: {
        totalUsers: users.length,
        paidUsers: paid,
        freeUsers: free,
        conversionRate: users.length > 0 ? paid / users.length : 0,
        mrr,
        arr: mrr * 12,
        newLast7,
        newLast30,
      },
      byPlan,
      byAccountType,
      byStatus,
      signupsByDay,
      recentUsers,
    };
  },
});
