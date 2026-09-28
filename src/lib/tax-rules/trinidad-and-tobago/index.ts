import { BaseTaxCalculationInput, NISCalculationResult, PAYECalculationResult, HealthSurchargeResult, FullPayrollCalculationResult, PayFrequency } from '../types';

/**
 * Trinidad & Tobago National Insurance Scheme (NIBTT) 16 Classes Table
 * Rates: 16.2% total (Employee 5.4%, Employer 10.8%)
 * Effective Tax Year: 2026 (NIBTT statutory schedule)
 */
export const TT_TAX_YEAR = 2026;
export const TT_LAST_UPDATED = 'September 2026';
export const TT_OFFICIAL_SOURCE = 'NIBTT 2026 Earnings Classes effective January 5, 2026 (https://www.nibtt.net/Contribution_Rates/rates.html); IRD Trinidad and Tobago $90,000 personal allowance (https://www.ird.gov.tt/individual/deductions-and-required-supporting-documents)';

interface NISClassTier {
  classNum: number;
  monthlyMin: number;
  monthlyMax: number;
  weeklyMin: number;
  weeklyMax: number;
  monthlyEmployee: number;
  monthlyEmployer: number;
  monthlyTotal: number;
  weeklyEmployee: number;
  weeklyEmployer: number;
  weeklyTotal: number;
}

