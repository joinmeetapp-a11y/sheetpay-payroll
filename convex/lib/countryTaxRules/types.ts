export type PayFrequency = 'weekly' | 'fortnightly' | 'semi-monthly' | 'monthly' | 'annual';

export interface BaseTaxCalculationInput {
  grossIncome: number;
  frequency: PayFrequency;
  taxYear?: number;
  allowances?: number;
  otherDeductions?: number;
  age?: number;
  isDirector?: boolean;
}

export interface NISCalculationResult {
  country: string;
  taxYear: number;
  frequency: PayFrequency;
  grossIncome: number;
  insurableEarnings: number;
  employeeNIS: number;
  employerNIS: number;
  totalNIS: number;
  contributionClass?: string | number;
  effectiveRateEmployee: number;
  effectiveRateEmployer: number;
  annualEstimateEmployee: number;
  annualEstimateEmployer: number;
  annualEstimateTotal: number;
  lastUpdated: string;
  notes: string[];
}

export interface PAYECalculationResult {
  country: string;
  taxYear: number;
  frequency: PayFrequency;
  grossIncome: number;
  personalAllowance: number;
  statutoryReliefs: number;
  taxableIncome: number;
  payeTax: number;
  effectiveTaxRate: number;
  marginalTaxRate: number;
  annualTax: number;
  bracketsBreakdown: {
    tier: string;
    rate: number;
    taxableInTier: number;
    taxForTier: number;
  }[];
  lastUpdated: string;
  notes: string[];
}

export interface HealthSurchargeResult {
  country: string;
  taxYear: number;
  frequency: PayFrequency;
  grossIncome: number;
  healthSurcharge: number;
  annualEstimate: number;
  rateDescription: string;
  lastUpdated: string;
}

export interface FullPayrollCalculationResult {
  country: string;
  countryName: string;
  countryCode: 'TT' | 'BB' | 'LC' | 'BZ';
  currency: string;
  currencySymbol: string;
  taxYear: number;
  frequency: PayFrequency;
  grossIncome: number;
  employeeNIS: number;
  employerNIS: number;
  totalNIS: number;
  nisClass?: string | number;
  insurableEarnings: number;
  healthSurcharge: number;
  personalAllowance: number;
  taxableIncome: number;
  payeTax: number;
  totalEmployeeDeductions: number;
  totalEmployerContributions: number;
  totalCostToEmployer: number;
  netTakeHomePay: number;
  effectiveEmployeeDeductionRate: number;
  annualGross: number;
  annualNet: number;
  annualPAYE: number;
  annualEmployeeNIS: number;
  annualEmployerNIS: number;
  annualHealthSurcharge?: number;
  lastUpdated: string;
  officialSource: string;
  notes: string[];
}
