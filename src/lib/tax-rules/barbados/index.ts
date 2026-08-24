import { BaseTaxCalculationInput, NISCalculationResult, PAYECalculationResult, FullPayrollCalculationResult, PayFrequency } from '../types';
import { toMonthly, fromMonthly } from '../trinidad-and-tobago';

/**
 * Barbados National Insurance Scheme (NIS) & BRA PAYE Tax Rules
 * Effective Tax Year: 2026
 * Official Source: Barbados National Insurance Scheme (NIS) & Barbados Revenue Authority (BRA)
 */
export const BB_TAX_YEAR = 2026;
export const BB_LAST_UPDATED = 'August 2026';
export const BB_OFFICIAL_SOURCE = 'Barbados National Insurance Scheme (NIS) & Barbados Revenue Authority (BRA)';

// Maximum insurable earnings: $5,200/month ($1,200/week, $2,400/fortnight, $62,400/year)
const BB_MAX_INSURABLE_MONTHLY = 5200;
const BB_MAX_INSURABLE_WEEKLY = 1200;

// Statutory contribution rates
export const BB_NIS_RATES = {
  employee: 0.1110, // 11.10% total employee
  employer: 0.1275, // 12.75% total employer
  total: 0.2385,    // 23.85% total
};

/**
 * Calculates Barbados NIS Contributions
 */
export function calculateBarbadosNIS(input: BaseTaxCalculationInput): NISCalculationResult {
  const { grossIncome, frequency, taxYear = BB_TAX_YEAR } = input;
  const monthlyGross = Math.max(0, toMonthly(grossIncome, frequency));

  const maxInsurableForFreq = frequency === 'weekly' ? BB_MAX_INSURABLE_WEEKLY : frequency === 'fortnightly' ? BB_MAX_INSURABLE_WEEKLY * 2 : frequency === 'semi-monthly' ? BB_MAX_INSURABLE_MONTHLY / 2 : frequency === 'annual' ? BB_MAX_INSURABLE_MONTHLY * 12 : BB_MAX_INSURABLE_MONTHLY;

  const insurableEarnings = Math.min(grossIncome, maxInsurableForFreq);
  const employeeNIS = Number((insurableEarnings * BB_NIS_RATES.employee).toFixed(2));
  const employerNIS = Number((insurableEarnings * BB_NIS_RATES.employer).toFixed(2));
  const totalNIS = Number((employeeNIS + employerNIS).toFixed(2));

  const monthlyInsurable = Math.min(monthlyGross, BB_MAX_INSURABLE_MONTHLY);
  const annualEstimateEmployee = Number((monthlyInsurable * BB_NIS_RATES.employee * 12).toFixed(2));
  const annualEstimateEmployer = Number((monthlyInsurable * BB_NIS_RATES.employer * 12).toFixed(2));

  return {
    country: 'Barbados',
    taxYear,
    frequency,
    grossIncome,
    insurableEarnings,
    employeeNIS,
    employerNIS,
    totalNIS,
    contributionClass: grossIncome > maxInsurableForFreq ? 'Maximum Insurable Ceiling' : 'Standard Insurable Tier',
    effectiveRateEmployee: grossIncome > 0 ? Number(((employeeNIS / grossIncome) * 100).toFixed(2)) : 0,
    effectiveRateEmployer: grossIncome > 0 ? Number(((employerNIS / grossIncome) * 100).toFixed(2)) : 0,
    annualEstimateEmployee,
    annualEstimateEmployer,
    annualEstimateTotal: Number((annualEstimateEmployee + annualEstimateEmployer).toFixed(2)),
    lastUpdated: BB_LAST_UPDATED,
    notes: [
      'Employee NIS contribution is 11.10% (includes Catastrophe Fund, Severance, and Training levies).',
      'Employer NIS contribution is 12.75%.',
      `Maximum insurable earnings ceiling is BDS$${BB_MAX_INSURABLE_MONTHLY.toLocaleString()}/month (BDS$${BB_MAX_INSURABLE_WEEKLY.toLocaleString()}/week).`,
    ],
  };
}

/**
 * Calculates Barbados BRA PAYE Income Tax
 */
