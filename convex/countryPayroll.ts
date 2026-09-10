import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { calculateTrinidadPayroll } from "./lib/countryTaxRules/trinidad_and_tobago";
import { calculateBarbadosPayroll } from "./lib/countryTaxRules/barbados";
import { calculateSaintLuciaPayroll } from "./lib/countryTaxRules/saint_lucia";
import { calculateBelizePayroll } from "./lib/countryTaxRules/belize";

type Rule = {
  countryCode: string;
  countryName: string;
  currency: string;
  currencySymbol: string;
  taxYear: number;
  version: string;
  effectiveFrom: string;
  effectiveTo?: string;
  lastUpdated: string;
  automatic: boolean;
  labels: string[];
  employeeFields: string[];
  source: string;
};

// These entries describe only rule modules already implemented and verified in
// Sheetpay's deterministic tax-rules library. Unknown countries remain manual.
const RULES: Record<string, Rule> = {
  TT: {
    countryCode: "TT", countryName: "Trinidad & Tobago", currency: "TTD", currencySymbol: "TT$",
    taxYear: 2026, version: "TT-2026.1", effectiveFrom: "2026-01-01", lastUpdated: "August 2026",
    automatic: true, labels: ["PAYE", "NIS", "Health Surcharge"],
    employeeFields: ["taxIdentificationNumber", "nationalInsuranceNumber", "taxAllowance", "contributionClass"],
    source: "NIBTT & Board of Inland Revenue",
  },
  BB: {
    countryCode: "BB", countryName: "Barbados", currency: "BBD", currencySymbol: "BDS$",
    taxYear: 2026, version: "BB-2026.1", effectiveFrom: "2026-01-01", lastUpdated: "August 2026",
    automatic: true, labels: ["PAYE", "National Insurance"],
    employeeFields: ["taxIdentificationNumber", "nationalInsuranceNumber", "taxAllowance"],
    source: "Barbados Revenue Authority & National Insurance",
  },
  LC: {
    countryCode: "LC", countryName: "Saint Lucia", currency: "XCD", currencySymbol: "EC$",
    taxYear: 2026, version: "LC-2026.1", effectiveFrom: "2026-01-01", lastUpdated: "August 2026",
    automatic: true, labels: ["PAYE", "NIC"],
    employeeFields: ["taxIdentificationNumber", "nationalInsuranceNumber", "taxAllowance"],
    source: "Saint Lucia Inland Revenue Department & NIC",
  },
  BZ: {
    countryCode: "BZ", countryName: "Belize", currency: "BZD", currencySymbol: "BZ$",
    taxYear: 2026, version: "BZ-2026.1", effectiveFrom: "2026-01-01", lastUpdated: "August 2026",
    automatic: true, labels: ["Income Tax", "Social Security"],
    employeeFields: ["taxIdentificationNumber", "socialSecurityNumber", "taxAllowance"],
    source: "Belize Tax Service Department & Social Security Board",
  },
};

const MANUAL: Record<string, { name: string; currency: string }> = {
  JM: { name: "Jamaica", currency: "JMD" },
  US: { name: "United States", currency: "USD" },
  GB: { name: "United Kingdom", currency: "GBP" },
  CA: { name: "Canada", currency: "CAD" },
  AU: { name: "Australia", currency: "AUD" },
  GY: { name: "Guyana", currency: "GYD" },
  BS: { name: "Bahamas", currency: "BSD" },
  GD: { name: "Grenada", currency: "XCD" },
  VC: { name: "Saint Vincent & the Grenadines", currency: "XCD" },
  AG: { name: "Antigua & Barbuda", currency: "XCD" },
  DM: { name: "Dominica", currency: "XCD" },
};

async function currentUser(ctx: any) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Authentication required");
  const user = await ctx.db.query("users").withIndex("by_firebase_uid", (q: any) => q.eq("firebaseUid", identity.subject)).first();
  if (!user) throw new Error("Sheetpay user not found");
  return user;
}

export const getCountryRules = query({
  args: { countryCode: v.string() },
  handler: async (_ctx, args) => {
    const code = args.countryCode.toUpperCase();
    const rule = RULES[code];
    if (rule) return rule;
    const manual = MANUAL[code];
    return {
      countryCode: code,
      countryName: manual?.name || code,
      currency: manual?.currency || "USD",
      currencySymbol: "",
      taxYear: new Date().getUTCFullYear(),
      version: "manual",
      effectiveFrom: "",
      lastUpdated: "",
      automatic: false,
      labels: [],
      employeeFields: [],
      source: "",
    };
  },
});

