import React from 'react';
import { Lock, Crown, Check } from 'lucide-react';

interface ProGateProps {
  isPro: boolean;
  title: string;
  description: string;
  features?: string[];
  onUpgrade: (plan: 'pro' | 'accountant') => void;
  children: React.ReactNode;
}

/**
 * Wraps a premium feature. When the user is not on a paid plan, the underlying
 * feature is blurred/locked behind an upgrade prompt. Once the Convex entitlement
 * reports Pro, the real feature renders through.
 */
export const ProGate: React.FC<ProGateProps> = ({
  isPro,
  title,
  description,
  features = [],
  onUpgrade,
  children,
}) => {
  if (isPro) return <>{children}</>;

  return (
    <div className="relative">
      <div className="pointer-events-none select-none blur-[3px] opacity-50 max-h-[520px] overflow-hidden">
        {children}
      </div>
      <div className="absolute inset-0 flex items-start justify-center pt-16 sm:pt-24 px-4">
        <div className="max-w-md w-full bg-white rounded-3xl border border-slate-200 shadow-2xl p-6 sm:p-8 text-center">
          <div className="w-14 h-14 rounded-2xl bg-emerald-600 text-white flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-600/25">
            <Lock className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-black text-slate-900 tracking-tight">{title}</h3>
          <p className="text-sm text-slate-500 mt-1.5 leading-relaxed">{description}</p>

          {features.length > 0 && (
            <ul className="mt-5 space-y-2 text-left">
              {features.map((f) => (
                <li key={f} className="flex items-center gap-2.5 text-sm text-slate-700 font-medium">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          )}

          <button
            onClick={() => onUpgrade('pro')}
            className="mt-6 w-full inline-flex items-center justify-center gap-2 px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
          >
            <Crown className="w-4 h-4" />
            <span>Upgrade to Pro — $97/mo</span>
          </button>
          <p className="text-[11px] text-slate-400 mt-3">Cancel anytime · Secure checkout by Paddle</p>
        </div>
      </div>
    </div>
  );
};
