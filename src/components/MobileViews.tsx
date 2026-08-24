import React, { useState } from 'react';
import {
  AccountType,
  BusinessDetails,
  Employee,
  PayrollRun,
  PayslipCustomization,
} from '../types';
import { formatCurrency, recalculateEmployee } from '../lib/taxEngine';
import {
  LayoutDashboard,
  Users,
  Sparkles,
  FileSpreadsheet,
  Settings,
  X,
  ChevronLeft,
  ChevronRight,
  Download,
  Mail,
  Share2,
  Edit3,
  Sliders,
  Send,
  Mic,
  DollarSign,
  ChevronDown,
  ChevronUp,
  CalendarDays,
  FileCheck2,
  FileBarChart,
  Clock3,
  Menu,
  Building2,
  Layers,
  LogOut,
} from 'lucide-react';
import { PayslipPreview } from './PayslipPreview';
import { CaylaPenMascot } from './CaylaPenMascot';

interface MobileBottomNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  onCaylaClick: () => void;
  accountType?: AccountType;
  onOpenBatchPayroll?: () => void;
  clientsCount?: number;
  onOpenLanding?: () => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  onTabChange,
  onCaylaClick,
  accountType = 'business',
  onOpenBatchPayroll,
  clientsCount = 0,
  onOpenLanding,
}) => {
  const [showMoreDrawer, setShowMoreDrawer] = useState(false);
  const isAccountant = accountType === 'accountant';

  const accountantPracticeTabs = [
    { id: 'accountant_dashboard', label: 'Practice Command', icon: LayoutDashboard },
    { id: 'accountant_clients', label: 'Client Directory', icon: Building2 },
    { id: 'accountant_batch', label: 'Batch Payroll Runs', icon: Layers },
    { id: 'accountant_team', label: 'Firm Staff & Roles', icon: Users },
    { id: 'accountant_reports', label: 'Portfolio Reports', icon: FileBarChart },
  ];

  const standardTabs = [
    { id: 'dashboard', label: 'Dashboard / Overview', icon: LayoutDashboard },
    { id: 'employees', label: 'Employees', icon: Users },
    { id: 'payroll_runs', label: 'Payroll Runs', icon: CalendarDays },
    { id: 'payslips', label: 'Payslips', icon: FileSpreadsheet },
    { id: 'tax_forms', label: 'Tax Forms (TD4)', icon: FileCheck2 },
    { id: 'reports', label: 'Reports & Analytics', icon: FileBarChart },
    { id: 'attendance', label: 'Attendance & OT', icon: Clock3 },
    { id: 'settings', label: 'Company Settings', icon: Settings },
  ];

  const handleTabClick = (tabId: string) => {
    if (tabId === 'accountant_batch' && onOpenBatchPayroll) {
      onOpenBatchPayroll();
    } else {
      onTabChange(tabId);
    }
    setShowMoreDrawer(false);
  };

  return (
    <>
      {/* Expanded Tab Drawer on Mobile when user clicks More */}
      {showMoreDrawer && (
        <div className="md:hidden fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex flex-col justify-end animate-in fade-in">
          <div className="bg-white rounded-t-3xl max-h-[85vh] overflow-y-auto p-6 shadow-2xl space-y-4 border-t border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center shadow-2xs">
                  <CaylaPenMascot size="xs" />
                </div>
                <div>
                  <h2 className="font-bold text-slate-900 text-sm">
                    {isAccountant ? 'Accountant Command Center' : 'Sheetpay Navigation'}
                  </h2>
                  <p className="text-[11px] text-slate-500">Switch application view</p>
                </div>
              </div>
              <button
                onClick={() => setShowMoreDrawer(false)}
                className="p-2 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {isAccountant && (
              <div className="space-y-2">
                <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Practice Management
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  {accountantPracticeTabs.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => handleTabClick(tab.id)}
                        className={`flex items-center gap-2.5 p-3 rounded-2xl text-left text-xs font-bold transition-all cursor-pointer ${
                          isActive
                            ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                            : 'bg-emerald-50/50 hover:bg-emerald-50 text-emerald-950 border border-emerald-200/80'
                        }`}
                      >
                        <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-emerald-700'}`} />
                        <span className="truncate">{tab.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="space-y-2 pt-2 border-t border-slate-100">
              <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                {isAccountant ? 'Client Workspace' : 'All Views'}
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                {standardTabs.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => handleTabClick(tab.id)}
                      className={`flex items-center gap-2.5 p-3 rounded-2xl text-left text-xs font-bold transition-all cursor-pointer ${
                        isActive
                          ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                          : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/80'
                      }`}
                    >
                      <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-emerald-600'}`} />
                      <span className="truncate">{tab.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Logout / Exit Button in Mobile Drawer */}
            {onOpenLanding && (
              <div className="pt-2 border-t border-slate-100">
                <button
                  id="mobile-drawer-logout-btn"
                  onClick={() => {
                    setShowMoreDrawer(false);
                    onOpenLanding();
                  }}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl text-xs font-bold bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 transition-all cursor-pointer active:scale-98"
                >
                  <LogOut className="w-4 h-4 text-rose-600" />
                  <span>Log Out</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main Interactive Floating Bottom Pill Menu */}
      <div className="md:hidden fixed bottom-4 inset-x-0 z-40 flex justify-center px-4 pointer-events-none">
        <div className="pointer-events-auto bg-gradient-to-b from-white/95 to-slate-100/95 backdrop-blur-xl rounded-full px-4 py-2 shadow-2xl shadow-slate-900/15 border border-slate-200/90 flex items-center gap-3 sm:gap-4 ring-1 ring-slate-200/80 transition-all">
          {/* 1. Main View (Practice or Business Dashboard) */}
          <button
            id="mobile-nav-home"
            onClick={() => onTabChange(isAccountant ? 'accountant_dashboard' : 'dashboard')}
            className={`p-2.5 rounded-full transition-all active:scale-90 cursor-pointer relative group ${
              activeTab === 'dashboard' || activeTab === 'accountant_dashboard'
                ? 'bg-emerald-100/90 text-emerald-800 ring-1 ring-emerald-400/80 shadow-xs'
                : 'text-emerald-600 hover:text-emerald-800 hover:bg-slate-200/60'
            }`}
            aria-label={isAccountant ? 'Practice Dashboard' : 'Dashboard'}
          >
            <LayoutDashboard className="w-6 h-6 text-emerald-600 group-hover:text-emerald-800" />
            {(activeTab === 'dashboard' || activeTab === 'accountant_dashboard') && (
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-emerald-600 rounded-full" />
            )}
          </button>

          {/* 2. Directory (Clients in Accountant Mode, Employees in Business Mode) */}
          <button
            id="mobile-nav-directory"
            onClick={() => onTabChange(isAccountant ? 'accountant_clients' : 'employees')}
            className={`p-2.5 rounded-full transition-all active:scale-90 cursor-pointer relative group ${
              activeTab === 'employees' || activeTab === 'accountant_clients'
                ? 'bg-emerald-100/90 text-emerald-800 ring-1 ring-emerald-400/80 shadow-xs'
                : 'text-emerald-600 hover:text-emerald-800 hover:bg-slate-200/60'
            }`}
            aria-label={isAccountant ? 'Clients' : 'Employees'}
          >
            {isAccountant ? (
              <Building2 className="w-6 h-6 text-emerald-600 group-hover:text-emerald-800" />
            ) : (
              <Users className="w-6 h-6 text-emerald-600 group-hover:text-emerald-800" />
            )}
            {(activeTab === 'employees' || activeTab === 'accountant_clients') && (
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-emerald-600 rounded-full" />
            )}
          </button>

          {/* 3. Center Cayla AI Pill Button with Animated Pen Mascot */}
          <button
            id="mobile-nav-cayla-center"
            onClick={() => {
              if (isAccountant) {
                onTabChange('accountant_dashboard');
              } else {
                onTabChange('dashboard');
              }
              onCaylaClick();
            }}
            className="w-14 h-14 -my-4 rounded-full bg-emerald-600 p-0.5 text-slate-950 flex items-center justify-center shadow-xl shadow-emerald-600/30 transform hover:scale-105 active:scale-90 transition-all cursor-pointer relative group ring-2 ring-white"
            aria-label="Ask Cayla"
          >
            <div className="w-full h-full rounded-full overflow-hidden relative ring-1 ring-slate-200 bg-slate-50 flex items-center justify-center">
              <CaylaPenMascot size="lg" showStatusDot={false} isProcessing={false} />
              <span className="absolute -bottom-0.5 right-0.5 w-3.5 h-3.5 bg-emerald-600 rounded-full ring-1.5 ring-white flex items-center justify-center">
                <Sparkles className="w-2 h-2 text-white" />
              </span>
            </div>
          </button>

          {/* 4. Action / Reports (Batch Runs / Reports for Accountant, Payslips for Business) */}
          <button
            id="mobile-nav-action-tab"
            onClick={() => {
              if (isAccountant) {
                if (onOpenBatchPayroll) {
                  onOpenBatchPayroll();
                } else {
                  onTabChange('accountant_reports');
                }
              } else {
                onTabChange('payslips');
              }
            }}
            className={`p-2.5 rounded-full transition-all active:scale-90 cursor-pointer relative group ${
              (isAccountant ? activeTab === 'accountant_reports' : activeTab === 'payslips')
                ? 'bg-emerald-100/90 text-emerald-800 ring-1 ring-emerald-400/80 shadow-xs'
                : 'text-emerald-600 hover:text-emerald-800 hover:bg-slate-200/60'
            }`}
            aria-label={isAccountant ? 'Batch / Reports' : 'Payslips'}
          >
            {isAccountant ? (
              <Layers className="w-6 h-6 text-emerald-600 group-hover:text-emerald-800" />
            ) : (
              <FileSpreadsheet className="w-6 h-6 text-emerald-600 group-hover:text-emerald-800" />
            )}
            {(isAccountant ? activeTab === 'accountant_reports' : activeTab === 'payslips') && (
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-emerald-600 rounded-full" />
            )}
          </button>

          {/* 5. More Tabs Menu Drawer */}
          <button
            id="mobile-nav-more"
            onClick={() => setShowMoreDrawer(true)}
            className={`p-2.5 rounded-full transition-all active:scale-90 cursor-pointer relative group ${
              showMoreDrawer
                ? 'bg-emerald-100/90 text-emerald-800 ring-1 ring-emerald-400/80 shadow-xs'
                : 'text-emerald-600 hover:text-emerald-800 hover:bg-slate-200/60'
            }`}
            aria-label="All Tabs"
          >
            <Menu className="w-6 h-6 text-emerald-600 group-hover:text-emerald-800" />
          </button>
        </div>
      </div>
    </>
  );
};

interface MobilePayrollCardsProps {
  payroll: PayrollRun;
  onSelectEmployee: (empId: string) => void;
  onViewPayslipModal: (emp: Employee) => void;
  onUpdateEmployee: (emp: Employee) => void;
}

export const MobilePayrollCards: React.FC<MobilePayrollCardsProps> = ({
  payroll,
  onSelectEmployee,
  onViewPayslipModal,
  onUpdateEmployee,
}) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="md:hidden space-y-3 px-4 pb-24">
      {/* Mobile Summary Banner */}
      <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-slate-400 font-medium">{payroll.periodLabel}</span>
          <span className="text-[10px] bg-amber-400/20 text-amber-300 font-semibold px-2 py-0.5 rounded uppercase">
            {payroll.status}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <div className="text-slate-400 text-[10px]">Gross Pay</div>
            <div className="text-sm font-bold font-mono">{formatCurrency(payroll.grossPay)}</div>
          </div>
          <div>
            <div className="text-emerald-400 text-[10px]">Net Disbursement</div>
            <div className="text-sm font-bold font-mono text-emerald-400">
              {formatCurrency(payroll.netPay)}
            </div>
          </div>
        </div>
      </div>

      {/* Employee Mobile Cards */}
      {payroll.employees.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-8 text-center space-y-2">
          <Users className="w-10 h-10 text-slate-300 mx-auto" />
          <h4 className="text-sm font-bold text-slate-800">No staff members in current payroll</h4>
          <p className="text-xs text-slate-500">Add employees to start processing payroll disbursements.</p>
        </div>
      ) : (
        payroll.employees.map((emp) => {
          const isExpanded = expandedId === emp.id;
          const totalDeds = (emp.paye || 0) + (emp.nis || 0) + (emp.healthSurcharge || 0) + (emp.otherDeductions || 0);

          return (
            <div
              key={emp.id}
              className={`bg-white rounded-xl border p-4 shadow-2xs transition-all ${
                isExpanded ? 'border-emerald-500 ring-1 ring-emerald-500/30' : 'border-slate-200'
              }`}
            >
              {/* Main Header Row */}
              <div
                className="flex items-center justify-between cursor-pointer"
                onClick={() => {
                  setExpandedId(isExpanded ? null : emp.id);
                  onSelectEmployee(emp.id);
                }}
              >
                <div className="flex items-center gap-3">
                  <img
                    src={emp.avatar}
                    alt={emp.name}
                    className="w-10 h-10 rounded-full object-cover ring-1 ring-slate-200"
                  />
                  <div>
                    <div className="font-semibold text-slate-900 text-sm">{emp.name}</div>
                    <div className="text-xs text-slate-500">{emp.position}</div>
                  </div>
                </div>
                {isExpanded ? (
                  <ChevronUp className="w-5 h-5 text-slate-400" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-slate-400" />
                )}
              </div>

              {/* Quick Metrics Grid */}
              <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-slate-100 text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 block">Gross</span>
                  <span className="font-mono font-medium text-slate-800">
                    {formatCurrency(emp.grossPay || 0)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Overtime</span>
                  <span className="font-mono font-medium text-slate-800">{emp.overtimeHours || 0} hrs</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Deductions</span>
                  <span className="font-mono font-medium text-rose-600">
                    {formatCurrency(totalDeds)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-semibold text-emerald-800">
                    Net Pay
                  </span>
                  <span className="font-mono font-bold text-emerald-700 text-sm">
                    {formatCurrency(emp.netPay || 0)}
                  </span>
                </div>
              </div>

              {/* View Payslip CTA */}
              <div className="mt-3 pt-2 flex items-center justify-between gap-2">
                <button
                  onClick={() => onViewPayslipModal(emp)}
                  className="flex-1 py-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-semibold text-center transition-colors"
                >
                  View Full Payslip
                </button>
              </div>

            {/* Expanded Inline Editor for Mobile */}
            {isExpanded && (
              <div className="mt-3 pt-3 border-t border-slate-100 space-y-2.5 text-xs">
                <div className="font-semibold text-slate-700 text-[11px] uppercase">
                  Quick Adjustments
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-500 block mb-1">Overtime (hrs)</label>
                    <input
                      type="number"
                      value={emp.overtimeHours}
                      onChange={(e) => {
                        const val = Math.max(0, parseFloat(e.target.value) || 0);
                        onUpdateEmployee(recalculateEmployee({ ...emp, overtimeHours: val }));
                      }}
                      className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-slate-50 font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 block mb-1">Bonus ($)</label>
                    <input
                      type="number"
                      value={emp.bonus}
                      onChange={(e) => {
                        const val = Math.max(0, parseFloat(e.target.value) || 0);
                        onUpdateEmployee(recalculateEmployee({ ...emp, bonus: val }));
                      }}
                      className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-slate-50 font-mono"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })
      )}
    </div>
  );
};

interface MobilePayslipModalProps {
  isOpen: boolean;
  onClose: () => void;
  employee: Employee;
  allEmployees: Employee[];
  onSelectEmployee: (emp: Employee) => void;
  payroll: PayrollRun;
  business: BusinessDetails;
  customization: PayslipCustomization;
  onUpdateCustomization: (c: Partial<PayslipCustomization>) => void;
  onOpenEmailModal: (emp: Employee) => void;
  onOpenBusinessEditModal: () => void;
}

export const MobilePayslipModal: React.FC<MobilePayslipModalProps> = ({
  isOpen,
  onClose,
  employee,
  allEmployees,
  onSelectEmployee,
  payroll,
  business,
  customization,
  onUpdateCustomization,
  onOpenEmailModal,
  onOpenBusinessEditModal,
}) => {
  if (!isOpen) return null;

  const currentIndex = allEmployees.findIndex((e) => e.id === employee.id);

  const handlePrev = () => {
    if (currentIndex > 0) {
      onSelectEmployee(allEmployees[currentIndex - 1]);
    }
  };

  const handleNext = () => {
    if (currentIndex < allEmployees.length - 1) {
      onSelectEmployee(allEmployees[currentIndex + 1]);
    }
  };

  return (
    <div className="md:hidden fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex flex-col justify-end animate-in fade-in">
      <div className="bg-white rounded-t-2xl max-h-[92vh] flex flex-col w-full overflow-hidden shadow-2xl">
        {/* Modal Top Bar */}
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrev}
              disabled={currentIndex === 0}
              className="p-1 rounded bg-white border border-slate-200 disabled:opacity-30"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-semibold text-slate-800">
              {currentIndex + 1} of {allEmployees.length}
            </span>
            <button
              onClick={handleNext}
              disabled={currentIndex === allEmployees.length - 1}
              className="p-1 rounded bg-white border border-slate-200 disabled:opacity-30"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full bg-slate-200 text-slate-700 hover:bg-slate-300"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Payslip Scrollable View */}
        <div className="flex-1 overflow-y-auto p-4">
          <PayslipPreview
            employee={employee}
            payroll={payroll}
            business={business}
            customization={customization}
            onUpdateCustomization={onUpdateCustomization}
            onOpenEmailModal={onOpenEmailModal}
            onOpenBusinessEditModal={onOpenBusinessEditModal}
          />
        </div>
      </div>
    </div>
  );
};
