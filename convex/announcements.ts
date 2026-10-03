import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { resolveAdmin } from "./admin";
import { getActor } from "./lib/accountantAccess";

async function requirePublisher(ctx: any) {
  const identity = await ctx.auth.getUserIdentity();
  const admin = await resolveAdmin(ctx, identity?.subject);
  if (!admin || !["super_admin", "admin"].includes(admin.role)) throw new Error("Forbidden");
  return admin;
}

function safeActionUrl(input?: string) {
  const value = input?.trim();
  if (!value) return undefined;
  if (value.length > 500 || /[\s\\]/.test(value)) throw new Error("Use a Sheetpay page link or an HTTPS link.");
  if (value.startsWith("/") && !value.startsWith("//")) return value;
  try { if (new URL(value).protocol === "https:") return value; } catch { /* Invalid URL. */ }
  throw new Error("Use a Sheetpay page link or an HTTPS link.");
}

export const listForCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const { actor } = await getActor(ctx);
    const rows = await ctx.db.query("accountantAnnouncements")
      .withIndex("by_active_created", (q) => q.eq("active", true)).order("desc").take(5);
    const visible = await Promise.all(rows.map(async (row) => {
      const dismissed = await ctx.db.query("accountantAnnouncementDismissals")
        .withIndex("by_user_announcement", (q) => q.eq("userId", actor._id).eq("announcementId", row._id)).first();
      return dismissed ? null : { _id: row._id, title: row.title, message: row.message, actionUrl: row.actionUrl };
    }));
    return visible.filter((row) => row !== null);
  },
});

export const dismiss = mutation({
  args: { announcementId: v.id("accountantAnnouncements") },
  handler: async (ctx, args) => {
    const { actor } = await getActor(ctx);
    const row = await ctx.db.get(args.announcementId);
    if (!row) throw new Error("Announcement not found");
    const existing = await ctx.db.query("accountantAnnouncementDismissals")
      .withIndex("by_user_announcement", (q) => q.eq("userId", actor._id).eq("announcementId", row._id)).first();
    if (!existing) await ctx.db.insert("accountantAnnouncementDismissals", {
      announcementId: row._id, userId: actor._id, dismissedAt: Date.now(),
    });
    return { ok: true };
  },
});

export const listForAdmin = query({
  args: {},
  handler: async (ctx) => {
    await requirePublisher(ctx);
    return await ctx.db.query("accountantAnnouncements").order("desc").take(50);
  },
});

export const publish = mutation({
  args: { title: v.string(), message: v.string(), actionUrl: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const admin = await requirePublisher(ctx);
    const title = args.title.trim(), message = args.message.trim();
    if (!title || title.length > 120 || !message || message.length > 2000) throw new Error("Add a title up to 120 characters and a message up to 2,000 characters.");
    const actionUrl = safeActionUrl(args.actionUrl);
    const active = await ctx.db.query("accountantAnnouncements")
      .withIndex("by_active_created", (q) => q.eq("active", true)).take(5);
    if (active.length >= 5) throw new Error("Remove an active announcement before publishing another. Up to five can be active.");
    const now = Date.now();
    const id = await ctx.db.insert("accountantAnnouncements", { title, message, actionUrl, active: true, createdAt: now, createdBy: admin.userId });
    await ctx.db.insert("adminAuditLogs", { actorUserId: admin.userId, actorEmail: admin.email, action: "announcement.publish", targetType: "announcement", targetId: id, createdAt: now });
    return id;
  },
});

export const retire = mutation({
  args: { announcementId: v.id("accountantAnnouncements") },
  handler: async (ctx, args) => {
    const admin = await requirePublisher(ctx);
    const row = await ctx.db.get(args.announcementId);
    if (!row) throw new Error("Announcement not found");
    if (!row.active) return { ok: true };
    const now = Date.now();
    await ctx.db.patch(row._id, { active: false, retiredAt: now });
    await ctx.db.insert("adminAuditLogs", { actorUserId: admin.userId, actorEmail: admin.email, action: "announcement.retire", targetType: "announcement", targetId: row._id, createdAt: now });
    return { ok: true };
  },
});
