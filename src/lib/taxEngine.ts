import { Employee, PayrollRun } from '../types';
import { calculateFullPayrollByCountry, CountryCode, calculateTrinidadNIS, calculateTrinidadPAYE, calculateTrinidadHealthSurcharge } from './tax-rules';

/**
 * Deterministic statutory payroll calculation using the country tax schedules
 * maintained in src/lib/tax-rules and linked to official sources.
 */

// NIS (National Insurance Scheme) Standard Monthly Schedule lookup
export function calculateNIS(grossMonthly: number): number {
  if (grossMonthly <= 0) return 0;
  return calculateTrinidadNIS({ grossIncome: grossMonthly, frequency: 'monthly' }).employeeNIS;
}

// Health Surcharge Statutory calculation
export function calculateHealthSurcharge(grossMonthly: number): number {
  if (grossMonthly <= 0) return 0;
  return calculateTrinidadHealthSurcharge({ grossIncome: grossMonthly, frequency: 'monthly' }).healthSurcharge;
}

// PAYE (Pay As You Earn) Statutory calculation
export function calculatePAYE(grossMonthly: number, _nisContribution: number): number {
  if (grossMonthly <= 0) return 0;
  return calculateTrinidadPAYE({ grossIncome: grossMonthly, frequency: 'monthly' }).payeTax;
}

// Full Deterministic Recalculation for a single employee
export function recalculateEmployee(emp: Employee, country: CountryCode | string = 'TT'): Employee {
  const basic = Math.max(0, Number(emp.basicPay) || 0);
  const otHours = Math.max(0, Number(emp.overtimeHours) || 0);
  
  // Default overtime rate is 1.5x basic hourly (assuming standard 160 hrs/month)
  const calculatedOtRate = emp.overtimeRate > 0 ? emp.overtimeRate : Number(((basic / 160) * 1.5).toFixed(2));
  const otPay = Number((otHours * calculatedOtRate).toFixed(2));
  
  const bonus = Math.max(0, Number(emp.bonus) || 0);
  const commission = Math.max(0, Number(emp.commission) || 0);
  const allowances = Math.max(0, Number(emp.allowances) || 0);
  
  // Gross Pay calculation
  const grossPay = Number((basic + otPay + bonus + commission + allowances).toFixed(2));
  
  // Statutory deductions
  const statutory = calculateFullPayrollByCountry(country, { grossIncome: grossPay, frequency: 'monthly' });
  const nis = statutory.employeeNIS;
  const healthSurcharge = statutory.healthSurcharge;
  const paye = statutory.payeTax;
  const otherDeductions = Math.max(0, Number(emp.otherDeductions) || 0);
  
  // Total deductions
  const totalDeductions = Number((paye + nis + healthSurcharge + otherDeductions).toFixed(2));
  
  // Net Pay calculation
  const netPay = Math.max(0, Number((grossPay - totalDeductions).toFixed(2)));
  
  return {
    ...emp,
    basicPay: basic,
    overtimeHours: otHours,
    overtimeRate: calculatedOtRate,
    bonus,
    commission,
    allowances,
    grossPay,
    paye,
    nis,
    healthSurcharge,
    otherDeductions,
    netPay,
  };
}

// Recalculate entire Payroll Run
export function recalculatePayrollRun(run: PayrollRun): PayrollRun {
  const country = (run.countryCode || (run.currency === 'BBD' ? 'BB' : run.currency === 'BZD' ? 'BZ' : run.currency === 'XCD' ? 'LC' : 'TT')) as CountryCode;
  const updatedEmployees = run.employees.map((emp) => recalculateEmployee(emp, country));
  
  const grossPay = updatedEmployees.reduce((sum, e) => sum + e.grossPay, 0);
  const payeTotal = updatedEmployees.reduce((sum, e) => sum + e.paye, 0);
  const nisTotal = updatedEmployees.reduce((sum, e) => sum + e.nis, 0);
  const hsTotal = updatedEmployees.reduce((sum, e) => sum + e.healthSurcharge, 0);
  const otherDeductionsTotal = updatedEmployees.reduce((sum, e) => sum + e.otherDeductions, 0);
  const totalDeductions = payeTotal + nisTotal + hsTotal + otherDeductionsTotal;
  const netPay = grossPay - totalDeductions;
  
  return {
    ...run,
    employees: updatedEmployees,
    employeesCount: updatedEmployees.length,
    grossPay: Number(grossPay.toFixed(2)),
    payeTotal: Number(payeTotal.toFixed(2)),
    nisTotal: Number(nisTotal.toFixed(2)),
    hsTotal: Number(hsTotal.toFixed(2)),
    otherDeductionsTotal: Number(otherDeductionsTotal.toFixed(2)),
    totalDeductions: Number(totalDeductions.toFixed(2)),
    netPay: Number(netPay.toFixed(2)),
  };
}

// Currency formatting utility
export function formatCurrency(amount: number, symbol = '$'): string {
  return `${symbol}${amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
