import { mutation, query, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";

// Defaults; the client mirrors these for UI counters but Convex is
// authoritative for enforcement.
const DEFAULT_CAYLA_LIMIT = 10;
const DEFAULT_OCR_LIMIT = 5;

function isBetaModeEnabled(): boolean {
  const v = process.env.BETA_MODE;
  if (v === undefined || v === "") return true; // default ON during beta
  return v === "true" || v === "1";
}

function isCaylaEnabled(): boolean {
  const v = process.env.BETA_CAYLA_ENABLED;
  if (v === undefined || v === "") return true;
  return v === "true" || v === "1";
}

function isOcrEnabled(): boolean {
  const v = process.env.BETA_OCR_ENABLED;
  if (v === undefined || v === "") return true;
  return v === "true" || v === "1";
}

function globalCap(name: string): number | null {
  const raw = process.env[name];
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/**
 * Read the current beta usage for one Firebase user. Called by the mobile
 * app to render the subtle "X remaining" counters. Creates a row lazily
 * so a fresh tester sees the full allowance.
 */
export const getForUser = query({
  args: { firebaseUid: v.string() },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("betaUsage")
      .withIndex("by_firebase_uid", (q) => q.eq("firebaseUid", args.firebaseUid))
      .first();

    return {
      firebaseUid: args.firebaseUid,
      caylaUsed: row?.caylaUsed ?? 0,
      caylaLimit: row?.caylaLimit ?? DEFAULT_CAYLA_LIMIT,
      ocrUsed: row?.ocrUsed ?? 0,
      ocrLimit: row?.ocrLimit ?? DEFAULT_OCR_LIMIT,
    };
  },
});

/**
 * Assert-and-reserve for a paid AI/OCR call. Returns "ok" only after
 * atomically bumping the counter, so two parallel requests from the
 * same user can only both succeed if the user has two slots left.
 *
 * requestId de-duplicates retries: a second call with the same id is a
 * no-op (returns the existing reservation), so rapid taps / offline
 * retries never double-count.
 */
export const reserve = mutation({
  args: {
    firebaseUid: v.string(),
    kind: v.union(v.literal("cayla"), v.literal("ocr")),
    requestId: v.string(),
  },
  handler: async (ctx, args) => {
    // Kill-switch check
    if (args.kind === "cayla" && !isCaylaEnabled()) {
      return { ok: false as const, reason: "cayla_disabled" as const };
    }
    if (args.kind === "ocr" && !isOcrEnabled()) {
      return { ok: false as const, reason: "ocr_disabled" as const };
    }

    // Idempotency: same requestId => already reserved, treat as ok.
    const existing = await ctx.db
      .query("betaRequests")
      .withIndex("by_request_id", (q) => q.eq("requestId", args.requestId))
      .first();
    if (existing) {
      return { ok: true as const, deduped: true };
    }

    // Load / create the usage row for the user.
    let row = await ctx.db
      .query("betaUsage")
      .withIndex("by_firebase_uid", (q) => q.eq("firebaseUid", args.firebaseUid))
      .first();

    if (!row) {
      const rowId = await ctx.db.insert("betaUsage", {
        firebaseUid: args.firebaseUid,
        betaTester: true,
        caylaUsed: 0,
        caylaLimit: DEFAULT_CAYLA_LIMIT,
        ocrUsed: 0,
        ocrLimit: DEFAULT_OCR_LIMIT,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      const inserted = await ctx.db.get(rowId);
      if (!inserted) throw new Error("row insert failed");
      row = inserted;
    }

    // Global cap check (second layer of protection).
    if (isBetaModeEnabled()) {
      if (args.kind === "cayla") {
        const cap = globalCap("BETA_MAX_TOTAL_CAYLA_REQUESTS");
        if (cap !== null) {
          const used = await countRecentByKind(ctx, "cayla");
          if (used >= cap) {
            return { ok: false as const, reason: "cayla_global_cap" as const };
          }
        }
      } else {
        const cap = globalCap("BETA_MAX_TOTAL_OCR_SCANS");
        if (cap !== null) {
          const used = await countRecentByKind(ctx, "ocr");
          if (used >= cap) {
            return { ok: false as const, reason: "ocr_global_cap" as const };
          }
        }
      }
    }

    // Per-user cap check
    if (args.kind === "cayla") {
      if (row.caylaUsed >= row.caylaLimit) {
        return {
          ok: false as const,
          reason: "cayla_limit" as const,
          caylaUsed: row.caylaUsed,
          caylaLimit: row.caylaLimit,
        };
      }
      await ctx.db.patch(row._id, {
        caylaUsed: row.caylaUsed + 1,
        updatedAt: Date.now(),
      });
    } else {
      if (row.ocrUsed >= row.ocrLimit) {
        return {
          ok: false as const,
          reason: "ocr_limit" as const,
          ocrUsed: row.ocrUsed,
          ocrLimit: row.ocrLimit,
        };
      }
      await ctx.db.patch(row._id, {
        ocrUsed: row.ocrUsed + 1,
        updatedAt: Date.now(),
      });
    }

    await ctx.db.insert("betaRequests", {
      requestId: args.requestId,
      firebaseUid: args.firebaseUid,
      kind: args.kind,
      createdAt: Date.now(),
    });

    return { ok: true as const, deduped: false };
  },
});

/**
 * Release a previously-reserved slot. Called by the action when the
 * upstream provider errored, so a failed call doesn't burn a slot.
 * Idempotent: a release for an already-released request is a no-op.
 */
export const release = internalMutation({
  args: {
    requestId: v.string(),
    firebaseUid: v.string(),
    kind: v.union(v.literal("cayla"), v.literal("ocr")),
  },
  handler: async (ctx, args) => {
    const req = await ctx.db
      .query("betaRequests")
      .withIndex("by_request_id", (q) => q.eq("requestId", args.requestId))
      .first();
    if (!req) return { released: false };
    await ctx.db.delete(req._id);

    const row = await ctx.db
      .query("betaUsage")
      .withIndex("by_firebase_uid", (q) => q.eq("firebaseUid", args.firebaseUid))
      .first();
    if (!row) return { released: false };

    if (args.kind === "cayla") {
      await ctx.db.patch(row._id, {
        caylaUsed: Math.max(0, row.caylaUsed - 1),
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.patch(row._id, {
        ocrUsed: Math.max(0, row.ocrUsed - 1),
        updatedAt: Date.now(),
      });
    }
    return { released: true };
  },
});

async function countRecentByKind(
  ctx: any,
  kind: "cayla" | "ocr",
): Promise<number> {
  // Global caps are lifetime-of-beta, so scan the whole table.
  const rows = await ctx.db
    .query("betaRequests")
    .withIndex("by_kind_time", (q: any) => q.eq("kind", kind))
    .collect();
  return rows.length;
}

/**
 * Admin roll-up. Total testers, total requests, and users at the cap,
 * to power a "Beta Usage" section inside the existing admin area on
 * sheetpay.app. Only admins should reach this query; the check itself
 * belongs in the admin surface that calls it.
 */
export const adminStats = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("betaUsage").collect();
    const testerCount = rows.length;
    let totalCayla = 0;
    let totalOcr = 0;
    const capped: {
      firebaseUid: string;
      caylaUsed: number;
      caylaLimit: number;
      ocrUsed: number;
      ocrLimit: number;
    }[] = [];
    for (const r of rows) {
      totalCayla += r.caylaUsed;
      totalOcr += r.ocrUsed;
      if (r.caylaUsed >= r.caylaLimit || r.ocrUsed >= r.ocrLimit) {
        capped.push({
          firebaseUid: r.firebaseUid,
          caylaUsed: r.caylaUsed,
          caylaLimit: r.caylaLimit,
          ocrUsed: r.ocrUsed,
          ocrLimit: r.ocrLimit,
        });
      }
    }
    return {
      testerCount,
      totalCayla,
      totalOcr,
      capped,
    };
  },
});

// Read helper for actions; identical to getForUser but callable from an
// action via ctx.runQuery(internal.betaUsage.internalGetForUser).
export const internalGetForUser = internalQuery({
  args: { firebaseUid: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("betaUsage")
      .withIndex("by_firebase_uid", (q) => q.eq("firebaseUid", args.firebaseUid))
      .first();
  },
});
