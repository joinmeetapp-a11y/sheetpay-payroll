"use node";
import { action } from "./_generated/server";
import { v } from "convex/values";
import { internal as _internal } from "./_generated/api";
import { sendEmail } from "./lib/email";

const internal = _internal as any;
const roles = new Set(["Admin", "Payroll Manager", "Payroll Assistant", "Viewer"]);

async function hashToken(token: string) {
  const bytes = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** Create a role-scoped invite after resolving the inviter from Firebase identity. */
export const invite = action({
  args: {
    businessId: v.id("businesses"),
    email: v.string(),
    role: v.string(),
    clientIds: v.array(v.string()),
    allClients: v.boolean(),
    canSendPayslips: v.boolean(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const firebaseUid = identity?.subject;
    const inviterEmail = typeof identity?.email === "string" ? identity.email.trim().toLowerCase() : "";
    if (!firebaseUid || !inviterEmail) throw new Error("Sign in to invite a team member.");
    const email = args.email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Enter a valid email address.");
    if (!roles.has(args.role)) throw new Error("Choose a valid workspace role.");
    if (email === inviterEmail) throw new Error("You already have access to your workspace.");

    const context: any = await ctx.runQuery(internal.accountantWorkspace.getInviteContext, {
      businessId: args.businessId,
      firebaseUid,
      email: inviterEmail,
    });
    const validClientIds = new Set(context.clients.map((client: any) => String(client._id)));
    const requestedIds = args.allClients
      ? context.clients.map((client: any) => String(client._id))
      : [...new Set(args.clientIds)];
    if (!requestedIds.length) throw new Error("Select at least one client for this team member.");
    if (requestedIds.some((id: string) => !validClientIds.has(id))) {
      throw new Error("You can only assign clients available to your account.");
    }
    const grantsAll = args.allClients && String(context.actor._id) === String(context.owner._id);
    const token = crypto.randomUUID().replaceAll("-", "") + crypto.randomUUID().replaceAll("-", "");
    const invite = await ctx.runMutation(internal.accountantWorkspace.createInviteRecord, {
      workspaceOwnerId: context.owner._id,
      businessId: context.business._id,
      email,
      role: args.role,
      clientIds: grantsAll ? [] : requestedIds,
      allClients: grantsAll,
      canSendPayslips: args.canSendPayslips,
      inviterUserId: context.actor._id,
      tokenHash: await hashToken(token),
    });
    const inviteLink = "https://sheetpay.app/accountant?invite=" + encodeURIComponent(token);
    try {
      const result: any = await sendEmail(ctx, {
        to: email,
        emailType: "teamInvite",
        data: {
          inviterName: context.actor.displayName || context.actor.email,
          businessName: context.owner.displayName || context.business.name,
          role: args.role,
          inviteeEmail: email,
          inviteLink,
          expiresLabel: new Date(invite.expiresAt).toDateString(),
        },
        userId: String(context.actor._id),
        businessId: String(context.business._id),
        relatedEntityId: String(invite.id),
        idempotencyKey: "accountant-team-invite:" + String(invite.id),
        bypassPreferences: true,
      });
      await ctx.runMutation(internal.accountantWorkspace.updateInviteDelivery, {
        inviteId: invite.id,
        messageId: result.messageId,
        error: result.success ? undefined : (result.error || "Resend could not send the invitation."),
      });
      if (!result.success) return { ok: false, inviteId: invite.id, error: "The invitation was saved, but the email could not be sent. Try again later." };
      await ctx.runMutation(internal.notifications.createWorkspaceEvent, {
        businessId: context.business._id,
        actorUserId: context.actor._id,
        category: "team",
        type: "invitation_sent",
        title: "Team invitation sent",
        message: `Invitation sent to ${email}.`,
        actionUrl: "/accountant?tab=Team",
        dedupeKey: `team-invitation-sent:${String(invite.id)}`,
        metadata: { email, role: args.role },
        channels: ["in_app", "push", "email"],
        includeActor: true,
      });
      return { ok: true, inviteId: invite.id, expiresAt: invite.expiresAt };
    } catch (_error) {
      await ctx.runMutation(internal.accountantWorkspace.updateInviteDelivery, {
        inviteId: invite.id,
        error: "Resend could not send the invitation.",
      });
      return { ok: false, inviteId: invite.id, error: "The invitation was saved, but the email could not be sent. Try again later." };
    }
  },
});

