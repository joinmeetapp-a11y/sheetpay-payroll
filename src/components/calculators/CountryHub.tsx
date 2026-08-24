import React from 'react';
import { CountryCode, COUNTRIES_METADATA } from '../../lib/tax-rules';
import { getCalculatorsByCountry } from '../../lib/calculators/registry';
import { SEOHead } from './SEOHead';
import { CaylaPenMascot } from '../CaylaPenMascot';
import { CaylaConversionBlock } from './CaylaConversionBlock';
import {
  Calculator,
  ArrowRight,
  ShieldCheck,
  Building2,
  Calendar,
  Layers,
  ArrowUpRight,
  Home,
  CheckCircle2,
} from 'lucide-react';

interface CountryHubProps {
  countryCode: CountryCode;
  onNavigate: (path: string) => void;
  onLaunchApp: () => void;
  onStartOnboarding: () => void;
}

export const CountryHub: React.FC<CountryHubProps> = ({
  countryCode,
  onNavigate,
  onLaunchApp,
  onStartOnboarding,
}) => {
  const metadata = COUNTRIES_METADATA[countryCode];
  const calculators = getCalculatorsByCountry(countryCode);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col antialiased selection:bg-emerald-500/20">
      <SEOHead
        config={{
          title: `${metadata.name} Payroll & Tax Calculators (${metadata.taxYear}) | Sheetpay`,
          description: `Free ${metadata.name} PAYE, NIS, salary, and take-home pay calculators from Sheetpay. Statutory ${metadata.taxYear} rates, updated monthly.`,
          canonicalPath: metadata.hubUrl,
          h1: `${metadata.name} Payroll & Tax Calculators`,
          breadcrumbs: [
            { name: 'Home', path: '/' },
            { name: 'Calculators', path: '/calculators' },
            { name: metadata.name, path: metadata.hubUrl },
          ],
        }}
      />

      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <button
              onClick={() => onNavigate('/')}
              className="flex items-center gap-2.5 cursor-pointer group"
            >
              <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center group-hover:bg-emerald-100 transition-colors">
                <CaylaPenMascot size="xs" />
              </div>
              <span className="font-black text-xl text-slate-950 tracking-tight">Cayla</span>
            </button>

            <nav className="hidden md:flex items-center gap-4 text-xs font-bold text-slate-600">
              <button
                onClick={() => onNavigate('/calculators')}
                className="hover:text-emerald-700 transition-colors cursor-pointer"
              >
                All Calculators
              </button>
              <span className="text-slate-300">/</span>
              <span className="text-emerald-800">{metadata.name}</span>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onLaunchApp}
              className="px-3.5 py-2 text-xs font-bold text-slate-700 hover:text-slate-950 transition-colors cursor-pointer"
            >
              Live Demo
            </button>
            <button
              onClick={onStartOnboarding}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs transition-all shadow-md shadow-emerald-600/20 flex items-center gap-1.5 cursor-pointer"
            >
              <CaylaPenMascot size="xs" />
              <span>Try Cayla Free</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-12">
        {/* Breadcrumb Bar */}
        <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs font-semibold text-slate-500">
          <button onClick={() => onNavigate('/')} className="hover:text-slate-800 flex items-center gap-1 cursor-pointer">
            <Home className="w-3 h-3 text-slate-400" />
            <span>Home</span>
          </button>
          <span className="text-slate-300">/</span>
          <button onClick={() => onNavigate('/calculators')} className="hover:text-slate-800 cursor-pointer">
            Calculators
          </button>
          <span className="text-slate-300">/</span>
          <span className="text-emerald-700 font-bold" aria-current="page">
            {metadata.name}
          </span>
        </nav>

        {/* Hero Section */}
        <div className="space-y-4 max-w-3xl">
          <div className="flex items-center gap-2.5">
            <span className="text-3xl">{metadata.flag}</span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 text-xs font-bold border border-emerald-200">
              <Calendar className="w-3 h-3 text-emerald-600" />
              Tax Year {metadata.taxYear}
            </span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-950 tracking-tight leading-tight">
            {metadata.name} Payroll &amp; Tax Calculators
          </h1>

          <p className="text-base sm:text-lg text-slate-600 leading-relaxed font-medium">
            Accurate, deterministic calculators for {metadata.name}. Compute statutory social security, tax withholdings, and net salary using current official statutory rates.
          </p>
        </div>

        {/* Statutory Summary Card */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 grid grid-cols-1 md:grid-cols-3 gap-6 shadow-sm">
          <div className="space-y-1">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Social Security Authority</div>
            <div className="text-sm sm:text-base font-extrabold text-slate-900">{metadata.socialSecurityAgency}</div>
            <div className="text-xs text-slate-500 font-medium">{metadata.nisName}</div>
          </div>

          <div className="space-y-1">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Tax Authority</div>
            <div className="text-sm sm:text-base font-extrabold text-slate-900">{metadata.taxAgency}</div>
            <div className="text-xs text-slate-500 font-medium">PAYE &amp; Corporate Taxes</div>
          </div>

          <div className="space-y-1">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Currency &amp; Compliance</div>
            <div className="text-sm sm:text-base font-extrabold text-emerald-700 font-mono">{metadata.currency} ({metadata.currencySymbol})</div>
            <div className="text-xs text-slate-500 font-medium">Updated: {metadata.lastUpdated}</div>
          </div>
        </div>

        {/* Calculators Grid */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl sm:text-2xl font-black text-slate-950">
              {metadata.name} Calculator Suite ({calculators.length})
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {calculators.map((calc) => (
              <div
                key={calc.path}
                className="bg-white rounded-3xl border border-slate-200 p-6 space-y-4 hover:border-emerald-500 hover:shadow-xl transition-all flex flex-col justify-between group"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                      {calc.currency}
                    </span>
                    <span className="text-xs text-slate-400 font-medium">Tax Year {calc.taxYear}</span>
                  </div>

                  <h3 className="text-base sm:text-lg font-black text-slate-950 group-hover:text-emerald-700 transition-colors">
                    {calc.h1}
                  </h3>

                  <p className="text-xs text-slate-500 leading-relaxed font-medium">
                    {calc.shortDescription}
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-600 group-hover:text-emerald-800">Launch Tool</span>
                  <button
                    onClick={() => onNavigate(calc.path)}
                    className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-all flex items-center gap-1 cursor-pointer shadow-sm shadow-emerald-600/20"
                  >
                    <span>Calculate</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Cayla Conversion Block */}
        <CaylaConversionBlock
          countryName={metadata.name}
          onLaunchApp={onLaunchApp}
          onStartOnboarding={onStartOnboarding}
        />

        {/* Other Caribbean Countries */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 space-y-6">
          <h2 className="text-xl font-black text-slate-950">
            Other Caribbean Countries
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {Object.values(COUNTRIES_METADATA)
              .filter((c) => c.code !== countryCode)
              .map((other) => (
                <button
                  key={other.code}
                  onClick={() => onNavigate(other.hubUrl)}
                  className="p-4 rounded-2xl border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/30 transition-all text-left group cursor-pointer flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{other.flag}</span>
                    <div>
                      <div className="font-bold text-slate-900 text-sm group-hover:text-emerald-800">
                        {other.name}
                      </div>
                      <div className="text-xs text-slate-500">{other.currency} Calculators</div>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 transition-colors" />
                </button>
              ))}
          </div>
        </div>

      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-8 text-slate-500 text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <CaylaPenMascot size="xs" />
            <span className="font-bold text-slate-900">Sheetpay • Cayla AI</span>
            <span>&copy; {new Date().getFullYear()} All rights reserved.</span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-4 font-semibold text-slate-600">
            <button onClick={() => onNavigate('/')} className="hover:text-emerald-700 cursor-pointer">
              Home
            </button>
            <button onClick={() => onNavigate('/calculators')} className="hover:text-emerald-700 cursor-pointer">
              Calculators Hub
            </button>
            <button onClick={() => onNavigate('/refund-policy')} className="hover:text-emerald-700 cursor-pointer">
              Refund Policy
            </button>
            <button onClick={() => onNavigate('/privacy-policy')} className="hover:text-emerald-700 cursor-pointer">
              Privacy Policy
            </button>
            <button onClick={() => onNavigate('/terms-of-service')} className="hover:text-emerald-700 cursor-pointer">
              Terms
            </button>
            <button onClick={() => onNavigate('/contact')} className="hover:text-emerald-700 cursor-pointer">
              Support
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};
