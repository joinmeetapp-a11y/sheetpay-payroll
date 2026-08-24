import { BaseTaxCalculationInput, NISCalculationResult, PAYECalculationResult, FullPayrollCalculationResult, PayFrequency } from '../types';
import { toMonthly, fromMonthly } from '../trinidad-and-tobago';

/**
 * Saint Lucia National Insurance Corporation (NIC) & IRD PAYE Tax Rules
 * Effective Tax Year: 2026
 * Official Source: Saint Lucia Inland Revenue Department (IRD) & National Insurance Corporation (NIC)
 */
export const LC_TAX_YEAR = 2026;
export const LC_LAST_UPDATED = 'August 2026';
export const LC_OFFICIAL_SOURCE = 'Saint Lucia Inland Revenue Department (IRD) & National Insurance Corporation (NIC)';

// Maximum monthly insurable earnings for NIC: EC$5,000 / month ($60,000/yr)
const LC_MAX_INSURABLE_MONTHLY = 5000;
const LC_MAX_INSURABLE_WEEKLY = 1153.85;

export const LC_NIC_RATES = {
  employee: 0.05, // 5% employee
  employer: 0.05, // 5% employer
  total: 0.10,    // 10% total
};

/**
 * Calculates Saint Lucia NIC (National Insurance Corporation)
 */
export function calculateSaintLuciaNIC(input: BaseTaxCalculationInput): NISCalculationResult {
  const { grossIncome, frequency, taxYear = LC_TAX_YEAR } = input;
  const monthlyGross = Math.max(0, toMonthly(grossIncome, frequency));

  const maxInsurableForFreq = frequency === 'weekly' ? LC_MAX_INSURABLE_WEEKLY : frequency === 'fortnightly' ? LC_MAX_INSURABLE_WEEKLY * 2 : frequency === 'semi-monthly' ? LC_MAX_INSURABLE_MONTHLY / 2 : frequency === 'annual' ? LC_MAX_INSURABLE_MONTHLY * 12 : LC_MAX_INSURABLE_MONTHLY;

  const insurableEarnings = Math.min(grossIncome, maxInsurableForFreq);
  const employeeNIC = Number((insurableEarnings * LC_NIC_RATES.employee).toFixed(2));
  const employerNIC = Number((insurableEarnings * LC_NIC_RATES.employer).toFixed(2));
  const totalNIC = Number((employeeNIC + employerNIC).toFixed(2));

  const monthlyInsurable = Math.min(monthlyGross, LC_MAX_INSURABLE_MONTHLY);
  const annualEstimateEmployee = Number((monthlyInsurable * LC_NIC_RATES.employee * 12).toFixed(2));
  const annualEstimateEmployer = Number((monthlyInsurable * LC_NIC_RATES.employer * 12).toFixed(2));

  return {
    country: 'Saint Lucia',
    taxYear,
    frequency,
    grossIncome,
    insurableEarnings,
    employeeNIS: employeeNIC,
    employerNIS: employerNIC,
    totalNIS: totalNIC,
    contributionClass: grossIncome > maxInsurableForFreq ? 'Maximum Insurable Ceiling (EC$5,000/mo)' : 'Standard 5% Insurable Tier',
    effectiveRateEmployee: grossIncome > 0 ? Number(((employeeNIC / grossIncome) * 100).toFixed(2)) : 0,
    effectiveRateEmployer: grossIncome > 0 ? Number(((employerNIC / grossIncome) * 100).toFixed(2)) : 0,
    annualEstimateEmployee,
    annualEstimateEmployer,
    annualEstimateTotal: Number((annualEstimateEmployee + annualEstimateEmployer).toFixed(2)),
    lastUpdated: LC_LAST_UPDATED,
    notes: [
      'Employee NIC rate is 5.0% of insurable earnings.',
      'Employer NIC matching rate is 5.0% of insurable earnings.',
      `Maximum insurable earnings ceiling is EC$${LC_MAX_INSURABLE_MONTHLY.toLocaleString()}/month (EC$${LC_MAX_INSURABLE_WEEKLY.toFixed(2)}/week).`,
    ],
  };
}

/**
 * Calculates Saint Lucia IRD PAYE (Income Tax)
 */
