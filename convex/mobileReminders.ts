import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { computeNextRunAt } from "./reminders";

async function currentUser(ctx: any) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity?.subject) throw new Error("Unauthorized");
  const user = await ctx.db.query("users")
    .withIndex("by_firebase_uid", (q: any) => q.eq("firebaseUid", identity.subject)).first();
  if (!user) throw new Error("Unauthorized");
  return user;
}

export const registerDeviceToken = mutation({
  args: { token: v.string(), platform: v.optional(v.string()), userAgent: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const user = await currentUser(ctx);
    const existing = await ctx.db.query("fcmDeviceTokens")
      .withIndex("by_token", (q) => q.eq("token", args.token)).first();
    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, {
        userId: user._id,
        platform: args.platform ?? existing.platform,
        userAgent: args.userAgent ?? existing.userAgent,
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
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const user = await currentUser(ctx);
    const existing = await ctx.db.query("fcmDeviceTokens")
      .withIndex("by_token", (q) => q.eq("token", args.token)).first();
    if (existing && existing.userId === user._id) await ctx.db.delete(existing._id);
    return { ok: true };
  },
});

export const listReminders = query({
  args: {},
  handler: async (ctx) => {
    const user = await currentUser(ctx);
    const rows = await ctx.db.query("reminders").withIndex("by_user", (q) => q.eq("userId", user._id)).collect();
    return rows.map((r) => ({
      id: r._id, type: r.type, title: r.title, frequency: r.frequency,
      dayOfWeek: r.dayOfWeek ?? null, dayOfMonth: r.dayOfMonth ?? null,
      scheduledTime: r.scheduledTime, timezone: r.timezone, nextRunAt: r.nextRunAt,
      lastRunAt: r.lastRunAt ?? null, enabled: r.enabled, deepLink: r.deepLink ?? null,
    }));
  },
});

export const createPaydayReminder = mutation({
  args: {
    businessId: v.id("businesses"),
    title: v.string(),
    messageTemplate: v.string(),
    nextPayDate: v.string(),
    scheduledTime: v.string(),
    timezone: v.string(),
    daysBeforePayroll: v.number(),
    deepLink: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await currentUser(ctx);
    const business = await ctx.db.get(args.businessId);
    if (!business || business.userId !== user._id) throw new Error("Forbidden");

    // Compute a concrete one-time reminder for the next payday. Recurring
    // schedule updates can create the next occurrence after payroll approval.
    const target = new Date(`${args.nextPayDate}T${args.scheduledTime}:00`);
    const fireAt = target.getTime() - Math.max(0, args.daysBeforePayroll) * 86400000;
    if (!Number.isFinite(fireAt) || fireAt <= Date.now()) throw new Error("Reminder must be in the future");

    const now = Date.now();
    const id = await ctx.db.insert("reminders", {
      userId: user._id,
      businessId: args.businessId,
      type: "payroll",
      title: args.title,
      messageTemplate: args.messageTemplate,
      frequency: "once",
      scheduledTime: args.scheduledTime,
      timezone: args.timezone,
      daysBeforePayroll: args.daysBeforePayroll,
      fireOnceAt: fireAt,
      deepLink: args.deepLink,
      nextRunAt: fireAt,
      enabled: true,
      createdByUserId: user._id,
      createdAt: now,
      updatedAt: now,
    });
    return { id, nextRunAt: fireAt };
  },
});


const mobileReminderInput = {
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
  args: mobileReminderInput,
  handler: async (ctx, args) => {
    const user = await currentUser(ctx);
    const business = await ctx.db.query("businesses")
      .withIndex("by_user", (q) => q.eq("userId", user._id)).first();
    const now = Date.now();
    const nextRunAt = computeNextRunAt(args, now);
    if (nextRunAt === null) throw new Error("Reminder must have a future time");
    const id = await ctx.db.insert("reminders", {
      userId: user._id,
      businessId: business?._id,
      ...args,
      nextRunAt,
      enabled: true,
      createdByUserId: user._id,
      createdAt: now,
      updatedAt: now,
    });
    return { id, nextRunAt };
  },
});

export const updateReminder = mutation({
  args: { reminderId: v.id("reminders"), patch: v.any() },
  handler: async (ctx, args) => {
    const user = await currentUser(ctx);
    const reminder = await ctx.db.get(args.reminderId);
    if (!reminder || reminder.userId !== user._id) throw new Error("Forbidden");
    const allowedKeys = new Set([
      "title","instructions","messageTemplate","frequency","dayOfWeek","dayOfMonth",
      "scheduledTime","timezone","daysBeforePayroll","fireOnceAt","deepLink","enabled"
    ]);
    const patch: Record<string, any> = {};
    for (const [key, value] of Object.entries(args.patch || {})) {
      if (allowedKeys.has(key)) patch[key] = value;
    }
    const merged = { ...reminder, ...patch };
    const nextRunAt = patch.enabled === false
      ? reminder.nextRunAt
      : computeNextRunAt(merged, Date.now());
    if (patch.enabled !== false && nextRunAt === null) throw new Error("Reminder must have a future time");
    await ctx.db.patch(args.reminderId, {
      ...patch,
      nextRunAt: nextRunAt ?? reminder.nextRunAt,
      updatedAt: Date.now(),
    });
    return { ok: true, nextRunAt: nextRunAt ?? reminder.nextRunAt };
  },
});

export const deleteReminder = mutation({
  args: { reminderId: v.id("reminders") },
  handler: async (ctx, args) => {
    const user = await currentUser(ctx);
    const reminder = await ctx.db.get(args.reminderId);
    if (!reminder) return { ok: true };
    if (reminder.userId !== user._id) throw new Error("Forbidden");
    await ctx.db.delete(args.reminderId);
    return { ok: true };
  },
});


export const authStatus = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity?.subject) return { authenticated: false, userFound: false };
    const user = await ctx.db.query("users")
      .withIndex("by_firebase_uid", (q) => q.eq("firebaseUid", identity.subject))
      .first();
    return { authenticated: true, userFound: !!user };
  },
});
