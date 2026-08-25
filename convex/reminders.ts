import { query, mutation, internalMutation, internalQuery, QueryCtx, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";

// ═════════════════════════════════════════════════════════════════════════════
// Timezone-aware next-run computation
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Convert a local wall-clock time in a given IANA timezone to UTC ms.
 * Uses Intl.DateTimeFormat to derive the timezone's offset at that instant.
 * Correct across DST transitions.
 */
function zonedTimeToUtc(
  year: number,
  month: number, // 1-12
  day: number,
  hour: number,
  minute: number,
  timezone: string
): number {
  const guessUtc = Date.UTC(year, month - 1, day, hour, minute);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(new Date(guessUtc));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  const asIfUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour") === 24 ? 0 : get("hour"),
    get("minute"),
    get("second")
  );
  const offset = guessUtc - asIfUtc;
  return guessUtc + offset;
}

interface ReminderConfig {
  frequency: string;
  dayOfWeek?: number;
  dayOfMonth?: number;
  scheduledTime: string;
  timezone: string;
  fireOnceAt?: number;
  daysBeforePayroll?: number;
}

/**
 * Compute the next UTC ms this reminder should fire, strictly after `after`.
 * Returns null when a 'once' reminder has already fired.
 */
export function computeNextRunAt(cfg: ReminderConfig, after: number): number | null {
  if (cfg.frequency === "once") {
    if (!cfg.fireOnceAt) return null;
    return cfg.fireOnceAt > after ? cfg.fireOnceAt : null;
  }

  const [hStr, mStr] = (cfg.scheduledTime || "09:00").split(":");
  const targetHour = Math.max(0, Math.min(23, Number(hStr) || 9));
  const targetMinute = Math.max(0, Math.min(59, Number(mStr) || 0));

  // Start from "today" in the user's timezone
  const nowParts = new Intl.DateTimeFormat("en-US", {
    timeZone: cfg.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(after));
  const y = Number(nowParts.find((p) => p.type === "year")?.value ?? 0);
  const mo = Number(nowParts.find((p) => p.type === "month")?.value ?? 0);
  const d = Number(nowParts.find((p) => p.type === "day")?.value ?? 0);

  // For daily we walk day by day until we find the first candidate > after.
  // For weekly/biweekly we walk day by day and match dayOfWeek. Monthly walks
  // by month. Bounded to 400 iterations — safe for even biweekly leap cases.
  for (let i = 0; i < 400; i++) {
    const candidateDate = new Date(Date.UTC(y, mo - 1, d + i));
    // Extract this candidate's Y/M/D in the target timezone (day boundaries
    // move around DST changes).
    const cParts = new Intl.DateTimeFormat("en-US", {
      timeZone: cfg.timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      weekday: "short",
    }).formatToParts(candidateDate);
    const cy = Number(cParts.find((p) => p.type === "year")?.value ?? 0);
    const cm = Number(cParts.find((p) => p.type === "month")?.value ?? 0);
    const cd = Number(cParts.find((p) => p.type === "day")?.value ?? 0);
    const wkStr = cParts.find((p) => p.type === "weekday")?.value ?? "Sun";
    const weekdayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    const cw = weekdayMap[wkStr] ?? 0;

    let match = false;
    if (cfg.frequency === "daily") match = true;
    else if (cfg.frequency === "weekly") match = cfg.dayOfWeek === cw;
    else if (cfg.frequency === "biweekly") {
      // Fire on matching weekday every other week from an epoch anchor
      // (2024-01-01, which is a Monday). i = days since anchor mod 14.
      const anchor = Date.UTC(2024, 0, 1);
      const dayIdx = Math.floor((Date.UTC(cy, cm - 1, cd) - anchor) / 86400000);
      const weekIdx = Math.floor(dayIdx / 7);
      match = cfg.dayOfWeek === cw && weekIdx % 2 === 0;
    } else if (cfg.frequency === "monthly") {
      match = cfg.dayOfMonth === cd;
    } else if (cfg.frequency === "before_payroll") {
      // Payroll-relative reminders schedule themselves off the payroll run —
      // this branch is left for the caller (see `bumpNextRunAt`) to override.
      match = false;
    }

    if (!match) continue;
    const utc = zonedTimeToUtc(cy, cm, cd, targetHour, targetMinute, cfg.timezone);
    if (utc > after) return utc;
  }
  return null;
}

// ═════════════════════════════════════════════════════════════════════════════
// Auth helper
// ═════════════════════════════════════════════════════════════════════════════

async function requireUser(
  ctx: QueryCtx | MutationCtx,
  requesterUid: string
): Promise<{ user: { _id: Id<"users">; email: string }; businessId?: Id<"businesses"> }> {
  const user = await ctx.db
    .query("users")
    .withIndex("by_firebase_uid", (q) => q.eq("firebaseUid", requesterUid))
    .first();
  if (!user) throw new Error("Unauthorized");
  const business = await ctx.db
    .query("businesses")
    .withIndex("by_user", (q) => q.eq("userId", user._id))
    .first();
  return { user: { _id: user._id, email: user.email }, businessId: business?._id };
}

async function requireOwnedReminder(
  ctx: QueryCtx | MutationCtx,
  requesterUid: string,
  reminderId: Id<"reminders">
) {
  const { user } = await requireUser(ctx, requesterUid);
  const rem = await ctx.db.get(reminderId);
  if (!rem) throw new Error("Reminder not found");
  if (rem.userId !== user._id) throw new Error("Forbidden");
  return { user, reminder: rem };
}

// ═════════════════════════════════════════════════════════════════════════════
// Public CRUD (called by the UI and by Cayla tools)
// ═════════════════════════════════════════════════════════════════════════════

const reminderInputValidator = {
  type: v.string(),
  title: v.string(),
  instructions: v.optional(v.string()),
  messageTemplate: v.optional(v.string()),
  frequency: v.string(),
  dayOfWeek: v.optional(v.number()),
  dayOfMonth: v.optional(v.number()),
  scheduledTime: v.string(),
  timezone: v.string(),
  daysBeforePayroll: v.optional(v.number()),
  fireOnceAt: v.optional(v.number()),
  deepLink: v.optional(v.string()),
};

export const createReminder = mutation({
  args: { requesterUid: v.string(), ...reminderInputValidator },
  handler: async (ctx, args) => {
    const { user, businessId } = await requireUser(ctx, args.requesterUid);
    const now = Date.now();
    const next = computeNextRunAt(args, now);
    if (next === null && args.frequency !== "before_payroll") {
      throw new Error("Reminder schedule produced no future run — check date/time");
    }
    const id = await ctx.db.insert("reminders", {
      userId: user._id,
      businessId,
      type: args.type,
      title: args.title,
      instructions: args.instructions,
      messageTemplate: args.messageTemplate,
      frequency: args.frequency,
      dayOfWeek: args.dayOfWeek,
      dayOfMonth: args.dayOfMonth,
      scheduledTime: args.scheduledTime,
      timezone: args.timezone,
      daysBeforePayroll: args.daysBeforePayroll,
      fireOnceAt: args.fireOnceAt,
      deepLink: args.deepLink,
      nextRunAt: next ?? now + 365 * 86400000,
      enabled: true,
      createdByUserId: user._id,
      createdAt: now,
      updatedAt: now,
    });
    return { id };
  },
});

export const updateReminder = mutation({
  args: {
    requesterUid: v.string(),
    reminderId: v.id("reminders"),
    patch: v.object({
      title: v.optional(v.string()),
      enabled: v.optional(v.boolean()),
      frequency: v.optional(v.string()),
      dayOfWeek: v.optional(v.number()),
      dayOfMonth: v.optional(v.number()),
      scheduledTime: v.optional(v.string()),
      timezone: v.optional(v.string()),
      daysBeforePayroll: v.optional(v.number()),
      fireOnceAt: v.optional(v.number()),
      deepLink: v.optional(v.string()),
      messageTemplate: v.optional(v.string()),
    }),
  },
  handler: async (ctx, args) => {
    const { reminder } = await requireOwnedReminder(ctx, args.requesterUid, args.reminderId);
    const merged = { ...reminder, ...args.patch };
    const now = Date.now();
    const next = computeNextRunAt(merged, now);
    await ctx.db.patch(args.reminderId, {
      ...args.patch,
      nextRunAt: next ?? reminder.nextRunAt,
      updatedAt: now,
    });
    return { ok: true };
  },
});

export const deleteReminder = mutation({
  args: { requesterUid: v.string(), reminderId: v.id("reminders") },
  handler: async (ctx, args) => {
    await requireOwnedReminder(ctx, args.requesterUid, args.reminderId);
    await ctx.db.delete(args.reminderId);
    return { ok: true };
  },
});

export const listReminders = query({
  args: { requesterUid: v.string() },
  handler: async (ctx, args) => {
    const { user } = await requireUser(ctx, args.requesterUid);
    const rows = await ctx.db
      .query("reminders")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    return rows.map((r) => ({
      id: r._id,
      type: r.type,
      title: r.title,
      frequency: r.frequency,
      dayOfWeek: r.dayOfWeek ?? null,
      dayOfMonth: r.dayOfMonth ?? null,
      scheduledTime: r.scheduledTime,
      timezone: r.timezone,
      nextRunAt: r.nextRunAt,
      lastRunAt: r.lastRunAt ?? null,
      enabled: r.enabled,
      deepLink: r.deepLink ?? null,
    }));
  },
});

// ═════════════════════════════════════════════════════════════════════════════
// FCM device-token registration (called from src/lib/fcm.ts)
// ═════════════════════════════════════════════════════════════════════════════

export const registerDeviceToken = mutation({
  args: {
    requesterUid: v.string(),
    token: v.string(),
    platform: v.optional(v.string()),
    userAgent: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { user } = await requireUser(ctx, args.requesterUid);
    const existing = await ctx.db
      .query("fcmDeviceTokens")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();
    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, {
        userId: user._id, // token can move to a new user on the same browser
        lastSeenAt: now,
        disabledAt: undefined,
        disabledReason: undefined,
      });
      return { id: existing._id };
    }
    const id = await ctx.db.insert("fcmDeviceTokens", {
      userId: user._id,
      token: args.token,
      platform: args.platform,
      userAgent: args.userAgent,
      lastSeenAt: now,
      createdAt: now,
    });
    return { id };
  },
});

