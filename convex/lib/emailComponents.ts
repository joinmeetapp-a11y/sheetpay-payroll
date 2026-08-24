/**
 * Reusable HTML "components" for Sheetpay transactional emails.
 * Every template composes these to keep visual consistency.
 *
 * Pure functions returning inline-styled HTML strings — deliberately no
 * dependency on any framework so they render identically in Gmail, Outlook,
 * Apple Mail, and Android.
 */

// ─── Brand tokens ────────────────────────────────────────────────────────────
export const BRAND = {
  primary: "#059669",
  primaryDark: "#047857",
  primaryLight: "#d1fae5",
  bg: "#f8fafc",
  surface: "#ffffff",
  text: "#0f172a",
  muted: "#64748b",
  border: "#e2e8f0",
  danger: "#dc2626",
  dangerBg: "#fef2f2",
  warn: "#92400e",
  warnBg: "#fef3c7",
  fontFamily:
    "'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
} as const;

export const APP_URL = "https://sheetpay.app";
export const SUPPORT_EMAIL = "support@sheetpay.app";

/** Escape user-supplied text before inserting it into HTML bodies. */
export function esc(input: string | number | null | undefined): string {
  if (input === null || input === undefined) return "";
  return String(input)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ─── EmailHeader ─────────────────────────────────────────────────────────────
export function EmailHeader(): string {
  return (
    `<td style="background:${BRAND.surface};padding:28px 40px 0;border-bottom:1px solid ${BRAND.border};">` +
    `<table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>` +
    `<td><div style="display:inline-flex;align-items:center;gap:10px;">` +
    `<div style="width:36px;height:36px;background:${BRAND.primary};border-radius:10px;display:inline-block;text-align:center;line-height:36px;">` +
    `<span style="color:#fff;font-size:18px;font-weight:900;">S</span></div>` +
    `<span style="font-size:18px;font-weight:800;color:${BRAND.text};letter-spacing:-0.3px;">Sheetpay</span>` +
    `</div></td>` +
    `<td align="right"><span style="font-size:11px;color:${BRAND.muted};font-weight:500;">Payroll made simpler.</span></td>` +
    `</tr></table>` +
    `<div style="height:1px;background:linear-gradient(90deg,${BRAND.primary},${BRAND.primaryLight});margin-top:20px;"></div>` +
    `</td>`
  );
}

// ─── EmailFooter ─────────────────────────────────────────────────────────────
export function EmailFooter(opts?: {
  unsubscribeUrl?: string;
  preferencesUrl?: string;
}): string {
  const year = new Date().getFullYear();
  const prefsLink = opts?.preferencesUrl || `${APP_URL}/settings/notifications`;
  const unsubLink = opts?.unsubscribeUrl;
  const links = [
    `<a href="${APP_URL}/help" style="color:${BRAND.muted};text-decoration:underline;">Help</a>`,
    `<a href="${APP_URL}/privacy" style="color:${BRAND.muted};text-decoration:underline;">Privacy</a>`,
    `<a href="${APP_URL}/terms" style="color:${BRAND.muted};text-decoration:underline;">Terms</a>`,
    `<a href="${esc(prefsLink)}" style="color:${BRAND.muted};text-decoration:underline;">Preferences</a>`,
  ];
  if (unsubLink) {
    links.push(
      `<a href="${esc(unsubLink)}" style="color:${BRAND.muted};text-decoration:underline;">Unsubscribe</a>`
    );
  }
  return (
    `<td style="padding:24px 40px;background:${BRAND.bg};border-top:1px solid ${BRAND.border};">` +
    `<p style="margin:0 0 6px;font-size:12px;color:${BRAND.text};text-align:center;font-weight:700;">Sheetpay</p>` +
    `<p style="margin:0 0 12px;font-size:11px;color:${BRAND.muted};text-align:center;">Payroll made simpler.</p>` +
    `<p style="margin:0 0 6px;font-size:11px;color:${BRAND.muted};text-align:center;">` +
    links.join(' &middot; ') +
    `</p>` +
    `<p style="margin:0;font-size:11px;color:${BRAND.muted};text-align:center;">&copy; ${year} Sheetpay &middot; <a href="${APP_URL}" style="color:${BRAND.primary};">sheetpay.app</a></p>` +
    `</td>`
  );
}

// ─── EmailLayout (the master wrapper) ────────────────────────────────────────
export function EmailLayout(opts: {
  preheader?: string;
  content: string;
  footer?: string;
}): string {
  const preheader = opts.preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;color:${BRAND.bg};">${esc(opts.preheader)}</div>`
    : "";
  const footer = opts.footer ?? EmailFooter();

  return (
    `<!DOCTYPE html><html lang="en"><head>` +
    `<meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>` +
    `<title>Sheetpay</title>` +
    `<style>body{margin:0;padding:0;background:${BRAND.bg};font-family:${BRAND.fontFamily};-webkit-font-smoothing:antialiased;}a{color:${BRAND.primary};text-decoration:none;}` +
    `@media(max-width:600px){.c{width:100%!important;border-radius:0!important;}.btn{width:100%!important;text-align:center!important;}}</style>` +
    `</head><body>` +
    preheader +
    `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${BRAND.bg};padding:40px 16px;">` +
    `<tr><td align="center">` +
    `<table class="c" width="560" cellpadding="0" cellspacing="0" border="0" style="background:${BRAND.surface};border-radius:20px;border:1px solid ${BRAND.border};overflow:hidden;">` +
    `<tr>${EmailHeader()}</tr>` +
    `<tr><td style="padding:36px 40px;">${opts.content}</td></tr>` +
    `<tr>${footer}</tr>` +
    `</table></td></tr></table>` +
    `</body></html>`
  );
}

// ─── EmailButton ─────────────────────────────────────────────────────────────
export function EmailButton(label: string, href: string): string {
  return (
    `<a class="btn" href="${esc(href)}" style="display:inline-block;background:${BRAND.primary};color:#fff;font-size:14px;font-weight:700;padding:14px 28px;border-radius:12px;text-decoration:none;">` +
    esc(label) +
    `</a>`
  );
}

/** Small secondary plain-text fallback link, shown under a primary CTA. */
export function EmailFallbackLink(href: string): string {
  return (
    `<p style="margin:12px 0 0;font-size:12px;color:${BRAND.muted};text-align:center;">Or copy this link: <a href="${esc(href)}" style="color:${BRAND.primary};word-break:break-all;">${esc(href)}</a></p>`
  );
}

// ─── EmailHeading / paragraph ────────────────────────────────────────────────
export function EmailHeading(text: string): string {
  return `<h2 style="margin:0 0 8px;font-size:22px;font-weight:800;color:${BRAND.text};letter-spacing:-0.4px;">${esc(text)}</h2>`;
}

export function EmailParagraph(html: string): string {
  // callers may pass safe HTML (e.g. <strong>); do not escape here
  return `<p style="margin:0 0 20px;font-size:14px;color:${BRAND.muted};line-height:1.7;">${html}</p>`;
}

// ─── EmailInfoCard ───────────────────────────────────────────────────────────
export function EmailInfoCard(items: Array<{ label: string; value: string }>): string {
  const rows = items
    .map(
      (item, i) =>
        `<tr><td style="padding:14px 20px;${i > 0 ? `border-top:1px solid ${BRAND.border};` : ""}">` +
        `<div style="font-size:12px;color:${BRAND.muted};font-weight:600;">${esc(item.label)}</div>` +
        `<div style="font-size:14px;color:${BRAND.text};font-weight:700;margin-top:2px;">${esc(item.value)}</div>` +
        `</td></tr>`
    )
    .join("");
  return (
    `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${BRAND.bg};border-radius:12px;border:1px solid ${BRAND.border};margin:12px 0 24px;">` +
    rows +
    `</table>`
  );
}

// ─── Stat pills row ──────────────────────────────────────────────────────────
export function EmailStats(items: Array<[string, string]>): string {
  const cells = items
    .map(
      ([label, value]) =>
        `<td style="padding:12px 16px;background:${BRAND.bg};border:1px solid ${BRAND.border};border-radius:12px;text-align:center;">` +
        `<div style="font-size:11px;color:${BRAND.muted};font-weight:600;margin-bottom:4px;">${esc(label)}</div>` +
        `<div style="font-size:18px;font-weight:800;color:${BRAND.text};">${esc(value)}</div>` +
        `</td>`
    )
    .join("");
  return `<table width="100%" cellpadding="8" cellspacing="8" border="0"><tr>${cells}</tr></table>`;
}

// ─── Alerts (info / warn / danger) ────────────────────────────────────────────
export function EmailAlert(kind: "info" | "warn" | "danger" | "success", text: string, icon = ""): string {
  const palette =
    kind === "danger"
      ? { fg: BRAND.danger, bg: BRAND.dangerBg }
      : kind === "warn"
      ? { fg: BRAND.warn, bg: BRAND.warnBg }
      : kind === "success"
      ? { fg: BRAND.primaryDark, bg: BRAND.primaryLight }
      : { fg: BRAND.primaryDark, bg: BRAND.primaryLight };
  return (
    `<div style="background:${palette.bg};border:1px solid ${palette.fg}26;border-radius:12px;padding:16px 20px;margin-bottom:24px;">` +
    `<p style="margin:0;font-size:13px;font-weight:700;color:${palette.fg};">${esc(icon)} ${text}</p>` +
    `</div>`
  );
}

// ─── SecurityNotice ──────────────────────────────────────────────────────────
export function SecurityNotice(text: string): string {
  return (
    `<div style="border:1px dashed ${BRAND.border};border-radius:12px;padding:14px 18px;margin-top:24px;background:${BRAND.bg};">` +
    `<p style="margin:0;font-size:12px;color:${BRAND.muted};line-height:1.6;">🔒 <strong style="color:${BRAND.text};">Security notice.</strong> ${text}</p>` +
    `</div>`
  );
}

// ─── PayrollSummary block ────────────────────────────────────────────────────
export function PayrollSummary(opts: {
  period: string;
  employeeCount: number;
  currency: string;
  totalGross: string | number;
  totalDeductions: string | number;
  totalNet: string | number;
}): string {
  const fmt = (v: string | number) =>
    typeof v === "number" ? v.toFixed(2) : String(v);
  return (
    `<div style="background:linear-gradient(135deg,${BRAND.primaryLight},${BRAND.surface});border:1px solid ${BRAND.primary}20;border-radius:16px;padding:24px;margin-bottom:24px;">` +
    `<div style="font-size:12px;font-weight:600;color:${BRAND.primary};margin-bottom:4px;">PAYROLL — ${esc(opts.period)}</div>` +
    `<div style="font-size:22px;font-weight:800;color:${BRAND.text};margin-bottom:16px;">${esc(String(opts.employeeCount))} employees paid</div>` +
    `<table width="100%" cellpadding="0" cellspacing="0" border="0">` +
    `<tr><td style="padding:8px 0;border-bottom:1px solid ${BRAND.border};"><span style="font-size:13px;color:${BRAND.muted};">Gross</span></td>` +
    `<td align="right" style="padding:8px 0;border-bottom:1px solid ${BRAND.border};"><span style="font-size:14px;font-weight:700;color:${BRAND.text};">${esc(opts.currency)} ${esc(fmt(opts.totalGross))}</span></td></tr>` +
    `<tr><td style="padding:8px 0;border-bottom:1px solid ${BRAND.border};"><span style="font-size:13px;color:${BRAND.muted};">Deductions</span></td>` +
    `<td align="right" style="padding:8px 0;border-bottom:1px solid ${BRAND.border};"><span style="font-size:14px;font-weight:700;color:${BRAND.danger};">&minus; ${esc(opts.currency)} ${esc(fmt(opts.totalDeductions))}</span></td></tr>` +
    `<tr><td style="padding:12px 0 0;"><span style="font-size:15px;font-weight:800;color:${BRAND.text};">Net Payroll</span></td>` +
    `<td align="right" style="padding:12px 0 0;"><span style="font-size:18px;font-weight:900;color:${BRAND.primary};">${esc(opts.currency)} ${esc(fmt(opts.totalNet))}</span></td></tr>` +
    `</table></div>`
  );
}
