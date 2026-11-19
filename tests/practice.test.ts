/// <reference types="vite/client" />
import { describe, it, expect, vi, afterEach } from "vitest";
import { convexTest } from "convex-test";
import { anyApi } from "convex/server";
import schema from "../convex/schema";
import { BOOKING_DESIGNS,WIDGET_DESIGNS } from "../shared/practiceDesigns";
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
  it('persists all six booking/widget designs and exposes only public branding fields',async()=>{const f=await fixture();for(let i=0;i<6;i++){const input={...profile,ownerId:f.ids.owner,bookingLayout:BOOKING_DESIGNS[i].id,widgetLayout:WIDGET_DESIGNS[i].id};await f.owner.mutation(api.practice.saveProfile,input);const publicView=await f.t.query(api.practice.publicProfile,{slug:profile.slug});expect(publicView.bookingLayout).toBe(input.bookingLayout);expect(publicView.widgetLayout).toBe(input.widgetLayout);expect(publicView.ownerId).toBeUndefined();}await expect(f.other.mutation(api.practice.saveProfile,{...profile,ownerId:f.ids.owner,bookingLayout:'minimal',widgetLayout:'voice'})).rejects.toThrow();});
  it('preserves legacy saves and rejects unknown design identifiers',async()=>{const f=await fixture();await f.owner.mutation(api.practice.saveProfile,{...profile,ownerId:f.ids.owner,bookingLayout:'studio',widgetLayout:'cards'});await f.owner.mutation(api.practice.saveProfile,{...profile,ownerId:f.ids.owner});const current=await f.owner.query(api.practice.getProfile,{ownerId:f.ids.owner});expect(current.bookingLayout).toBe('studio');expect(current.widgetLayout).toBe('cards');for(const key of ['bookingLayout','widgetLayout'])await expect(f.owner.mutation(api.practice.saveProfile,{...profile,ownerId:f.ids.owner,[key]:'unsupported-design'})).rejects.toThrow('supported');});

});

