import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";

export const getByFirebaseUid = query({
  args: { firebaseUid: v.string() },
  handler: async (ctx, args) => {
    return ctx.db
      .query("users")
      .withIndex("by_firebase_uid", (q) => q.eq("firebaseUid", args.firebaseUid))
      .first();
  },
});

export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    return ctx.db
      .query("users")
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
    const existing = await ctx.db
      .query("users")
      .withIndex("by_firebase_uid", (q) => q.eq("firebaseUid", args.firebaseUid))
      .first();

    if (existing) {
      // Refresh Firebase-sourced identity fields on every call. Do NOT
      // overwrite accountType — that's set at signup and switched via a
      // dedicated flow. This lets us safely call createOrUpdate on every
      // page load / auth state change without clobbering user data.
      const patch: Record<string, unknown> = { email: args.email };
      if (args.displayName && args.displayName !== existing.displayName) {
        patch.displayName = args.displayName;
      }
      await ctx.db.patch(existing._id, patch);
      return existing._id;
    }

    const id = await ctx.db.insert("users", {
      firebaseUid: args.firebaseUid,
      email: args.email,
      displayName: args.displayName,
      accountType: args.accountType,
      createdAt: Date.now(),
    });

    // First-time signup — fire the welcome email through the shared service.
    // Idempotency key ties it to the userId so re-running createOrUpdate for
    // any reason never sends a second welcome.
    await ctx.scheduler.runAfter(0, api.emails.send as any, {
      to: args.email,
      emailType: "welcome",
      data: { displayName: args.displayName },
      userId: String(id),
      idempotencyKey: `welcome:${id}`,
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
    const user = await ctx.db
      .query("users")
      .withIndex("by_firebase_uid", (q) => q.eq("firebaseUid", args.firebaseUid))
      .first();
    if (!user) return;
    await ctx.db.patch(user._id, { accountType: args.accountType });
  },
});

export const setOnboardingCompleted = mutation({
  args: { firebaseUid: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_firebase_uid", (q) => q.eq("firebaseUid", args.firebaseUid))
      .first();
    if (!user) return;
    await ctx.db.patch(user._id, { onboardingCompleted: true });
  },
});
