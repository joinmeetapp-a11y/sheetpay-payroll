import { BaseTaxCalculationInput, NISCalculationResult, PAYECalculationResult, FullPayrollCalculationResult, PayFrequency } from '../types';
import { toMonthly, fromMonthly } from '../trinidad-and-tobago';

/**
 * Belize Social Security Board (SSB) & Belize Tax Service PAYE Tax Rules
 * Effective Tax Year: 2026
 * Official Source: Belize Social Security Board (SSB) & Belize Tax Service Department
 */
export const BZ_TAX_YEAR = 2026;
export const BZ_LAST_UPDATED = 'September 2026';
export const BZ_OFFICIAL_SOURCE = 'SSB contributions (https://socialsecurity.org.bz/contributions/) and Belize Tax Service Income and Business Tax Amendment Act 2024 (https://bts.gov.bz/wp-content/uploads/2025/02/Act-No.-40-of-2024-Income-and-Business-Tax-Amendment-Act-2024.pdf)';

interface SSBWeeklyBracket {
  minWeekly: number;
  maxWeekly: number;
  empWeekly: number;
  emprWeekly: number;
  totalWeekly: number;
}

const BZ_SSB_BRACKETS: SSBWeeklyBracket[] = [
  { minWeekly: 0, maxWeekly: 69.99, empWeekly: 0.88, emprWeekly: 3.98, totalWeekly: 4.86 },
  { minWeekly: 70, maxWeekly: 109.99, empWeekly: 2.25, emprWeekly: 5.85, totalWeekly: 8.10 },
  { minWeekly: 110, maxWeekly: 139.99, empWeekly: 3.44, emprWeekly: 7.81, totalWeekly: 11.25 },
  { minWeekly: 140, maxWeekly: 179.99, empWeekly: 4.80, emprWeekly: 9.60, totalWeekly: 14.40 },
  { minWeekly: 180, maxWeekly: 219.99, empWeekly: 6.40, emprWeekly: 11.60, totalWeekly: 18.00 },
  { minWeekly: 220, maxWeekly: 259.99, empWeekly: 8.16, emprWeekly: 13.44, totalWeekly: 21.60 },
  { minWeekly: 260, maxWeekly: 299.99, empWeekly: 10.08, emprWeekly: 15.12, totalWeekly: 25.20 },
  { minWeekly: 300, maxWeekly: 339.99, empWeekly: 12.16, emprWeekly: 16.64, totalWeekly: 28.80 },
  { minWeekly: 340, maxWeekly: 379.99, empWeekly: 14.40, emprWeekly: 18.00, totalWeekly: 32.40 },
  { minWeekly: 380, maxWeekly: 419.99, empWeekly: 16.80, emprWeekly: 19.20, totalWeekly: 36.00 },
  { minWeekly: 420, maxWeekly: 459.99, empWeekly: 19.36, emprWeekly: 20.24, totalWeekly: 39.60 },
  { minWeekly: 460, maxWeekly: 499.99, empWeekly: 20.00, emprWeekly: 23.20, totalWeekly: 43.20 },
  { minWeekly: 500, maxWeekly: 519.99, empWeekly: 20.40, emprWeekly: 24.48, totalWeekly: 44.88 },
  { minWeekly: 520, maxWeekly: Infinity, empWeekly: 21.84, emprWeekly: 24.96, totalWeekly: 46.80 },
];

/**
 * Calculates Belize Social Security Board (SSB) Contributions
 */
