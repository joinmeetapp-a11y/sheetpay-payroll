import React, { useState, useEffect } from 'react';
import { AccountantClient, BatchPayrollJob } from '../../types';
import { formatCurrency } from '../../lib/taxEngine';
import {
  Layers,
  X,
  Play,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowRight,
  ShieldCheck,
  Building2,
  FileSpreadsheet,
} from 'lucide-react';
import { CaylaPenMascot } from '../CaylaPenMascot';
import confetti from 'canvas-confetti';

interface BatchPayrollModalProps {
  isOpen: boolean;
  onClose: () => void;
  clients: AccountantClient[];
  onCompleteBatch: (updatedClients: AccountantClient[]) => void;
}

export const BatchPayrollModal: React.FC<BatchPayrollModalProps> = ({
  isOpen,
  onClose,
  clients,
  onCompleteBatch,
}) => {
  const [jobs, setJobs] = useState<BatchPayrollJob[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentJobIndex, setCurrentJobIndex] = useState<number>(-1);
  const [isDone, setIsDone] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // Initialize eligible jobs
      const initialJobs: BatchPayrollJob[] = clients.map((c) => {
        const hasMissing = (c.missingInformation && c.missingInformation.length > 0) || c.payrollStatus === 'Waiting on Client' || c.payrollStatus === 'Missing Information';
        return {
          id: `job-${c.id}`,
          clientId: c.id,
          clientName: c.name,
          country: c.country,
          employeeCount: c.employeeCount,
          status: hasMissing ? 'waiting_info' : 'pending',
          grossPay: c.monthlyPayrollValue,
          netPay: Math.round(c.monthlyPayrollValue * 0.81),
          errorReason: hasMissing ? c.missingInformation?.[0] || 'Pending timesheets/records' : undefined,
        };
      });
      setJobs(initialJobs);
      setIsProcessing(false);
      setCurrentJobIndex(-1);
      setIsDone(false);
    }
  }, [isOpen, clients]);

  if (!isOpen) return null;

  const eligibleJobs = jobs.filter((j) => j.status !== 'waiting_info');
  const blockedJobs = jobs.filter((j) => j.status === 'waiting_info');

  const startBatchExecution = () => {
    setIsProcessing(true);
    let index = 0;

    const processNext = (idx: number) => {
      if (idx >= jobs.length) {
        setIsProcessing(false);
        setIsDone(true);
        confetti({
          particleCount: 70,
          spread: 60,
          origin: { y: 0.6 },
        });
        return;
      }

      const job = jobs[idx];
      if (job.status === 'waiting_info') {
        processNext(idx + 1);
        return;
      }

      setCurrentJobIndex(idx);
      setJobs((prev) =>
        prev.map((j, i) => (i === idx ? { ...j, status: 'calculating', logMessage: 'Running statutory calculation engine...' } : j))
      );

      setTimeout(() => {
        setJobs((prev) =>
          prev.map((j, i) =>
            i === idx
              ? {
                  ...j,
                  status: 'completed',
                  logMessage: `Calculated ${j.employeeCount} payslips with PAYE/NIS compliance.`,
                }
              : j
          )
        );
        processNext(idx + 1);
      }, 700);
    };

    processNext(0);
  };

  const handleFinish = () => {
    const updated = clients.map((c) => {
      const job = jobs.find((j) => j.clientId === c.id);
      if (job && job.status === 'completed') {
        return {
          ...c,
          payrollStatus: 'Ready for Approval' as any,
          approvalStatus: 'waiting_approval' as any,
        };
      }
      return c;
    });

    onCompleteBatch(updated);
    onClose();
  };

  const completedCount = jobs.filter((j) => j.status === 'completed').length;
  const totalGrossCalculated = jobs
    .filter((j) => j.status === 'completed')
    .reduce((acc, j) => acc + (j.grossPay || 0), 0);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto select-none">
      <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-auto animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
              <Layers className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h2 className="font-extrabold text-sm text-white flex items-center gap-2">
                <span>Batch Payroll with Cayla</span>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded font-mono">
                  Autonomous
                </span>
              </h2>
              <p className="text-[11px] text-slate-400">
                Execute isolated deterministic payroll runs across multiple clients simultaneously
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Overview Stats Header */}
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-3.5 flex items-center justify-between text-xs">
          <div className="flex items-center gap-4">
            <div>
              <span className="text-slate-500 block text-[10px] font-bold uppercase">Ready to Prepare</span>
              <span className="font-extrabold text-slate-900 text-sm font-mono">{eligibleJobs.length} Clients</span>
            </div>
            <div className="h-6 w-px bg-slate-200" />
            <div>
              <span className="text-slate-500 block text-[10px] font-bold uppercase">Action Required</span>
              <span className="font-extrabold text-amber-700 text-sm font-mono">{blockedJobs.length} Blocked</span>
            </div>
          </div>

          <div className="text-right">
            <span className="text-slate-500 block text-[10px] font-bold uppercase">Estimated Gross Value</span>
            <span className="font-black text-emerald-700 text-sm font-mono">{formatCurrency(totalGrossCalculated || eligibleJobs.reduce((acc, j) => acc + (j.grossPay || 0), 0))}</span>
          </div>
        </div>

        {/* Body Jobs List */}
        <div className="p-6 space-y-3 max-h-[60vh] overflow-y-auto">
          {jobs.map((job) => (
            <div
              key={job.id}
              className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between ${
                job.status === 'completed'
                  ? 'bg-emerald-50/80 border-emerald-300'
                  : job.status === 'calculating'
                  ? 'bg-sky-50 border-sky-400 ring-2 ring-sky-300/30'
                  : job.status === 'waiting_info'
                  ? 'bg-amber-50/60 border-amber-200'
                  : 'bg-white border-slate-200'
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs ${
                    job.status === 'completed'
                      ? 'bg-emerald-600 text-white'
                      : job.status === 'calculating'
                      ? 'bg-sky-600 text-white animate-pulse'
                      : job.status === 'waiting_info'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {job.status === 'completed' ? (
                    <CheckCircle2 className="w-5 h-5" />
                  ) : job.status === 'calculating' ? (
                    <CaylaPenMascot size="xs" isProcessing={true} />
                  ) : job.status === 'waiting_info' ? (
                    <AlertTriangle className="w-5 h-5" />
                  ) : (
                    <Clock className="w-4 h-4" />
                  )}
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-xs text-slate-900">{job.clientName}</span>
                    <span className="text-[10px] text-slate-500 font-mono">({job.country})</span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {job.status === 'completed' ? (
                      <span className="text-emerald-700 font-semibold">{job.logMessage}</span>
                    ) : job.status === 'calculating' ? (
                      <span className="text-sky-700 font-semibold">{job.logMessage}</span>
                    ) : job.status === 'waiting_info' ? (
                      <span className="text-amber-700 font-medium">Blocked: {job.errorReason}</span>
                    ) : (
                      <span>{job.employeeCount} employees • Ready for calculation</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="text-right font-mono">
                <div className="text-xs font-bold text-slate-900">{formatCurrency(job.grossPay || 0)}</div>
                <span
                  className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase ${
                    job.status === 'completed'
                      ? 'bg-emerald-100 text-emerald-800'
                      : job.status === 'calculating'
                      ? 'bg-sky-100 text-sky-800'
                      : job.status === 'waiting_info'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {job.status === 'completed' ? 'Calculated' : job.status === 'calculating' ? 'Processing' : job.status === 'waiting_info' ? 'Action Needed' : 'Ready'}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <div className="text-xs text-slate-500">
            {isDone ? (
              <span className="text-emerald-700 font-bold flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                Batch run complete! {completedCount} clients ready for approval.
              </span>
            ) : (
              <span>Cayla processes each tenant with separate statutory engines.</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {!isDone ? (
              <button
                onClick={startBatchExecution}
                disabled={isProcessing || eligibleJobs.length === 0}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-extrabold text-xs rounded-xl shadow-md shadow-emerald-600/20 transition-all flex items-center gap-2 cursor-pointer"
              >
                {isProcessing ? (
                  <>
                    <CaylaPenMascot size="xs" isProcessing={true} />
                    <span>Preparing {eligibleJobs.length} Payrolls...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-white" />
                    <span>Prepare {eligibleJobs.length} Ready Payrolls</span>
                  </>
                )}
              </button>
            ) : (
              <button
                onClick={handleFinish}
                className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer"
              >
                <span>Apply &amp; Return to Dashboard</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
