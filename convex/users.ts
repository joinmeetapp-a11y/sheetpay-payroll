import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

function requireOwnIdentity(identity: { subject: string } | null, firebaseUid: string) {
  if (!identity || identity.subject !== firebaseUid) throw new Error("Unauthenticated");
}

export const getByFirebaseUid = query({
  args: { firebaseUid: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    requireOwnIdentity(identity, args.firebaseUid);
    return ctx.db.query("users")
      .withIndex("by_firebase_uid", (q) => q.eq("firebaseUid", args.firebaseUid))
      .first();
  },
});

export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    return ctx.db.query("users")
      .withIndex("by_firebase_uid", (q) => q.eq("firebaseUid", identity.subject))
      .first();
  },
});

export const createOrUpdate = mutation({
  args: {
    firebaseUid: v.string(),
    email: v.string(),
    displayName: v.optional(v.string()),
    accountType: v.union(v.literal("business"), v.literal("accountant")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    requireOwnIdentity(identity, args.firebaseUid);
    const tokenEmail = typeof identity.email === "string" ? identity.email.trim().toLowerCase() : "";
    if (!tokenEmail || tokenEmail !== args.email.trim().toLowerCase()) {
      throw new Error("Authenticated email does not match the Firebase identity");
    }

    const existing = await ctx.db.query("users")
      .withIndex("by_firebase_uid", (q) => q.eq("firebaseUid", identity.subject))
      .first();

    if (existing) {
      const patch: Record<string, unknown> = {};
      if (existing.email !== tokenEmail) patch.email = tokenEmail;
      if (args.displayName && args.displayName !== existing.displayName) patch.displayName = args.displayName;
      if (Object.keys(patch).length) await ctx.db.patch(existing._id, patch);
      return existing._id;
    }

    const id = await ctx.db.insert("users", {
      firebaseUid: identity.subject,
      email: tokenEmail,
      displayName: args.displayName,
      accountType: args.accountType,
      createdAt: Date.now(),
    });

    await ctx.scheduler.runAfter(0, internal.emails.sendWelcomeInternal, {
      to: tokenEmail,
      displayName: args.displayName,
      userId: String(id),
    });
    return id;
  },
});

export const updateAccountType = mutation({
  args: {
    firebaseUid: v.string(),
    accountType: v.union(v.literal("business"), v.literal("accountant")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    requireOwnIdentity(identity, args.firebaseUid);
    const user = await ctx.db.query("users")
      .withIndex("by_firebase_uid", (q) => q.eq("firebaseUid", identity.subject))
      .first();
    if (!user) return;
    if (user.accountType !== args.accountType) {
      throw new Error("Account type is set at signup and cannot be changed here");
    }
  },
});

export const setOnboardingCompleted = mutation({
  args: { firebaseUid: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    requireOwnIdentity(identity, args.firebaseUid);
    const user = await ctx.db.query("users")
      .withIndex("by_firebase_uid", (q) => q.eq("firebaseUid", identity.subject))
      .first();
    if (user) await ctx.db.patch(user._id, { onboardingCompleted: true });
  },
});
