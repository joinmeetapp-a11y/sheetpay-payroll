"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { getGoogleAccessToken } from "./lib/googleAuth";
import { api } from "./_generated/api";

const SC_SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";
const SC_ENDPOINT = "https://searchconsole.googleapis.com/webmasters/v3/sites";

interface SCRow {
  keys?: string[];
  clicks?: number;
  impressions?: number;
  ctr?: number;
  position?: number;
}

async function scQuery(
  siteUrl: string,
  token: string,
  body: Record<string, unknown>
): Promise<SCRow[]> {
  const resp = await fetch(
    `${SC_ENDPOINT}/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );
  if (!resp.ok) {
    console.error("Search Console query failed:", await resp.text());
    return [];
  }
  const json = (await resp.json()) as { rows?: SCRow[] };
  return json.rows ?? [];
}

/**
 * Search Console analytics for the /admin/seo tab, including opportunity
 * segmentations (position buckets, low-CTR high-impression, fastest-growing).
 */
export const getSearchAnalytics = action({
  args: {
    requesterUid: v.optional(v.string()),
    days: v.optional(v.number()), // default 28
  },
  handler: async (ctx, args) => {
    const check = await ctx.runQuery(api.admin.getOverview, {
      requesterUid: args.requesterUid,
    });
    if (!check.authorized) return { authorized: false as const };

    const site = process.env.SEARCH_CONSOLE_SITE_URL;
    const token = await getGoogleAccessToken(SC_SCOPE);
    if (!site || !token) {
      return { authorized: true as const, configured: false as const };
    }

    const days = args.days ?? 28;
    const end = new Date();
    const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
    const prevEnd = new Date(start.getTime() - 1);
    const prevStart = new Date(prevEnd.getTime() - days * 24 * 60 * 60 * 1000);
    const iso = (d: Date) => d.toISOString().slice(0, 10);

    const range = { startDate: iso(start), endDate: iso(end) };
    const prevRange = { startDate: iso(prevStart), endDate: iso(prevEnd) };

    const [totals, topQueries, topPages, byCountry, byDevice, prevQueries, prevPages] =
      await Promise.all([
        scQuery(site, token, range),
        scQuery(site, token, { ...range, dimensions: ["query"], rowLimit: 100 }),
        scQuery(site, token, { ...range, dimensions: ["page"], rowLimit: 100 }),
        scQuery(site, token, { ...range, dimensions: ["country"], rowLimit: 25 }),
        scQuery(site, token, { ...range, dimensions: ["device"] }),
        scQuery(site, token, { ...prevRange, dimensions: ["query"], rowLimit: 200 }),
        scQuery(site, token, { ...prevRange, dimensions: ["page"], rowLimit: 200 }),
      ]);

    const t = totals[0] ?? {};
    const clicks = Number(t.clicks ?? 0);
    const impressions = Number(t.impressions ?? 0);
    const ctr = Number(t.ctr ?? 0);
    const position = Number(t.position ?? 0);

    // Opportunity buckets
    const pos1to3 = topQueries.filter((r) => (r.position ?? 999) <= 3);
    const pos4to10 = topQueries.filter((r) => (r.position ?? 999) > 3 && (r.position ?? 999) <= 10);
    const pos11to20 = topQueries.filter((r) => (r.position ?? 999) > 10 && (r.position ?? 999) <= 20);
    // High impressions but very low CTR — the classic SEO opportunity.
    const highImpLowCtr = topQueries
      .filter((r) => (r.impressions ?? 0) >= 100 && (r.ctr ?? 0) < 0.02)
      .sort((a, b) => (b.impressions ?? 0) - (a.impressions ?? 0))
      .slice(0, 25);

    // Growth vs the previous equal window
    const prevQueryMap = new Map(prevQueries.map((r) => [r.keys?.[0] ?? "", r.clicks ?? 0]));
    const growingQueries = topQueries
      .map((r) => {
        const key = r.keys?.[0] ?? "";
        const prev = prevQueryMap.get(key) ?? 0;
        return { query: key, clicks: r.clicks ?? 0, prevClicks: prev, delta: (r.clicks ?? 0) - prev };
      })
      .filter((r) => r.delta > 0)
      .sort((a, b) => b.delta - a.delta)
      .slice(0, 15);

    const prevPageMap = new Map(prevPages.map((r) => [r.keys?.[0] ?? "", r.clicks ?? 0]));
    const growingPages = topPages
      .map((r) => {
        const key = r.keys?.[0] ?? "";
        const prev = prevPageMap.get(key) ?? 0;
        return { page: key, clicks: r.clicks ?? 0, prevClicks: prev, delta: (r.clicks ?? 0) - prev };
      })
      .filter((r) => r.delta > 0)
      .sort((a, b) => b.delta - a.delta)
      .slice(0, 15);

    const mapRow = (r: SCRow) => ({
      key: r.keys?.[0] ?? "",
      clicks: r.clicks ?? 0,
      impressions: r.impressions ?? 0,
      ctr: r.ctr ?? 0,
      position: r.position ?? 0,
    });

    return {
      authorized: true as const,
      configured: true as const,
      site,
      days,
      totals: { clicks, impressions, ctr, position },
      topQueries: topQueries.slice(0, 25).map(mapRow),
      topPages: topPages.slice(0, 25).map(mapRow),
      byCountry: byCountry.map(mapRow),
      byDevice: byDevice.map(mapRow),
      opportunities: {
        pos1to3: pos1to3.slice(0, 15).map(mapRow),
        pos4to10: pos4to10.slice(0, 15).map(mapRow),
        pos11to20: pos11to20.slice(0, 15).map(mapRow),
        highImpLowCtr: highImpLowCtr.map(mapRow),
        growingQueries,
        growingPages,
      },
    };
  },
});
