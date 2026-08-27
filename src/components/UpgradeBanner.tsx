import React from 'react';
import { Sparkles, Check, Crown, X } from 'lucide-react';

interface UpgradeBannerProps {
  plan: 'free' | 'pro' | 'accountant';
  planStatus?: string;
  onUpgrade: (plan: 'pro' | 'accountant') => void;
  onDismiss?: () => void;
}

/**
 * Dashboard "Upgrade to Pro" banner. Reactively driven by the Convex
 * entitlement query — once the user pays it flips to the active-plan state.
 */
export const UpgradeBanner: React.FC<UpgradeBannerProps> = ({
  plan,
  planStatus,
  onUpgrade,
  onDismiss,
}) => {
  const isPro = plan === 'pro' || plan === 'accountant';

  if (isPro) {
    const pending = planStatus === 'pending';
    return (
      <div className="mx-3 sm:mx-4 md:mx-8 mt-4 rounded-2xl border border-emerald-300 bg-gradient-to-r from-emerald-600 to-emerald-500 text-white px-4 sm:px-5 py-3 flex items-center justify-between gap-3 shadow-sm">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
            <Crown className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-black tracking-tight truncate">
              {plan === 'accountant' ? 'Accountant Plan Active' : 'Business Pro Active'}
              {pending && <span className="ml-2 text-[10px] font-bold bg-white/20 px-2 py-0.5 rounded-full align-middle">Activating…</span>}
            </div>
            <div className="text-[11px] text-emerald-50 font-medium truncate">
              Unlimited payroll, unlimited payslips, full Cayla AI and reports are unlocked.
            </div>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-1.5 text-[11px] font-bold bg-white/15 px-2.5 py-1 rounded-full shrink-0">
          <Check className="w-3.5 h-3.5" />
          <span>Pro</span>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-3 sm:mx-4 md:mx-8 mt-4 rounded-2xl border-2 border-emerald-500/30 bg-gradient-to-r from-emerald-500/10 via-emerald-50 to-white px-4 sm:px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs relative">
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="absolute top-2.5 right-2.5 text-slate-400 hover:text-slate-600 cursor-pointer sm:hidden"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      )}
      <div className="flex items-start gap-3 min-w-0">
        <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
          <Sparkles className="w-4.5 h-4.5" />
        </div>
        <div className="space-y-0.5 min-w-0">
          <div className="font-extrabold text-sm text-slate-900 flex items-center gap-2 flex-wrap">
            <span>Upgrade to Business Pro</span>
            <span className="text-[10px] bg-rose-600 text-white font-black uppercase tracking-wider px-2 py-0.5 rounded-full">
              Launch Special · 50% Off
            </span>
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-[11px] font-bold text-slate-400 line-through">$194/mo</span>
            <span className="text-[11px] font-black text-emerald-700">$97/mo</span>
            <span className="text-[10px] font-semibold text-slate-500">USD</span>
          </div>
          <p className="text-[11px] sm:text-xs text-slate-600 leading-snug">
            Unlock unlimited payroll runs &amp; payslips, all payslip templates, full Cayla AI agent,
            advanced reports and 50 monthly OCR scans.
          </p>
        </div>
      </div>
      <button
        onClick={() => onUpgrade('pro')}
        className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-600/20 transition-all shrink-0 cursor-pointer"
      >
        <Crown className="w-3.5 h-3.5" />
        <span>Upgrade to Pro</span>
      </button>
    </div>
  );
};
