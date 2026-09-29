import { internalMutation, internalQuery, mutation, query, QueryCtx, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { internal as _internal } from "./_generated/api";
import { getActor, requireBusinessAccess } from "./lib/accountantAccess";

const internal = _internal as any;
type Ctx = QueryCtx | MutationCtx;
const defaultChannels = { inApp: true, push: false, email: true };
const defaultCategories = {
  payrollReminders: true, payslipReminders: true, failedPayslipAlerts: true,
  ocrReviewAlerts: true, teamActivity: true, billingAlerts: true, yearlyTaxReminders: true,
};

function preferenceKey(category: string) {
  if (category === "team") return "teamActivity";
  if (category === "failedPayslip") return "failedPayslipAlerts";
  if (category === "payslip") return "payslipReminders";
  if (category === "import" || category === "ocrReview") return "ocrReviewAlerts";
  if (category === "billing") return "billingAlerts";
  if (category === "tax") return "yearlyTaxReminders";
  return "payrollReminders";
}

async function preferencesFor(ctx: Ctx, userId: Id<"users">) {
  return await ctx.db.query("notificationPreferences")
    .withIndex("by_user", (q) => q.eq("userId", String(userId))).first();
}

function categoryAllowed(prefs: any, category: string) {
  const key = preferenceKey(category);
  if (typeof prefs?.categories?.[key] === "boolean") return prefs.categories[key];
  const legacyKey = category === "team" ? "team"
    : category === "payslip" || category === "failedPayslip" ? "payslip"
    : category === "import" || category === "ocrReview" ? "import"
    : category === "billing" ? "billing"
    : category === "tax" ? "payroll"
    : "payroll";
  return prefs?.[legacyKey] !== false;
}

function channelEnabled(prefs: any, channel: string) {
  const channels = { ...defaultChannels, ...(prefs?.channels || {}) };
  if (channel === "in_app") return channels.inApp;
  return channels[channel] !== false;
}

export async function createNotificationForUser(ctx: any, args: {
  userId: Id<"users">;
  workspaceOwnerId?: Id<"users">;
  businessId?: Id<"businesses">;
  payrollId?: Id<"payrollRuns">;
  employeeId?: Id<"employees">;
  category: string;
  type: string;
  title: string;
  message: string;
  actionUrl?: string;
  dedupeKey: string;
  metadata?: Record<string, unknown>;
  channels?: string[];
}) {
  const user = await ctx.db.get(args.userId);
  if (!user) return null;
  let business: any = null;
  let workspaceOwnerId = args.workspaceOwnerId;
  if (args.businessId) {
    business = await ctx.db.get(args.businessId);
    if (!business) return null;
    workspaceOwnerId = workspaceOwnerId || business.userId;
    if (workspaceOwnerId !== business.userId) return null;
  }
  if (args.payrollId) {
    const payroll = await ctx.db.get(args.payrollId);
    if (!payroll || (args.businessId && payroll.businessId !== args.businessId)) return null;
  }
  if (args.employeeId) {
    const employee = await ctx.db.get(args.employeeId);
    if (!employee || (args.businessId && employee.businessId !== args.businessId)) return null;
  }

  const existing = await ctx.db.query("notifications")
    .withIndex("by_user_dedupe", (q: any) => q.eq("userId", args.userId).eq("dedupeKey", args.dedupeKey))
    .first();
  if (existing) return { id: existing._id, duplicate: true };

  const prefs = await preferencesFor(ctx, args.userId);
  const categoryIsEnabled = categoryAllowed(prefs, args.category);
  const notificationId = await ctx.db.insert("notifications", {
    userId: args.userId,
    workspaceOwnerId,
    businessId: args.businessId,
    payrollId: args.payrollId,
    employeeId: args.employeeId,
    category: args.category,
    type: args.type,
    title: args.title.slice(0, 180),
    message: args.message.slice(0, 1000),
    actionUrl: args.actionUrl?.startsWith("/") && !args.actionUrl.startsWith("//") ? args.actionUrl : undefined,
    dedupeKey: args.dedupeKey,
    metadata: args.metadata,
    suppressed: !categoryIsEnabled,
    createdAt: Date.now(),
  });

  const requested = new Set((args.channels || ["in_app"]).map((item) => item === "inApp" ? "in_app" : item));
  let shouldDispatch = false;
  for (const channel of ["in_app", "push", "email"]) {
    const requestedChannel = requested.has(channel);
    const enabled = categoryIsEnabled && requestedChannel && channelEnabled(prefs, channel);
    const status = enabled ? (channel === "in_app" ? "sent" : "queued") : "skipped";
    const deliveryId = await ctx.db.insert("notificationDeliveries", {
      notificationId,
      userId: args.userId,
      channel,
      provider: channel === "in_app" ? "Convex" : channel === "push" ? "Firebase Cloud Messaging" : "Resend",
      status,
      attemptCount: 0,
      idempotencyKey: `notification:${notificationId}:${channel}`,
      errorCode: enabled ? undefined : "CHANNEL_DISABLED",
      errorMessage: enabled ? undefined : requestedChannel ? "Disabled in notification preferences." : "Not selected for this reminder.",
      sentAt: channel === "in_app" && enabled ? Date.now() : undefined,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    if (enabled && channel !== "in_app") shouldDispatch = true;
  }
  if (shouldDispatch) {
    await ctx.scheduler.runAfter(0, internal.notificationDelivery.dispatchNotification, { notificationId });
  }
  return { id: notificationId, duplicate: false };
}

export async function createWorkspaceNotification(ctx: any, args: {
  businessId: Id<"businesses">;
  actorUserId?: Id<"users">;
  category: string;
  type: string;
  title: string;
  message: string;
  actionUrl?: string;
  dedupeKey: string;
  payrollId?: Id<"payrollRuns">;
  employeeId?: Id<"employees">;
  metadata?: Record<string, unknown>;
  channels?: string[];
  includeActor?: boolean;
}) {
  const business = await ctx.db.get(args.businessId);
  if (!business) return [];
  const workspaceOwnerId = business.userId;
  const recipientIds = new Map<string, Id<"users">>();
  recipientIds.set(String(workspaceOwnerId), workspaceOwnerId);
  const members = await ctx.db.query("accountantMemberships")
    .withIndex("by_workspace_member", (q: any) => q.eq("workspaceOwnerId", workspaceOwnerId))
    .collect();
  for (const member of members) {
    if (member.status !== "active" || !["Admin", "Owner"].includes(member.role)) continue;
    if (!member.allClients && !member.clientIds.includes(String(args.businessId))) continue;
    recipientIds.set(String(member.memberUserId), member.memberUserId);
  }
  if (args.includeActor && args.actorUserId) recipientIds.set(String(args.actorUserId), args.actorUserId);
  const created: any[] = [];
  for (const userId of recipientIds.values()) {
    const result = await createNotificationForUser(ctx, {
      ...args, userId, workspaceOwnerId, channels: args.channels || ["in_app"],
      dedupeKey: `${args.dedupeKey}:${String(userId)}`,
    });
    if (result) created.push(result);
  }
  return created;
}

export const listForCurrentUser = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const { actor } = await getActor(ctx);
    const prefs = await preferencesFor(ctx, actor._id);
    const rows = await ctx.db.query("notifications")
      .withIndex("by_user_created", (q) => q.eq("userId", actor._id))
      .order("desc")
      .take(Math.max(1, Math.min(200, args.limit ?? 100)));
    const candidates = rows.filter((item) =>
      !item.dismissedAt && !item.suppressed && prefs?.channels?.inApp !== false && categoryAllowed(prefs, item.category)
    );
    const visible = [];
    for (const item of candidates) {
      if (item.businessId) {
        const business = await ctx.db.get(item.businessId);
        try { await requireBusinessAccess(ctx, business, "read"); }
        catch { continue; }
      }
      visible.push(item);
    }
    const unreadCount = visible.filter((item) => !item.readAt).length;
    const notifications = await Promise.all(visible.map(async (item) => {
      const business = item.businessId ? await ctx.db.get(item.businessId) : null;
      const employee = item.employeeId ? await ctx.db.get(item.employeeId) : null;
      const deliveries = await ctx.db.query("notificationDeliveries")
        .withIndex("by_notification_channel", (q) => q.eq("notificationId", item._id)).collect();
      return { ...item, businessName: business?.name, employeeName: employee?.name, deliveries };
    }));
    return { notifications, unreadCount };
  },
});