export function calculateSaintLuciaPAYE(input: BaseTaxCalculationInput): PAYECalculationResult {
  const { grossIncome, frequency, taxYear = LC_TAX_YEAR, allowances = 0 } = input;
  const monthlyGross = toMonthly(grossIncome, frequency);

  // Standard Personal Allowance: EC$25,000 / year (EC$2,083.33 / month)
  const annualPersonalAllowance = 25000 + allowances;
  const monthlyPersonalAllowance = annualPersonalAllowance / 12;

  // NIC employee contribution is tax-deductible in Saint Lucia
  const nicRes = calculateSaintLuciaNIC({ grossIncome: monthlyGross, frequency: 'monthly', taxYear });
  const monthlyNicRelief = nicRes.employeeNIS;

  const monthlyTaxable = Math.max(0, monthlyGross - monthlyPersonalAllowance - monthlyNicRelief);

  // Graduated brackets (Annual):
  // Tier 1: 10% on first $10,000 ($833.33/mo)
  // Tier 2: 15% on next $10,000 ($833.33/mo)
  // Tier 3: 20% on next $10,000 ($833.33/mo)
  // Tier 4: 30% on excess over $30,000/yr ($2,500/mo)
  const t1Cap = 10000 / 12; // 833.33
  const t2Cap = 10000 / 12; // 833.33
  const t3Cap = 10000 / 12; // 833.33

  let remainingTaxable = monthlyTaxable;
  let t1Taxable = 0, t1Tax = 0;
  let t2Taxable = 0, t2Tax = 0;
  let t3Taxable = 0, t3Tax = 0;
  let t4Taxable = 0, t4Tax = 0;

  if (remainingTaxable > 0) {
    t1Taxable = Math.min(remainingTaxable, t1Cap);
    t1Tax = t1Taxable * 0.10;
    remainingTaxable -= t1Taxable;
  }

  if (remainingTaxable > 0) {
    t2Taxable = Math.min(remainingTaxable, t2Cap);
    t2Tax = t2Taxable * 0.15;
    remainingTaxable -= t2Taxable;
  }

  if (remainingTaxable > 0) {
    t3Taxable = Math.min(remainingTaxable, t3Cap);
    t3Tax = t3Taxable * 0.20;
    remainingTaxable -= t3Taxable;
  }

  if (remainingTaxable > 0) {
    t4Taxable = remainingTaxable;
    t4Tax = t4Taxable * 0.30;
  }

  const totalMonthlyTax = Number((t1Tax + t2Tax + t3Tax + t4Tax).toFixed(2));
  const payeForFrequency = Number(fromMonthly(totalMonthlyTax, frequency).toFixed(2));
  const personalAllowanceForFreq = Number(fromMonthly(monthlyPersonalAllowance, frequency).toFixed(2));
  const statutoryReliefForFreq = Number(fromMonthly(monthlyNicRelief, frequency).toFixed(2));
  const taxableForFreq = Number(fromMonthly(monthlyTaxable, frequency).toFixed(2));
  const annualTax = Number((totalMonthlyTax * 12).toFixed(2));

  return {
    country: 'Saint Lucia',
    taxYear,
    frequency,
    grossIncome,
    personalAllowance: personalAllowanceForFreq,
    statutoryReliefs: statutoryReliefForFreq,
    taxableIncome: taxableForFreq,
    payeTax: payeForFrequency,
    effectiveTaxRate: grossIncome > 0 ? Number(((payeForFrequency / grossIncome) * 100).toFixed(2)) : 0,
    marginalTaxRate: t4Taxable > 0 ? 30 : t3Taxable > 0 ? 20 : t2Taxable > 0 ? 15 : t1Taxable > 0 ? 10 : 0,
    annualTax,
    bracketsBreakdown: [
      {
        tier: '10% on first EC$10,000/year (EC$833.33/mo)',
        rate: 0.10,
        taxableInTier: Number(fromMonthly(t1Taxable, frequency).toFixed(2)),
        taxForTier: Number(fromMonthly(t1Tax, frequency).toFixed(2)),
      },
      {
        tier: '15% on next EC$10,000/year (EC$833.33/mo)',
        rate: 0.15,
        taxableInTier: Number(fromMonthly(t2Taxable, frequency).toFixed(2)),
        taxForTier: Number(fromMonthly(t2Tax, frequency).toFixed(2)),
      },
      {
        tier: '20% on next EC$10,000/year (EC$833.33/mo)',
        rate: 0.20,
        taxableInTier: Number(fromMonthly(t3Taxable, frequency).toFixed(2)),
        taxForTier: Number(fromMonthly(t3Tax, frequency).toFixed(2)),
      },
      {
        tier: '30% on taxable income over EC$30,000/year',
        rate: 0.30,
        taxableInTier: Number(fromMonthly(t4Taxable, frequency).toFixed(2)),
        taxForTier: Number(fromMonthly(t4Tax, frequency).toFixed(2)),
      },
    ],
    lastUpdated: LC_LAST_UPDATED,
    notes: [
      'Saint Lucia personal income tax allowance is EC$25,000 per year (EC$2,083.33/month).',
      'Employee NIC contribution is 100% statutory tax-deductible from gross income.',
      'Progressive 4-tier income tax schedule (10%, 15%, 20%, and 30%).',
    ],
  };
}

/**
 * Calculates Full Saint Lucia Payroll & Take-Home Pay
 */
export function calculateSaintLuciaPayroll(input: BaseTaxCalculationInput): FullPayrollCalculationResult {
  const { grossIncome, frequency, taxYear = LC_TAX_YEAR } = input;
  const nic = calculateSaintLuciaNIC(input);
  const paye = calculateSaintLuciaPAYE(input);

  const totalEmployeeDeductions = Number((nic.employeeNIS + paye.payeTax).toFixed(2));
  const totalEmployerContributions = Number(nic.employerNIS.toFixed(2));
  const totalCostToEmployer = Number((grossIncome + totalEmployerContributions).toFixed(2));
  const netTakeHomePay = Math.max(0, Number((grossIncome - totalEmployeeDeductions).toFixed(2)));

  const monthlyGross = toMonthly(grossIncome, frequency);
  const annualGross = Number((monthlyGross * 12).toFixed(2));
  const annualNet = Number((toMonthly(netTakeHomePay, frequency) * 12).toFixed(2));

  return {
    country: 'Saint Lucia',
    countryName: 'Saint Lucia',
    countryCode: 'LC',
    currency: 'XCD',
    currencySymbol: 'EC$',
    taxYear,
    frequency,
    grossIncome,
    employeeNIS: nic.employeeNIS,
    employerNIS: nic.employerNIS,
    totalNIS: nic.totalNIS,
    nisClass: nic.contributionClass,
    insurableEarnings: nic.insurableEarnings,
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
    annualEmployeeNIS: nic.annualEstimateEmployee,
    annualEmployerNIS: nic.annualEstimateEmployer,
    lastUpdated: LC_LAST_UPDATED,
    officialSource: LC_OFFICIAL_SOURCE,
    notes: [
      ...nic.notes,
      ...paye.notes,
    ],
  };
}
