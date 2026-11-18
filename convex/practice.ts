import { v } from "convex/values";
import { paginationOptsValidator, anyApi } from "convex/server";
import { query, internalQuery } from "./_generated/server";
import { mutation, internalMutation } from "./functions";
import { service, availability } from "./practiceSchema";
import {
  getActor,
  requireBusinessAccess,
  requireWorkspaceAdmin,
  recordAccountantActivity,
} from "./lib/accountantAccess";
import {
  availableSlots,
  cleanText,
  validEmail,
  validateProfile,
  LEAD_STAGES,
  DOCUMENT_TYPES,
  MAX_DOCUMENT_BYTES,
} from "../shared/practice";
const api: any = anyApi;
const ownerArgs = { ownerId: v.id("users") };
async function staff(ctx: any, ownerId: any) {
  return requireWorkspaceAdmin(ctx, ownerId);
}
export async function portalAccess(ctx: any, businessId: any, write = false) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw Error("Please sign in.");
  const business = await ctx.db.get(businessId);
  if (!business) throw Error("Client unavailable.");
  const member = await ctx.db
    .query("practiceMembers")
    .withIndex("by_uid_business", (q: any) =>
      q.eq("firebaseUid", identity.subject).eq("businessId", businessId),
    )
    .first();
  if (
    member?.active &&
    identity.emailVerified === true &&
    String(identity.email || "").toLowerCase() === member.email
  )
    return {
      identity,
      business,
      role: "client",
      name: identity.name || member.email,
    };
  const access = await requireBusinessAccess(
    ctx,
    business,
    write ? "manageClients" : "read",
  );
  return {
    identity,
    business,
    role: "accountant",
    name: access.actor.displayName || access.actor.email,
  };
}
async function rate(ctx: any, key: string, max: number, ms = 3600000) {
  const now = Date.now(),
    row = await ctx.db
      .query("practiceThrottle")
      .withIndex("by_key", (q: any) => q.eq("key", key))
      .first();
  if (row && now - row.window < ms) {
    if (row.count >= max)
      throw Error("Too many requests. Please try again later.");
    await ctx.db.patch(row._id, { count: row.count + 1 });
  } else if (row) {
    await ctx.db.patch(row._id, { window: now, count: 1 });
    await ctx.scheduler.runAfter(ms + 60000, api.practice.expireThrottle, {
      id: row._id,
      window: now,
    });
  } else {
    const id = await ctx.db.insert("practiceThrottle", {
      key,
      window: now,
      count: 1,
    });
    await ctx.scheduler.runAfter(ms + 60000, api.practice.expireThrottle, {
      id,
      window: now,
    });
  }
}
async function published(ctx: any, slug: string) {
  const p = await ctx.db
    .query("practiceProfiles")
    .withIndex("by_slug", (q: any) => q.eq("slug", slug))
    .first();
  if (!p?.published) throw Error("This booking page is not available.");
  return p;
}
async function owned(ctx: any, table: string, id: any, ownerId: any) {
  const row = await ctx.db.get(id);
  if (!row || row.ownerId !== ownerId) throw Error("Record unavailable.");
  return row;
}
async function notice(
  ctx: any,
  ownerId: any,
  title: string,
  details: string,
  businessId?: any,
) {
  await ctx.db.insert("practiceReminders", {
    ownerId,
    title,
    details,
    businessId,
    createdAt: Date.now(),
    read: false,
  });
}
export const getProfile = query({
  args: ownerArgs,
  handler: async (ctx, { ownerId }) => {
    await staff(ctx, ownerId);
    return ctx.db
      .query("practiceProfiles")
      .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
      .first();
  },
});
export const saveProfile = mutation({
  args: {
    ...ownerArgs,
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
  },
  handler: async (ctx, args) => {
    const { actor } = await staff(ctx, args.ownerId);
    validateProfile(args);
    const taken = await ctx.db
      .query("practiceProfiles")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();
    if (taken && taken.ownerId !== args.ownerId)
      throw Error("This link name is already taken.");
    const current = await ctx.db
      .query("practiceProfiles")
      .withIndex("by_owner", (q) => q.eq("ownerId", args.ownerId))
      .first();
    // Keep shared links stable: unpublish before changing a published slug.
    if (current?.published && current.slug !== args.slug)
      throw Error("Unpublish the page before changing its link.");
    const value = { ...args, updatedAt: Date.now() };
    if (current) await ctx.db.patch(current._id, value);
    else await ctx.db.insert("practiceProfiles", value);
    await recordAccountantActivity(
      ctx,
      args.ownerId,
      actor._id,
      args.published ? "Published booking page" : "Saved booking page",
    );
    return args.slug;
  },
});
export const publicProfile = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const p = await ctx.db
      .query("practiceProfiles")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .first();
    if (!p?.published) return null;
    const { ownerId, _id, _creationTime, updatedAt, ...safe } = p;
    return safe;
  },
});
async function slotList(
  ctx: any,
  p: any,
  serviceId: string,
  from: number,
  to: number,
) {
  const appointments = await ctx.db
    .query("practiceAppointments")
    .withIndex("by_owner_start", (q: any) =>
      q
        .eq("ownerId", p.ownerId)
        .gte("startsAt", from - 4 * 3600000)
        .lte("startsAt", to),
    )
    .take(501);
  if (appointments.length > 500)
    throw Error("Please contact this business to arrange a time.");
  return availableSlots(
    p,
    serviceId,
    Math.max(Date.now() + 3600000, from),
    Math.min(Date.now() + 14 * 86400000, to),
    appointments,
  );
}
export const slots = query({
  args: { slug: v.string(), serviceId: v.string(), from: v.number() },
  handler: async (ctx, a) => {
    const p = await published(ctx, a.slug);
    return slotList(
      ctx,
      p,
      a.serviceId,
      Math.max(Date.now(), a.from),
      Math.min(a.from + 7 * 86400000, Date.now() + 14 * 86400000),
    );
  },
});
async function insertLead(ctx: any, ownerId: any, p: any, source: string) {
  const name = cleanText(p.name, 120),
    email = cleanText(p.email, 254).toLowerCase();
  if (!name || !validEmail(email))
    throw Error("Enter your name and a valid email address.");
  return ctx.db.insert("practiceLeads", {
    ownerId,
    name,
    email,
    phone: cleanText(p.phone || "", 50),
    serviceId: cleanText(p.serviceId || "", 60),
    source,
    stage: "New",
    notes: cleanText(p.notes || ""),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
}
const contact = {
  name: v.string(),
  email: v.string(),
  phone: v.string(),
  notes: v.string(),
  serviceId: v.string(),
};
export const captureLead = mutation({
  args: {
    slug: v.string(),
    ...contact,
    consent: v.boolean(),
    honeypot: v.string(),
    source: v.string(),
  },
  handler: async (ctx, a) => {
    if (!a.consent || a.honeypot)
      throw Error("Please confirm permission to contact you.");
    const p = await published(ctx, a.slug);
    if (!p.services.some((s: any) => s.id === a.serviceId))
      throw Error("Choose a service.");
    await rate(ctx, `public:${p.ownerId}`, 100);
    await rate(ctx, `email:${p.ownerId}:${a.email.trim().toLowerCase()}`, 3);
    const id = await insertLead(
      ctx,
      p.ownerId,
      a,
      a.source === "widget" ? "Website widget" : "Booking page",
    );
    await notice(
      ctx,
      p.ownerId,
      "New inquiry",
      `${cleanText(a.name, 120)} requested ${p.services.find((s: any) => s.id === a.serviceId)?.name}.`,
    );
    return id;
  },
});
export const book = mutation({
  args: {
    slug: v.string(),
    ...contact,
    startsAt: v.number(),
    consent: v.boolean(),
    honeypot: v.string(),
  },
  handler: async (ctx, a) => {
    if (!a.consent || a.honeypot)
      throw Error("Please confirm permission to process your booking.");
    const p = await published(ctx, a.slug);
    await rate(ctx, `public:${p.ownerId}`, 100);
    await rate(ctx, `email:${p.ownerId}:${a.email.trim().toLowerCase()}`, 3);
    const times = await slotList(
      ctx,
      p,
      a.serviceId,
      a.startsAt,
      a.startsAt + 4 * 3600000,
    );
    if (!times.includes(a.startsAt))
      throw Error("This time is no longer available. Choose another slot.");
    const s = p.services.find((s: any) => s.id === a.serviceId);
    const leadId = await insertLead(ctx, p.ownerId, a, "Booking page");
    const id = await ctx.db.insert("practiceAppointments", {
      ownerId: p.ownerId,
      leadId,
      serviceId: s.id,
      serviceName: s.name,
      startsAt: a.startsAt,
      endsAt: a.startsAt + s.duration * 60000,
      status: "booked",
      name: cleanText(a.name, 120),
      email: a.email.trim().toLowerCase(),
      notes: cleanText(a.notes),
      createdAt: Date.now(),
    });
    const reminderJob = await ctx.scheduler.runAt(
      Math.max(Date.now(), a.startsAt - 3600000),
      api.practice.appointmentReminder,
      { id },
    );
    await ctx.db.patch(id, { reminderJob });
    await notice(
      ctx,
      p.ownerId,
      "New booking",
      `${cleanText(a.name, 120)} booked ${s.name}.`,
    );
    return {
      id,
      startsAt: a.startsAt,
      endsAt: a.startsAt + s.duration * 60000,
      service: s.name,
      timezone: p.timezone,
    };
  },
});
export const listLeads = query({
  args: {
    ...ownerArgs,
    stage: v.optional(v.string()),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, a) => {
    await staff(ctx, a.ownerId);
    return a.stage
      ? ctx.db
          .query("practiceLeads")
          .withIndex("by_owner_stage", (q) =>
            q.eq("ownerId", a.ownerId).eq("stage", a.stage!),
          )
          .order("desc")
          .paginate(a.paginationOpts)
      : ctx.db
          .query("practiceLeads")
          .withIndex("by_owner", (q) => q.eq("ownerId", a.ownerId))
          .order("desc")
          .paginate(a.paginationOpts);
  },
});
export const createLead = mutation({
  args: { ...ownerArgs, ...contact },
  handler: async (ctx, a) => {
    await staff(ctx, a.ownerId);
    return insertLead(ctx, a.ownerId, a, "Manual");
  },
});
export const updateLead = mutation({
  args: {
    id: v.id("practiceLeads"),
    stage: v.string(),
    notes: v.string(),
    businessId: v.optional(v.id("businesses")),
  },
  handler: async (ctx, a) => {
    const lead = await ctx.db.get(a.id);
    if (!lead) throw Error("Lead unavailable.");
    await staff(ctx, lead.ownerId);
    if (!LEAD_STAGES.includes(a.stage as any))
      throw Error("Invalid pipeline stage.");
    if (a.businessId) {
      const b = await ctx.db.get(a.businessId);
      if (b?.userId !== lead.ownerId)
        throw Error("Choose a client in this workspace.");
    }
    await ctx.db.patch(a.id, {
      stage: a.stage,
      notes: cleanText(a.notes, 5000),
      businessId: a.businessId,
      updatedAt: Date.now(),
    });
  },
});
export const appointments = query({
  args: {
    ...ownerArgs,
    from: v.number(),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, a) => {
    await staff(ctx, a.ownerId);
    return ctx.db
      .query("practiceAppointments")
      .withIndex("by_owner_start", (q) =>
        q.eq("ownerId", a.ownerId).gte("startsAt", a.from),
      )
      .paginate(a.paginationOpts);
  },
});
export const updateAppointment = mutation({
  args: {
    id: v.id("practiceAppointments"),
    status: v.union(v.literal("completed"), v.literal("cancelled")),
  },
  handler: async (ctx, a) => {
    const row = await ctx.db.get(a.id);
    if (!row) throw Error("Appointment unavailable.");
    await staff(ctx, row.ownerId);
    if (row.status !== "booked")
      throw Error("This appointment has already been updated.");
    if (row.reminderJob) await ctx.scheduler.cancel(row.reminderJob);
    await ctx.db.patch(row._id, { status: a.status });
  },
});
export const appointmentReminder = internalMutation({
  args: { id: v.id("practiceAppointments") },
  handler: async (ctx, { id }) => {
    const row = await ctx.db.get(id);
    if (row?.status === "booked")
      await notice(
        ctx,
        row.ownerId,
        "Upcoming appointment",
        `${row.name} · ${row.serviceName}`,
      );
  },
});
export const followups = query({
  args: { ...ownerArgs, paginationOpts: paginationOptsValidator },
  handler: async (ctx, a) => {
    await staff(ctx, a.ownerId);
    return ctx.db
      .query("practiceFollowups")
      .withIndex("by_owner_status_due", (q) =>
        q.eq("ownerId", a.ownerId).eq("status", "open"),
      )
      .paginate(a.paginationOpts);
  },
});
async function addFollowup(ctx: any, ownerId: any, p: any) {
  await owned(ctx, "practiceLeads", p.leadId, ownerId);
  if (!p.title?.trim() || !Number.isFinite(p.dueAt) || p.dueAt <= Date.now())
    throw Error("Add a title and future deadline.");
  const id = await ctx.db.insert("practiceFollowups", {
    ownerId,
    leadId: p.leadId,
    title: cleanText(p.title, 200),
    dueAt: p.dueAt,
    status: "open",
    createdAt: Date.now(),
  });
  const jobId = await ctx.scheduler.runAt(
    p.dueAt,
    api.practice.followupReminder,
    { id },
  );
  await ctx.db.patch(id, { jobId });
  return id;
}
export const createFollowup = mutation({
  args: {
    ...ownerArgs,
    leadId: v.id("practiceLeads"),
    title: v.string(),
    dueAt: v.number(),
  },
  handler: async (ctx, a) => {
    await staff(ctx, a.ownerId);
    return addFollowup(ctx, a.ownerId, a);
  },
});
export const completeFollowup = mutation({
  args: { id: v.id("practiceFollowups") },
  handler: async (ctx, { id }) => {
    const row = await ctx.db.get(id);
    if (!row) throw Error("Follow-up unavailable.");
    await staff(ctx, row.ownerId);
    if (row.jobId) await ctx.scheduler.cancel(row.jobId);
    await ctx.db.patch(id, { status: "done" });
  },
});
export const followupReminder = internalMutation({
  args: { id: v.id("practiceFollowups") },
  handler: async (ctx, { id }) => {
    const row = await ctx.db.get(id);
    if (row?.status === "open")
      await notice(ctx, row.ownerId, "Follow-up due", row.title);
  },
});
async function hash(value: string) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
    ),
  )
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
export const inviteClient = mutation({
  args: { businessId: v.id("businesses"), email: v.string() },
  handler: async (ctx, a) => {
    const b = await ctx.db.get(a.businessId);
    await requireBusinessAccess(ctx, b, "manageClients");
    const email = a.email.trim().toLowerCase();
    if (!validEmail(email)) throw Error("Enter a valid email.");
    const pending = await ctx.db
      .query("practiceInvites")
      .withIndex("by_business_email", (q) =>
        q.eq("businessId", a.businessId).eq("email", email),
      )
      .order("desc")
      .take(20);
    for (const previous of pending)
      if (!previous.acceptedAt && !previous.revokedAt)
        await ctx.db.patch(previous._id, { revokedAt: Date.now() });
    const token = crypto.randomUUID() + crypto.randomUUID();
    await ctx.db.insert("practiceInvites", {
      ownerId: b!.userId,
      businessId: a.businessId,
      email,
      tokenHash: await hash(token),
      expiresAt: Date.now() + 7 * 86400000,
    });
    return token;
  },
});
export const acceptInvite = mutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || identity.emailVerified !== true)
      throw Error("Sign in and verify your email first.");
    const tokenHash = await hash(token);
    const invite = await ctx.db
      .query("practiceInvites")
      .withIndex("by_token", (q) => q.eq("tokenHash", tokenHash))
      .first();
    if (!invite || invite.revokedAt || invite.expiresAt < Date.now())
      throw Error(
        "Invitation expired or unavailable. Ask your accountant for a new link.",
      );
    const email = String(identity.email || "")
      .trim()
      .toLowerCase();
    if (email !== invite.email)
      throw Error("Sign in with the email address invited by your accountant.");
    const existing = await ctx.db
      .query("practiceMembers")
      .withIndex("by_uid_business", (q) =>
        q
          .eq("firebaseUid", identity.subject)
          .eq("businessId", invite.businessId),
      )
      .first();
    if (invite.acceptedAt) {
      if (existing?.active) return invite.businessId;
      throw Error("This invitation has already been used.");
    }
    if (existing) await ctx.db.patch(existing._id, { active: true, email });
    else
      await ctx.db.insert("practiceMembers", {
        ownerId: invite.ownerId,
        businessId: invite.businessId,
        email,
        firebaseUid: identity.subject,
        active: true,
        createdAt: Date.now(),
      });
    await ctx.db.patch(invite._id, { acceptedAt: Date.now() });
    return invite.businessId;
  },
});
export const members = query({
  args: { businessId: v.id("businesses") },
  handler: async (ctx, { businessId }) => {
    const b = await ctx.db.get(businessId);
    await requireBusinessAccess(ctx, b, "manageClients");
    return ctx.db
      .query("practiceMembers")
      .withIndex("by_business", (q) => q.eq("businessId", businessId))
      .take(100);
  },
});
export const revokeMember = mutation({
  args: { id: v.id("practiceMembers") },
  handler: async (ctx, { id }) => {
    const m = await ctx.db.get(id);
    if (!m) throw Error("Member unavailable.");
    const b = await ctx.db.get(m.businessId);
    await requireBusinessAccess(ctx, b, "manageClients");
    await ctx.db.patch(id, { active: false });
    const invites = await ctx.db
      .query("practiceInvites")
      .withIndex("by_business_email", (q) =>
        q.eq("businessId", m.businessId).eq("email", m.email),
      )
      .order("desc")
      .take(20);
    for (const invite of invites)
      if (!invite.revokedAt)
        await ctx.db.patch(invite._id, { revokedAt: Date.now() });
  },
});
export const portalBusinesses = query({
  args: {},
  handler: async (ctx) => {
    const i = await ctx.auth.getUserIdentity();
    if (!i || i.emailVerified !== true) return [];
    const rows = await ctx.db
      .query("practiceMembers")
      .withIndex("by_uid", (q) => q.eq("firebaseUid", i.subject))
      .take(100);
    const active = rows.filter(
      (r) => r.active && r.email === String(i.email || "").toLowerCase(),
    );
    return (
      await Promise.all(
        active.map(async (r) => {
          const b = await ctx.db.get(r.businessId);
          return b ? { _id: b._id, name: b.name } : null;
        }),
      )
    ).filter(Boolean);
  },
});
export const messages = query({
  args: {
    businessId: v.id("businesses"),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, a) => {
    await portalAccess(ctx, a.businessId);
    return ctx.db
      .query("practiceMessages")
      .withIndex("by_business", (q) => q.eq("businessId", a.businessId))
      .order("desc")
      .paginate(a.paginationOpts);
  },
});
async function insertMessage(ctx: any, businessId: any, text: string) {
  const access = await portalAccess(ctx, businessId, true);
  if (!text.trim() || text.length > 4000)
    throw Error("Write a message of up to 4,000 characters.");
  await rate(ctx, `chat:${access.identity.subject}`, 60, 60000);
  return ctx.db.insert("practiceMessages", {
    ownerId: access.business.userId,
    businessId,
    senderUid: access.identity.subject,
    senderName: access.name,
    senderRole: access.role,
    text: text.trim(),
    createdAt: Date.now(),
  });
}
export const sendMessage = mutation({
  args: { businessId: v.id("businesses"), text: v.string() },
  handler: async (ctx, a) => insertMessage(ctx, a.businessId, a.text),
});
export const requests = query({
  args: {
    businessId: v.id("businesses"),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, a) => {
    await portalAccess(ctx, a.businessId);
    return ctx.db
      .query("practiceRequests")
      .withIndex("by_business", (q) => q.eq("businessId", a.businessId))
      .order("desc")
      .paginate(a.paginationOpts);
  },
});
async function addRequest(ctx: any, businessId: any, p: any) {
  const access = await portalAccess(ctx, businessId, true);
  if (access.role !== "accountant")
    throw Error("Only your accountant can request documents.");
  if (!p.title?.trim() || !Number.isFinite(p.dueAt) || p.dueAt <= Date.now())
    throw Error("Enter a title and future deadline.");
  const id = await ctx.db.insert("practiceRequests", {
    ownerId: access.business.userId,
    businessId,
    title: cleanText(p.title, 200),
    details: cleanText(p.details || ""),
    dueAt: p.dueAt,
    status: "requested",
    createdAt: Date.now(),
  });
  const reminderJob = await ctx.scheduler.runAt(
    p.dueAt,
    api.practice.documentReminder,
    { id },
  );
  await ctx.db.patch(id, { reminderJob });
  await insertMessage(
    ctx,
    businessId,
    `Document request: ${cleanText(p.title, 200)}\n${cleanText(p.details || "")}\nDue: ${new Date(p.dueAt).toISOString().slice(0, 10)}`,
  );
  return id;
}
export const requestDocuments = mutation({
  args: {
    businessId: v.id("businesses"),
    title: v.string(),
    details: v.string(),
    dueAt: v.number(),
  },
  handler: async (ctx, a) => addRequest(ctx, a.businessId, a),
});
export const reviewRequest = mutation({
  args: {
    id: v.id("practiceRequests"),
    status: v.union(v.literal("accepted"), v.literal("needs_correction")),
  },
  handler: async (ctx, a) => {
    const r = await ctx.db.get(a.id);
    if (!r) throw Error("Request unavailable.");
    const access = await portalAccess(ctx, r.businessId, true);
    if (access.role !== "accountant")
      throw Error("Only your accountant can review documents.");
    if (r.reminderJob && a.status === "accepted")
      await ctx.scheduler.cancel(r.reminderJob);
    await ctx.db.patch(r._id, { status: a.status });
    await insertMessage(
      ctx,
      r.businessId,
      `${r.title}: ${a.status === "accepted" ? "Documents accepted." : "Please upload corrected documents."}`,
    );
  },
});
export const documentReminder = internalMutation({
  args: { id: v.id("practiceRequests") },
  handler: async (ctx, { id }) => {
    const r = await ctx.db.get(id);
    if (r && ["requested", "needs_correction"].includes(r.status))
      await notice(ctx, r.ownerId, "Documents overdue", r.title, r.businessId);
  },
});
export const documents = query({
  args: {
    businessId: v.id("businesses"),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, a) => {
    await portalAccess(ctx, a.businessId);
    return ctx.db
      .query("practiceDocuments")
      .withIndex("by_business", (q) => q.eq("businessId", a.businessId))
      .order("desc")
      .paginate(a.paginationOpts);
  },
});
// Upload bytes are stored by the authenticated action, never accepted as a caller-supplied storage ID.
export const uploadContext = internalQuery({
  args: { businessId: v.optional(v.id("businesses")), purpose: v.string() },
  handler: async (ctx, a) => {
    if (a.purpose === "document" && a.businessId) {
      const access = await portalAccess(ctx, a.businessId, true);
      return {
        uid: access.identity.subject,
        ownerId: access.business.userId,
        businessId: a.businessId,
      };
    }
    if (a.purpose === "brand") {
      const { actor, identity } = await getActor(ctx);
      return { uid: identity.subject, ownerId: actor._id };
    }
    throw Error("Invalid upload destination.");
  },
});
export const registerUpload = internalMutation({
  args: {
    businessId: v.optional(v.id("businesses")),
    purpose: v.string(),
    contentType: v.string(),
    storageId: v.id("_storage"),
  },
  handler: async (ctx, a) => {
    let ownerId: any, uid: string;
    if (a.purpose === "document" && a.businessId) {
      const access = await portalAccess(ctx, a.businessId, true);
      ownerId = access.business.userId;
      uid = access.identity.subject;
    } else if (a.purpose === "brand") {
      const access = await getActor(ctx);
      ownerId = access.actor._id;
      uid = access.identity.subject;
    } else throw Error("Invalid upload.");
    await rate(ctx, `uploads:${uid}`, 30);
    const id = await ctx.db.insert("practiceUploads", {
      businessId: a.businessId,
      ownerId,
      uid,
      purpose: a.purpose,
      contentType: a.contentType,
      storageId: a.storageId,
      createdAt: Date.now(),
      expiresAt: Date.now() + 3600000,
      consumed: a.purpose === "brand",
    });
    if (a.purpose === "document") {
      const cleanupJob = await ctx.scheduler.runAfter(
        3600000,
        api.practice.cleanupUpload,
        { id },
      );
      await ctx.db.patch(id, { cleanupJob });
    }
    return {
      id,
      url: a.purpose === "brand" ? await ctx.storage.getUrl(a.storageId) : null,
    };
  },
});
export const cleanupUpload = internalMutation({
  args: { id: v.id("practiceUploads") },
  handler: async (ctx, { id }) => {
    const r = await ctx.db.get(id);
    if (r && !r.consumed && r.storageId) {
      await ctx.storage.delete(r.storageId);
      await ctx.db.delete(id);
    }
  },
});
export const attachDocument = mutation({
  args: {
    uploadId: v.id("practiceUploads"),
    businessId: v.id("businesses"),
    requestId: v.optional(v.id("practiceRequests")),
    name: v.string(),
  },
  handler: async (ctx, a) => {
    const access = await portalAccess(ctx, a.businessId, true),
      upload = await ctx.db.get(a.uploadId);
    if (
      !upload ||
      upload.consumed ||
      upload.expiresAt < Date.now() ||
      upload.uid !== access.identity.subject ||
      upload.businessId !== a.businessId ||
      !upload.storageId
    )
      throw Error("Upload expired or unavailable.");
    const meta = await ctx.db.system.get(upload.storageId);
    if (
      !meta ||
      meta.size > MAX_DOCUMENT_BYTES ||
      !DOCUMENT_TYPES.includes(meta.contentType || upload.contentType)
    )
      throw Error("Unsupported document.");
    if (a.requestId) {
      const r = await ctx.db.get(a.requestId);
      if (!r || r.businessId !== a.businessId || r.status === "accepted")
        throw Error("Document request is unavailable.");
      await ctx.db.patch(r._id, { status: "received" });
    }
    if (!a.name.trim()) throw Error("Enter a filename.");
    const id = await ctx.db.insert("practiceDocuments", {
      ownerId: access.business.userId,
      businessId: a.businessId,
      requestId: a.requestId,
      storageId: upload.storageId,
      name: cleanText(a.name, 160),
      contentType: meta.contentType || upload.contentType,
      size: meta.size,
      uploaderUid: access.identity.subject,
      createdAt: Date.now(),
    });
    if (upload.cleanupJob) await ctx.scheduler.cancel(upload.cleanupJob);
    await ctx.db.patch(upload._id, { consumed: true });
    await insertMessage(
      ctx,
      a.businessId,
      `Uploaded document: ${cleanText(a.name, 160)}`,
    );
    return id;
  },
});
export const documentUrl = mutation({
  args: { id: v.id("practiceDocuments") },
  handler: async (ctx, { id }) => {
    const d = await ctx.db.get(id);
    if (!d) throw Error("Document unavailable.");
    await portalAccess(ctx, d.businessId);
    return ctx.storage.getUrl(d.storageId);
  },
});
export const reminders = query({
  args: { ...ownerArgs, paginationOpts: paginationOptsValidator },
  handler: async (ctx, a) => {
    await staff(ctx, a.ownerId);
    return ctx.db
      .query("practiceReminders")
      .withIndex("by_owner", (q) => q.eq("ownerId", a.ownerId))
      .order("desc")
      .paginate(a.paginationOpts);
  },
});
export const markReminderRead = mutation({
  args: { id: v.id("practiceReminders") },
  handler: async (ctx, { id }) => {
    const r = await ctx.db.get(id);
    if (!r) throw Error("Reminder unavailable.");
    await staff(ctx, r.ownerId);
    await ctx.db.patch(id, { read: true });
  },
});
export const clientReminders = query({
  args: {
    businessId: v.id("businesses"),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, a) => {
    await portalAccess(ctx, a.businessId);
    return ctx.db
      .query("practiceReminders")
      .withIndex("by_business", (q) => q.eq("businessId", a.businessId))
      .order("desc")
      .paginate(a.paginationOpts);
  },
});
export const draftContext = internalQuery({
  args: { ...ownerArgs, businessId: v.optional(v.id("businesses")) },
  handler: async (ctx, a) => {
    const { actor } = await staff(ctx, a.ownerId);
    if (a.businessId) {
      const b = await ctx.db.get(a.businessId);
      if (b?.userId !== a.ownerId) throw Error("Client unavailable.");
    }
    return { actorId: actor._id };
  },
});
export const saveDraft = internalMutation({
  args: {
    ...ownerArgs,
    businessId: v.optional(v.id("businesses")),
    kind: v.string(),
    payload: v.any(),
  },
  handler: async (ctx, a) => {
    const { actor } = await staff(ctx, a.ownerId);
    if (
      ![
        "lead",
        "followup",
        "document_request",
        "message",
        "appointment",
        "filing_pack",
      ].includes(a.kind)
    )
      throw Error("Unsupported action.");
    return ctx.db.insert("practiceDrafts", {
      ...a,
      actorId: actor._id,
      status: "prepared",
      createdAt: Date.now(),
    });
  },
});
export const getDraft = query({
  args: { id: v.id("practiceDrafts") },
  handler: async (ctx, { id }) => {
    const { actor } = await getActor(ctx),
      d = await ctx.db.get(id);
    if (!d || d.actorId !== actor._id) throw Error("Draft unavailable.");
    await staff(ctx, d.ownerId);
    return d;
  },
});
export const discardDraft = mutation({
  args: { id: v.id("practiceDrafts") },
  handler: async (ctx, { id }) => {
    const { actor } = await getActor(ctx),
      d = await ctx.db.get(id);
    if (!d || d.actorId !== actor._id) throw Error("Draft unavailable.");
    if (d.status === "prepared")
      await ctx.db.patch(id, { status: "discarded" });
  },
});
export const approveDraft = mutation({
  args: { id: v.id("practiceDrafts"), confirmed: v.boolean() },
  handler: async (ctx, a) => {
    if (!a.confirmed) throw Error("Review and approve this action first.");
    const { actor } = await getActor(ctx),
      d = await ctx.db.get(a.id);
    if (!d || d.actorId !== actor._id) throw Error("Draft unavailable.");
    await staff(ctx, d.ownerId);
    if (d.status === "approved") return d.result;
    if (d.status !== "prepared" || Date.now() - d.createdAt > 3600000)
      throw Error("Draft expired or discarded. Prepare it again.");
    const p = d.payload;
    let result: any;
    if(d.kind==='filing_pack'){
      if(!d.businessId)throw Error('Select a client.');const b=await ctx.db.get(d.businessId);await requireBusinessAccess(ctx,b,'editPayroll');
      if(b!.userId!==d.ownerId||(b!.complianceRevision||0)!==p.sourceRevision)throw Error('Source records changed. Prepare and review the filing request again.');
      result=d._id;
    }
    else if (d.kind === "lead")
      result = await insertLead(ctx, d.ownerId, p, "Cayla");
    else if (d.kind === "followup")
      result = await addFollowup(ctx, d.ownerId, p);
    else if (d.kind === "appointment") {
      const profile = await ctx.db
        .query("practiceProfiles")
        .withIndex("by_owner", (q) => q.eq("ownerId", d.ownerId))
        .first();
      if (!profile?.published) throw Error("Publish a booking page first.");
      if (!Number.isFinite(p.startsAt))
        throw Error("Include a valid appointment time.");
      const times = await slotList(
        ctx,
        profile,
        p.serviceId,
        p.startsAt,
        p.startsAt + 4 * 3600000,
      );
      if (!times.includes(p.startsAt))
        throw Error("This appointment time is no longer available.");
      const service = profile.services.find((s) => s.id === p.serviceId)!;
      const leadId = await insertLead(ctx, d.ownerId, p, "Cayla");
      result = await ctx.db.insert("practiceAppointments", {
        ownerId: d.ownerId,
        leadId,
        serviceId: service.id,
        serviceName: service.name,
        startsAt: p.startsAt,
        endsAt: p.startsAt + service.duration * 60000,
        status: "booked",
        name: cleanText(p.name, 120),
        email: cleanText(p.email, 254).toLowerCase(),
        notes: cleanText(p.notes || ""),
        createdAt: Date.now(),
      });
      const reminderJob = await ctx.scheduler.runAt(
        Math.max(Date.now(), p.startsAt - 3600000),
        api.practice.appointmentReminder,
        { id: result },
      );
      await ctx.db.patch(result, { reminderJob });
    } else if (d.businessId) {
      const b = await ctx.db.get(d.businessId);
      if (b?.userId !== d.ownerId) throw Error("Client unavailable.");
      if (d.kind === "document_request")
        result = await addRequest(ctx, d.businessId, p);
      else if (d.kind === "message")
        result = await insertMessage(ctx, d.businessId, p.text);
    }
    if (!result)
      throw Error("Select a client and provide all required details.");
    await ctx.db.patch(d._id, { status: "approved", result: String(result) });
    await recordAccountantActivity(
      ctx,
      d.ownerId,
      actor._id,
      `Cayla approved ${d.kind}`,
      d.businessId,
    );
    return String(result);
  },
});
export const publicChatContext = internalMutation({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const p = await published(ctx, slug);
    await rate(ctx, `public-chat:${p.ownerId}`, 100);
    return {
      name: p.name,
      description: p.description,
      services: p.services,
      timezone: p.timezone,
      greeting: p.widgetGreeting,
    };
  },
});