export function calculateBelizeSSB(input: BaseTaxCalculationInput): NISCalculationResult {
  const { grossIncome, frequency, taxYear = BZ_TAX_YEAR } = input;
  const monthlyGross = Math.max(0, toMonthly(grossIncome, frequency));
  const weeklyGross = (monthlyGross * 12) / 52;

  const bracket = BZ_SSB_BRACKETS.find(
    (b) => weeklyGross >= b.minWeekly && weeklyGross <= b.maxWeekly
  ) || BZ_SSB_BRACKETS[BZ_SSB_BRACKETS.length - 1];

  let employeeVal = 0;
  let employerVal = 0;
  let totalVal = 0;

  if (frequency === 'weekly') {
    employeeVal = bracket.empWeekly;
    employerVal = bracket.emprWeekly;
    totalVal = bracket.totalWeekly;
  } else if (frequency === 'fortnightly') {
    employeeVal = Number((bracket.empWeekly * 2).toFixed(2));
    employerVal = Number((bracket.emprWeekly * 2).toFixed(2));
    totalVal = Number((bracket.totalWeekly * 2).toFixed(2));
  } else if (frequency === 'semi-monthly') {
    employeeVal = Number(((bracket.empWeekly * 52) / 24).toFixed(2));
    employerVal = Number(((bracket.emprWeekly * 52) / 24).toFixed(2));
    totalVal = Number(((bracket.totalWeekly * 52) / 24).toFixed(2));
  } else if (frequency === 'annual') {
    employeeVal = Number((bracket.empWeekly * 52).toFixed(2));
    employerVal = Number((bracket.emprWeekly * 52).toFixed(2));
    totalVal = Number((bracket.totalWeekly * 52).toFixed(2));
  } else {
    // monthly
    employeeVal = Number(((bracket.empWeekly * 52) / 12).toFixed(2));
    employerVal = Number(((bracket.emprWeekly * 52) / 12).toFixed(2));
    totalVal = Number(((bracket.totalWeekly * 52) / 12).toFixed(2));
  }

  const insurableCeilingWeekly = 520;
  const insurableCeiling = frequency === 'weekly' ? insurableCeilingWeekly : frequency === 'fortnightly' ? insurableCeilingWeekly * 2 : frequency === 'semi-monthly' ? (insurableCeilingWeekly * 52) / 24 : frequency === 'annual' ? insurableCeilingWeekly * 52 : (insurableCeilingWeekly * 52) / 12;
  const insurableEarnings = Math.min(grossIncome, Number(insurableCeiling.toFixed(2)));

  const annualEstimateEmployee = Number((bracket.empWeekly * 52).toFixed(2));
  const annualEstimateEmployer = Number((bracket.emprWeekly * 52).toFixed(2));

  return {
    country: 'Belize',
    taxYear,
    frequency,
    grossIncome,
    insurableEarnings,
    employeeNIS: employeeVal,
    employerNIS: employerVal,
    totalNIS: totalVal,
    contributionClass: weeklyGross >= 520 ? 'Max Wage Tier (BZ$520+/wk)' : `Wage Tier BZ$${bracket.minWeekly} - BZ$${bracket.maxWeekly}/wk`,
    effectiveRateEmployee: grossIncome > 0 ? Number(((employeeVal / grossIncome) * 100).toFixed(2)) : 0,
    effectiveRateEmployer: grossIncome > 0 ? Number(((employerVal / grossIncome) * 100).toFixed(2)) : 0,
    annualEstimateEmployee,
    annualEstimateEmployer,
    annualEstimateTotal: Number((annualEstimateEmployee + annualEstimateEmployer).toFixed(2)),
    lastUpdated: BZ_LAST_UPDATED,
    notes: [
      'Belize Social Security (SSB) contributions are calculated from the statutory weekly wage bracket schedule.',
      `Max wage ceiling is BZ$520/week with max employee contribution BZ$21.84/week and employer BZ$24.96/week.`,
    ],
  };
}

/**
 * Calculates Belize Income Tax / PAYE
 */
