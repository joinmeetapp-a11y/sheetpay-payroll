export * from './types';
export * from './trinidad-and-tobago';
export * from './barbados';
export * from './saint-lucia';
export * from './belize';

import {
  BaseTaxCalculationInput,
  NISCalculationResult,
  PAYECalculationResult,
  FullPayrollCalculationResult,
  HealthSurchargeResult,
} from './types';
import {
  calculateTrinidadNIS,
  calculateTrinidadPAYE,
  calculateTrinidadHealthSurcharge,
  calculateTrinidadPayroll,
  TT_TAX_YEAR,
  TT_LAST_UPDATED,
} from './trinidad-and-tobago';
import {
  calculateBarbadosNIS,
  calculateBarbadosPAYE,
  calculateBarbadosPayroll,
  BB_TAX_YEAR,
  BB_LAST_UPDATED,
} from './barbados';
import {
  calculateSaintLuciaNIC,
  calculateSaintLuciaPAYE,
  calculateSaintLuciaPayroll,
  LC_TAX_YEAR,
  LC_LAST_UPDATED,
} from './saint-lucia';
import {
  calculateBelizeSSB,
  calculateBelizeIncomeTax,
  calculateBelizePayroll,
  BZ_TAX_YEAR,
  BZ_LAST_UPDATED,
} from './belize';

export type CountryCode = 'TT' | 'BB' | 'LC' | 'BZ';

export interface CountryMetadata {
  code: CountryCode;
  name: string;
  flag: string;
  currency: string;
  currencySymbol: string;
  nisName: string;
  taxAgency: string;
  socialSecurityAgency: string;
  taxYear: number;
  lastUpdated: string;
  hubUrl: string;
}

export const COUNTRIES_METADATA: Record<CountryCode, CountryMetadata> = {
  TT: {
    code: 'TT',
    name: 'Trinidad and Tobago',
    flag: '🇹🇹',
    currency: 'TTD',
    currencySymbol: 'TT$',
    nisName: 'National Insurance Scheme (NIS / NIBTT)',
    taxAgency: 'Board of Inland Revenue (BIR)',
    socialSecurityAgency: 'National Insurance Board of Trinidad & Tobago (NIBTT)',
    taxYear: TT_TAX_YEAR,
    lastUpdated: TT_LAST_UPDATED,
    hubUrl: '/trinidad-and-tobago',
  },
  BB: {
    code: 'BB',
    name: 'Barbados',
    flag: '🇧🇧',
    currency: 'BBD',
    currencySymbol: 'BDS$',
    nisName: 'National Insurance Scheme (NIS)',
    taxAgency: 'Barbados Revenue Authority (BRA)',
    socialSecurityAgency: 'Barbados National Insurance Board',
    taxYear: BB_TAX_YEAR,
    lastUpdated: BB_LAST_UPDATED,
    hubUrl: '/barbados',
  },
  LC: {
    code: 'LC',
    name: 'Saint Lucia',
    flag: '🇱🇨',
    currency: 'XCD',
    currencySymbol: 'EC$',
    nisName: 'National Insurance Corporation (NIC)',
    taxAgency: 'Inland Revenue Department (IRD)',
    socialSecurityAgency: 'Saint Lucia National Insurance Corporation',
    taxYear: LC_TAX_YEAR,
    lastUpdated: LC_LAST_UPDATED,
    hubUrl: '/saint-lucia',
  },
  BZ: {
    code: 'BZ',
    name: 'Belize',
    flag: '🇧🇿',
    currency: 'BZD',
    currencySymbol: 'BZ$',
    nisName: 'Social Security Board (SSB)',
    taxAgency: 'Belize Tax Service Department (BTSD)',
    socialSecurityAgency: 'Social Security Board Belize',
    taxYear: BZ_TAX_YEAR,
    lastUpdated: BZ_LAST_UPDATED,
    hubUrl: '/belize',
  },
};

/**
 * Universal dispatcher for deterministic calculations by country and calculator type
 */
export function calculateNISByCountry(country: CountryCode | string, input: BaseTaxCalculationInput): NISCalculationResult {
  const code = (country || 'TT').toString().toUpperCase();
  switch (code) {
    case 'BB':
      return calculateBarbadosNIS(input);
    case 'LC':
      return calculateSaintLuciaNIC(input);
    case 'BZ':
      return calculateBelizeSSB(input);
    case 'TT':
    default:
      return calculateTrinidadNIS(input);
  }
}

export function calculatePAYEByCountry(country: CountryCode | string, input: BaseTaxCalculationInput): PAYECalculationResult {
  const code = (country || 'TT').toString().toUpperCase();
  switch (code) {
    case 'BB':
      return calculateBarbadosPAYE(input);
    case 'LC':
      return calculateSaintLuciaPAYE(input);
    case 'BZ':
      return calculateBelizeIncomeTax(input);
    case 'TT':
    default:
      return calculateTrinidadPAYE(input);
  }
}

export function calculateFullPayrollByCountry(country: CountryCode | string, input: BaseTaxCalculationInput): FullPayrollCalculationResult {
  const code = (country || 'TT').toString().toUpperCase();
  switch (code) {
    case 'BB':
      return calculateBarbadosPayroll(input);
    case 'LC':
      return calculateSaintLuciaPayroll(input);
    case 'BZ':
      return calculateBelizePayroll(input);
    case 'TT':
    default:
      return calculateTrinidadPayroll(input);
  }
}
