import React, { useState } from 'react';
import { ALL_CALCULATORS, CalculatorPageConfig } from '../../lib/calculators/registry';
import { COUNTRIES_METADATA, CountryCode } from '../../lib/tax-rules';
import { SEOHead } from './SEOHead';
import { CaylaPenMascot } from '../CaylaPenMascot';
import {
  Calculator,
  Search,
  ArrowRight,
  ShieldCheck,
  Building2,
  TrendingUp,
  FileSpreadsheet,
  CheckCircle2,
  ArrowUpRight,
} from 'lucide-react';

interface CalculatorHubProps {
  onNavigate: (path: string) => void;
  onLaunchApp: () => void;
  onStartOnboarding: () => void;
}

export const CalculatorHub: React.FC<CalculatorHubProps> = ({
  onNavigate,
  onLaunchApp,
  onStartOnboarding,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCountry, setSelectedCountry] = useState<string>('all');

  const filteredCalculators = ALL_CALCULATORS.filter((calc) => {
    const matchesCountry = selectedCountry === 'all' || calc.countryCode === selectedCountry;
    const cleanSearch = (searchQuery || '').toLowerCase();
    const matchesSearch =
      (calc.h1 || '').toLowerCase().includes(cleanSearch) ||
      (calc.countryName || '').toLowerCase().includes(cleanSearch) ||
      (calc.primaryKeyword || '').toLowerCase().includes(cleanSearch);
    return matchesCountry && matchesSearch;
  });

  const countries = Object.values(COUNTRIES_METADATA);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col antialiased selection:bg-emerald-500/20">
      <SEOHead
        config={{
          title: 'Free Caribbean Payroll & Tax Calculators | Sheetpay',
          description:
            'Free payroll, PAYE, NIS, and take-home pay calculators for Trinidad, Barbados, Saint Lucia, and Belize. Statutory 2026 rates from Sheetpay.',
          canonicalPath: '/calculators',
          h1: 'Caribbean Payroll & Tax Calculators',
          breadcrumbs: [
            { name: 'Home', path: '/' },
            { name: 'Calculators', path: '/calculators' },
          ],
        }}
      />

      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <button
            onClick={() => onNavigate('/')}
            className="flex items-center gap-2.5 cursor-pointer group"
          >
            <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center group-hover:bg-emerald-100 transition-colors">
              <CaylaPenMascot size="xs" />
            </div>
            <span className="font-black text-xl text-slate-950 tracking-tight">Cayla</span>
          </button>

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

      {/* Main Hub Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-10 sm:py-14 space-y-12">
        
        {/* Hero Section */}
        <div className="space-y-4 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 text-xs font-bold border border-emerald-200">
            <Calculator className="w-3.5 h-3.5 text-emerald-600" />
            <span>Free Caribbean Payroll Tools</span>
          </div>

          <h1 className="text-4xl sm:text-5xl font-black text-slate-950 tracking-tight leading-tight">
            Caribbean Payroll &amp; Tax Calculators
          </h1>

          <p className="text-base sm:text-lg text-slate-600 leading-relaxed font-medium">
            Calculate payroll taxes, statutory contributions and take-home pay using Cayla's free payroll calculators. Built with verified statutory rules for Tax Year 2026.
          </p>
        </div>

        {/* Country Hub Selector Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {countries.map((country) => {
            const count = ALL_CALCULATORS.filter((c) => c.countryCode === country.code).length;
            return (
              <div
                key={country.code}
                className="bg-white rounded-3xl border border-slate-200 p-6 space-y-4 hover:border-emerald-500 hover:shadow-xl transition-all group flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-3xl">{country.flag}</span>
                    <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      {country.currency}
                    </span>
                  </div>

                  <div>
                    <h2 className="text-lg font-black text-slate-950 group-hover:text-emerald-800 transition-colors">
                      {country.name}
                    </h2>
                    <p className="text-xs text-slate-500 mt-1 font-medium">
                      {country.nisName} &amp; {country.taxAgency}
                    </p>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 space-y-2">
                  <button
                    onClick={() => onNavigate(country.hubUrl)}
                    className="w-full py-2.5 px-3 rounded-xl bg-slate-50 hover:bg-emerald-600 hover:text-white text-slate-800 font-bold text-xs transition-all flex items-center justify-between cursor-pointer"
                  >
                    <span>{count} Calculators</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Search & Filter Bar */}
        <div className="bg-white rounded-3xl border border-slate-200 p-4 sm:p-6 shadow-sm space-y-4">
          <div className="flex flex-col md:flex-row items-center gap-4">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search calculators (e.g., Trinidad NIS, Barbados PAYE, Belize tax)..."
                className="w-full pl-11 pr-4 py-3 text-sm font-semibold text-slate-900 bg-slate-50 rounded-2xl border border-slate-200 focus:outline-none focus:border-emerald-600"
              />
            </div>

            <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-1">
              <button
                onClick={() => setSelectedCountry('all')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  selectedCountry === 'all'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                All Countries
              </button>
              {countries.map((c) => (
                <button
                  key={c.code}
                  onClick={() => setSelectedCountry(c.code)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                    selectedCountry === c.code
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <span>{c.flag}</span>
                  <span>{c.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Calculators Directory Grid */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-black text-slate-950">
              Available Calculators ({filteredCalculators.length})
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCalculators.map((calc) => (
              <div
                key={calc.path}
                className="bg-white rounded-3xl border border-slate-200 p-6 space-y-4 hover:border-emerald-500 hover:shadow-lg transition-all flex flex-col justify-between group"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{calc.countryFlag}</span>
                      <span className="text-xs font-bold text-slate-600">{calc.countryName}</span>
                    </div>
                    <span className="text-[11px] font-mono text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full font-bold border border-emerald-200">
                      {calc.currency}
                    </span>
                  </div>

                  <h3 className="text-base sm:text-lg font-black text-slate-950 group-hover:text-emerald-700 transition-colors">
                    {calc.h1}
                  </h3>

                  <p className="text-xs text-slate-500 leading-relaxed font-medium line-clamp-2">
                    {calc.shortDescription}
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400 font-medium">Tax Year {calc.taxYear}</span>
                  <button
                    onClick={() => onNavigate(calc.path)}
                    className="px-3.5 py-1.5 rounded-xl bg-emerald-50 group-hover:bg-emerald-600 text-emerald-800 group-hover:text-white font-bold text-xs transition-all flex items-center gap-1 cursor-pointer"
                  >
                    <span>Calculate</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Global Conversion Box */}
        <div className="rounded-3xl bg-slate-950 text-white p-8 sm:p-12 border border-slate-800 shadow-2xl relative overflow-hidden flex flex-col lg:flex-row items-center justify-between gap-8">
          <div className="space-y-3 max-w-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold border border-emerald-500/30">
              <CaylaPenMascot size="xs" />
              <span>Automate Your Caribbean Payroll</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Ready to automate payroll across your team?
            </h2>
            <p className="text-sm text-slate-300 leading-relaxed font-medium">
              Cayla computes statutory deductions, prints beautiful payslips, and dispatches direct deposits in seconds.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              onClick={onStartOnboarding}
              className="px-6 py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-sm transition-all shadow-lg shadow-emerald-500/25 cursor-pointer"
            >
              Get Started Free
            </button>
            <button
              onClick={onLaunchApp}
              className="px-5 py-3.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-sm transition-all border border-white/15 cursor-pointer"
            >
              Launch Live App
            </button>
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
            <button onClick={() => onNavigate('/refund-policy')} className="hover:text-emerald-700 cursor-pointer">
              Refund Policy
            </button>
            <button onClick={() => onNavigate('/privacy-policy')} className="hover:text-emerald-700 cursor-pointer">
              Privacy Policy
            </button>
            <button onClick={() => onNavigate('/terms-of-service')} className="hover:text-emerald-700 cursor-pointer">
              Terms of Service
            </button>
            <button onClick={() => onNavigate('/security')} className="hover:text-emerald-700 cursor-pointer">
              Security
            </button>
            <button onClick={() => onNavigate('/contact')} className="hover:text-emerald-700 cursor-pointer">
              Contact
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};
