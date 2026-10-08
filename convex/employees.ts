import { assertCapacity } from "./usage";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireBusinessAccess, recordAccountantActivity } from "./lib/accountantAccess";

async function requireEmployeeOwner(ctx: any, businessId: any, expectedUserId?: any, capability: "manageEmployees" | "editPayroll" = "manageEmployees") {
  const business = await ctx.db.get(businessId);
  if (!business) throw new Error("Forbidden");
  const access = await requireBusinessAccess(ctx, business, capability);
  if (expectedUserId && expectedUserId !== business.userId && expectedUserId !== access.actor._id) throw new Error("Forbidden");
  return access.owner;
}

async function requireEmployeeRecordOwner(ctx: any, employee: any, capability: "manageEmployees" | "editPayroll" = "manageEmployees") {
  if (!employee) throw new Error("Employee not found");
  return requireEmployeeOwner(ctx, employee.businessId, employee.userId, capability);
}

export const getByBusiness = query({
  args: { businessId: v.id("businesses") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const business = await ctx.db.get(args.businessId);
    if (!business) return [];
    try { await requireBusinessAccess(ctx, business, "read"); } catch { return []; }
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
    address: v.optional(v.string()),
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
    payrollIdentifiers: v.optional(v.any()),
    payType: v.optional(v.string()),
    hourlyRate: v.optional(v.number()),
    dailyRate: v.optional(v.number()),
    weeklyWage: v.optional(v.number()),
    fortnightlyWage: v.optional(v.number()),
    monthlySalary: v.optional(v.number()),
    annualSalary: v.optional(v.number()),
    defaultPayrollFrequency: v.optional(v.string()),
    countryCode: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const owner = await requireEmployeeOwner(ctx, args.businessId, args.userId);
    await assertCapacity(ctx, owner, "employees", 1);
    return ctx.db.insert("employees", { ...args, userId: owner._id, createdAt: Date.now() });
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
    address: v.optional(v.string()),
    payrollIdentifiers: v.optional(v.any()),
    payType: v.optional(v.string()),
    hourlyRate: v.optional(v.number()),
    dailyRate: v.optional(v.number()),
    weeklyWage: v.optional(v.number()),
    fortnightlyWage: v.optional(v.number()),
    monthlySalary: v.optional(v.number()),
    annualSalary: v.optional(v.number()),
    defaultPayrollFrequency: v.optional(v.string()),
    payFrequency: v.optional(v.string()),
    countryCode: v.optional(v.string()),
  },
  handler: async (ctx, { employeeId, ...fields }) => {
    const employee = await ctx.db.get(employeeId);
    const owner = await requireEmployeeRecordOwner(ctx, employee, "editPayroll");
    await ctx.db.patch(employeeId, fields);
    await recordAccountantActivity(ctx, owner._id, (await ctx.auth.getUserIdentity()) ? employee.userId : owner._id, "employee.edited", employee.businessId, { employeeId: String(employeeId) });
  },
});

export const deleteEmployee = mutation({
  args: { employeeId: v.id("employees") },
  handler: async (ctx, args) => {
    const employee = await ctx.db.get(args.employeeId);
    await requireEmployeeRecordOwner(ctx, employee);
    await ctx.db.delete(args.employeeId);
  },
});


export const bulkUpdate = mutation({
  args: {
    businessId: v.id("businesses"),
    updates: v.array(v.object({ employeeId: v.id("employees"), fields: v.any() })),
  },
  handler: async (ctx, args) => {
    const business = await ctx.db.get(args.businessId);
    if (!business) throw new Error("Client not found");
    const { actor, owner } = await requireBusinessAccess(ctx, business, "editPayroll");
    if (args.updates.length > 250) throw new Error("Update at most 250 employees per save.");
    const allowed = new Set(["basicPay", "frequencySalary", "regularHours", "overtimeHours", "overtimeRate", "bonus", "commission", "allowances", "paye", "nis", "healthSurcharge", "otherDeductions", "grossPay", "netPay", "status", "position", "department", "name", "employeeId", "email", "phone", "address", "payFrequency", "payType", "hourlyRate", "dailyRate", "weeklyWage", "fortnightlyWage", "monthlySalary", "annualSalary", "payrollIdentifiers", "statutoryData"]);
    for (const update of args.updates) {
      const employee = await ctx.db.get(update.employeeId);
      if (!employee || employee.businessId !== args.businessId) throw new Error("Employee is outside the selected client.");
      const fields = update.fields as Record<string, unknown>;
      if (["name", "employeeId", "email", "phone", "address"].some(key => key in fields)) {
        await requireBusinessAccess(ctx, business, "manageEmployees");
      }
      const safe: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(fields)) {
        if (!allowed.has(key)) throw new Error("Unsupported employee field.");
        if (["basicPay", "frequencySalary", "regularHours", "overtimeHours", "overtimeRate", "bonus", "commission", "allowances", "paye", "nis", "healthSurcharge", "otherDeductions", "grossPay", "netPay", "hourlyRate", "dailyRate", "weeklyWage", "fortnightlyWage", "monthlySalary", "annualSalary"].includes(key)) {
          const numeric = Number(value);
          if (!Number.isFinite(numeric) || numeric < 0) throw new Error("Payroll values must be valid non-negative numbers.");
          safe[key] = numeric;
        } else if (["status", "position", "department", "payFrequency", "payType", "name", "employeeId", "email", "phone", "address"].includes(key)) {
          const maxLength = key === "address" ? 1000 : key === "email" ? 254 : 120;
          if (typeof value !== "string" || value.length > maxLength || (key === "name" && !value.trim())) throw new Error("Invalid employee field.");
          if (key === "email" && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) throw new Error("Invalid employee email.");
          safe[key] = value.trim();
        } else safe[key] = value;
      }
      await ctx.db.patch(update.employeeId, safe);
    }
    await recordAccountantActivity(ctx, owner._id, actor._id, "employees.bulk_edited", args.businessId, { count: args.updates.length });
    return { updated: args.updates.length };
  },
});

export const bulkCreate = mutation({
  args: {
    businessId: v.id("businesses"),
    userId: v.id("users"),
    employees: v.array(v.any()),
  },
  handler: async (ctx, args) => {
    const owner = await requireEmployeeOwner(ctx, args.businessId, args.userId);
    if (!args.employees.length || args.employees.length > 2500) throw new Error("Import 1 to 2,500 employees per batch.");
    await assertCapacity(ctx, owner, "employees", args.employees.length);
    const ids = [];
    for (const emp of args.employees) {
      const id = await ctx.db.insert("employees", {
        businessId: args.businessId,
        userId: owner._id,
        name: emp.name,
        employeeId: emp.employeeId || `EMP-${Date.now()}`,
        position: emp.position || "Team Member",
        department: emp.department || "General",
        avatar: emp.avatar,
        email: emp.email,
        phone: emp.phone,
        address: emp.address,
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
        payrollIdentifiers: emp.payrollIdentifiers,
        statutoryData: emp.statutoryData,
        payType: emp.payType,
        hourlyRate: emp.hourlyRate,
        dailyRate: emp.dailyRate,
        weeklyWage: emp.weeklyWage,
        fortnightlyWage: emp.fortnightlyWage,
        monthlySalary: emp.monthlySalary,
        annualSalary: emp.annualSalary,
        defaultPayrollFrequency: emp.defaultPayrollFrequency || emp.payFrequency,
        countryCode: emp.countryCode,
        createdAt: Date.now(),
      });
      ids.push(id);
    }
    return ids;
  },
});