export const markRead = mutation({
  args: { notificationId: v.id("notifications") },
  handler: async (ctx, args) => {
    const { actor } = await getActor(ctx);
    const item = await ctx.db.get(args.notificationId);
    if (!item || item.userId !== actor._id) throw new Error("Notification not found.");
    if (!item.readAt) await ctx.db.patch(item._id, { readAt: Date.now() });
    const delivery = await ctx.db.query("notificationDeliveries")
      .withIndex("by_notification_channel", (q) => q.eq("notificationId", item._id).eq("channel", "in_app")).first();
    if (delivery) await ctx.db.patch(delivery._id, { status: "read", updatedAt: Date.now() });
    return { ok: true };
  },
});

export const markAllRead = mutation({
  args: {},
  handler: async (ctx) => {
    const { actor } = await getActor(ctx);
    const rows = await ctx.db.query("notifications")
      .withIndex("by_user_created", (q) => q.eq("userId", actor._id))
      .order("desc").take(200);
    const now = Date.now();
    for (const item of rows) {
      if (!item.dismissedAt && !item.suppressed && !item.readAt) {
        await ctx.db.patch(item._id, { readAt: now });
        const delivery = await ctx.db.query("notificationDeliveries")
          .withIndex("by_notification_channel", (q) => q.eq("notificationId", item._id).eq("channel", "in_app")).first();
        if (delivery) await ctx.db.patch(delivery._id, { status: "read", updatedAt: now });
      }
    }
    return { ok: true };
  },
});

