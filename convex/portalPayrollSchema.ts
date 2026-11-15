import { defineTable } from "convex/server";
import { v } from "convex/values";
export const portalPayrollTables = {
  portalPayrollConnections: defineTable({
    businessId: v.id("businesses"),
    ownerId: v.id("users"),
    portalOrganizationId: v.string(),
    tokenHash: v.string(),
    createdAt: v.number(),
    expiresAt: v.number(),
    revokedAt: v.optional(v.number()),
    windowStart: v.number(),
    requests: v.number(),
  })
    .index("by_hash", ["tokenHash"])
    .index("by_owner", ["ownerId"])
    .index("by_business", ["businessId"]),
  portalPayrollDrafts: defineTable({
    connectionId: v.id("portalPayrollConnections"),
    key: v.string(),
    requestHash: v.string(),
    period: v.object({
      start: v.string(),
      end: v.string(),
      payDate: v.string(),
    }),
    employeeIds: v.array(v.id("employees")),
    rows: v.array(v.any()),
    issues: v.array(v.any()),
    reviewHash: v.string(),
    rosterHash: v.string(),
    totals: v.any(),
    status: v.union(v.literal("prepared"), v.literal("approved")),
    runId: v.optional(v.id("payrollRuns")),
    createdAt: v.number(),
    expiresAt: v.number(),
    cleanupId: v.optional(v.id("_scheduled_functions")),
  })
    .index("by_connection_key", ["connectionId", "key"])
    .index("by_connection_created", ["connectionId", "createdAt"])
    .index("by_expiry", ["expiresAt"]),
};
