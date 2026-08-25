import { internalMutation, internalQuery, mutation, query, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { isAdminEmail } from "./admin";

// ═════════════════════════════════════════════════════════════════════════════
// Conversation bootstrap
// ═════════════════════════════════════════════════════════════════════════════

export const startOrGetConversation = internalMutation({
  args: {
    requesterUid: v.optional(v.string()),
    anonSessionId: v.optional(v.string()),
    conversationId: v.optional(v.id("niaConversations")),
  },
  handler: async (ctx, args) => {
    if (args.conversationId) {
      const conv = await ctx.db.get(args.conversationId);
      if (conv) {
        await ctx.db.patch(conv._id, { lastMessageAt: Date.now() });
        return { conversationId: conv._id, mode: conv.mode };
      }
    }

    let userId: Id<"users"> | undefined;
    let businessId: Id<"businesses"> | undefined;
    if (args.requesterUid) {
      const user = await ctx.db
        .query("users")
        .withIndex("by_firebase_uid", (q) => q.eq("firebaseUid", args.requesterUid!))
        .first();
      if (user) {
        userId = user._id;
        const business = await ctx.db
          .query("businesses")
          .withIndex("by_user", (q) => q.eq("userId", user._id))
          .first();
        businessId = business?._id;

        // Continue an existing open Nia conversation for this user if one
        // exists — avoids fragmenting the transcript across sessions.
        const existing = await ctx.db
          .query("niaConversations")
          .withIndex("by_user", (q) => q.eq("userId", userId))
          .order("desc")
          .first();
        if (existing && existing.mode !== "closed") {
          await ctx.db.patch(existing._id, { lastMessageAt: Date.now() });
          return { conversationId: existing._id, mode: existing.mode };
        }
      }
    } else if (args.anonSessionId) {
      const existing = await ctx.db
        .query("niaConversations")
        .withIndex("by_anon", (q) => q.eq("anonSessionId", args.anonSessionId!))
        .order("desc")
        .first();
      if (existing && existing.mode !== "closed") {
        await ctx.db.patch(existing._id, { lastMessageAt: Date.now() });
        return { conversationId: existing._id, mode: existing.mode };
      }
    }

    const now = Date.now();
    const id = await ctx.db.insert("niaConversations", {
      userId,
      businessId,
      anonSessionId: args.anonSessionId,
      mode: "nia",
      lastMessageAt: now,
      createdAt: now,
    });
    return { conversationId: id, mode: "nia" as const };
  },
});

export const appendMessage = internalMutation({
  args: {
    conversationId: v.id("niaConversations"),
    senderType: v.string(),
    content: v.string(),
    senderUserId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("niaMessages", {
      conversationId: args.conversationId,
      senderType: args.senderType,
      senderUserId: args.senderUserId,
      content: args.content,
      createdAt: Date.now(),
    });
    await ctx.db.patch(args.conversationId, { lastMessageAt: Date.now() });
  },
});

export const recentMessages = internalQuery({
  args: { conversationId: v.id("niaConversations"), limit: v.number() },
  handler: async (ctx, args) => {
    const all = await ctx.db
      .query("niaMessages")
      .withIndex("by_conversation", (q) => q.eq("conversationId", args.conversationId))
      .collect();
    return all.slice(-args.limit);
  },
});

// ═════════════════════════════════════════════════════════════════════════════
// Rate limiting — bounded scan of recent messages in this conversation
// ═════════════════════════════════════════════════════════════════════════════

export const checkRate = internalQuery({
  args: { conversationId: v.id("niaConversations"), authenticated: v.boolean() },
  handler: async (ctx, args) => {
    const cutoff = Date.now() - 60_000;
    const recent = await ctx.db
      .query("niaMessages")
      .withIndex("by_conversation", (q) => q.eq("conversationId", args.conversationId))
      .collect();
    const inLastMin = recent.filter((m) => m.createdAt >= cutoff && m.senderType === "user").length;
    const limit = args.authenticated ? 12 : 6;
    return { withinLimit: inLastMin < limit };
  },
});

// ═════════════════════════════════════════════════════════════════════════════
// Authenticated-user context injection
// ═════════════════════════════════════════════════════════════════════════════

export const buildUserContext = internalQuery({
  args: { requesterUid: v.string(), currentPage: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_firebase_uid", (q) => q.eq("firebaseUid", args.requesterUid))
      .first();
    if (!user) return { isAuthenticated: false, currentPage: args.currentPage };

    const business = await ctx.db
      .query("businesses")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();
    const employees = business
      ? await ctx.db
          .query("employees")
          .withIndex("by_business", (q) => q.eq("businessId", business._id))
          .collect()
      : [];
    const runs = await ctx.db
      .query("payrollRuns")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    // Current-month usage snapshot for the prompt.
    const d = new Date();
    const period = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    const counter = await ctx.db
      .query("usageCounters")
      .withIndex("by_user_period", (q) => q.eq("userId", user._id).eq("period", period))
      .first();

    const plan = (user.plan ?? "free") as "free" | "pro" | "accountant";
    const isFree = plan === "free";
    return {
      isAuthenticated: true,
      displayName: user.displayName ?? user.email.split("@")[0],
      email: user.email,
      businessName: business?.name ?? undefined,
      plan,
      subscriptionStatus: user.planStatus ?? undefined,
      accountType: user.accountType,
      employeeCount: employees.length,
      payrollRunCount: runs.length,
      currentPage: args.currentPage,
      usage: {
        payslipsUsed: counter?.payslipsUsed ?? 0,
        payrollRunsUsed: counter?.payrollRunsUsed ?? 0,
        ocrScansUsed: counter?.ocrScansUsed ?? 0,
        limits: isFree
          ? { payslip: 10, payroll: 10, ocr: 3 }
          : { payslip: null, payroll: null, ocr: null },
      },
    };
  },
});

// ═════════════════════════════════════════════════════════════════════════════
// Support case creation + transcript email
// ═════════════════════════════════════════════════════════════════════════════

export const openSupportCase = internalMutation({
  args: {
    conversationId: v.id("niaConversations"),
    requesterUid: v.optional(v.string()),
    contactName: v.optional(v.string()),
    contactEmail: v.optional(v.string()),
    summary: v.optional(v.string()),
    currentPage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const conv = await ctx.db.get(args.conversationId);
    if (!conv) return { ok: false as const, error: "conversation_not_found" };

    let userId: Id<"users"> | undefined = conv.userId;
    let plan: string | undefined;
    let contactName = args.contactName ?? "";
    let contactEmail = args.contactEmail ?? "";

    if (args.requesterUid && !userId) {
      const user = await ctx.db
        .query("users")
        .withIndex("by_firebase_uid", (q) => q.eq("firebaseUid", args.requesterUid!))
        .first();
      if (user) userId = user._id;
    }
    if (userId) {
      const user = await ctx.db.get(userId);
      if (user) {
        contactName = contactName || user.displayName || user.email;
        contactEmail = contactEmail || user.email;
        plan = user.plan ?? "free";
      }
    }

    if (!contactEmail) {
      return { ok: false as const, error: "missing_contact_email" };
    }

    const now = Date.now();
    const caseId = await ctx.db.insert("supportCases", {
      conversationId: args.conversationId,
      userId,
      businessId: conv.businessId,
      contactName: contactName || "(unknown)",
      contactEmail,
      plan,
      currentPage: args.currentPage,
      summary: args.summary ?? "User requested help via Nia",
      status: "open",
      createdAt: now,
      updatedAt: now,
    });

    // Pause Nia so replies are silent while a human is expected.
    await ctx.db.patch(args.conversationId, { mode: "waiting_for_human", lastMessageAt: now });

    return { ok: true as const, caseId };
  },
});

export const markTranscriptStatus = internalMutation({
  args: { supportCaseId: v.id("supportCases"), status: v.string(), error: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.supportCaseId, {
      transcriptEmailStatus: args.status,
      transcriptEmailError: args.error,
      updatedAt: Date.now(),
    });
  },
});