export const unregisterDeviceToken = mutation({
  args: { requesterUid: v.string(), token: v.string() },
  handler: async (ctx, args) => {
    await requireUser(ctx, args.requesterUid);
    const existing = await ctx.db
      .query("fcmDeviceTokens")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();
    if (existing) await ctx.db.delete(existing._id);
    return { ok: true };
  },
});

// ═════════════════════════════════════════════════════════════════════════════
// Internal — used by cron and by the FCM sender
// ═════════════════════════════════════════════════════════════════════════════

export const claimDueReminders = internalMutation({
  args: { now: v.number(), limit: v.number() },
  handler: async (ctx, args) => {
    // Indexed scan: only rows whose nextRunAt <= now, ordered ascending.
    // The `enabled` filter is applied in-memory but the search space is
    // already bounded by nextRunAt, so this stays cheap.
    const due = await ctx.db
      .query("reminders")
      .withIndex("by_next_run_at", (q) => q.lte("nextRunAt", args.now))
      .take(args.limit);

    const claimed: {
      reminderId: Id<"reminders">;
      userId: Id<"users">;
      businessId: Id<"businesses"> | undefined;
      occurrenceId: string;
      scheduledFor: number;
      type: string;
      title: string;
      messageTemplate?: string;
      deepLink?: string;
    }[] = [];

    for (const r of due) {
      if (!r.enabled) {
        // Push nextRunAt forward so we don't reconsider it every minute.
        const next = computeNextRunAt(r, args.now);
        await ctx.db.patch(r._id, { nextRunAt: next ?? args.now + 30 * 86400000 });
        continue;
      }
      const scheduledFor = r.nextRunAt;
      const occurrenceId = `${r._id}:${scheduledFor}`;

      // Idempotency: if an occurrence row already exists for this (reminder,
      // instant) we've already handled it — skip. Two racing crons will both
      // insert into reminderOccurrences and one will lose; but we use the
      // by_occurrence index to make this cheap.
      const already = await ctx.db
        .query("reminderOccurrences")
        .withIndex("by_occurrence", (q) => q.eq("occurrenceId", occurrenceId))
        .first();
      if (already) {
        // Still advance nextRunAt so we don't re-claim next minute.
        const next = computeNextRunAt(r, scheduledFor);
        await ctx.db.patch(r._id, {
          nextRunAt: next ?? scheduledFor + 30 * 86400000,
          lastRunAt: scheduledFor,
        });
        continue;
      }

      await ctx.db.insert("reminderOccurrences", {
        reminderId: r._id,
        userId: r.userId,
        occurrenceId,
        scheduledFor,
        status: "pending",
        attempts: 0,
        createdAt: Date.now(),
      });

      // Advance the reminder immediately so a second worker won't claim it.
      const next = computeNextRunAt(r, scheduledFor);
      await ctx.db.patch(r._id, {
        nextRunAt: next ?? scheduledFor + 30 * 86400000,
        lastRunAt: scheduledFor,
      });

      claimed.push({
        reminderId: r._id,
        userId: r.userId,
        businessId: r.businessId,
        occurrenceId,
        scheduledFor,
        type: r.type,
        title: r.title,
        messageTemplate: r.messageTemplate,
        deepLink: r.deepLink,
      });
    }
    return claimed;
  },
});