export const prepareContext = internalMutation({
  args: { ...ownerArgs, businessId: v.optional(v.id("businesses")) },
  handler: async (ctx, a) => {
    const { actor } = await staff(ctx, a.ownerId);
    if (a.businessId) {
      const b = await ctx.db.get(a.businessId);
      if (b?.userId !== a.ownerId) throw Error("Client unavailable.");
    }
    await rate(ctx, `cayla-practice:${actor._id}`, 30);
    const p = await ctx.db
      .query("practiceProfiles")
      .withIndex("by_owner", (q) => q.eq("ownerId", a.ownerId))
      .first();
    return { services: p?.services || [], timezone: p?.timezone || "UTC" };
  },
});

export const expireThrottle = internalMutation({
  args: { id: v.id("practiceThrottle"), window: v.number() },
  handler: async (ctx, a) => {
    const r = await ctx.db.get(a.id);
    if (r?.window === a.window) await ctx.db.delete(a.id);
  },
});

export const recordFilingResult=mutation({args:{id:v.id('practiceDrafts'),generationId:v.id('complianceGenerations')},handler:async(ctx,a)=>{
 const {actor}=await getActor(ctx),d=await ctx.db.get(a.id),g=await ctx.db.get(a.generationId);if(!d||d.actorId!==actor._id||d.kind!=='filing_pack'||d.status!=='approved'||!g||g.businessId!==d.businessId)throw Error('Filing draft unavailable.');await requireBusinessAccess(ctx,await ctx.db.get(g.businessId),'editPayroll');await ctx.db.patch(d._id,{result:String(g._id)});
}});