export function calculateBelizeIncomeTax(input: BaseTaxCalculationInput): PAYECalculationResult {
  const { grossIncome, frequency, taxYear = BZ_TAX_YEAR, allowances = 0 } = input;
  const monthlyGross = toMonthly(grossIncome, frequency);
  const annualGross = monthlyGross * 12;

  // Resident employed person deduction under the 2024 amendment: BZ$20,000/year.
  const annualStandardExemption = 20000 + allowances;
  const monthlyPersonalAllowance = annualStandardExemption / 12;

  let annualTax = 0;
  let taxableAnnual = 0;
  let personalReliefCredit = 0;

  // Act No. 40 of 2024: resident employees earning BZ$29,000 or less are
  // exempt. For annual income above BZ$29,000, apply 25% to income above the
  // BZ$20,000 deduction, then the temporary credit tapers from BZ$2,250 to $0
  // between BZ$29,000 and BZ$32,000.
  if (annualGross > 29000) {
    taxableAnnual = Math.max(0, annualGross - annualStandardExemption);
    const taxBeforeCredit = taxableAnnual * 0.25;
    personalReliefCredit = annualGross <= 32000
      ? Math.max(0, 2250 - 0.75 * (annualGross - 29000))
      : 0;
    annualTax = Number(Math.max(0, taxBeforeCredit - personalReliefCredit).toFixed(2));
  }

  const monthlyTax = Number((annualTax / 12).toFixed(2));
  const monthlyTaxable = Number((taxableAnnual / 12).toFixed(2));

  const payeForFrequency = Number(fromMonthly(monthlyTax, frequency).toFixed(2));
  const personalAllowanceForFreq = Number(fromMonthly(monthlyPersonalAllowance, frequency).toFixed(2));
  const taxableForFreq = Number(fromMonthly(monthlyTaxable, frequency).toFixed(2));

  return {
    country: 'Belize',
    taxYear,
    frequency,
    grossIncome,
    personalAllowance: personalAllowanceForFreq,
    statutoryReliefs: 0,
    taxableIncome: taxableForFreq,
    payeTax: payeForFrequency,
    effectiveTaxRate: grossIncome > 0 ? Number(((payeForFrequency / grossIncome) * 100).toFixed(2)) : 0,
    marginalTaxRate: annualGross > 29000 ? 25 : 0,
    annualTax,
    bracketsBreakdown: [
      {
        tier: annualGross <= 29000 ? 'Resident employee income up to BZ$29,000/year is exempt' : '25% over BZ$20,000/year deduction, less tapered BZ$2,250 credit from $29,000 to $32,000',
        rate: annualGross <= 29000 ? 0 : 0.25,
        taxableInTier: taxableForFreq,
        taxForTier: payeForFrequency,
      },
    ],
    lastUpdated: BZ_LAST_UPDATED,
    notes: [
      'Assumes the employee is resident in Belize. Resident employees earning BZ$29,000 or less annually are exempt under Act No. 40 of 2024.',
      'For income over BZ$29,000, the BZ$20,000 deduction applies and a BZ$2,250 tax credit tapers by 75% of income over BZ$29,000 through BZ$32,000.',
      'The SSB contribution component uses the published weekly wage-band schedule for employed persons.'
    ],
  };
}

/**
 * Calculates Full Belize Payroll & Take-Home Pay
 */
export function calculateBelizePayroll(input: BaseTaxCalculationInput): FullPayrollCalculationResult {
  const { grossIncome, frequency, taxYear = BZ_TAX_YEAR } = input;
  const ssb = calculateBelizeSSB(input);
  const paye = calculateBelizeIncomeTax(input);

  const totalEmployeeDeductions = Number((ssb.employeeNIS + paye.payeTax).toFixed(2));
  const totalEmployerContributions = Number(ssb.employerNIS.toFixed(2));
  const totalCostToEmployer = Number((grossIncome + totalEmployerContributions).toFixed(2));
  const netTakeHomePay = Math.max(0, Number((grossIncome - totalEmployeeDeductions).toFixed(2)));

  const monthlyGross = toMonthly(grossIncome, frequency);
  const annualGross = Number((monthlyGross * 12).toFixed(2));
  const annualNet = Number((toMonthly(netTakeHomePay, frequency) * 12).toFixed(2));

  return {
    country: 'Belize',
    countryName: 'Belize',
    countryCode: 'BZ',
    currency: 'BZD',
    currencySymbol: 'BZ$',
    taxYear,
    frequency,
    grossIncome,
    employeeNIS: ssb.employeeNIS,
    employerNIS: ssb.employerNIS,
    totalNIS: ssb.totalNIS,
    nisClass: ssb.contributionClass,
    insurableEarnings: ssb.insurableEarnings,
    healthSurcharge: 0,
    personalAllowance: paye.personalAllowance,
    taxableIncome: paye.taxableIncome,
    payeTax: paye.payeTax,
    totalEmployeeDeductions,
    totalEmployerContributions,
    totalCostToEmployer,
    netTakeHomePay,
    effectiveEmployeeDeductionRate: grossIncome > 0 ? Number(((totalEmployeeDeductions / grossIncome) * 100).toFixed(2)) : 0,
    annualGross,
    annualNet,
    annualPAYE: paye.annualTax,
    annualEmployeeNIS: ssb.annualEstimateEmployee,
    annualEmployerNIS: ssb.annualEstimateEmployer,
    lastUpdated: BZ_LAST_UPDATED,
    officialSource: BZ_OFFICIAL_SOURCE,
    notes: [
      ...ssb.notes,
      ...paye.notes,
    ],
  };
}
