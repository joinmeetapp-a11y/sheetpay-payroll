import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { assertWithinLimit, incrementUsageIdempotent } from "./usage";

// ─── Conversation store (called from cayla.ts actions) ────────────────────────
export const getOrCreateConversation = internalMutation({
  args: {
    userId: v.string(),
    businessId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("caylaConversations")
      .withIndex("by_user_id", (q) => q.eq("userId", args.userId))
      .order("desc")
      .first();
    if (existing) return existing._id;
    return await ctx.db.insert("caylaConversations", {
      userId: args.userId,
      businessId: args.businessId,
      messages: [],
      totalTokensUsed: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

export const appendMessages = internalMutation({
  args: {
    conversationId: v.id("caylaConversations"),
    newMessages: v.array(
      v.object({
        role: v.string(),
        content: v.string(),
        toolCallId: v.optional(v.string()),
        toolName: v.optional(v.string()),
        timestamp: v.number(),
      })
    ),
    tokensUsed: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const conv = await ctx.db.get(args.conversationId);
    if (!conv) return;
    const messages = [...conv.messages, ...args.newMessages].slice(-40);
    await ctx.db.patch(args.conversationId, {
      messages,
      totalTokensUsed: (conv.totalTokensUsed ?? 0) + (args.tokensUsed ?? 0),
      updatedAt: Date.now(),
    });
  },
});

export const getConversationHistory = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("caylaConversations")
      .withIndex("by_user_id", (q) => q.eq("userId", args.userId))
      .order("desc")
      .first();
  },
});

export const logUsage = internalMutation({
  args: {
    userId: v.string(),
    businessId: v.optional(v.string()),
    model: v.string(),
    inputTokens: v.number(),
    outputTokens: v.number(),
    userMessage: v.string(),
    toolsCalled: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const inputRate = args.model === "gpt-4o" ? 2.5 / 1_000_000 : 0.15 / 1_000_000;
    const outputRate = args.model === "gpt-4o" ? 10 / 1_000_000 : 0.6 / 1_000_000;
    const estimatedCostUsd = args.inputTokens * inputRate + args.outputTokens * outputRate;
    await ctx.db.insert("caylaUsageLogs", {
      userId: args.userId,
      businessId: args.businessId,
      model: args.model,
      inputTokens: args.inputTokens,
      outputTokens: args.outputTokens,
      estimatedCostUsd,
      userMessage: args.userMessage.slice(0, 500),
      toolsCalled: args.toolsCalled,
      createdAt: Date.now(),
    });
  },
});

// ─── Public queries for frontend ──────────────────────────────────────────────
export const getConversation = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("caylaConversations")
      .withIndex("by_user_id", (q) => q.eq("userId", args.userId))
      .order("desc")
      .first();
  },
});

export const getUsageAnalytics = query({
  args: {
    userId: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 100;
    if (args.userId) {
      return await ctx.db
        .query("caylaUsageLogs")
        .withIndex("by_user_id", (q) => q.eq("userId", args.userId!))
        .order("desc")
        .take(limit);
    }
    return await ctx.db.query("caylaUsageLogs").order("desc").take(limit);
  },
});

export const getEmployeesForUser = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_firebase_uid", (q) => q.eq("firebaseUid", args.userId))
      .first();
    if (!user) return [];
    return await ctx.db
      .query("employees")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
  },
});

export const getPayrollRunsForUser = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_firebase_uid", (q) => q.eq("firebaseUid", args.userId))
      .first();
    if (!user) return [];
    return await ctx.db
      .query("payrollRuns")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(24);
  },
});

export const getBusinessForUser = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_firebase_uid", (q) => q.eq("firebaseUid", args.userId))
      .first();
    if (!user) return null;
    return await ctx.db
      .query("businesses")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();
  },
});

