import { BusinessDetails, Employee, PayrollRun, PayslipCustomization } from '../types';
import { recalculateEmployee, recalculatePayrollRun } from './taxEngine';

export const initialBusinessDetails: BusinessDetails = {
  name: 'My Business Ltd',
  logo: '',
  address: 'Port of Spain, Trinidad & Tobago',
  phone: '',
  email: '',
  taxRegistrationId: '',
  nisNumber: '',
  currency: 'TTD',
  currencySymbol: '$',
  signatoryName: '',
  signatoryTitle: '',
  signatureUrl: '',
};

export const defaultPayslipCustomization: PayslipCustomization = {
  templateId: 'template_01',
  primaryColor: '#059669', // Sheetpay emerald
  accentColor: '#10b981',
  showCompanyLogo: true,
  showSignature: true,
  showYTD: true,
  showBankDetails: true,
  showTaxId: true,
  showQrVerification: true,
};

const rawEmployees: Omit<Employee, 'grossPay' | 'paye' | 'nis' | 'healthSurcharge' | 'netPay'>[] = [];

export const initialEmployees: Employee[] = rawEmployees.map((e) => recalculateEmployee(e as Employee));

export const initialAugustPayrollRun: PayrollRun = recalculatePayrollRun({
  id: 'run-august-2026',
  periodLabel: 'August 2026 Payroll',
  month: 'August',
  year: 2026,
  payDate: 'August 28, 2026',
  periodStart: 'August 1, 2026',
  periodEnd: 'August 31, 2026',
  currency: 'TTD',
  currencySymbol: '$',
  status: 'draft',
  employeesCount: 0,
  grossPay: 0,
  totalTax: 0,
  totalNis: 0,
  totalHealthSurcharge: 0,
  totalDeductions: 0,
  netPay: 0,
  payeTotal: 0,
  nisTotal: 0,
  hsTotal: 0,
  otherDeductionsTotal: 0,
  employees: [],
  createdAt: new Date().toISOString(),
});
