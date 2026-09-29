import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { internal as _internal } from "./_generated/api";
import { getActor, requireBusinessAccess, requireWorkspaceAdmin, recordAccountantActivity } from "./lib/accountantAccess";

const internal = _internal as any;
const inviteRoles = new Set(["Admin", "Payroll Manager", "Payroll Assistant", "Viewer"]);
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

async function hashInviteToken(token: string) {
  const bytes = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export const getTeam = query({
  args: { businessId: v.id("businesses") },
  handler: async (ctx, { businessId }) => {
    const business = await ctx.db.get(businessId);
    const { owner } = await requireBusinessAccess(ctx, business, "manageTeam");
    const [members, invites] = await Promise.all([
      ctx.db.query("accountantMemberships").withIndex("by_workspace", (q) => q.eq("workspaceOwnerId", owner._id)).collect(),
      ctx.db.query("accountantInvites").withIndex("by_workspace", (q) => q.eq("workspaceOwnerId", owner._id)).order("desc").take(50),
    ]);
    return {
      owner: { userId: owner._id, name: owner.displayName || owner.email, email: owner.email, role: "Owner", status: "active" },
      members: members.filter((m) => m.status === "active").map((m) => ({
        id: m._id, userId: m.memberUserId, name: m.email, email: m.email, role: m.role,
        clientIds: m.clientIds, allClients: m.allClients, canSendPayslips: m.canSendPayslips,
        status: m.status, lastActiveAt: m.lastActiveAt, createdAt: m.createdAt,
      })),
      invites: invites.filter((invite) => ["pending", "failed"].includes(invite.status)).map((invite) => ({
        id: invite._id, email: invite.email, role: invite.role, status: invite.status,
        expiresAt: invite.expiresAt, createdAt: invite.createdAt, lastError: invite.lastError,
      })),
    };
  },
});

export const listActivity = query({
  args: { businessId: v.id("businesses"), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const business = await ctx.db.get(args.businessId);
    const { owner } = await requireBusinessAccess(ctx, business, "read");
    const limit = Math.min(100, Math.max(1, args.limit ?? 30));
    const rows = await ctx.db.query("accountantActivity")
      .withIndex("by_workspace", (q) => q.eq("workspaceOwnerId", owner._id))
      .order("desc").take(limit);
    const allowed = new Set([String(args.businessId)]);
    return Promise.all(rows.filter((row) => !row.businessId || allowed.has(String(row.businessId))).map(async (row) => {
      const actor = await ctx.db.get(row.actorUserId);
      return { ...row, actorName: actor?.displayName || actor?.email || "Sheetpay user" };
    }));
  },
});

export const getInviteContext = internalQuery({
  args: { businessId: v.id("businesses"), firebaseUid: v.string(), email: v.string() },
  handler: async (ctx, args) => {
    const actor = await ctx.db.query("users").withIndex("by_firebase_uid", (q) => q.eq("firebaseUid", args.firebaseUid)).first();
    if (!actor || actor.email.trim().toLowerCase() !== args.email.trim().toLowerCase()) throw new Error("Forbidden");
    const business = await ctx.db.get(args.businessId);
    if (!business) throw new Error("Client not found");
    const owner = await ctx.db.get(business.userId);
    if (!owner) throw new Error("Workspace not found");
    if (actor._id !== owner._id) {
      const member = await ctx.db.query("accountantMemberships")
        .withIndex("by_workspace_member", (q) => q.eq("workspaceOwnerId", owner._id).eq("memberUserId", actor._id)).first();
      if (!member || member.status !== "active" || member.role !== "Admin" ||
        (!member.allClients && !member.clientIds.includes(String(business._id)))) throw new Error("PERMISSION_DENIED");
    }
    return { owner, actor, business };
  },
});

export const createInviteRecord = internalMutation({
  args: {
    workspaceOwnerId: v.id("users"),
    businessId: v.id("businesses"),
    email: v.string(),
    role: v.string(),
    clientIds: v.array(v.string()),
    allClients: v.boolean(),
    canSendPayslips: v.boolean(),
    inviterUserId: v.id("users"),
    tokenHash: v.string(),
  },
  handler: async (ctx, args) => {
    const email = args.email.trim().toLowerCase();
    const pending = await ctx.db.query("accountantInvites")
      .withIndex("by_email_workspace", (q) => q.eq("workspaceOwnerId", args.workspaceOwnerId).eq("email", email))
      .collect();
    if (pending.some((invite) => ["pending", "failed"].includes(invite.status) && invite.expiresAt > Date.now())) {
      throw new Error("A pending invitation already exists for this email.");
    }
    const now = Date.now();
    const id = await ctx.db.insert("accountantInvites", {
      ...args, email, status: "pending", createdAt: now, expiresAt: now + INVITE_TTL_MS,
    });
    return { id, expiresAt: now + INVITE_TTL_MS };
  },
});

export const updateInviteDelivery = internalMutation({
  args: { inviteId: v.id("accountantInvites"), messageId: v.optional(v.string()), error: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const invite = await ctx.db.get(args.inviteId);
    if (!invite || invite.status !== "pending") return;
    await ctx.db.patch(args.inviteId, { status: args.error ? "failed" : "pending", resendMessageId: args.messageId, lastError: args.error });
  },
});

export const rotateInviteToken = internalMutation({
  args: { inviteId: v.id("accountantInvites"), tokenHash: v.string(), expiresAt: v.number() },
  handler: async (ctx, args) => {
    const invite = await ctx.db.get(args.inviteId);
    if (!invite || !["pending", "failed"].includes(invite.status)) throw new Error("Invitation is no longer pending.");
    await ctx.db.patch(invite._id, { tokenHash: args.tokenHash, expiresAt: args.expiresAt, status: "pending", lastError: undefined });
    return invite;
  },
});

export const acceptInvitation = mutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const { actor, identity } = await getActor(ctx);
    const email = String(identity.email || actor.email || "").trim().toLowerCase();
    const tokenHash = await hashInviteToken(token);
    const invite = await ctx.db.query("accountantInvites")
      .withIndex("by_token_hash", (q) => q.eq("tokenHash", tokenHash)).first();
    if (!invite) throw new Error("Invitation link is invalid.");
    if (invite.status !== "pending") throw new Error(invite.status === "accepted" ? "This invitation has already been accepted." : "This invitation is no longer active.");
    if (invite.expiresAt < Date.now()) {
      await ctx.db.patch(invite._id, { status: "expired" });
      throw new Error("This invitation has expired.");
    }
    if (email !== invite.email || actor.email.trim().toLowerCase() !== invite.email) throw new Error("Sign in with the email address this invitation was sent to.");
    const owner = await ctx.db.get(invite.workspaceOwnerId);
    if (!owner) throw new Error("The inviting workspace is unavailable.");
    if (actor._id === owner._id) throw new Error("Workspace owners already have access.");
    const existing = await ctx.db.query("accountantMemberships")
      .withIndex("by_workspace_member", (q) => q.eq("workspaceOwnerId", owner._id).eq("memberUserId", actor._id)).first();
    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, {
        email, role: invite.role, clientIds: invite.clientIds, allClients: invite.allClients,
        canSendPayslips: invite.canSendPayslips, status: "active", updatedAt: now,
      });
    } else {
      await ctx.db.insert("accountantMemberships", {
        workspaceOwnerId: owner._id, memberUserId: actor._id, email, role: invite.role,
        clientIds: invite.clientIds, allClients: invite.allClients, canSendPayslips: invite.canSendPayslips,
        status: "active", createdAt: now, updatedAt: now,
      });
    }
    await ctx.db.patch(invite._id, { status: "accepted", acceptedByUserId: actor._id, acceptedAt: now });
    await recordAccountantActivity(ctx, owner._id, actor._id, "team.invitation_accepted", invite.businessId, { role: invite.role });
    return { ok: true, workspaceName: owner.displayName || owner.email };
  },
});

