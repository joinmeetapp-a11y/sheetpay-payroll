/// <reference types="vite/client" />
import { describe, expect, it } from "vitest";
import { convexTest } from "convex-test";
import { anyApi } from "convex/server";
import schema from "../convex/schema";
const modules = import.meta.glob("../convex/**/*.{ts,js}");
const api = anyApi;
async function fixture() {
  const t = convexTest(schema, modules);
  await t.run(async (ctx) => {
    await ctx.db.insert("users", { firebaseUid: "admin", email: "surebookme@gmail.com", accountType: "accountant", emailVerified: true });
    await ctx.db.insert("users", { firebaseUid: "alice", email: "alice@example.com", accountType: "accountant", plan: "free" });
    await ctx.db.insert("users", { firebaseUid: "bob", email: "bob@example.com", accountType: "accountant", plan: "accountant_monthly" });
  });
  return { t, admin: t.withIdentity({ subject: "admin", email: "surebookme@gmail.com", emailVerified: true }), alice: t.withIdentity({ subject: "alice" }), bob: t.withIdentity({ subject: "bob" }) };
}
const update = { title: "Upcoming update", message: "New improvements next week.", actionUrl: "/accountant" };
describe("Accountant announcements", () => {
  it("bootstraps only the new verified admin email and normalizes its casing", async () => {
    const t = convexTest(schema, modules);
    const admin = t.withIdentity({ subject: "new-admin", email: "Surebookme@gmail.com", emailVerified: true });
    const id = await admin.mutation(api.admin.bootstrapAdmin, {});
    expect((await t.run((ctx) => ctx.db.query("users").withIndex("by_firebase_uid", (q) => q.eq("firebaseUid", "new-admin")).first()))!.email).toBe("surebookme@gmail.com");
    await admin.mutation(api.announcements.publish, update);
    await expect(t.withIdentity({ subject: "old-admin", email: "antoniokpreudhomme@gmail.com", emailVerified: true }).mutation(api.admin.bootstrapAdmin, {})).rejects.toThrow("Forbidden");
    await expect(t.withIdentity({ subject: "new-admin", email: "surebookme@gmail.com", emailVerified: false }).mutation(api.admin.bootstrapAdmin, {})).rejects.toThrow("Forbidden");
  });
  it("publishes to free and paid users without device tokens or push opt-in", async () => {
    const { admin, alice, bob, t } = await fixture();
    const id = await admin.mutation(api.announcements.publish, update);
    expect((await alice.query(api.announcements.listForCurrentUser, {}))[0]._id).toBe(id);
    expect((await bob.query(api.announcements.listForCurrentUser, {}))[0].message).toBe(update.message);
    expect(await t.run((ctx) => ctx.db.query("adminAuditLogs").collect())).toHaveLength(1);
  });
  it("persists a dismissal only for its authenticated user, including retries and new sessions", async () => {
    const { admin, alice, bob, t } = await fixture();
    const id = await admin.mutation(api.announcements.publish, update);
    await alice.mutation(api.announcements.dismiss, { announcementId: id });
    await alice.mutation(api.announcements.dismiss, { announcementId: id });
    expect(await t.withIdentity({ subject: "alice" }).query(api.announcements.listForCurrentUser, {})).toEqual([]);
    expect(await bob.query(api.announcements.listForCurrentUser, {})).toHaveLength(1);
    expect(await t.run((ctx) => ctx.db.query("accountantAnnouncementDismissals").collect())).toHaveLength(1);
    await admin.mutation(api.announcements.publish, { ...update, title: "Another update" });
    expect((await alice.query(api.announcements.listForCurrentUser, {}))[0].title).toBe("Another update");
    await expect(alice.mutation(api.announcements.dismiss, { announcementId: id, userId: "bob" })).rejects.toThrow();
  });
  it("removes announcements globally and preserves admin history and audit records", async () => {
    const { admin, alice, bob, t } = await fixture();
    const id = await admin.mutation(api.announcements.publish, update);
    await admin.mutation(api.announcements.retire, { announcementId: id });
    await admin.mutation(api.announcements.retire, { announcementId: id });
    expect(await alice.query(api.announcements.listForCurrentUser, {})).toEqual([]);
    expect(await bob.query(api.announcements.listForCurrentUser, {})).toEqual([]);
    expect((await admin.query(api.announcements.listForAdmin, {}))[0].active).toBe(false);
    expect(await t.run((ctx) => ctx.db.query("adminAuditLogs").collect())).toHaveLength(2);
  });
  it("rejects anonymous access, forged requester identities, non-admin publishers and unverified admins", async () => {
    const { admin, alice, t } = await fixture();
    const id = await admin.mutation(api.announcements.publish, update);
    await expect(t.query(api.announcements.listForCurrentUser, {})).rejects.toThrow();
    await expect(t.mutation(api.announcements.dismiss, { announcementId: id })).rejects.toThrow();
    await expect(alice.query(api.announcements.listForAdmin, {})).rejects.toThrow();
    await expect(alice.mutation(api.announcements.publish, update)).rejects.toThrow();
    await expect(alice.mutation(api.announcements.retire, { announcementId: id })).rejects.toThrow();
    await expect(alice.mutation(api.announcements.publish, { ...update, requesterUid: "admin" })).rejects.toThrow();
    await expect(t.withIdentity({ subject: "admin", emailVerified: false }).mutation(api.announcements.publish, update)).rejects.toThrow();
  });
  it("rejects restricted admin roles and invalid content or unsafe links", async () => {
    const { admin, alice, t } = await fixture();
    await t.run(async (ctx) => {
      const user = await ctx.db.query("users").withIndex("by_firebase_uid", (q) => q.eq("firebaseUid", "alice")).first();
      await ctx.db.insert("adminRoles", { userId: user!._id, email: user!.email, role: "support", grantedAt: Date.now() });
    });
    await expect(t.withIdentity({ subject: "alice", emailVerified: true }).mutation(api.announcements.publish, update)).rejects.toThrow();
    for (const actionUrl of ["javascript:alert(1)", "//example.com", "http://example.com", "/\\example.com", "data:text/html,test"]) {
      await expect(admin.mutation(api.announcements.publish, { ...update, actionUrl })).rejects.toThrow();
    }
    await expect(admin.mutation(api.announcements.publish, { ...update, title: " " })).rejects.toThrow();
    await expect(admin.mutation(api.announcements.publish, { ...update, message: "x".repeat(2001) })).rejects.toThrow();
    await admin.mutation(api.announcements.publish, { ...update, actionUrl: "https://sheetpay.app/pricing" });
    expect(await alice.query(api.announcements.listForCurrentUser, {})).toHaveLength(1);
  });
  it("limits active banners to five and allows replacement after removal", async () => {
    const { admin, alice } = await fixture();
    for (let i = 0; i < 5; i++) await admin.mutation(api.announcements.publish, { ...update, title: `Update ${i}` });
    await expect(admin.mutation(api.announcements.publish, update)).rejects.toThrow("five");
    const rows = await alice.query(api.announcements.listForCurrentUser, {});
    expect(rows).toHaveLength(5);
    await admin.mutation(api.announcements.retire, { announcementId: rows[0]._id });
    await admin.mutation(api.announcements.publish, update);
    expect(await alice.query(api.announcements.listForCurrentUser, {})).toHaveLength(5);
  });
});