const TT_NIS_CLASSES: NISClassTier[] = [
  { classNum: 1, weeklyMin: 200, weeklyMax: 339.99, monthlyMin: 867, monthlyMax: 1472.99, weeklyEmployee: 14.60, weeklyEmployer: 29.20, weeklyTotal: 43.80, monthlyEmployee: 63.27, monthlyEmployer: 126.53, monthlyTotal: 189.80 },
  { classNum: 2, weeklyMin: 340, weeklyMax: 449.99, monthlyMin: 1473, monthlyMax: 1949.99, weeklyEmployee: 21.30, weeklyEmployer: 42.60, weeklyTotal: 63.90, monthlyEmployee: 92.30, monthlyEmployer: 184.60, monthlyTotal: 276.90 },
  { classNum: 3, weeklyMin: 450, weeklyMax: 609.99, monthlyMin: 1950, monthlyMax: 2642.99, weeklyEmployee: 28.60, weeklyEmployer: 57.20, weeklyTotal: 85.80, monthlyEmployee: 123.93, monthlyEmployer: 247.87, monthlyTotal: 371.80 },
  { classNum: 4, weeklyMin: 610, weeklyMax: 759.99, monthlyMin: 2643, monthlyMax: 3292.99, weeklyEmployee: 37.00, weeklyEmployer: 74.00, weeklyTotal: 111.00, monthlyEmployee: 160.33, monthlyEmployer: 320.67, monthlyTotal: 481.00 },
  { classNum: 5, weeklyMin: 760, weeklyMax: 929.99, monthlyMin: 3293, monthlyMax: 4029.99, weeklyEmployee: 45.60, weeklyEmployer: 91.20, weeklyTotal: 136.80, monthlyEmployee: 197.60, monthlyEmployer: 395.20, monthlyTotal: 592.80 },
  { classNum: 6, weeklyMin: 930, weeklyMax: 1119.99, monthlyMin: 4030, monthlyMax: 4852.99, weeklyEmployee: 55.40, weeklyEmployer: 110.80, weeklyTotal: 166.20, monthlyEmployee: 240.07, monthlyEmployer: 480.13, monthlyTotal: 720.20 },
  { classNum: 7, weeklyMin: 1120, weeklyMax: 1299.99, monthlyMin: 4853, monthlyMax: 5632.99, weeklyEmployee: 65.30, weeklyEmployer: 130.60, weeklyTotal: 195.90, monthlyEmployee: 282.97, monthlyEmployer: 565.93, monthlyTotal: 848.90 },
  { classNum: 8, weeklyMin: 1300, weeklyMax: 1489.99, monthlyMin: 5633, monthlyMax: 6456.99, weeklyEmployee: 75.30, weeklyEmployer: 150.60, weeklyTotal: 225.90, monthlyEmployee: 326.30, monthlyEmployer: 652.60, monthlyTotal: 978.90 },
  { classNum: 9, weeklyMin: 1490, weeklyMax: 1709.99, monthlyMin: 6457, monthlyMax: 7409.99, weeklyEmployee: 86.40, weeklyEmployer: 172.80, weeklyTotal: 259.20, monthlyEmployee: 374.40, monthlyEmployer: 748.80, monthlyTotal: 1123.20 },
  { classNum: 10, weeklyMin: 1710, weeklyMax: 1909.99, monthlyMin: 7410, monthlyMax: 8276.99, weeklyEmployee: 97.70, weeklyEmployer: 195.40, weeklyTotal: 293.10, monthlyEmployee: 423.37, monthlyEmployer: 846.73, monthlyTotal: 1270.10 },
  { classNum: 11, weeklyMin: 1910, weeklyMax: 2139.99, monthlyMin: 8277, monthlyMax: 9272.99, weeklyEmployee: 109.40, weeklyEmployer: 218.80, weeklyTotal: 328.20, monthlyEmployee: 473.73, monthlyEmployer: 946.27, monthlyTotal: 1422.20 },
  { classNum: 12, weeklyMin: 2140, weeklyMax: 2379.99, monthlyMin: 9273, monthlyMax: 10312.99, weeklyEmployee: 122.00, weeklyEmployer: 244.00, weeklyTotal: 366.00, monthlyEmployee: 528.67, monthlyEmployer: 1057.33, monthlyTotal: 1586.00 },
  { classNum: 13, weeklyMin: 2380, weeklyMax: 2629.99, monthlyMin: 10313, monthlyMax: 11396.99, weeklyEmployee: 135.30, weeklyEmployer: 270.60, weeklyTotal: 405.90, monthlyEmployee: 586.30, monthlyEmployer: 1172.60, monthlyTotal: 1758.90 },
  { classNum: 14, weeklyMin: 2630, weeklyMax: 2919.99, monthlyMin: 11397, monthlyMax: 12652.99, weeklyEmployee: 149.90, weeklyEmployer: 299.80, weeklyTotal: 449.70, monthlyEmployee: 649.57, monthlyEmployer: 1299.13, monthlyTotal: 1948.70 },
  { classNum: 15, weeklyMin: 2920, weeklyMax: 3137.99, monthlyMin: 12653, monthlyMax: 13599.99, weeklyEmployee: 163.60, weeklyEmployer: 327.20, weeklyTotal: 490.80, monthlyEmployee: 709.27, monthlyEmployer: 1417.53, monthlyTotal: 2126.80 },
  { classNum: 16, weeklyMin: 3138, weeklyMax: Infinity, monthlyMin: 13600, monthlyMax: Infinity, weeklyEmployee: 169.50, weeklyEmployer: 339.00, weeklyTotal: 508.50, monthlyEmployee: 734.50, monthlyEmployer: 1469.00, monthlyTotal: 2203.50 },
];

/**
 * Normalizes any pay frequency to a monthly amount for standard tax calculation
 */
export function toMonthly(amount: number, frequency: PayFrequency): number {
  switch (frequency) {
    case 'weekly':
      return (amount * 52) / 12;
    case 'fortnightly':
      return (amount * 26) / 12;
    case 'semi-monthly':
      return amount * 2;
    case 'annual':
      return amount / 12;
    case 'monthly':
    default:
      return amount;
  }
}

/**
 * Converts a monthly statutory deduction to the specified pay frequency
 */
export function fromMonthly(amount: number, frequency: PayFrequency): number {
  switch (frequency) {
    case 'weekly':
      return (amount * 12) / 52;
    case 'fortnightly':
      return (amount * 12) / 26;
    case 'semi-monthly':
      return amount / 2;
    case 'annual':
      return amount * 12;
    case 'monthly':
    default:
      return amount;
  }
}

/**
 * Calculates Trinidad & Tobago NIS (National Insurance Scheme)
 */