export const getBusinessCountry = query({
  args: {},
  handler: async (ctx) => {
    const user = await currentUser(ctx);
    const business = await ctx.db.query("businesses").withIndex("by_user", (q: any) => q.eq("userId", user._id)).first();
    if (!business) return null;
    const code = (business.countryCode || "").toUpperCase();
    return { business, rules: code ? (RULES[code] || null) : null };
  },
});

export const setBusinessCountry = mutation({
  args: { countryCode: v.string() },
  handler: async (ctx, args) => {
    const user = await currentUser(ctx);
    const business = await ctx.db.query("businesses").withIndex("by_user", (q: any) => q.eq("userId", user._id)).first();
    if (!business) throw new Error("Create your business profile before selecting payroll country.");
    const code = args.countryCode.toUpperCase();
    const rule = RULES[code];
    const manual = MANUAL[code];
    const currency = rule?.currency || manual?.currency || business.currency || "USD";
    const countryName = rule?.countryName || manual?.name || code;
    await ctx.db.patch(business._id, {
      countryCode: code,
      countryName,
      currency,
      currencySymbol: rule?.currencySymbol || business.currencySymbol || "",
      taxRuleVersion: rule?.version || "manual",
      taxRuleEffectiveFrom: rule?.effectiveFrom || "",
      taxRuleLastUpdated: rule?.lastUpdated || "",
      updatedAt: Date.now(),
    });
    return {
      countryCode: code,
      countryName,
      currency,
      automatic: !!rule,
      rules: rule || null,
    };
  },
});



function normalizeFrequency(value: string) {
  const raw = value.toLowerCase();
  return raw === "biweekly" ? "fortnightly" : raw === "semimonthly" ? "semi-monthly" : raw;
}

function isEffective(effectiveFrom: string, effectiveTo: string | undefined, payDate: string) {
  return effectiveFrom <= payDate && (!effectiveTo || payDate <= effectiveTo);
}

async function resolveRule(ctx: any, business: any, code: string, taxYear: number, payDate: string) {
  const overrides = await ctx.db.query("businessStatutoryOverrides")
    .withIndex("by_business_year", (q: any) => q.eq("businessId", business._id).eq("taxYear", taxYear))
    .collect();
  const activeOverride = overrides
    .filter((r: any) => r.enabled && r.countryCode === code && isEffective(r.effectiveFrom, r.effectiveTo, payDate))
    .sort((a: any, b: any) => b.effectiveFrom.localeCompare(a.effectiveFrom))[0];
  if (activeOverride) return { kind: "custom", record: activeOverride };

  const stored = await ctx.db.query("statutoryRuleSets")
    .withIndex("by_country_year", (q: any) => q.eq("countryCode", code).eq("taxYear", taxYear))
    .collect();
  const activeStored = stored
    .filter((r: any) => r.verified && isEffective(r.effectiveFrom, r.effectiveTo, payDate))
    .sort((a: any, b: any) => b.effectiveFrom.localeCompare(a.effectiveFrom))[0];
  if (activeStored) return { kind: "verified", record: activeStored };

  const builtIn = RULES[code];
  if (builtIn && builtIn.taxYear === taxYear && isEffective(builtIn.effectiveFrom, builtIn.effectiveTo, payDate)) {
    return { kind: "verified", record: builtIn };
  }
  return null;
}

