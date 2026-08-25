/**
 * Product event tracking for Google Analytics (gtag).
 *
 * The gtag script is injected in index.html. This module wraps it with a
 * strict event vocabulary so we don't scatter magic strings across the app.
 *
 * Events map to what the admin dashboard reads back from the GA Data API.
 */

type ProductEvent =
  | "sign_up"
  | "onboarding_completed"
  | "employee_created"
  | "payroll_started"
  | "payroll_completed"
  | "payslip_generated"
  | "cayla_opened"
  | "cayla_payroll_completed"
  | "ocr_completed"
  | "checkout_started"
  | "subscription_started"
  | "subscription_canceled";

declare global {
  interface Window {
    gtag?: (command: string, event: string, params?: Record<string, unknown>) => void;
  }
}

export function trackEvent(event: ProductEvent, params?: Record<string, unknown>): void {
  if (typeof window === "undefined" || typeof window.gtag !== "function") return;
  window.gtag("event", event, params);
}

/**
 * Convenience helper for attaching a stable user id to every event dispatched
 * from this session. Call once right after the user signs in.
 */
export function identifyUser(uid: string): void {
  if (typeof window === "undefined" || typeof window.gtag !== "function") return;
  window.gtag("config", "G-WL7MPTEXNV", { user_id: uid });
}