export const markOccurrenceStatus = internalMutation({
  args: {
    occurrenceId: v.string(),
    status: v.string(),
    fcmMessageIds: v.optional(v.array(v.string())),
    skippedReason: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("reminderOccurrences")
      .withIndex("by_occurrence", (q) => q.eq("occurrenceId", args.occurrenceId))
      .first();
    if (!row) return;
    await ctx.db.patch(row._id, {
      status: args.status,
      sentAt: args.status === "sent" ? Date.now() : row.sentAt,
      fcmMessageIds: args.fcmMessageIds,
      skippedReason: args.skippedReason,
      errorMessage: args.errorMessage,
      attempts: row.attempts + 1,
    });
  },
});

export const getUserDeviceTokens = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("fcmDeviceTokens")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    return rows.filter((r) => !r.disabledAt).map((r) => ({ id: r._id, token: r.token }));
  },
});

export const disableDeviceToken = internalMutation({
  args: { tokenId: v.id("fcmDeviceTokens"), reason: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.tokenId, {
      disabledAt: Date.now(),
      disabledReason: args.reason,
    });
  },
});

/**
 * Read-only helper Cayla can call to answer "what reminders do I have".
 * userId is already validated upstream in executeTool — this is a trusted
 * internal call, not exposed to the browser.
 */