export const calculateOnboardingStatutoryPreview = query({
  args: {
    countryCode: v.string(),
    grossIncome: v.number(),
    frequency: v.string(),
    payDate: v.string(),
    payPeriodStart: v.optional(v.string()),
    payPeriodEnd: v.optional(v.string()),
    daysWorked: v.optional(v.array(v.string())),
    payType: v.optional(v.string()),
    otherDeductions: v.optional(v.number()),
  },
  handler: async (_ctx, args) => {
    const code = args.countryCode.toUpperCase();
    const rule = RULES[code];
    if (!rule) {
      return { supported: false, countryCode: code, reason: "Automatic statutory calculations are not available for this country." };
    }

    const frequency = normalizeFrequency(args.frequency);
    if (!["weekly","fortnightly","monthly"].includes(frequency)) {
      return { supported: false, countryCode: code, reason: "Unsupported payroll frequency." };
    }

    const taxYear = new Date(args.payDate + "T00:00:00Z").getUTCFullYear();
    if (taxYear !== rule.taxYear || !isEffective(rule.effectiveFrom, rule.effectiveTo, args.payDate)) {
      return {
        supported: false,
        countryCode: code,
        taxYear,
        reason: "Automatic statutory calculations are not currently available for this country/tax year.",
      };
    }

    const input: any = {
      grossIncome: Math.max(0, args.grossIncome),
      frequency,
      taxYear,
      allowances: 0,
      otherDeductions: 0,
    };

    let result: any;
    if (code === "TT") result = calculateTrinidadPayroll(input);
    else if (code === "BB") result = calculateBarbadosPayroll(input);
    else if (code === "LC") result = calculateSaintLuciaPayroll(input);
    else if (code === "BZ") result = calculateBelizePayroll(input);
    else return { supported: false, countryCode: code };

    const statutoryDeductions = [
      ...(Number(result.payeTax) > 0 ? [{ key: code === "BZ" ? "income_tax" : "paye", label: code === "BZ" ? "Income Tax" : "PAYE", amount: Number(result.payeTax) }] : []),
      ...(Number(result.employeeNIS) > 0 ? [{ key: code === "LC" ? "nic" : code === "BZ" ? "social_security" : "nis", label: code === "LC" ? "NIC" : code === "BZ" ? "Social Security" : code === "BB" ? "National Insurance" : "NIS", amount: Number(result.employeeNIS) }] : []),
      ...(Number(result.healthSurcharge) > 0 ? [{ key: "health_surcharge", label: "Health Surcharge", amount: Number(result.healthSurcharge) }] : []),
    ];

    const employerContributions = Number(result.employerNIS) > 0 ? [{
      key: code === "LC" ? "employer_nic" : code === "BZ" ? "employer_social_security" : "employer_nis",
      label: code === "LC" ? "Employer NIC" : code === "BZ" ? "Employer Social Security" : code === "BB" ? "Employer National Insurance" : "Employer NIS",
      amount: Number(result.employerNIS),
    }] : [];

    const otherDeductions = Math.max(0, args.otherDeductions || 0);
    const totalStatutoryDeductions = Number(result.totalEmployeeDeductions || 0);
    const totalDeductions = totalStatutoryDeductions + otherDeductions;
    const grossPay = Number(result.grossIncome || args.grossIncome);
    const netPay = grossPay - totalDeductions;

    return {
      supported: true,
      countryCode: code,
      countryName: rule.countryName,
      currency: rule.currency,
      taxYear,
      payrollFrequency: frequency,
      grossPay,
      taxableIncome: Number(result.taxableIncome || 0),
      statutoryDeductions,
      employeeContributions: statutoryDeductions.filter((d) => !["paye","income_tax","health_surcharge"].includes(d.key)),
      employerContributions,
      otherDeductions,
      totalStatutoryDeductions,
      totalEmployerContributions: Number(result.totalEmployerContributions || 0),
      totalDeductions,
      netPay,
      calculationBreakdown: result,
      taxRuleVersion: rule.version,
      effectiveFrom: rule.effectiveFrom,
      lastUpdated: rule.lastUpdated,
      source: rule.source,
      ruleStatus: "verified",
    };
  },
});

