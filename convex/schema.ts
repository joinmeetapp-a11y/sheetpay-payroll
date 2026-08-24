import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    firebaseUid: v.string(),
    email: v.string(),
    displayName: v.optional(v.string()),
    accountType: v.union(v.literal("business"), v.literal("accountant")),
    createdAt: v.number(),
    // ─── Billing / entitlement (Paddle) ──────────────────────────────────────
    plan: v.optional(
      v.union(v.literal("free"), v.literal("pro"), v.literal("accountant"))
    ),
    planStatus: v.optional(v.string()), // 'active' | 'pending' | 'canceled' | 'past_due'
    paddleCustomerId: v.optional(v.string()),
    paddleSubscriptionId: v.optional(v.string()),
    paddleTransactionId: v.optional(v.string()),
    planUpdatedAt: v.optional(v.number()),
  })
    .index("by_firebase_uid", ["firebaseUid"])
    .index("by_paddle_customer", ["paddleCustomerId"]),

  businesses: defineTable({
    userId: v.id("users"),
    name: v.string(),
    address: v.optional(v.string()),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    taxRegistrationId: v.optional(v.string()),
    nisNumber: v.optional(v.string()),
    signatoryName: v.optional(v.string()),
    signatoryTitle: v.optional(v.string()),
    currency: v.string(),
    currencySymbol: v.string(),
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),

  employees: defineTable({
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
    createdAt: v.number(),
  })
    .index("by_business", ["businessId"])
    .index("by_user", ["userId"]),

  payrollRuns: defineTable({
    businessId: v.id("businesses"),
    userId: v.id("users"),
    month: v.string(),
    year: v.number(),
    status: v.string(),
    periodLabel: v.optional(v.string()),
    employeesSnapshot: v.array(v.any()),
    totalGross: v.number(),
    totalPaye: v.number(),
    totalNis: v.number(),
    totalHealthSurcharge: v.number(),
    totalDeductions: v.number(),
    totalNet: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_business", ["businessId"])
    .index("by_user", ["userId"]),

  messages: defineTable({
    userId: v.id("users"),
    businessId: v.optional(v.id("businesses")),
    sender: v.union(v.literal("user"), v.literal("cayla")),
    text: v.string(),
    timestamp: v.string(),
    createdAt: v.number(),
  }).index("by_user", ["userId"]),

  // Email delivery log — one row per send attempt + webhook-driven status updates
  emailLogs: defineTable({
    recipient: v.string(),
    emailType: v.string(),
    subject: v.string(),
    // Lifecycle: queued | sending | sent | delivered | bounced | complained | failed | skipped
    status: v.string(),
    resendMessageId: v.optional(v.string()),
    userId: v.optional(v.string()),
    businessId: v.optional(v.string()),
    clientId: v.optional(v.string()),
    relatedEntityId: v.optional(v.string()),
    idempotencyKey: v.optional(v.string()),
    category: v.optional(v.string()),
    attempts: v.optional(v.number()),
    sentAt: v.optional(v.number()),
    deliveredAt: v.optional(v.number()),
    failedReason: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_email_type", ["emailType"])
    .index("by_recipient", ["recipient"])
    .index("by_user", ["userId"])
    .index("by_business", ["businessId"])
    .index("by_resend_message", ["resendMessageId"])
    .index("by_idempotency", ["idempotencyKey"]),

  // Team invitations — secure token-based flow
  invitations: defineTable({
    organizationId: v.string(), // businessId of the workspace being joined
    invitedByUserId: v.string(),
    inviterName: v.string(),
    inviteeEmail: v.string(),
    role: v.string(),
    invitationToken: v.string(),
    // pending | accepted | revoked | expired
    status: v.string(),
    resentCount: v.optional(v.number()),
    lastResentAt: v.optional(v.number()),
    acceptedByUserId: v.optional(v.string()),
    acceptedAt: v.optional(v.number()),
    revokedAt: v.optional(v.number()),
    createdAt: v.number(),
    expiresAt: v.number(),
  })
    .index("by_token", ["invitationToken"])
    .index("by_org", ["organizationId"])
    .index("by_invitee_email", ["inviteeEmail"])
    .index("by_status", ["status"]),

  // Per-user notification category preferences.
  // Security + critical billing emails ignore these toggles.
  notificationPreferences: defineTable({
    userId: v.string(),
    payroll: v.optional(v.boolean()),
    payslip: v.optional(v.boolean()),
    team: v.optional(v.boolean()),
    import: v.optional(v.boolean()),
    billing: v.optional(v.boolean()),
    security: v.optional(v.boolean()),
    product: v.optional(v.boolean()),
    account: v.optional(v.boolean()),
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),

  // Suppression list — addresses that bounced or complained. Prevents repeated
  // sends to bad addresses.
  emailSuppressions: defineTable({
    emailAddress: v.string(),
    reason: v.string(), // 'bounce' | 'complaint'
    createdAt: v.number(),
  }).index("by_email", ["emailAddress"]),

  // Cayla conversation history per user/workspace
  caylaConversations: defineTable({
    userId: v.string(),
    businessId: v.optional(v.string()),
    messages: v.array(
      v.object({
        role: v.string(),
        content: v.string(),
        toolCallId: v.optional(v.string()),
        toolName: v.optional(v.string()),
        timestamp: v.number(),
      })
    ),
    totalTokensUsed: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user_id", ["userId"])
    .index("by_firm_id", ["businessId"]),

  // OpenAI usage and cost tracking
  caylaUsageLogs: defineTable({
    userId: v.string(),
    businessId: v.optional(v.string()),
    model: v.string(),
    inputTokens: v.number(),
    outputTokens: v.number(),
    estimatedCostUsd: v.number(),
    userMessage: v.string(),
    toolsCalled: v.optional(v.array(v.string())),
    createdAt: v.number(),
  })
    .index("by_user_id", ["userId"]),
});
