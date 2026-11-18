import { defineTable } from "convex/server";
import { v } from "convex/values";
export const service = v.object({
  id: v.string(),
  name: v.string(),
  description: v.string(),
  duration: v.number(),
  price: v.string(),
});
export const availability = v.object({
  day: v.number(),
  start: v.number(),
  end: v.number(),
});
export const practiceTables = {
  practiceProfiles: defineTable({
    ownerId: v.id("users"),
    slug: v.string(),
    name: v.string(),
    headline: v.string(),
    description: v.string(),
    color: v.string(),
    logo: v.string(),
    cover: v.string(),
    services: v.array(service),
    timezone: v.string(),
    availability: v.array(availability),
    published: v.boolean(),
    widgetGreeting: v.string(),
    widgetPosition: v.string(),
    widgetVoice: v.boolean(),
    allowedOrigins: v.array(v.string()),
    updatedAt: v.number(),
  })
    .index("by_owner", ["ownerId"])
    .index("by_slug", ["slug"]),
  practiceLeads: defineTable({
    ownerId: v.id("users"),
    name: v.string(),
    email: v.string(),
    phone: v.string(),
    serviceId: v.string(),
    source: v.string(),
    stage: v.string(),
    notes: v.string(),
    businessId: v.optional(v.id("businesses")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_owner", ["ownerId"])
    .index("by_owner_stage", ["ownerId", "stage"])
    .index("by_owner_email", ["ownerId", "email"]),
  practiceAppointments: defineTable({
    ownerId: v.id("users"),
    leadId: v.id("practiceLeads"),
    serviceId: v.string(),
    serviceName: v.string(),
    startsAt: v.number(),
    endsAt: v.number(),
    status: v.string(),
    name: v.string(),
    email: v.string(),
    notes: v.string(),
    createdAt: v.number(),
    reminderJob: v.optional(v.id("_scheduled_functions")),
  }).index("by_owner_start", ["ownerId", "startsAt"]),
  practiceFollowups: defineTable({
    ownerId: v.id("users"),
    leadId: v.id("practiceLeads"),
    title: v.string(),
    dueAt: v.number(),
    status: v.string(),
    createdAt: v.number(),
    jobId: v.optional(v.id("_scheduled_functions")),
  })
    .index("by_owner_status_due", ["ownerId", "status", "dueAt"])
    .index("by_lead", ["leadId"]),
  practiceInvites: defineTable({
    ownerId: v.id("users"),
    businessId: v.id("businesses"),
    email: v.string(),
    tokenHash: v.string(),
    expiresAt: v.number(),
    acceptedAt: v.optional(v.number()),
    revokedAt: v.optional(v.number()),
  })
    .index("by_token", ["tokenHash"])
    .index("by_business", ["businessId"])
    .index("by_business_email", ["businessId", "email"]),
  practiceMembers: defineTable({
    ownerId: v.id("users"),
    businessId: v.id("businesses"),
    email: v.string(),
    firebaseUid: v.string(),
    active: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_uid_business", ["firebaseUid", "businessId"])
    .index("by_uid", ["firebaseUid"])
    .index("by_business", ["businessId"]),
  practiceMessages: defineTable({
    ownerId: v.id("users"),
    businessId: v.id("businesses"),
    senderUid: v.string(),
    senderName: v.string(),
    senderRole: v.string(),
    text: v.string(),
    createdAt: v.number(),
  }).index("by_business", ["businessId"]),
  practiceRequests: defineTable({
    ownerId: v.id("users"),
    businessId: v.id("businesses"),
    title: v.string(),
    details: v.string(),
    dueAt: v.number(),
    status: v.string(),
    createdAt: v.number(),
    reminderJob: v.optional(v.id("_scheduled_functions")),
  })
    .index("by_business", ["businessId"])
    .index("by_owner_status_due", ["ownerId", "status", "dueAt"]),
  practiceUploads: defineTable({
    businessId: v.optional(v.id("businesses")),
    ownerId: v.id("users"),
    uid: v.string(),
    purpose: v.string(),
    contentType: v.string(),
    storageId: v.optional(v.id("_storage")),
    createdAt: v.number(),
    expiresAt: v.number(),
    consumed: v.boolean(),
    cleanupJob: v.optional(v.id("_scheduled_functions")),
  }).index("by_storage", ["storageId"]),
  practiceDocuments: defineTable({
    ownerId: v.id("users"),
    businessId: v.id("businesses"),
    requestId: v.optional(v.id("practiceRequests")),
    storageId: v.id("_storage"),
    name: v.string(),
    contentType: v.string(),
    size: v.number(),
    uploaderUid: v.string(),
    createdAt: v.number(),
  })
    .index("by_business", ["businessId"])
    .index("by_request", ["requestId"]),
  practiceReminders: defineTable({
    ownerId: v.id("users"),
    businessId: v.optional(v.id("businesses")),
    title: v.string(),
    details: v.string(),
    createdAt: v.number(),
    read: v.boolean(),
  })
    .index("by_owner", ["ownerId"])
    .index("by_business", ["businessId"]),
  practiceDrafts: defineTable({
    ownerId: v.id("users"),
    actorId: v.id("users"),
    businessId: v.optional(v.id("businesses")),
    kind: v.string(),
    payload: v.any(),
    status: v.string(),
    createdAt: v.number(),
    result: v.optional(v.string()),
  }).index("by_actor", ["actorId"]),
  practiceThrottle: defineTable({
    key: v.string(),
    window: v.number(),
    count: v.number(),
  }).index("by_key", ["key"]),
};
