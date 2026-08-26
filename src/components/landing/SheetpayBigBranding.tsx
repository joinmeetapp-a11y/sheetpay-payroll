import React from 'react';
import { CaylaPenMascot } from '../CaylaPenMascot';

/**
 * Big bold Sheetpay wordmark section shown below marketing-page footers.
 * Shared between the main landing page, the guest accountant hero, and the
 * old /accountants landing (kept in-repo until removed).
 */
interface Props {
  tagline?: string;
}

export const SheetpayBigBranding: React.FC<Props> = ({
  tagline = 'Conversational payroll for the Caribbean and beyond.',
}) => (
  <section className="relative bg-gradient-to-b from-white via-emerald-50/60 to-emerald-100/40 border-t border-emerald-100 overflow-hidden">
    <div className="absolute inset-0 pointer-events-none opacity-40" aria-hidden="true">
      <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-emerald-200/40 blur-3xl" />
      <div className="absolute -bottom-24 -right-24 w-96 h-96 rounded-full bg-emerald-300/30 blur-3xl" />
    </div>
    <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 md:py-24 flex flex-col items-center justify-center gap-6 text-center">
      <div className="flex items-center gap-3 sm:gap-5 md:gap-6">
        <div className="w-14 h-14 sm:w-20 sm:h-20 md:w-24 md:h-24 rounded-3xl bg-white border-2 border-emerald-200 flex items-center justify-center shadow-xl shadow-emerald-600/10">
          <CaylaPenMascot size={64} />
        </div>
        <span className="font-black tracking-tighter text-slate-950 leading-none text-[3.5rem] sm:text-7xl md:text-8xl lg:text-9xl">
          Sheetpay
        </span>
      </div>
      <div className="flex items-center gap-2 text-xs sm:text-sm font-black uppercase tracking-[0.35em] text-emerald-700">
        <span className="h-px w-8 sm:w-12 bg-emerald-400" />
        Powered by Cayla Agent
        <span className="h-px w-8 sm:w-12 bg-emerald-400" />
      </div>
      <p className="text-sm sm:text-base font-semibold text-slate-500 max-w-xl">{tagline}</p>
    </div>
  </section>
);
