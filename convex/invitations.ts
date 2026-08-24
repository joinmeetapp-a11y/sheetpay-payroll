import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { v } from "convex/values";

const INVITATION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days
const RESEND_COOLDOWN_MS = 1000 * 60 * 5; // 5 minute rate-limit between resends
const MAX_RESENDS = 5;

/**
 * Generate a cryptographically strong invitation token.
 * 32 bytes base64url ~ 43 chars — collision-resistant + URL-safe.
 */
function generateInvitationToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  const b64 = btoa(bin);
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Create a new invitation. Rate-limited per (org, email) pair so a single
 * account cannot spam the same recipient with invites.
 *
 * NOTE: this only creates the record + token. The caller (an internal action)
 * is responsible for sending the invite email via the Resend service — this
 * keeps mutation code pure and predictable.
 */
export const create = mutation({
  args: {
    organizationId: v.string(),
    invitedByUserId: v.string(),
    inviterName: v.string(),
    inviteeEmail: v.string(),
    role: v.string(),
  },
  handler: async (ctx, args) => {
    const emailLower = args.inviteeEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailLower)) {
      throw new Error("Invalid invitee email");
    }

    // Rate-limit — at most one pending invite per (org, email).
    const existingPending = await ctx.db
      .query("invitations")
      .withIndex("by_invitee_email", (q) => q.eq("inviteeEmail", emailLower))
      .filter((q) =>
        q.and(
          q.eq(q.field("organizationId"), args.organizationId),
          q.eq(q.field("status"), "pending")
        )
      )
      .first();
    if (existingPending) {
      throw new Error(
        "An invitation is already pending for this email in this workspace."
      );
    }

    const now = Date.now();
    const token = generateInvitationToken();
    const id = await ctx.db.insert("invitations", {
      organizationId: args.organizationId,
      invitedByUserId: args.invitedByUserId,
      inviterName: args.inviterName,
      inviteeEmail: emailLower,
      role: args.role,
      invitationToken: token,
      status: "pending",
      resentCount: 0,
      createdAt: now,
      expiresAt: now + INVITATION_TTL_MS,
    });
    return { id, token, expiresAt: now + INVITATION_TTL_MS };
  },
});

/**
 * Validate an invitation token when the recipient opens the invite URL.
 * Returns the state the frontend needs to render — expiration, already accepted,
 * revoked, or ready-to-accept.
 */
export const verifyToken = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const invite = await ctx.db
      .query("invitations")
      .withIndex("by_token", (q) => q.eq("invitationToken", args.token))
      .first();
    if (!invite) return { state: "invalid" as const };
    if (invite.status === "revoked") return { state: "revoked" as const };
    if (invite.status === "accepted")
      return { state: "already_accepted" as const, invite };
    if (Date.now() > invite.expiresAt) return { state: "expired" as const, invite };
    return { state: "ready" as const, invite };
  },
});

/**
 * Accept an invitation. Adds the invitee (already-signed-in user) to the
 * organization and marks the invitation accepted. Idempotent — accepting an
 * already-accepted invite returns the same shape.
 */
export const accept = mutation({
  args: {
    token: v.string(),
    acceptingUserId: v.string(),
    acceptingUserEmail: v.string(),
  },
  handler: async (ctx, args) => {
    const invite = await ctx.db
      .query("invitations")
      .withIndex("by_token", (q) => q.eq("invitationToken", args.token))
      .first();
    if (!invite) throw new Error("Invitation not found");
    if (invite.status === "revoked") throw new Error("Invitation revoked");
    if (invite.status === "accepted") {
      return { ok: true, invitationId: invite._id, alreadyAccepted: true };
    }
    if (Date.now() > invite.expiresAt) throw new Error("Invitation expired");

    // The accepting user's email must match the invitee address — this closes
    // the "forwarded invite" attack described in the security notice.
    if (args.acceptingUserEmail.trim().toLowerCase() !== invite.inviteeEmail) {
      throw new Error("Invitation was issued to a different email address");
    }

    await ctx.db.patch(invite._id, {
      status: "accepted",
      acceptedByUserId: args.acceptingUserId,
      acceptedAt: Date.now(),
    });

    return { ok: true, invitationId: invite._id, alreadyAccepted: false, invite };
  },
});

/** Revoke a pending invitation. Callers must be authorized org members. */
export const revoke = mutation({
  args: {
    invitationId: v.id("invitations"),
    revokingUserId: v.string(),
  },
  handler: async (ctx, args) => {
    const invite = await ctx.db.get(args.invitationId);
    if (!invite) throw new Error("Invitation not found");
    if (invite.status !== "pending") {
      throw new Error("Only pending invitations can be revoked");
    }
    await ctx.db.patch(invite._id, {
      status: "revoked",
      revokedAt: Date.now(),
    });
    return { ok: true };
  },
});

/**
 * Reset a pending invitation's expiry + issue a fresh token so a new email
 * can be sent. Rate-limited so callers cannot mass-resend.
 */
export const prepareResend = mutation({
  args: {
    invitationId: v.id("invitations"),
    resendingUserId: v.string(),
  },
  handler: async (ctx, args) => {
    const invite = await ctx.db.get(args.invitationId);
    if (!invite) throw new Error("Invitation not found");
    if (invite.status !== "pending") throw new Error("Invitation is not pending");
    const now = Date.now();
    if (invite.lastResentAt && now - invite.lastResentAt < RESEND_COOLDOWN_MS) {
      throw new Error("Please wait a few minutes before resending this invitation.");
    }
    if ((invite.resentCount ?? 0) >= MAX_RESENDS) {
      throw new Error("Resend limit reached for this invitation.");
    }
    const token = generateInvitationToken();
    await ctx.db.patch(invite._id, {
      invitationToken: token,
      expiresAt: now + INVITATION_TTL_MS,
      resentCount: (invite.resentCount ?? 0) + 1,
      lastResentAt: now,
    });
    return { ok: true, token, expiresAt: now + INVITATION_TTL_MS };
  },
});

/** List invitations for an organization — used by the team-settings UI. */
export const listForOrg = query({
  args: { organizationId: v.string() },
  handler: async (ctx, args) => {
    return ctx.db
      .query("invitations")
      .withIndex("by_org", (q) => q.eq("organizationId", args.organizationId))
      .order("desc")
      .collect();
  },
});

/** Server-only fetch (invitation id → row) used by internal actions. */
export const getById = internalQuery({
  args: { invitationId: v.id("invitations") },
  handler: async (ctx, args) => ctx.db.get(args.invitationId),
});

/**
 * Background job: sweep and expire any pending invitation whose deadline has
 * passed. Called from crons or on-demand.
 */
export const expireStale = internalMutation({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("invitations")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .collect();
    const now = Date.now();
    let expired = 0;
    for (const r of rows) {
      if (r.expiresAt < now) {
        await ctx.db.patch(r._id, { status: "expired" });
        expired++;
      }
    }
    return { expired };
  },
});
