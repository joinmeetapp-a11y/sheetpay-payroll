import { query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Admin allowlist (server-side). Must mirror src/lib/admin.ts.
 * Only these emails may read the admin analytics.
 */
export const ADMIN_EMAILS = ["antoniokurt23@gmail.com"];

export function isAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.map((e) => e.toLowerCase()).includes(email.toLowerCase());
}

const PLAN_PRICE_USD: Record<string, number> = {
  pro: 97,
  accountant: 197,
  free: 0,
};

function isPaidUser(u: any): boolean {
  const plan = u.plan ?? "free";
  if (plan === "free") return false;
  const status = u.planStatus ?? "active";
  return status === "active" || status === "pending";
}

/**
 * Real analytics over the users table for the admin dashboard.
 * Verifies the caller is an admin (by firebaseUid → user email) before
 * returning any data.
 */
export const getAnalytics = query({
  args: { requesterUid: v.optional(v.string()) },
  handler: async (ctx, args) => {
    // Authorize
    let requester = null as any;
    if (args.requesterUid) {
      requester = await ctx.db
        .query("users")
        .withIndex("by_firebase_uid", (q) => q.eq("firebaseUid", args.requesterUid!))
        .first();
    }
    if (!requester || !isAdminEmail(requester.email)) {
      return { authorized: false as const };
    }

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

    // Signups over the last 30 days, bucketed by day
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    const signupsByDay: { date: string; count: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const start = now - i * dayMs;
      const dayStart = new Date(start).setHours(0, 0, 0, 0);
      const dayEnd = dayStart + dayMs;
      const count = users.filter((u) => u.createdAt >= dayStart && u.createdAt < dayEnd).length;
      signupsByDay.push({
        date: new Date(dayStart).toISOString().slice(0, 10),
        count,
      });
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