export function calculateTrinidadNIS(input: BaseTaxCalculationInput): NISCalculationResult {
  const { grossIncome, frequency, taxYear = TT_TAX_YEAR } = input;
  const monthlyGross = Math.max(0, toMonthly(grossIncome, frequency));

  if (monthlyGross < 867) {
    // Under minimum threshold ($200/wk = $867/mo)
    return {
      country: 'Trinidad and Tobago',
      taxYear,
      frequency,
      grossIncome,
      insurableEarnings: 0,
      employeeNIS: 0,
      employerNIS: 0,
      totalNIS: 0,
      contributionClass: 'Exempt (< $200/wk)',
      effectiveRateEmployee: 0,
      effectiveRateEmployer: 0,
      annualEstimateEmployee: 0,
      annualEstimateEmployer: 0,
      annualEstimateTotal: 0,
      lastUpdated: TT_LAST_UPDATED,
      notes: ['Earnings below $200/week ($867/month) are exempt from NIS contributions.'],
    };
  }

  // Find exact tier
  const tier = TT_NIS_CLASSES.find(
    (t) => monthlyGross >= t.monthlyMin && monthlyGross <= t.monthlyMax
  ) || TT_NIS_CLASSES[TT_NIS_CLASSES.length - 1];

  let employeeVal = 0;
  let employerVal = 0;
  let totalVal = 0;

  if (frequency === 'weekly') {
    employeeVal = tier.weeklyEmployee;
    employerVal = tier.weeklyEmployer;
    totalVal = tier.weeklyTotal;
  } else if (frequency === 'fortnightly') {
    employeeVal = Number((tier.weeklyEmployee * 2).toFixed(2));
    employerVal = Number((tier.weeklyEmployer * 2).toFixed(2));
    totalVal = Number((tier.weeklyTotal * 2).toFixed(2));
  } else if (frequency === 'semi-monthly') {
    employeeVal = Number((tier.monthlyEmployee / 2).toFixed(2));
    employerVal = Number((tier.monthlyEmployer / 2).toFixed(2));
    totalVal = Number((tier.monthlyTotal / 2).toFixed(2));
  } else if (frequency === 'annual') {
    employeeVal = Number((tier.monthlyEmployee * 12).toFixed(2));
    employerVal = Number((tier.monthlyEmployer * 12).toFixed(2));
    totalVal = Number((tier.monthlyTotal * 12).toFixed(2));
  } else {
    // monthly
    employeeVal = tier.monthlyEmployee;
    employerVal = tier.monthlyEmployer;
    totalVal = tier.monthlyTotal;
  }

  const insurableCeiling = frequency === 'weekly' ? 3138 : frequency === 'fortnightly' ? 6276 : frequency === 'semi-monthly' ? 6800 : frequency === 'annual' ? 163200 : 13600;
  const insurableEarnings = Math.min(grossIncome, insurableCeiling);

  const annualEmp = Number((tier.monthlyEmployee * 12).toFixed(2));
  const annualEmpr = Number((tier.monthlyEmployer * 12).toFixed(2));

  return {
    country: 'Trinidad and Tobago',
    taxYear,
    frequency,
    grossIncome,
    insurableEarnings,
    employeeNIS: employeeVal,
    employerNIS: employerVal,
    totalNIS: totalVal,
    contributionClass: `Class ${tier.classNum}`,
    effectiveRateEmployee: grossIncome > 0 ? Number(((employeeVal / grossIncome) * 100).toFixed(2)) : 0,
    effectiveRateEmployer: grossIncome > 0 ? Number(((employerVal / grossIncome) * 100).toFixed(2)) : 0,
    annualEstimateEmployee: annualEmp,
    annualEstimateEmployer: annualEmpr,
    annualEstimateTotal: Number((annualEmp + annualEmpr).toFixed(2)),
    lastUpdated: TT_LAST_UPDATED,
    notes: [
      `Assigned to NIBTT Class ${tier.classNum} based on gross earnings of ${grossIncome.toFixed(2)}.`,
      '2026 contribution rate is 16.2% split 1/3 (5.4%) employee and 2/3 (10.8%) employer.',
      tier.classNum === 16 ? 'Class 16 maximum insurable earnings ceiling ($13,600/month) applies.' : 'Standard class schedule rates applied.',
    ],
  };
}

