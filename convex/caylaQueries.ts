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
    const conversations = await ctx.db
      .query("caylaConversations")
      .withIndex("by_user_id", (q) => q.eq("userId", args.userId))
      .order("desc")
      .collect();
    const existing = conversations.find((conversation) => conversation.businessId === args.businessId);
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
  args: { userId: v.string(), businessId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const conversations = await ctx.db
      .query("caylaConversations")
      .withIndex("by_user_id", (q) => q.eq("userId", args.userId))
      .order("desc")
      .collect();
    return conversations.find((conversation) => conversation.businessId === args.businessId) ?? null;
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
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || identity.subject !== args.userId) throw new Error("Unauthenticated");
    return await ctx.db
      .query("caylaConversations")
      .withIndex("by_user_id", (q) => q.eq("userId", identity.subject))
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
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || !args.userId || identity.subject !== args.userId) throw new Error("Unauthenticated");
    const limit = Math.max(1, Math.min(args.limit ?? 100, 500));
    return await ctx.db
      .query("caylaUsageLogs")
      .withIndex("by_user_id", (q) => q.eq("userId", identity.subject))
      .order("desc")
      .take(limit);
  },
});

export const getEmployeesForUser = internalQuery({
  args: { userId: v.string(), businessId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_firebase_uid", (q) => q.eq("firebaseUid", args.userId))
      .first();
    if (!user) return [];
    const employees = await ctx.db
      .query("employees")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    return args.businessId ? employees.filter((employee) => String(employee.businessId) === args.businessId) : employees;
  },
});

export const getPayrollRunsForUser = internalQuery({
  args: { userId: v.string(), businessId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_firebase_uid", (q) => q.eq("firebaseUid", args.userId))
      .first();
    if (!user) return [];
    const runs = await ctx.db
      .query("payrollRuns")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(100);
    return args.businessId ? runs.filter((run) => String(run.businessId) === args.businessId).slice(0, 24) : runs.slice(0, 24);
  },
});

export const getOwnedBusinessForUser = internalQuery({
  args: { userId: v.string(), businessId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db.query("users")
      .withIndex("by_firebase_uid", (q) => q.eq("firebaseUid", args.userId))
      .first();
    if (!user) return null;
    const business: any = await ctx.db.get(args.businessId as any);
    return business && business.userId === user._id ? business : null;
  },
});

export const getBusinessForUser = internalQuery({
  args: { userId: v.string(), businessId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_firebase_uid", (q) => q.eq("firebaseUid", args.userId))
      .first();
    if (!user) return null;
    if (args.businessId) {
      const selected: any = await ctx.db.get(args.businessId as any);
      return selected?.userId === user._id ? selected : null;
    }
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

    const business: any = await ctx.db.get(args.businessId as any);
    if (!business || business.userId !== user._id) throw new Error("Business not found");

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
