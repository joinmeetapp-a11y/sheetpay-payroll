import React from 'react';
import { CaylaPenMascot } from '../CaylaPenMascot';
import { ArrowRight, CheckCircle2, Sparkles, Zap, ShieldCheck } from 'lucide-react';

interface CaylaConversionBlockProps {
  countryName: string;
  onLaunchApp?: () => void;
  onStartOnboarding?: () => void;
}

export const CaylaConversionBlock: React.FC<CaylaConversionBlockProps> = ({
  countryName,
  onLaunchApp,
  onStartOnboarding,
}) => {
  return (
    <section className="my-12 rounded-3xl bg-gradient-to-br from-emerald-950 via-slate-900 to-slate-950 text-white p-6 sm:p-10 border border-emerald-500/20 shadow-2xl relative overflow-hidden">
      {/* Decorative ambient glow */}
      <div className="absolute -right-20 -top-20 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -left-20 -bottom-20 w-80 h-80 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        {/* Left Column: Value Prop */}
        <div className="lg:col-span-7 space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold border border-emerald-400/30">
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI Payroll Agent for {countryName}</span>
          </div>

          <h3 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white tracking-tight leading-tight">
            Doing this for one employee is easy. <br className="hidden sm:inline" />
            <span className="text-emerald-400">Doing it for your whole team is Cayla’s job.</span>
          </h3>

          <p className="text-sm sm:text-base text-slate-300 max-w-xl leading-relaxed">
            Running payroll for employees? Cayla calculates statutory taxes and deductions automatically for your entire team, generates branded payslips, and prepares bank remittance files in seconds.
          </p>

          {/* Key highlights */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>100% Deterministic Tax</span>
            </div>
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Instant Branded Payslips</span>
            </div>
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Bank Batch Files Ready</span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-3 pt-4">
            <button
              onClick={onStartOnboarding || onLaunchApp}
              className="px-6 py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-sm transition-all shadow-lg shadow-emerald-500/25 flex items-center gap-2 cursor-pointer transform hover:scale-[1.02]"
            >
              <CaylaPenMascot size="xs" />
              <span>Run Payroll with Cayla</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              onClick={onLaunchApp}
              className="px-5 py-3.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-sm transition-all border border-white/15 cursor-pointer"
            >
              Try Interactive Live Demo
            </button>
          </div>
        </div>

        {/* Right Column: Mini Simulated Conversational UI */}
        <div className="lg:col-span-5">
          <div className="bg-slate-900/90 rounded-2xl p-4 sm:p-5 border border-slate-700/60 shadow-xl space-y-3.5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center">
                  <CaylaPenMascot size="xs" />
                </div>
                <span className="text-xs font-bold text-white">Cayla Live Workspace</span>
              </div>
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800/40 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Ready
              </span>
            </div>

            {/* Simulated User prompt */}
            <div className="flex justify-end">
              <div className="bg-emerald-600 text-white px-3.5 py-2 rounded-2xl rounded-tr-sm text-xs max-w-[85%] font-medium shadow-sm">
                Run payroll for August and send payslips to 24 employees.
              </div>
            </div>

            {/* Simulated Cayla reply */}
            <div className="flex items-start gap-2.5">
              <div className="w-6 h-6 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center shrink-0 mt-0.5">
                <CaylaPenMascot size="xs" />
              </div>
              <div className="bg-slate-800/90 text-slate-200 p-3 rounded-2xl rounded-tl-sm text-xs max-w-[90%] border border-slate-700/50 space-y-2">
                <p className="leading-relaxed">
                  August payroll is calculated! I’ve computed statutory taxes, applied {countryName} statutory allowances, and generated 24 encrypted payslips for review.
                </p>
                <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80 flex items-center justify-between text-[11px]">
                  <span className="text-slate-400 font-mono">Net Disbursement:</span>
                  <span className="font-bold text-emerald-400 font-mono">Verified Compliant</span>
                </div>
              </div>
            </div>

            {/* Quick action bar */}
            <div className="pt-1">
              <div className="text-[11px] text-center text-slate-400 font-medium">
                No manual spreadsheets. No tax mistakes.
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