export const listRemindersForCayla = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("reminders")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
  },
});

export const createReminderForCayla = internalMutation({
  args: { userId: v.id("users"), ...reminderInputValidator },
  handler: async (ctx, args) => {
    const now = Date.now();
    const next = computeNextRunAt(args, now);
    if (next === null && args.frequency !== "before_payroll") {
      throw new Error("Reminder schedule produced no future run");
    }
    const business = await ctx.db
      .query("businesses")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();
    const id = await ctx.db.insert("reminders", {
      userId: args.userId,
      businessId: business?._id,
      type: args.type,
      title: args.title,
      instructions: args.instructions,
      messageTemplate: args.messageTemplate,
      frequency: args.frequency,
      dayOfWeek: args.dayOfWeek,
      dayOfMonth: args.dayOfMonth,
      scheduledTime: args.scheduledTime,
      timezone: args.timezone,
      daysBeforePayroll: args.daysBeforePayroll,
      fireOnceAt: args.fireOnceAt,
      deepLink: args.deepLink,
      nextRunAt: next ?? now + 365 * 86400000,
      enabled: true,
      createdByUserId: args.userId,
      createdAt: now,
      updatedAt: now,
    });
    return { id };
  },
});

export const updateReminderForCayla = internalMutation({
  args: {
    userId: v.id("users"),
    reminderId: v.id("reminders"),
    patch: v.any(),
  },
  handler: async (ctx, args) => {
    const rem = await ctx.db.get(args.reminderId);
    if (!rem) throw new Error("Reminder not found");
    if (rem.userId !== args.userId) throw new Error("Forbidden");
    const merged = { ...rem, ...args.patch };
    const now = Date.now();
    const next = computeNextRunAt(merged, now);
    await ctx.db.patch(args.reminderId, {
      ...args.patch,
      nextRunAt: next ?? rem.nextRunAt,
      updatedAt: now,
    });
    return { ok: true };
  },
});

export const deleteReminderForCayla = internalMutation({
  args: { userId: v.id("users"), reminderId: v.id("reminders") },
  handler: async (ctx, args) => {
    const rem = await ctx.db.get(args.reminderId);
    if (!rem) return { ok: true };
    if (rem.userId !== args.userId) throw new Error("Forbidden");
    await ctx.db.delete(args.reminderId);
    return { ok: true };
  },
});
