export type PayrollStatus = 'draft' | 'under_review' | 'finalized' | 'paid';

export type EmployeeStatus = 'draft' | 'pending' | 'approved' | 'paid';

export type AccountType = 'business' | 'accountant' | 'payroll_pro';

export type PayrollQueueStatus =
  | 'Not Started'
  | 'Waiting on Client'
  | 'Missing Information'
  | 'Ready to Run'
  | 'Cayla Working'
  | 'Needs Review'
  | 'Ready for Approval'
  | 'Approved'
  | 'Finalized'
  | 'Payslips Sent'
  | 'Tax Forms Ready'
  | 'Completed';

export interface AccountantClient {
  id: string;
  name: string;
  companyName?: string;
  country: string;
  countryCode: string;
  currency: string;
  currencySymbol: string;
  payFrequency: 'monthly' | 'fortnightly' | 'weekly';
  payrollSchedule?: 'monthly' | 'fortnightly' | 'weekly';
  employeeCount: number;
  nextPayrollDate: string;
  payrollStatus: PayrollQueueStatus;
  missingInformation?: string[];
  lastPayroll?: string;
  monthlyPayrollValue: number;
  totalMonthlyPayroll?: number;
  assignedTo: string;
  assignedToAvatar?: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  businessAddress: string;
  taxRegistrationId: string;
  nisNumber: string;
  signatoryName: string;
  signatoryTitle: string;
  approvalStatus?: 'not_requested' | 'waiting_approval' | 'client_approved' | 'rejected';
  clientPermissions?: string[];
  anomalies?: string[];
  employees: Employee[];
  payrollRun: PayrollRun | null;
  payrollRuns?: PayrollRun[];
  notes?: string;
}

export type FirmRole =
  | 'Firm Owner'
  | 'Admin'
  | 'Payroll Manager'
  | 'Accountant'
  | 'Payroll Clerk'
  | 'Viewer';

export interface FirmTeamMember {
  id: string;
  name: string;
  email: string;
  avatar: string;
  role: FirmRole;
  assignedClientIds: string[];
  assignedClientCount: number;
  status: 'active' | 'invited';
  addedAt?: string;
}

export interface ClientInvitation {
  id: string;
  clientId: string;
  clientName: string;
  recipientEmail: string;
  recipientName: string;
  role: 'Client Admin' | 'Client Reviewer' | 'Client Approver' | 'Client Viewer';
  permissions: string[];
  sentAt: string;
  status: 'pending' | 'accepted' | 'expired';
}

export interface BatchPayrollJob {
  id: string;
  clientId?: string;
  clientName?: string;
  name?: string;
  periodLabel?: string;
  clientIds?: string[];
  country?: string;
  employeeCount?: number;
  status: 'pending' | 'calculating' | 'completed' | 'waiting_info' | 'error';
  grossPay?: number;
  netPay?: number;
  logMessage?: string;
  errorReason?: string;
  createdAt?: string;
  completedAt?: string;
  totalClients?: number;
  clientsProcessed?: number;
  errorsCount?: number;
}

export interface AttentionItem {
  id: string;
  clientId: string;
  clientName: string;
  type: 'missing_timesheet' | 'missing_tax_id' | 'overtime_surge' | 'approval_needed' | 'deadline_soon';
  severity: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  actionLabel: string;
  actionType: 'run_payroll' | 'request_info' | 'review' | 'fix_data' | 'ask_cayla';
}

export interface Employee {
  id: string;
  name: string;
  employeeId: string;
  position: string;
  department: string;
  avatar: string;
  email: string;
  phone: string;
  birNumber?: string; // BIR Tax ID (Board of Inland Revenue)
  ssnNumber?: string; // SSN / NIS Number (National Insurance / Social Security)
  payFrequency?: 'monthly' | 'fortnightly' | 'weekly';
  frequencySalary?: number; // Salary as entered per frequency
  basicPay: number; // Monthly equivalent basic pay for tax calculation
  overtimeHours: number;
  overtimeRate: number; // Hourly rate
  bonus: number;
  commission: number;
  allowances: number;
  paye: number;
  nis: number;
  healthSurcharge: number;
  otherDeductions: number;
  grossPay: number;
  netPay: number;
  status: EmployeeStatus;
  changedFields?: string[]; // For highlight animations
  notes?: string;
  bankName?: string;
  accountNumber?: string;
  ytdGross?: number;
  ytdPaye?: number;
  ytdNis?: number;
}

export interface BusinessDetails {
  name: string;
  logo?: string;
  address: string;
  phone: string;
  email: string;
  taxRegistrationId: string;
  nisNumber?: string;
  currency: string;
  currencySymbol: string;
  signatoryName?: string;
  signatoryTitle?: string;
  signatureUrl?: string;
}

export interface PayrollRun {
  id: string;
  month: string;
  year: number;
  periodLabel: string;
  periodStart?: string;
  periodEnd?: string;
  payDate: string;
  currency: string;
  currencySymbol: string;
  employeesCount: number;
  grossPay: number;
  totalTax: number;
  totalPaye?: number;
  payeTotal?: number;
  totalNis: number;
  nisTotal?: number;
  totalHealthSurcharge: number;
  hsTotal?: number;
  totalDeductions: number;
  otherDeductionsTotal?: number;
  netPay: number;
  status: PayrollStatus;
  createdAt: string;
  finalizedAt?: string;
  employees: Employee[];
}

export type TemplateId =
  | 'template_01'
  | 'template_02'
  | 'template_03'
  | 'template_04'
  | 'template_05'
  | 'template_06'
  | 'template_07'
  | 'template_08'
  | 'template_09'
  | 'template_10'
  | 'template_11'
  | 'template_12';

