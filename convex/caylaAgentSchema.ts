import { defineTable } from "convex/server";
import { v } from "convex/values";

export const contextValidator = v.object({
  view: v.string(), payrollRunId: v.optional(v.id("payrollRuns")), employeeId: v.optional(v.id("employees")),
});
export const adjustmentValidator = v.object({ employeeId: v.id("employees"), field: v.union(v.literal("regularHours"), v.literal("overtimeHours"), v.literal("bonus"), v.literal("allowances"), v.literal("otherDeductions")), value: v.number() });
export const intentValidator = v.object({
  action: v.union(...["upcoming", "exceptions", "prepare", "payslips", "emails", "reminder", "reminders", "history", "report", "tax", "exports", "help"].map(x => v.literal(x))),
  scope: v.union(v.literal("current"), v.literal("all"), v.literal("due")),
  clientIds: v.array(v.id("businesses")),
  excludedEmployeeIds: v.optional(v.array(v.id("employees"))), adjustments: v.optional(v.array(adjustmentValidator)), acknowledgedEmployeeIds: v.optional(v.array(v.id("employees"))),
  overtimeThreshold: v.optional(v.number()), reminderDate: v.optional(v.string()), reminderTime: v.optional(v.string()),
  dueFrom: v.optional(v.string()), dueTo: v.optional(v.string()),
  periodStart: v.optional(v.string()), periodEnd: v.optional(v.string()), payDate: v.optional(v.string()),
  exceptionFilter: v.optional(v.literal("missing_hours")), target: v.optional(v.union(v.literal("client"), v.literal("employee"), v.literal("run"))), daysBefore: v.optional(v.number()), clarification: v.optional(v.string()),
});
export const preferenceValidator = v.object({
  voicePlayback: v.optional(v.boolean()), voiceEnabled: v.boolean(), autoTranscription: v.boolean(), showExecutionPlan: v.boolean(),
  requirePayslipApproval: v.boolean(), requireEmailApproval: v.boolean(), notifications: v.boolean(),
});
export const caylaAgentTables = {
  caylaSessions: defineTable({ actorId: v.id("users"), workspaceOwnerId: v.id("users"), activeCommandId: v.id("caylaCommands"), updatedAt: v.number() }).index("by_actor_workspace", ["actorId", "workspaceOwnerId"]),
  caylaCommands: defineTable({
    actorId: v.id("users"), workspaceOwnerId: v.id("users"), contextBusinessId: v.id("businesses"),
    context: v.optional(contextValidator), requestKey: v.string(), timezone: v.string(), source: v.union(v.literal("text"), v.literal("voice")), command: v.string(),
    replyExpiresAt:v.optional(v.number()),voiceExpiresAt:v.optional(v.number()),reply: v.optional(v.string()), voiceKey:v.optional(v.string()), voiceLeaseUntil:v.optional(v.number()), voiceStorageId:v.optional(v.id("_storage")),
    intent: v.optional(intentValidator), clientIds: v.array(v.id("businesses")),
    status: v.string(), approvalStatus: v.string(), summary: v.string(),
    steps: v.array(v.object({ label: v.string(), status: v.string(), count: v.optional(v.number()) })),
    leaseToken: v.optional(v.string()), leaseUntil: v.optional(v.number()),
    createdAt: v.number(), updatedAt: v.number(), expiresAt: v.number(),
  }).index("by_actor_workspace", ["actorId", "workspaceOwnerId"])
    .index("by_request", ["actorId", "requestKey"]).index("by_expiry", ["expiresAt"]).index("by_voice_expiry", ["voiceExpiresAt"]).index("by_reply_expiry", ["replyExpiresAt"]),
  caylaPreparedClients: defineTable({
    commandId: v.id("caylaCommands"), businessId: v.id("businesses"), name: v.string(), currency: v.string(),
    sourceFingerprint: v.string(), periodStart: v.string(), periodEnd: v.string(), payDate: v.string(),
    employeeIds: v.array(v.id("employees")), processed: v.number(), earningsCalculated: v.optional(v.number()), statutoryCalculated: v.optional(v.number()), ready: v.number(), review: v.number(), blocking: v.number(),
    totalGross: v.number(), totalDeductions: v.number(), totalNet: v.number(),
    status: v.string(), runId: v.optional(v.id("payrollRuns")), reminderId: v.optional(v.id("reminders")),
    approvedAt: v.optional(v.number()), expiresAt: v.number(),
  }).index("by_command", ["commandId"]).index("by_expiry", ["expiresAt"]),
  caylaPreparedEmployees: defineTable({
    commandId: v.id("caylaCommands"), businessId: v.id("businesses"), employeeId: v.id("employees"),
    // Payroll data exists only in the protected preparation record, never command history or events.
    snapshot: v.optional(v.any()),
    exceptions: v.array(v.object({ code: v.string(), severity: v.union(v.literal("INFO"), v.literal("REVIEW"), v.literal("BLOCKING")), message: v.string() })),
    status: v.string(), expiresAt: v.number(),
  }).index("by_command_business", ["commandId", "businessId"]).index("by_expiry", ["expiresAt"]),
  caylaPreferences: defineTable({ actorId: v.id("users"), workspaceOwnerId: v.id("users"), settings: preferenceValidator, updatedAt: v.number() })
    .index("by_actor_workspace", ["actorId", "workspaceOwnerId"]),
  caylaEvents: defineTable({
    actorId: v.id("users"), workspaceOwnerId: v.id("users"), commandId: v.optional(v.id("caylaCommands")),
    name: v.string(), count: v.optional(v.number()), createdAt: v.number(),
  }).index("by_workspace", ["workspaceOwnerId"]),
};