export const emailTranscript = internalAction({
  args: { supportCaseId: v.id("supportCases") },
  handler: async (ctx, args) => {
    const sup: any = await ctx.runQuery(internal.niaInternal.getSupportCaseWithTranscript, {
      supportCaseId: args.supportCaseId,
    });
    if (!sup) return;
    const to = process.env.SHEETPAY_SUPPORT_EMAIL || "support@sheetpay.app";
    const transcriptLines = sup.messages
      .map((m: any) => `[${new Date(m.createdAt).toISOString()}] ${m.senderType.toUpperCase()}: ${m.content}`)
      .join("\n\n");

    const body = `New Sheetpay Support Request

User: ${sup.contactName}
Email: ${sup.contactEmail}
Plan: ${sup.plan ?? "unknown"}
Current page: ${sup.currentPage ?? "unknown"}

Summary: ${sup.summary}

—— Full Nia conversation ——
${transcriptLines || "(no messages)"}

Case id: ${args.supportCaseId}
Open in admin: https://sheetpay.app/admin/support`;

    try {
      // Uses the generic notification template (renderTemplate falls back
       // when the emailType has no registered template), rendering `message`
      // as the body. Kept intentionally minimal so we don't need a new
      // template file just for admin transcripts.
      await ctx.runAction(internal.emailService.sendEmailInternal, {
        to,
        emailType: "supportRequest",
        data: { message: body },
        userId: sup.userId ? String(sup.userId) : undefined,
        businessId: sup.businessId ? String(sup.businessId) : undefined,
      });
      await ctx.runMutation(internal.niaInternal.markTranscriptStatus, {
        supportCaseId: args.supportCaseId,
        status: "sent",
      });
    } catch (err: any) {
      await ctx.runMutation(internal.niaInternal.markTranscriptStatus, {
        supportCaseId: args.supportCaseId,
        status: "failed",
        error: String(err?.message ?? err),
      });
      throw err;
    }
  },
});