/**
 * Calculates Trinidad & Tobago Health Surcharge
 */
export function calculateTrinidadHealthSurcharge(input: BaseTaxCalculationInput): HealthSurchargeResult {
  const { grossIncome, frequency, taxYear = TT_TAX_YEAR, age = 30 } = input;
  const monthlyGross = toMonthly(grossIncome, frequency);

  if (age >= 60 || monthlyGross <= 0) {
    return {
      country: 'Trinidad and Tobago',
      taxYear,
      frequency,
      grossIncome,
      healthSurcharge: 0,
      annualEstimate: 0,
      rateDescription: age >= 60 ? 'Exempt (Age 60+)' : '$0.00',
      lastUpdated: TT_LAST_UPDATED,
    };
  }

  // Under $108.46/wk ($469.99/mo): $4.80/wk ($20.80/mo)
  // Over $108.46/wk ($469.99/mo): $8.25/wk ($35.75/mo)
  const isHighRate = monthlyGross > 469.99;
  let surchargeAmount = 0;

  if (frequency === 'weekly') {
    surchargeAmount = isHighRate ? 8.25 : 4.80;
  } else if (frequency === 'fortnightly') {
    surchargeAmount = isHighRate ? 16.50 : 9.60;
  } else if (frequency === 'semi-monthly') {
    surchargeAmount = isHighRate ? 17.88 : 10.40;
  } else if (frequency === 'annual') {
    surchargeAmount = isHighRate ? 429.00 : 249.60;
  } else {
    // monthly
    surchargeAmount = isHighRate ? 35.75 : 20.80;
  }

  const annualEstimate = isHighRate ? 429.00 : 249.60;

  return {
    country: 'Trinidad and Tobago',
    taxYear,
    frequency,
    grossIncome,
    healthSurcharge: surchargeAmount,
    annualEstimate,
    rateDescription: isHighRate ? '$8.25/week ($35.75/month)' : '$4.80/week ($20.80/month)',
    lastUpdated: TT_LAST_UPDATED,
  };
}

/**
 * Calculates Trinidad & Tobago PAYE (Pay As You Earn) Income Tax
 */
