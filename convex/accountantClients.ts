import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { effectiveAccountantPlan } from "../shared/accountantPlans";
import { assertCapacity } from "./usage";
import { isAdminEmail } from "./admin";

async function requireAccountant(ctx: any, expectedUserId?: any) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Unauthenticated");
  const user = await ctx.db
    .query("users")
    .withIndex("by_firebase_uid", (q: any) => q.eq("firebaseUid", identity.subject))
    .first();
  if (!user || (expectedUserId && user._id !== expectedUserId)) throw new Error("Forbidden");
  const admin = (user.emailVerified === true && isAdminEmail(user.email));
  if (!admin && effectiveAccountantPlan(user) === "free") {
    throw new Error("ACCOUNTANT_PLAN_REQUIRED");
  }
  return user;
}
export const getByUser = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    // This reactive query can run while Convex is still receiving Firebase
    // auth state, and free accountant trials may subscribe before checkout.
    // Return no client data until the caller is authenticated and entitled so
    // a transient authorization error cannot crash the entire React app.
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const user = await ctx.db
      .query("users")
      .withIndex("by_firebase_uid", (q: any) => q.eq("firebaseUid", identity.subject))
      .first();
    if (!user || user._id !== userId) return [];
    if (!(user.emailVerified === true && isAdminEmail(user.email)) && effectiveAccountantPlan(user) === "free") return [];

    return ctx.db
      .query("accountantClients")
      .withIndex("by_accountant_user", (q) => q.eq("accountantUserId", userId))
      .order("asc")
      .collect();
  },
});

export const create = mutation({
  args: {
    accountantUserId: v.id("users"),
    accountantFirebaseUid: v.string(),
    localId: v.string(),
    name: v.string(),
    companyName: v.optional(v.string()),
    country: v.string(),
    countryCode: v.string(),
    currency: v.string(),
    currencySymbol: v.string(),
    payFrequency: v.string(),
    employeeCount: v.optional(v.number()),
    nextPayrollDate: v.optional(v.string()),
    payrollStatus: v.optional(v.string()),
    monthlyPayrollValue: v.optional(v.number()),
    totalMonthlyPayroll: v.optional(v.number()),
    assignedTo: v.optional(v.string()),
    assignedToAvatar: v.optional(v.string()),
    contactName: v.optional(v.string()),
    contactEmail: v.optional(v.string()),
    contactPhone: v.optional(v.string()),
    businessAddress: v.optional(v.string()),
    taxRegistrationId: v.optional(v.string()),
    nisNumber: v.optional(v.string()),
    signatoryName: v.optional(v.string()),
    signatoryTitle: v.optional(v.string()),
    approvalStatus: v.optional(v.string()),
    notes: v.optional(v.string()),
    employeesJson: v.optional(v.string()),
    payrollRunJson: v.optional(v.string()),
    payrollRunsJson: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireAccountant(ctx, args.accountantUserId);
    if (args.accountantFirebaseUid !== user.firebaseUid) throw new Error("Forbidden");
    await assertCapacity(ctx, user, "clients", 1);
    return ctx.db.insert("accountantClients", {
      ...args,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

export const update = mutation({
  args: {
    clientId: v.id("accountantClients"),
    name: v.optional(v.string()),
    companyName: v.optional(v.string()),
    country: v.optional(v.string()),
    countryCode: v.optional(v.string()),
    currency: v.optional(v.string()),
    currencySymbol: v.optional(v.string()),
    payFrequency: v.optional(v.string()),
    employeeCount: v.optional(v.number()),
    nextPayrollDate: v.optional(v.string()),
    payrollStatus: v.optional(v.string()),
    monthlyPayrollValue: v.optional(v.number()),
    totalMonthlyPayroll: v.optional(v.number()),
    assignedTo: v.optional(v.string()),
    assignedToAvatar: v.optional(v.string()),
    contactName: v.optional(v.string()),
    contactEmail: v.optional(v.string()),
    contactPhone: v.optional(v.string()),
    businessAddress: v.optional(v.string()),
    taxRegistrationId: v.optional(v.string()),
    nisNumber: v.optional(v.string()),
    signatoryName: v.optional(v.string()),
    signatoryTitle: v.optional(v.string()),
    approvalStatus: v.optional(v.string()),
    notes: v.optional(v.string()),
    employeesJson: v.optional(v.string()),
    payrollRunJson: v.optional(v.string()),
    payrollRunsJson: v.optional(v.string()),
  },
  handler: async (ctx, { clientId, ...fields }) => {
    const client = await ctx.db.get(clientId);
    if (!client) throw new Error("Client not found");
    await requireAccountant(ctx, client.accountantUserId);
    await ctx.db.patch(clientId, { ...fields, updatedAt: Date.now() });
  },
});

export const deleteClient = mutation({
  args: { clientId: v.id("accountantClients") },
  handler: async (ctx, { clientId }) => {
    const client = await ctx.db.get(clientId);
    if (!client) return;
    await requireAccountant(ctx, client.accountantUserId);
    await ctx.db.delete(clientId);
  },
});