export const dismiss = mutation({
  args: { notificationId: v.id("notifications") },
  handler: async (ctx, args) => {
    const { actor } = await getActor(ctx);
    const item = await ctx.db.get(args.notificationId);
    if (!item || item.userId !== actor._id) throw new Error("Notification not found.");
    const now = Date.now();
    await ctx.db.patch(item._id, { dismissedAt: now });
    const delivery = await ctx.db.query("notificationDeliveries")
      .withIndex("by_notification_channel", (q) => q.eq("notificationId", item._id).eq("channel", "in_app")).first();
    if (delivery) await ctx.db.patch(delivery._id, { status: "dismissed", updatedAt: now });
    return { ok: true };
  },
});

export const createForCurrentUser = mutation({
  args: {
    businessId: v.optional(v.id("businesses")),
    category: v.string(),
    type: v.string(),
    title: v.string(),
    message: v.string(),
    actionUrl: v.optional(v.string()),
    dedupeKey: v.string(),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const { actor } = await getActor(ctx);
    let workspaceOwnerId: Id<"users"> | undefined;
    if (args.businessId) {
      const business = await ctx.db.get(args.businessId);
      const access = await requireBusinessAccess(ctx, business, "read");
      workspaceOwnerId = access.owner._id;
    }
    return createNotificationForUser(ctx, {
      ...args, userId: actor._id, workspaceOwnerId, channels: ["in_app"],
    });
  },
});

export const getPreferences = query({
  args: {},
  handler: async (ctx) => {
    const { actor } = await getActor(ctx);
    const saved = await preferencesFor(ctx, actor._id);
    return {
      channels: { ...defaultChannels, ...(saved?.channels || {}) },
      categories: { ...defaultCategories, ...(saved?.categories || {}) },
      timezone: saved?.timezone || "UTC",
      timezoneConfigured: Boolean(saved?.timezone),
    };
  },
});

export const updatePreferences = mutation({
  args: {
    channels: v.object({ inApp: v.boolean(), push: v.boolean(), email: v.boolean() }),
    categories: v.object({
      payrollReminders: v.boolean(),
      payslipReminders: v.boolean(),
      failedPayslipAlerts: v.boolean(),
      ocrReviewAlerts: v.boolean(),
      teamActivity: v.boolean(),
      billingAlerts: v.boolean(),
      yearlyTaxReminders: v.boolean(),
    }),
    timezone: v.string(),
  },
  handler: async (ctx, args) => {
    const { actor } = await getActor(ctx);
    try { new Intl.DateTimeFormat("en-US", { timeZone: args.timezone }).format(new Date()); }
    catch { throw new Error("Choose a valid IANA timezone."); }
    const userId = String(actor._id);
    const existing = await ctx.db.query("notificationPreferences")
      .withIndex("by_user", (q) => q.eq("userId", userId)).first();
    const patch = { channels: args.channels, categories: args.categories, timezone: args.timezone, updatedAt: Date.now() };
    if (existing) await ctx.db.patch(existing._id, patch);
    else await ctx.db.insert("notificationPreferences", { userId, ...patch });
    return { ok: true };
  },
});

