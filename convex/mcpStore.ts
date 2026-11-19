import { internalMutation } from "./functions";
import { v } from "convex/values";
import { anyApi } from "convex/server";
const api: any = anyApi;
const MODELS = [
  "AccessToken",
  "RefreshToken",
  "AuthorizationCode",
  "Grant",
  "Session",
  "Interaction",
  "Client",
  "RegistrationAccessToken",
  "ReplayDetection",
  "SheetpayConsent",
];
export const operate = internalMutation({
  args: {
    operation: v.string(),
    model: v.string(),
    key: v.optional(v.string()),
    payload: v.optional(v.string()),
    uid: v.optional(v.string()),
    grantId: v.optional(v.string()),
    userCode: v.optional(v.string()),
    expiresIn: v.optional(v.number()),
  },
  handler: async (ctx, a) => {
    if (a.operation === "connection") {
      const c = await ctx.db
        .query("mcpConnections")
        .withIndex("by_grant", (q) => q.eq("grantId", a.grantId!))
        .first();
      return c
        ? {
            id: c._id,
            sub: c.firebaseUid,
            clientId: c.clientId,
            scopes: c.scopes,
            revokedAt: c.revokedAt,
            expiresAt: c.expiresAt,
            organizationId: c.ownerId,
          }
        : null;
    }
    if (
      !MODELS.includes(a.model) ||
      ![
        "upsert",
        "find",
        "uid",
        "code",
        "destroy",
        "consume",
        "take",
        "revoke",
      ].includes(a.operation)
    )
      throw Error("INVALID_REQUEST");
    if (
      [a.key, a.uid, a.grantId, a.userCode].some((x) => x && x.length > 256) ||
      (a.payload && a.payload.length > 65536)
    )
      throw Error("INVALID_REQUEST");
    if (a.operation === "revoke") {
      const connection = await ctx.db
        .query("mcpConnections")
        .withIndex("by_grant", (q) => q.eq("grantId", a.grantId!))
        .first();
      if (connection && !connection.revokedAt)
        await ctx.db.patch(connection._id, { revokedAt: Date.now() });
      const rows = await ctx.db
        .query("mcpOAuthRecords")
        .withIndex("by_grant", (q) => q.eq("grantId", a.grantId))
        .take(500);
      for (const row of rows) await ctx.db.delete(row._id);
      if (rows.length === 500)
        await ctx.scheduler.runAfter(0, api.mcpStore.operate, a);
      return null;
    }
    const row =
      a.operation === "uid"
        ? await ctx.db
            .query("mcpOAuthRecords")
            .withIndex("by_uid", (q) => q.eq("model", a.model).eq("uid", a.uid))
            .first()
        : a.operation === "code"
          ? await ctx.db
              .query("mcpOAuthRecords")
              .withIndex("by_code", (q) =>
                q.eq("model", a.model).eq("userCode", a.userCode),
              )
              .first()
          : await ctx.db
              .query("mcpOAuthRecords")
              .withIndex("by_key", (q) =>
                q.eq("model", a.model).eq("key", a.key!),
              )
              .first();
    if (a.operation === "upsert") {
      if (
        !a.key ||
        !a.payload ||
        !Number.isSafeInteger(a.expiresIn) ||
        a.expiresIn! <= 0 ||
        a.expiresIn! > 2592000
      )
        throw Error("INVALID_REQUEST");
      const value = {
        model: a.model,
        key: a.key,
        payload: a.payload,
        uid: a.uid,
        grantId: a.grantId,
        userCode: a.userCode,
        expiresAt: Date.now() + a.expiresIn! * 1000,
      };
      const id = row ? row._id : await ctx.db.insert("mcpOAuthRecords", value);
      if (row) await ctx.db.replace(id, value);
      await ctx.scheduler.runAt(value.expiresAt, api.mcpStore.expire, {
        id,
        expiresAt: value.expiresAt,
      });
      return null;
    }
    if (a.operation === "destroy") {
      if (a.model === "Grant") {
        const c = await ctx.db
          .query("mcpConnections")
          .withIndex("by_grant", (q) => q.eq("grantId", a.key!))
          .first();
        if (c && !c.revokedAt)
          await ctx.db.patch(c._id, { revokedAt: Date.now() });
      }
      if (row) await ctx.db.delete(row._id);
      return null;
    }
    if (!row || row.expiresAt <= Date.now()) return null;
    if (a.operation === "consume" || a.operation === "take") {
      if (row.consumedAt) {
        if (a.operation === "consume") throw Error("ALREADY_CONSUMED");
        return null;
      }
      await ctx.db.patch(row._id, { consumedAt: Date.now() });
    }
    return {
      payload: row.payload,
      consumed: row.consumedAt ? Math.floor(row.consumedAt / 1000) : undefined,
    };
  },
});

export const expire = internalMutation({
  args: { id: v.id("mcpOAuthRecords"), expiresAt: v.number() },
  handler: async (ctx, a) => {
    const r = await ctx.db.get(a.id);
    if (r && r.expiresAt === a.expiresAt && r.expiresAt <= Date.now())
      await ctx.db.delete(r._id);
  },
});
