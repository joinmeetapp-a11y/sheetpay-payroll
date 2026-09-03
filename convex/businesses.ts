import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { isAdminEmail } from "./admin";

export const getByUser = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return ctx.db
      .query("businesses")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();
  },
});

export const create = mutation({
  args: {
    userId: v.id("users"),
    name: v.string(),
    address: v.optional(v.string()),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    website: v.optional(v.string()),
    taxRegistrationId: v.optional(v.string()),
    nisNumber: v.optional(v.string()),
    signatoryName: v.optional(v.string()),
    signatoryTitle: v.optional(v.string()),
    currency: v.string(),
    currencySymbol: v.string(),
    logo: v.optional(v.string()),
    signatureUrl: v.optional(v.string()),
    templateId: v.optional(v.string()),
    primaryColor: v.optional(v.string()),
    accentColor: v.optional(v.string()),
    showCompanyLogo: v.optional(v.boolean()),
    showSignature: v.optional(v.boolean()),
    showYTD: v.optional(v.boolean()),
    showBankDetails: v.optional(v.boolean()),
    showTaxId: v.optional(v.boolean()),
    showQrVerification: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    // Multi-business support is a paid feature. Free plan gets exactly one
    // business row; a second attempt requires Pro or Accountant. Admins and
    // paid users pass through.
    const existing = await ctx.db
      .query("businesses")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    if (existing.length >= 1) {
      const user = await ctx.db.get(args.userId);
      const isAdmin = user && isAdminEmail(user.email);
      const plan = (user?.plan ?? "free") as string;
      const status = user?.planStatus ?? (plan === "free" ? "none" : "active");
      const active = status === "active" || status === "pending" || status === "trialing";
      const paid = plan !== "free" && active;
      if (!isAdmin && !paid) {
        throw new Error("PLAN_REQUIRED:pro");
      }
    }
    return ctx.db.insert("businesses", {
      ...args,
      updatedAt: Date.now(),
    });
  },
});

export const update = mutation({
  args: {
    businessId: v.id("businesses"),
    name: v.optional(v.string()),
    address: v.optional(v.string()),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    website: v.optional(v.string()),
    taxRegistrationId: v.optional(v.string()),
    nisNumber: v.optional(v.string()),
    signatoryName: v.optional(v.string()),
    signatoryTitle: v.optional(v.string()),
    currency: v.optional(v.string()),
    currencySymbol: v.optional(v.string()),
    logo: v.optional(v.string()),
    signatureUrl: v.optional(v.string()),
    templateId: v.optional(v.string()),
    primaryColor: v.optional(v.string()),
    accentColor: v.optional(v.string()),
    showCompanyLogo: v.optional(v.boolean()),
    showSignature: v.optional(v.boolean()),
    showYTD: v.optional(v.boolean()),
    showBankDetails: v.optional(v.boolean()),
    showTaxId: v.optional(v.boolean()),
    showQrVerification: v.optional(v.boolean()),
  },
  handler: async (ctx, { businessId, ...fields }) => {
    await ctx.db.patch(businessId, { ...fields, updatedAt: Date.now() });
  },
});