export const getDeliveryContext = internalQuery({
  args: { notificationId: v.id("notifications") },
  handler: async (ctx, args) => {
    const notification = await ctx.db.get(args.notificationId);
    if (!notification || notification.suppressed || notification.dismissedAt) return null;
    const user = await ctx.db.get(notification.userId);
    if (!user) return null;
    const business = notification.businessId ? await ctx.db.get(notification.businessId) : null;
    if (notification.businessId && !business) return null;
    if (business && business.userId !== notification.userId) {
      const membership = await ctx.db.query("accountantMemberships")
        .withIndex("by_workspace_member", (q) => q.eq("workspaceOwnerId", business.userId).eq("memberUserId", notification.userId)).first();
      if (!membership || membership.status !== "active" || (!membership.allClients && !membership.clientIds.includes(String(business._id)))) return null;
    }
    const deliveries = await ctx.db.query("notificationDeliveries")
      .withIndex("by_notification_channel", (q) => q.eq("notificationId", notification._id))
      .collect();
    const preferences = await preferencesFor(ctx, notification.userId);
    return {
      notification,
      preferences,
      user: { _id: user._id, email: user.email, displayName: user.displayName },
      business: business ? { _id: business._id, name: business.name } : null,
      deliveries,
    };
  },
});

export const claimDelivery = internalMutation({
  args: { deliveryId: v.id("notificationDeliveries") },
  handler: async (ctx, args) => {
    const delivery = await ctx.db.get(args.deliveryId);
    if (!delivery || delivery.status !== "queued") return { claimed: false };
    await ctx.db.patch(delivery._id, { status: "sending", attemptCount: delivery.attemptCount + 1, updatedAt: Date.now() });
    return { claimed: true };
  },
});

export const updateDelivery = internalMutation({
  args: {
    deliveryId: v.id("notificationDeliveries"),
    status: v.string(),
    messageId: v.optional(v.string()),
    errorCode: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const delivery = await ctx.db.get(args.deliveryId);
    if (!delivery) return { ok: false };
    const now = Date.now();
    await ctx.db.patch(delivery._id, {
      status: args.status,
      messageId: args.messageId,
      errorCode: args.errorCode,
      errorMessage: args.errorMessage,
      attemptCount: delivery.attemptCount + (args.status === "sending" ? 1 : 0),
      sentAt: args.status === "sent" ? now : delivery.sentAt,
      failedAt: args.status === "failed" ? now : args.status === "sent" ? undefined : delivery.failedAt,
      updatedAt: now,
    });
    return { ok: true };
  },
});

export const listDeliveriesForNotification = internalQuery({
  args: { notificationId: v.id("notifications") },
  handler: async (ctx, args) => ctx.db.query("notificationDeliveries")
    .withIndex("by_notification_channel", (q) => q.eq("notificationId", args.notificationId)).collect(),
});

export const retryDelivery = mutation({
  args: { deliveryId: v.id("notificationDeliveries") },
  handler: async (ctx, args) => {
    const { actor } = await getActor(ctx);
    const delivery = await ctx.db.get(args.deliveryId);
    if (!delivery || delivery.userId !== actor._id) throw new Error("Delivery not found.");
    if (!["failed", "invalid"].includes(delivery.status)) throw new Error("Only failed deliveries can be retried.");
    const notification = await ctx.db.get(delivery.notificationId);
    if (!notification || notification.dismissedAt || notification.suppressed) throw new Error("This notification is no longer active.");
    await ctx.db.patch(delivery._id, { status: "queued", errorCode: undefined, errorMessage: undefined, failedAt: undefined, updatedAt: Date.now() });
    await ctx.scheduler.runAfter(0, internal.notificationDelivery.dispatchNotification, { notificationId: notification._id });
    return { ok: true };
  },
});

export const createWorkspaceEvent = internalMutation({
  args: {
    businessId: v.id("businesses"),
    actorUserId: v.optional(v.id("users")),
    category: v.string(),
    type: v.string(),
    title: v.string(),
    message: v.string(),
    actionUrl: v.optional(v.string()),
    dedupeKey: v.string(),
    payrollId: v.optional(v.id("payrollRuns")),
    employeeId: v.optional(v.id("employees")),
    metadata: v.optional(v.any()),
    channels: v.optional(v.array(v.string())),
    includeActor: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => createWorkspaceNotification(ctx, args),
});

export const createUserEvent = internalMutation({
  args: {
    userId: v.id("users"),
    workspaceOwnerId: v.optional(v.id("users")),
    businessId: v.optional(v.id("businesses")),
    payrollId: v.optional(v.id("payrollRuns")),
    employeeId: v.optional(v.id("employees")),
    category: v.string(),
    type: v.string(),
    title: v.string(),
    message: v.string(),
    actionUrl: v.optional(v.string()),
    dedupeKey: v.string(),
    metadata: v.optional(v.any()),
    channels: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => createNotificationForUser(ctx, args),
});

export const getPreferencesForUser = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => preferencesFor(ctx, args.userId),
});
