import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const getByUser = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
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
    await ctx.db.patch(clientId, { ...fields, updatedAt: Date.now() });
  },
});

export const deleteClient = mutation({
  args: { clientId: v.id("accountantClients") },
  handler: async (ctx, { clientId }) => {
    await ctx.db.delete(clientId);
  },
});
