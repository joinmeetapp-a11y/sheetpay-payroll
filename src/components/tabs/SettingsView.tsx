import React, { useState } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { AccountType, BusinessDetails, Employee, PayrollRun } from '../../types';
import {
  Settings,
  Building2,
  ShieldCheck,
  UserCheck,
  Save,
  CheckCircle2,
  Lock,
  Layers,
  Sparkles,
  RefreshCw,
  AlertTriangle,
  LogOut,
  FileUp,
  X,
} from 'lucide-react';
import { PayrollImportStep } from '../onboarding/PayrollImportStep';

interface SettingsViewProps {
  business: BusinessDetails;
  onSaveBusiness: (b: BusinessDetails) => void;
  accountType?: AccountType;
  onSwitchAccountType?: (newType: AccountType) => void;
  onLogout?: () => void;
  onImportData?: (biz: BusinessDetails, emps: Employee[], runs: PayrollRun[]) => void;
  onUpgrade?: (plan: 'pro' | 'accountant') => void;
  plan?: 'free' | 'pro' | 'accountant';
  isPro?: boolean;
  currentUid?: string;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  business,
  onSaveBusiness,
  accountType = 'business',
  onSwitchAccountType,
  onLogout,
  onImportData,
  onUpgrade,
  plan = 'free',
  isPro = false,
  currentUid,
}) => {
  // Live usage from Convex. Returns null until the user record exists.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const usage = useQuery((api as any).usage.getMonthlyUsage, currentUid ? { requesterUid: currentUid } : 'skip') as
    | null
    | {
        plan: 'free' | 'pro' | 'accountant';
        payslipsUsed: number;
        payrollRunsUsed: number;
        ocrScansUsed: number;
        caylaActionsUsed: number;
        limits: { payslip: number | null; payroll: number | null; ocr: number | null; cayla: number | null };
      }
    | undefined;
  const isUnlimited = (usage?.plan ?? plan) !== 'free';
  const u = {
    payslip: usage?.payslipsUsed ?? 0,
    payroll: usage?.payrollRunsUsed ?? 0,
    ocr: usage?.ocrScansUsed ?? 0,
  };
  const lim = {
    payslip: usage?.limits?.payslip ?? 10,
    payroll: usage?.limits?.payroll ?? 10,
    ocr: usage?.limits?.ocr ?? 3,
  };
  const pctOf = (used: number, limit: number | null | undefined) =>
    !limit ? 8 : Math.min(100, Math.round((used / limit) * 100));
  const [formData, setFormData] = useState<BusinessDetails>(business);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [showRoleConfirmModal, setShowRoleConfirmModal] = useState(false);
  const [targetAccountType, setTargetAccountType] = useState<AccountType>(accountType);
  const [showImportModal, setShowImportModal] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveBusiness(formData);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleInitiateSwitchRole = (type: AccountType) => {
    if (type === accountType) return;
    setTargetAccountType(type);
    setShowRoleConfirmModal(true);
  };

  const handleConfirmSwitchRole = () => {
    if (onSwitchAccountType) {
      onSwitchAccountType(targetAccountType);
    }
    setShowRoleConfirmModal(false);
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 md:px-8 py-6 space-y-6 select-none animate-in fade-in">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <Settings className="w-7 h-7 text-emerald-600" />
            Organization &amp; Statutory Settings
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Configure legal employer entities, BIR tax registrations, account mode, and statutory rate ceilings.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowImportModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer"
          >
            <FileUp className="w-4 h-4 text-emerald-400" />
            <span>Import Payroll Data</span>
          </button>

          <button
            onClick={handleSubmit}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>Save Changes</span>
          </button>
        </div>
      </div>

      {savedSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-2 text-emerald-800 text-sm font-bold animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          <span>Company profile and statutory configurations successfully saved.</span>
        </div>
      )}

      {/* Account Mode Configuration Card */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <Layers className="w-5 h-5 text-emerald-600" />
            <div>
              <h2 className="text-base font-bold text-slate-900">Account Type &amp; Operating Mode</h2>
              <p className="text-xs text-slate-500">Toggle between single business payroll and multi-client accountant command center.</p>
            </div>
          </div>
          <span
            className={`text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full ${
              accountType === 'accountant'
                ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                : 'bg-slate-100 text-slate-700'
            }`}
          >
            {accountType === 'accountant' ? 'Accountant Mode Active' : 'Single Business Mode'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div
            onClick={() => handleInitiateSwitchRole('business')}
            className={`p-4 rounded-2xl border transition-all cursor-pointer space-y-2 ${
              accountType === 'business'
                ? 'bg-emerald-50/90 border-emerald-500 ring-2 ring-emerald-500/20 shadow-xs'
                : 'bg-slate-50/70 border-slate-200 hover:bg-slate-100'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-emerald-600" />
                <span className="font-extrabold text-sm text-slate-900">Business Owner / Employer</span>
              </div>
              {accountType === 'business' && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
            </div>
            <p className="text-xs text-slate-600">
              Single-company payroll management. Clean, streamlined interface without cross-client practice menus.
            </p>
          </div>

          <div
            onClick={() => handleInitiateSwitchRole('accountant')}
            className={`p-4 rounded-2xl border transition-all cursor-pointer space-y-2 ${
              accountType === 'accountant'
                ? 'bg-emerald-50/90 border-emerald-500 ring-2 ring-emerald-500/20 shadow-xs'
                : 'bg-slate-50/70 border-slate-200 hover:bg-slate-100'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-emerald-600" />
                <span className="font-extrabold text-sm text-slate-900">Accountant / Accounting Firm</span>
              </div>
              {accountType === 'accountant' && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
            </div>
            <p className="text-xs text-slate-600">
              Multi-client practice command center with batch payroll execution, firm staff assignments, and client portal sign-offs.
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Company Identity */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
            <Building2 className="w-5 h-5 text-emerald-600" />
            <h2 className="text-base font-bold text-slate-900">
              {accountType === 'accountant' ? 'Active Entity Profile' : 'Company Legal Identity'}
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Company Registered Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 font-medium"
              />
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1">Currency Code & Symbol</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={formData.currency}
                  onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                  className="w-1/2 px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 font-mono font-bold"
                />
                <input
                  type="text"
                  value={formData.currencySymbol}
                  onChange={(e) => setFormData({ ...formData, currencySymbol: e.target.value })}
                  className="w-1/2 px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 font-mono font-bold"
                />
              </div>
            </div>

            <div className="sm:col-span-2">
              <label className="font-bold text-slate-700 block mb-1">Physical Registered Address</label>
              <input
                type="text"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 font-medium"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Corporate Phone</label>
              <input
                type="text"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 font-medium"
              />
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1">Corporate Billing Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 font-medium"
              />
            </div>
          </div>
        </div>

        {/* Statutory Tax Registrations (T&T) */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
            <h2 className="text-base font-bold text-slate-900">Statutory Tax &amp; Registration Numbers (T&amp;T BIR / NIB)</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Board of Inland Revenue (BIR) Tax ID</label>
              <input
                type="text"
                value={formData.taxRegistrationId}
                onChange={(e) => setFormData({ ...formData, taxRegistrationId: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 font-mono font-bold"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">National Insurance Board (NIB) Employer No.</label>
              <input
                type="text"
                value={formData.nisNumber}
                onChange={(e) => setFormData({ ...formData, nisNumber: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 font-mono font-bold"
              />
            </div>
          </div>

          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 text-xs text-slate-600 space-y-1.5">
            <div className="font-bold text-slate-800 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-emerald-600" />
              Statutory Engine Active Tax Rules
            </div>
            <ul className="list-disc list-inside space-y-0.5 text-slate-500">
              <li>Annual Personal Income Tax Allowance: <strong>TTD $84,000.00 / year ($7,000.00 / month)</strong></li>
              <li>Standard PAYE Rate: <strong>25%</strong> on chargeable income up to $1,000,000 / year (30% thereafter)</li>
              <li>National Insurance (NIS): 16-Band Schedule (Maximum monthly employee contribution: <strong>TTD $478.40</strong>)</li>
              <li>Health Surcharge: <strong>TTD $8.25 / week</strong> ($33.00 / month for 4-week periods)</li>
            </ul>
          </div>
        </div>

        {/* Authorized Signatory */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
            <UserCheck className="w-5 h-5 text-emerald-600" />
            <h2 className="text-base font-bold text-slate-900">Authorized Signatory &amp; Payroll Officer</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Signatory Full Name</label>
              <input
                type="text"
                value={formData.signatoryName}
                onChange={(e) => setFormData({ ...formData, signatoryName: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 font-medium"
              />
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1">Corporate Title</label>
              <input
                type="text"
                value={formData.signatoryTitle}
                onChange={(e) => setFormData({ ...formData, signatoryTitle: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 font-medium"
              />
            </div>
          </div>
        </div>

        {/* Subscription Plan & Usage Quotas */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <Sparkles className="w-5 h-5 text-emerald-600" />
              <div>
                <h2 className="text-base font-bold text-slate-900">Subscription &amp; Monthly Usage Limits</h2>
                <p className="text-xs text-slate-500">Plan allowances, monthly quota meters, and upgrade options.</p>
              </div>
            </div>
            <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
              {plan === 'accountant'
                ? 'Accountant Plan ($197/mo)'
                : plan === 'pro'
                ? 'Business Pro ($97/mo)'
                : 'Free Plan'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <div className="flex justify-between text-slate-700 font-bold">
                <span>Monthly Payslips</span>
                <span>{isUnlimited ? 'Unlimited' : `${u.payslip} / ${lim.payslip} Used`}</span>
              </div>
              <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-600 rounded-full" style={{ width: `${pctOf(u.payslip, lim.payslip)}%` }} />
              </div>
              <p className="text-[11px] text-slate-500">
                {isUnlimited ? 'Unlimited payslips included' : `${lim.payslip} free payslips per month included`}
              </p>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <div className="flex justify-between text-slate-700 font-bold">
                <span>Payroll Runs</span>
                <span>{isUnlimited ? 'Unlimited' : `${u.payroll} / ${lim.payroll} Runs`}</span>
              </div>
              <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-600 rounded-full" style={{ width: `${pctOf(u.payroll, lim.payroll)}%` }} />
              </div>
              <p className="text-[11px] text-slate-500">
                {isUnlimited ? 'Unlimited payroll batches' : `${lim.payroll} payroll calculations per month`}
              </p>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <div className="flex justify-between text-slate-700 font-bold">
                <span>OCR Scans</span>
                <span>{isUnlimited ? 'Unlimited' : `${u.ocr} / ${lim.ocr} Used`}</span>
              </div>
              <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-600 rounded-full" style={{ width: `${pctOf(u.ocr, lim.ocr)}%` }} />
              </div>
              <p className="text-[11px] text-slate-500">
                {isUnlimited ? 'Higher OCR quota included' : `${lim.ocr} monthly OCR scans on the Free plan`}
              </p>
            </div>
          </div>

          {/* Upgrade Banner for Free Plan */}
          {accountType === 'business' && !isPro && (
            <div className="p-4 bg-gradient-to-r from-emerald-500/10 via-emerald-50 to-emerald-50/50 border-2 border-emerald-500/30 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div className="space-y-0.5">
                  <div className="font-extrabold text-xs text-slate-900 flex items-center gap-2">
                    <span>Upgrade to Business Plan</span>
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">$97/mo</span>
                  </div>
                  <p className="text-[11px] text-slate-600">
                    Unlock unlimited payroll runs, unlimited payslips, all 12 templates, full Cayla AI, and 50 OCR scans per month.
                  </p>
                </div>
              </div>
              <button
                onClick={() => onUpgrade ? onUpgrade('pro') : (window.location.href = '/#pricing')}
                className="inline-flex items-center justify-center px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-600/20 transition-all shrink-0 cursor-pointer"
              >
                Upgrade to Business &rarr;
              </button>
            </div>
          )}

          <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="font-bold text-xs text-emerald-950 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Automatic Statutory Tax Engine is 100% Unrestricted</span>
              </div>
              <p className="text-[11px] text-emerald-800">
                Full deterministic NIS, PAYE, and statutory deductions are included across all plans.
              </p>
            </div>
            <a
              href="/#pricing"
              className="inline-flex items-center justify-center px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs transition-colors shrink-0"
            >
              Compare All Plans
            </a>
          </div>

          {/* Account Session & Log Out */}
          {onLogout && (
            <div className="p-4 bg-rose-50/50 border border-rose-200/80 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <div className="font-bold text-xs text-rose-950 flex items-center gap-1.5">
                  <LogOut className="w-3.5 h-3.5 text-rose-600" />
                  <span>Session &amp; Authentication</span>
                </div>
                <p className="text-[11px] text-rose-700">
                  End your current session and sign out of your workspace.
                </p>
              </div>
              <button
                type="button"
                id="settings-logout-btn"
                onClick={onLogout}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors shrink-0 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Log Out</span>
              </button>
            </div>
          )}
        </div>
      </form>

      {/* Role Switch Confirmation Modal */}
      {showRoleConfirmModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl border border-slate-200 space-y-4 animate-in zoom-in-95">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="space-y-1">
              <h3 className="font-black text-lg text-slate-900">
                Switch to {targetAccountType === 'accountant' ? 'Accountant Mode' : 'Single Business Mode'}?
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                {targetAccountType === 'accountant'
                  ? 'This will enable the practice command center, multi-client directory, batch payroll runs, and cross-client Cayla commands.'
                  : 'This will hide multi-client practice tools and focus your workspace exclusively on a single business entity.'}
              </p>
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowRoleConfirmModal(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmSwitchRole}
                className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-md cursor-pointer transition-all"
              >
                Confirm Switch
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Historical Payroll Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-auto animate-in zoom-in-95">
            <div className="bg-slate-50 text-slate-900 px-6 py-4 flex items-center justify-between border-b border-slate-200">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 border border-emerald-200 flex items-center justify-center">
                  <FileUp className="w-4 h-4 text-emerald-700" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900">Import Historical Payroll</h3>
                  <p className="text-[11px] text-slate-500">Migrate spreadsheet or document archives into live Sheetpay records with Cayla</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="p-1.5 rounded-full hover:bg-slate-200 text-slate-500 hover:text-slate-900 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[75vh]">
              <PayrollImportStep
                initialBusiness={business}
                onImportComplete={(importedBiz, importedEmps, importedRuns) => {
                  setFormData(importedBiz);
                  onSaveBusiness(importedBiz);
                  if (onImportData) {
                    onImportData(importedBiz, importedEmps, importedRuns);
                  }
                  setShowImportModal(false);
                }}
                onManualSetup={() => setShowImportModal(false)}
                onBack={() => setShowImportModal(false)}
                isAccountantMode={accountType === 'accountant'}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
