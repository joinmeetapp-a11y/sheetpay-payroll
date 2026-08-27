import React, { useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { X, AlertTriangle } from 'lucide-react';
import { PayrollImportStep } from '../onboarding/PayrollImportStep';
import { BusinessDetails, Employee, PayrollRun, AccountantClient } from '../../types';

interface AccountantImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  firebaseUid?: string;
  onClientImported?: (client: AccountantClient) => void;
  /**
   * When provided, the modal skips the Convex mutations entirely and delegates
   * the save to the parent. Used by the guest funnel so uploaded payroll never
   * touches production tables — only the guest session — while still showing
   * the full extraction → review UX.
   */
  onGuestImport?: (
    business: BusinessDetails,
    employees: Employee[],
    payrollRuns: PayrollRun[]
  ) => void | Promise<void>;
}

const EMPTY_BUSINESS: BusinessDetails = {
  name: '',
  address: '',
  phone: '',
  email: '',
  taxRegistrationId: '',
  currency: 'TTD',
  currencySymbol: '$',
};

export const AccountantImportModal: React.FC<AccountantImportModalProps> = ({
  isOpen,
  onClose,
  firebaseUid,
  onClientImported,
  onGuestImport,
}) => {
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const userRow = useQuery(
    api.users.getByFirebaseUid,
    firebaseUid ? { firebaseUid } : 'skip'
  ) as { _id: any } | null | undefined;

  const createBusiness = useMutation(api.businesses.create);
  const bulkCreateEmployees = useMutation(api.employees.bulkCreate);

  if (!isOpen) return null;

  const handleImportComplete = async (
    business: BusinessDetails,
    employees: Employee[],
    payrollRuns: PayrollRun[],
    _summary: any
  ) => {
    setError(null);

    // Guest funnel — bypass Convex production mutations, delegate to parent.
    if (onGuestImport) {
      setIsSaving(true);
      try {
        await onGuestImport(business, employees, payrollRuns);
        onClose();
      } catch (err: any) {
        setError(err?.message || 'Import failed.');
      } finally {
        setIsSaving(false);
      }
      return;
    }

    if (!userRow?._id) {
      setError('You need to be signed in for Sheetpay to save this client. Nothing was created.');
      return;
    }

    setIsSaving(true);
    try {
      const businessId = await createBusiness({
        userId: userRow._id,
        name: business.name?.trim() || 'Untitled Client',
        address: business.address || undefined,
        phone: business.phone || undefined,
        email: business.email || undefined,
        taxRegistrationId: business.taxRegistrationId || undefined,
        nisNumber: business.nisNumber || undefined,
        signatoryName: business.signatoryName || undefined,
        signatoryTitle: business.signatoryTitle || undefined,
        currency: business.currency || 'TTD',
        currencySymbol: business.currencySymbol || '$',
      });

      if (employees.length > 0) {
        await bulkCreateEmployees({
          businessId,
          userId: userRow._id,
          employees: employees.map((emp) => ({
            id: emp.id,
            name: emp.name,
            employeeId: emp.employeeId,
            position: emp.position,
            department: emp.department,
            avatar: emp.avatar,
            email: emp.email,
            phone: emp.phone,
            payFrequency: emp.payFrequency,
            basicPay: emp.basicPay,
            frequencySalary: emp.frequencySalary,
            overtimeHours: emp.overtimeHours,
            overtimeRate: emp.overtimeRate,
            bonus: emp.bonus,
            commission: emp.commission,
            allowances: emp.allowances,
            paye: emp.paye,
            nis: emp.nis,
            healthSurcharge: emp.healthSurcharge,
            otherDeductions: emp.otherDeductions,
            grossPay: emp.grossPay,
            netPay: emp.netPay,
            status: emp.status,
          })),
        });
      }

      if (onClientImported) {
        const totalMonthly = employees.reduce((s, e) => s + (e.grossPay || 0), 0);
        const client: AccountantClient = {
          id: String(businessId),
          name: business.name?.trim() || 'Untitled Client',
          country: 'Trinidad & Tobago',
          countryCode: 'TT',
          currency: business.currency || 'TTD',
          currencySymbol: business.currencySymbol || '$',
          payFrequency: (employees[0]?.payFrequency as any) || 'monthly',
          employeeCount: employees.length,
          nextPayrollDate: '',
          payrollStatus: employees.length > 0 ? 'Ready to Run' : 'Missing Information',
          lastPayroll: '',
          monthlyPayrollValue: totalMonthly,
          assignedTo: '',
          contactName: business.signatoryName || '',
          contactEmail: business.email || '',
          contactPhone: business.phone || '',
          businessAddress: business.address || '',
          taxRegistrationId: business.taxRegistrationId || '',
          nisNumber: business.nisNumber || '',
          signatoryName: business.signatoryName || '',
          signatoryTitle: business.signatoryTitle || 'Managing Director',
          employees,
          payrollRun: payrollRuns[0] || null,
          payrollRuns,
        };
        onClientImported(client);
      }

      onClose();
    } catch (err: any) {
      const msg = err?.message || String(err);
      if (msg.includes('PLAN_REQUIRED')) {
        setError('Adding another client requires a Pro or Accountant plan. Please upgrade to continue.');
      } else {
        setError(msg || 'Import failed. Please try again.');
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="w-full max-w-6xl max-h-[95vh] bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col animate-in fade-in zoom-in-95">
        <div className="flex items-start justify-between p-5 border-b border-slate-100 shrink-0">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase tracking-wider">
              Upload → Review → Import
            </div>
            <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight mt-1.5">
              Import Client + Employees
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Drop a payroll file. Sheetpay reads it, flags anything uncertain, and only saves once you confirm.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mx-5 mt-4 px-4 py-3 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-2 shrink-0">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div className="overflow-y-auto flex-1">
          <PayrollImportStep
            initialBusiness={EMPTY_BUSINESS}
            onImportComplete={handleImportComplete}
            onManualSetup={onClose}
            isAccountantMode={true}
          />
        </div>

        {isSaving && (
          <div className="border-t border-slate-100 px-5 py-3 text-xs text-slate-600 font-semibold bg-slate-50 shrink-0">
            Saving client and employees to Sheetpay…
          </div>
        )}
      </div>
    </div>
  );
};
