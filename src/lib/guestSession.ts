/**
 * Guest funnel session id — opaque, sessionStorage-scoped. We deliberately
 * avoid localStorage so it does not survive across browser restarts by
 * default, and we never write payroll values to storage — those live in
 * Convex (see convex/guestDashboard.ts) with the id as the only key.
 */
const KEY = 'sheetpay_guest_session_id';

function makeId(): string {
  const rand =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().replace(/-/g, '')
      : Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
  return `gs_${Date.now().toString(36)}_${rand.slice(0, 20)}`;
}

export function getOrCreateGuestSessionId(): string {
  if (typeof window === 'undefined') return makeId();
  try {
    const existing = window.sessionStorage.getItem(KEY);
    if (existing && existing.startsWith('gs_')) return existing;
    const fresh = makeId();
    window.sessionStorage.setItem(KEY, fresh);
    return fresh;
  } catch {
    return makeId();
  }
}

export function clearGuestSessionId() {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

export const GUEST_LIMITS = {
  maxClients: 1,
  maxEmployees: 50,
  maxPayrollRuns: 1,
} as const;

export type GuestLockedAction =
  | 'add_client_2'
  | 'add_employee_51'
  | 'run_payroll_2'
  | 'download_payslip'
  | 'download_all_payslips'
  | 'print_payslip'
  | 'print_all_payslips'
  | 'whatsapp_share';
