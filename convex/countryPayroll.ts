import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { calculateTrinidadPayroll } from "./lib/countryTaxRules/trinidad-and-tobago";
import { calculateBarbadosPayroll } from "./lib/countryTaxRules/barbados";
import { calculateSaintLuciaPayroll } from "./lib/countryTaxRules/saint-lucia";
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


export const calculateStatutoryPayroll = query({
  args: {
    countryCode: v.string(),
    grossIncome: v.number(),
    frequency: v.string(),
    payDate: v.optional(v.string()),
    allowances: v.optional(v.number()),
    otherDeductions: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await currentUser(ctx);
    const business = await ctx.db.query("businesses").withIndex("by_user", (q: any) => q.eq("userId", user._id)).first();
    if (!business) throw new Error("Business profile required");
    const code = args.countryCode.toUpperCase();
    if ((business.countryCode || "").toUpperCase() !== code) throw new Error("Country does not match authenticated business");
    const rule = RULES[code];
    if (!rule) return { supported: false, countryCode: code, currency: business.currency, reason: "Automatic statutory calculations are not yet available for this country." };
    const rawFrequency = args.frequency.toLowerCase();
    const frequency = rawFrequency === "biweekly" ? "fortnightly" : rawFrequency === "semimonthly" ? "semi-monthly" : rawFrequency;
    if (!["weekly","fortnightly","semi-monthly","monthly","annual"].includes(frequency)) throw new Error("Unsupported payroll frequency for statutory calculation");
    const input: any = {
      grossIncome: Math.max(0, args.grossIncome),
      frequency,
      taxYear: args.payDate ? new Date(args.payDate + "T00:00:00Z").getUTCFullYear() : rule.taxYear,
      allowances: Math.max(0, args.allowances || 0),
      otherDeductions: Math.max(0, args.otherDeductions || 0),
    };
    let result: any;
    if (code === "TT") result = calculateTrinidadPayroll(input);
    else if (code === "BB") result = calculateBarbadosPayroll(input);
    else if (code === "LC") result = calculateSaintLuciaPayroll(input);
    else if (code === "BZ") result = calculateBelizePayroll(input);
    else return { supported: false, countryCode: code, currency: business.currency };
    return {
      supported: true,
      ruleVersion: rule.version,
      effectiveFrom: rule.effectiveFrom,
      lastUpdated: rule.lastUpdated,
      source: rule.source,
      ...result,
    };
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
