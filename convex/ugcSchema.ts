import { defineTable } from "convex/server";
import { v } from "convex/values";
export const scene = v.object({key:v.string(),kind:v.union(v.literal("creator"),v.literal("product"),v.literal("title")),label:v.string(),duration:v.number(),text:v.string(),prompt:v.string(),assetId:v.optional(v.id("ugcMedia"))});
export const campaignFields = {
  title:v.string(),country:v.string(),persona:v.string(),painPoint:v.string(),format:v.string(),tone:v.string(),
  hook:v.string(),script:v.string(),captions:v.string(),cta:v.string(),socialCaption:v.string(),headline:v.string(),
  approvedClaims:v.string(),claimsApproved:v.boolean(),reviewApproved:v.boolean(),duration:v.number(),aspectRatio:v.string(),
  model:v.string(),resolution:v.string(),captionsEnabled:v.boolean(),creatorId:v.optional(v.id("ugcCreators")),scenes:v.array(scene),
};
export const ugcTables = {
  ugcCampaigns:defineTable({...campaignFields,ownerId:v.id("users"),revision:v.number(),status:v.string(),
    createdAt:v.number(),updatedAt:v.number(),videoStorageId:v.optional(v.id("_storage")),thumbnailStorageId:v.optional(v.id("_storage"))}).index("by_owner",["ownerId"]),
  ugcMedia:defineTable({ownerId:v.id("users"),label:v.string(),category:v.string(),storageId:v.id("_storage"),contentType:v.string(),size:v.number(),createdAt:v.number()}).index("by_storage",["storageId"]),
  ugcUploads:defineTable({ownerId:v.id("users"),contentType:v.string(),size:v.number(),sha256:v.string(),expiresAt:v.number(),used:v.boolean()}),
  ugcCreators:defineTable({ownerId:v.id("users"),label:v.string(),persona:v.string(),notes:v.string(),preferredModel:v.string(),referenceId:v.optional(v.id("ugcMedia")),rightsConfirmed:v.boolean(),createdAt:v.number(),updatedAt:v.number()}),
  ugcQuotes:defineTable({campaignId:v.id("ugcCampaigns"),ownerId:v.id("users"),revision:v.number(),amount:v.number(),
    items:v.array(v.object({sceneKey:v.string(),model:v.string(),duration:v.number(),amount:v.number(),payload:v.any()})),
    createdAt:v.number(),expiresAt:v.number(),consumed:v.boolean()}),
  ugcJobs:defineTable({campaignId:v.id("ugcCampaigns"),ownerId:v.id("users"),revision:v.number(),sceneKey:v.string(),model:v.string(),payload:v.any(),
    status:v.string(),estimatedCost:v.number(),actualCost:v.optional(v.number()),refunded:v.optional(v.boolean()),
    providerJobId:v.optional(v.string()),storageId:v.optional(v.id("_storage")),outputUrl:v.optional(v.string()),
    error:v.optional(v.string()),outcomeUnknown:v.boolean(),pollCount:v.number(),pollLeaseUntil:v.optional(v.number()),
    submittedAt:v.optional(v.number()),createdAt:v.number(),updatedAt:v.number()}).index("by_campaign",["campaignId"]).index("by_status",["status"]),
};