describe('practice plan enforcement',()=>{
 const contact={name:'Example',email:'lead@example.com',phone:'',notes:'',serviceId:'consultation'};
 async function freeFixture(){const f=await fixture();await f.t.run(ctx=>ctx.db.patch(f.ids.owner,{plan:'free',planStatus:'active'}));return f;}
 it('enforces Free lead caps atomically, preserves reads and resets by UTC month',async()=>{
  vi.useFakeTimers();vi.setSystemTime(new Date('2026-11-15T12:00:00Z'));
  const f=await freeFixture();
  for(let i=0;i<10;i++)await f.owner.mutation(api.practice.createLead,{ownerId:f.ids.owner,...contact});
  await expect(f.owner.mutation(api.practice.createLead,{ownerId:f.ids.owner,...contact})).rejects.toThrow(/Free includes 10/);
  const status=await f.owner.query(api.practice.planStatus,{ownerId:f.ids.owner});expect(status.counts.leads).toBe(10);
  await expect(f.other.query(api.practice.planStatus,{ownerId:f.ids.owner})).rejects.toThrow();
  const page=await f.owner.query(api.practice.listLeads,{ownerId:f.ids.owner,paginationOpts:{numItems:20,cursor:null}});expect(page.page).toHaveLength(10);
  vi.setSystemTime(new Date('2026-12-01T00:00:00Z'));
  await f.owner.mutation(api.practice.createLead,{ownerId:f.ids.owner,...contact});
  expect((await f.owner.query(api.practice.planStatus,{ownerId:f.ids.owner})).counts.leads).toBe(1);
 });
 it('restricts new premium layouts and services while retaining saved profile data',async()=>{
  const f=await freeFixture();
  await f.owner.mutation(api.practice.saveProfile,{ownerId:f.ids.owner,...profile,bookingLayout:'split',widgetLayout:'classic'});
  for(const change of [{bookingLayout:'editorial'},{widgetLayout:'voice'},{services:[0,1,2,3].map(i=>({...profile.services[0],id:`s${i}`}))}])
   await expect(f.owner.mutation(api.practice.saveProfile,{ownerId:f.ids.owner,...profile,...change})).rejects.toThrow(/Free includes/);
  expect((await f.owner.query(api.practice.getProfile,{ownerId:f.ids.owner})).bookingLayout).toBe('split');
 });
 it.each(['accountant_monthly','accountant_yearly'] as const)('unlocks layouts and removes Free caps for %s',async plan=>{
  const f=await freeFixture();await f.t.run(ctx=>ctx.db.patch(f.ids.owner,{plan,planStatus:'active'}));
  await f.owner.mutation(api.practice.saveProfile,{ownerId:f.ids.owner,...profile,bookingLayout:'studio',widgetLayout:'voice'});
  for(let i=0;i<11;i++)await f.owner.mutation(api.practice.createLead,{ownerId:f.ids.owner,...contact});
  expect((await f.owner.query(api.practice.planStatus,{ownerId:f.ids.owner})).limits).toBeNull();
 });
 it('caps accountant messages and document requests without locking old conversations',async()=>{
  const f=await freeFixture();
  for(let i=0;i<20;i++)await f.owner.mutation(api.practice.sendMessage,{businessId:f.ids.business,text:`Message ${i}`});
  await expect(f.owner.mutation(api.practice.sendMessage,{businessId:f.ids.business,text:'Beyond allowance'})).rejects.toThrow(/Free includes 20/);
  for(let i=0;i<3;i++)await f.owner.mutation(api.practice.requestDocuments,{businessId:f.ids.business,title:`Request ${i}`,details:'Review please',dueAt:Date.now()+86400000});
  await expect(f.owner.mutation(api.practice.requestDocuments,{businessId:f.ids.business,title:'Over limit',details:'',dueAt:Date.now()+86400000})).rejects.toThrow(/Free includes 3/);
  const status=await f.owner.query(api.practice.planStatus,{ownerId:f.ids.owner});expect(status.counts.messages).toBe(20);expect(status.counts.documentRequests).toBe(3);
  const page=await f.owner.query(api.practice.messages,{businessId:f.ids.business,paginationOpts:{numItems:30,cursor:null}});expect(page.page).toHaveLength(23);
 });
 it('checks the invitation quota and caps uploads before accepting more file bytes',async()=>{
  const f=await freeFixture();await f.owner.mutation(api.practice.inviteClient,{businessId:f.ids.business,email:'client@example.com'});
  await expect(f.owner.mutation(api.practice.inviteClient,{businessId:f.ids.business,email:'second@example.com'})).rejects.toThrow(/Free includes 1/);
  await f.t.run(ctx=>ctx.db.insert('practiceUsage',{ownerId:f.ids.owner,period:'2000-01',counts:{uploads:5}}));
  const {usagePeriod}=await import('../shared/accountantPlans');
  await f.t.run(async ctx=>{const row=await ctx.db.query('practiceUsage').withIndex('by_owner_period',q=>q.eq('ownerId',f.ids.owner).eq('period',usagePeriod())).first();await ctx.db.patch(row!._id,{counts:{...row!.counts,uploads:5}});});
  await expect(f.owner.query(api.practice.uploadContext,{businessId:f.ids.business,purpose:'document'})).rejects.toThrow(/Free includes 5/);
 });
});

