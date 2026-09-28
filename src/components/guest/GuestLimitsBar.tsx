import React from 'react';
import { Sparkles, Building2, PlayCircle, Lock, ScanLine, MessageCircle } from 'lucide-react';
import { GUEST_LIMITS } from '../../lib/guestSession';

interface Props {
  clientsUsed: number;
  payrollRunsUsed: number;
  caylaActionsUsed: number;
  ocrScansUsed: number;
  onUpgrade: () => void;
}

export const GuestLimitsBar: React.FC<Props> = ({
  clientsUsed,
  payrollRunsUsed,
  caylaActionsUsed,
  ocrScansUsed,
  onUpgrade,
}) => {
  return (
    <div className="bg-gradient-to-r from-emerald-50 via-white to-emerald-50 border-y border-emerald-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex flex-wrap items-center gap-3 sm:gap-5 text-xs">
        <div className="inline-flex items-center gap-1.5 text-emerald-700 font-black uppercase tracking-wider">
          <Sparkles className="w-3.5 h-3.5" />
          Accountant Trial
        </div>

        <Chip
          icon={<Building2 className="w-3.5 h-3.5" />}
          label="Clients"
          used={clientsUsed}
          max={GUEST_LIMITS.maxClients}
        />
        <Chip
          icon={<PlayCircle className="w-3.5 h-3.5" />}
          label="Payroll runs"
          used={payrollRunsUsed}
          max={GUEST_LIMITS.maxPayrollRuns}
        />
        <Chip icon={<MessageCircle className="w-3.5 h-3.5" />} label="Cayla" used={caylaActionsUsed} max={GUEST_LIMITS.maxCaylaActions} />
        <Chip icon={<ScanLine className="w-3.5 h-3.5" />} label="OCR imports" used={ocrScansUsed} max={GUEST_LIMITS.maxOcrScans} />

        <div className="hidden md:block text-slate-400 font-semibold">
          Templates, reports and payslip tools are included
        </div>

        <button
          onClick={onUpgrade}
          className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-black uppercase tracking-wider rounded-lg shadow-sm shadow-emerald-600/20 hover:shadow-emerald-600/30 transition-all cursor-pointer"
        >
          <Lock className="w-3 h-3" />
          Unlock Unlimited
        </button>
      </div>
    </div>
  );
};

const Chip: React.FC<{
  icon: React.ReactNode;
  label: string;
  used: number;
  max: number;
}> = ({ icon, label, used, max }) => {
  const atLimit = used >= max;
  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border font-bold ${
        atLimit
          ? 'bg-amber-50 border-amber-200 text-amber-800'
          : 'bg-white border-slate-200 text-slate-700'
      }`}
    >
      <span className={atLimit ? 'text-amber-600' : 'text-emerald-600'}>{icon}</span>
      <span className="text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
        {label}
      </span>
      <span className="font-black tabular-nums">
        {used} / {max}
      </span>
    </div>
  );
};