export const getSupportCaseWithTranscript = internalQuery({
  args: { supportCaseId: v.id("supportCases") },
  handler: async (ctx, args) => {
    const sup = await ctx.db.get(args.supportCaseId);
    if (!sup) return null;
    const messages = await ctx.db
      .query("niaMessages")
      .withIndex("by_conversation", (q) => q.eq("conversationId", sup.conversationId))
      .collect();
    return {
      ...sup,
      messages: messages.map((m) => ({
        senderType: m.senderType,
        content: m.content,
        createdAt: m.createdAt,
      })),
    };
  },
});

// ═════════════════════════════════════════════════════════════════════════════
// Public reads for the widget + admin inbox
// ═════════════════════════════════════════════════════════════════════════════

export const getConversationMessages = query({
  args: { conversationId: v.id("niaConversations") },
  handler: async (ctx, args) => {
    const conv = await ctx.db.get(args.conversationId);
    if (!conv) return null;
    const messages = await ctx.db
      .query("niaMessages")
      .withIndex("by_conversation", (q) => q.eq("conversationId", args.conversationId))
      .collect();
    return {
      mode: conv.mode,
      messages: messages.map((m) => ({
        id: m._id,
        senderType: m.senderType,
        content: m.content,
        createdAt: m.createdAt,
      })),
    };
  },
});

export const listSupportCasesForAdmin = query({
  args: { requesterUid: v.optional(v.string()) },
  handler: async (ctx, args) => {
    // Reuse admin auth from convex/admin.ts.
    if (!args.requesterUid) return { authorized: false as const };
    const requester = await ctx.db
      .query("users")
      .withIndex("by_firebase_uid", (q) => q.eq("firebaseUid", args.requesterUid))
      .first();
    if (!requester) return { authorized: false as const };
    const roleRow = await ctx.db
      .query("adminRoles")
      .withIndex("by_user", (q) => q.eq("userId", requester._id))
      .first();
    if (!roleRow && !isAdminEmail(requester.email)) return { authorized: false as const };

    const cases = await ctx.db
      .query("supportCases")
      .withIndex("by_created_at")
      .order("desc")
      .take(200);
    return {
      authorized: true as const,
      cases: cases.map((c) => ({
        id: c._id,
        contactName: c.contactName,
        contactEmail: c.contactEmail,
        plan: c.plan ?? null,
        currentPage: c.currentPage ?? null,
        summary: c.summary,
        status: c.status,
        transcriptEmailStatus: c.transcriptEmailStatus ?? null,
        createdAt: c.createdAt,
        conversationId: c.conversationId,
      })),
    };
  },
});
