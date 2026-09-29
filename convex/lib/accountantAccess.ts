import { isAdminEmail } from "../admin";

export type AccountantCapability =
  | "read"
  | "manageClients"
  | "manageEmployees"
  | "editPayroll"
  | "runPayroll"
  | "sendPayslips"
  | "manageTeam"
  | "manageBilling"
  | "deleteWorkspace";

const roles: Record<string, Set<AccountantCapability>> = {
  Owner: new Set(["read", "manageClients", "manageEmployees", "editPayroll", "runPayroll", "sendPayslips", "manageTeam", "manageBilling", "deleteWorkspace"]),
  Admin: new Set(["read", "manageClients", "manageEmployees", "editPayroll", "runPayroll", "sendPayslips", "manageTeam"]),
  "Payroll Manager": new Set(["read", "manageEmployees", "editPayroll", "runPayroll"]),
  "Payroll Assistant": new Set(["read", "manageEmployees", "editPayroll"]),
  Viewer: new Set(["read"]),
};

export async function getActor(ctx: any) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity?.subject) throw new Error("Unauthenticated");
  const actor = await ctx.db.query("users")
    .withIndex("by_firebase_uid", (q: any) => q.eq("firebaseUid", identity.subject))
    .first();
  if (!actor) throw new Error("Account not found");
  return { identity, actor };
}

/** Resolve tenant membership and enforce both role and per-client assignment. */
export async function requireBusinessAccess(
  ctx: any,
  business: any,
  capability: AccountantCapability,
) {
  if (!business) throw new Error("Client not found");
  const { actor } = await getActor(ctx);
  const owner = await ctx.db.get(business.userId);
  if (!owner) throw new Error("Workspace not found");

  if (actor._id === owner._id || isAdminEmail(actor.email)) {
    return { actor, owner, membership: null, role: "Owner" as const };
  }

  const membership = await ctx.db.query("accountantMemberships")
    .withIndex("by_workspace_member", (q: any) =>
      q.eq("workspaceOwnerId", owner._id).eq("memberUserId", actor._id),
    )
    .first();
  if (!membership || membership.status !== "active") throw new Error("Forbidden");
  const assigned = membership.allClients || membership.clientIds.includes(String(business._id));
  if (!assigned) throw new Error("CLIENT_ACCESS_DENIED");

  const allowed = roles[membership.role];
  const canSend = capability === "sendPayslips" && membership.canSendPayslips;
  if (!canSend && !allowed?.has(capability)) throw new Error("PERMISSION_DENIED");
  await ctx.db.patch(membership._id, { lastActiveAt: Date.now() });
  return { actor, owner, membership, role: membership.role };
}

/** Resolve the caller's client businesses, never trusting a workspace ID from the browser. */
export async function getAccessibleBusinesses(ctx: any, expectedUserId: any) {
  const { actor } = await getActor(ctx);
  if (actor._id !== expectedUserId) return [];
  const owned = await ctx.db.query("businesses")
    .withIndex("by_user", (q: any) => q.eq("userId", actor._id))
    .collect();
  const membershipRows = await ctx.db.query("accountantMemberships")
    .withIndex("by_member", (q: any) => q.eq("memberUserId", actor._id))
    .collect();
  const assigned: any[] = [];
  for (const membership of membershipRows) {
    if (membership.status !== "active") continue;
    const clients = await ctx.db.query("businesses")
      .withIndex("by_user", (q: any) => q.eq("userId", membership.workspaceOwnerId))
      .collect();
    for (const client of clients) {
      if (membership.allClients || membership.clientIds.includes(String(client._id))) assigned.push(client);
    }
  }
  const byId = new Map<string, any>();
  for (const client of [...owned, ...assigned]) byId.set(String(client._id), client);
  return [...byId.values()];
}

export async function requireWorkspaceAdmin(ctx: any, workspaceOwnerId: any) {
  const { actor } = await getActor(ctx);
  const owner = await ctx.db.get(workspaceOwnerId);
  if (!owner) throw new Error("Workspace not found");
  if (actor._id === owner._id || isAdminEmail(actor.email)) return { actor, owner, role: "Owner" as const };
  const membership = await ctx.db.query("accountantMemberships")
    .withIndex("by_workspace_member", (q: any) =>
      q.eq("workspaceOwnerId", owner._id).eq("memberUserId", actor._id),
    )
    .first();
  if (!membership || membership.status !== "active" || !roles[membership.role]?.has("manageTeam")) {
    throw new Error("PERMISSION_DENIED");
  }
  return { actor, owner, role: membership.role };
}

export async function recordAccountantActivity(
  ctx: any,
  workspaceOwnerId: any,
  actorUserId: any,
  action: string,
  businessId?: any,
  details?: Record<string, unknown>,
) {
  return ctx.db.insert("accountantActivity", {
    workspaceOwnerId,
    actorUserId,
    action,
    businessId,
    details,
    createdAt: Date.now(),
  });
}
