import { BOOKING_DESIGNS, WIDGET_DESIGNS } from './practiceDesigns';
export const LEAD_STAGES = [
  "New",
  "Contacted",
  "Qualified",
  "Proposal",
  "Won",
  "Lost",
] as const;
export const DOCUMENT_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "text/csv",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
export function cleanText(value: string, max = 2000) {
  return value.trim().slice(0, max);
}
export function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;
}
export function validAsset(value: string) {
  if (!value) return true;
  try {
    const url = new URL(value);
    return url.protocol === "https:";
  } catch {
    return false;
  }
}
export function validateProfile(p: any) {
  if(p.bookingLayout!==undefined&&!BOOKING_DESIGNS.some(d=>d.id===p.bookingLayout)||p.widgetLayout!==undefined&&!WIDGET_DESIGNS.some(d=>d.id===p.widgetLayout))throw Error('Choose a supported booking page and widget design.');

  if (
    !/^[a-z0-9](?:[a-z0-9-]{1,58}[a-z0-9])$/.test(p.slug) ||
    ["admin", "accountant", "portal", "sheetpay", "support", "api"].includes(
      p.slug,
    )
  )
    throw Error(
      "Choose a unique link name using 3–60 lowercase letters, numbers or hyphens.",
    );
  if (
    !p.name.trim() ||
    p.name.length > 120 ||
    p.headline.length > 180 ||
    p.description.length > 3000
  )
    throw Error("Check business name, headline and description lengths.");
  if (
    !/^#[0-9a-f]{6}$/i.test(p.color) ||
    !validAsset(p.logo) ||
    !validAsset(p.cover)
  )
    throw Error("Choose a brand color and secure image URLs.");
  try {
    new Intl.DateTimeFormat("en", { timeZone: p.timezone }).format();
  } catch {
    throw Error("Choose a valid timezone.");
  }
  if (
    !["left", "right"].includes(p.widgetPosition) ||
    p.widgetGreeting.length > 500
  )
    throw Error("Invalid widget settings.");
  if (
    !p.services.length ||
    p.services.length > 20 ||
    new Set(p.services.map((s: any) => s.id)).size !== p.services.length
  )
    throw Error("Add 1–20 services with unique IDs.");
  for (const s of p.services)
    if (
      !/^[a-z0-9-]{1,60}$/.test(s.id) ||
      !s.name.trim() ||
      s.name.length > 120 ||
      s.description.length > 1000 ||
      s.price.length > 100 ||
      !Number.isInteger(s.duration) ||
      s.duration < 15 ||
      s.duration > 240 ||
      s.duration % 15
    )
      throw Error(
        "Services need a name and duration of 15–240 minutes in 15-minute steps.",
      );
  if (
    !p.availability.length ||
    p.availability.length > 7 ||
    new Set(p.availability.map((a: any) => a.day)).size !==
      p.availability.length
  )
    throw Error("Choose one availability window per open weekday.");
  for (const a of p.availability)
    if (
      !Number.isInteger(a.day) ||
      a.day < 0 ||
      a.day > 6 ||
      a.start < 0 ||
      a.end > 1440 ||
      a.end <= a.start ||
      a.start % 15 ||
      a.end % 15
    )
      throw Error("Check opening hours.");
  if (p.allowedOrigins.length > 20)
    throw Error("Add at most 20 website origins.");
  for (const origin of p.allowedOrigins) {
    const u = new URL(origin);
    if (u.protocol !== "https:" || u.origin !== origin)
      throw Error(
        "Widget websites must be HTTPS origins, for example https://example.com.",
      );
  }
}
/** Iterate real UTC instants, then match local wall time; this handles DST gaps safely. */
export function availableSlots(
  profile: any,
  serviceId: string,
  from: number,
  to: number,
  occupied: any[] = [],
) {
  const service = profile.services.find((s: any) => s.id === serviceId);
  if (!service) return [];
  const duration = service.duration * 60000;
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: profile.timezone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const slots: number[] = [];
  const capped = Math.min(to, from + 14 * 86400000);
  for (
    let t = Math.ceil(from / 900000) * 900000;
    t + duration <= capped;
    t += 900000
  ) {
    const parts = Object.fromEntries(
      formatter.formatToParts(t).map((p) => [p.type, p.value]),
    );
    const minute = Number(parts.hour) * 60 + Number(parts.minute);
    const day = days.indexOf(parts.weekday);
    const window = profile.availability.find((a: any) => a.day === day);
    if (
      !window ||
      minute < window.start ||
      minute + service.duration > window.end ||
      (minute - window.start) % service.duration
    )
      continue;
    const end = Object.fromEntries(
      formatter.formatToParts(t + duration - 1).map((p) => [p.type, p.value]),
    );
    if (
      end.weekday !== parts.weekday ||
      Number(end.hour) * 60 + Number(end.minute) !==
        minute + service.duration - 1
    )
      continue;
    if (
      !occupied.some(
        (a) =>
          a.status !== "cancelled" && a.startsAt < t + duration && a.endsAt > t,
      )
    )
      slots.push(t);
  }
  return slots;
}