export const calculateStatutoryPayroll = query({
  args: {
    countryCode: v.optional(v.string()),
    grossIncome: v.number(),
    frequency: v.string(),
    payDate: v.string(),
    payPeriodStart: v.optional(v.string()),
    payPeriodEnd: v.optional(v.string()),
    daysWorked: v.optional(v.array(v.string())),
    payType: v.optional(v.string()),
    allowances: v.optional(v.number()),
    otherDeductions: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await currentUser(ctx);
    const business = await ctx.db.query("businesses").withIndex("by_user", (q: any) => q.eq("userId", user._id)).first();
    if (!business) throw new Error("Business profile required");
    const code = (business.countryCode || "").toUpperCase();
    if (!code) throw new Error("Business country is required before statutory calculation");
    if (args.countryCode && args.countryCode.toUpperCase() !== code) throw new Error("Payslip country does not match authenticated business country");

    const frequency = normalizeFrequency(args.frequency);
    if (!["weekly","fortnightly","semi-monthly","monthly","annual"].includes(frequency)) throw new Error("Unsupported payroll frequency for statutory calculation");
    if (!Number.isFinite(args.grossIncome) || args.grossIncome < 0) throw new Error("Gross earnings must be a valid non-negative amount");
    const parsedDate = new Date(args.payDate + "T00:00:00Z");
    const taxYear = parsedDate.getUTCFullYear();
    if (!Number.isFinite(taxYear)) throw new Error("A valid pay date is required");

    const resolved = await resolveRule(ctx, business, code, taxYear, args.payDate);
    if (!resolved) {
      console.error("[statutory] no effective rule", { countryCode: code, frequency, taxYear, payDate: args.payDate, grossPay: args.grossIncome });
      return { supported: false, countryCode: code, taxYear, reason: "Automatic statutory calculations are unavailable for this country or tax year." };
    }

    const base = RULES[code];
    if (!base) return { supported: false, countryCode: code, taxYear, reason: "Automatic statutory calculations are unavailable for this country or tax year." };
    const record: any = resolved.record;
    const ruleVersion = resolved.kind === "custom" ? record.customVersion : record.version;
    const effectiveFrom = record.effectiveFrom;
    const rules = record.rules || {};
    const input: any = {
      grossIncome: Math.max(0, args.grossIncome),
      frequency,
      taxYear,
      allowances: Math.max(0, args.allowances || 0),
      otherDeductions: 0,
      ...rules,
    };

    let result: any;
    if (code === "TT") result = calculateTrinidadPayroll(input);
    else if (code === "BB") result = calculateBarbadosPayroll(input);
    else if (code === "LC") result = calculateSaintLuciaPayroll(input);
    else if (code === "BZ") result = calculateBelizePayroll(input);
    else return { supported: false, countryCode: code, taxYear, reason: "Automatic statutory calculations are unavailable for this country or tax year." };

    const statutoryDeductions = [
      ...(Number(result.payeTax) > 0 ? [{ key: code === "BZ" ? "income_tax" : "paye", label: code === "BZ" ? "Income Tax" : "PAYE", amount: Number(result.payeTax) }] : []),
      ...(Number(result.employeeNIS) > 0 ? [{ key: code === "LC" ? "nic" : code === "BZ" ? "social_security" : "nis", label: code === "LC" ? "NIC" : code === "BZ" ? "Social Security" : code === "BB" ? "National Insurance" : "NIS", amount: Number(result.employeeNIS) }] : []),
      ...(Number(result.healthSurcharge) > 0 ? [{ key: "health_surcharge", label: "Health Surcharge", amount: Number(result.healthSurcharge) }] : []),
    ];
    const employerContributions = Number(result.employerNIS) > 0 ? [{
      key: code === "LC" ? "employer_nic" : code === "BZ" ? "employer_social_security" : "employer_nis",
      label: code === "LC" ? "Employer NIC" : code === "BZ" ? "Employer Social Security" : code === "BB" ? "Employer National Insurance" : "Employer NIS",
      amount: Number(result.employerNIS),
    }] : [];
    const otherDeductions = Math.max(0, args.otherDeductions || 0);
    const statutoryTotal = Number(result.totalEmployeeDeductions || 0);
    const totalDeductions = statutoryTotal + otherDeductions;
    const netPay = Number(result.grossIncome) - totalDeductions;

    if (!Array.isArray(statutoryDeductions)) {
      console.error("[statutory] invalid calculation result", { countryCode: code, frequency, taxYear, ruleVersion, grossPay: args.grossIncome });
      throw new Error("Statutory calculation returned an invalid result");
    }
    console.debug("[statutory]", { countryCode: code, frequency, taxYear, ruleVersion, grossPay: args.grossIncome, statutoryDeductions, totalDeductions, netPay });

    return {
      supported: true,
      countryCode: code,
      countryName: base.countryName,
      currency: base.currency,
      taxYear,
      payrollFrequency: frequency,
      payPeriodStart: args.payPeriodStart || "",
      payPeriodEnd: args.payPeriodEnd || "",
      payDate: args.payDate,
      grossPay: Number(result.grossIncome),
      taxableIncome: Number(result.taxableIncome || 0),
      statutoryDeductions,
      employeeContributions: statutoryDeductions.filter((d) => !["paye","income_tax","health_surcharge"].includes(d.key)),
      employerContributions,
      otherDeductions,
      totalStatutoryDeductions: statutoryTotal,
      totalEmployerContributions: Number(result.totalEmployerContributions || 0),
      totalDeductions,
      netPay,
      calculationBreakdown: result,
      taxRuleVersion: ruleVersion,
      ruleVersion,
      effectiveFrom,
      lastUpdated: record.lastUpdated || new Date(record.updatedAt || Date.now()).toISOString(),
      source: resolved.kind === "custom" ? "Custom Business Rule" : (record.source || base.source),
      ruleStatus: resolved.kind === "custom" ? "custom" : "verified",
    };
  },
});


