import React, { useState } from 'react';
import { X, Check, Sparkles, ShieldCheck, LogIn } from 'lucide-react';
import { CaylaPenMascot } from '../CaylaPenMascot';
import { GuestLockedAction } from '../../lib/guestSession';

interface Props {
  isOpen: boolean;
  reason: GuestLockedAction | 'generic';
  onClose: () => void;
  onUnlock: (plan: 'accountant' | 'accountant_yearly') => void;
  onSignIn?: () => void;
}

const HEADLINES: Record<GuestLockedAction | 'generic', { title: string; subtitle: string }> = {
  add_client_2: {
    title: 'Ready to manage more clients?',
    subtitle: 'Upgrade to Sheetpay Accountant for unlimited clients, employees and payroll runs.',
  },
  add_employee_51: {
    title: 'You’ve reached the 50-employee free payroll cap',
    subtitle: 'Unlock unlimited employees so you can process this client’s full payroll.',
  },
  run_payroll_2: {
    title: 'You’ve completed your free payroll',
    subtitle: 'Upgrade to run unlimited payrolls for all your clients.',
  },
  download_payslip: {
    title: 'Unlock Unlimited Payroll',
    subtitle: 'Keep everything you’ve already created and continue with unlimited clients, employees, payroll runs and payslips.',
  },
  download_all_payslips: {
    title: 'Unlock Unlimited Payroll',
    subtitle: 'Download the full set of branded payslips you already generated — nothing to redo.',
  },
  print_payslip: {
    title: 'Unlock Unlimited Payroll',
    subtitle: 'Print the branded payslip Sheetpay has already generated for this employee.',
  },
  print_all_payslips: {
    title: 'Unlock Unlimited Payroll',
    subtitle: 'Print every branded payslip you already generated in one click.',
  },
  whatsapp_share: {
    title: 'Unlock Unlimited Payroll',
    subtitle: 'Share the branded payslips you already generated straight to WhatsApp.',
  },
  generic: {
    title: 'Unlock Unlimited Payroll',
    subtitle: 'Keep everything you’ve already created and continue with unlimited clients, employees, payroll runs and payslips.',
  },
};

export const GuestPaywallModal: React.FC<Props> = ({
  isOpen,
  reason,
  onClose,
  onUnlock,
  onSignIn,
}) => {
  const [billing, setBilling] = useState<'yearly' | 'monthly'>('yearly');
  if (!isOpen) return null;
  const copy = HEADLINES[reason] ?? HEADLINES.generic;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-emerald-100 my-8">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-6 sm:p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center">
              <CaylaPenMascot size="md" />
            </div>
            <div>
              <div className="text-[10px] font-black uppercase tracking-widest text-emerald-700">
                Sheetpay Accountant
              </div>
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-950">
                {copy.title}
              </h2>
            </div>
          </div>

          <p className="text-slate-600 font-medium leading-relaxed mb-6">{copy.subtitle}</p>

          <div className="grid sm:grid-cols-2 gap-3 mb-6">
            <PlanCard
              recommended={billing === 'yearly'}
              onClick={() => setBilling('yearly')}
              active={billing === 'yearly'}
              label="Accountant — Yearly"
              price="$1,970"
              period="/ year"
              badge="Save $394 — 2 months free"
            />
            <PlanCard
              recommended={false}
              onClick={() => setBilling('monthly')}
              active={billing === 'monthly'}
              label="Accountant — Monthly"
              price="$197"
              period="/ month"
              badge={null}
            />
          </div>

          <ul className="space-y-2 mb-6 text-sm text-slate-700 font-semibold">
            {[
              'Unlimited clients, employees and payroll runs',
              'Download, print & WhatsApp all branded payslips',
              'Everything you already built stays — no restart',
              'Real Cayla agent + full deterministic tax engine',
            ].map((feature) => (
              <li key={feature} className="flex items-start gap-2">
                <Check className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>

          <button
            onClick={() => onUnlock(billing === 'yearly' ? 'accountant_yearly' : 'accountant')}
            className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-2xl shadow-lg shadow-emerald-600/20 hover:shadow-emerald-600/30 hover:-translate-y-0.5 transition-all cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            Unlock Sheetpay
          </button>

          <div className="mt-4 flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 text-slate-500 font-semibold">
              <ShieldCheck className="w-3.5 h-3.5" />
              Secure checkout by Paddle
            </div>
            {onSignIn && (
              <button
                onClick={onSignIn}
                className="inline-flex items-center gap-1.5 text-emerald-700 hover:text-emerald-800 font-bold cursor-pointer"
              >
                <LogIn className="w-3.5 h-3.5" />
                Already have an account? Sign in
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const PlanCard: React.FC<{
  recommended: boolean;
  active: boolean;
  onClick: () => void;
  label: string;
  price: string;
  period: string;
  badge: string | null;
}> = ({ recommended, active, onClick, label, price, period, badge }) => (
  <button
    onClick={onClick}
    className={`text-left rounded-2xl border-2 p-4 transition-all cursor-pointer ${
      active
        ? 'border-emerald-500 bg-emerald-50/60 shadow-md'
        : 'border-slate-200 bg-white hover:border-emerald-300'
    }`}
  >
    <div className="flex items-center justify-between mb-2">
      <div className="text-xs font-black uppercase tracking-wider text-slate-500">{label}</div>
      {recommended && (
        <span className="text-[9px] font-black uppercase bg-emerald-600 text-white px-1.5 py-0.5 rounded-md">
          Recommended
        </span>
      )}
    </div>
    <div className="flex items-baseline gap-1">
      <span className="text-2xl font-black text-slate-950">{price}</span>
      <span className="text-xs font-bold text-slate-500">{period}</span>
    </div>
    {badge && (
      <div className="mt-2 text-[11px] font-black text-emerald-700 uppercase tracking-wider">
        {badge}
      </div>
    )}
  </button>
);
