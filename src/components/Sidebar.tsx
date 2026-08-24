import React, { useState } from 'react';
import {
  LayoutDashboard,
  Users,
  CalendarDays,
  FileSpreadsheet,
  FileCheck2,
  FileBarChart,
  Clock3,
  Sparkles,
  Settings,
  Building2,
  Layers,
  ChevronLeft,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { CaylaPenMascot } from './CaylaPenMascot';
import { AccountType } from '../types';

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  isPayrollActive: boolean;
  onOpenCayla: () => void;
  accountType?: AccountType;
  clientsCount?: number;
  employeesCount?: number;
  activeClientName?: string;
  onOpenBatchPayroll?: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onTabChange,
  isPayrollActive,
  onOpenCayla,
  accountType = 'business',
  clientsCount = 0,
  employeesCount = 0,
  activeClientName = 'Your Business',
  onOpenBatchPayroll,
  isCollapsed: controlledIsCollapsed,
  onToggleCollapse,
}) => {
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const isCollapsed = controlledIsCollapsed !== undefined ? controlledIsCollapsed : internalCollapsed;

  const handleToggleCollapse = () => {
    if (onToggleCollapse) {
      onToggleCollapse();
    } else {
      setInternalCollapsed((prev) => !prev);
    }
  };

  const isAccountant = accountType === 'accountant';

  // Accountant Practice Navigation (Business Dashboard is hidden when in Accountant mode)
  const accountantPracticeItems = [
    { id: 'accountant_dashboard', label: 'Practice Command', icon: LayoutDashboard },
    { id: 'accountant_clients', label: 'Client Directory', icon: Building2, badge: clientsCount > 0 ? `${clientsCount}` : undefined },
    { id: 'accountant_batch', label: 'Batch Payroll Runs', icon: Layers },
    { id: 'accountant_team', label: 'Firm Staff & Roles', icon: Users },
    { id: 'accountant_reports', label: 'Portfolio Reports', icon: FileBarChart },
    { id: 'settings', label: 'Practice Settings', icon: Settings },
  ];

  // Standard Business Navigation (Accountant Dashboard is hidden when in Business mode)
  const standardBusinessItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'employees', label: 'Employees', icon: Users, badge: employeesCount > 0 ? `${employeesCount}` : undefined },
    { id: 'payroll_runs', label: 'Payroll Runs', icon: CalendarDays, activeDot: isPayrollActive },
    { id: 'payslips', label: 'Payslips', icon: FileSpreadsheet },
    { id: 'tax_forms', label: 'Tax Forms (TD4)', icon: FileCheck2 },
    { id: 'reports', label: 'Reports & Analytics', icon: FileBarChart },
    { id: 'attendance', label: 'Attendance', icon: Clock3 },
    { id: 'cayla', label: 'Cayla AI', icon: Sparkles, isAi: true },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const currentNavItems = isAccountant ? accountantPracticeItems : standardBusinessItems;

  return (
    <aside
      id="desktop-sidebar"
      className={`hidden md:flex flex-col bg-white border-r border-slate-200 text-slate-700 min-h-screen select-none shrink-0 transition-all duration-300 ease-in-out ${
        isCollapsed ? 'w-20' : 'w-64'
      }`}
    >
      {/* Brand Logo & Collapse Toggle Header */}
      <div className={`h-16 flex items-center border-b border-slate-100 px-3.5 transition-all ${
        isCollapsed ? 'justify-center relative' : 'justify-between px-4'
      }`}>
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            onClick={handleToggleCollapse}
            title={isCollapsed ? 'Expand sidebar' : 'Sheetpay'}
            className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center shadow-2xs shrink-0 cursor-pointer hover:bg-emerald-100 transition-colors"
          >
            <CaylaPenMascot size="xs" showStatusDot={true} />
          </div>
          {!isCollapsed && (
            <div className="flex items-center gap-1.5 overflow-hidden">
              <span className="font-black text-base tracking-tight text-slate-900 truncate">
                Sheetpay
              </span>
              <span className="text-[9px] uppercase font-extrabold tracking-wider bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded-md shrink-0">
                {isAccountant ? 'Practice' : 'Payroll'}
              </span>
            </div>
          )}
        </div>

        {/* Collapse / Expand Button */}
        <button
          onClick={handleToggleCollapse}
          className={`p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer shrink-0 ${
            isCollapsed ? 'absolute -right-3 top-5 bg-white border border-slate-200 shadow-sm rounded-full z-10' : ''
          }`}
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? (
            <ChevronRight className="w-3.5 h-3.5" />
          ) : (
            <ChevronLeft className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 px-2.5 py-3 space-y-1.5 overflow-y-auto overflow-x-hidden">
        {!isCollapsed && (
          <div className="px-3 py-1 text-[10px] font-black uppercase tracking-wider text-slate-400 truncate">
            {isAccountant ? 'Practice Command' : 'Main Menu'}
          </div>
        )}

        {currentNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          const isAi = (item as any).isAi;

          return (
            <button
              key={item.id}
              id={`nav-item-${item.id}`}
              onClick={() => {
                if (item.id === 'accountant_batch' && onOpenBatchPayroll) {
                  onOpenBatchPayroll();
                } else {
                  onTabChange(item.id);
                  if (item.id === 'cayla' || item.id === 'dashboard' || item.id === 'accountant_dashboard') {
                    onOpenCayla();
                  }
                }
              }}
              title={isCollapsed ? item.label : undefined}
              className={`w-full flex items-center rounded-xl text-xs font-bold transition-all duration-150 group cursor-pointer ${
                isCollapsed
                  ? 'justify-center p-3 relative'
                  : 'justify-between px-3.5 py-2.5 text-left'
              } ${
                isActive
                  ? 'text-emerald-900 bg-emerald-50 font-black border border-emerald-300 shadow-2xs'
                  : isAi
                  ? 'text-emerald-700 bg-emerald-50/40 hover:bg-emerald-100/70 border border-emerald-200/50'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3 min-w-0'}`}>
                {isAi ? (
                  <CaylaPenMascot size="xs" showStatusDot={false} />
                ) : (
                  <Icon
                    className={`w-4 h-4 shrink-0 transition-colors ${
                      isActive
                        ? 'text-emerald-700'
                        : 'text-slate-400 group-hover:text-slate-700'
                    }`}
                  />
                )}
                {!isCollapsed && <span className="truncate">{item.label}</span>}
              </div>

              {/* Badges and indicators */}
              {isCollapsed ? (
                // Compact badges for collapsed sidebar
                item.badge ? (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-emerald-600 ring-2 ring-white" />
                ) : (item as any).activeDot ? (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                ) : null
              ) : (
                // Full badges for expanded sidebar
                <div className="flex items-center gap-1.5 shrink-0">
                  {(item as any).activeDot && (
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                  )}
                  {item.badge && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-emerald-100/80 text-emerald-900 font-bold font-mono">
                      {item.badge}
                    </span>
                  )}
                  {isAi && (
                    <span className="text-[8px] font-extrabold bg-emerald-600 text-white px-1.5 py-0.2 rounded-full uppercase tracking-wider shadow-2xs">
                      Agent
                    </span>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </nav>

      {/* Cayla Mini Status / Callout with Animated Pen Mascot */}
      {isCollapsed ? (
        <div className="p-2 flex justify-center mb-2">
          <button
            onClick={() => {
              if (isAccountant) {
                onTabChange('accountant_dashboard');
              } else {
                onTabChange('dashboard');
              }
              onOpenCayla();
            }}
            className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200/80 flex items-center justify-center hover:bg-emerald-100 transition-colors shadow-2xs cursor-pointer"
            title={isAccountant ? 'Open Cayla Accountant Command' : 'Ask Cayla Payroll Agent'}
          >
            <CaylaPenMascot size="xs" showStatusDot={true} />
          </button>
        </div>
      ) : (
        <div
          onClick={() => {
            if (isAccountant) {
              onTabChange('accountant_dashboard');
            } else {
              onTabChange('dashboard');
            }
            onOpenCayla();
          }}
          className="p-3 mx-3 mb-3 rounded-2xl bg-emerald-50/70 hover:bg-emerald-50 border border-emerald-200/70 text-xs text-slate-700 cursor-pointer transition-all hover:shadow-md hover:border-emerald-300"
        >
          <div className="flex items-center gap-2.5 mb-1.5">
            <CaylaPenMascot size="sm" showStatusDot={true} />
            <div>
              <div className="text-xs font-bold text-slate-900 flex items-center gap-1">
                Cayla {isAccountant ? 'Practice Agent' : 'Payroll Agent'}
              </div>
              <span className="text-[10px] text-emerald-700 font-semibold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Ready to assist
              </span>
            </div>
          </div>
          <p className="text-[11px] text-slate-500 leading-relaxed font-normal">
            {isAccountant
              ? '“Which clients have payroll due?” or “Prepare all ready payrolls”.'
              : '“Run payroll for August”, “Add 4 hrs overtime”, or “Review NIS”.'}
          </p>
        </div>
      )}

      {/* Sidebar Footer */}
      <div className={`p-3 border-t border-slate-100 flex items-center text-xs text-slate-400 ${
        isCollapsed ? 'justify-center' : 'justify-between'
      }`}>
        {isCollapsed ? (
          <span className="w-2 h-2 rounded-full bg-emerald-500" title="Connected & Compliant" />
        ) : (
          <>
            <span className="font-medium text-[11px]">Sheetpay • Cayla v3.0</span>
            <span className="font-mono text-[9px] text-emerald-800 font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200/60">
              {isAccountant ? 'Multi-Tenant' : 'TD4 / NIS'}
            </span>
          </>
        )}
      </div>
    </aside>
  );
};
