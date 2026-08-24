import React from 'react';
import { PayrollRun, BusinessDetails } from '../../types';
import { formatCurrency } from '../../lib/taxEngine';
import {
  CalendarDays,
  CheckCircle2,
  Clock,
  Download,
  FileSpreadsheet,
  Building2,
  DollarSign,
  ArrowRight,
  ShieldCheck,
  Send,
  Sparkles,
} from 'lucide-react';

interface PayrollRunsViewProps {
  currentPayroll: PayrollRun | null;
  business: BusinessDetails;
  onOpenRun: (run: PayrollRun) => void;
  onFinalizeCurrent: () => void;
  onOpenCayla: () => void;
}

export const PayrollRunsView: React.FC<PayrollRunsViewProps> = ({
  currentPayroll,
  business,
  onOpenRun,
  onFinalizeCurrent,
  onOpenCayla,
}) => {
  const pastRuns = [
    {
      id: 'run-jul-2026',
      periodLabel: 'July 2026 Regular Pay Cycle',
      month: 'July',
      year: 2026,
      payDate: 'July 31, 2026',
      employeesCount: 24,
      grossPay: 218500,
      totalDeductions: 52400,
      netPay: 166100,
      payeTotal: 34200,
      nisTotal: 15400,
      hsTotal: 2800,
      status: 'paid',
      finalizedAt: 'July 30, 2026',
    },
    {
      id: 'run-jun-2026',
      periodLabel: 'June 2026 Regular Pay Cycle',
      month: 'June',
      year: 2026,
      payDate: 'June 30, 2026',
      employeesCount: 23,
      grossPay: 210200,
      totalDeductions: 50800,
      netPay: 159400,
      payeTotal: 33100,
      nisTotal: 14900,
      hsTotal: 2800,
      status: 'paid',
      finalizedAt: 'June 29, 2026',
    },
    {
      id: 'run-may-2026',
      periodLabel: 'May 2026 Regular Pay Cycle',
      month: 'May',
      year: 2026,
      payDate: 'May 30, 2026',
      employeesCount: 23,
      grossPay: 209000,
      totalDeductions: 50500,
      netPay: 158500,
      payeTotal: 32900,
      nisTotal: 14800,
      hsTotal: 2800,
      status: 'paid',
      finalizedAt: 'May 29, 2026',
    },
  ];

  const handleDownloadAchFile = (label: string) => {
    const fakeAchContent = `ACH-NACHA-PAYROLL-DIRECT-DEPOSIT\nCOMPANY:${business.name}\nTAX-ID:${business.taxRegistrationId}\nBATCH:${label}\nTOTAL-RECORDS:24\nSTATUS:VALIDATED-TD4-CLEARED`;
    const blob = new Blob([fakeAchContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ACH_DIRECT_DEPOSIT_${label.replace(/\s+/g, '_')}.txt`;
    a.click();
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 md:px-8 py-6 space-y-6 select-none animate-in fade-in">
      {/* Page Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <CalendarDays className="w-7 h-7 text-emerald-600" />
            Payroll Runs & History
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Track active pay cycles, review statutory settlements, and export automated bank direct transfer batches.
          </p>
        </div>

        <button
          onClick={onOpenCayla}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
        >
          <Sparkles className="w-4 h-4" />
          <span>Ask Cayla to Run Payroll</span>
        </button>
      </div>

      {/* Active Run Card */}
      {currentPayroll ? (
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-3xl p-6 md:p-8 shadow-xl border border-slate-700">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-700">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-400">
                <CalendarDays className="w-6 h-6" />
              </div>
              <div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-emerald-500 text-slate-950 mb-1">
                  Active Pay Period
                </div>
                <h2 className="text-xl md:text-2xl font-black text-white">{currentPayroll.periodLabel}</h2>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => handleDownloadAchFile(currentPayroll.periodLabel)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold border border-slate-600 flex items-center gap-2 cursor-pointer transition-colors"
              >
                <Download className="w-4 h-4 text-emerald-400" />
                <span>Export Bank ACH</span>
              </button>

              {currentPayroll.status !== 'finalized' && (
                <button
                  onClick={onFinalizeCurrent}
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl text-xs flex items-center gap-2 cursor-pointer shadow-lg shadow-emerald-500/30 transition-all"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Authorize & Finalize</span>
                </button>
              )}
            </div>
          </div>

          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
            <div className="bg-slate-800/60 p-4 rounded-2xl border border-slate-700/60">
              <div className="text-[11px] font-bold text-slate-400 uppercase">Gross Earnings</div>
              <div className="text-xl md:text-2xl font-black text-white font-mono mt-1">
                {formatCurrency(currentPayroll.grossPay)}
              </div>
            </div>

            <div className="bg-slate-800/60 p-4 rounded-2xl border border-slate-700/60">
              <div className="text-[11px] font-bold text-slate-400 uppercase">PAYE Tax Withheld</div>
              <div className="text-xl md:text-2xl font-black text-amber-400 font-mono mt-1">
                {formatCurrency(currentPayroll.payeTotal)}
              </div>
            </div>

            <div className="bg-slate-800/60 p-4 rounded-2xl border border-slate-700/60">
              <div className="text-[11px] font-bold text-slate-400 uppercase">NIS Class 16 Total</div>
              <div className="text-xl md:text-2xl font-black text-cyan-400 font-mono mt-1">
                {formatCurrency(currentPayroll.nisTotal)}
              </div>
            </div>

            <div className="bg-emerald-950/40 p-4 rounded-2xl border border-emerald-500/30">
              <div className="text-[11px] font-bold text-emerald-400 uppercase">Net Distribution</div>
              <div className="text-xl md:text-2xl font-black text-emerald-400 font-mono mt-1">
                {formatCurrency(currentPayroll.netPay)}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-3xl p-8 border border-slate-200 text-center shadow-sm">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-3">
            <CalendarDays className="w-7 h-7" />
          </div>
          <h2 className="text-lg font-bold text-slate-900">No active pay run in progress</h2>
          <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
            Say &ldquo;Run payroll for August 2026&rdquo; to Cayla to initiate real-time tax calculation and biometric timesheet ingestion.
          </p>
          <button
            onClick={onOpenCayla}
            className="mt-4 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all inline-flex items-center gap-2 cursor-pointer shadow-md"
          >
            <Sparkles className="w-4 h-4" /> Launch Cayla
          </button>
        </div>
      )}

      {/* Historical Payroll Runs */}
      <div>
        <h2 className="text-lg font-bold text-slate-900 mb-3">Past Finalized Cycles</h2>
        <div className="space-y-3">
          {pastRuns.map((run) => (
            <div
              key={run.id}
              className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:border-emerald-300 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700 shrink-0 font-bold">
                  {run.month.substring(0, 3)}
                </div>
                <div>
                  <div className="font-bold text-slate-900 text-sm md:text-base flex items-center gap-2">
                    {run.periodLabel}
                    <span className="text-[10px] uppercase font-bold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-md">
                      Finalized & Paid
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    Disbursed on {run.payDate} • {run.employeesCount} Employees
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-6">
                <div className="text-right">
                  <div className="text-[10px] text-slate-400 uppercase font-bold">Net Payout</div>
                  <div className="text-base font-black text-slate-900 font-mono">
                    {formatCurrency(run.netPay)}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleDownloadAchFile(run.periodLabel)}
                    className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-colors cursor-pointer"
                    title="Download Bank ACH File"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
