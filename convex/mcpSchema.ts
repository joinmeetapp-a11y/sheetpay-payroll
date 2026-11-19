import { defineTable } from "convex/server";
import { v } from "convex/values";
export const mcpTables = {
  mcpConnections: defineTable({
    actorId: v.id("users"),
    ownerId: v.id("users"),
    firebaseUid: v.string(),
    clientId: v.string(),
    clientName: v.string(),
    grantId: v.string(),
    scopes: v.array(v.string()),
    createdAt: v.number(),
    expiresAt: v.optional(v.number()),
    lastUsedAt: v.optional(v.number()),
    revokedAt: v.optional(v.number()),
  })
    .index("by_actor", ["actorId"])
    .index("by_grant", ["grantId"]),
  mcpOAuthRecords: defineTable({
    model: v.string(),
    key: v.string(),
    payload: v.string(),
    uid: v.optional(v.string()),
    grantId: v.optional(v.string()),
    userCode: v.optional(v.string()),
    expiresAt: v.number(),
    consumedAt: v.optional(v.number()),
  })
    .index("by_key", ["model", "key"])
    .index("by_uid", ["model", "uid"])
    .index("by_code", ["model", "userCode"])
    .index("by_grant", ["grantId"])
    .index("by_expiry", ["expiresAt"]),
  mcpJobs: defineTable({
    connectionId: v.id("mcpConnections"),
    actorId: v.id("users"),
    ownerId: v.id("users"),
    businessId: v.id("businesses"),
    key: v.string(),
    input: v.string(),
    kind: v.string(),
    sourceRevision: v.number(),
    commandId: v.id("caylaCommands"),
    status: v.string(),
    token: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
    error: v.optional(v.string()),
  })
    .index("by_key", ["connectionId", "key"])
    .index("by_command", ["commandId"]),
  mcpRateWindows: defineTable({
    actorId: v.id("users"),
    ownerId: v.id("users"),
    window: v.number(),
    count: v.number(),
  }).index("by_actor_owner", ["actorId", "ownerId"]),
};