export function calculateBarbadosPAYE(input: BaseTaxCalculationInput): PAYECalculationResult {
  const { grossIncome, frequency, taxYear = BB_TAX_YEAR, allowances = 0 } = input;
  const monthlyGross = toMonthly(grossIncome, frequency);

  // Standard Personal Allowance: $25,000 / year ($2,083.33 / month)
  const annualPersonalAllowance = 25000 + allowances;
  const monthlyPersonalAllowance = annualPersonalAllowance / 12;

  const monthlyTaxable = Math.max(0, monthlyGross - monthlyPersonalAllowance);

  // Tax brackets on taxable income:
  // 12.5% on first $50,000 / year ($4,166.67 / month)
  // 28.5% on excess over $50,000 / year
  const monthlyTier1Cap = 50000 / 12; // 4166.67
  let monthlyTax = 0;
  let tier1Taxable = 0;
  let tier1Tax = 0;
  let tier2Taxable = 0;
  let tier2Tax = 0;

  if (monthlyTaxable > 0) {
    if (monthlyTaxable <= monthlyTier1Cap) {
      tier1Taxable = monthlyTaxable;
      tier1Tax = Number((tier1Taxable * 0.125).toFixed(2));
      monthlyTax = tier1Tax;
    } else {
      tier1Taxable = monthlyTier1Cap;
      tier1Tax = Number((tier1Taxable * 0.125).toFixed(2));
      tier2Taxable = monthlyTaxable - monthlyTier1Cap;
      tier2Tax = Number((tier2Taxable * 0.285).toFixed(2));
      monthlyTax = Number((tier1Tax + tier2Tax).toFixed(2));
    }
  }

  const payeForFrequency = Number(fromMonthly(monthlyTax, frequency).toFixed(2));
  const personalAllowanceForFreq = Number(fromMonthly(monthlyPersonalAllowance, frequency).toFixed(2));
  const taxableForFreq = Number(fromMonthly(monthlyTaxable, frequency).toFixed(2));
  const annualTax = Number((monthlyTax * 12).toFixed(2));

  return {
    country: 'Barbados',
    taxYear,
    frequency,
    grossIncome,
    personalAllowance: personalAllowanceForFreq,
    statutoryReliefs: 0,
    taxableIncome: taxableForFreq,
    payeTax: payeForFrequency,
    effectiveTaxRate: grossIncome > 0 ? Number(((payeForFrequency / grossIncome) * 100).toFixed(2)) : 0,
    marginalTaxRate: monthlyTaxable > monthlyTier1Cap ? 28.5 : monthlyTaxable > 0 ? 12.5 : 0,
    annualTax,
    bracketsBreakdown: [
      {
        tier: '12.5% on first BDS$50,000/year (BDS$4,166.67/mo)',
        rate: 0.125,
        taxableInTier: Number(fromMonthly(tier1Taxable, frequency).toFixed(2)),
        taxForTier: Number(fromMonthly(tier1Tax, frequency).toFixed(2)),
      },
      {
        tier: '28.5% on taxable income over BDS$50,000/year',
        rate: 0.285,
        taxableInTier: Number(fromMonthly(tier2Taxable, frequency).toFixed(2)),
        taxForTier: Number(fromMonthly(tier2Tax, frequency).toFixed(2)),
      },
    ],
    lastUpdated: BB_LAST_UPDATED,
    notes: [
      'Barbados statutory basic personal allowance of BDS$25,000/year (BDS$2,083.33/month) applied.',
      '12.5% standard rate on the first BDS$50,000 of taxable income; 28.5% higher rate applies above BDS$50,000.',
    ],
  };
}

/**
 * Calculates Full Barbados Payroll & Take-Home Pay
 */
export function calculateBarbadosPayroll(input: BaseTaxCalculationInput): FullPayrollCalculationResult {
  const { grossIncome, frequency, taxYear = BB_TAX_YEAR } = input;
  const nis = calculateBarbadosNIS(input);
  const paye = calculateBarbadosPAYE(input);

  const totalEmployeeDeductions = Number((nis.employeeNIS + paye.payeTax).toFixed(2));
  const totalEmployerContributions = Number(nis.employerNIS.toFixed(2));
  const totalCostToEmployer = Number((grossIncome + totalEmployerContributions).toFixed(2));
  const netTakeHomePay = Math.max(0, Number((grossIncome - totalEmployeeDeductions).toFixed(2)));

  const monthlyGross = toMonthly(grossIncome, frequency);
  const annualGross = Number((monthlyGross * 12).toFixed(2));
  const annualNet = Number((toMonthly(netTakeHomePay, frequency) * 12).toFixed(2));

  return {
    country: 'Barbados',
    countryName: 'Barbados',
    countryCode: 'BB',
    currency: 'BBD',
    currencySymbol: 'BDS$',
    taxYear,
    frequency,
    grossIncome,
    employeeNIS: nis.employeeNIS,
    employerNIS: nis.employerNIS,
    totalNIS: nis.totalNIS,
    nisClass: nis.contributionClass,
    insurableEarnings: nis.insurableEarnings,
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
    annualEmployeeNIS: nis.annualEstimateEmployee,
    annualEmployerNIS: nis.annualEstimateEmployer,
    lastUpdated: BB_LAST_UPDATED,
    officialSource: BB_OFFICIAL_SOURCE,
    notes: [
      ...nis.notes,
      ...paye.notes,
    ],
  };
}
