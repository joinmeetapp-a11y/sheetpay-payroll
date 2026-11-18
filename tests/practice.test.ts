/// <reference types="vite/client" />
import { describe, it, expect, vi, afterEach } from "vitest";
import { convexTest } from "convex-test";
import { anyApi } from "convex/server";
import schema from "../convex/schema";
import { availableSlots, validateProfile } from "../shared/practice";
const api = anyApi;
const modules = import.meta.glob("../convex/**/*.{ts,js}");
const profile = {
  slug: "prince-accounting",
  name: "Prince Accounting",
  headline: "Your accounting partner",
  description: "Tax and bookkeeping",
  color: "#047857",
  logo: "",
  cover: "",
  services: [
    {
      id: "consultation",
      name: "Consultation",
      description: "Let us talk",
      duration: 30,
      price: "Free",
    },
  ],
  timezone: "America/Port_of_Spain",
  availability: [0, 1, 2, 3, 4, 5, 6].map((day) => ({
    day,
    start: 540,
    end: 1020,
  })),
  published: true,
  widgetGreeting: "How can we help?",
  widgetPosition: "right",
  widgetVoice: true,
  allowedOrigins: ["https://example.com"],
};
async function fixture() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const owner = await ctx.db.insert("users", {
      firebaseUid: "owner",
      email: "owner@example.com",
      emailVerified: true,
      accountType: "accountant",
      plan: "accountant_monthly",
      planStatus: "active",
    });
    const other = await ctx.db.insert("users", {
      firebaseUid: "other",
      email: "other@example.com",
      emailVerified: true,
      accountType: "accountant",
    });
    const business = await ctx.db.insert("businesses", {
      userId: owner,
      name: "Existing payroll client",
      currency: "TTD",
      currencySymbol: "$",
      updatedAt: Date.now(),
    });
    return { owner, other, business };
  });
  const owner = t.withIdentity({
    subject: "owner",
    email: "owner@example.com",
    emailVerified: true,
  });
  const other = t.withIdentity({
    subject: "other",
    email: "other@example.com",
    emailVerified: true,
  });
  const client = t.withIdentity({
    subject: "client",
    email: "client@example.com",
    emailVerified: true,
  });
  await owner.mutation(api.practice.saveProfile, {
    ownerId: ids.owner,
    ...profile,
  });
  return { t, ids, owner, other, client };
}
afterEach(() => vi.useRealTimers());
describe("practice workspace isolation and booking", () => {
  it("publishes only brand information, rejects invalid profiles and prevents cross-tenant edits", async () => {
    const f = await fixture();
    const p = await f.t.query(api.practice.publicProfile, {
      slug: profile.slug,
    });
    expect(p.name).toBe(profile.name);
    expect(p.ownerId).toBeUndefined();
    await expect(
      f.other.mutation(api.practice.saveProfile, {
        ownerId: f.ids.owner,
        ...profile,
      }),
    ).rejects.toThrow();
    expect(() => validateProfile({ ...profile, color: "red" })).toThrow();
    expect(() =>
      validateProfile({ ...profile, allowedOrigins: ["javascript:alert(1)"] }),
    ).toThrow();
  });
  it("books a real available slot once and reserves overlapping service time", async () => {
    const f = await fixture();
    const slots = await f.t.query(api.practice.slots, {
      slug: profile.slug,
      serviceId: "consultation",
      from: Date.now(),
    });
    expect(slots.length).toBeGreaterThan(0);
    const booking = {
      slug: profile.slug,
      serviceId: "consultation",
      startsAt: slots[0],
      name: "Client",
      email: "client@example.com",
      phone: "",
      notes: "",
      consent: true,
      honeypot: "",
    };
    await f.t.mutation(api.practice.book, booking);
    await expect(f.t.mutation(api.practice.book, booking)).rejects.toThrow(
      "no longer available",
    );
    const next = await f.t.query(api.practice.slots, {
      slug: profile.slug,
      serviceId: "consultation",
      from: Date.now(),
    });
    expect(next).not.toContain(slots[0]);
    expect(
      await f.t.run((ctx) => ctx.db.query("payrollRuns").collect()),
    ).toEqual([]);
  });
  it("bounds public submission rates and enforces consent and publishing", async () => {
    const f = await fixture(),
      a = {
        slug: profile.slug,
        serviceId: "consultation",
        name: "Lead",
        email: "lead@example.com",
        phone: "",
        notes: "",
        consent: true,
        honeypot: "",
        source: "widget",
      };
    await expect(
      f.t.mutation(api.practice.captureLead, { ...a, consent: false }),
    ).rejects.toThrow();
    for (let i = 0; i < 3; i++) await f.t.mutation(api.practice.captureLead, a);
    await expect(f.t.mutation(api.practice.captureLead, a)).rejects.toThrow(
      "Too many",
    );
    await f.owner.mutation(api.practice.saveProfile, {
      ownerId: f.ids.owner,
      ...profile,
      published: false,
    });
    expect(
      await f.t.query(api.practice.publicProfile, { slug: profile.slug }),
    ).toBeNull();
    await expect(
      f.t.mutation(api.practice.captureLead, {
        ...a,
        email: "new@example.com",
      }),
    ).rejects.toThrow("not available");
  });
  it("paginates leads and refuses foreign lead changes", async () => {
    const f = await fixture();
    for (let i = 0; i < 4; i++)
      await f.owner.mutation(api.practice.createLead, {
        ownerId: f.ids.owner,
        name: "Lead " + i,
        email: `l${i}@example.com`,
        phone: "",
        notes: "",
        serviceId: "",
      });
    const page = await f.owner.query(api.practice.listLeads, {
      ownerId: f.ids.owner,
      paginationOpts: { numItems: 2, cursor: null },
    });
    expect(page.page).toHaveLength(2);
    expect(page.isDone).toBe(false);
    await expect(
      f.other.query(api.practice.listLeads, {
        ownerId: f.ids.owner,
        paginationOpts: { numItems: 2, cursor: null },
      }),
    ).rejects.toThrow();
    await expect(
      f.other.mutation(api.practice.updateLead, {
        id: page.page[0]._id,
        stage: "Won",
        notes: "",
      }),
    ).rejects.toThrow();
  });
  it("matches local booking hours across daylight-saving transitions", () => {
    const p = {
      ...profile,
      timezone: "America/New_York",
      availability: [{ day: 0, start: 60, end: 240 }],
    };
    const from = Date.parse("2026-03-08T05:00:00Z");
    const slots = availableSlots(p, "consultation", from, from + 6 * 3600000);
    expect(
      slots.map((t) =>
        new Intl.DateTimeFormat("en-US", {
          timeZone: p.timezone,
          hour: "2-digit",
          minute: "2-digit",
          hourCycle: "h23",
        }).format(t),
      ),
    ).toEqual(["01:00", "01:30", "03:00", "03:30"]);
  });
});
describe("private portal and reviewed commands", () => {
  it("binds invitations to a verified email and revokes private messages immediately", async () => {
    const f = await fixture();
    const token = await f.owner.mutation(api.practice.inviteClient, {
      businessId: f.ids.business,
      email: "client@example.com",
    });
    await expect(
      f.other.mutation(api.practice.acceptInvite, { token }),
    ).rejects.toThrow("email address");
    await expect(
      f.t
        .withIdentity({
          subject: "client",
          email: "client@example.com",
          emailVerified: false,
        })
        .mutation(api.practice.acceptInvite, { token }),
    ).rejects.toThrow("verify");
    await f.client.mutation(api.practice.acceptInvite, { token });
    await f.client.mutation(api.practice.sendMessage, {
      businessId: f.ids.business,
      text: "Here are my documents.",
    });
    const page = await f.owner.query(api.practice.messages, {
      businessId: f.ids.business,
      paginationOpts: { numItems: 20, cursor: null },
    });
    expect(page.page[0].senderRole).toBe("client");
    const members = await f.owner.query(api.practice.members, {
      businessId: f.ids.business,
    });
    await f.owner.mutation(api.practice.revokeMember, { id: members[0]._id });
    await expect(
      f.client.query(api.practice.messages, {
        businessId: f.ids.business,
        paginationOpts: { numItems: 20, cursor: null },
      }),
    ).rejects.toThrow();
    await expect(
      f.client.mutation(api.practice.acceptInvite, { token }),
    ).rejects.toThrow("unavailable");
  });
  it("client uploads are scoped; requesting/reviewing documents is accountant-only", async () => {
    const f = await fixture();
    const token = await f.owner.mutation(api.practice.inviteClient, {
      businessId: f.ids.business,
      email: "client@example.com",
    });
    await f.client.mutation(api.practice.acceptInvite, { token });
    await expect(
      f.client.mutation(api.practice.requestDocuments, {
        businessId: f.ids.business,
        title: "Statement",
        details: "",
        dueAt: Date.now() + 3600000,
      }),
    ).rejects.toThrow("Only your accountant");
    const request = await f.owner.mutation(api.practice.requestDocuments, {
      businessId: f.ids.business,
      title: "Bank statement",
      details: "October",
      dueAt: Date.now() + 3600000,
    });
    const stored = await f.t.run((ctx) =>
      ctx.storage.store(new Blob(["statement"], { type: "application/pdf" })),
    );
    const grant = await f.client.mutation(api.practice.registerUpload, {
      businessId: f.ids.business,
      purpose: "document",
      contentType: "application/pdf",
      storageId: stored,
    });
    await expect(
      f.other.mutation(api.practice.attachDocument, {
        businessId: f.ids.business,
        uploadId: grant.id,
        name: "statement.pdf",
      }),
    ).rejects.toThrow();
    const id = await f.client.mutation(api.practice.attachDocument, {
      businessId: f.ids.business,
      requestId: request,
      uploadId: grant.id,
      name: "statement.pdf",
    });
    expect(await f.client.mutation(api.practice.documentUrl, { id })).toContain(
      "https:",
    );
    await expect(
      f.client.mutation(api.practice.attachDocument, {
        businessId: f.ids.business,
        uploadId: grant.id,
        name: "again.pdf",
      }),
    ).rejects.toThrow();
    await expect(
      f.client.mutation(api.practice.reviewRequest, {
        id: request,
        status: "accepted",
      }),
    ).rejects.toThrow();
    await expect(
      f.other.mutation(api.practice.documentUrl, { id }),
    ).rejects.toThrow();
    await f.owner.mutation(api.practice.reviewRequest, {
      id: request,
      status: "accepted",
    });
  });
  it("appointment drafts reserve a slot only at approval and reject a slot taken since preparation", async () => {
    const f = await fixture();
    const slots = await f.t.query(api.practice.slots, {
      slug: profile.slug,
      serviceId: "consultation",
      from: Date.now(),
    });
    const payload = {
      name: "Jane",
      email: "jane@example.com",
      phone: "",
      notes: "",
      serviceId: "consultation",
      startsAt: slots[0],
    };
    const id = await f.owner.mutation(api.practice.saveDraft, {
      ownerId: f.ids.owner,
      kind: "appointment",
      payload,
    });
    expect(
      await f.t.run((ctx) => ctx.db.query("practiceAppointments").collect()),
    ).toHaveLength(0);
    await f.t.mutation(api.practice.book, {
      slug: profile.slug,
      ...payload,
      consent: true,
      honeypot: "",
    });
    await expect(
      f.owner.mutation(api.practice.approveDraft, { id, confirmed: true }),
    ).rejects.toThrow("no longer available");
  });
  it("never executes a prepared command without explicit approval and makes approval idempotent", async () => {
    const f = await fixture();
    const id = await f.owner.mutation(api.practice.saveDraft, {
      ownerId: f.ids.owner,
      businessId: f.ids.business,
      kind: "message",
      payload: { text: "Please upload your statement." },
    });
    expect(
      await f.t.run((ctx) => ctx.db.query("practiceMessages").collect()),
    ).toHaveLength(0);
    await expect(
      f.owner.mutation(api.practice.approveDraft, { id, confirmed: false }),
    ).rejects.toThrow("approve");
    await expect(
      f.other.mutation(api.practice.approveDraft, { id, confirmed: true }),
    ).rejects.toThrow();
    await f.owner.mutation(api.practice.approveDraft, { id, confirmed: true });
    await f.owner.mutation(api.practice.approveDraft, { id, confirmed: true });
    expect(
      await f.t.run((ctx) => ctx.db.query("practiceMessages").collect()),
    ).toHaveLength(1);
  });
  it("fires due reminders through scheduled jobs and cancels completed follow-ups", async () => {
    vi.useFakeTimers();
    const f = await fixture();
    const leadId = await f.owner.mutation(api.practice.createLead, {
      ownerId: f.ids.owner,
      name: "Lead",
      email: "l@example.com",
      phone: "",
      notes: "",
      serviceId: "",
    });
    const id = await f.owner.mutation(api.practice.createFollowup, {
      ownerId: f.ids.owner,
      leadId,
      title: "Call lead",
      dueAt: Date.now() + 60000,
    });
    const row: any = await f.t.run((ctx) => ctx.db.get(id));
    expect(row.jobId).toBeDefined();
    await f.owner.mutation(api.practice.completeFollowup, { id });
    await f.t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(
      await f.t.run((ctx) => ctx.db.query("practiceReminders").collect()),
    ).toHaveLength(0);
  });
});
