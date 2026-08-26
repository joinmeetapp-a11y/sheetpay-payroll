import React from 'react';
import { CaylaPenMascot } from '../CaylaPenMascot';

/**
 * Marketing footer previously embedded in AccountantLandingPage.tsx. Extracted
 * so the /try-accountant-dashboard hero can reuse it and so the file that
 * defines it can be removed without breaking every caller.
 */
interface Props {
  onNavigate: (path: string) => void;
  onStartOnboarding?: () => void;
}

export const AccountantMarketingFooter: React.FC<Props> = ({
  onNavigate,
  onStartOnboarding,
}) => (
  <footer className="bg-white border-t border-slate-200 pt-14 pb-10 text-slate-600 text-sm">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
        <div className="col-span-2 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center">
              <CaylaPenMascot size="sm" />
            </div>
            <div>
              <span className="font-black text-xl text-slate-950 tracking-tight">Sheetpay</span>
              <div className="text-xs font-bold text-emerald-700">Powered by Cayla Agent</div>
            </div>
          </div>
          <p className="text-sm text-slate-500 max-w-sm leading-relaxed font-medium">
            AI payroll software for Caribbean accountants. Cayla prepares payroll and payslips
            &mdash; you review and approve. Built for Trinidad &amp; Tobago, Barbados, Saint Lucia,
            Belize, Jamaica and Guyana.
          </p>
          <div className="text-xs text-slate-400 font-mono">
            &copy; {new Date().getFullYear()} Sheetpay Inc.
          </div>
        </div>
        <div className="space-y-3">
          <div className="font-black text-slate-900 uppercase tracking-wider text-xs">Product</div>
          <ul className="space-y-2.5 font-semibold">
            <li>
              <button
                onClick={() => onNavigate('/')}
                className="hover:text-emerald-700 cursor-pointer text-left"
              >
                Sheetpay for Business
              </button>
            </li>
            {onStartOnboarding && (
              <li>
                <button
                  onClick={onStartOnboarding}
                  className="hover:text-emerald-700 cursor-pointer text-left"
                >
                  Start free onboarding
                </button>
              </li>
            )}
            <li>
              <button
                onClick={() => onNavigate('/calculators')}
                className="hover:text-emerald-700 cursor-pointer text-left"
              >
                Caribbean tax calculators
              </button>
            </li>
          </ul>
        </div>
        <div className="space-y-3">
          <div className="font-black text-slate-900 uppercase tracking-wider text-xs">Trust</div>
          <ul className="space-y-2.5 font-semibold text-xs sm:text-sm">
            <li>
              <button
                onClick={() => onNavigate('/privacy-policy')}
                className="hover:text-emerald-700 cursor-pointer text-left"
              >
                Privacy Policy
              </button>
            </li>
            <li>
              <button
                onClick={() => onNavigate('/terms-of-service')}
                className="hover:text-emerald-700 cursor-pointer text-left"
              >
                Terms of Service
              </button>
            </li>
            <li>
              <button
                onClick={() => onNavigate('/refund-policy')}
                className="hover:text-emerald-700 cursor-pointer text-left"
              >
                Refund Policy
              </button>
            </li>
            <li>
              <button
                onClick={() => onNavigate('/security')}
                className="hover:text-emerald-700 cursor-pointer text-left"
              >
                Security &amp; Encryption
              </button>
            </li>
            <li>
              <button
                onClick={() => onNavigate('/contact')}
                className="hover:text-emerald-700 cursor-pointer text-left"
              >
                Support &amp; Contact
              </button>
            </li>
          </ul>
        </div>
      </div>
    </div>
  </footer>
);