export const updateMember = mutation({
  args: {
    businessId: v.id("businesses"),
    memberId: v.id("accountantMemberships"),
    role: v.string(),
    clientIds: v.array(v.string()),
    allClients: v.boolean(),
    canSendPayslips: v.boolean(),
  },
  handler: async (ctx, args) => {
    if (!inviteRoles.has(args.role)) throw new Error("Choose a valid workspace role.");
    const business = await ctx.db.get(args.businessId);
    const { actor, owner } = await requireBusinessAccess(ctx, business, "manageTeam");
    const member = await ctx.db.get(args.memberId);
    if (!member || member.workspaceOwnerId !== owner._id) throw new Error("Team member not found.");
    const available = await ctx.db.query("businesses").withIndex("by_user", (q) => q.eq("userId", owner._id)).collect();
    const validIds = new Set(available.map((client: any) => String(client._id)));
    if (args.clientIds.some((id) => !validIds.has(id))) throw new Error("Client access must belong to this workspace.");
    await ctx.db.patch(member._id, {
      role: args.role, clientIds: args.clientIds, allClients: args.allClients,
      canSendPayslips: args.canSendPayslips, updatedAt: Date.now(),
    });
    await recordAccountantActivity(ctx, owner._id, actor._id, "team.role_changed", args.businessId, { role: args.role });
    return { ok: true };
  },
});

export const removeMember = mutation({
  args: { businessId: v.id("businesses"), memberId: v.id("accountantMemberships") },
  handler: async (ctx, args) => {
    const business = await ctx.db.get(args.businessId);
    const { actor, owner } = await requireBusinessAccess(ctx, business, "manageTeam");
    const member = await ctx.db.get(args.memberId);
    if (!member || member.workspaceOwnerId !== owner._id) throw new Error("Team member not found.");
    if (member.memberUserId === owner._id || member.role === "Owner") throw new Error("The workspace owner cannot be removed.");
    await ctx.db.patch(member._id, { status: "removed", updatedAt: Date.now() });
    await recordAccountantActivity(ctx, owner._id, actor._id, "team.member_removed", args.businessId, { memberId: String(member._id) });
    return { ok: true };
  },
});

export const revokeInvitation = mutation({
  args: { businessId: v.id("businesses"), inviteId: v.id("accountantInvites") },
  handler: async (ctx, args) => {
    const business = await ctx.db.get(args.businessId);
    const { actor, owner } = await requireBusinessAccess(ctx, business, "manageTeam");
    const invite = await ctx.db.get(args.inviteId);
    if (!invite || invite.workspaceOwnerId !== owner._id || invite.status !== "pending") throw new Error("Pending invitation not found.");
    await ctx.db.patch(invite._id, { status: "revoked", revokedAt: Date.now() });
    await recordAccountantActivity(ctx, owner._id, actor._id, "team.invitation_revoked", args.businessId, { email: invite.email });
    return { ok: true };
  },
});