export interface PayslipCustomization {
  templateId: TemplateId;
  primaryColor: string;
  accentColor: string;
  fontFamily?: 'sans' | 'serif' | 'mono';
  showCompanyLogo: boolean;
  showSignature: boolean;
  showYTD: boolean;
  showBankDetails: boolean;
  showTaxId: boolean;
  showQrVerification: boolean;
}

export interface CaylaMessage {
  id: string;
  sender: 'user' | 'cayla';
  text: string;
  timestamp: string;
  isAudio?: boolean;
  progressSteps?: string[];
  activeStepIndex?: number;
  isWorking?: boolean;
  actionSummary?: {
    type: 'payroll_run' | 'employee_update' | 'tax_check' | 'payslip_ready' | 'timesheet_imported' | 'email_sent';
    title: string;
    description: string;
    details?: Array<{ label: string; value: string }>;
  };
  confirmationRequired?: {
    title: string;
    description: string;
    confirmAction: string;
    cancelAction: string;
    payload?: any;
  };
  undoAction?: {
    id: string;
    employeeName: string;
    field: string;
    previousValue: number | string;
    newValue: number | string;
  };
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  actor: 'cayla' | 'user';
  action: string;
  employeeName?: string;
  employeeId?: string;
  field?: string;
  previousValue?: string | number;
  newValue?: string | number;
  reversible: boolean;
}

export interface AttachmentUpload {
  id: string;
  name: string;
  type: 'timesheet' | 'payslip' | 'csv_roster' | 'other';
  size: string;
  status: 'processing' | 'ready';
  data?: any;
}

export type ImportConfidenceLevel = 'verified' | 'needs_review' | 'missing';

export interface ImportFieldConfidence<T = any> {
  value: T;
  sourceFile: string;
  sourceLocation?: string;
  confidence: number;
  status: ImportConfidenceLevel;
  reason?: string;
}

export interface ExtractedEmployee {
  rawId: string;
  rawName: string;
  name: ImportFieldConfidence<string>;
  employeeId: ImportFieldConfidence<string>;
  position: ImportFieldConfidence<string>;
  department: ImportFieldConfidence<string>;
  avatar?: string;
  email?: ImportFieldConfidence<string>;
  phone?: ImportFieldConfidence<string>;
  basicSalary: ImportFieldConfidence<number>;
  payFrequency: ImportFieldConfidence<'monthly' | 'fortnightly' | 'weekly'>;
  allowances: ImportFieldConfidence<number>;
  allowanceIsRecurring?: boolean;
  overtime: ImportFieldConfidence<number>;
  bonus: ImportFieldConfidence<number>;
  commission?: ImportFieldConfidence<number>;
  paye: ImportFieldConfidence<number>;
  nis: ImportFieldConfidence<number>;
  healthSurcharge: ImportFieldConfidence<number>;
  otherDeductions: ImportFieldConfidence<number>;
  grossPay: ImportFieldConfidence<number>;
  netPay: ImportFieldConfidence<number>;
  birNumber: ImportFieldConfidence<string>;
  nisNumber: ImportFieldConfidence<string>;
  bankName?: ImportFieldConfidence<string>;
  accountNumber?: ImportFieldConfidence<string>;
  ytdGross?: ImportFieldConfidence<number>;
  ytdPaye?: ImportFieldConfidence<number>;
  ytdNis?: ImportFieldConfidence<number>;
  periodsFound: string[];
  sourceFiles: string[];
  status: 'ready' | 'needs_review' | 'resolved';
  isDuplicate?: boolean;
  duplicateMatchId?: string;
}

export interface ExtractedPayrollPeriod {
  id: string;
  periodLabel: string;
  month: string;
  year: number;
  payDate: string;
  employeeCount: number;
  grossPay: number;
  netPay: number;
  totalPaye: number;
  totalNis: number;
  totalHealthSurcharge: number;
  totalOtherDeductions: number;
  sourceFile: string;
  records: Array<{
    employeeName: string;
    employeeId?: string;
    position?: string;
    basicPay: number;
    overtimeHours?: number;
    allowances?: number;
    bonus?: number;
    grossPay: number;
    paye: number;
    nis: number;
    healthSurcharge: number;
    otherDeductions?: number;
    netPay: number;
  }>;
}

export interface ImportAttentionQuestion {
  id: string;
  question: string;
  type: 'duplicate' | 'recurrence' | 'missing_info' | 'period_disambiguation';
  employeeName?: string;
  fieldName?: string;
  options: Array<{ label: string; value: any; isPrimary?: boolean }>;
  resolved: boolean;
  chosenValue?: any;
}

export interface ImportExtractionResult {
  businessName?: ImportFieldConfidence<string>;
  taxId?: ImportFieldConfidence<string>;
  nisEmployerId?: ImportFieldConfidence<string>;
  currency?: string;
  currencySymbol?: string;
  employees: ExtractedEmployee[];
  periods: ExtractedPayrollPeriod[];
  sourceFiles: Array<{
    name: string;
    size: string;
    type: string;
    status: 'processed' | 'warning' | 'error';
    error?: string;
    recordsExtracted?: number;
  }>;
  summary: {
    totalEmployees: number;
    totalPeriods: number;
    totalPayslips: number;
    historicalGrossPayroll: number;
    salariesFound: number;
    employeeIdsFound: number;
    nisFound: number;
    missingNisCount: number;
    needsReviewCount: number;
    missingFieldsCount: number;
    duplicatesCount: number;
  };
  attentionQuestions: ImportAttentionQuestion[];
}
