"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { getGoogleAccessToken } from "./lib/googleAuth";
import { api } from "./_generated/api";

const GA_SCOPE = "https://www.googleapis.com/auth/analytics.readonly";
const GA_ENDPOINT = "https://analyticsdata.googleapis.com/v1beta/properties";

async function runReport(
  propertyId: string,
  token: string,
  body: Record<string, unknown>
): Promise<{ rows?: Array<{ dimensionValues?: Array<{ value: string }>; metricValues?: Array<{ value: string }> }> } | null> {
  const resp = await fetch(`${GA_ENDPOINT}/${propertyId}:runReport`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    console.error("GA runReport failed:", await resp.text());
    return null;
  }
  return await resp.json();
}

/**
 * Pull the metrics the admin analytics tab renders. Returns
 * { configured: false } when the service account or property id are missing
 * so the UI can show a real setup CTA instead of empty charts.
 */
export const getSiteAnalytics = action({
  args: {
    requesterUid: v.optional(v.string()),
    days: v.optional(v.number()), // default 28
  },
  handler: async (ctx, args) => {
    // Enforce admin auth server-side via the shared query.
    const check = await ctx.runQuery(api.admin.getOverview, {
      requesterUid: args.requesterUid,
    });
    if (!check.authorized) return { authorized: false as const };

    const propertyId = process.env.GA4_PROPERTY_ID;
    const token = await getGoogleAccessToken(GA_SCOPE);
    if (!propertyId || !token) {
      return { authorized: true as const, configured: false as const };
    }

    const days = args.days ?? 28;
    const dateRanges = [{ startDate: `${days}daysAgo`, endDate: "today" }];

    const [totals, byDate, bySource, byCountry, byDevice, byLanding, byEvent] = await Promise.all([
      runReport(propertyId, token, {
        dateRanges,
        metrics: [
          { name: "activeUsers" },
          { name: "totalUsers" },
          { name: "newUsers" },
          { name: "sessions" },
          { name: "engagementRate" },
          { name: "conversions" },
        ],
      }),
      runReport(propertyId, token, {
        dateRanges,
        dimensions: [{ name: "date" }],
        metrics: [{ name: "activeUsers" }, { name: "sessions" }],
        orderBys: [{ dimension: { dimensionName: "date" } }],
      }),
      runReport(propertyId, token, {
        dateRanges,
        dimensions: [{ name: "sessionDefaultChannelGroup" }],
        metrics: [{ name: "sessions" }],
        orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
        limit: 10,
      }),
      runReport(propertyId, token, {
        dateRanges,
        dimensions: [{ name: "country" }],
        metrics: [{ name: "activeUsers" }],
        orderBys: [{ metric: { metricName: "activeUsers" }, desc: true }],
        limit: 15,
      }),
      runReport(propertyId, token, {
        dateRanges,
        dimensions: [{ name: "deviceCategory" }],
        metrics: [{ name: "activeUsers" }],
      }),
      runReport(propertyId, token, {
        dateRanges,
        dimensions: [{ name: "landingPage" }],
        metrics: [{ name: "sessions" }],
        orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
        limit: 15,
      }),
      runReport(propertyId, token, {
        dateRanges,
        dimensions: [{ name: "eventName" }],
        metrics: [{ name: "eventCount" }],
        dimensionFilter: {
          filter: {
            fieldName: "eventName",
            inListFilter: {
              values: [
                "sign_up",
                "onboarding_completed",
                "employee_created",
                "payroll_started",
                "payroll_completed",
                "payslip_generated",
                "cayla_opened",
                "cayla_payroll_completed",
                "ocr_completed",
                "checkout_started",
                "subscription_started",
                "subscription_canceled",
              ],
            },
          },
        },
      }),
    ]);

    const first = (r: Awaited<ReturnType<typeof runReport>>, i: number) =>
      Number(r?.rows?.[0]?.metricValues?.[i]?.value ?? 0);

    return {
      authorized: true as const,
      configured: true as const,
      days,
      totals: {
        activeUsers: first(totals, 0),
        totalUsers: first(totals, 1),
        newUsers: first(totals, 2),
        sessions: first(totals, 3),
        engagementRate: first(totals, 4),
        conversions: first(totals, 5),
      },
      byDate:
        byDate?.rows?.map((r) => ({
          date: r.dimensionValues?.[0]?.value ?? "",
          activeUsers: Number(r.metricValues?.[0]?.value ?? 0),
          sessions: Number(r.metricValues?.[1]?.value ?? 0),
        })) ?? [],
      bySource:
        bySource?.rows?.map((r) => ({
          source: r.dimensionValues?.[0]?.value ?? "",
          sessions: Number(r.metricValues?.[0]?.value ?? 0),
        })) ?? [],
      byCountry:
        byCountry?.rows?.map((r) => ({
          country: r.dimensionValues?.[0]?.value ?? "",
          activeUsers: Number(r.metricValues?.[0]?.value ?? 0),
        })) ?? [],
      byDevice:
        byDevice?.rows?.map((r) => ({
          device: r.dimensionValues?.[0]?.value ?? "",
          activeUsers: Number(r.metricValues?.[0]?.value ?? 0),
        })) ?? [],
      byLanding:
        byLanding?.rows?.map((r) => ({
          path: r.dimensionValues?.[0]?.value ?? "",
          sessions: Number(r.metricValues?.[0]?.value ?? 0),
        })) ?? [],
      byEvent:
        byEvent?.rows?.map((r) => ({
          event: r.dimensionValues?.[0]?.value ?? "",
          count: Number(r.metricValues?.[0]?.value ?? 0),
        })) ?? [],
    };
  },
});
