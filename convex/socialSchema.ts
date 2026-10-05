import { defineTable } from "convex/server";
import { v } from "convex/values";

export const socialStatus = v.union(...[
  "draft", "generating", "awaiting_approval", "approved", "scheduled",
  "publishing", "published", "failed", "skipped",
].map(s => v.literal(s)));
export const socialTables = {
  socialSettings: defineTable({
    key: v.string(), ownerId: v.id("users"), postingEnabled: v.boolean(), testMode: v.boolean(),
    mode: v.union(v.literal("approval"), v.literal("automatic")), postingTime: v.string(),
    timezone: v.string(), postingDays: v.array(v.number()), generationLeadMinutes: v.number(),
    portraitId: v.optional(v.id("_storage")), lastTopicId: v.optional(v.id("socialTopics")),
    updatedAt: v.number(),
  }).index("by_key", ["key"]),
  socialTopics: defineTable({ name: v.string(), enabled: v.boolean(), lastUsedAt: v.optional(v.number()),
    useCount: v.number(), createdAt: v.number() }).index("by_name", ["name"]),
  socialPosts: defineTable({
    dayKey: v.string(), ownerId: v.id("users"), createdAt: v.number(), updatedAt: v.number(),
    scheduledFor: v.number(), publishedAt: v.optional(v.number()), status: socialStatus,
    topicId: v.id("socialTopics"), topic: v.string(), storyIdea: v.optional(v.string()),
    hook: v.optional(v.string()), caption: v.optional(v.string()), imageText: v.optional(v.string()),
    lesson: v.optional(v.string()), storyAngle: v.optional(v.string()), phrases: v.optional(v.array(v.string())),
    hashtags: v.optional(v.array(v.string())), sheetpayMentioned: v.optional(v.boolean()),
    sheetpayUrlIncluded: v.optional(v.boolean()), embedding: v.optional(v.array(v.number())),
    imageStorageId: v.optional(v.id("_storage")), imageRevision: v.optional(v.number()), imagePortraitId: v.optional(v.id("_storage")),
    revision: v.number(), generationAttempts: v.number(), openAIModel: v.optional(v.string()),
    approvalRequired: v.boolean(), approvedAt: v.optional(v.number()), approvedBy: v.optional(v.id("users")),
    error: v.optional(v.string()), errorPhase: v.optional(v.string()), leaseUntil: v.optional(v.number()),
    operationId: v.optional(v.string()), linkedinImageUrn: v.optional(v.string()),
    linkedinPostId: v.optional(v.string()), linkedinPostUrl: v.optional(v.string()),
    publishAttemptId: v.optional(v.string()), publishRequestStartedAt: v.optional(v.number()),
    outcomeUnknown: v.optional(v.boolean()), testCompletedAt: v.optional(v.number()),
    linkedinResponse: v.optional(v.object({status: v.number(), requestId: v.optional(v.string())})),
  }).index("by_day", ["dayKey"]).index("by_status_schedule", ["status", "scheduledFor"]),
  linkedinConnections: defineTable({
    ownerId: v.id("users"), memberUrn: v.string(), name: v.string(), encryptedAccessToken: v.string(),
    encryptedRefreshToken: v.optional(v.string()), expiresAt: v.number(), refreshExpiresAt: v.optional(v.number()),
    scopes: v.array(v.string()), connectedAt: v.number(), verifiedAt: v.number(),
    lastSuccessfulPostAt: v.optional(v.number()), status: v.string(),
  }).index("by_owner", ["ownerId"]),
  socialOAuthStates: defineTable({ ownerId: v.id("users"), hash: v.string(), expiresAt: v.number(),
    consumedAt: v.optional(v.number()) }).index("by_hash", ["hash"]).index("by_expiry", ["expiresAt"]),
  socialGenerationLogs: defineTable({ postId: v.optional(v.id("socialPosts")), event: v.string(),
    phase: v.string(), message: v.optional(v.string()), createdAt: v.number() }),
  socialUploads: defineTable({ ownerId: v.id("users"), storageId: v.optional(v.id("_storage")),
    expiresAt: v.number() }).index("by_owner", ["ownerId"]),
};