describe('practice quota entry points',()=>{
 it('public booking cannot bypass appointment limits and failed bookings do not create leads',async()=>{
  const f=await fixture();await f.t.run(async ctx=>{await ctx.db.patch(f.ids.owner,{plan:'free',planStatus:'active'});const {usagePeriod}=await import('../shared/accountantPlans');await ctx.db.insert('practiceUsage',{ownerId:f.ids.owner,period:usagePeriod(),counts:{appointments:5}});});
  const times=await f.t.query(api.practice.slots,{slug:profile.slug,serviceId:'consultation',from:Date.now()+86400000});
  await expect(f.t.mutation(api.practice.book,{slug:profile.slug,name:'Visitor',email:'visitor@example.com',phone:'',notes:'',serviceId:'consultation',startsAt:times[0],consent:true,honeypot:''})).rejects.toThrow(/monthly appointments allowance/);
  const page=await f.owner.query(api.practice.listLeads,{ownerId:f.ids.owner,paginationOpts:{numItems:20,cursor:null}});expect(page.page).toHaveLength(0);
 });
 it('Cayla approval enforces the same quotas and leaves the prepared draft reviewable',async()=>{
  const f=await fixture();const {usagePeriod}=await import('../shared/accountantPlans');
  const draft=await f.t.run(async ctx=>{await ctx.db.patch(f.ids.owner,{plan:'free',planStatus:'active'});await ctx.db.insert('practiceUsage',{ownerId:f.ids.owner,period:usagePeriod(),counts:{leads:10}});return ctx.db.insert('practiceDrafts',{ownerId:f.ids.owner,actorId:f.ids.owner,kind:'lead',payload:{name:'Draft lead',email:'draft@example.com'},status:'prepared',createdAt:Date.now()});});
  await expect(f.owner.mutation(api.practice.approveDraft,{id:draft,confirmed:true})).rejects.toThrow(/Free includes 10/);
  expect((await f.owner.query(api.practice.getDraft,{id:draft})).status).toBe('prepared');
 });
 it('a cancelled subscription uses Free allowances while existing premium designs stay readable',async()=>{
  const f=await fixture();await f.owner.mutation(api.practice.saveProfile,{ownerId:f.ids.owner,...profile,bookingLayout:'editorial'});
  await f.t.run(ctx=>ctx.db.patch(f.ids.owner,{planStatus:'canceled'}));
  expect((await f.owner.query(api.practice.planStatus,{ownerId:f.ids.owner})).plan).toBe('free');
  expect((await f.t.query(api.practice.publicProfile,{slug:profile.slug})).bookingLayout).toBe('editorial');
 });
});

describe('practice quota boundaries',()=>{
 it('applies booking, follow-up and widget chat caps through public and staff entry points',async()=>{
  const f=await fixture();await f.t.run(ctx=>ctx.db.patch(f.ids.owner,{plan:'free',planStatus:'active'}));
  const {usagePeriod}=await import('../shared/accountantPlans');
  const lead=await f.owner.mutation(api.practice.createLead,{ownerId:f.ids.owner,name:'Lead',email:'lead@example.com',phone:'',notes:'',serviceId:'consultation'});
  for(let i=0;i<5;i++)await f.owner.mutation(api.practice.createFollowup,{ownerId:f.ids.owner,leadId:lead,title:'Follow up',dueAt:Date.now()+86400000});
  await expect(f.owner.mutation(api.practice.createFollowup,{ownerId:f.ids.owner,leadId:lead,title:'Over',dueAt:Date.now()+86400000})).rejects.toThrow(/Free includes 5/);
  for(let i=0;i<10;i++)await f.t.mutation(api.practice.publicChatContext,{slug:profile.slug});
  await expect(f.t.mutation(api.practice.publicChatContext,{slug:profile.slug})).rejects.toThrow(/monthly widget chat requests/);
  await f.t.run(async ctx=>{const row=await ctx.db.query('practiceUsage').withIndex('by_owner_period',q=>q.eq('ownerId',f.ids.owner).eq('period',usagePeriod())).first();await ctx.db.patch(row!._id,{counts:{...row!.counts,appointments:5}});});
  const slots=await f.t.query(api.practice.slots,{slug:profile.slug,serviceId:'consultation',from:Date.now()});
  await expect(f.t.mutation(api.practice.book,{slug:profile.slug,name:'Guest',email:'guest@example.com',phone:'',notes:'',serviceId:'consultation',startsAt:slots[0],consent:true,honeypot:''})).rejects.toThrow(/monthly appointments allowance/);
 });
});
