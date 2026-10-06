export const ACTIONS = new Set(['upcoming', 'exceptions', 'prepare', 'payslips', 'emails', 'reminder', 'reminders', 'history', 'report', 'tax', 'help']);
export const DEFAULT_PREFERENCES = { voiceEnabled: true, autoTranscription: true, showExecutionPlan: true, requirePayslipApproval: true, requireEmailApproval: true, notifications: true };
export const DAY = 86400000;
export function validDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(value + 'T00:00:00Z');
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === value;
}
export function validatePeriod(start: string, end: string, pay: string) {
  if (![start, end, pay].every(validDate) || start > end || pay < start) throw new Error('Choose a valid payroll period and pay date.');
  if (Date.parse(end) - Date.parse(start) > 366 * DAY) throw new Error('Choose a payroll period of at most one year.');
}
export function localDate(now: number, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(now));
  const get = (name: string) => parts.find(p => p.type === name)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}
export function validateIntent(value: any, permitted: string[]) {
  if (!value || !ACTIONS.has(value.action) || !['current', 'all', 'due'].includes(value.scope) || !Array.isArray(value.clientIds)) throw new Error('Cayla could not understand a supported payroll action. Try a more specific instruction.');
  const keys = new Set(['action', 'scope', 'clientIds', 'dueFrom', 'dueTo', 'periodStart', 'periodEnd', 'payDate', 'daysBefore', 'clarification', 'target', 'exceptionFilter']);
  if (Object.keys(value).some(key => !keys.has(key))) throw new Error('Unsupported action arguments.');
  if (value.exceptionFilter != null && value.exceptionFilter !== 'missing_hours') throw new Error('Invalid exception filter.');
  if (value.target != null && !['client', 'employee', 'run'].includes(value.target)) throw new Error('Invalid contextual target.');
  if (value.clientIds.some((id: unknown) => typeof id !== 'string' || !permitted.includes(id))) throw new Error('Client access denied.');
  for (const key of ['dueFrom', 'dueTo', 'periodStart', 'periodEnd', 'payDate']) if (value[key] != null && !validDate(value[key])) throw new Error('Invalid payroll date.');
  if (value.daysBefore != null && (!Number.isInteger(value.daysBefore) || value.daysBefore < 0 || value.daysBefore > 30)) throw new Error('Choose a reminder 0 to 30 days before payday.');
  if (value.scope === 'due' && (!validDate(value.dueFrom) || !validDate(value.dueTo) || value.dueFrom > value.dueTo)) throw new Error('Specify when payroll is due.');
  if (value.clarification != null && (typeof value.clarification !== 'string' || value.clarification.length > 500)) throw new Error('Invalid clarification.');
  return value;
}
export function safeError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (/PLAN_LIMIT_REACHED|FREE_LIMIT_REACHED/.test(message)) return 'Your plan allowance has been reached. Open Upgrade to continue.';
  if (/Forbidden|PERMISSION|ACCESS|Unauthenticated/.test(message)) return 'Your current workspace access does not allow this operation.';
  return 'This operation could not finish. Your saved work is available for review or retry.';
}
export type Exception = { code: string; severity: 'INFO' | 'REVIEW' | 'BLOCKING'; message: string };
export function employeeExceptions(e: any, roster: any[], previous?: any): Exception[] {
  const issues: Exception[] = [];
  const add = (code: string, severity: Exception['severity'], message: string) => issues.push({ code, severity, message });
  if (!String(e.name || '').trim()) add('missing_name', 'BLOCKING', 'Employee name is missing.');
  if (!e.employeeId) add('missing_employee_id', 'REVIEW', 'Employee ID is missing.');
  const ids = e.payrollIdentifiers || {};
  if (![ids.primaryId, ids.taxId, ids.birNumber, ids.taxIdentificationNumber, ids.trn, ids.sin, ids.ssn, ids.tfn].some(Boolean)) add('missing_tax_id', 'REVIEW', 'Tax identifier needs review.');
  if (![ids.secondaryId, ids.nisNumber, ids.nationalInsuranceNumber, ids.socialSecurityNumber].some(Boolean)) add('missing_contribution_id', 'REVIEW', 'Contribution identifier needs review.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.email || '')) add('missing_email', 'INFO', 'An email address is needed for email delivery.');
  if (e.payType === 'hourly') {
    if (e.regularHours == null) add('missing_hours', 'BLOCKING', 'Regular hours are missing.');
    if (!(e.hourlyRate > 0)) add('missing_rate', 'BLOCKING', 'Hourly pay rate is missing.');
  } else if (e.payType === 'daily') add('missing_days', 'BLOCKING', 'Review daily earnings in the existing payroll editor before preparing this employee.');
  else if (!(e.basicPay > 0)) add('missing_pay', 'BLOCKING', 'Regular earnings need review.');
  for (const field of ['basicPay', 'overtimeHours', 'overtimeRate', 'bonus', 'commission', 'allowances', 'otherDeductions']) if (!Number.isFinite(e[field]) || e[field] < 0) add('invalid_' + field, 'BLOCKING', 'An earnings or deductions field is invalid.');
  if (e.regularHours != null && (!Number.isFinite(e.regularHours) || e.regularHours < 0)) add('invalid_hours', 'BLOCKING', 'Regular hours are invalid.');
  if (!['weekly', 'fortnightly', 'monthly'].includes(e.payFrequency)) add('invalid_frequency', 'BLOCKING', 'Review the employee payroll frequency.');
  if (e.overtimeHours > 0 && !(e.overtimeRate > 0)) add('missing_overtime_rate', 'BLOCKING', 'Overtime rate is missing.');
  if (e.overtimeHours > 40) add('high_overtime', 'REVIEW', 'Overtime exceeds 40 hours for this period; check it.');
  if (e.otherDeductions > e.basicPay * .5) add('unusual_deduction', 'REVIEW', 'Other deductions exceed half of regular earnings; check them.');
  if (roster.some(other => other._id !== e._id && (e.employeeId && other.employeeId === e.employeeId || e.email && other.email?.toLowerCase() === e.email.toLowerCase()))) add('duplicate_employee', 'REVIEW', 'An employee ID or email occurs more than once.');
  if (/ignore.{0,30}instructions|system\s*prompt|send.{0,20}(secret|credentials)|override.{0,20}approval/i.test(e.name)) add('untrusted_text', 'REVIEW', 'Imported text needs review. It is treated only as data.');
  if (String(e.status).toLowerCase().includes('review')) add('import_review', 'REVIEW', 'The saved employee record is marked for review.');
  if (previous && previous.grossPay > 0 && Math.abs(e.grossPay - previous.grossPay) / previous.grossPay > .2) add('pay_change', 'REVIEW', 'Gross pay differs by more than 20% from the previous payroll.');
  return issues;
}
export async function fingerprint(value: unknown) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(value)));
  return Array.from(new Uint8Array(digest)).map(x => x.toString(16).padStart(2, '0')).join('');
}
