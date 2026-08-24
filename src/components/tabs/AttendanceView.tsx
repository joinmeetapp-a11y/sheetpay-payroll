import React, { useState } from 'react';
import { Employee, BusinessDetails } from '../../types';
import { formatCurrency, recalculateEmployee } from '../../lib/taxEngine';
import {
  Clock3,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  Search,
  Check,
  Sparkles,
} from 'lucide-react';

interface AttendanceViewProps {
  employees: Employee[];
  onUpdateEmployee: (emp: Employee, fieldChanged?: string) => void;
  onOpenTimesheetModal: () => void;
}

export const AttendanceView: React.FC<AttendanceViewProps> = ({
  employees,
  onUpdateEmployee,
  onOpenTimesheetModal,
}) => {
  const [search, setSearch] = useState('');

  const filtered = employees.filter((e) => {
    const s = (search || '').toLowerCase();
    return (
      (e.name || '').toLowerCase().includes(s) ||
      (e.position || '').toLowerCase().includes(s)
    );
  });

  const totalOvertimeHours = employees.reduce((s, e) => s + e.overtimeHours, 0);

  const handleSetOt = (emp: Employee, hours: number) => {
    const recalculated = recalculateEmployee({
      ...emp,
      overtimeHours: Math.max(0, hours),
      changedFields: ['overtimeHours', 'grossPay', 'paye', 'nis', 'netPay'],
    });
    onUpdateEmployee(recalculated, 'overtimeHours');
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 md:px-8 py-6 space-y-6 select-none animate-in fade-in">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <Clock3 className="w-7 h-7 text-emerald-600" />
            Attendance & Biometric Timesheets
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Review digital punch logs, verify overtime hours (1.5x / 2.0x), and synchronize biometric time clock records.
          </p>
        </div>

        <button
          onClick={onOpenTimesheetModal}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
        >
          <UploadCloud className="w-4 h-4" />
          <span>Import Biometric CSV / Excel</span>
        </button>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="text-xs font-bold text-slate-400 uppercase">Total Logged Overtime</div>
          <div className="text-2xl font-black text-slate-900 mt-1 font-mono">{totalOvertimeHours} Hours</div>
          <div className="text-xs text-emerald-700 font-semibold mt-1 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> Synchronized with August cycle
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="text-xs font-bold text-slate-400 uppercase">Average Shift Attendance</div>
          <div className="text-2xl font-black text-slate-900 mt-1">98.4%</div>
          <div className="text-xs text-slate-500 font-medium mt-1">0 unexcused absences</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="text-xs font-bold text-slate-400 uppercase">Biometric Ingestion Engine</div>
          <div className="text-2xl font-black text-emerald-600 mt-1 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-emerald-500" /> Cayla Real-Time
          </div>
          <div className="text-xs text-slate-500 font-medium mt-1">Automated rate tier mapping</div>
        </div>
      </div>

      {/* Filter and Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="relative w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Filter employee timesheet..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
            />
          </div>
          <span className="text-xs font-semibold text-slate-500">{filtered.length} Staff Attendance Records</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-extrabold uppercase text-slate-500 tracking-wider">
                <th className="px-6 py-3.5">Employee</th>
                <th className="px-4 py-3.5">Department</th>
                <th className="px-4 py-3.5">Standard Hours</th>
                <th className="px-4 py-3.5">Overtime Hours</th>
                <th className="px-4 py-3.5">Overtime Rate (1.5x)</th>
                <th className="px-4 py-3.5">Overtime Payout</th>
                <th className="px-6 py-3.5 text-right">Quick Adjust</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((emp) => {
                const otPayout = emp.overtimeHours * emp.overtimeRate * 1.5;
                return (
                  <tr key={emp.id} className="hover:bg-slate-50/70">
                    <td className="px-6 py-3.5 font-bold text-slate-900 flex items-center gap-2.5">
                      <img
                        src={emp.avatar}
                        alt={emp.name}
                        className="w-8 h-8 rounded-full object-cover ring-1 ring-slate-200"
                        referrerPolicy="no-referrer"
                      />
                      <div>
                        <div>{emp.name}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{emp.employeeId}</div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-slate-600">{emp.department}</td>
                    <td className="px-4 py-3.5 font-mono text-slate-800">160 hrs / mo</td>
                    <td className="px-4 py-3.5">
                      <span className={`font-mono font-bold px-2 py-0.5 rounded ${
                        emp.overtimeHours > 0 ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-500'
                      }`}>
                        {emp.overtimeHours} hrs
                      </span>
                    </td>
                    <td className="px-4 py-3.5 font-mono text-slate-600">
                      {formatCurrency(emp.overtimeRate * 1.5)} / hr
                    </td>
                    <td className="px-4 py-3.5 font-mono font-bold text-emerald-600">
                      {formatCurrency(otPayout)}
                    </td>
                    <td className="px-6 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleSetOt(emp, Math.max(0, emp.overtimeHours - 2))}
                          className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 font-bold text-slate-700 cursor-pointer"
                        >
                          -
                        </button>
                        <span className="w-8 text-center font-mono font-bold">{emp.overtimeHours}</span>
                        <button
                          onClick={() => handleSetOt(emp, emp.overtimeHours + 2)}
                          className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 font-bold text-slate-700 cursor-pointer"
                        >
                          +
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