export function calculateTrinidadPAYE(input: BaseTaxCalculationInput): PAYECalculationResult {
  const { grossIncome, frequency, taxYear = TT_TAX_YEAR, allowances = 0 } = input;
  const monthlyGross = toMonthly(grossIncome, frequency);

  // Annual Standard Personal Allowance: $90,000 / year ($7,500 / month)
  const annualPersonalAllowance = 90000 + allowances;
  const monthlyPersonalAllowance = annualPersonalAllowance / 12;

  // 70% of employee NIS is statutory tax-deductible
  const nisRes = calculateTrinidadNIS({ grossIncome: monthlyGross, frequency: 'monthly', taxYear });
  const monthlyNisRelief = nisRes.employeeNIS * 0.70;

  const monthlyTaxable = Math.max(0, monthlyGross - monthlyPersonalAllowance - monthlyNisRelief);

  // Tax brackets:
  // 25% on first $1,000,000/yr ($83,333.33/mo)
  // 30% on excess over $1,000,000/yr
  const tier1MonthlyCap = 1000000 / 12; // 83,333.33
  let monthlyTax = 0;
  let tier1Taxable = 0;
  let tier1Tax = 0;
  let tier2Taxable = 0;
  let tier2Tax = 0;

  if (monthlyTaxable > 0) {
    if (monthlyTaxable <= tier1MonthlyCap) {
      tier1Taxable = monthlyTaxable;
      tier1Tax = Number((tier1Taxable * 0.25).toFixed(2));
      monthlyTax = tier1Tax;
    } else {
      tier1Taxable = tier1MonthlyCap;
      tier1Tax = Number((tier1Taxable * 0.25).toFixed(2));
      tier2Taxable = monthlyTaxable - tier1MonthlyCap;
      tier2Tax = Number((tier2Taxable * 0.30).toFixed(2));
      monthlyTax = Number((tier1Tax + tier2Tax).toFixed(2));
    }
  }

  const payeForFrequency = Number(fromMonthly(monthlyTax, frequency).toFixed(2));
  const personalAllowanceForFreq = Number(fromMonthly(monthlyPersonalAllowance, frequency).toFixed(2));
  const statutoryReliefForFreq = Number(fromMonthly(monthlyNisRelief, frequency).toFixed(2));
  const taxableForFreq = Number(fromMonthly(monthlyTaxable, frequency).toFixed(2));
  const annualTax = Number((monthlyTax * 12).toFixed(2));

  const effectiveTaxRate = grossIncome > 0 ? Number(((payeForFrequency / grossIncome) * 100).toFixed(2)) : 0;
  const marginalTaxRate = monthlyTaxable > tier1MonthlyCap ? 30 : monthlyTaxable > 0 ? 25 : 0;

  return {
    country: 'Trinidad and Tobago',
    taxYear,
    frequency,
    grossIncome,
    personalAllowance: personalAllowanceForFreq,
    statutoryReliefs: statutoryReliefForFreq,
    taxableIncome: taxableForFreq,
    payeTax: payeForFrequency,
    effectiveTaxRate,
    marginalTaxRate,
    annualTax,
    bracketsBreakdown: [
      {
        tier: '25% on taxable income up to $1,000,000/year ($83,333.33/mo)',
        rate: 0.25,
        taxableInTier: Number(fromMonthly(tier1Taxable, frequency).toFixed(2)),
        taxForTier: Number(fromMonthly(tier1Tax, frequency).toFixed(2)),
      },
      {
        tier: '30% on taxable income exceeding $1,000,000/year',
        rate: 0.30,
        taxableInTier: Number(fromMonthly(tier2Taxable, frequency).toFixed(2)),
        taxForTier: Number(fromMonthly(tier2Tax, frequency).toFixed(2)),
      },
    ],
    lastUpdated: TT_LAST_UPDATED,
    notes: [
      'Standard individual personal allowance of $90,000 per year ($7,500/month) applied.',
      '70% of employee NIS contribution is deducted from gross income before calculating PAYE.',
      'First tier tax rate is 25% up to $1M/year; 30% applies thereafter.',
    ],
  };
}

/**
 * Calculates Full Trinidad & Tobago Payroll & Take-Home Pay
 */
export function calculateTrinidadPayroll(input: BaseTaxCalculationInput): FullPayrollCalculationResult {
  const { grossIncome, frequency, taxYear = TT_TAX_YEAR } = input;
  const nis = calculateTrinidadNIS(input);
  const hs = calculateTrinidadHealthSurcharge(input);
  const paye = calculateTrinidadPAYE(input);

  const totalEmployeeDeductions = Number((nis.employeeNIS + hs.healthSurcharge + paye.payeTax).toFixed(2));
  const totalEmployerContributions = Number(nis.employerNIS.toFixed(2));
  const totalCostToEmployer = Number((grossIncome + totalEmployerContributions).toFixed(2));
  const netTakeHomePay = Math.max(0, Number((grossIncome - totalEmployeeDeductions).toFixed(2)));

  const monthlyGross = toMonthly(grossIncome, frequency);
  const annualGross = Number((monthlyGross * 12).toFixed(2));
  const annualNet = Number((toMonthly(netTakeHomePay, frequency) * 12).toFixed(2));

  return {
    country: 'Trinidad & Tobago',
    countryName: 'Trinidad and Tobago',
    countryCode: 'TT',
    currency: 'TTD',
    currencySymbol: 'TT$',
    taxYear,
    frequency,
    grossIncome,
    employeeNIS: nis.employeeNIS,
    employerNIS: nis.employerNIS,
    totalNIS: nis.totalNIS,
    nisClass: nis.contributionClass,
    insurableEarnings: nis.insurableEarnings,
    healthSurcharge: hs.healthSurcharge,
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
    annualHealthSurcharge: hs.annualEstimate,
    lastUpdated: TT_LAST_UPDATED,
    officialSource: TT_OFFICIAL_SOURCE,
    notes: [
      ...nis.notes,
      `Health Surcharge: ${hs.rateDescription}.`,
      ...paye.notes,
    ],
  };
}
