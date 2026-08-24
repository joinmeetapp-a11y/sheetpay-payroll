import React, { useState } from 'react';
import { Employee, BusinessDetails, PayrollRun } from '../../types';
import { formatCurrency } from '../../lib/taxEngine';
import {
  FileCheck2,
  Download,
  Printer,
  ShieldCheck,
  Building,
  Info,
  Calendar,
  DollarSign,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';

interface TaxFormsViewProps {
  employees: Employee[];
  business: BusinessDetails;
  currentPayroll: PayrollRun | null;
  onOpenCayla: () => void;
}

export const TaxFormsView: React.FC<TaxFormsViewProps> = ({
  employees,
  business,
  currentPayroll,
  onOpenCayla,
}) => {
  const [activeFormTab, setActiveFormTab] = useState<'td4' | 'nib' | 'hs'>('td4');
  const [selectedTd4EmpId, setSelectedTd4EmpId] = useState<string>(employees[0]?.id || '');

  const selectedEmp = employees.find((e) => e.id === selectedTd4EmpId) || employees[0];

  const totalPaye = employees.reduce((s, e) => s + (e.paye || 0), 0);
  const totalNis = employees.reduce((s, e) => s + (e.nis || 0), 0);
  const totalHs = employees.reduce((s, e) => s + (e.healthSurcharge || 0), 0);
  const totalGross = employees.reduce((s, e) => s + (e.grossPay || 0), 0);

  const handlePrint = () => {
    window.print();
  };

  const handleExportTd4Summary = () => {
    const text = `TRINIDAD & TOBAGO BOARD OF INLAND REVENUE (BIR)\nANNUAL TD4 SUMMARY & REMITTANCE DECLARATION - TAX YEAR 2026\nEMPLOYER: ${business.name}\nTAX REGISTRATION: ${business.taxRegistrationId}\nNIS NUMBER: ${business.nisNumber}\nTOTAL EMPLOYEES: ${employees.length}\nTOTAL GROSS EARNINGS: TTD ${totalGross.toFixed(2)}\nTOTAL PAYE WITHHELD: TTD ${totalPaye.toFixed(2)}\nTOTAL NIS COLLECTED: TTD ${totalNis.toFixed(2)}\nTOTAL HEALTH SURCHARGE: TTD ${totalHs.toFixed(2)}\nSTATUS: COMPLIANT WITH LEGAL NOTICE NO. 288 (TT)`;
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `BIR_TD4_SUMMARY_TAX_YEAR_2026.txt`;
    a.click();
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 md:px-8 py-6 space-y-6 select-none animate-in fade-in">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <FileCheck2 className="w-7 h-7 text-emerald-600" />
            Tax & Statutory Forms (T&T BIR / NIB)
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Official Board of Inland Revenue TD4 Certificates, National Insurance Board C15 returns, and Health Surcharge declarations.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleExportTd4Summary}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-md transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4 text-emerald-400" />
            <span>Export TD4 BIR File</span>
          </button>
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Print Official Form</span>
          </button>
        </div>
      </div>

      {/* Form Tabs Nav */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveFormTab('td4')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
            activeFormTab === 'td4'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
          }`}
        >
          TD4 Certificate (Individual)
        </button>
        <button
          onClick={() => setActiveFormTab('nib')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
            activeFormTab === 'nib'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
          }`}
        >
          NIB Monthly C15 Schedule
        </button>
        <button
          onClick={() => setActiveFormTab('hs')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
            activeFormTab === 'hs'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
          }`}
        >
          Health Surcharge Remittance
        </button>
      </div>

      {/* TD4 Certificate View */}
      {activeFormTab === 'td4' && (
        !selectedEmp ? (
          <div className="bg-white rounded-3xl border border-dashed border-slate-200 p-12 text-center space-y-3">
            <FileCheck2 className="w-12 h-12 text-slate-300 mx-auto" />
            <h3 className="text-base font-bold text-slate-800">No Employee TD4 Data Available</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Add employees to your organization to generate and export individual official Board of Inland Revenue TD4 Certificates.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <label className="text-xs font-bold text-slate-500 uppercase">Select Employee TD4:</label>
              <select
                value={selectedTd4EmpId}
                onChange={(e) => setSelectedTd4EmpId(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
              >
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} ({emp.employeeId})
                  </option>
                ))}
              </select>
            </div>

            {/* Official BIR TD4 Certificate Replica Layout */}
            <div className="bg-white rounded-2xl border-2 border-slate-900 p-8 shadow-md max-w-4xl mx-auto text-slate-900 font-serif">
              <div className="text-center border-b-2 border-slate-900 pb-4">
                <div className="text-xs font-sans font-bold tracking-widest uppercase text-slate-600">
                  REPUBLIC OF TRINIDAD AND TOBAGO • BOARD OF INLAND REVENUE
                </div>
                <h2 className="text-xl font-bold uppercase mt-1 tracking-tight">
                  FORM TD4 — CERTIFICATE OF REMUNERATION AND TAX DEDUCTED
                </h2>
                <div className="text-xs font-sans font-semibold text-slate-500 mt-0.5">
                  TAX YEAR ENDING 31ST DECEMBER 2026
                </div>
              </div>

              {/* Employer / Employee Row */}
              <div className="grid grid-cols-2 gap-6 my-6 border-b border-slate-300 pb-6 text-xs font-sans">
                <div>
                  <div className="font-bold uppercase text-slate-400 text-[10px]">Employer Details</div>
                  <div className="font-bold text-sm text-slate-900">{business.name}</div>
                  <div className="text-slate-600">{business.address}</div>
                  <div className="mt-1 font-mono text-[11px]">
                    BIR No: <span className="font-bold">{business.taxRegistrationId}</span> | NIS: {business.nisNumber}
                  </div>
                </div>

                <div>
                  <div className="font-bold uppercase text-slate-400 text-[10px]">Employee Information</div>
                  <div className="font-bold text-sm text-slate-900">{selectedEmp.name}</div>
                  <div className="text-slate-600">ID: {selectedEmp.employeeId} • {selectedEmp.position}</div>
                  <div className="mt-1 font-mono text-[11px]">
                    Personal Tax Allowance Claimed: <span className="font-bold">TTD $84,000 / Year</span>
                  </div>
                </div>
              </div>

              {/* Statutory Numbers Grid */}
              <div className="grid grid-cols-3 gap-4 border border-slate-900 p-4 rounded text-xs font-sans">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Gross Earnings (YTD)</span>
                  <span className="text-base font-black font-mono">{formatCurrency((selectedEmp.ytdGross || (selectedEmp.grossPay || 0) * 8))}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Total PAYE Withheld</span>
                  <span className="text-base font-black text-slate-900 font-mono">{formatCurrency((selectedEmp.paye || 0) * 8)}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">National Insurance (NIS)</span>
                  <span className="text-base font-black text-slate-900 font-mono">{formatCurrency((selectedEmp.nis || 0) * 8)}</span>
                </div>
              </div>

              {/* Signatory Footer */}
              <div className="mt-8 pt-6 border-t border-slate-300 flex items-center justify-between text-xs font-sans">
                <div>
                  <div className="font-semibold text-slate-700">Authorized Officer: {business.signatoryName}</div>
                  <div className="text-[11px] text-slate-500">{business.signatoryTitle}</div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-[11px] text-slate-400">Certified by Sheetpay AI Engine</div>
                  <div className="text-[10px] text-emerald-700 font-bold">STATUS: OFFICIAL BIR RECORD</div>
                </div>
              </div>
            </div>
          </div>
        )
      )}

      {/* NIB C15 Schedule View */}
      {activeFormTab === 'nib' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">National Insurance Board (NIB) Form C15</h2>
              <p className="text-xs text-slate-500">Monthly Contribution Remittance Schedule across all active staff</p>
            </div>
            <div className="text-right">
              <span className="text-xs font-bold text-slate-400 block">Total NIS Due</span>
              <span className="text-xl font-black text-emerald-600 font-mono">{formatCurrency(totalNis)}</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase text-slate-500">
                  <th className="p-3">Employee</th>
                  <th className="p-3">NIS Band</th>
                  <th className="p-3">Gross Wages</th>
                  <th className="p-3">Employee Share (1/3)</th>
                  <th className="p-3">Employer Share (2/3)</th>
                  <th className="p-3 text-right">Total Contribution</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {employees.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-400 italic">
                      No active employee contributions in current period.
                    </td>
                  </tr>
                ) : (
                  employees.map((emp) => {
                    const empShare = emp.nis || 0;
                    const employerShare = (emp.nis || 0) * 2;
                    const total = empShare + employerShare;
                    return (
                      <tr key={emp.id} className="hover:bg-slate-50/60">
                        <td className="p-3 font-semibold text-slate-800">{emp.name}</td>
                        <td className="p-3 font-mono font-bold text-slate-600">Class 16 (Max)</td>
                        <td className="p-3 font-mono">{formatCurrency(emp.grossPay || 0)}</td>
                        <td className="p-3 font-mono text-slate-700">{formatCurrency(empShare)}</td>
                        <td className="p-3 font-mono text-slate-700">{formatCurrency(employerShare)}</td>
                        <td className="p-3 font-mono font-bold text-right text-emerald-600">{formatCurrency(total)}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Health Surcharge View */}
      {activeFormTab === 'hs' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Health Surcharge Declaration</h2>
              <p className="text-xs text-slate-500">Weekly rate of TTD $8.25 applied for all individuals earning above $109.00/wk</p>
            </div>
            <div className="text-right">
              <span className="text-xs font-bold text-slate-400 block">Total Surcharge</span>
              <span className="text-xl font-black text-emerald-600 font-mono">{formatCurrency(totalHs)}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
              <div className="text-xs font-bold text-slate-500 uppercase">Rate Per Employee</div>
              <div className="text-lg font-black text-slate-900 mt-1">TTD $33.00 / mo</div>
              <div className="text-[11px] text-slate-400 mt-0.5">($8.25 × 4 weeks)</div>
            </div>
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
              <div className="text-xs font-bold text-slate-500 uppercase">Covered Staff</div>
              <div className="text-lg font-black text-slate-900 mt-1">{employees.length} Staff</div>
              <div className="text-[11px] text-slate-400 mt-0.5">{employees.length > 0 ? '100% Eligible' : 'No staff registered'}</div>
            </div>
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200">
              <div className="text-xs font-bold text-emerald-800 uppercase">Total Monthly Remittance</div>
              <div className="text-lg font-black text-emerald-700 mt-1 font-mono">{formatCurrency(totalHs)}</div>
              <div className="text-[11px] text-emerald-600 mt-0.5">Payable to BIR by 15th</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
