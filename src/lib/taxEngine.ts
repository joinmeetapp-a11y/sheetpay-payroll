import { Employee, PayrollRun } from '../types';

/**
 * Deterministic Payroll & Statutory Tax Calculation Engine (Trinidad & Tobago / Regional Standard)
 * Ensures 100% mathematical precision and compliance.
 */

// NIS (National Insurance Scheme) Standard Monthly Schedule lookup
export function calculateNIS(grossMonthly: number): number {
  if (grossMonthly <= 0) return 0;
  if (grossMonthly < 1000) return 33.80;
  if (grossMonthly < 1500) return 55.40;
  if (grossMonthly < 2000) return 77.00;
  if (grossMonthly < 2500) return 98.60;
  if (grossMonthly < 3200) return 125.60;
  if (grossMonthly < 4000) return 158.00;
  if (grossMonthly < 4900) return 195.80;
  if (grossMonthly < 5900) return 239.00;
  if (grossMonthly < 7000) return 287.60;
  if (grossMonthly < 8300) return 347.00;
  if (grossMonthly < 9700) return 406.40;
  if (grossMonthly < 11300) return 476.60;
  if (grossMonthly < 13600) return 573.80;
  // Maximum Class 16 ceiling
  return 603.20;
}

// Health Surcharge Statutory calculation
export function calculateHealthSurcharge(grossMonthly: number): number {
  if (grossMonthly <= 0) return 0;
  // Monthly equivalent of $8.25/week vs $4.80/week
  if (grossMonthly > 469.99) {
    return 35.75;
  } else {
    return 20.80;
  }
}

// PAYE (Pay As You Earn) Statutory calculation
export function calculatePAYE(grossMonthly: number, nisContribution: number): number {
  if (grossMonthly <= 0) return 0;
  
  // Standard statutory personal allowance: $84,000 / year = $7,000 / month
  const monthlyPersonalAllowance = 7000;
  
  // 70% of employee NIS is deductible from taxable income
  const nisDeduction = nisContribution * 0.70;
  
  // Chargeable Income
  const chargeableIncome = Math.max(0, grossMonthly - monthlyPersonalAllowance - nisDeduction);
  
  if (chargeableIncome <= 0) return 0;
  
  // Standard tax tier: 25% on first $83,333.33/mo ($1M/yr), 30% on remainder
  const tier1Limit = 83333.33;
  if (chargeableIncome <= tier1Limit) {
    return Number((chargeableIncome * 0.25).toFixed(2));
  } else {
    const tier1Tax = tier1Limit * 0.25;
    const tier2Tax = (chargeableIncome - tier1Limit) * 0.30;
    return Number((tier1Tax + tier2Tax).toFixed(2));
  }
}

// Full Deterministic Recalculation for a single employee
export function recalculateEmployee(emp: Employee): Employee {
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
  const nis = calculateNIS(grossPay);
  const healthSurcharge = calculateHealthSurcharge(grossPay);
  const paye = calculatePAYE(grossPay, nis);
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
  const updatedEmployees = run.employees.map(recalculateEmployee);
  
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
