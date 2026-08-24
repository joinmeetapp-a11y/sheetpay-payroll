/**
 * Sheetpay transactional email template registry.
 *
 * Every template is a pure function `(data) => { subject, html, preheader,
 * category }`. The `category` decides which notification-preference toggle can
 * silence it (`security` and `billing` critical types are always sent).
 */

import {
  APP_URL,
  BRAND,
  EmailAlert,
  EmailButton,
  EmailFallbackLink,
  EmailFooter,
  EmailHeading,
  EmailInfoCard,
  EmailLayout,
  EmailParagraph,
  EmailStats,
  PayrollSummary,
  SecurityNotice,
  esc,
} from "./emailComponents";

export type EmailCategory =
  | "payroll"
  | "payslip"
  | "team"
  | "import"
  | "billing"
  | "security"
  | "product"
  | "account";

export interface RenderedEmail {
  subject: string;
  html: string;
  preheader: string;
  category: EmailCategory;
  /** true → cannot be disabled by preferences (security / critical billing). */
  critical: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Individual template renderers.
// Each is dead-simple to keep them auditable and portable.
// ─────────────────────────────────────────────────────────────────────────────

function tmplWelcome(data: any): RenderedEmail {
  const name = esc(data.displayName || "there");
  const content =
    `<div style="text-align:center;margin-bottom:32px;">` +
    `<div style="font-size:48px;margin-bottom:16px;">🎉</div>` +
    EmailHeading(`Welcome to Sheetpay, ${name}!`) +
    EmailParagraph(
      `Your AI-powered payroll workspace is ready. Cayla is standing by to run payroll, generate payslips, and keep your team paid on time.`
    ) +
    EmailButton("Finish company setup", `${APP_URL}/onboarding`) +
    EmailFallbackLink(`${APP_URL}/onboarding`) +
    `</div>` +
    EmailStats([
      ["AI Payroll", "Cayla"],
      ["Region", "Caribbean"],
      ["Tax Engine", "Auto"],
    ]);
  return {
    subject: "Welcome to Sheetpay",
    preheader: `Welcome, ${name}!`,
    html: EmailLayout({ content, preheader: `Welcome, ${name}!` }),
    category: "product",
    critical: false,
  };
}

function tmplVerification(data: any): RenderedEmail {
  const name = esc(data.displayName || "there");
  const link = data.verifyLink || `${APP_URL}/verify`;
  const content =
    EmailHeading("Verify your email") +
    EmailParagraph(`Hi ${name}, please verify your email to activate your Sheetpay account.`) +
    `<div style="text-align:center;margin:28px 0;">${EmailButton("Verify email address", link)}</div>` +
    EmailFallbackLink(link) +
    EmailParagraph(`If you did not create a Sheetpay account, please ignore this email.`);
  return {
    subject: "Verify your Sheetpay email address",
    preheader: "Verify your email",
    html: EmailLayout({ content, preheader: "Verify your email" }),
    category: "security",
    critical: true,
  };
}

function tmplTeamInvite(data: any): RenderedEmail {
  const inviter = esc(data.inviterName || "Your administrator");
  const business = esc(data.businessName || "the team");
  const role = esc(data.role || "Team Member");
  const invitee = esc(data.inviteeEmail || "");
  const link = data.inviteLink || `${APP_URL}/invite/${esc(data.token || "")}`;
  const content =
    EmailAlert(
      "info",
      `${inviter} invited you to join <strong>${business}</strong>.`,
      "📨"
    ) +
    EmailHeading(`You're invited to join ${business} on Sheetpay`) +
    EmailParagraph(
      `Sheetpay is an AI-powered payroll platform for Caribbean and international businesses. Accept your invitation to collaborate on payroll, payslips, and statutory tax filings.`
    ) +
    EmailInfoCard([
      { label: "Business", value: data.businessName || "" },
      { label: "Invited by", value: data.inviterName || "" },
      { label: "Your email", value: data.inviteeEmail || "" },
      { label: "Role", value: data.role || "Team Member" },
    ]) +
    `<div style="text-align:center;margin:28px 0;">${EmailButton("Accept invitation", link)}</div>` +
    EmailFallbackLink(link) +
    EmailParagraph(
      `This invitation expires on <strong>${esc(data.expiresLabel || "in 7 days")}</strong>.`
    ) +
    SecurityNotice(
      `This invitation is bound to ${invitee}. Do not forward this email — anyone with the link could join your workspace.`
    );
  return {
    subject: `${data.inviterName || "Sheetpay"} invited you to ${data.businessName || "Sheetpay"}`,
    preheader: `Invited to ${data.businessName || "Sheetpay"}`,
    html: EmailLayout({ content, preheader: `Invited to ${data.businessName || "Sheetpay"}` }),
    category: "team",
    critical: false,
  };
}

function tmplInviteAccepted(data: any): RenderedEmail {
  const invitee = esc(data.inviteeName || data.inviteeEmail || "A new member");
  const business = esc(data.businessName || "your team");
  const content =
    EmailAlert("success", `${invitee} has joined <strong>${business}</strong>.`, "✅") +
    EmailHeading("New team member joined") +
    EmailParagraph(
      `${invitee} accepted their invitation and now has <strong>${esc(data.role || "team member")}</strong> access on Sheetpay.`
    ) +
    `<div style="text-align:center;margin:28px 0;">${EmailButton("Manage team", `${APP_URL}/settings/team`)}</div>`;
  return {
    subject: `${invitee} joined ${business} on Sheetpay`,
    preheader: `${invitee} accepted their invitation`,
    html: EmailLayout({ content, preheader: `${invitee} accepted their invitation` }),
    category: "team",
    critical: false,
  };
}

function tmplTeamMemberRemoved(data: any): RenderedEmail {
  const business = esc(data.businessName || "the workspace");
  const content =
    EmailAlert("warn", `Your access to ${business} was removed.`, "🚪") +
    EmailHeading("You were removed from a workspace") +
    EmailParagraph(
      `You no longer have access to <strong>${business}</strong> on Sheetpay. If you believe this was a mistake, please reach out to the workspace owner.`
    );
  return {
    subject: `You were removed from ${business}`,
    preheader: "Team membership ended",
    html: EmailLayout({ content, preheader: "Team membership ended" }),
    category: "team",
    critical: true,
  };
}

function tmplPayrollCompleted(data: any): RenderedEmail {
  const period = esc(data.period || "Current period");
  const currency = esc(data.currency || "TTD");
  const employees = Number(data.employeeCount || 0);
  const content =
    `<div style="text-align:center;margin-bottom:24px;"><div style="font-size:40px;margin-bottom:12px;">✅</div>` +
    EmailHeading(`Payroll completed for ${period}`) +
    EmailParagraph(`Your payroll for <strong>${period}</strong> has been finalized.`) +
    `</div>` +
    PayrollSummary({
      period: data.period || "Current period",
      employeeCount: employees,
      currency: data.currency || "TTD",
      totalGross: data.totalGross ?? "0.00",
      totalDeductions: data.totalDeductions ?? "0.00",
      totalNet: data.totalNet ?? "0.00",
    }) +
    `<div style="text-align:center;">${EmailButton("View payroll details", data.payrollLink || `${APP_URL}/app`)}</div>` +
    EmailFallbackLink(data.payrollLink || `${APP_URL}/app`);
  return {
    subject: `Payroll completed for ${data.period || "current period"}`,
    preheader: `${employees} employees paid — ${currency}`,
    html: EmailLayout({ content, preheader: `${employees} employees paid` }),
    category: "payroll",
    critical: false,
  };
}

function tmplPayrollRequiresAttention(data: any): RenderedEmail {
  const period = esc(data.period || "Current period");
  const reason = esc(data.reason || "One or more employees need attention before payroll can be processed.");
  const content =
    EmailAlert("warn", "Action required", "⚠️") +
    EmailHeading(`Payroll for ${period} needs your attention`) +
    EmailParagraph(reason) +
    `<div style="text-align:center;margin:28px 0;">${EmailButton("Resolve in Sheetpay", data.link || `${APP_URL}/app`)}</div>` +
    EmailFallbackLink(data.link || `${APP_URL}/app`);
  return {
    subject: `Action required: Payroll for ${data.period || "current period"}`,
    preheader: "Payroll needs your input",
    html: EmailLayout({ content, preheader: "Payroll needs your input" }),
    category: "payroll",
    critical: false,
  };
}

function tmplPayslipReady(data: any): RenderedEmail {
  const name = esc(data.employeeName || "there");
  const period = esc(data.period || "Current period");
  const business = data.businessName ? ` from <strong>${esc(data.businessName)}</strong>` : "";
  const content =
    `<div style="text-align:center;margin-bottom:24px;"><div style="font-size:40px;margin-bottom:12px;">📄</div>` +
    EmailHeading("Your payslip is ready") +
    `</div>` +
    EmailParagraph(`Hi ${name}, your payslip for <strong>${period}</strong>${business} is available in your Sheetpay portal.`) +
    `<div style="text-align:center;margin:28px 0;">${EmailButton("View my payslip", data.payslipLink || `${APP_URL}/portal`)}</div>` +
    EmailFallbackLink(data.payslipLink || `${APP_URL}/portal`) +
    SecurityNotice(`For your security, we don't include salary details in this email. View them behind login in your portal.`);
  return {
    subject: "Your payslip is ready",
    preheader: `${period} payslip available`,
    html: EmailLayout({ content, preheader: `${period} payslip available` }),
    category: "payslip",
    critical: false,
  };
}

function tmplPayslipDetailed(data: any): RenderedEmail {
  // Only used when the employer has explicitly opted into detailed payslip emails.
  const name = esc(data.employeeName || "Employee");
  const period = esc(data.period || "Current period");
  const business = esc(data.businessName || "");
  const currency = esc(data.currency || "TTD");
  const gross = esc(data.grossPay || "0.00");
  const net = esc(data.netPay || "0.00");
  const deductions: Array<{ label: string; amount: string }> = data.deductions || [];
  const rows = deductions
    .map(
      (d) =>
        `<tr><td style="padding:8px 0;border-bottom:1px solid ${BRAND.border};"><span style="font-size:12px;color:${BRAND.muted};">${esc(d.label)}</span></td>` +
        `<td align="right" style="padding:8px 0;border-bottom:1px solid ${BRAND.border};"><span style="font-size:12px;color:${BRAND.danger};">&minus; ${currency} ${esc(d.amount)}</span></td></tr>`
    )
    .join("");
  const content =
    `<div style="background:linear-gradient(135deg,${BRAND.primaryLight},${BRAND.surface});border:1px solid ${BRAND.primary}20;border-radius:16px;padding:24px;margin-bottom:28px;">` +
    `<div style="font-size:12px;font-weight:600;color:${BRAND.primary};margin-bottom:4px;">PAYSLIP — ${period}</div>` +
    `<div style="font-size:20px;font-weight:800;color:${BRAND.text};">${name}</div>` +
    (business ? `<div style="font-size:13px;color:${BRAND.muted};margin-top:2px;">${business}</div>` : "") +
    `</div>` +
    `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;">` +
    `<tr><td style="padding:10px 0;border-bottom:1px solid ${BRAND.border};"><span style="font-size:13px;color:${BRAND.muted};">Gross pay</span></td>` +
    `<td align="right" style="padding:10px 0;border-bottom:1px solid ${BRAND.border};"><span style="font-size:14px;font-weight:700;color:${BRAND.text};">${currency} ${gross}</span></td></tr>` +
    rows +
    `<tr><td style="padding:14px 0 0;"><span style="font-size:15px;font-weight:800;color:${BRAND.text};">Net pay</span></td>` +
    `<td align="right" style="padding:14px 0 0;"><span style="font-size:18px;font-weight:900;color:${BRAND.primary};">${currency} ${net}</span></td></tr>` +
    `</table>` +
    `<div style="text-align:center;">${EmailButton("Download full payslip", data.payslipLink || `${APP_URL}/portal`)}</div>`;
  return {
    subject: `Your payslip for ${data.period || "current period"}`,
    preheader: `${data.period || "Current period"} payslip`,
    html: EmailLayout({ content, preheader: `${data.period || "Current period"} payslip` }),
    category: "payslip",
    critical: false,
  };
}

function tmplPayslipsSent(data: any): RenderedEmail {
  const count = Number(data.count || 0);
  const period = esc(data.period || "current period");
  const content =
    EmailAlert("success", `${count} payslips delivered`, "📬") +
    EmailHeading("Payslips distributed") +
    EmailParagraph(
      `<strong>${esc(String(count))}</strong> employee payslips for <strong>${period}</strong> were sent successfully.`
    ) +
    `<div style="text-align:center;margin:28px 0;">${EmailButton("View delivery report", `${APP_URL}/payroll`)}</div>`;
  return {
    subject: `${count} payslips sent for ${data.period || "current period"}`,
    preheader: `${count} employees received payslips`,
    html: EmailLayout({ content, preheader: `${count} employees received payslips` }),
    category: "payroll",
    critical: false,
  };
}

function tmplPayslipDeliveryFailed(data: any): RenderedEmail {
  const failedList: string[] = Array.isArray(data.failedRecipients)
    ? data.failedRecipients
    : [];
  const list = failedList
    .slice(0, 10)
    .map((r) => `<li style="margin:4px 0;color:${BRAND.text};">${esc(r)}</li>`)
    .join("");
  const content =
    EmailAlert("danger", "Payslip delivery failed", "❌") +
    EmailHeading("Some payslips could not be delivered") +
    EmailParagraph(
      `${esc(String(failedList.length))} recipient${failedList.length === 1 ? "" : "s"} did not receive their payslip. Please review the addresses below and try again.`
    ) +
    (list
      ? `<ul style="padding:0 0 0 20px;margin:0 0 20px;font-size:13px;color:${BRAND.muted};">${list}</ul>`
      : "") +
    `<div style="text-align:center;margin:28px 0;">${EmailButton("Review delivery report", `${APP_URL}/payroll`)}</div>`;
  return {
    subject: "Action required: Payslip delivery issues",
    preheader: "Some payslips failed to deliver",
    html: EmailLayout({ content, preheader: "Some payslips failed to deliver" }),
    category: "payroll",
    critical: false,
  };
}

function tmplImportCompleted(data: any): RenderedEmail {
  const fileName = esc(data.fileName || "Payroll import");
  const employees = Number(data.employeesDetected || 0);
  const records = Number(data.recordsImported || 0);
  const needsReview = Number(data.needsReviewCount || 0);
  const content =
    EmailAlert("success", `Import complete: ${fileName}`, "📥") +
    EmailHeading("Your payroll import finished") +
    EmailStats([
      ["Employees", String(employees)],
      ["Records", String(records)],
      ["Needs review", String(needsReview)],
    ]) +
    `<div style="text-align:center;margin:28px 0;">${EmailButton("Open Sheetpay", `${APP_URL}/app`)}</div>`;
  return {
    subject: `Payroll import completed: ${fileName}`,
    preheader: `${records} records imported`,
    html: EmailLayout({ content, preheader: `${records} records imported` }),
    category: "import",
    critical: false,
  };
}

function tmplImportRequiresReview(data: any): RenderedEmail {
  const fileName = esc(data.fileName || "Your import");
  const questions = Number(data.questionCount || 0);
  const content =
    EmailAlert("warn", "Import needs your review", "🔍") +
    EmailHeading(`${fileName} imported with ${questions} question${questions === 1 ? "" : "s"}`) +
    EmailParagraph(`Cayla detected fields that need your confirmation before finalizing the import.`) +
    `<div style="text-align:center;margin:28px 0;">${EmailButton("Review import", data.link || `${APP_URL}/app`)}</div>`;
  return {
    subject: "Payroll import requires your review",
    preheader: `${questions} questions need attention`,
    html: EmailLayout({ content, preheader: `${questions} questions need attention` }),
    category: "import",
    critical: false,
  };
}

function tmplEmployeeAdded(data: any): RenderedEmail {
  const name = esc(data.employeeName || "New employee");
  const content =
    EmailAlert("success", `${name} was added to your roster.`, "👤") +
    EmailHeading("New employee added") +
    EmailParagraph(`${name} now appears in your Sheetpay employee directory.`) +
    `<div style="text-align:center;margin:28px 0;">${EmailButton("Open roster", `${APP_URL}/employees`)}</div>`;
  return {
    subject: `${name} added to your team`,
    preheader: "Employee added",
    html: EmailLayout({ content, preheader: "Employee added" }),
    category: "team",
    critical: false,
  };
}

function tmplEmployeeInvited(data: any): RenderedEmail {
  const name = esc(data.employeeName || "there");
  const business = esc(data.businessName || "your employer");
  const link = data.portalLink || `${APP_URL}/portal`;
  const content =
    EmailHeading(`Hi ${name}, welcome to your Sheetpay portal`) +
    EmailParagraph(
      `${business} uses Sheetpay to run payroll. Activate your portal to view payslips, tax summaries, and pay history.`
    ) +
    `<div style="text-align:center;margin:28px 0;">${EmailButton("Activate my portal", link)}</div>` +
    EmailFallbackLink(link) +
    SecurityNotice(`Never share this link. Anyone with it can access your pay records.`);
  return {
    subject: `${business} invited you to your Sheetpay portal`,
    preheader: "Activate your Sheetpay employee portal",
    html: EmailLayout({ content, preheader: "Activate your Sheetpay employee portal" }),
    category: "team",
    critical: false,
  };
}

function tmplEmployeeProfileUpdated(data: any): RenderedEmail {
  const fieldList: string[] = Array.isArray(data.changedFields) ? data.changedFields : [];
  const fields = fieldList.map((f) => `<li>${esc(f)}</li>`).join("");
  const content =
    EmailAlert("info", "Your profile was updated", "🛡️") +
    EmailHeading("Employee profile updated") +
    EmailParagraph(`The following fields were changed on your Sheetpay profile:`) +
    (fields
      ? `<ul style="padding:0 0 0 20px;margin:0 0 20px;font-size:13px;color:${BRAND.muted};">${fields}</ul>`
      : "") +
    SecurityNotice(`If you did not authorize these changes, contact your employer and reach out to ${esc("support@sheetpay.app")}.`);
  return {
    subject: "Your Sheetpay profile was updated",
    preheader: "Profile change confirmation",
    html: EmailLayout({ content, preheader: "Profile change confirmation" }),
    category: "security",
    critical: true,
  };
}

function tmplCompanySetupComplete(data: any): RenderedEmail {
  const name = esc(data.displayName || "there");
  const business = esc(data.businessName || "your business");
  const content =
    `<div style="text-align:center;margin-bottom:24px;"><div style="font-size:40px;margin-bottom:12px;">🎉</div>` +
    EmailHeading("Your workspace is ready") +
    EmailParagraph(`${name}, ${business} is set up on Sheetpay. Cayla is standing by to run your first payroll whenever you're ready.`) +
    `<div style="text-align:center;">${EmailButton("Open workspace", `${APP_URL}/app`)}</div>` +
    `</div>`;
  return {
    subject: "Your Sheetpay workspace is ready",
    preheader: "Workspace ready",
    html: EmailLayout({ content, preheader: "Workspace ready" }),
    category: "product",
    critical: false,
  };
}

function tmplSubscriptionStarted(data: any): RenderedEmail {
  const plan = esc(data.planName || "Sheetpay Pro");
  const cur = esc(data.currency || "USD");
  const amount = esc(data.amount || "0.00");
  const billing = esc(data.billingPeriod || "monthly");
  const content =
    `<div style="text-align:center;margin-bottom:24px;"><div style="font-size:40px;margin-bottom:12px;">⭐</div>` +
    EmailHeading("Subscription confirmed") + `</div>` +
    EmailParagraph(`Your <strong>${plan}</strong> subscription is active. You're billed <strong>${cur} ${amount}</strong> ${billing}.`) +
    EmailInfoCard([
      { label: "Plan", value: data.planName || "Sheetpay Pro" },
      { label: "Billing", value: `${data.currency || "USD"} ${data.amount || "0.00"} / ${data.billingPeriod || "month"}` },
      { label: "Next invoice", value: data.nextInvoiceDate || "Managed by Paddle" },
    ]) +
    `<div style="text-align:center;margin:28px 0;">${EmailButton("Go to workspace", `${APP_URL}/app`)}</div>`;
  return {
    subject: `Your ${data.planName || "Sheetpay Pro"} subscription is active`,
    preheader: "Subscription confirmed",
    html: EmailLayout({ content, preheader: "Subscription confirmed" }),
    category: "billing",
    critical: false,
  };
}

function tmplSubscriptionUpgraded(data: any): RenderedEmail {
  const plan = esc(data.planName || "Sheetpay Pro");
  const content =
    `<div style="text-align:center;margin-bottom:24px;"><div style="font-size:48px;margin-bottom:12px;">🚀</div>` +
    EmailHeading(`You're now on ${plan}`) +
    EmailParagraph(`Your plan was upgraded. New features are available immediately.`) +
    `<div style="text-align:center;">${EmailButton("Explore new features", `${APP_URL}/app`)}</div></div>`;
  return {
    subject: `You're now on ${plan}`,
    preheader: `Upgraded to ${plan}`,
    html: EmailLayout({ content, preheader: `Upgraded to ${plan}` }),
    category: "billing",
    critical: false,
  };
}

function tmplSubscriptionDowngraded(data: any): RenderedEmail {
  const plan = esc(data.planName || "Sheetpay");
  const effective = esc(data.effectiveDate || "at the end of your current period");
  const content =
    EmailAlert("info", `Plan change confirmed`, "🔀") +
    EmailHeading(`Downgraded to ${plan}`) +
    EmailParagraph(`Your plan will change to <strong>${plan}</strong> ${effective}. All your data is preserved.`) +
    `<div style="text-align:center;margin:28px 0;">${EmailButton("Manage billing", `${APP_URL}/settings/billing`)}</div>`;
  return {
    subject: `Plan change confirmed: ${plan}`,
    preheader: "Plan change confirmed",
    html: EmailLayout({ content, preheader: "Plan change confirmed" }),
    category: "billing",
    critical: false,
  };
}

function tmplSubscriptionCancelled(data: any): RenderedEmail {
  const plan = esc(data.planName || "your Sheetpay plan");
  const accessUntil = esc(data.accessUntil || "the end of your billing period");
  const content =
    EmailAlert("warn", "Subscription cancelled", "🛑") +
    EmailHeading("We're sorry to see you go") +
    EmailParagraph(`Your <strong>${plan}</strong> subscription has been cancelled. You'll retain access until <strong>${accessUntil}</strong>.`) +
    `<div style="text-align:center;margin:28px 0;">${EmailButton("Reactivate anytime", `${APP_URL}/settings/billing`)}</div>`;
  return {
    subject: "Your Sheetpay subscription was cancelled",
    preheader: "Cancellation confirmed",
    html: EmailLayout({ content, preheader: "Cancellation confirmed" }),
    category: "billing",
    critical: true,
  };
}

function tmplPaymentReceipt(data: any): RenderedEmail {
  const cur = esc(data.currency || "USD");
  const amount = esc(data.amount || "0.00");
  const date = esc(data.date || new Date().toDateString());
  const desc = esc(data.description || "Sheetpay subscription");
  const content =
    EmailHeading("Payment received") +
    EmailInfoCard([
      { label: "Description", value: data.description || "Sheetpay subscription" },
      { label: "Date", value: data.date || new Date().toDateString() },
      { label: "Amount", value: `${data.currency || "USD"} ${data.amount || "0.00"}` },
    ]) +
    EmailParagraph(`Paddle handles the official tax invoice — this is your Sheetpay confirmation.`);
  return {
    subject: `Payment receipt — ${cur} ${amount}`,
    preheader: `Receipt: ${cur} ${amount}`,
    html: EmailLayout({ content, preheader: `Receipt: ${cur} ${amount}` }),
    category: "billing",
    critical: false,
  };
}

function tmplPaymentFailed(data: any): RenderedEmail {
  const cur = esc(data.currency || "USD");
  const amount = esc(data.amount || "0.00");
  const reason = esc(data.reason || "Your card was declined");
  const content =
    EmailAlert("danger", "Payment failed", "💳") +
    EmailHeading("We couldn't process your payment") +
    EmailParagraph(`We were unable to charge <strong>${cur} ${amount}</strong>. Reason: ${reason}.`) +
    `<div style="text-align:center;margin:28px 0;">${EmailButton("Update billing information", `${APP_URL}/settings/billing`)}</div>` +
    EmailParagraph(`We'll retry automatically over the next few days. Please update your payment method to avoid any disruption.`);
  return {
    subject: "Action required: Payment failed",
    preheader: "Payment failed",
    html: EmailLayout({ content, preheader: "Payment failed" }),
    category: "billing",
    critical: true,
  };
}

function tmplTrialEnding(data: any): RenderedEmail {
  const days = data.daysLeft != null ? Number(data.daysLeft) : 3;
  const plural = days !== 1 ? "s" : "";
  const link = data.upgradeLink || `${APP_URL}/settings/billing`;
  const content =
    EmailAlert("warn", "Trial ending soon", "⏰") +
    EmailHeading(`${days} day${plural} left on your trial`) +
    EmailParagraph(`Upgrade now to keep Cayla AI, unlimited employees, and automated payslip delivery. Your data is preserved.`) +
    `<div style="text-align:center;margin:28px 0;">${EmailButton("Upgrade to Pro", link)}</div>` +
    EmailFallbackLink(link);
  return {
    subject: `Your Sheetpay trial ends in ${days} day${plural}`,
    preheader: `Trial ends in ${days} day${plural}`,
    html: EmailLayout({ content, preheader: `Trial ends in ${days} day${plural}` }),
    category: "billing",
    critical: false,
  };
}

function tmplUsageLimitWarning(data: any): RenderedEmail {
  const feature = esc(data.feature || "employees");
  const used = esc(String(data.used ?? 0));
  const limit = esc(String(data.limit ?? 0));
  const content =
    EmailAlert("warn", `Approaching your ${feature} limit`, "📈") +
    EmailHeading(`You're at ${used} of ${limit} ${feature}`) +
    EmailParagraph(`Upgrade your plan to keep adding without interruption.`) +
    `<div style="text-align:center;margin:28px 0;">${EmailButton("Upgrade plan", `${APP_URL}/settings/billing`)}</div>`;
  return {
    subject: `Approaching your Sheetpay ${feature} limit`,
    preheader: `${used}/${limit} ${feature} used`,
    html: EmailLayout({ content, preheader: `${used}/${limit} ${feature} used` }),
    category: "billing",
    critical: false,
  };
}

function tmplSecurity(data: any): RenderedEmail {
  const ev = esc(data.eventType || "sign-in");
  const loc = esc(data.location || "Unknown location");
  const dev = esc(data.device || "Unknown device");
  const ts = esc(data.timestamp || new Date().toUTCString());
  const content =
    EmailAlert("danger", "Security notification", "🛡️") +
    EmailHeading(`New ${ev} detected`) +
    EmailParagraph(`A new ${ev} was detected on your Sheetpay account.`) +
    EmailInfoCard([
      { label: "Event", value: data.eventType || "sign-in" },
      { label: "When", value: data.timestamp || new Date().toUTCString() },
      { label: "Location", value: data.location || "Unknown location" },
      { label: "Device", value: data.device || "Unknown device" },
    ]) +
    `<div style="text-align:center;margin:28px 0;">${EmailButton("Secure my account", `${APP_URL}/settings/security`)}</div>` +
    SecurityNotice(`If this wasn't you, change your password immediately and contact support@sheetpay.app.`);
  return {
    subject: `Security alert: ${data.eventType || "sign-in"} on your account`,
    preheader: `Security alert: ${data.eventType || "sign-in"}`,
    html: EmailLayout({ content, preheader: `Security alert: ${data.eventType || "sign-in"}` }),
    category: "security",
    critical: true,
  };
}

function tmplAccountDeletionRequested(data: any): RenderedEmail {
  const when = esc(data.effectiveDate || "in 30 days");
  const content =
    EmailAlert("warn", "Account deletion requested", "⚠️") +
    EmailHeading("We received your deletion request") +
    EmailParagraph(`Your Sheetpay account is scheduled for deletion <strong>${when}</strong>. Cancel any time before then to keep your data.`) +
    `<div style="text-align:center;margin:28px 0;">${EmailButton("Cancel deletion", `${APP_URL}/settings/account`)}</div>`;
  return {
    subject: "Sheetpay account deletion requested",
    preheader: "Account deletion pending",
    html: EmailLayout({ content, preheader: "Account deletion pending" }),
    category: "security",
    critical: true,
  };
}

function tmplAccountDeleted(_data: any): RenderedEmail {
  const content =
    EmailHeading("Your Sheetpay account was deleted") +
    EmailParagraph(`All personal data associated with your account has been removed from Sheetpay systems. Thanks for using Sheetpay — we hope to see you again.`);
  return {
    subject: "Your Sheetpay account was deleted",
    preheader: "Account deleted",
    html: EmailLayout({ content, preheader: "Account deleted" }),
    category: "security",
    critical: true,
  };
}

function tmplExportReady(data: any): RenderedEmail {
  const kind = esc(data.exportType || "Payroll export");
  const link = data.downloadLink || `${APP_URL}/exports`;
  const content =
    EmailAlert("success", `${kind} is ready`, "📦") +
    EmailHeading("Your export is ready to download") +
    EmailParagraph(`${kind} finished processing and is available in your Sheetpay workspace.`) +
    `<div style="text-align:center;margin:28px 0;">${EmailButton("Download export", link)}</div>` +
    EmailFallbackLink(link);
  return {
    subject: `${kind} — download ready`,
    preheader: `${kind} ready`,
    html: EmailLayout({ content, preheader: `${kind} ready` }),
    category: "product",
    critical: false,
  };
}

function tmplTaxFormReady(data: any): RenderedEmail {
  const formName = esc(data.formName || "Tax form");
  const period = esc(data.period || "Current period");
  const content =
    EmailAlert("success", `${formName} generated`, "🧾") +
    EmailHeading(`${formName} for ${period} is ready`) +
    EmailParagraph(`Your statutory ${formName} was generated by Sheetpay and is ready to download.`) +
    `<div style="text-align:center;margin:28px 0;">${EmailButton("Open form", data.link || `${APP_URL}/tax-forms`)}</div>`;
  return {
    subject: `${formName} for ${data.period || "current period"} is ready`,
    preheader: `${formName} ready`,
    html: EmailLayout({ content, preheader: `${formName} ready` }),
    category: "payroll",
    critical: false,
  };
}

function tmplCaylaAction(data: any): RenderedEmail {
  const action = esc(data.action || "action");
  const summary = esc(data.summary || "Cayla completed an important action on your behalf.");
  const content =
    EmailAlert("info", "Cayla completed an action", "🤖") +
    EmailHeading(`Cayla: ${action}`) +
    EmailParagraph(summary) +
    `<div style="text-align:center;margin:28px 0;">${EmailButton("Review in Sheetpay", data.link || `${APP_URL}/app`)}</div>`;
  return {
    subject: `Cayla: ${data.action || "action completed"}`,
    preheader: `Cayla ${data.action || "action"}`,
    html: EmailLayout({ content, preheader: `Cayla ${data.action || "action"}` }),
    category: "payroll",
    critical: false,
  };
}

function tmplPasswordReset(data: any): RenderedEmail {
  const link = data.resetLink || `${APP_URL}/reset`;
  const content =
    `<div style="text-align:center;margin-bottom:24px;">` +
    `<div style="width:60px;height:60px;background:${BRAND.primaryLight};border-radius:50%;margin:0 auto 16px;text-align:center;line-height:60px;font-size:28px;">🔐</div>` +
    EmailHeading("Reset your password") + `</div>` +
    EmailParagraph(`Click the button below to reset your Sheetpay password. This link expires in 1 hour.`) +
    `<div style="text-align:center;margin:28px 0;">${EmailButton("Reset password", link)}</div>` +
    EmailFallbackLink(link) +
    SecurityNotice(`If you didn't request a reset, you can safely ignore this email. Your password will not change.`);
  return {
    subject: "Reset your Sheetpay password",
    preheader: "Reset your password",
    html: EmailLayout({ content, preheader: "Reset your password" }),
    category: "security",
    critical: true,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Registry + dispatcher.
// ─────────────────────────────────────────────────────────────────────────────
export const EMAIL_TEMPLATES = {
  welcome: tmplWelcome,
  verification: tmplVerification,
  passwordReset: tmplPasswordReset,
  teamInvite: tmplTeamInvite,
  teamInviteAccepted: tmplInviteAccepted,
  teamMemberRemoved: tmplTeamMemberRemoved,
  payrollCompleted: tmplPayrollCompleted,
  payrollRequiresAttention: tmplPayrollRequiresAttention,
  payslipReady: tmplPayslipReady,
  payslipDetailed: tmplPayslipDetailed,
  payslipsSent: tmplPayslipsSent,
  payslipDeliveryFailed: tmplPayslipDeliveryFailed,
  importCompleted: tmplImportCompleted,
  importRequiresReview: tmplImportRequiresReview,
  employeeAdded: tmplEmployeeAdded,
  employeeInvited: tmplEmployeeInvited,
  employeeProfileUpdated: tmplEmployeeProfileUpdated,
  companySetupComplete: tmplCompanySetupComplete,
  subscriptionStarted: tmplSubscriptionStarted,
  subscriptionUpgraded: tmplSubscriptionUpgraded,
  subscriptionDowngraded: tmplSubscriptionDowngraded,
  subscriptionCancelled: tmplSubscriptionCancelled,
  paymentReceipt: tmplPaymentReceipt,
  paymentFailed: tmplPaymentFailed,
  trialEnding: tmplTrialEnding,
  usageLimitWarning: tmplUsageLimitWarning,
  security: tmplSecurity,
  accountDeletionRequested: tmplAccountDeletionRequested,
  accountDeleted: tmplAccountDeleted,
  exportReady: tmplExportReady,
  taxFormReady: tmplTaxFormReady,
  caylaAction: tmplCaylaAction,
} as const;

export type TemplateKey = keyof typeof EMAIL_TEMPLATES;

/** Aliases so existing callers (`employeePayslip`, `payrollComplete`, …) continue to work. */
const ALIASES: Record<string, TemplateKey> = {
  employeePayslip: "payslipDetailed",
  payslipGenerated: "payslipReady",
  payrollComplete: "payrollCompleted",
  payrollReminder: "payrollRequiresAttention",
  payrollApproval: "payrollRequiresAttention",
  failedPayroll: "payrollRequiresAttention",
  subscriptionConfirm: "subscriptionStarted",
  accountUpgrade: "subscriptionUpgraded",
  failedPayment: "paymentFailed",
  caylaAlert: "caylaAction",
  clientInvite: "teamInvite",
};

/** Render a template by key. Unknown keys fall back to a generic notification. */
export function renderTemplate(key: string, data: any): RenderedEmail {
  const resolved = (EMAIL_TEMPLATES as Record<string, (d: any) => RenderedEmail>)[key];
  if (resolved) return resolved(data || {});
  const aliased = ALIASES[key];
  if (aliased) return EMAIL_TEMPLATES[aliased](data || {});
  // Generic fallback
  const content =
    EmailHeading("Notification from Sheetpay") +
    EmailParagraph(esc(data?.message || "You have a new notification from Sheetpay.")) +
    `<div style="text-align:center;margin:28px 0;">${EmailButton("Open Sheetpay", APP_URL)}</div>`;
  return {
    subject: "Notification from Sheetpay",
    preheader: "Sheetpay notification",
    html: EmailLayout({ content, preheader: "Sheetpay notification" }),
    category: "product",
    critical: false,
  };
}
