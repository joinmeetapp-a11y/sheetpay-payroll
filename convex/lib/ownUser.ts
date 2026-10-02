/** Resolve identifiers from the verified Firebase session, never browser assertions. */
export async function requireOwnUser(ctx: any, suppliedId?: string) {
 const identity = await ctx.auth.getUserIdentity();
 if (!identity?.subject) throw new Error("Unauthenticated");
 const user = await ctx.db.query("users").withIndex("by_firebase_uid", (q: any) => q.eq("firebaseUid", identity.subject)).first();
 if (!user || (suppliedId && suppliedId !== identity.subject && suppliedId !== String(user._id))) throw new Error("Forbidden");
 return { identity, user };
}
