import { performanceReady } from "./lib/performance";
import { getActor } from "./lib/accountantAccess";
import { requireVerifiedAccountantEmail } from "./lib/accountantEmailAccess";
import { query } from "./_generated/server";
import { mutation } from "./functions";
import { ConvexError, v } from "convex/values";
import { isAdminEmail } from "./admin";
import { assertCapacity, accountantPlanFor, throwLimit, ACCOUNTANT_PLANS } from "./usage";
import { getAccessibleBusinesses, requireBusinessAccess } from "./lib/accountantAccess";

async function requireBusinessUser(ctx: any, userId: any) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Unauthenticated");
  const user = await ctx.db.get(userId);
  if (!user || user.firebaseUid !== identity.subject) throw new Error("Forbidden");
  requireVerifiedAccountantEmail(user, identity);
  return user;
}

export const getByUser = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const user = await ctx.db.get(args.userId);
    if (!user || user.firebaseUid !== identity.subject) return null;
    requireVerifiedAccountantEmail(user, identity);
    return ctx.db
      .query("businesses")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();
  },
});

export const getAccessibleByUser = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => getAccessibleBusinesses(ctx, args.userId),
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
    countryCode: v.optional(v.string()),
    countryName: v.optional(v.string()),
    defaultPayrollFrequency: v.optional(v.string()),
    logo: v.optional(v.string()),
    signatureUrl: v.optional(v.string()),
    templateId: v.optional(v.string()),
    primaryColor: v.optional(v.string()),
    fontFamily: v.optional(v.string()),
    layoutStyle: v.optional(v.string()),
    accentColor: v.optional(v.string()),
    showCompanyLogo: v.optional(v.boolean()),
    showSignature: v.optional(v.boolean()),
    showYTD: v.optional(v.boolean()),
    showBankDetails: v.optional(v.boolean()),
    showTaxId: v.optional(v.boolean()),
    showQrVerification: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await requireBusinessUser(ctx, args.userId);
    if (user.accountType === "accountant" || user.plan?.startsWith("accountant")) await assertCapacity(ctx, user, "clients", 1);
    else {
      const existing = await ctx.db.query("businesses").withIndex("by_user", q => q.eq("userId", args.userId)).collect();
      if (existing.length && !(user.emailVerified === true && isAdminEmail(user.email)) && !(user.plan !== "free" && user.planStatus === "active")) throw new Error("PLAN_REQUIRED:pro");
    }
    if (user.accountType === "accountant" && !ACCOUNTANT_PLANS[accountantPlanFor(user)].fullBranding && ((args.templateId && args.templateId !== "modern") || (args.fontFamily && args.fontFamily !== "sans") || (args.layoutStyle && args.layoutStyle !== "standard"))) throw new ConvexError({ code: "PLAN_LIMIT_REACHED", kind: "branding", message: "Full custom payslip branding requires a paid Accountant plan. Your setup is saved." });
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
    countryCode: v.optional(v.string()),
    countryName: v.optional(v.string()),
    defaultPayrollFrequency: v.optional(v.string()),
    logo: v.optional(v.string()),
    signatureUrl: v.optional(v.string()),
    templateId: v.optional(v.string()),
    primaryColor: v.optional(v.string()),
    fontFamily: v.optional(v.string()),
    layoutStyle: v.optional(v.string()),
    accentColor: v.optional(v.string()),
    showCompanyLogo: v.optional(v.boolean()),
    showSignature: v.optional(v.boolean()),
    showYTD: v.optional(v.boolean()),
    showBankDetails: v.optional(v.boolean()),
    showTaxId: v.optional(v.boolean()),
    showQrVerification: v.optional(v.boolean()),
  },
  handler: async (ctx, { businessId, ...fields }) => {
    const business = await ctx.db.get(businessId);
    if (!business) throw new Error("Business not found");
    const { owner } = await requireBusinessAccess(ctx, business, "manageClients");
    if (!ACCOUNTANT_PLANS[accountantPlanFor(owner)].fullBranding && ((fields.templateId && fields.templateId !== "modern") || (fields.fontFamily && fields.fontFamily !== "sans") || (fields.layoutStyle && fields.layoutStyle !== "standard"))) throw new ConvexError({ code: "PLAN_LIMIT_REACHED", kind: "branding", message: "Full payslip templates and typography are included in the paid Accountant plans. Your branding is saved." });
    await ctx.db.patch(businessId, { ...fields, updatedAt: Date.now() });
  },
});


export const listAccessibleSummaries=query({args:{userId:v.id('users')},handler:async(ctx,a)=>{
 const {actor}=await getActor(ctx);if(actor._id!==a.userId)return [];
 if(!await performanceReady(ctx,'businesses'))return (await getAccessibleBusinesses(ctx,a.userId)).map(({_id,userId,name,countryCode,countryName,currency,currencySymbol,defaultPayrollFrequency}:any)=>({_id,userId,name,countryCode,countryName,currency,currencySymbol,defaultPayrollFrequency}));
 const owned=await ctx.db.query('businessDirectory').withIndex('by_user',q=>q.eq('userId',actor._id)).collect();
 const memberships=await ctx.db.query('accountantMemberships').withIndex('by_member',q=>q.eq('memberUserId',actor._id)).collect();
 const rows=[...owned];for(const member of memberships){if(member.status!=='active')continue;
  if(member.allClients)rows.push(...await ctx.db.query('businessDirectory').withIndex('by_user',q=>q.eq('userId',member.workspaceOwnerId)).collect());
  else for(const id of new Set(member.clientIds)){const normalized=ctx.db.normalizeId('businesses',id);if(!normalized)continue;const row=await ctx.db.query('businessDirectory').withIndex('by_source',q=>q.eq('sourceId',normalized)).unique();if(row?.userId===member.workspaceOwnerId)rows.push(row);}
 }
 return [...new Map(rows.map(({sourceId,_id,_creationTime,...row})=>[String(sourceId),{...row,_id:sourceId}])).values()];
}});
export const getAccessibleDetail=query({args:{businessId:v.id('businesses')},handler:async(ctx,a)=>{const business=await ctx.db.get(a.businessId);await requireBusinessAccess(ctx,business,'read');return business;}});
