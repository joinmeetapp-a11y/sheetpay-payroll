import { BaseTaxCalculationInput, NISCalculationResult, PAYECalculationResult, HealthSurchargeResult, FullPayrollCalculationResult, PayFrequency } from '../types';

/**
 * Trinidad & Tobago National Insurance Scheme (NIBTT) 16 Classes Table
 * Rates: 13.2% total (Employee 4.4%, Employer 8.8%)
 * Effective Tax Year: 2026 (NIBTT statutory schedule)
 */
export const TT_TAX_YEAR = 2026;
export const TT_LAST_UPDATED = 'August 2026';
export const TT_OFFICIAL_SOURCE = 'National Insurance Board of Trinidad & Tobago (NIBTT) & Board of Inland Revenue (BIR)';

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
  { classNum: 1, weeklyMin: 200, weeklyMax: 339.99, monthlyMin: 867, monthlyMax: 1473.29, weeklyEmployee: 11.90, weeklyEmployer: 23.80, weeklyTotal: 35.70, monthlyEmployee: 51.57, monthlyEmployer: 103.13, monthlyTotal: 154.70 },
  { classNum: 2, weeklyMin: 340, weeklyMax: 449.99, monthlyMin: 1473.30, monthlyMax: 1949.99, weeklyEmployee: 17.40, weeklyEmployer: 34.80, weeklyTotal: 52.20, monthlyEmployee: 75.40, monthlyEmployer: 150.80, monthlyTotal: 226.20 },
  { classNum: 3, weeklyMin: 450, weeklyMax: 579.99, monthlyMin: 1950, monthlyMax: 2513.29, weeklyEmployee: 22.70, weeklyEmployer: 45.40, weeklyTotal: 68.10, monthlyEmployee: 98.37, monthlyEmployer: 196.73, monthlyTotal: 295.10 },
  { classNum: 4, weeklyMin: 580, weeklyMax: 709.99, monthlyMin: 2513.30, monthlyMax: 3076.62, weeklyEmployee: 28.40, weeklyEmployer: 56.80, weeklyTotal: 85.20, monthlyEmployee: 123.07, monthlyEmployer: 246.13, monthlyTotal: 369.20 },
  { classNum: 5, weeklyMin: 710, weeklyMax: 849.99, monthlyMin: 3076.63, monthlyMax: 3683.29, weeklyEmployee: 34.30, weeklyEmployer: 68.60, weeklyTotal: 102.90, monthlyEmployee: 148.63, monthlyEmployer: 297.27, monthlyTotal: 445.90 },
  { classNum: 6, weeklyMin: 850, weeklyMax: 999.99, monthlyMin: 3683.30, monthlyMax: 4333.29, weeklyEmployee: 40.70, weeklyEmployer: 81.40, weeklyTotal: 122.10, monthlyEmployee: 176.37, monthlyEmployer: 352.73, monthlyTotal: 529.10 },
  { classNum: 7, weeklyMin: 1000, weeklyMax: 1159.99, monthlyMin: 4333.30, monthlyMax: 5026.62, weeklyEmployee: 47.50, weeklyEmployer: 95.00, weeklyTotal: 142.50, monthlyEmployee: 205.83, monthlyEmployer: 411.67, monthlyTotal: 617.50 },
  { classNum: 8, weeklyMin: 1160, weeklyMax: 1339.99, monthlyMin: 5026.63, monthlyMax: 5806.62, weeklyEmployee: 55.00, weeklyEmployer: 110.00, weeklyTotal: 165.00, monthlyEmployee: 238.33, monthlyEmployer: 476.67, monthlyTotal: 715.00 },
  { classNum: 9, weeklyMin: 1340, weeklyMax: 1539.99, monthlyMin: 5806.63, monthlyMax: 6673.29, weeklyEmployee: 63.40, weeklyEmployer: 126.80, weeklyTotal: 190.20, monthlyEmployee: 274.73, monthlyEmployer: 549.47, monthlyTotal: 824.20 },
  { classNum: 10, weeklyMin: 1540, weeklyMax: 1759.99, monthlyMin: 6673.30, monthlyMax: 7626.62, weeklyEmployee: 72.60, weeklyEmployer: 145.20, weeklyTotal: 217.80, monthlyEmployee: 314.60, monthlyEmployer: 629.20, monthlyTotal: 943.80 },
  { classNum: 11, weeklyMin: 1760, weeklyMax: 2009.99, monthlyMin: 7626.63, monthlyMax: 8709.95, weeklyEmployee: 82.90, weeklyEmployer: 165.80, weeklyTotal: 248.70, monthlyEmployee: 359.23, monthlyEmployer: 718.47, monthlyTotal: 1077.70 },
  { classNum: 12, weeklyMin: 2010, weeklyMax: 2289.99, monthlyMin: 8709.96, monthlyMax: 9923.28, weeklyEmployee: 94.60, weeklyEmployer: 189.20, weeklyTotal: 283.80, monthlyEmployee: 409.93, monthlyEmployer: 819.87, monthlyTotal: 1229.80 },
  { classNum: 13, weeklyMin: 2290, weeklyMax: 2599.99, monthlyMin: 9923.29, monthlyMax: 11266.61, weeklyEmployee: 107.60, weeklyEmployer: 215.20, weeklyTotal: 322.80, monthlyEmployee: 466.27, monthlyEmployer: 932.53, monthlyTotal: 1398.80 },
  { classNum: 14, weeklyMin: 2600, weeklyMax: 2939.99, monthlyMin: 11266.62, monthlyMax: 12739.94, weeklyEmployee: 121.90, weeklyEmployer: 243.80, weeklyTotal: 365.70, monthlyEmployee: 528.23, monthlyEmployer: 1056.47, monthlyTotal: 1584.70 },
  { classNum: 15, weeklyMin: 2940, weeklyMax: 3137.99, monthlyMin: 12739.95, monthlyMax: 13599.99, weeklyEmployee: 133.70, weeklyEmployer: 267.40, weeklyTotal: 401.10, monthlyEmployee: 579.37, monthlyEmployer: 1158.73, monthlyTotal: 1738.10 },
  { classNum: 16, weeklyMin: 3138, weeklyMax: Infinity, monthlyMin: 13600, monthlyMax: Infinity, weeklyEmployee: 139.20, weeklyEmployer: 278.40, weeklyTotal: 417.60, monthlyEmployee: 603.20, monthlyEmployer: 1206.40, monthlyTotal: 1809.60 },
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
      'Total contribution rate is 13.2% split 1/3 (4.4%) employee and 2/3 (8.8%) employer.',
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

  // Annual Standard Personal Allowance: $84,000 / year ($7,000 / month)
  const annualPersonalAllowance = 84000 + allowances;
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
      'Standard individual personal allowance of $84,000 per year ($7,000/month) applied.',
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
