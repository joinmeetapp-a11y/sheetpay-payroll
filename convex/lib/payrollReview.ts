import { calculateStatutoryForBusiness } from '../countryPayroll';
import { accountantGrossEarnings } from '../../shared/accountantEarnings';
import { employeeExceptions } from './caylaAgentPolicy';

export const payrollReviewFields = ['basicPay', 'regularHours', 'hourlyRate', 'overtimeHours', 'overtimeRate', 'bonus', 'commission', 'allowances', 'otherDeductions', 'paye', 'nis', 'healthSurcharge'];
export function validateReviewFields(fields: Record<string, unknown>) {
  for (const [key, value] of Object.entries(fields)) {
    if (!payrollReviewFields.includes(key) || typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1e9) throw new Error('Enter valid non-negative payroll amounts.');
  }
}

/** Reuse the existing deterministic statutory engine; edits affect only this proposal. */
export async function calculateReviewEmployee(ctx: any, business: any, employee: any, roster: any[], period: { start: string; end: string; payDate: string }, overrides: Record<string, number> = {}) {
  const e = { ...employee };
  for (const key of ['basicPay', 'overtimeHours', 'overtimeRate', 'bonus', 'commission', 'allowances', 'otherDeductions']) if (e[key] == null) e[key] = 0;
  const exceptions = employeeExceptions(e, roster);
  let snapshot: any;
  if (!exceptions.some(issue => issue.severity === 'BLOCKING')) {
    const base = e.payType === 'hourly' ? e.regularHours * e.hourlyRate : e.basicPay;
    const gross = Number(accountantGrossEarnings({ ...e, basicPay: base }).toFixed(2));
    if (!Number.isFinite(gross) || gross <= 0) exceptions.push({ code: 'invalid_gross', severity: 'BLOCKING', message: 'Calculated gross pay must be greater than zero.' });
    else {
      const result = await calculateStatutoryForBusiness(ctx, business, { grossIncome: gross, frequency: e.payFrequency, payDate: period.payDate, payPeriodStart: period.start, payPeriodEnd: period.end, otherDeductions: e.otherDeductions });
      if (!result.supported) exceptions.push({ code: 'statutory_unavailable', severity: 'BLOCKING', message: 'Automatic statutory calculation is unavailable for this country or tax year.' });
      else {
        const value = (...keys: string[]) => result.statutoryDeductions.filter((d: any) => keys.includes(d.key)).reduce((sum: number, d: any) => sum + d.amount, 0);
        const automatic = { paye: value('paye', 'income_tax'), nis: value('nis', 'nic', 'social_security'), healthSurcharge: value('health_surcharge') };
        const deductions = { ...automatic, ...overrides };
        const netPay = Number((gross - deductions.paye - deductions.nis - deductions.healthSurcharge - e.otherDeductions).toFixed(2));
        snapshot = { ...Object.fromEntries(Object.entries(e).filter(([key]) => !['_creationTime', 'statutoryData', 'reviewStatus', 'exceptions'].includes(key))), basicPay: base, grossPay: gross, netPay, ...deductions,
          periodLabel: `${period.start} to ${period.end}`, payDate: period.payDate, payPeriodStart: period.start, payPeriodEnd: period.end,
          statutoryOverrides: overrides, statutoryData: { items: [{ label: business.countryCode === 'BZ' ? 'Income Tax' : 'PAYE', amount: deductions.paye }, { label: business.countryCode === 'LC' ? 'NIC' : business.countryCode === 'BZ' ? 'Social Security' : 'NIS', amount: deductions.nis }, { label: 'Health surcharge', amount: deductions.healthSurcharge }], automatic, breakdown: result.calculationBreakdown, ruleVersion: result.ruleVersion, source: result.source } };
        if (netPay < 0) exceptions.push({ code: 'negative_net', severity: 'BLOCKING', message: 'Deductions exceed calculated earnings.' });
        if (Object.keys(overrides).length) exceptions.push({ code: 'manual_statutory', severity: 'REVIEW', message: 'Statutory amounts were manually edited. Check them before approval.' });
      }
    }
  }
  return { snapshot, exceptions, status: exceptions.some(issue => issue.severity === 'BLOCKING') ? 'blocking' : exceptions.some(issue => issue.severity === 'REVIEW') ? 'review' : 'ready' };
}
