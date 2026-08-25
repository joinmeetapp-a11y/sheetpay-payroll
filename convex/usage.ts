import { query, mutation, internalMutation, QueryCtx, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { isAdminEmail } from "./admin";

/**
 * Free-plan monthly allowances. Keep in sync with the pricing copy on the
 * landing page and SettingsView. Paid plans (pro/accountant) are treated as
 * unlimited server-side — a null limit means "no ceiling".
 */
export const FREE_LIMITS = {
  payslip: 10,
  payroll: 10,
  ocr: 3,
  // Cayla actions on Free are limited — pick a conservative number so the
  // free trial is genuinely useful without letting a single free account
  // consume the OpenAI budget for the month.
  cayla: 50,
} as const;

export type UsageKind = keyof typeof FREE_LIMITS;

const KIND_TO_FIELD: Record<UsageKind, "payslipsUsed" | "payrollRunsUsed" | "ocrScansUsed" | "caylaActionsUsed"> = {
  payslip: "payslipsUsed",
  payroll: "payrollRunsUsed",
  ocr: "ocrScansUsed",
  cayla: "caylaActionsUsed",
};

function currentPeriod(now: number): string {
  const d = new Date(now);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

async function resolveCallerUser(ctx: QueryCtx | MutationCtx, requesterUid?: string) {
  if (!requesterUid) return null;
  return await ctx.db
    .query("users")
    .withIndex("by_firebase_uid", (q) => q.eq("firebaseUid", requesterUid))
    .first();
}

async function planFor(user: { plan?: string; planStatus?: string; email: string }): Promise<"free" | "pro" | "accountant"> {
  // Admins get unlimited so internal testing doesn't burn free-plan quota.
  if (isAdminEmail(user.email)) return "accountant";
  const plan = (user.plan ?? "free") as string;
  if (plan === "free") return "free";
  const status = user.planStatus ?? "active";
  const active = status === "active" || status === "pending" || status === "trialing";
  if (!active) return "free";
  return (plan as "pro" | "accountant") ?? "free";
}

async function readOrCreateCounter(
  ctx: MutationCtx,
  userId: Id<"users">,
  period: string
) {
  const existing = await ctx.db
    .query("usageCounters")
    .withIndex("by_user_period", (q) => q.eq("userId", userId).eq("period", period))
    .first();
  if (existing) return existing;
  const id = await ctx.db.insert("usageCounters", {
    userId,
    period,
    payslipsUsed: 0,
    payrollRunsUsed: 0,
    ocrScansUsed: 0,
    caylaActionsUsed: 0,
    updatedAt: Date.now(),
  });
  const row = await ctx.db.get(id);
  return row!;
}

// ═════════════════════════════════════════════════════════════════════════════
// Public read — the Settings page reads this to render live usage
// ═════════════════════════════════════════════════════════════════════════════

export const getMonthlyUsage = query({
  args: { requesterUid: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const user = await resolveCallerUser(ctx, args.requesterUid);
    if (!user) return null;
    const period = currentPeriod(Date.now());
    const row = await ctx.db
      .query("usageCounters")
      .withIndex("by_user_period", (q) => q.eq("userId", user._id).eq("period", period))
      .first();
    const plan = await planFor(user);

    // Cayla usage — count logs in the current UTC month. Uses the existing
    // caylaUsageLogs table so every historical OpenAI call is already reflected.
    const monthStart = Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1);
    const caylaFromLogs = (
      await ctx.db
        .query("caylaUsageLogs")
        .withIndex("by_user_id", (q) => q.eq("userId", user._id))
        .collect()
    ).filter((l) => l.createdAt >= monthStart).length;

    return {
      plan,
      period,
      payslipsUsed: row?.payslipsUsed ?? 0,
      payrollRunsUsed: row?.payrollRunsUsed ?? 0,
      ocrScansUsed: row?.ocrScansUsed ?? 0,
      caylaActionsUsed: Math.max(row?.caylaActionsUsed ?? 0, caylaFromLogs),
      limits: plan === "free"
        ? { payslip: FREE_LIMITS.payslip, payroll: FREE_LIMITS.payroll, ocr: FREE_LIMITS.ocr, cayla: FREE_LIMITS.cayla }
        : { payslip: null, payroll: null, ocr: null, cayla: null },
    };
  },
});

// ═════════════════════════════════════════════════════════════════════════════
// Enforcement + increment
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Enforce the caller's plan limit for `kind`. Throws when the operation would
 * exceed the free-plan allowance. Always call BEFORE performing the operation.
 */
export async function assertWithinLimit(
  ctx: MutationCtx,
  user: { _id: Id<"users">; email: string; plan?: string; planStatus?: string },
  kind: UsageKind
): Promise<void> {
  const plan = await planFor(user);
  if (plan !== "free") return;
  const period = currentPeriod(Date.now());
  const row = await readOrCreateCounter(ctx, user._id, period);
  const field = KIND_TO_FIELD[kind];
  const used = row[field] ?? 0;
  const limit = FREE_LIMITS[kind];
  if (used >= limit) {
    throw new Error(`FREE_LIMIT_REACHED:${kind}:${used}/${limit}`);
  }
}

/**
 * Increment usage idempotently. `opId` must be stable across retries for the
 * same logical operation (e.g. `payroll:${runId}`, `payslip:${runId}:${empId}`,
 * `ocr:${uploadHash}`). Duplicate opIds are silently ignored.
 */
export async function incrementUsageIdempotent(
  ctx: MutationCtx,
  userId: Id<"users">,
  kind: UsageKind,
  opId: string
): Promise<{ counted: boolean; used: number }> {
  const existing = await ctx.db
    .query("usageIncrements")
    .withIndex("by_op", (q) => q.eq("opId", opId))
    .first();
  const period = currentPeriod(Date.now());
  const row = await readOrCreateCounter(ctx, userId, period);
  const field = KIND_TO_FIELD[kind];
  if (existing) return { counted: false, used: row[field] };

  await ctx.db.insert("usageIncrements", {
    userId,
    period,
    kind,
    opId,
    createdAt: Date.now(),
  });
  const next = (row[field] ?? 0) + 1;
  await ctx.db.patch(row._id, { [field]: next, updatedAt: Date.now() });
  return { counted: true, used: next };
}

/**
 * Server-side increment exposed to internal callers (e.g. OCR action,
 * payslip generation, Cayla dispatcher). Not exposed to the browser — the
 * frontend must not be able to decrement or reset its own counters.
 */
export const internalIncrement = internalMutation({
  args: {
    userId: v.id("users"),
    kind: v.union(v.literal("payslip"), v.literal("payroll"), v.literal("ocr"), v.literal("cayla")),
    opId: v.string(),
  },
  handler: async (ctx, args) => {
    return await incrementUsageIdempotent(ctx, args.userId, args.kind, args.opId);
  },
});

/**
 * Public mutation callers use when they hold a firebaseUid rather than a
 * resolved user id. Enforces plan limit and dedupes.
 */
export const trackUsage = mutation({
  args: {
    requesterUid: v.string(),
    kind: v.union(v.literal("payslip"), v.literal("payroll"), v.literal("ocr"), v.literal("cayla")),
    opId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await resolveCallerUser(ctx, args.requesterUid);
    if (!user) throw new Error("Unauthorized");
    await assertWithinLimit(ctx, user, args.kind);
    return await incrementUsageIdempotent(ctx, user._id, args.kind, args.opId);
  },
});

// ═════════════════════════════════════════════════════════════════════════════
// Plan gate helper — for accountant-only or business-only mutations
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Throws if the caller isn't on a plan that includes `minPlan` features.
 * Ordering: accountant > pro > free. An accountant plan also satisfies pro.
 */
export async function requirePlan(
  ctx: QueryCtx | MutationCtx,
  requesterUid: string,
  minPlan: "pro" | "accountant"
): Promise<{ userId: Id<"users">; plan: "pro" | "accountant" }> {
  const user = await resolveCallerUser(ctx, requesterUid);
  if (!user) throw new Error("Unauthorized");
  const plan = await planFor(user);
  if (plan === "free") throw new Error(`PLAN_REQUIRED:${minPlan}`);
  if (minPlan === "accountant" && plan !== "accountant") {
    throw new Error(`PLAN_REQUIRED:accountant`);
  }
  return { userId: user._id, plan: plan as "pro" | "accountant" };
}