export const savePayrollRun = internalMutation({
  args: {
    userId: v.string(),
    businessId: v.string(),
    month: v.string(),
    year: v.number(),
    periodLabel: v.string(),
    employeesSnapshot: v.array(v.any()),
    totalGross: v.number(),
    totalPaye: v.number(),
    totalNis: v.number(),
    totalHealthSurcharge: v.number(),
    totalDeductions: v.number(),
    totalNet: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_firebase_uid", (q) => q.eq("firebaseUid", args.userId))
      .first();
    if (!user) throw new Error("User not found");

    const business = await ctx.db
      .query("businesses")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();
    if (!business) throw new Error("Business not found");

    const now = Date.now();
    const existing = await ctx.db
      .query("payrollRuns")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .filter((q) => q.and(q.eq(q.field("month"), args.month), q.eq(q.field("year"), args.year)))
      .first();

    if (existing) {
      // Updating an existing run for the same period doesn't consume another
      // payroll credit — it's the same logical operation.
      await ctx.db.patch(existing._id, {
        status: "completed",
        periodLabel: args.periodLabel,
        employeesSnapshot: args.employeesSnapshot,
        totalGross: args.totalGross,
        totalPaye: args.totalPaye,
        totalNis: args.totalNis,
        totalHealthSurcharge: args.totalHealthSurcharge,
        totalDeductions: args.totalDeductions,
        totalNet: args.totalNet,
        updatedAt: now,
      });
      // Idempotent — a Cayla retry against the same period doesn't double-count.
      await incrementUsageIdempotent(ctx, user._id, "payroll", `payroll:${existing._id}`);
      return existing._id;
    }

    // New run: enforce free-plan cap first, then insert + count.
    await assertWithinLimit(ctx, user, "payroll");

    const runId = await ctx.db.insert("payrollRuns", {
      userId: user._id,
      businessId: business._id,
      month: args.month,
      year: args.year,
      status: "completed",
      periodLabel: args.periodLabel,
      employeesSnapshot: args.employeesSnapshot,
      totalGross: args.totalGross,
      totalPaye: args.totalPaye,
      totalNis: args.totalNis,
      totalHealthSurcharge: args.totalHealthSurcharge,
      totalDeductions: args.totalDeductions,
      totalNet: args.totalNet,
      createdAt: now,
      updatedAt: now,
    });
    await incrementUsageIdempotent(ctx, user._id, "payroll", `payroll:${runId}`);
    return runId;
  },
});


// Mobile Cayla helpers use verified IDs passed only from the authenticated
// mobileCayla action. These are internal and cannot be called by the client.
export const getUserByFirebaseUidMobile = internalQuery({
  args: { firebaseUid: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db.query("users")
      .withIndex("by_firebase_uid", (q) => q.eq("firebaseUid", args.firebaseUid))
      .first();
  },
});

export const getEmployeeYtdForMobile = internalQuery({
  args: { employeeId: v.id("employees"), userId: v.id("users"), year: v.number() },
  handler: async (ctx, args) => {
    const employee = await ctx.db.get(args.employeeId);
    if (!employee || employee.userId !== args.userId) throw new Error("Forbidden");
    const runs = await ctx.db.query("payrollRuns")
      .withIndex("by_business_year", (q) => q.eq("businessId", employee.businessId).eq("year", args.year))
      .collect();
    let gross=0,deductions=0,net=0,paye=0,nis=0,healthSurcharge=0,payslips=0;
    for(const run of runs){
      if(!["completed","payslips_generated","delivered","approved","finalized","paid"].includes(run.status)) continue;
      const snap=(run.employeesSnapshot||[]).find((x:any)=>
        String(x?._id??x?.id??x?.employeeId??"")===String(employee._id) ||
        String(x?.employeeId??"")===String(employee.employeeId)
      );
      if(!snap) continue;
      gross+=Number(snap.grossPay||0);
      deductions+=Number(snap.totalDeductions??snap.deductions??0);
      net+=Number(snap.netPay||0);
      paye+=Number(snap.paye||0); nis+=Number(snap.nis||0); healthSurcharge+=Number(snap.healthSurcharge||0);
      payslips++;
    }
    return {gross,deductions,net,paye,nis,healthSurcharge,payslips};
  },
});

export const logPrivacySafeEvent = internalMutation({
  args: { userId: v.id("users"), eventName: v.string(), intent: v.optional(v.string()) },
  handler: async (ctx,args) => {
    const allowed=new Set(["cayla_opened","cayla_request_sent","cayla_intent_detected","cayla_action_previewed","cayla_action_confirmed","cayla_action_completed","cayla_action_failed"]);
    if(!allowed.has(args.eventName)) throw new Error("Unsupported event");
    await ctx.db.insert("retentionEvents",{userId:args.userId,eventName:args.eventName,createdAt:Date.now()});
  }
});