export const getPayrollStatutorySettings = query({
  args: {},
  handler: async (ctx) => {
    const user = await currentUser(ctx);
    const business = await ctx.db.query("businesses").withIndex("by_user", (q: any) => q.eq("userId", user._id)).first();
    if (!business) return null;
    const code = (business.countryCode || "").toUpperCase();
    const builtIn = RULES[code] || null;
    const overrides = await ctx.db.query("businessStatutoryOverrides").withIndex("by_business", (q: any) => q.eq("businessId", business._id)).collect();
    const stored = builtIn ? await ctx.db.query("statutoryRuleSets").withIndex("by_country_year", (q: any) => q.eq("countryCode", code).eq("taxYear", builtIn.taxYear)).collect() : [];
    return { businessId: business._id, countryCode: code, currency: business.currency, verifiedRule: builtIn, verifiedVersions: stored, businessOverrides: overrides };
  },
});

export const createBusinessStatutoryOverride = mutation({
  args: {
    baseRuleVersion: v.string(),
    customVersion: v.string(),
    taxYear: v.number(),
    effectiveFrom: v.string(),
    effectiveTo: v.optional(v.string()),
    rules: v.any(),
  },
  handler: async (ctx, args) => {
    const user = await currentUser(ctx);
    const business = await ctx.db.query("businesses").withIndex("by_user", (q: any) => q.eq("userId", user._id)).first();
    if (!business) throw new Error("Business profile required");
    const code = (business.countryCode || "").toUpperCase();
    if (!RULES[code]) throw new Error("No verified base statutory rule is available for this country");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(args.effectiveFrom)) throw new Error("Effective date must be YYYY-MM-DD");
    if (args.taxYear !== Number(args.effectiveFrom.slice(0,4))) throw new Error("Effective date must fall within the selected tax year");
    if (!args.customVersion.trim()) throw new Error("Custom rule version is required");
    const existing = await ctx.db.query("businessStatutoryOverrides").withIndex("by_business_year", (q: any) => q.eq("businessId", business._id).eq("taxYear", args.taxYear)).collect();
    if (existing.some((r: any) => r.customVersion === args.customVersion.trim())) throw new Error("This rule version already exists");
    if (existing.some((r: any) => r.enabled && isEffective(r.effectiveFrom, r.effectiveTo, args.effectiveFrom))) throw new Error("Effective date overlaps an existing business rule version");
    const now = Date.now();
    return await ctx.db.insert("businessStatutoryOverrides", {
      businessId: business._id, countryCode: code, taxYear: args.taxYear,
      baseRuleVersion: args.baseRuleVersion, customVersion: args.customVersion.trim(),
      effectiveFrom: args.effectiveFrom, effectiveTo: args.effectiveTo,
      rules: args.rules, createdBy: user._id, createdAt: now, updatedAt: now, enabled: true,
    });
  },
});

export const setBusinessPayrollDefaults = mutation({
  args: {
    countryCode: v.string(),
    defaultPayrollFrequency: v.union(v.literal("weekly"), v.literal("fortnightly"), v.literal("monthly")),
    businessName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await currentUser(ctx);
    const code = args.countryCode.toUpperCase();
    const rule = RULES[code];
    const manual = MANUAL[code];
    const currency = rule?.currency || manual?.currency || "USD";
    const countryName = rule?.countryName || manual?.name || code;
    let business = await ctx.db.query("businesses")
      .withIndex("by_user", (q: any) => q.eq("userId", user._id)).first();

    const patch = {
      countryCode: code,
      countryName,
      currency,
      currencySymbol: rule?.currencySymbol || "",
      taxRuleVersion: rule?.version || "manual",
      taxRuleEffectiveFrom: rule?.effectiveFrom || "",
      taxRuleLastUpdated: rule?.lastUpdated || "",
      defaultPayrollFrequency: args.defaultPayrollFrequency,
      updatedAt: Date.now(),
    };

    if (!business) {
      const id = await ctx.db.insert("businesses", {
        userId: user._id,
        name: args.businessName?.trim() || "My Business",
        ...patch,
      });
      business = await ctx.db.get(id);
    } else {
      await ctx.db.patch(business._id, patch);
      business = await ctx.db.get(business._id);
    }

    return {
      businessId: business?._id,
      countryCode: code,
      countryName,
      currency,
      defaultPayrollFrequency: args.defaultPayrollFrequency,
      automatic: !!rule,
      rules: rule || null,
    };
  },
});
