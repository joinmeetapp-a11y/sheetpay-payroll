import React, { useState } from 'react';
import {
  BusinessDetails,
  Employee,
  PayrollRun,
  PayslipCustomization,
} from '../types';
import { formatCurrency, recalculateEmployee } from '../lib/taxEngine';
import { PayslipPreview } from './PayslipPreview';
import {
  Users,
  DollarSign,
  TrendingDown,
  Wallet,
  Search,
  SlidersHorizontal,
  CheckCircle,
  FileCheck,
  RotateCcw,
  Edit2,
  ArrowUpDown,
  Download,
  AlertCircle,
} from 'lucide-react';

interface PayrollWorkspaceProps {
  payroll: PayrollRun;
  selectedEmployeeId: string;
  onSelectEmployee: (empId: string) => void;
  onUpdateEmployee: (emp: Employee, fieldChanged?: string) => void;
  onFinalizePayroll: () => void;
  onOpenAudit: () => void;
  business: BusinessDetails;
  customization: PayslipCustomization;
  onUpdateCustomization: (c: Partial<PayslipCustomization>) => void;
  onOpenEmailModal: (employee: Employee) => void;
  onOpenBusinessEditModal: () => void;
}

export const PayrollWorkspace: React.FC<PayrollWorkspaceProps> = ({
  payroll,
  selectedEmployeeId,
  onSelectEmployee,
  onUpdateEmployee,
  onFinalizePayroll,
  onOpenAudit,
  business,
  customization,
  onUpdateCustomization,
  onOpenEmailModal,
  onOpenBusinessEditModal,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('all');
  const [editingCell, setEditingCell] = useState<{ empId: string; field: string } | null>(null);
  const [editValue, setEditValue] = useState<string>('');

  const selectedEmployee =
    payroll.employees.find((e) => e.id === selectedEmployeeId) || payroll.employees[0];

  const departments = ['all', ...Array.from(new Set(payroll.employees.map((e) => e.department)))];

  const filteredEmployees = payroll.employees.filter((emp) => {
    const search = (searchQuery || '').toLowerCase();
    const matchesSearch =
      (emp.name || '').toLowerCase().includes(search) ||
      (emp.employeeId || '').toLowerCase().includes(search) ||
      (emp.position || '').toLowerCase().includes(search);
    const matchesDept = selectedDepartment === 'all' || emp.department === selectedDepartment;
    return matchesSearch && matchesDept;
  });

  const handleStartEdit = (emp: Employee, field: keyof Employee, currentVal: number) => {
    setEditingCell({ empId: emp.id, field: String(field) });
    setEditValue(String(currentVal));
  };

  const handleSaveEdit = (emp: Employee) => {
    if (!editingCell) return;
    const num = parseFloat(editValue);
    const validVal = isNaN(num) ? 0 : Math.max(0, num);

    const updated = {
      ...emp,
      [editingCell.field]: validVal,
      changedFields: [editingCell.field, 'grossPay', 'paye', 'nis', 'netPay'],
    };

    const recalculated = recalculateEmployee(updated);
    onUpdateEmployee(recalculated, editingCell.field);
    setEditingCell(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent, emp: Employee) => {
    if (e.key === 'Enter') {
      handleSaveEdit(emp);
    } else if (e.key === 'Escape') {
      setEditingCell(null);
    }
  };

  return (
    <section
      id="payroll-workspace-container"
      className="w-full max-w-7xl mx-auto px-4 pb-16 pt-2 animate-in fade-in slide-in-from-bottom-4 duration-400"
    >
      {/* Workspace Header */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 md:p-6 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">
                {payroll.periodLabel}
              </h2>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider ${
                  payroll.status === 'draft'
                    ? 'bg-amber-100 text-amber-800 border border-amber-200'
                    : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                }`}
              >
                Status: {payroll.status.toUpperCase()}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Pay Date: {payroll.payDate} • Processed deterministically via Sheetpay TTD statutory rules
            </p>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={onOpenAudit}
              className="px-3 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-medium transition-colors flex items-center gap-1.5"
            >
              <FileCheck className="w-3.5 h-3.5 text-slate-500" />
              <span>Audit Trail</span>
            </button>
            <button
              id="finalize-payroll-btn"
              onClick={onFinalizePayroll}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm shadow-emerald-600/20 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <CheckCircle className="w-4 h-4" />
              <span>Finalize Payroll</span>
            </button>
          </div>
        </div>

        {/* 4 Key Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mt-5">
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80">
            <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-1">
              <span>Active Roster</span>
              <Users className="w-4 h-4 text-slate-400" />
            </div>
            <div className="text-xl md:text-2xl font-bold text-slate-900">
              {payroll.employeesCount} Employees
            </div>
            <div className="text-[11px] text-emerald-600 font-medium mt-1">100% attendance verified</div>
          </div>

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80">
            <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-1">
              <span>Gross Payroll</span>
              <DollarSign className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-xl md:text-2xl font-bold text-slate-900 font-mono">
              {formatCurrency(payroll.grossPay)}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">Basic + Overtime + Bonuses</div>
          </div>

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80">
            <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-1">
              <span>Total Deductions</span>
              <TrendingDown className="w-4 h-4 text-rose-500" />
            </div>
            <div className="text-xl md:text-2xl font-bold text-slate-900 font-mono">
              {formatCurrency(payroll.totalDeductions)}
            </div>
            <div className="text-[11px] text-rose-600 font-medium mt-1">
              PAYE, NIS & Health Surcharge
            </div>
          </div>

          <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-200">
            <div className="flex items-center justify-between text-emerald-800 text-xs font-semibold mb-1">
              <span>Net Disbursement</span>
              <Wallet className="w-4 h-4 text-emerald-700" />
            </div>
            <div className="text-xl md:text-2xl font-bold text-emerald-900 font-mono">
              {formatCurrency(payroll.netPay)}
            </div>
            <div className="text-[11px] text-emerald-700 font-medium mt-1">
              Direct bank transfer total
            </div>
          </div>
        </div>
      </div>

      {/* Main Split Layout: 60% Payroll Table + 40% Live Payslip Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left 60%: Employee Editable Payroll Table */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          {/* Table Header Filter & Search */}
          <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-slate-50/50">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter by name, ID, or position..."
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>

            <div className="flex items-center gap-2">
              <select
                value={selectedDepartment}
                onChange={(e) => setSelectedDepartment(e.target.value)}
                className="text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none"
              >
                {departments.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept === 'all' ? 'All Departments' : dept}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Table Element */}
          <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-100/80 text-slate-700 font-semibold sticky top-0 z-10 select-none">
                <tr>
                  <th className="py-2.5 px-3 border-b border-slate-200">Employee</th>
                  <th className="py-2.5 px-2 border-b border-slate-200 text-right">Basic Pay</th>
                  <th className="py-2.5 px-2 border-b border-slate-200 text-right">OT (hrs)</th>
                  <th className="py-2.5 px-2 border-b border-slate-200 text-right">Bonus</th>
                  <th className="py-2.5 px-2 border-b border-slate-200 text-right">Allowances</th>
                  <th className="py-2.5 px-2 border-b border-slate-200 text-right">PAYE</th>
                  <th className="py-2.5 px-2 border-b border-slate-200 text-right">NIS</th>
                  <th className="py-2.5 px-2 border-b border-slate-200 text-right">Health Sur.</th>
                  <th className="py-2.5 px-2 border-b border-slate-200 text-right">Other Ded.</th>
                  <th className="py-2.5 px-3 border-b border-slate-200 text-right font-bold text-slate-900">
                    Net Pay
                  </th>
                  <th className="py-2.5 px-2 border-b border-slate-200 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredEmployees.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-12 text-center text-slate-400 space-y-2">
                      <Users className="w-9 h-9 text-slate-300 mx-auto" />
                      <div className="font-bold text-slate-700 text-sm">No employees in active payroll</div>
                      <div className="text-xs text-slate-400">Add team members to generate compensation lines and calculate taxes.</div>
                    </td>
                  </tr>
                ) : (
                  filteredEmployees.map((emp) => {
                    const isSelected = emp.id === selectedEmployeeId;
                    const isHighlighted = emp.changedFields && emp.changedFields.length > 0;

                    return (
                      <tr
                        key={emp.id}
                        onClick={() => onSelectEmployee(emp.id)}
                        className={`cursor-pointer transition-all duration-200 ${
                          isSelected
                            ? 'bg-emerald-50/70 font-medium'
                            : 'hover:bg-slate-50/80'
                        } ${isHighlighted ? 'bg-emerald-100/40 animate-pulse' : ''}`}
                      >
                        {/* Employee Info */}
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-2">
                            <img
                              src={emp.avatar}
                              alt={emp.name}
                              className="w-7 h-7 rounded-full object-cover ring-1 ring-slate-200 shrink-0"
                            />
                            <div className="min-w-0">
                              <div className="font-semibold text-slate-900 truncate flex items-center gap-1">
                                {emp.name}
                                {isSelected && (
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 shrink-0" />
                                )}
                              </div>
                              <div className="text-[10px] text-slate-500 truncate font-mono">
                                {emp.employeeId} • {emp.position}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Basic Pay (Editable) */}
                        <td
                          className="py-2.5 px-2 text-right font-mono"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStartEdit(emp, 'basicPay', emp.basicPay || 0);
                          }}
                        >
                          {editingCell?.empId === emp.id && editingCell?.field === 'basicPay' ? (
                            <input
                              type="number"
                              autoFocus
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onBlur={() => handleSaveEdit(emp)}
                              onKeyDown={(e) => handleKeyDown(e, emp)}
                              className="w-16 px-1 py-0.5 text-right font-mono text-xs border border-emerald-500 rounded bg-white"
                            />
                          ) : (
                            <span className="hover:text-emerald-600 hover:underline cursor-pointer">
                              {formatCurrency(emp.basicPay || 0)}
                            </span>
                          )}
                        </td>

                        {/* Overtime Hours (Editable) */}
                        <td
                          className="py-2.5 px-2 text-right font-mono"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStartEdit(emp, 'overtimeHours', emp.overtimeHours || 0);
                          }}
                        >
                          {editingCell?.empId === emp.id &&
                          editingCell?.field === 'overtimeHours' ? (
                            <input
                              type="number"
                              autoFocus
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onBlur={() => handleSaveEdit(emp)}
                              onKeyDown={(e) => handleKeyDown(e, emp)}
                              className="w-12 px-1 py-0.5 text-right font-mono text-xs border border-emerald-500 rounded bg-white"
                            />
                          ) : (
                            <span
                              className={`px-1.5 py-0.5 rounded ${
                                (emp.overtimeHours || 0) > 0
                                  ? 'bg-emerald-100 text-emerald-800 font-semibold'
                                  : 'text-slate-500'
                              }`}
                            >
                              {emp.overtimeHours || 0}h
                            </span>
                          )}
                        </td>

                        {/* Bonus (Editable) */}
                        <td
                          className="py-2.5 px-2 text-right font-mono"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStartEdit(emp, 'bonus', emp.bonus || 0);
                          }}
                        >
                          {editingCell?.empId === emp.id && editingCell?.field === 'bonus' ? (
                            <input
                              type="number"
                              autoFocus
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onBlur={() => handleSaveEdit(emp)}
                              onKeyDown={(e) => handleKeyDown(e, emp)}
                              className="w-14 px-1 py-0.5 text-right font-mono text-xs border border-emerald-500 rounded bg-white"
                            />
                          ) : (
                            <span className={(emp.bonus || 0) > 0 ? 'text-emerald-700 font-medium' : 'text-slate-400'}>
                              {(emp.bonus || 0) > 0 ? formatCurrency(emp.bonus || 0) : '-'}
                            </span>
                          )}
                        </td>

                        {/* Allowances (Editable) */}
                        <td
                          className="py-2.5 px-2 text-right font-mono"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStartEdit(emp, 'allowances', emp.allowances || 0);
                          }}
                        >
                          {editingCell?.empId === emp.id && editingCell?.field === 'allowances' ? (
                            <input
                              type="number"
                              autoFocus
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onBlur={() => handleSaveEdit(emp)}
                              onKeyDown={(e) => handleKeyDown(e, emp)}
                              className="w-14 px-1 py-0.5 text-right font-mono text-xs border border-emerald-500 rounded bg-white"
                            />
                          ) : (
                            <span className="text-slate-600">
                              {(emp.allowances || 0) > 0 ? formatCurrency(emp.allowances || 0) : '-'}
                            </span>
                          )}
                        </td>

                        {/* Calculated PAYE */}
                        <td className="py-2.5 px-2 text-right font-mono text-slate-700">
                          {formatCurrency(emp.paye || 0)}
                        </td>

                        {/* Calculated NIS */}
                        <td className="py-2.5 px-2 text-right font-mono text-slate-700">
                          {formatCurrency(emp.nis || 0)}
                        </td>

                        {/* Calculated Health Surcharge */}
                        <td className="py-2.5 px-2 text-right font-mono text-slate-700">
                          {formatCurrency(emp.healthSurcharge || 0)}
                        </td>

                        {/* Other Deductions */}
                        <td
                          className="py-2.5 px-2 text-right font-mono text-slate-600"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStartEdit(emp, 'otherDeductions', emp.otherDeductions || 0);
                          }}
                        >
                          {editingCell?.empId === emp.id && editingCell?.field === 'otherDeductions' ? (
                            <input
                              type="number"
                              autoFocus
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onBlur={() => handleSaveEdit(emp)}
                              onKeyDown={(e) => handleKeyDown(e, emp)}
                              className="w-14 px-1 py-0.5 text-right font-mono text-xs border border-emerald-500 rounded bg-white"
                            />
                          ) : (
                            <span>{(emp.otherDeductions || 0) > 0 ? formatCurrency(emp.otherDeductions || 0) : '-'}</span>
                          )}
                        </td>

                        {/* Prominent NET PAY */}
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700">
                          {formatCurrency(emp.netPay || 0)}
                        </td>

                        {/* Status */}
                        <td className="py-2.5 px-2 text-center">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-700 uppercase">
                            {emp.status || 'active'}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="p-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
            <span>Click any cell to edit inline, or ask Cayla naturally.</span>
            <span className="font-mono text-[11px] text-emerald-700 font-medium">
              Showing {filteredEmployees.length} of {payroll.employeesCount} staff
            </span>
          </div>
        </div>

        {/* Right 40%: Live Payslip Preview */}
        <div className="lg:col-span-5 sticky top-20">
          <PayslipPreview
            employee={selectedEmployee}
            payroll={payroll}
            business={business}
            customization={customization}
            onUpdateCustomization={onUpdateCustomization}
            onOpenEmailModal={onOpenEmailModal}
            onOpenBusinessEditModal={onOpenBusinessEditModal}
          />
        </div>
      </div>
    </section>
  );
};
