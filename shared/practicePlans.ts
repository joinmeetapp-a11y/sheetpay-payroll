// Shared practice entitlement contract. Monthly allowances reset in UTC.
export const PRACTICE_FREE_LIMITS = { leads:10, appointments:5, followups:5, portalInvites:1, messages:20, documentRequests:3, uploads:5, widgetChats:10 } as const;
export type PracticeUsageKind = keyof typeof PRACTICE_FREE_LIMITS;
export const PRACTICE_LABELS: Record<PracticeUsageKind,string> = { leads:'CRM leads', appointments:'appointments', followups:'follow-ups', portalInvites:'client portal invitations', messages:'accountant chat messages', documentRequests:'document requests', uploads:'portal uploads', widgetChats:'widget chat requests' };
export const PRACTICE_FREE_LAYOUTS = { booking:'split', widget:'classic' } as const;
export function practiceFeatures(free:boolean) {
 return free ? ['Booking page · 1 layout · 3 services', 'Website widget · 1 style · 10 chat requests/month', 'CRM · 10 leads & 5 follow-ups/month', 'Appointments · 5 bookings/month', 'Client portal · 1 invitation/month', '20 accountant messages · 3 document requests · 5 uploads/month'] : ['Booking pages · all 6 layouts & custom branding', 'Website widget · all 6 styles & custom branding', 'CRM · leads, pipelines, notes & follow-ups', 'Appointments · bookings & reminders', 'Client portal · secure chat, requests & uploads', 'Practice features without Free monthly caps'];
}
