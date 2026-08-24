import React, { useState, useMemo } from 'react';
import { CalculatorPageConfig } from '../../lib/calculators/registry';
import {
  PayFrequency,
  calculateNISByCountry,
  calculatePAYEByCountry,
  calculateFullPayrollByCountry,
  NISCalculationResult,
  PAYECalculationResult,
  FullPayrollCalculationResult,
} from '../../lib/tax-rules';
import { SEOHead } from './SEOHead';
import { CaylaConversionBlock } from './CaylaConversionBlock';
import { CaylaPenMascot } from '../CaylaPenMascot';
import {
  Calculator,
  RotateCcw,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Info,
  Calendar,
  Layers,
  ArrowUpRight,
  Home,
  Check,
} from 'lucide-react';

interface CalculatorPageProps {
  config: CalculatorPageConfig;
  onNavigate: (path: string) => void;
  onLaunchApp: () => void;
  onStartOnboarding: () => void;
}

export const CalculatorPage: React.FC<CalculatorPageProps> = ({
  config,
  onNavigate,
  onLaunchApp,
  onStartOnboarding,
}) => {
  // Calculator inputs state
  const [grossInput, setGrossInput] = useState<string>(config.defaultEarnings.toString());
  const [frequency, setFrequency] = useState<PayFrequency>(config.defaultFrequency);
  const [allowanceInput, setAllowanceInput] = useState<string>('0');
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  // Numeric parsed values
  const grossValue = Math.max(0, parseFloat(grossInput) || 0);
  const allowanceValue = Math.max(0, parseFloat(allowanceInput) || 0);

  // Live Deterministic Calculations
  const calculations = useMemo(() => {
    const inputPayload = {
      grossIncome: grossValue,
      frequency,
      allowances: allowanceValue,
      taxYear: config.taxYear,
    };

    const nis = calculateNISByCountry(config.countryCode, inputPayload);
    const paye = calculatePAYEByCountry(config.countryCode, inputPayload);
    const payroll = calculateFullPayrollByCountry(config.countryCode, inputPayload);

    return { nis, paye, payroll };
  }, [grossValue, frequency, allowanceValue, config.countryCode, config.taxYear]);

  // Generate deterministic realistic example calculation for the page content
  const exampleCalculation = useMemo(() => {
    const exampleSalary = config.countryCode === 'TT' ? 10000 : config.countryCode === 'BB' ? 5000 : config.countryCode === 'LC' ? 4500 : 3500;
    const examplePayload = {
      grossIncome: exampleSalary,
      frequency: 'monthly' as PayFrequency,
      allowances: 0,
      taxYear: config.taxYear,
    };

    const nis = calculateNISByCountry(config.countryCode, examplePayload);
    const paye = calculatePAYEByCountry(config.countryCode, examplePayload);
    const payroll = calculateFullPayrollByCountry(config.countryCode, examplePayload);

    return { exampleSalary, nis, paye, payroll };
  }, [config.countryCode, config.taxYear]);

  const handleReset = () => {
    setGrossInput(config.defaultEarnings.toString());
    setFrequency(config.defaultFrequency);
    setAllowanceInput('0');
  };

  const formatMoney = (val: number) => {
    return `${config.currencySymbol}${val.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col antialiased selection:bg-emerald-500/20">
      {/* Dynamic SEO Meta & Schema Head Injection */}
      <SEOHead
        config={{
          title: config.seoTitle,
          description: config.seoDescription,
          canonicalPath: config.path,
          h1: config.h1,
          breadcrumbs: config.breadcrumbs,
          faqs: config.faqs,
          calculatorConfig: config,
        }}
      />

      {/* Top Navbar */}
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
                className="hover:text-emerald-700 transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Calculator className="w-3.5 h-3.5 text-emerald-600" />
                <span>All Calculators</span>
              </button>
              <span className="text-slate-300">/</span>
              <button
                onClick={() => onNavigate(config.breadcrumbs[2]?.path || '/calculators')}
                className="hover:text-emerald-700 transition-colors cursor-pointer"
              >
                {config.countryName}
              </button>
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
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        {/* Breadcrumb Bar */}
        <nav aria-label="Breadcrumb" className="mb-6 flex items-center gap-2 text-xs font-semibold text-slate-500 overflow-x-auto whitespace-nowrap pb-1">
          {config.breadcrumbs.map((crumb, idx) => {
            const isLast = idx === config.breadcrumbs.length - 1;
            return (
              <React.Fragment key={crumb.path}>
                {idx > 0 && <span className="text-slate-300">/</span>}
                {isLast ? (
                  <span className="text-emerald-700 font-bold" aria-current="page">
                    {crumb.name}
                  </span>
                ) : (
                  <button
                    onClick={() => onNavigate(crumb.path)}
                    className="hover:text-slate-800 transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    {idx === 0 && <Home className="w-3 h-3 text-slate-400" />}
                    <span>{crumb.name}</span>
                  </button>
                )}
              </React.Fragment>
            );
          })}
        </nav>

        {/* Header Hero Above The Fold */}
        <div className="mb-8 space-y-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="text-2xl">{config.countryFlag}</span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 text-xs font-bold border border-emerald-200">
              <Calendar className="w-3 h-3 text-emerald-600" />
              Tax Year {config.taxYear}
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-medium">
              Last updated: {config.lastUpdated}
            </span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-950 tracking-tight">
            {config.h1}
          </h1>

          <p className="text-base sm:text-lg text-slate-600 max-w-3xl leading-relaxed font-medium">
            {config.shortDescription}
          </p>
        </div>

        {/* ------------------------------------------------------------- */}
        {/* FUNCTIONAL CALCULATOR CONTAINER (ABOVE THE FOLD) */}
        {/* Desktop: 2-Column (Inputs | Live Results) */}
        {/* Mobile: Stacked (Inputs -> Calculate -> Results -> CTA) */}
        {/* ------------------------------------------------------------- */}
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xl shadow-slate-200/50 p-6 sm:p-8 lg:p-10 mb-12">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
            
            {/* LEFT COLUMN: Interactive Inputs */}
            <div className="lg:col-span-5 space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Calculator className="w-5 h-5 text-emerald-600" />
                  <span className="font-extrabold text-slate-900 text-base">Calculator Inputs</span>
                </div>
                <button
                  onClick={handleReset}
                  className="text-xs font-bold text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset</span>
                </button>
              </div>

              {/* Input 1: Gross Salary / Earnings */}
              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  Gross Earnings / Salary ({config.currency})
                </label>
                <div className="relative rounded-2xl border-2 border-slate-200 focus-within:border-emerald-600 transition-colors bg-slate-50/50">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 font-bold text-base sm:text-lg">
                    {config.currencySymbol}
                  </div>
                  <input
                    type="number"
                    min="0"
                    step="50"
                    value={grossInput}
                    onChange={(e) => setGrossInput(e.target.value)}
                    className="w-full pl-14 pr-4 py-3.5 sm:py-4 text-lg sm:text-2xl font-black text-slate-900 bg-transparent focus:outline-none placeholder:text-slate-300 font-mono"
                    placeholder="0.00"
                  />
                </div>
                <div className="flex items-center gap-1 text-[11px] text-slate-500 font-medium">
                  <Info className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>Enter gross earnings before tax and statutory deductions.</span>
                </div>
              </div>

              {/* Input 2: Pay Frequency */}
              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  Pay Frequency
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(['weekly', 'fortnightly', 'semi-monthly', 'monthly'] as PayFrequency[]).map((freq) => (
                    <button
                      key={freq}
                      onClick={() => setFrequency(freq)}
                      className={`py-2.5 px-3 rounded-xl text-xs font-bold capitalize transition-all cursor-pointer border text-center ${
                        frequency === freq
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-600/20'
                          : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                      }`}
                    >
                      {freq.replace('-', ' ')}
                    </button>
                  ))}
                </div>
              </div>

              {/* Input 3: Optional Allowances (for PAYE & Income Tax) */}
              {(config.calculatorType === 'paye' || config.calculatorType === 'salary' || config.calculatorType === 'take-home') && (
                <div className="space-y-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    Additional Tax Deductions / Allowances (Optional)
                  </label>
                  <div className="relative rounded-2xl border border-slate-200 focus-within:border-emerald-600 transition-colors bg-slate-50/50">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 font-bold text-sm">
                      {config.currencySymbol}
                    </div>
                    <input
                      type="number"
                      min="0"
                      step="50"
                      value={allowanceInput}
                      onChange={(e) => setAllowanceInput(e.target.value)}
                      className="w-full pl-10 pr-3.5 py-2.5 text-sm font-bold text-slate-900 bg-transparent focus:outline-none placeholder:text-slate-300 font-mono"
                      placeholder="0.00"
                    />
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="pt-2 flex items-center gap-3">
                <button
                  onClick={() => {}}
                  className="flex-1 py-3.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm transition-all shadow-lg shadow-emerald-600/25 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Calculate Now</span>
                </button>
                <button
                  onClick={handleReset}
                  className="py-3.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm transition-colors cursor-pointer"
                >
                  Reset
                </button>
              </div>

              <div className="p-3.5 rounded-2xl bg-emerald-50/60 border border-emerald-100 text-xs text-emerald-900 flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  <span className="font-bold">Verified Statutory Engine:</span> Calculates with 100% mathematical determinism per official {config.countryName} government tax schedules.
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: Live Prominent Results Breakdown */}
            <div className="lg:col-span-7 space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="font-extrabold text-slate-900 text-base">Your Estimated Result</span>
                </div>
                <span className="text-xs font-mono font-bold text-slate-500 capitalize">
                  Per {frequency.replace('-', ' ')}
                </span>
              </div>

              {/* Highlight Result Card */}
              <div className="rounded-3xl bg-gradient-to-br from-slate-900 to-slate-950 text-white p-6 sm:p-7 border border-slate-800 shadow-xl relative overflow-hidden">
                <div className="absolute right-0 top-0 w-48 h-48 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
                
                {/* Result Hero Header */}
                <div className="space-y-1">
                  <div className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                    {config.calculatorType === 'nis'
                      ? 'Total Estimated NIS Contribution'
                      : config.calculatorType === 'paye'
                      ? 'Estimated PAYE Tax Withholding'
                      : 'Estimated Net Take-Home Pay'}
                  </div>
                  <div className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight font-mono">
                    {config.calculatorType === 'nis'
                      ? formatMoney(calculations.nis.totalNIS)
                      : config.calculatorType === 'paye'
                      ? formatMoney(calculations.paye.payeTax)
                      : formatMoney(calculations.payroll.netTakeHomePay)}
                  </div>
                </div>

                {/* Sub-hero badge row */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-6 mt-6 border-t border-slate-800/80">
                  {config.calculatorType === 'nis' ? (
                    <>
                      <div>
                        <div className="text-[11px] text-slate-400 font-medium">Employee NIS</div>
                        <div className="text-base sm:text-lg font-bold text-emerald-400 font-mono">
                          {formatMoney(calculations.nis.employeeNIS)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] text-slate-400 font-medium">Employer NIS</div>
                        <div className="text-base sm:text-lg font-bold text-teal-300 font-mono">
                          {formatMoney(calculations.nis.employerNIS)}
                        </div>
                      </div>
                      <div className="col-span-2 sm:col-span-1">
                        <div className="text-[11px] text-slate-400 font-medium">Class / Tier</div>
                        <div className="text-xs sm:text-sm font-bold text-white truncate font-mono">
                          {calculations.nis.contributionClass || 'Standard'}
                        </div>
                      </div>
                    </>
                  ) : config.calculatorType === 'paye' ? (
                    <>
                      <div>
                        <div className="text-[11px] text-slate-400 font-medium">Effective Tax Rate</div>
                        <div className="text-base sm:text-lg font-bold text-emerald-400 font-mono">
                          {calculations.paye.effectiveTaxRate}%
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] text-slate-400 font-medium">Taxable Income</div>
                        <div className="text-base sm:text-lg font-bold text-teal-300 font-mono">
                          {formatMoney(calculations.paye.taxableIncome)}
                        </div>
                      </div>
                      <div className="col-span-2 sm:col-span-1">
                        <div className="text-[11px] text-slate-400 font-medium">Annual Tax Est.</div>
                        <div className="text-base sm:text-lg font-bold text-white font-mono">
                          {formatMoney(calculations.paye.annualTax)}
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <div className="text-[11px] text-slate-400 font-medium">Gross Pay</div>
                        <div className="text-base sm:text-lg font-bold text-white font-mono">
                          {formatMoney(calculations.payroll.grossIncome)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] text-slate-400 font-medium">Total Deductions</div>
                        <div className="text-base sm:text-lg font-bold text-rose-400 font-mono">
                          {formatMoney(calculations.payroll.totalEmployeeDeductions)}
                        </div>
                      </div>
                      <div className="col-span-2 sm:col-span-1">
                        <div className="text-[11px] text-slate-400 font-medium">Annual Net Take-Home</div>
                        <div className="text-base sm:text-lg font-bold text-emerald-400 font-mono">
                          {formatMoney(calculations.payroll.annualNet)}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Comprehensive Line Item Breakdown Table */}
              <div className="bg-slate-50/80 rounded-2xl p-4 sm:p-5 border border-slate-200/80 space-y-3">
                <div className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
                  Detailed Calculation Breakdown ({config.currency})
                </div>

                <div className="space-y-2 text-xs sm:text-sm font-medium text-slate-700">
                  <div className="flex justify-between py-1.5 border-b border-slate-200/60">
                    <span className="text-slate-600">Gross Income ({frequency})</span>
                    <span className="font-bold text-slate-900 font-mono">{formatMoney(grossValue)}</span>
                  </div>

                  {/* Insurable Earnings */}
                  <div className="flex justify-between py-1.5 border-b border-slate-200/60">
                    <span className="text-slate-600">Insurable Earnings Base</span>
                    <span className="font-bold text-slate-900 font-mono">{formatMoney(calculations.nis.insurableEarnings)}</span>
                  </div>

                  {/* Employee NIS */}
                  <div className="flex justify-between py-1.5 border-b border-slate-200/60 text-slate-700">
                    <span className="flex items-center gap-1 text-slate-600">
                      <span>Employee Statutory Social / NIS</span>
                    </span>
                    <span className="font-bold text-rose-600 font-mono">-{formatMoney(calculations.nis.employeeNIS)}</span>
                  </div>

                  {/* Health Surcharge (TT) */}
                  {config.countryCode === 'TT' && calculations.payroll.healthSurcharge > 0 && (
                    <div className="flex justify-between py-1.5 border-b border-slate-200/60 text-slate-700">
                      <span className="text-slate-600">Health Surcharge (BIR)</span>
                      <span className="font-bold text-rose-600 font-mono">-{formatMoney(calculations.payroll.healthSurcharge)}</span>
                    </div>
                  )}

                  {/* PAYE Income Tax */}
                  <div className="flex justify-between py-1.5 border-b border-slate-200/60 text-slate-700">
                    <span className="text-slate-600">PAYE Income Tax Withholding</span>
                    <span className="font-bold text-rose-600 font-mono">-{formatMoney(calculations.paye.payeTax)}</span>
                  </div>

                  {/* Employer NIS Contribution */}
                  <div className="flex justify-between py-1.5 border-b border-slate-200/60 bg-emerald-50/50 p-2 rounded-lg text-emerald-950">
                    <span className="font-semibold text-emerald-800">Employer NIS Contribution (Paid by employer)</span>
                    <span className="font-bold text-emerald-700 font-mono">{formatMoney(calculations.nis.employerNIS)}</span>
                  </div>

                  {/* Total Employee Take-Home */}
                  <div className="flex justify-between py-2 text-sm sm:text-base font-extrabold text-slate-950 pt-2">
                    <span>Estimated Net Take-Home Pay</span>
                    <span className="text-emerald-700 font-mono">{formatMoney(calculations.payroll.netTakeHomePay)}</span>
                  </div>
                </div>
              </div>

              {/* Quick Conversion Trigger */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200/70 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="space-y-0.5 text-center sm:text-left">
                  <div className="text-xs font-black text-emerald-950">
                    Want Cayla to calculate this automatically every payroll?
                  </div>
                  <div className="text-[11px] text-emerald-800">
                    Eliminate spreadsheets and manual tax schedules forever.
                  </div>
                </div>
                <button
                  onClick={onStartOnboarding || onLaunchApp}
                  className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs transition-all shadow-md shadow-emerald-600/20 shrink-0 cursor-pointer flex items-center gap-1.5"
                >
                  <CaylaPenMascot size="xs" />
                  <span>Run Payroll with Cayla</span>
                </button>
              </div>

            </div>
          </div>
        </div>

        {/* ------------------------------------------------------------- */}
        {/* CAYLA CONVERSION PROMOTIONAL BLOCK */}
        {/* ------------------------------------------------------------- */}
        <CaylaConversionBlock
          countryName={config.countryName}
          onLaunchApp={onLaunchApp}
          onStartOnboarding={onStartOnboarding}
        />

        {/* ------------------------------------------------------------- */}
        {/* RICH SEO CONTENT & EXPLANATIONS */}
        {/* ------------------------------------------------------------- */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mt-12">
          
          {/* Main Content Area (8 Cols) */}
          <div className="lg:col-span-8 space-y-10">
            
            {/* Section 1: How to use calculator */}
            <section className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 space-y-4">
              <h2 className="text-xl sm:text-2xl font-black text-slate-950 tracking-tight">
                How to use the {config.countryName} {config.h1.replace(config.countryName, '').trim()}
              </h2>
              <ul className="space-y-3">
                {config.howToUseSteps.map((step, idx) => (
                  <li key={idx} className="flex items-start gap-3 text-sm text-slate-600 leading-relaxed font-medium">
                    <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                      {idx + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ul>
            </section>

            {/* Section 2: How Tax/NIS is calculated */}
            <section className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 space-y-4">
              <h2 className="text-xl sm:text-2xl font-black text-slate-950 tracking-tight">
                How {config.calculatorType === 'nis' ? 'NIS' : 'PAYE & Taxes'} is calculated in {config.countryName}
              </h2>
              <div className="prose prose-slate text-sm sm:text-base text-slate-600 leading-relaxed font-medium space-y-3">
                <p>{config.howCalculatedMarkdown}</p>
                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 text-xs text-slate-700 space-y-2">
                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span>Statutory Authority & Compliance Note:</span>
                  </div>
                  <p>
                    All calculation formulas in Cayla follow current official statutory schedules for Tax Year {config.taxYear} from the relevant authorities in {config.countryName}.
                  </p>
                </div>
              </div>
            </section>

            {/* Section 3: Employee vs Employer contributions */}
            <section className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 space-y-4">
              <h2 className="text-xl sm:text-2xl font-black text-slate-950 tracking-tight">
                Employee vs Employer contributions
              </h2>
              <p className="text-sm sm:text-base text-slate-600 leading-relaxed font-medium">
                In Caribbean payroll systems, statutory deductions are split between the employee (withheld directly from pay) and the employer (paid as an additional payroll cost).
              </p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                  <div className="font-bold text-slate-900 text-sm flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-rose-500" />
                    Employee Portion (Withholding)
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Deducted from the employee's gross wage slip before net disbursement is released into their bank account.
                  </p>
                </div>
                <div className="p-4 rounded-2xl bg-emerald-50/50 border border-emerald-200 space-y-2">
                  <div className="font-bold text-emerald-950 text-sm flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-emerald-600" />
                    Employer Portion (Direct Remittance)
                  </div>
                  <p className="text-xs text-emerald-900 leading-relaxed">
                    Paid directly by the company to statutory boards alongside withheld employee deductions every monthly cycle.
                  </p>
                </div>
              </div>
            </section>

            {/* Section 4: Deterministic Example Calculation */}
            <section className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 space-y-4">
              <h2 className="text-xl sm:text-2xl font-black text-slate-950 tracking-tight">
                Example calculation for a {config.currencySymbol}{exampleCalculation.exampleSalary.toLocaleString()} monthly salary
              </h2>
              <p className="text-sm text-slate-600 font-medium">
                Here is a realistic calculation produced directly by the Cayla deterministic payroll engine:
              </p>

              <div className="rounded-2xl bg-slate-900 text-white p-5 border border-slate-800 font-mono text-xs sm:text-sm space-y-2.5">
                <div className="flex justify-between border-b border-slate-800 pb-2 text-slate-400">
                  <span>Gross Monthly Pay</span>
                  <span className="text-white font-bold">{formatMoney(exampleCalculation.exampleSalary)}</span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span>Employee NIS / Social Security:</span>
                  <span className="text-rose-400 font-bold">-{formatMoney(exampleCalculation.nis.employeeNIS)}</span>
                </div>
                {exampleCalculation.payroll.healthSurcharge > 0 && (
                  <div className="flex justify-between text-slate-300">
                    <span>Health Surcharge:</span>
                    <span className="text-rose-400 font-bold">-{formatMoney(exampleCalculation.payroll.healthSurcharge)}</span>
                  </div>
                )}
                <div className="flex justify-between text-slate-300">
                  <span>PAYE Income Tax:</span>
                  <span className="text-rose-400 font-bold">-{formatMoney(exampleCalculation.paye.payeTax)}</span>
                </div>
                <div className="flex justify-between border-t border-slate-800 pt-2 text-emerald-400 font-bold text-sm sm:text-base">
                  <span>Net Take-Home Pay:</span>
                  <span>{formatMoney(exampleCalculation.payroll.netTakeHomePay)}</span>
                </div>
                <div className="flex justify-between text-teal-300 text-xs pt-1">
                  <span>Employer Contribution:</span>
                  <span>+{formatMoney(exampleCalculation.nis.employerNIS)}</span>
                </div>
              </div>
            </section>

            {/* Section 5: Frequently Asked Questions (FAQ) */}
            <section className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 space-y-4">
              <div className="space-y-1">
                <h2 className="text-xl sm:text-2xl font-black text-slate-950 tracking-tight">
                  Frequently Asked Questions
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 font-medium">
                  Answers to common questions about {config.countryName} payroll taxes and statutory deductions.
                </p>
              </div>

              <div className="space-y-3 pt-2">
                {config.faqs.map((faq, idx) => {
                  const isOpen = openFaqIndex === idx;
                  return (
                    <div
                      key={idx}
                      className="border border-slate-200 rounded-2xl overflow-hidden transition-colors"
                    >
                      <button
                        onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                        className="w-full p-4 sm:p-5 text-left flex items-center justify-between gap-4 font-bold text-sm sm:text-base text-slate-900 hover:bg-slate-50/80 cursor-pointer transition-colors"
                      >
                        <span>{faq.question}</span>
                        {isOpen ? (
                          <ChevronUp className="w-4 h-4 text-emerald-600 shrink-0" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                        )}
                      </button>
                      {isOpen && (
                        <div className="px-4 sm:px-5 pb-4 sm:pb-5 text-xs sm:text-sm text-slate-600 leading-relaxed font-medium border-t border-slate-100 pt-3">
                          {faq.answer}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>

          </div>

          {/* Sidebar Area (4 Cols): Related Calculators & Country Cluster */}
          <div className="lg:col-span-4 space-y-6">
            
            {/* Related Country Calculators */}
            <div className="bg-white rounded-3xl border border-slate-200 p-6 space-y-4 sticky top-24">
              <div className="space-y-1">
                <div className="text-xs font-extrabold uppercase tracking-wider text-emerald-700">
                  {config.countryName} Cluster
                </div>
                <h3 className="text-base font-black text-slate-950">Related Payroll Calculators</h3>
              </div>

              <div className="space-y-2.5">
                {config.relatedCalculators.map((rel) => (
                  <button
                    key={rel.path}
                    onClick={() => onNavigate(rel.path)}
                    className="w-full text-left p-3.5 rounded-2xl border border-slate-200/80 hover:border-emerald-500 hover:bg-emerald-50/40 transition-all group cursor-pointer"
                  >
                    <div className="flex items-center justify-between text-xs font-bold text-slate-900 group-hover:text-emerald-800">
                      <span>{rel.name}</span>
                      <ArrowUpRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-600 transition-colors" />
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                      {rel.description}
                    </p>
                  </button>
                ))}
              </div>

              <div className="pt-2 border-t border-slate-100">
                <button
                  onClick={() => onNavigate(config.breadcrumbs[2]?.path || '/calculators')}
                  className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs transition-colors text-center cursor-pointer"
                >
                  View All {config.countryName} Calculators &rarr;
                </button>
              </div>
            </div>

          </div>
        </div>

      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-8 text-slate-500 text-xs mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <CaylaPenMascot size="xs" />
            <span className="font-bold text-slate-900">Sheetpay • Cayla AI</span>
            <span>&copy; {new Date().getFullYear()} All rights reserved.</span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-4 font-semibold text-slate-600">
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
