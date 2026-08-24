/**
 * Admin allowlist (client-side). Users whose email is listed here get full
 * feature access and can reach the admin dashboard at /admin.
 *
 * NOTE: this only controls UI gating. The authoritative check also runs in
 * Convex (convex/admin.ts) so analytics data is never returned to non-admins.
 */
export const ADMIN_EMAILS = ['antoniokurt23@gmail.com'];

export function isAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.map((e) => e.toLowerCase()).includes(email.toLowerCase());
}
