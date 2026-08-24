import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const getByBusiness = query({
  args: { businessId: v.id("businesses") },
  handler: async (ctx, args) => {
    return ctx.db
      .query("employees")
      .withIndex("by_business", (q) => q.eq("businessId", args.businessId))
      .collect();
  },
});

export const create = mutation({
  args: {
    businessId: v.id("businesses"),
    userId: v.id("users"),
    name: v.string(),
    employeeId: v.string(),
    position: v.string(),
    department: v.string(),
    avatar: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    payFrequency: v.string(),
    basicPay: v.number(),
    frequencySalary: v.number(),
    overtimeHours: v.number(),
    overtimeRate: v.number(),
    bonus: v.number(),
    commission: v.number(),
    allowances: v.number(),
    paye: v.number(),
    nis: v.number(),
    healthSurcharge: v.number(),
    otherDeductions: v.number(),
    grossPay: v.number(),
    netPay: v.number(),
    status: v.string(),
    localId: v.string(),
  },
  handler: async (ctx, args) => {
    return ctx.db.insert("employees", { ...args, createdAt: Date.now() });
  },
});

export const update = mutation({
  args: {
    employeeId: v.id("employees"),
    basicPay: v.optional(v.number()),
    overtimeHours: v.optional(v.number()),
    bonus: v.optional(v.number()),
    commission: v.optional(v.number()),
    allowances: v.optional(v.number()),
    paye: v.optional(v.number()),
    nis: v.optional(v.number()),
    healthSurcharge: v.optional(v.number()),
    otherDeductions: v.optional(v.number()),
    grossPay: v.optional(v.number()),
    netPay: v.optional(v.number()),
    status: v.optional(v.string()),
    position: v.optional(v.string()),
    department: v.optional(v.string()),
  },
  handler: async (ctx, { employeeId, ...fields }) => {
    await ctx.db.patch(employeeId, fields);
  },
});

export const deleteEmployee = mutation({
  args: { employeeId: v.id("employees") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.employeeId);
  },
});

export const bulkCreate = mutation({
  args: {
    businessId: v.id("businesses"),
    userId: v.id("users"),
    employees: v.array(v.any()),
  },
  handler: async (ctx, args) => {
    const ids = [];
    for (const emp of args.employees) {
      const id = await ctx.db.insert("employees", {
        businessId: args.businessId,
        userId: args.userId,
        name: emp.name,
        employeeId: emp.employeeId || `EMP-${Date.now()}`,
        position: emp.position || "Team Member",
        department: emp.department || "General",
        avatar: emp.avatar,
        email: emp.email,
        phone: emp.phone,
        payFrequency: emp.payFrequency || "monthly",
        basicPay: emp.basicPay || 0,
        frequencySalary: emp.frequencySalary || emp.basicPay || 0,
        overtimeHours: emp.overtimeHours || 0,
        overtimeRate: emp.overtimeRate || 0,
        bonus: emp.bonus || 0,
        commission: emp.commission || 0,
        allowances: emp.allowances || 0,
        paye: emp.paye || 0,
        nis: emp.nis || 0,
        healthSurcharge: emp.healthSurcharge || 0,
        otherDeductions: emp.otherDeductions || 0,
        grossPay: emp.grossPay || 0,
        netPay: emp.netPay || 0,
        status: emp.status || "pending",
        localId: emp.id || emp.localId || `local-${Date.now()}`,
        createdAt: Date.now(),
      });
      ids.push(id);
    }
    return ids;
  },
});
