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
    // Marks a preview/demo row. Hidden from the dashboard as soon as at least
    // one non-demo employee exists. Real employees never carry this flag.
    isDemo: v.optional(v.boolean()),
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
    action: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_user_id", ["userId"])
    .index("by_business_id", ["businessId"])
    .index("by_created_at", ["createdAt"]),

  // Paddle webhook idempotency + audit. One row per delivered event_id.
  // Existence of a row = event already processed; do not re-apply.
  paddleEvents: defineTable({
    eventId: v.string(),
    eventType: v.string(),
    status: v.string(), // 'processed' | 'ignored' | 'failed'
    paddleCustomerId: v.optional(v.string()),
    paddleSubscriptionId: v.optional(v.string()),
    paddleTransactionId: v.optional(v.string()),
    firebaseUid: v.optional(v.string()),
    plan: v.optional(v.string()),
    planStatus: v.optional(v.string()),
    rawEvent: v.string(), // JSON string of the event body
    errorMessage: v.optional(v.string()),
    receivedAt: v.number(),
  })
    .index("by_event_id", ["eventId"])
    .index("by_customer", ["paddleCustomerId"])
    .index("by_subscription", ["paddleSubscriptionId"])
    .index("by_received_at", ["receivedAt"]),

  // Admin RBAC. Presence in this table (with a role) grants access. The email
  // allowlist in convex/admin.ts is only used to seed the initial super_admin.
  adminRoles: defineTable({
    userId: v.id("users"),
    email: v.string(),
    role: v.union(
      v.literal("super_admin"),
      v.literal("admin"),
      v.literal("finance"),
      v.literal("support"),
      v.literal("analytics")
    ),
    grantedByUserId: v.optional(v.id("users")),
    grantedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_email", ["email"]),

  // Immutable admin action log. Never update or delete rows here.
  adminAuditLogs: defineTable({
    actorUserId: v.id("users"),
    actorEmail: v.string(),
    action: v.string(), // e.g. 'user.plan.override' | 'admin.role.grant'
    targetType: v.optional(v.string()),
    targetId: v.optional(v.string()),
    details: v.optional(v.string()), // JSON string
    createdAt: v.number(),
  })
    .index("by_actor", ["actorUserId"])
    .index("by_created_at", ["createdAt"]),

  // ── Reminders ──────────────────────────────────────────────────────────────
  // User-scheduled prompts (created via Cayla or the /payroll/reminders UI).
  // The cron finds due rows via the by_next_run_at index — never scans the
  // whole table.
  reminders: defineTable({
    userId: v.id("users"),
    businessId: v.optional(v.id("businesses")),
    // 'payroll' | 'attendance' | 'timesheet' | 'payslip' | 'tax_deadline' | 'custom'
    type: v.string(),
    title: v.string(),
    // Optional free-form instructions the user gave Cayla, used only for
    // logging/audit — the message the user receives comes from `messageTemplate`.
    instructions: v.optional(v.string()),
    messageTemplate: v.optional(v.string()),
    // 'once' | 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'before_payroll'
    frequency: v.string(),
    // 0=Sun … 6=Sat, for weekly/biweekly
    dayOfWeek: v.optional(v.number()),
    // 1–31, for monthly
    dayOfMonth: v.optional(v.number()),
    // 'HH:MM' in the user's timezone
    scheduledTime: v.string(),
    // IANA timezone id, e.g. 'America/Port_of_Spain'
    timezone: v.string(),
    // For 'before_payroll' — how many days before to send.
    daysBeforePayroll: v.optional(v.number()),
    // For 'once' — the exact UTC ms to fire.
    fireOnceAt: v.optional(v.number()),
    // Deep-link target relative path, e.g. '/payroll/current'
    deepLink: v.optional(v.string()),
    // Next UTC ms this reminder should fire. Cron reads this via
    // by_next_run_at (asc) with q.lte("nextRunAt", now).
    nextRunAt: v.number(),
    lastRunAt: v.optional(v.number()),
    enabled: v.boolean(),
    createdByUserId: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_business", ["businessId"])
    .index("by_next_run_at", ["nextRunAt"])
    .index("by_enabled_next_run", ["enabled", "nextRunAt"]),

  // One row per scheduled occurrence — the idempotency ledger. Before FCM
  // send we look up (reminderId, occurrenceId); if a row exists we skip.
  reminderOccurrences: defineTable({
    reminderId: v.id("reminders"),
    userId: v.id("users"),
    occurrenceId: v.string(), // e.g. `${reminderId}:${scheduledFor}`
    scheduledFor: v.number(),
    sentAt: v.optional(v.number()),
    // 'pending' | 'sent' | 'skipped' | 'failed' | 'suppressed'
    status: v.string(),
    fcmMessageIds: v.optional(v.array(v.string())),
    skippedReason: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
    attempts: v.number(),
    createdAt: v.number(),
  })
    .index("by_reminder", ["reminderId"])
    .index("by_occurrence", ["occurrenceId"])
    .index("by_user", ["userId"]),

  // Per-device FCM registration tokens.
  fcmDeviceTokens: defineTable({
    userId: v.id("users"),
    token: v.string(),
    platform: v.optional(v.string()), // 'web' | 'ios' | 'android'
    userAgent: v.optional(v.string()),
    // Set when the token is confirmed invalid by Firebase (unregistered, etc.)
    // Disabled tokens are not deleted immediately — kept for audit.
    disabledAt: v.optional(v.number()),
    disabledReason: v.optional(v.string()),
    lastSeenAt: v.number(),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_token", ["token"]),

  // ── Usage counters ─────────────────────────────────────────────────────────
  // One row per (userId, period) — period is 'YYYY-MM' so a new month is a
  // fresh row (no reset job needed). Counts increase only when the operation
  // actually succeeds; enforcement lives server-side in convex/usage.ts.
  usageCounters: defineTable({
    userId: v.id("users"),
    period: v.string(),
    payslipsUsed: v.number(),
    payrollRunsUsed: v.number(),
    ocrScansUsed: v.number(),
    caylaActionsUsed: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_period", ["userId", "period"]),

  // Idempotency ledger for usage increments — one row per operation id so a
  // retried mutation, duplicated webhook, or double-clicked button cannot
  // double-count. See convex/usage.ts::incrementUsage.
  usageIncrements: defineTable({
    userId: v.id("users"),
    period: v.string(),
    kind: v.string(), // 'payslip' | 'payroll' | 'ocr' | 'cayla'
    opId: v.string(),
    createdAt: v.number(),
  })
    .index("by_op", ["opId"])
    .index("by_user_kind_period", ["userId", "kind", "period"]),

  // ── Nia (support assistant) ────────────────────────────────────────────────
  // Conversation between a user (or anonymous visitor) and Nia. Persists so a
  // user can close and reopen the panel without losing context.
  niaConversations: defineTable({
    userId: v.optional(v.id("users")), // absent for anonymous landing-page chats
    anonSessionId: v.optional(v.string()), // for anonymous continuity
    businessId: v.optional(v.id("businesses")),
    // 'nia' = Nia is answering; 'waiting_for_human' = handoff requested, Nia
    // paused; 'human' = a support agent has picked up; 'closed' = archived.
    mode: v.string(),
    lastMessageAt: v.number(),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_anon", ["anonSessionId"])
    .index("by_mode", ["mode"]),

  niaMessages: defineTable({
    conversationId: v.id("niaConversations"),
    // 'user' | 'nia' | 'support'
    senderType: v.string(),
    senderUserId: v.optional(v.id("users")),
    content: v.string(),
    createdAt: v.number(),
  }).index("by_conversation", ["conversationId"]),

  // Support cases created when a user asks to talk to a human. Kept even if
  // the transcript email fails so admins can respond from the console.
  supportCases: defineTable({
    conversationId: v.id("niaConversations"),
    userId: v.optional(v.id("users")),
    businessId: v.optional(v.id("businesses")),
    // Snapshot at hand-off time so an admin can respond without re-querying:
    contactName: v.string(),
    contactEmail: v.string(),
    plan: v.optional(v.string()),
    currentPage: v.optional(v.string()),
    summary: v.string(),
    // 'open' | 'waiting' | 'in_progress' | 'resolved' | 'closed'
    status: v.string(),
    priority: v.optional(v.string()),
    assignedToUserId: v.optional(v.id("users")),
    transcriptEmailStatus: v.optional(v.string()), // 'sent' | 'failed'
    transcriptEmailError: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_status", ["status"])
    .index("by_created_at", ["createdAt"])
    .index("by_conversation", ["conversationId"]),

  // Aggregated daily analytics (populated by a scheduled job — see
  // convex/analyticsAggregation.ts). Read by the admin dashboard instead of
  // scanning the users/payrollRuns tables at request time.
  dailyMetrics: defineTable({
    date: v.string(), // 'YYYY-MM-DD'
    signups: v.number(),
    paidConversions: v.number(),
    churned: v.number(),
    activePayingUsers: v.number(),
    mrr: v.number(),
    payrollsProcessed: v.number(),
    payslipsGenerated: v.number(),
    caylaMessages: v.number(),
    caylaCostUsd: v.number(),
  }).index("by_date", ["date"]),

  // Guest accountant funnel — one row per anonymous visitor exploring the
  // /try-accountant-dashboard experience. Holds the client, employees, payroll
  // run, branding and Cayla state the guest built up BEFORE paying, so nothing
  // is lost when they authenticate and Paddle unlocks the full account.
  //
  // Limits (also enforced in convex/guestDashboard.ts, not just UI):
  //   guestClientsUsed      <= 1
  //   guestEmployeesUsed    <= 50
  //   guestPayrollRunsUsed  <= 1
  //
  // `converted` flips to true once the linked Paddle payment lands and the
  // data has been copied into the paying user's businesses/employees/payrollRuns.
  guestSessions: defineTable({
    anonSessionId: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
    expiresAt: v.number(),
    converted: v.optional(v.boolean()),
    convertedUserId: v.optional(v.id("users")),
    convertedAt: v.optional(v.number()),
    guestClientsUsed: v.number(),
    guestEmployeesUsed: v.number(),
    guestPayrollRunsUsed: v.number(),
    ocrScansUsed: v.number(),
    // Serialized JSON blobs so we don't have to duplicate the shape of every
    // domain type. Shape matches src/types.ts (AccountantClient, Employee,
    // PayrollRun, PayslipCustomization).
    client: v.optional(v.any()),
    employees: v.optional(v.array(v.any())),
    payrollRun: v.optional(v.any()),
    payslipCustomization: v.optional(v.any()),
    caylaMessages: v.optional(v.array(v.any())),
    // The last locked action the user attempted (download / print / whatsapp /
    // add_client_2 / run_payroll_2). Restored after checkout so the same
    // action resumes on the paid dashboard.
    pendingAction: v.optional(v.string()),
    utm: v.optional(v.any()),
  })
    .index("by_anon", ["anonSessionId"])
    .index("by_converted_user", ["convertedUserId"])
    .index("by_expires_at", ["expiresAt"]),
});
