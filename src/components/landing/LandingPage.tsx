import React, { useState, useEffect } from 'react';
import { IPhoneMockup } from './IPhoneMockup';
import { NiaWidget } from '../nia/NiaWidget';
import { CaylaPenMascot } from '../CaylaPenMascot';
import { CaribbeanReviews } from './CaribbeanReviews';
import {
  Mic,
  ArrowRight,
  CheckCircle2,
  ShieldCheck,
  Zap,
  Play,
  FileSpreadsheet,
  Download,
  Mail,
  Share2,
  TrendingUp,
  AlertTriangle,
  FileCheck2,
  HelpCircle,
  Clock3,
  Calculator,
  Check,
  X,
  Bell,
  Menu,
  Star,
  Sparkles,
  Layers,
  Award,
  Receipt,
  LogIn,
} from 'lucide-react';

interface LandingPageProps {
  onLaunchApp: () => void;
  onStartOnboarding: () => void;
  onChoosePlan?: (plan: 'pro' | 'accountant') => void;
  onNavigate?: (path: string) => void;
  onLogin?: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onLaunchApp,
  onStartOnboarding,
  onChoosePlan,
  onNavigate = (path: string) => {
    window.location.href = path;
  },
  onLogin,
}) => {
  // Mobile Nav Drawer State
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);

  // Close mobile menu on escape key or resize
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setIsMobileMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsMobileMenuOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleMobileNavClick = (href: string) => {
    setIsMobileMenuOpen(false);
    const element = document.querySelector(href);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // -------------------------------------------------------------
  // Hero Interactive Simulation States
  // -------------------------------------------------------------
  const [heroStep, setHeroStep] = useState<number>(0);
  const [isHeroPlaying, setIsHeroPlaying] = useState<boolean>(true);

  useEffect(() => {
    if (!isHeroPlaying) return;
    const timer = setInterval(() => {
      setHeroStep((prev) => (prev + 1) % 5);
    }, 3800);
    return () => clearInterval(timer);
  }, [isHeroPlaying]);

  // -------------------------------------------------------------
  // Interactive Live Demo State
  // -------------------------------------------------------------
  const demoPrompts = [
    {
      id: 'run-payroll',
      label: 'Run payroll',
      userQuery: 'Run payroll for August 2026 for all 24 employees.',
      caylaResponse:
        "I've verified all 24 active employee attendance logs, applied statutory tax calculations (PAYE, NIS, and Health Surcharge), and generated draft payslips for August 2026.",
      stats: { gross: '$184,500.00', deductions: '$34,940.00', net: '$149,560.00', count: 24 },
      actionBadge: 'August Payroll Ready (24 Employees)',
    },
    {
      id: 'add-overtime',
      label: 'Add overtime',
      userQuery: 'Give Marcus Joseph 8 hours overtime and Kevin 4 hours overtime.',
      caylaResponse:
        "Done! I've added 8.0 hrs overtime for Marcus ($656.24) and 4.0 hrs for Kevin ($495.00). Gross and statutory withholdings have been recalculated automatically.",
      stats: { gross: '$185,651.24', deductions: '$35,230.10', net: '$150,421.14', count: 24 },
      actionBadge: 'Overtime Recalculated',
    },
    {
      id: 'give-bonus',
      label: 'Give someone a bonus',
      userQuery: 'Add a $500 performance bonus to Sarah Mohammed.',
      caylaResponse:
        "Updated! Sarah's gross pay is now $16,000.00 with the $500.00 performance bonus included. PAYE tax has been updated accordingly.",
      stats: { gross: '$185,000.00', deductions: '$35,065.00', net: '$149,935.00', count: 24 },
      actionBadge: 'Bonus Applied to Sarah',
    },
    {
      id: 'create-payslips',
      label: 'Create payslips',
      userQuery: 'Generate and prepare official PDF payslips for the entire team.',
      caylaResponse:
        'All 24 payslips have been generated with digital QR verification codes and employer statutory stamps, ready for one-click email dispatch.',
      stats: { gross: '$184,500.00', deductions: '$34,940.00', net: '$149,560.00', count: 24 },
      actionBadge: '24 Digital Payslips Generated',
    },
    {
      id: 'check-taxes',
      label: 'Check payroll taxes',
      userQuery: 'How much total PAYE and NIS do we owe the government for this cycle?',
      caylaResponse:
        'For this August cycle: Total PAYE remittance to BIR is $22,480.00, Total NIS (employer + employee) is $10,140.00, and Health Surcharge is $2,320.00.',
      stats: { gross: '$184,500.00', deductions: '$34,940.00', net: '$149,560.00', count: 24 },
      actionBadge: 'Tax Remittance Audit',
    },
    {
      id: 'compare-months',
      label: 'Compare last month',
      userQuery: 'How does August payroll compare to July?',
      caylaResponse:
        'August net payroll is up 3.4% ($4,890.00) compared to July, primarily driven by 32 total overtime hours across the Operations & Maintenance teams.',
      stats: { gross: '$184,500.00', deductions: '$34,940.00', net: '$149,560.00', count: 24 },
      actionBadge: 'Variance: +3.4% vs July',
    },
    {
      id: 'set-reminder',
      label: 'Set payroll reminders',
      userQuery: 'Remind me Friday at 3 PM to run payroll.',
      caylaResponse: "I'll remind you every Friday at 3:00 PM to run payroll.",
      stats: { gross: '$184,500.00', deductions: '$34,940.00', net: '$149,560.00', count: 24 },
      actionBadge: 'Reminder scheduled',
      kind: 'reminder' as const,
      reminderCard: {
        title: 'Payroll Reminder',
        cadence: 'Every Friday',
        time: '3:00 PM',
        nextRun: 'Friday, 3:00 PM',
      },
    },
  ];

  const [activeDemoId, setActiveDemoId] = useState<string>('run-payroll');
  const activeDemo = demoPrompts.find((d) => d.id === activeDemoId) || demoPrompts[0];

  // -------------------------------------------------------------
  // Feature 5 Template Swiper State
  // -------------------------------------------------------------
  const [activeTemplateIdx, setActiveTemplateIdx] = useState<number>(0);
  const templatePreviews = [
    { name: 'Cayla Emerald', tag: 'Fintech Dual-Card', bg: 'bg-emerald-700', text: 'text-emerald-950' },
    { name: 'Classic Corporate', tag: '3-Column Ledger', bg: 'bg-slate-800', text: 'text-slate-900' },
    { name: 'Minimalist Mono', tag: 'Clean Wireframe', bg: 'bg-black', text: 'text-black' },
    { name: 'Executive Navy', tag: 'Split Hero Payout', bg: 'bg-blue-900', text: 'text-blue-950' },
    { name: 'Govt TD4 Standard', tag: 'BIR Certified Stamp', bg: 'bg-emerald-900', text: 'text-emerald-900' },
    { name: 'Dark Obsidian', tag: 'Obsidian Neon Glow', bg: 'bg-zinc-950', text: 'text-zinc-100' },
  ];

  // -------------------------------------------------------------
  // Feature 6 AI Anomaly Review Action State
  // -------------------------------------------------------------
  const [anomalyFixed, setAnomalyFixed] = useState<boolean>(false);

  // -------------------------------------------------------------
  // Bottom CTA Input Animation
  // -------------------------------------------------------------
  const [ctaInputValue, setCtaInputValue] = useState('Run payroll for this month.');

  return (
    <div className="min-h-screen bg-white text-slate-900 selection:bg-emerald-200 font-sans antialiased overflow-x-clip">
      {/* ------------------------------------------------------------- */}
      {/* TOP NAVIGATION BAR */}
      {/* ------------------------------------------------------------- */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-100 shadow-2xs transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Logo with Pen Mascot */}
          <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center shadow-2xs">
              <CaylaPenMascot size="sm" showStatusDot={true} />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-black text-lg sm:text-xl tracking-tight text-slate-950">Sheetpay</span>
                <span className="hidden sm:inline-flex text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-200">
                  Cayla Agent
                </span>
              </div>
              <p className="text-[11px] font-semibold text-slate-500 hidden sm:block">AI Payroll Agent Platform</p>
            </div>
          </div>

          {/* Center Navigation Links (Desktop) - Smaller & Refined */}
          <nav className="hidden md:flex items-center gap-5 lg:gap-6 text-xs lg:text-[13px] font-bold text-slate-600">
            <a href="#how-it-works" className="hover:text-emerald-600 transition-colors">How It Works</a>
            <a href="#features" className="hover:text-emerald-600 transition-colors">Features</a>
            <a href="#caribbean-reviews" className="hover:text-emerald-600 transition-colors flex items-center gap-1.5">
              <span>Caribbean Reviews</span>
              <span className="text-[9px] font-black uppercase bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded-md">New</span>
            </a>
            <a href="#demo" className="hover:text-emerald-600 transition-colors">Live Demo</a>
            <a href="#templates" className="hover:text-emerald-600 transition-colors">Templates</a>
            <a href="#pricing" className="hover:text-emerald-600 transition-colors">Pricing</a>
            <a href="#comparison" className="hover:text-emerald-600 transition-colors">Why Cayla</a>
          </nav>

          {/* Right Action CTAs & Mobile Hamburger */}
          <div className="flex items-center gap-2 sm:gap-2.5">
            {onLogin && (
              <button
                onClick={onLogin}
                className="hidden sm:inline-flex items-center gap-1.5 px-3.5 lg:px-4 py-2 sm:py-2.5 border border-slate-200 hover:border-emerald-300 bg-white hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 text-xs sm:text-sm font-bold rounded-xl transition-all cursor-pointer"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Log In</span>
              </button>
            )}
            <button
              onClick={onStartOnboarding}
              className="inline-flex items-center gap-1.5 px-3.5 sm:px-4 py-2 sm:py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-black rounded-xl shadow-md shadow-emerald-600/20 hover:shadow-emerald-600/30 hover:-translate-y-0.5 transition-all cursor-pointer"
            >
              <CaylaPenMascot size="xs" />
              <span>Try Cayla Free</span>
              <ArrowRight className="w-3.5 h-3.5 hidden sm:inline-block" />
            </button>

            {/* Mobile Hamburger Menu Toggle Button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden inline-flex items-center justify-center p-2 rounded-xl text-slate-700 hover:text-slate-950 hover:bg-slate-100 active:bg-slate-200 transition-colors cursor-pointer border border-slate-200"
              aria-label="Toggle navigation menu"
              aria-expanded={isMobileMenuOpen}
            >
              {isMobileMenuOpen ? (
                <X className="w-5 h-5 text-slate-900 animate-in spin-in-90 duration-150" />
              ) : (
                <Menu className="w-5 h-5 text-slate-900" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer / Dropdown */}
        {isMobileMenuOpen && (
          <div className="fixed inset-x-0 top-20 z-50 md:hidden animate-in slide-in-from-top-3 fade-in duration-200">
            {/* Backdrop overlay */}
            <div
              className="fixed inset-0 top-20 bg-slate-950/40 backdrop-blur-xs -z-10"
              onClick={() => setIsMobileMenuOpen(false)}
            />

            {/* Drawer Content */}
            <div className="bg-white/98 backdrop-blur-xl border-b border-slate-200 shadow-2xl px-5 py-6 space-y-5 max-h-[calc(100vh-5rem)] overflow-y-auto">
              <div className="text-[11px] font-black uppercase tracking-wider text-slate-600 px-2">
                Navigation
              </div>
              <div className="grid grid-cols-1 gap-1">
                <button
                  onClick={() => handleMobileNavClick('#how-it-works')}
                  className="flex items-center justify-between px-3.5 py-3 rounded-xl text-left text-sm font-bold text-slate-800 hover:bg-emerald-50 hover:text-emerald-700 transition-colors w-full cursor-pointer"
                >
                  <span className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-mono text-xs font-black">01</span>
                    <span>How It Works</span>
                  </span>
                  <ArrowRight className="w-4 h-4 text-slate-400" />
                </button>

                <button
                  onClick={() => handleMobileNavClick('#features')}
                  className="flex items-center justify-between px-3.5 py-3 rounded-xl text-left text-sm font-bold text-slate-800 hover:bg-emerald-50 hover:text-emerald-700 transition-colors w-full cursor-pointer"
                >
                  <span className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                      <Zap className="w-4 h-4" />
                    </span>
                    <span>Features</span>
                  </span>
                  <ArrowRight className="w-4 h-4 text-slate-400" />
                </button>

                <button
                  onClick={() => handleMobileNavClick('#caribbean-reviews')}
                  className="flex items-center justify-between px-3.5 py-3 rounded-xl text-left text-sm font-bold text-slate-800 hover:bg-emerald-50 hover:text-emerald-700 transition-colors w-full cursor-pointer"
                >
                  <span className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                      <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                    </span>
                    <span className="flex items-center gap-2">
                      <span>Caribbean Reviews</span>
                      <span className="text-[10px] font-black uppercase bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded-md">New</span>
                    </span>
                  </span>
                  <ArrowRight className="w-4 h-4 text-slate-400" />
                </button>

                <button
                  onClick={() => handleMobileNavClick('#demo')}
                  className="flex items-center justify-between px-3.5 py-3 rounded-xl text-left text-sm font-bold text-slate-800 hover:bg-emerald-50 hover:text-emerald-700 transition-colors w-full cursor-pointer"
                >
                  <span className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                      <Play className="w-4 h-4 fill-emerald-600" />
                    </span>
                    <span>Interactive Demo</span>
                  </span>
                  <ArrowRight className="w-4 h-4 text-slate-400" />
                </button>

                <button
                  onClick={() => handleMobileNavClick('#templates')}
                  className="flex items-center justify-between px-3.5 py-3 rounded-xl text-left text-sm font-bold text-slate-800 hover:bg-emerald-50 hover:text-emerald-700 transition-colors w-full cursor-pointer"
                >
                  <span className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center">
                      <FileSpreadsheet className="w-4 h-4" />
                    </span>
                    <span>Payslip Templates</span>
                  </span>
                  <ArrowRight className="w-4 h-4 text-slate-400" />
                </button>

                <button
                  onClick={() => handleMobileNavClick('#pricing')}
                  className="flex items-center justify-between px-3.5 py-3 rounded-xl text-left text-sm font-bold text-slate-800 hover:bg-emerald-50 hover:text-emerald-700 transition-colors w-full cursor-pointer"
                >
                  <span className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                      <Receipt className="w-4 h-4" />
                    </span>
                    <span className="flex items-center gap-2">
                      <span>Pricing &amp; Plans</span>
                      <span className="text-[10px] font-black uppercase bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded-md">Free Tier</span>
                    </span>
                  </span>
                  <ArrowRight className="w-4 h-4 text-slate-400" />
                </button>

                <button
                  onClick={() => handleMobileNavClick('#comparison')}
                  className="flex items-center justify-between px-3.5 py-3 rounded-xl text-left text-sm font-bold text-slate-800 hover:bg-emerald-50 hover:text-emerald-700 transition-colors w-full cursor-pointer"
                >
                  <span className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center">
                      <ShieldCheck className="w-4 h-4" />
                    </span>
                    <span>Why Cayla</span>
                  </span>
                  <ArrowRight className="w-4 h-4 text-slate-400" />
                </button>
              </div>

              {/* Mobile Actions */}
              <div className="pt-2 border-t border-slate-100 space-y-2.5">
                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    onStartOnboarding();
                  }}
                  className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm rounded-xl shadow-lg shadow-emerald-600/25 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <CaylaPenMascot size="xs" />
                  <span>Get Started Free with Cayla</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
                {onLogin && (
                  <button
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      onLogin();
                    }}
                    className="w-full py-3 px-4 border border-slate-200 hover:border-emerald-300 bg-white hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 font-bold text-sm rounded-xl flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <LogIn className="w-4 h-4" />
                    <span>Log In to Your Workspace</span>
                  </button>
                )}
              </div>

              {/* Caribbean Trust Footnote in Mobile Menu */}
              <div className="pt-2 text-center">
                <p className="text-[11px] font-semibold text-slate-500 flex items-center justify-center gap-1.5">
                  <span>🇹🇹 🇧🇧 🇯🇲 🇬🇾 🇱🇨 🇧🇿</span>
                  <span>Caribbean Statutory Tax Compliant</span>
                </p>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* ------------------------------------------------------------- */}
      {/* 1. HERO SECTION */}
      {/* ------------------------------------------------------------- */}
      <section className="relative pt-10 pb-20 sm:pt-20 sm:pb-32 lg:pt-24 lg:pb-36 overflow-hidden bg-gradient-to-b from-emerald-50/50 via-white to-white">
        {/* Ambient Subtle Grid & Radial Glow */}
        <div className="absolute inset-0 bg-[radial-gradient(#10b981_1.5px,transparent_1.5px)] [background-size:28px_28px] opacity-15 pointer-events-none" />
        <div className="absolute -top-32 right-1/4 w-[500px] h-[500px] bg-emerald-300/20 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-10 items-center">
            
            {/* LEFT COLUMN: Value Proposition & CTAs */}
            <div className="lg:col-span-6 xl:col-span-6 space-y-6 sm:space-y-7 text-center lg:text-left">
              {/* User Rating Badge above H1 with Caribbean faces, 5 yellow stars, and text */}
              <div className="inline-flex items-center justify-center lg:justify-start gap-2.5 sm:gap-3 px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-full bg-white/95 border border-slate-200/90 shadow-sm hover:shadow-md transition-all">
                {/* Overlapping Caribbean People Faces Stack */}
                <div className="flex items-center -space-x-2 shrink-0">
                  <img
                    src="https://images.unsplash.com/photo-1531384441138-2736e62e0919?w=120&auto=format&fit=crop&q=80"
                    alt="Caribbean business owner Derek"
                    referrerPolicy="no-referrer"
                    className="w-7 h-7 sm:w-8 sm:h-8 rounded-full object-cover ring-2 ring-white shadow-xs"
                  />
                  <img
                    src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=120&auto=format&fit=crop&q=80"
                    alt="Caribbean HR director Camille"
                    referrerPolicy="no-referrer"
                    className="w-7 h-7 sm:w-8 sm:h-8 rounded-full object-cover ring-2 ring-white shadow-xs"
                  />
                  <img
                    src="https://images.unsplash.com/photo-1522529599102-193c0d76b5b6?w=120&auto=format&fit=crop&q=80"
                    alt="Caribbean founder Andre"
                    referrerPolicy="no-referrer"
                    className="w-7 h-7 sm:w-8 sm:h-8 rounded-full object-cover ring-2 ring-white shadow-xs"
                  />
                  <img
                    src="https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=120&auto=format&fit=crop&q=80"
                    alt="Caribbean finance lead Priya"
                    referrerPolicy="no-referrer"
                    className="w-7 h-7 sm:w-8 sm:h-8 rounded-full object-cover ring-2 ring-white shadow-xs"
                  />
                  <img
                    src="https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=120&auto=format&fit=crop&q=80"
                    alt="Caribbean manager Jean-Marc"
                    referrerPolicy="no-referrer"
                    className="w-7 h-7 sm:w-8 sm:h-8 rounded-full object-cover ring-2 ring-white shadow-xs"
                  />
                </div>

                {/* 5 Yellow Stars */}
                <div className="flex items-center gap-0.5 shrink-0" aria-label="5 out of 5 stars">
                  <Star className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-amber-400 text-amber-400" />
                  <Star className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-amber-400 text-amber-400" />
                  <Star className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-amber-400 text-amber-400" />
                  <Star className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-amber-400 text-amber-400" />
                  <Star className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-amber-400 text-amber-400" />
                </div>

                {/* Divider on larger screens */}
                <span className="w-1 h-1 rounded-full bg-slate-300 hidden sm:inline-block" />

                {/* Text: Businesses Love Cayla ❤️ */}
                <span className="text-xs sm:text-sm font-bold text-slate-800 tracking-tight whitespace-nowrap">
                  Businesses Love Cayla ❤️
                </span>
              </div>

              {/* Clean Scaled Headline */}
              <h1 className="text-3xl sm:text-4xl md:text-6xl lg:text-7xl xl:text-8xl font-black text-slate-950 tracking-tight leading-[1.1] sm:leading-[1.08] lg:leading-[1.02]">
                Payroll? Just ask <span className="text-emerald-600 inline-block underline decoration-emerald-400 decoration-wavy underline-offset-6">Cayla</span>.
              </h1>

              {/* Supporting Copy */}
              <p className="text-base sm:text-lg lg:text-xl text-slate-600 max-w-xl mx-auto lg:mx-0 leading-relaxed font-medium">
                Run payroll, calculate taxes, make changes, create payslips, and get timely payroll reminders just by asking. Cayla does the work. You review and approve.
              </p>

              {/* CTAs */}
              <div className="pt-3 flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4">
                <button
                  onClick={onStartOnboarding}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-3 px-9 py-5 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-2xl text-lg shadow-2xl shadow-emerald-600/30 hover:shadow-emerald-600/40 hover:-translate-y-0.5 transition-all cursor-pointer"
                >
                  <CaylaPenMascot size="sm" />
                  <span>Try Cayla Free</span>
                  <ArrowRight className="w-5 h-5" />
                </button>
                <a
                  href="#demo"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-8 py-5 bg-white hover:bg-slate-50 text-slate-800 font-bold rounded-2xl text-lg border-2 border-slate-200 shadow-sm transition-all cursor-pointer"
                >
                  <Play className="w-5 h-5 text-emerald-600 fill-emerald-600" />
                  <span>See Cayla in Action</span>
                </a>
              </div>

              {/* Small Supporting Text */}
              <p className="text-sm font-bold text-slate-600 flex items-center justify-center lg:justify-start gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>Zero complicated payroll screens. Just talk or type to Cayla.</span>
              </p>
            </div>

            {/* RIGHT COLUMN: Realistic Interactive iPhone Mockup */}
            <div className="lg:col-span-6 xl:col-span-6 flex flex-col items-center justify-center">

              {/* iPhone Mockup Frame */}
              <IPhoneMockup
                showWaveform={heroStep === 0 || heroStep === 1}
                activeIslandText={heroStep >= 2 && heroStep <= 3 ? 'Calculating...' : heroStep === 4 ? 'Payroll Ready' : undefined}
                showBottomNav={true}
                activeNavTab="dashboard"
              >
                {/* Inside App Header (Good morning, Marcus 👋 + Notification Bell + Avatar) */}
                <div className="bg-white border-b border-slate-100 px-4 py-3 flex items-center justify-between shadow-2xs">
                  <div>
                    <div className="text-[10px] font-medium text-slate-500">Good morning,</div>
                    <div className="font-extrabold text-xs text-slate-900 flex items-center gap-1">
                      <span>Marcus</span>
                      <span>👋</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5">
                    {/* Notification Bell with Badge */}
                    <div className="relative p-1.5 rounded-full bg-slate-50 border border-slate-200 text-slate-600">
                      <Bell className="w-3.5 h-3.5" />
                      <span className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-emerald-500 ring-1 ring-white" />
                    </div>

                    {/* User Avatar with Active Dot */}
                    <div className="relative">
                      <img
                        src="https://images.unsplash.com/photo-1531384441138-2736e62e0919?w=150&auto=format&fit=crop&q=80"
                        alt="Marcus Joseph"
                        className="w-7 h-7 rounded-full object-cover border border-slate-200"
                      />
                      <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-emerald-500 ring-1 ring-white" />
                    </div>
                  </div>
                </div>

                {/* Hero Greeting & Agent Pill inside Phone */}
                <div className="px-4 pt-3 pb-1 text-center space-y-1 bg-gradient-to-b from-slate-50 to-white">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-100 border border-emerald-200 text-[10px] font-bold text-emerald-800 shadow-2xs">
                    <CaylaPenMascot size="xs" showStatusDot={true} isProcessing={heroStep >= 1 && heroStep <= 3} />
                    <span>Cayla • AI Payroll Agent</span>
                  </div>
                  <h3 className="font-extrabold text-xs text-slate-900">Run your payroll with <span className="text-emerald-600">Cayla</span></h3>
                  <p className="text-[10px] text-slate-500 leading-tight font-medium">
                    Tell Cayla what you need. She handles the payroll calculations for you.
                  </p>
                </div>

                {/* Inside App Conversation Scroll Area */}
                <div className="p-3.5 space-y-3 flex-1 flex flex-col justify-end">
                  
                  {/* Step 0 & 1: User Voice Bubble */}
                  <div className="flex justify-end animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="bg-emerald-600 text-white rounded-2xl rounded-tr-xs p-3 max-w-[85%] shadow-sm space-y-1">
                      <div className="flex items-center justify-between text-[9px] text-emerald-200 font-bold">
                        <div className="flex items-center gap-1.5 uppercase tracking-wider">
                          <Mic className="w-3 h-3 text-emerald-200 animate-pulse" />
                          <span>You (Voice)</span>
                        </div>
                        <span className="font-mono text-[8px] opacity-80">09:41 AM</span>
                      </div>
                      <p className="text-xs font-semibold leading-relaxed">
                        &ldquo;Run payroll for August and give Marcus 8 hours overtime.&rdquo;
                      </p>
                    </div>
                  </div>

                  {/* Step 2 & 3: Cayla Multi-Step Processing Stream */}
                  {heroStep >= 1 && heroStep <= 3 && (
                    <div className="space-y-1.5 p-3 rounded-2xl bg-white border border-emerald-200 shadow-2xs animate-in fade-in duration-300">
                      <div className="flex items-center gap-2 pb-1 text-[10px] font-bold text-emerald-800 border-b border-slate-100">
                        <CaylaPenMascot size="xs" isProcessing={true} />
                        <span>Cayla is processing payroll...</span>
                      </div>
                      
                      <div className="space-y-1 text-[10px] font-mono text-slate-600 pt-1">
                        <div className="flex items-center gap-1.5 text-emerald-700 font-semibold">
                          <Check className="w-3 h-3 text-emerald-600" />
                          <span>Checking 24 active employees...</span>
                        </div>
                        <div className={`flex items-center gap-1.5 ${heroStep >= 2 ? 'text-emerald-700 font-semibold' : 'text-slate-400'}`}>
                          {heroStep >= 2 ? <Check className="w-3 h-3 text-emerald-600" /> : <span className="w-2 h-2 rounded-full bg-slate-300" />}
                          <span>Calculating 8 hrs overtime for Marcus...</span>
                        </div>
                        <div className={`flex items-center gap-1.5 ${heroStep >= 2 ? 'text-emerald-700 font-semibold' : 'text-slate-400'}`}>
                          {heroStep >= 2 ? <Check className="w-3 h-3 text-emerald-600" /> : <span className="w-2 h-2 rounded-full bg-slate-300" />}
                          <span>Computing PAYE, NIS &amp; Health Surcharge...</span>
                        </div>
                        <div className={`flex items-center gap-1.5 ${heroStep >= 3 ? 'text-emerald-700 font-semibold' : 'text-slate-400'}`}>
                          {heroStep >= 3 ? <Check className="w-3 h-3 text-emerald-600" /> : <span className="w-2 h-2 rounded-full bg-slate-300" />}
                          <span>Generating 24 printable payslips...</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Step 4: Final Ready State with Compact Payroll Card */}
                  {heroStep >= 4 && (
                    <div className="space-y-2 animate-in fade-in zoom-in-95 duration-400">
                      {/* Cayla Speech Bubble */}
                      <div className="flex gap-2">
                        <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                          <CaylaPenMascot size="xs" />
                        </div>
                        <div className="bg-white rounded-2xl rounded-tl-xs p-2.5 border border-slate-200 shadow-2xs text-xs text-slate-800">
                          <p className="font-semibold text-slate-900">
                            &ldquo;August payroll is calculated and ready for review.&rdquo;
                          </p>
                        </div>
                      </div>

                      {/* Compact Payroll Result Card */}
                      <div className="bg-white text-slate-900 rounded-2xl p-3.5 shadow-md border border-slate-200 space-y-2.5">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                          <div>
                            <div className="text-[10px] text-emerald-700 font-bold uppercase tracking-wider">August 2026 Payroll</div>
                            <div className="text-xs font-semibold text-slate-800">24 Employees Verified</div>
                          </div>
                          <span className="text-[9px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-200">
                            Draft Ready
                          </span>
                        </div>

                        <div className="grid grid-cols-3 gap-1.5 text-center font-mono py-1">
                          <div className="bg-slate-50 p-1.5 rounded-lg border border-slate-100">
                            <div className="text-[9px] text-slate-500">Gross Pay</div>
                            <div className="text-[11px] font-bold text-slate-900 mt-0.5">$184,500</div>
                          </div>
                          <div className="bg-slate-50 p-1.5 rounded-lg border border-slate-100">
                            <div className="text-[9px] text-slate-500">Deductions</div>
                            <div className="text-[11px] font-bold text-rose-600 mt-0.5">$34,940</div>
                          </div>
                          <div className="bg-emerald-50 border border-emerald-200 p-1.5 rounded-lg">
                            <div className="text-[9px] text-emerald-800 font-bold">Net Pay</div>
                            <div className="text-[11px] font-black text-emerald-700 mt-0.5">$149,560</div>
                          </div>
                        </div>

                        <button
                          onClick={onLaunchApp}
                          className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                        >
                          <span>Review &amp; Approve Payroll</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Bottom Input Area in Phone */}
                <div className="p-2.5 bg-white border-t border-slate-100 flex items-center gap-2">
                  <div className="flex-1 bg-slate-100 rounded-full px-3 py-1.5 text-[10px] text-slate-500 flex items-center justify-between">
                    <span className="truncate">Ask Cayla anything...</span>
                    <Mic className="w-3 h-3 text-emerald-600" />
                  </div>
                  <div className="w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                    <CaylaPenMascot size="xs" />
                  </div>
                </div>
              </IPhoneMockup>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- */}
      {/* 2. SOCIAL PROOF / TRUST STATEMENTS */}
      {/* ------------------------------------------------------------- */}
      <section className="border-y border-slate-200 bg-slate-50/80 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h2 className="text-lg sm:text-2xl lg:text-3xl font-black uppercase tracking-wider text-slate-700">
              Payroll shouldn&apos;t require <span className="text-emerald-600 font-black">20 complex screens</span>.
            </h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 sm:gap-6 text-center">
            <div className="flex flex-col items-center gap-2.5 p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
              <Zap className="w-6 h-6 text-emerald-600" />
              <span className="text-sm font-bold text-slate-800 leading-tight">AI-powered payroll workflows</span>
            </div>
            <div className="flex flex-col items-center gap-2.5 p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
              <Calculator className="w-6 h-6 text-emerald-600" />
              <span className="text-sm font-bold text-slate-800 leading-tight">Country-aware statutory taxes</span>
            </div>
            <div className="flex flex-col items-center gap-2.5 p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
              <CheckCircle2 className="w-6 h-6 text-emerald-600" />
              <span className="text-sm font-bold text-slate-800 leading-tight">Editable before final approval</span>
            </div>
            <div className="flex flex-col items-center gap-2.5 p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
              <Clock3 className="w-6 h-6 text-emerald-600" />
              <span className="text-sm font-bold text-slate-800 leading-tight">Forensic payroll audit history</span>
            </div>
            <div className="flex flex-col items-center gap-2.5 p-4 bg-white rounded-2xl border border-slate-200 shadow-xs col-span-2 md:col-span-1">
              <ShieldCheck className="w-6 h-6 text-emerald-600" />
              <span className="text-sm font-bold text-slate-800 leading-tight">Enterprise grade data security</span>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- */}
      {/* 3. HOW CAYLA WORKS (3 Simple Steps) */}
      {/* ------------------------------------------------------------- */}
      <section id="how-it-works" className="py-24 sm:py-32 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
            <span className="text-sm font-black uppercase tracking-widest text-emerald-700 bg-emerald-50 px-4 py-1.5 rounded-full border border-emerald-200">
              Effortless Workflow
            </span>
            <h2 className="text-4xl sm:text-6xl lg:text-7xl font-black text-slate-950 tracking-tight leading-tight">
              Payroll in a <span className="text-emerald-600">single conversation</span>.
            </h2>
            <p className="text-slate-600 text-base sm:text-xl leading-relaxed font-medium">
              Say goodbye to multi-tab spreadsheet nightmares. Cayla transforms natural instructions into compliant payroll records in seconds.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Step 01 */}
            <div className="relative bg-slate-50 p-8 sm:p-10 rounded-3xl border border-slate-200 shadow-sm space-y-4 hover:border-emerald-400 transition-all">
              <div className="text-5xl sm:text-6xl font-black font-mono text-emerald-600">01</div>
              <h3 className="text-2xl sm:text-3xl font-black text-slate-900">
                <span className="text-emerald-600">Tell</span> Cayla
              </h3>
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-sm font-mono font-bold text-emerald-900">
                &ldquo;Run payroll for this month.&rdquo;
              </div>
              <p className="text-sm sm:text-base text-slate-600 leading-relaxed font-medium">
                Type or speak naturally. Mention any bonuses, overtime hours, unpaid leave or salary changes in plain English.
              </p>
            </div>

            {/* Step 02 */}
            <div className="relative bg-slate-50 p-8 sm:p-10 rounded-3xl border border-slate-200 shadow-sm space-y-4 hover:border-emerald-400 transition-all">
              <div className="text-5xl sm:text-6xl font-black font-mono text-emerald-600">02</div>
              <h3 className="text-2xl sm:text-3xl font-black text-slate-900">
                <span className="text-emerald-600">Cayla</span> does the work
              </h3>
              <div className="p-4 bg-white border border-slate-200 rounded-2xl text-sm font-mono text-slate-700 font-medium">
                Cayla checks employees, earnings, overtime, deductions and applicable taxes.
              </div>
              <p className="text-sm sm:text-base text-slate-600 leading-relaxed font-medium">
                Her deterministic calculation engine computes exact PAYE, NIS, and Health Surcharge rates for your specific jurisdiction.
              </p>
            </div>

            {/* Step 03 */}
            <div className="relative bg-slate-50 p-8 sm:p-10 rounded-3xl border border-slate-200 shadow-sm space-y-4 hover:border-emerald-400 transition-all">
              <div className="text-5xl sm:text-6xl font-black font-mono text-emerald-600">03</div>
              <h3 className="text-2xl sm:text-3xl font-black text-slate-900">
                <span className="text-emerald-600">Review</span> &amp; approve
              </h3>
              <div className="p-4 bg-slate-900 text-white rounded-2xl text-sm font-mono font-bold">
                Review the numbers, tweak anything necessary, and approve when you&apos;re ready.
              </div>
              <p className="text-sm sm:text-base text-slate-600 leading-relaxed font-medium">
                Everything is editable in structured cards or with quick follow-up voice tweaks before you finalize and distribute payslips.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- */}
      {/* 4. FEATURE SECTIONS (Alternating ZIG-ZAG with Large iPhones) */}
      {/* ------------------------------------------------------------- */}
      <section id="features" className="py-16 space-y-28 sm:space-y-36 bg-slate-50/60">
        
        {/* FEATURE 1: Voice Payroll */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            
            {/* Text Left */}
            <div className="lg:col-span-6 space-y-6">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-100 text-emerald-800 text-xs sm:text-sm font-bold">
                <Mic className="w-4 h-4" />
                <span>Voice Payroll</span>
              </div>
              <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black text-slate-950 tracking-tight leading-[1.12]">
                Just tell <span className="text-emerald-600">Cayla</span> what changed.
              </h2>
              <p className="text-slate-600 text-base sm:text-lg leading-relaxed font-medium">
                Speak naturally instead of filling out cumbersome payroll forms. Cayla listens, transcribes in real-time, and updates your compensation records instantly.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                {[
                  'Live voice transcription',
                  'Natural language commands',
                  'Context-aware conversations',
                  'Instant payroll updates',
                ].map((b, i) => (
                  <div key={i} className="flex items-center gap-2.5 text-sm font-bold text-slate-800 bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    <span>{b}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Phone Right */}
            <div className="lg:col-span-6 flex justify-center">
              <IPhoneMockup showWaveform={true}>
                {/* Header */}
                <div className="bg-white px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CaylaPenMascot size="xs" />
                    <span className="font-extrabold text-xs text-slate-900">Voice Payroll Session</span>
                  </div>
                  <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full font-bold">
                    Transcribing...
                  </span>
                </div>

                {/* Content */}
                <div className="p-3.5 space-y-3 flex-1 overflow-y-auto">
                  <div className="bg-emerald-600 text-white p-3 rounded-2xl rounded-tr-xs text-xs font-medium space-y-1 shadow-xs">
                    <div className="text-[9px] uppercase font-bold text-emerald-200">You (Voice)</div>
                    <p>&ldquo;Sarah gets a $500 bonus this month and Marcus worked 8 hours overtime.&rdquo;</p>
                  </div>

                  <div className="bg-white p-3 rounded-2xl rounded-tl-xs border border-slate-200 text-xs text-slate-800 space-y-1 shadow-2xs">
                    <div className="flex items-center gap-1.5 text-[9px] font-bold text-emerald-800">
                      <CaylaPenMascot size="xs" />
                      <span>Cayla</span>
                    </div>
                    <p>&ldquo;I&apos;ve updated Sarah and Marcus and recalculated statutory deductions.&rdquo;</p>
                  </div>

                  <div className="space-y-2 pt-1">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Updated Records</div>
                    
                    {/* Sarah Card */}
                    <div className="bg-white border-2 border-emerald-500/80 p-3 rounded-2xl text-xs space-y-2 shadow-2xs">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <img
                            src="https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=150&auto=format&fit=crop&q=80"
                            alt="Sarah Mohammed"
                            className="w-7 h-7 rounded-full object-cover border border-slate-200"
                          />
                          <div>
                            <span className="font-bold text-slate-900 block leading-tight">Sarah Mohammed</span>
                            <span className="text-[10px] text-slate-500">Finance Controller</span>
                          </div>
                        </div>
                        <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full border border-emerald-200">
                          +$500.00 Bonus
                        </span>
                      </div>
                      <div className="flex justify-between text-[11px] text-slate-600 font-mono bg-slate-50 p-2 rounded-xl border border-slate-100">
                        <span>Gross: <b className="text-slate-900">$16,000.00</b></span>
                        <span>Net: <b className="text-emerald-700 font-black">$12,980.20</b></span>
                      </div>
                    </div>

                    {/* Marcus Card */}
                    <div className="bg-white border-2 border-emerald-500/80 p-3 rounded-2xl text-xs space-y-2 shadow-2xs">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <img
                            src="https://images.unsplash.com/photo-1531384441138-2736e62e0919?w=150&auto=format&fit=crop&q=80"
                            alt="Marcus Joseph"
                            className="w-7 h-7 rounded-full object-cover border border-slate-200"
                          />
                          <div>
                            <span className="font-bold text-slate-900 block leading-tight">Marcus Joseph</span>
                            <span className="text-[10px] text-slate-500">Operations Lead</span>
                          </div>
                        </div>
                        <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full border border-emerald-200">
                          +8.0 hrs OT
                        </span>
                      </div>
                      <div className="flex justify-between text-[11px] text-slate-600 font-mono bg-slate-50 p-2 rounded-xl border border-slate-100">
                        <span>Gross: <b className="text-slate-900">$9,406.24</b></span>
                        <span>Net: <b className="text-emerald-700 font-black">$7,432.10</b></span>
                      </div>
                    </div>
                  </div>
                </div>
              </IPhoneMockup>
            </div>
          </div>
        </div>

        {/* FEATURE 2: Agentic Payroll */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            
            {/* Phone Left */}
            <div className="lg:col-span-6 flex justify-center order-2 lg:order-1">
              <IPhoneMockup activeIslandText="Autonomous Loop">
                <div className="bg-white border-b border-slate-100 px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CaylaPenMascot size="xs" isProcessing={true} />
                    <div>
                      <div className="text-xs font-extrabold text-slate-900">Autonomous Workflow</div>
                      <div className="text-[10px] text-emerald-600 font-semibold">Multi-Step Payroll Loop</div>
                    </div>
                  </div>
                  <span className="text-[9px] font-mono bg-emerald-100 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-full font-bold">
                    ACTIVE
                  </span>
                </div>

                <div className="p-3.5 space-y-3 flex-1 bg-slate-50 text-slate-800 font-mono text-xs overflow-y-auto">
                  <div className="text-[10px] text-emerald-800 font-bold uppercase tracking-wider bg-emerald-50 p-2.5 rounded-xl border border-emerald-200">
                    Command: &ldquo;Run August payroll&rdquo;
                  </div>

                  <div className="space-y-1.5 pt-0.5">
                    {[
                      { title: 'Finding 24 active employees', status: 'done' },
                      { title: 'Checking attendance & clock-in logs', status: 'done' },
                      { title: 'Calculating base & overtime earnings', status: 'done' },
                      { title: 'Calculating statutory tax deductions', status: 'done' },
                      { title: 'Checking unusual variances & anomalies', status: 'done' },
                      { title: 'Generating 24 individual payslips', status: 'done' },
                    ].map((step, idx) => (
                      <div key={idx} className="flex items-center gap-2.5 p-2 rounded-xl bg-white border border-slate-200 shadow-2xs">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span className="text-[11px] text-slate-800 font-medium">{step.title}</span>
                      </div>
                    ))}
                  </div>

                  <div className="p-3 bg-emerald-600 text-white rounded-2xl text-center space-y-0.5 shadow-xs">
                    <div className="text-[10px] text-emerald-100 font-bold uppercase">Payroll Ready for Review</div>
                    <div className="text-sm font-black font-mono">$149,560.00 Net Remittance</div>
                  </div>
                </div>
              </IPhoneMockup>
            </div>

            {/* Text Right */}
            <div className="lg:col-span-6 space-y-6 order-1 lg:order-2">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-100 text-emerald-800 text-xs sm:text-sm font-bold">
                <CaylaPenMascot size="xs" />
                <span>True Agentic AI</span>
              </div>
              <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black text-slate-950 tracking-tight leading-[1.12]">
                Cayla doesn&apos;t just answer. She <span className="text-emerald-600">does the work</span>.
              </h2>
              <p className="text-slate-600 text-base sm:text-lg leading-relaxed font-medium">
                Traditional AI simply spits out instructions for you to follow. Cayla executes multi-step autonomous payroll workflows—querying records, auditing attendance, computing withholdings, and preparing digital remittance advices end-to-end.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                {[
                  'Autonomous multi-step workflows',
                  'Audits missing statutory IDs',
                  'Replaces manual timesheet tallying',
                  'Prepares compliant remittance advice',
                ].map((b, i) => (
                  <div key={i} className="flex items-center gap-2.5 text-sm font-bold text-slate-800 bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    <span>{b}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* FEATURE 3: Live Payroll Workspace */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            
            {/* Text Left */}
            <div className="lg:col-span-6 space-y-6">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-100 text-emerald-800 text-xs sm:text-sm font-bold">
                <FileSpreadsheet className="w-4 h-4" />
                <span>Live Interactive Workspace</span>
              </div>
              <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black text-slate-950 tracking-tight leading-[1.12]">
                Watch your <span className="text-emerald-600">payroll build itself</span>.
              </h2>
              <p className="text-slate-600 text-base sm:text-lg leading-relaxed font-medium">
                Cayla turns your conversation into structured payroll data you can review and edit. Payroll cards populate dynamically only when requested, keeping your workspace clear and distraction-free.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                {[
                  'Structured interactive employee cards',
                  'One-tap inline value editing',
                  'Automatic recalculation on change',
                  'Zero clutter empty state',
                ].map((b, i) => (
                  <div key={i} className="flex items-center gap-2.5 text-sm font-bold text-slate-800 bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    <span>{b}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Phone Right */}
            <div className="lg:col-span-6 flex justify-center">
              <IPhoneMockup>
                <div className="bg-white px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                  <div className="font-extrabold text-xs text-slate-900 flex items-center gap-1.5">
                    <CaylaPenMascot size="xs" />
                    <span>Structured Payroll Cards</span>
                  </div>
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">Live Sync</span>
                </div>

                <div className="p-3.5 space-y-3 flex-1 overflow-y-auto">
                  {/* Marcus Card */}
                  <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <img
                          src="https://images.unsplash.com/photo-1531384441138-2736e62e0919?w=150&auto=format&fit=crop&q=80"
                          alt="Marcus Joseph"
                          className="w-8 h-8 rounded-full object-cover border border-slate-200"
                        />
                        <div>
                          <div className="font-extrabold text-xs text-slate-900 leading-tight">Marcus Joseph</div>
                          <div className="text-[10px] text-slate-500">Senior Operations Supervisor</div>
                        </div>
                      </div>
                      <span className="text-[9px] font-mono font-bold bg-slate-100 px-2 py-0.5 rounded text-slate-700">EMP-0101</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px] font-mono pt-1 border-t border-slate-100">
                      <div className="bg-slate-50 p-2 rounded-xl border border-slate-100">
                        <div className="text-[9px] text-slate-400 font-sans">Gross Pay</div>
                        <div className="font-bold text-slate-900">$8,750.00</div>
                      </div>
                      <div className="bg-emerald-50 p-2 rounded-xl border border-emerald-200">
                        <div className="text-[9px] text-emerald-700 font-bold font-sans">Overtime (8 hrs)</div>
                        <div className="font-bold text-emerald-800">+$656.24</div>
                      </div>
                      <div className="bg-slate-50 p-2 rounded-xl border border-slate-100">
                        <div className="text-[9px] text-slate-400 font-sans">Deductions</div>
                        <div className="font-bold text-rose-700">-$1,875.20</div>
                      </div>
                      <div className="bg-emerald-600 text-white p-2 rounded-xl shadow-xs">
                        <div className="text-[9px] text-emerald-200 font-sans">Net Pay</div>
                        <div className="font-black text-white">$6,874.80</div>
                      </div>
                    </div>
                  </div>

                  {/* Sarah Card */}
                  <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <img
                          src="https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=150&auto=format&fit=crop&q=80"
                          alt="Sarah Mohammed"
                          className="w-8 h-8 rounded-full object-cover border border-slate-200"
                        />
                        <div>
                          <div className="font-extrabold text-xs text-slate-900 leading-tight">Sarah Mohammed</div>
                          <div className="text-[10px] text-slate-500">Lead Financial Controller</div>
                        </div>
                      </div>
                      <span className="text-[9px] font-mono font-bold bg-slate-100 px-2 py-0.5 rounded text-slate-700">EMP-0102</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px] font-mono pt-1 border-t border-slate-100">
                      <div className="bg-slate-50 p-2 rounded-xl border border-slate-100">
                        <div className="text-[9px] text-slate-400 font-sans">Gross Pay</div>
                        <div className="font-bold text-slate-900">$14,500.00</div>
                      </div>
                      <div className="bg-emerald-600 text-white p-2 rounded-xl shadow-xs">
                        <div className="text-[9px] text-emerald-200 font-sans">Net Pay</div>
                        <div className="font-black text-white">$11,840.40</div>
                      </div>
                    </div>
                  </div>
                </div>
              </IPhoneMockup>
            </div>
          </div>
        </div>

        {/* FEATURE 4: Beautiful Payslips */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            
            {/* Phone Left */}
            <div className="lg:col-span-6 flex justify-center order-2 lg:order-1">
              <IPhoneMockup>
                <div className="bg-emerald-800 text-white p-4 space-y-1">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-1.5">
                      <CaylaPenMascot size="xs" />
                      <span className="text-[9px] uppercase tracking-widest font-bold text-emerald-300">Official Payslip Advice</span>
                    </div>
                    <span className="text-[10px] font-mono text-emerald-200">AUG 2026</span>
                  </div>
                  <h3 className="font-black text-sm text-white">Apex Dynamics Caribbean Ltd</h3>
                  <div className="text-[9px] text-emerald-200 font-mono">BIR: 10948392-01 • NIS: 8849204</div>
                </div>

                <div className="p-3.5 space-y-3 flex-1 overflow-y-auto bg-white text-xs">
                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 flex justify-between items-center">
                    <div>
                      <div className="font-bold text-slate-900">Marcus Joseph</div>
                      <div className="text-[10px] text-slate-500">Operations • EMP-0101</div>
                    </div>
                    <div className="text-right text-[10px] font-mono text-slate-600">
                      <div>BIR: 104-892-334</div>
                      <div>NIS: 849-20-4491</div>
                    </div>
                  </div>

                  <div className="space-y-1.5 text-[11px] font-mono">
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-600">Basic Monthly Pay:</span>
                      <span className="font-bold text-slate-900">$8,750.00</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100 text-emerald-700 font-semibold">
                      <span>Overtime (8.0 hrs):</span>
                      <span>+$656.24</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100 text-rose-700">
                      <span>PAYE Statutory Tax:</span>
                      <span>-$840.00</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100 text-rose-700">
                      <span>NIS Contribution:</span>
                      <span>-$485.20</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100 text-rose-700">
                      <span>Health Surcharge:</span>
                      <span>-$50.00</span>
                    </div>
                  </div>

                  {/* Net Pay Card */}
                  <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl flex justify-between items-center">
                    <span className="font-bold text-emerald-900 text-xs uppercase">Net Remitted</span>
                    <span className="text-base font-black font-mono text-emerald-800">$7,432.10</span>
                  </div>

                  {/* Actions */}
                  <div className="grid grid-cols-3 gap-2 pt-1">
                    <button className="py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1">
                      <Download className="w-3 h-3" /> PDF
                    </button>
                    <button className="py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1">
                      <Mail className="w-3 h-3" /> Email
                    </button>
                    <button className="py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1">
                      <Share2 className="w-3 h-3" /> Share
                    </button>
                  </div>
                </div>
              </IPhoneMockup>
            </div>

            {/* Text Right */}
            <div className="lg:col-span-6 space-y-6 order-1 lg:order-2">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-100 text-emerald-800 text-xs sm:text-sm font-bold">
                <FileCheck2 className="w-4 h-4" />
                <span>Automated Payslips</span>
              </div>
              <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black text-slate-950 tracking-tight leading-[1.12]">
                Branded payslips <span className="text-emerald-600">generated instantly</span>.
              </h2>
              <p className="text-slate-600 text-base sm:text-lg leading-relaxed font-medium">
                Generate bank-ready payslips complete with company branding, tax registration numbers, detailed earnings, statutory withholdings, authorization signatures, and digital verification.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                {[
                  'Instant PDF download & print',
                  'Automated one-click email delivery',
                  'QR-code security verification',
                  'Compliant statutory formatting',
                ].map((b, i) => (
                  <div key={i} className="flex items-center gap-2.5 text-sm font-bold text-slate-800 bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    <span>{b}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* FEATURE 5: 12 Payslip Templates */}
        <div id="templates" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            
            {/* Text Left */}
            <div className="lg:col-span-6 space-y-6">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-100 text-emerald-800 text-xs sm:text-sm font-bold">
                <CaylaPenMascot size="xs" />
                <span>Brand Customization</span>
              </div>
              <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black text-slate-950 tracking-tight leading-[1.12]">
                Your payroll. <span className="text-emerald-600">Your brand</span>.
              </h2>
              <p className="text-slate-600 text-base sm:text-lg leading-relaxed font-medium">
                Choose from 12 customizable payslip templates and make every payslip match your business identity. Switch layouts, adjust primary hues, toggle logos, and add authorized signatures instantly.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                {[
                  '12 professional template designs',
                  'Custom logo & brand colors',
                  'Digital signature integration',
                  'Instant layout switching',
                ].map((b, i) => (
                  <div key={i} className="flex items-center gap-2.5 text-sm font-bold text-slate-800 bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    <span>{b}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Phone Right */}
            <div className="lg:col-span-6 flex justify-center">
              <IPhoneMockup>
                <div className="bg-white px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                  <div className="font-extrabold text-xs text-slate-900 flex items-center gap-1.5">
                    <CaylaPenMascot size="xs" />
                    <span>Template Selector (12 Styles)</span>
                  </div>
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">Live</span>
                </div>

                <div className="p-3.5 space-y-3 flex-1 overflow-y-auto">
                  {/* Swiper Thumbnails */}
                  <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
                    {templatePreviews.map((t, idx) => (
                      <button
                        key={idx}
                        onClick={() => setActiveTemplateIdx(idx)}
                        className={`p-2 rounded-xl text-left border shrink-0 w-28 transition-all cursor-pointer ${
                          activeTemplateIdx === idx
                            ? 'border-emerald-600 bg-emerald-50/70 ring-2 ring-emerald-500/20'
                            : 'border-slate-200 bg-white hover:bg-slate-50'
                        }`}
                      >
                        <div className={`w-full h-8 rounded-md mb-1.5 ${t.bg} flex items-center justify-center text-[9px] font-bold text-white shadow-2xs`}>
                          {idx + 1}
                        </div>
                        <div className="font-bold text-[10px] text-slate-800 truncate">{t.name}</div>
                        <div className="text-[8px] text-slate-500 truncate">{t.tag}</div>
                      </button>
                    ))}
                  </div>

                  {/* Live Template Dynamic View Inside Phone */}
                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-2 text-xs">
                    <div className="flex items-center justify-between pb-1 border-b border-slate-200">
                      <span className="font-bold text-slate-900">{templatePreviews[activeTemplateIdx].name}</span>
                      <span className="text-[9px] font-bold uppercase text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">Active</span>
                    </div>

                    <div className={`p-3 rounded-xl text-white ${templatePreviews[activeTemplateIdx].bg} flex justify-between items-center shadow-xs`}>
                      <div>
                        <div className="text-[9px] opacity-80 uppercase">Apex Dynamics Caribbean</div>
                        <div className="text-xs font-bold">Marcus Joseph</div>
                      </div>
                      <div className="text-right font-mono font-black text-sm">
                        $7,432.10
                      </div>
                    </div>

                    <div className="text-[10px] text-slate-500 text-center pt-1 font-medium">
                      Tap any template above to switch among all 12 designs instantly.
                    </div>
                  </div>
                </div>
              </IPhoneMockup>
            </div>
          </div>
        </div>

        {/* FEATURE 6: AI Anomaly Review */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            
            {/* Phone Left */}
            <div className="lg:col-span-6 flex justify-center order-2 lg:order-1">
              <IPhoneMockup activeIslandText="Audit Active">
                <div className="bg-white px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-extrabold text-xs text-slate-900">
                    <CaylaPenMascot size="xs" />
                    <span>Cayla Pre-Approval Audit</span>
                  </div>
                  <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded">
                    {anomalyFixed ? 'All Clear' : '3 Insights'}
                  </span>
                </div>

                <div className="p-3.5 space-y-2.5 flex-1 overflow-y-auto bg-slate-50 text-xs">
                  {anomalyFixed ? (
                    <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-2xl text-center space-y-2 animate-in fade-in">
                      <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
                      <div className="font-bold text-emerald-900 text-sm">All Insights Resolved</div>
                      <p className="text-[11px] text-emerald-700">Cayla has verified all 24 records. Payroll is ready for final authorization.</p>
                      <button
                        onClick={() => setAnomalyFixed(false)}
                        className="text-[10px] font-bold text-emerald-800 underline cursor-pointer"
                      >
                        Reset Insights Demo
                      </button>
                    </div>
                  ) : (
                    <>
                      {/* Insight 1 */}
                      <div className="bg-white p-3 rounded-xl border border-amber-200 shadow-2xs space-y-1">
                        <div className="flex items-center gap-1.5 text-amber-800 font-bold text-[11px]">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          <span>Overtime Spike</span>
                        </div>
                        <p className="text-[10px] text-slate-600">Marcus has significantly more overtime (8 hrs) than last month.</p>
                      </div>

                      {/* Insight 2 */}
                      <div className="bg-white p-3 rounded-xl border border-blue-200 shadow-2xs space-y-1">
                        <div className="flex items-center gap-1.5 text-blue-800 font-bold text-[11px]">
                          <TrendingUp className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                          <span>Cycle Comparison</span>
                        </div>
                        <p className="text-[10px] text-slate-600">Payroll is 3.4% higher than July due to Operations team overtime.</p>
                      </div>

                      {/* Insight 3 */}
                      <div className="bg-white p-3 rounded-xl border border-rose-200 shadow-2xs space-y-1">
                        <div className="flex items-center gap-1.5 text-rose-800 font-bold text-[11px]">
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                          <span>Missing Registration</span>
                        </div>
                        <p className="text-[10px] text-slate-600">1 employee missing BIR tax identification number.</p>
                      </div>

                      {/* Interactive Fix with Cayla Button */}
                      <div className="pt-2 flex gap-2">
                        <button
                          onClick={() => setAnomalyFixed(true)}
                          className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-[11px] transition-colors flex items-center justify-center gap-1 cursor-pointer shadow-xs"
                        >
                          <CaylaPenMascot size="xs" />
                          <span>Fix with Cayla</span>
                        </button>
                        <button
                          onClick={() => setAnomalyFixed(true)}
                          className="px-3 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-bold text-[11px] transition-colors cursor-pointer"
                        >
                          Ignore
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </IPhoneMockup>
            </div>

            {/* Text Right */}
            <div className="lg:col-span-6 space-y-6 order-1 lg:order-2">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-100 text-emerald-800 text-xs sm:text-sm font-bold">
                <ShieldCheck className="w-4 h-4" />
                <span>Proactive Anomaly Detection</span>
              </div>
              <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black text-slate-950 tracking-tight leading-[1.12]">
                Cayla checks <span className="text-emerald-600">before you approve</span>.
              </h2>
              <p className="text-slate-600 text-base sm:text-lg leading-relaxed font-medium">
                Never let an unexpected salary variance or missing tax number slip through. Cayla audits every line item against historical payrolls and alerts you before you finalize.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                {[
                  'Detects unusual overtime spikes',
                  'Audits missing statutory IDs',
                  'Historical month-over-month variance',
                  'One-tap automated reconciliation',
                ].map((b, i) => (
                  <div key={i} className="flex items-center gap-2.5 text-sm font-bold text-slate-800 bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    <span>{b}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* FEATURE 7: Payroll Taxes */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            
            {/* Text Left */}
            <div className="lg:col-span-6 space-y-6">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-100 text-emerald-800 text-xs sm:text-sm font-bold">
                <Calculator className="w-4 h-4" />
                <span>Deterministic Tax Engine</span>
              </div>
              <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black text-slate-950 tracking-tight leading-[1.12]">
                Statutory taxes calculated <span className="text-emerald-600">with zero error</span>.
              </h2>
              <p className="text-slate-600 text-base sm:text-lg leading-relaxed font-medium">
                Cayla automatically applies the exact payroll calculations using your business&apos;s configured country and statutory tax rules. Cayla pairs natural language AI with deterministic, zero-error math engines behind the scenes.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                {[
                  'Deterministic statutory calculation engine',
                  'PAYE income tax with allowance caps',
                  'Tiered national insurance (NIS) brackets',
                  'Health surcharge rate schedules',
                ].map((b, i) => (
                  <div key={i} className="flex items-center gap-2.5 text-sm font-bold text-slate-800 bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    <span>{b}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Phone Right */}
            <div className="lg:col-span-6 flex justify-center">
              <IPhoneMockup>
                <div className="bg-white border-b border-slate-100 px-4 py-3 flex items-center justify-between">
                  <div className="font-extrabold text-xs text-slate-900 flex items-center gap-1.5">
                    <CaylaPenMascot size="xs" />
                    <span>Statutory Tax Engine</span>
                  </div>
                  <span className="text-[10px] font-mono text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-200 font-bold">
                    Deterministic
                  </span>
                </div>

                <div className="p-3.5 space-y-3 flex-1 overflow-y-auto bg-white text-xs">
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                    <div className="font-bold text-slate-900 text-xs border-b border-slate-200 pb-1">
                      Statutory Assessment Breakdown
                    </div>

                    <div className="space-y-1.5 font-mono text-[11px]">
                      <div className="flex justify-between">
                        <span className="text-slate-600">Gross Earnings:</span>
                        <span className="font-bold text-slate-900">$14,500.00</span>
                      </div>
                      <div className="flex justify-between text-rose-700">
                        <span>PAYE (BIR Rate 25%):</span>
                        <span>-$1,745.00</span>
                      </div>
                      <div className="flex justify-between text-rose-700">
                        <span>NIS Tier 16 Contribution:</span>
                        <span>-$834.60</span>
                      </div>
                      <div className="flex justify-between text-rose-700">
                        <span>Health Surcharge Act:</span>
                        <span>-$80.00</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-emerald-600 text-white flex justify-between items-center shadow-sm">
                    <div>
                      <div className="text-[9px] uppercase font-bold text-emerald-200">Net Take-Home</div>
                      <div className="text-[10px] text-emerald-100">Disbursed to Employee</div>
                    </div>
                    <div className="text-lg font-black font-mono">$11,840.40</div>
                  </div>
                </div>
              </IPhoneMockup>
            </div>
          </div>
        </div>

        {/* FEATURE 8: Ask Anything */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            
            {/* Phone Left */}
            <div className="lg:col-span-6 flex justify-center order-2 lg:order-1">
              <IPhoneMockup>
                <div className="bg-white px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CaylaPenMascot size="xs" />
                    <span className="font-extrabold text-xs text-slate-900">Ask Cayla Anything</span>
                  </div>
                  <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                    Instant Answers
                  </span>
                </div>

                <div className="p-3.5 space-y-3 flex-1 overflow-y-auto bg-slate-50 text-xs">
                  <div className="bg-emerald-600 text-white p-2.5 rounded-xl rounded-tr-xs text-[11px] self-end ml-8 shadow-2xs">
                    &ldquo;How much PAYE tax do we owe this month?&rdquo;
                  </div>
                  <div className="bg-white p-3 rounded-xl rounded-tl-xs border border-slate-200 text-[11px] text-slate-800 shadow-2xs mr-8 space-y-1">
                    <div className="flex items-center gap-1 text-[9px] font-bold text-emerald-800">
                      <CaylaPenMascot size="xs" />
                      <span>Cayla</span>
                    </div>
                    <p>Total PAYE tax withholding for August is <b>$22,480.00</b> across 24 employees.</p>
                  </div>

                  <div className="bg-emerald-600 text-white p-2.5 rounded-xl rounded-tr-xs text-[11px] self-end ml-8 shadow-2xs">
                    &ldquo;Who had the most overtime?&rdquo;
                  </div>
                  <div className="bg-white p-3 rounded-xl rounded-tl-xs border border-slate-200 text-[11px] text-slate-800 shadow-2xs mr-8 space-y-1">
                    <div className="flex items-center gap-1 text-[9px] font-bold text-emerald-800">
                      <CaylaPenMascot size="xs" />
                      <span>Cayla</span>
                    </div>
                    <p><b>Marcus Joseph</b> logged the highest overtime at 8.0 hours ($656.24).</p>
                  </div>
                </div>
              </IPhoneMockup>
            </div>

            {/* Text Right */}
            <div className="lg:col-span-6 space-y-6 order-1 lg:order-2">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-100 text-emerald-800 text-xs sm:text-sm font-bold">
                <HelpCircle className="w-4 h-4" />
                <span>Conversational Payroll Intelligence</span>
              </div>
              <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black text-slate-950 tracking-tight leading-[1.12]">
                Your payroll answers are <span className="text-emerald-600">one question away</span>.
              </h2>
              <p className="text-slate-600 text-base sm:text-lg leading-relaxed font-medium">
                Query your company&apos;s live payroll history like talking to an in-house CFO. Cayla queries exact statutory records to answer compensation, tax liability, and variance questions in milliseconds.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                {[
                  'Instant statutory tax liability queries',
                  'Overtime & bonus comparisons',
                  'Finds unverified employee records',
                  'Month-over-month trend analysis',
                ].map((b, i) => (
                  <div key={i} className="flex items-center gap-2.5 text-sm font-bold text-slate-800 bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    <span>{b}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* FEATURE 9: Never Forget Payroll — Cayla Reminders */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-24 sm:mt-32">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">

            {/* Text Left */}
            <div className="lg:col-span-6 space-y-6 order-1">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-100 text-emerald-800 text-xs sm:text-sm font-bold">
                <Bell className="w-4 h-4" />
                <span>Cayla Smart Payroll Reminders</span>
              </div>
              <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black text-slate-950 tracking-tight leading-[1.12]">
                Never <span className="text-emerald-600">forget payroll</span>.
              </h2>
              <p className="text-slate-600 text-base sm:text-lg leading-relaxed font-medium">
                Cayla remembers when payroll needs your attention and sends timely reminders for payroll, employee hours, payslips and important deadlines.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                {[
                  '"Remind me every Friday at 3 PM."',
                  '"Remind me 2 days before payroll."',
                  '"Remind me tomorrow to check hours."',
                  '"Remind me when it’s time to send payslips."',
                ].map((b, i) => (
                  <div key={i} className="flex items-center gap-2.5 text-sm font-semibold text-slate-800 bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
                    <CaylaPenMascot size="xs" />
                    <span>{b}</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-slate-500 font-medium pt-1">
                Cayla remembers &rarr; you get reminded &rarr; payroll gets done on time.
              </p>
            </div>

            {/* Phone Right */}
            <div className="lg:col-span-6 flex justify-center order-2">
              <IPhoneMockup activeIslandText="Reminder set">
                <div className="bg-white px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CaylaPenMascot size="xs" />
                    <span className="font-extrabold text-xs text-slate-900">Cayla &middot; Reminders</span>
                  </div>
                  <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                    Active
                  </span>
                </div>

                <div className="p-3.5 space-y-3 flex-1 overflow-y-auto bg-slate-50 text-xs">
                  {/* User message */}
                  <div className="bg-emerald-600 text-white p-2.5 rounded-xl rounded-tr-xs text-[11px] self-end ml-8 shadow-2xs font-semibold">
                    &ldquo;Remind me every Friday at 3 PM to run payroll.&rdquo;
                  </div>

                  {/* Cayla response */}
                  <div className="bg-white p-3 rounded-xl rounded-tl-xs border border-slate-200 text-[11px] text-slate-800 shadow-2xs mr-8 space-y-1">
                    <div className="flex items-center gap-1 text-[9px] font-bold text-emerald-800">
                      <CaylaPenMascot size="xs" />
                      <span>Cayla</span>
                    </div>
                    <p className="font-semibold">Done. I&apos;ll remind you every Friday at 3:00 PM.</p>
                  </div>

                  {/* Reminder card */}
                  <div className="bg-white rounded-2xl border border-emerald-200 p-3 shadow-xs">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-[9px] font-black text-emerald-700 uppercase tracking-wider">Payroll Reminder</div>
                        <div className="mt-1 text-[13px] font-black text-slate-900 flex items-center gap-1.5">
                          <Bell className="w-3 h-3 text-emerald-600" />
                          Every Friday
                        </div>
                        <div className="text-[11px] text-slate-600 font-semibold flex items-center gap-1 mt-0.5">
                          <Clock3 className="w-3 h-3 text-slate-400" />
                          3:00 PM
                        </div>
                        <div className="text-[10px] text-slate-500 mt-1.5">Next reminder: Friday, 3:00 PM</div>
                      </div>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 border border-emerald-200 text-[9px] font-black text-emerald-800 uppercase tracking-wider shrink-0">
                        <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
                        Active
                      </span>
                    </div>
                  </div>

                  {/* Extra suggestion chips */}
                  <div className="pt-1 space-y-1.5">
                    <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Try saying</div>
                    {[
                      'Remind me 2 days before payroll',
                      'Remind me tomorrow to check hours',
                      'Remind me when to send payslips',
                    ].map((s) => (
                      <div key={s} className="text-[10px] text-slate-600 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 font-semibold">
                        {s}
                      </div>
                    ))}
                  </div>
                </div>
              </IPhoneMockup>
            </div>

          </div>
        </div>

      </section>

      {/* ------------------------------------------------------------- */}
      {/* 5. CARIBBEAN BUSINESSES TESTIMONIALS / REVIEWS SECTION */}
      {/* ------------------------------------------------------------- */}
      <CaribbeanReviews />

      {/* ------------------------------------------------------------- */}
      {/* 6. BEFORE / AFTER SECTION (Old Payroll vs Cayla) */}
      {/* ------------------------------------------------------------- */}
      <section id="comparison" className="py-24 sm:py-32 bg-slate-50/80 text-slate-900 border-y border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
            <span className="text-sm font-black uppercase tracking-widest text-emerald-800 bg-emerald-100 px-4 py-1.5 rounded-full border border-emerald-200">
              The Transformation
            </span>
            <h2 className="text-4xl sm:text-6xl lg:text-7xl font-black text-slate-950 tracking-tight leading-tight">
              Old payroll vs <span className="text-emerald-600">Cayla</span>.
            </h2>
            <p className="text-slate-600 text-base sm:text-xl font-medium">
              See why forward-thinking Caribbean and global companies are replacing complex multi-tab software with Cayla.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
            {/* The Old Way */}
            <div className="bg-white p-8 sm:p-10 rounded-3xl border border-slate-200 shadow-xs flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                  <h3 className="text-xl sm:text-2xl font-black text-rose-600 uppercase tracking-wider">The Old Way (10 Tedious Steps)</h3>
                  <X className="w-6 h-6 text-rose-500" />
                </div>

                <ul className="space-y-3 text-sm text-slate-700 font-mono">
                  {[
                    '1. Open 24 separate employee records',
                    '2. Check manual paper timesheets',
                    '3. Enter overtime hours line-by-line',
                    '4. Enter quarterly performance bonuses',
                    '5. Manually calculate statutory deductions',
                    '6. Double check BIR & NIS tax formulas',
                    '7. Click through 8 approval confirmation tabs',
                    '8. Generate payslips one by one',
                    '9. Export CSV reports for bank transfer',
                    '10. Manually email PDF attachments to each employee',
                  ].map((step, idx) => (
                    <li key={idx} className="flex items-center gap-2.5 p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 text-slate-600">
                      <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
                      <span>{step}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-sm font-bold text-center">
                Average Time: 3 to 6 hours every single pay cycle
              </div>
            </div>

            {/* The Cayla Way */}
            <div className="bg-gradient-to-br from-emerald-50/90 via-white to-emerald-50/50 p-8 sm:p-10 rounded-3xl border-2 border-emerald-500 shadow-xl flex flex-col justify-between space-y-6 relative overflow-hidden">
              <div className="absolute -top-10 -right-10 w-48 h-48 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

              <div className="space-y-6 relative z-10">
                <div className="flex items-center justify-between pb-3 border-b border-emerald-200">
                  <div className="flex items-center gap-2.5">
                    <CaylaPenMascot size="sm" />
                    <h3 className="text-xl sm:text-2xl font-black text-emerald-800 uppercase tracking-wider">The Cayla Way</h3>
                  </div>
                  <span className="text-sm font-mono font-black bg-emerald-600 text-white px-3.5 py-1 rounded-full shadow-xs">
                    1 Sentence
                  </span>
                </div>

                {/* Big conversational trigger */}
                <div className="p-6 rounded-2xl bg-white border border-emerald-300 text-slate-900 shadow-sm space-y-2">
                  <div className="text-xs text-emerald-700 font-bold uppercase tracking-wider flex items-center gap-2">
                    <Mic className="w-4 h-4 text-emerald-600" />
                    <span>Your Prompt:</span>
                  </div>
                  <p className="text-2xl sm:text-3xl font-black text-slate-950">
                    &ldquo;Run payroll.&rdquo;
                  </p>
                </div>

                {/* Cayla Autonomous Execution List */}
                <div className="space-y-2.5 pt-2">
                  <div className="text-sm font-bold text-slate-800">Cayla autonomously completes:</div>
                  {[
                    'Audits all employee attendance and timesheets',
                    'Calculates overtime, commissions, and bonuses',
                    'Computes precise statutory taxes (PAYE, NIS, Health Surcharge)',
                    'Generates 24 branded payslips with digital signatures',
                    'Creates complete audit logs and bank remittance advices',
                  ].map((benefit, idx) => (
                    <div key={idx} className="flex items-center gap-2.5 text-sm text-slate-800 font-semibold">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                      <span>{benefit}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-emerald-600 text-white font-black text-center text-base shadow-md">
                Average Time: 5 seconds. Review and approve with confidence.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- */}
      {/* 7. INTERACTIVE LIVE DEMO */}
      {/* ------------------------------------------------------------- */}
      <section id="demo" className="py-24 sm:py-32 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center max-w-3xl mx-auto space-y-4">
            <span className="text-sm font-black uppercase tracking-widest text-emerald-800 bg-emerald-100 px-4 py-1.5 rounded-full border border-emerald-200">
              Try It Live
            </span>
            <h2 className="text-4xl sm:text-6xl lg:text-7xl font-black text-slate-950 tracking-tight leading-tight">
              Try talking to <span className="text-emerald-600">Cayla</span>.
            </h2>
            <p className="text-slate-600 text-base sm:text-xl font-medium">
              Click any suggested command below to simulate Cayla executing payroll in real-time. No sign up required.
            </p>
          </div>

          {/* Suggestion Prompts Bar */}
          <div className="flex flex-wrap items-center justify-center gap-2.5 sm:gap-3.5">
            {demoPrompts.map((d) => (
              <button
                key={d.id}
                onClick={() => setActiveDemoId(d.id)}
                className={`px-5 py-3 rounded-2xl text-sm font-black transition-all cursor-pointer flex items-center gap-2.5 ${
                  activeDemoId === d.id
                    ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/25 ring-2 ring-emerald-400/30'
                    : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                <CaylaPenMascot size="xs" />
                <span>{d.label}</span>
              </button>
            ))}
          </div>

          {/* Interactive Simulation Transcript Box */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden">
            {/* Box Header */}
            <div className="bg-slate-50 border-b border-slate-200 text-slate-900 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CaylaPenMascot size="sm" showStatusDot={true} />
                <div>
                  <div className="font-black text-base text-slate-900 flex items-center gap-2">
                    <span>Cayla Simulation Console</span>
                    <span className="text-xs bg-emerald-100 text-emerald-800 border border-emerald-200 px-2.5 py-0.5 rounded-full font-mono font-bold">
                      ONLINE
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 font-medium">Interactive deterministic sandbox</div>
                </div>
              </div>

              <div className="text-right font-mono text-sm text-emerald-700 font-bold hidden sm:block">
                {activeDemo.actionBadge}
              </div>
            </div>

            {/* Transcript Area */}
            <div className="p-6 sm:p-8 space-y-6 bg-slate-50/60 min-h-[320px] flex flex-col justify-between">
              <div className="space-y-5">
                {/* User Message */}
                <div className="flex justify-end">
                  <div className="bg-emerald-600 text-white p-4 rounded-3xl rounded-tr-xs max-w-lg shadow-sm space-y-1">
                    <div className="text-xs font-bold text-emerald-200 uppercase">You said:</div>
                    <p className="text-base font-semibold">{activeDemo.userQuery}</p>
                  </div>
                </div>

                {/* Cayla Response */}
                <div className="flex gap-3 max-w-xl">
                  <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center shrink-0 mt-1">
                    <CaylaPenMascot size="xs" />
                  </div>
                  <div className="bg-white p-5 rounded-3xl rounded-tl-xs border border-slate-200 shadow-xs space-y-3">
                    <div className="text-sm font-bold text-emerald-800 flex items-center gap-2">
                      <span>Cayla</span>
                      <span className="text-xs text-slate-400 font-normal">• Just now</span>
                    </div>
                    <p className="text-sm sm:text-base text-slate-800 leading-relaxed font-medium">
                      {activeDemo.caylaResponse}
                    </p>

                    {/* Result: reminder card OR payroll stats grid */}
                    {(activeDemo as any).kind === 'reminder' && (activeDemo as any).reminderCard ? (
                      <div className="pt-2 border-t border-slate-100">
                        <div className="bg-white p-4 rounded-2xl border border-emerald-200 shadow-xs">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-[10px] font-black text-emerald-700 uppercase tracking-wider">
                                {(activeDemo as any).reminderCard.title}
                              </div>
                              <div className="mt-1.5 text-sm font-black text-slate-900">
                                {(activeDemo as any).reminderCard.cadence}
                              </div>
                              <div className="text-xs text-slate-600 font-semibold">
                                {(activeDemo as any).reminderCard.time}
                              </div>
                              <div className="text-[11px] text-slate-500 mt-2">
                                Next reminder: {(activeDemo as any).reminderCard.nextRun}
                              </div>
                            </div>
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-100 border border-emerald-200 text-[10px] font-black text-emerald-800 uppercase tracking-wider shrink-0">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              Active
                            </span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 text-center font-mono">
                        <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                          <div className="text-xs text-slate-400 font-sans">Gross</div>
                          <div className="text-sm font-bold text-slate-900">{activeDemo.stats.gross}</div>
                        </div>
                        <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                          <div className="text-xs text-slate-400 font-sans">Deductions</div>
                          <div className="text-sm font-bold text-rose-700">{activeDemo.stats.deductions}</div>
                        </div>
                        <div className="bg-emerald-50 p-2.5 rounded-xl border border-emerald-200">
                          <div className="text-xs text-emerald-800 font-bold font-sans">Net Pay</div>
                          <div className="text-sm font-black text-emerald-700">{activeDemo.stats.net}</div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Bottom Action inside Demo */}
              <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
                <span className="text-sm text-slate-600 font-semibold">
                  Experience this workflow with your real company data:
                </span>
                <button
                  onClick={onLaunchApp}
                  className="px-7 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-black transition-all cursor-pointer flex items-center gap-2 shadow-sm"
                >
                  <span>Open Full Payroll Workspace</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- */}
      {/* 8. PRICING & PLANS SECTION */}
      {/* ------------------------------------------------------------- */}
      <section id="pricing" className="py-24 sm:py-32 bg-slate-50 border-t border-slate-200 relative overflow-hidden">
        {/* Ambient subtle glow */}
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-emerald-300/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-teal-300/15 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 space-y-16">
          {/* Section Header */}
          <div className="text-center max-w-3xl mx-auto space-y-4">
            <span className="text-xs sm:text-sm font-black uppercase tracking-widest text-emerald-800 bg-emerald-100 px-4 py-1.5 rounded-full border border-emerald-200">
              Simple, Transparent Pricing
            </span>
            <h2 className="text-3xl sm:text-5xl lg:text-6xl font-black text-slate-950 tracking-tight leading-tight">
              Try Cayla free on real payroll. <br className="hidden sm:inline" />
              <span className="text-emerald-600">Upgrade when you grow.</span>
            </h2>
            <p className="text-slate-600 text-sm sm:text-lg font-medium leading-relaxed max-w-2xl mx-auto">
              No hidden per-employee fees or surprise add-ons. Start free with automatic statutory calculations, or unlock unlimited payroll volume.
            </p>
          </div>

          {/* Pricing Cards Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">
            {/* CARD 1: FREE — $0/month */}
            <div className="bg-white rounded-3xl border border-slate-200 p-7 sm:p-8 flex flex-col justify-between shadow-sm hover:shadow-md transition-all space-y-6">
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase tracking-wider text-slate-700 bg-slate-100 px-3 py-1 rounded-full">
                    Product Trial
                  </span>
                  <span className="text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                    100% Free
                  </span>
                </div>

                <div>
                  <h3 className="text-2xl font-black text-slate-950">Free</h3>
                  <p className="text-sm text-slate-500 font-medium mt-1">Try Cayla on real payroll.</p>
                  <div className="mt-4 flex items-baseline gap-1">
                    <span className="text-4xl sm:text-5xl font-black text-slate-950">$0</span>
                    <span className="text-sm font-bold text-slate-500">/month</span>
                  </div>
                </div>

                {/* Simple Upgrade Banner inside Free Plan */}
                <div className="p-3 bg-emerald-50/90 border border-emerald-200/90 rounded-2xl flex items-center justify-between gap-2.5 text-xs">
                  <div className="flex items-center gap-1.5 text-slate-800">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span className="font-semibold text-slate-900">Upgrade anytime to Business</span>
                  </div>
                  <span className="text-emerald-700 font-black whitespace-nowrap text-xs">
                    $97/mo &rarr;
                  </span>
                </div>

                {/* Bullet Points */}
                <div className="space-y-3 pt-2 border-t border-slate-100 text-sm">
                  {[
                    '10 payroll runs/month',
                    '10 payslips/month',
                    'Up to 10 employees',
                    'Automatic tax calculations',
                    'Limited Cayla AI',
                    '3 OCR scans/month',
                    '2 payslip templates',
                  ].map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2.5 text-slate-700 font-medium">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2.5 pt-4">
                <button
                  onClick={onStartOnboarding}
                  className="w-full py-3.5 px-4 bg-slate-900 hover:bg-slate-800 text-white font-black text-sm rounded-xl transition-all shadow-sm hover:shadow flex items-center justify-center gap-2 cursor-pointer"
                >
                  <CaylaPenMascot size="xs" />
                  <span>Get Started Free</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
                <p className="text-center text-[11px] text-slate-500 font-semibold">
                  No credit card required • Instant setup
                </p>
              </div>
            </div>

            {/* CARD 2: BUSINESS — $97/mo (Featured) */}
            <div className="bg-gradient-to-b from-emerald-50/70 via-white to-white rounded-3xl border-2 border-emerald-500 p-7 sm:p-8 flex flex-col justify-between shadow-xl relative overflow-hidden space-y-6">
              <div className="absolute top-0 right-0 bg-emerald-600 text-white text-[11px] font-black uppercase tracking-wider px-4 py-1 rounded-bl-2xl shadow-xs">
                Most Popular
              </div>

              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase tracking-wider text-emerald-800 bg-emerald-100 px-3 py-1 rounded-full border border-emerald-200">
                    Single Business
                  </span>
                </div>

                <div>
                  <h3 className="text-2xl font-black text-slate-950">Business</h3>
                  <p className="text-sm text-slate-600 font-medium mt-1">Unlimited payroll, payslips &amp; full Cayla AI.</p>
                  <div className="mt-4 flex items-baseline gap-1">
                    <span className="text-4xl sm:text-5xl font-black text-slate-950">$97</span>
                    <span className="text-sm font-bold text-slate-500">/month</span>
                  </div>
                </div>

                {/* Bullet Points */}
                <div className="space-y-3 pt-2 border-t border-slate-100 text-sm">
                  {[
                    'Unlimited employees',
                    'Unlimited businesses',
                    'Unlimited payroll runs',
                    'Unlimited payslips',
                    'Full Cayla AI assistant',
                    'Cayla Smart Payroll Reminders',
                    '50 OCR scans/month',
                    'Voice commands included',
                    'Tax calculations included',
                    'All 12 payslip templates',
                    'Tax forms (TD4, BIR) included',
                    'Full reports & analytics',
                  ].map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2.5 text-slate-800 font-semibold">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2.5 pt-4">
                <button
                  onClick={() => onChoosePlan ? onChoosePlan('pro') : onStartOnboarding()}
                  className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm rounded-xl transition-all shadow-lg shadow-emerald-600/25 hover:shadow-emerald-600/35 hover:-translate-y-0.5 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <CaylaPenMascot size="xs" />
                  <span>Choose Business Plan</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
                <p className="text-center text-[11px] text-slate-500 font-semibold">
                  Unlimited payroll volume • Cancel anytime
                </p>
              </div>
            </div>

            {/* CARD 3: ACCOUNTANT — $197/mo */}
            <div className="bg-white rounded-3xl border border-slate-200 p-7 sm:p-8 flex flex-col justify-between shadow-sm hover:shadow-md transition-all space-y-6">
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase tracking-wider text-slate-900 bg-slate-100 px-3 py-1 rounded-full border border-slate-200">
                    Practice Command
                  </span>
                  <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded-full">
                    Multi-Client
                  </span>
                </div>

                <div>
                  <h3 className="text-2xl font-black text-slate-950">Accountant</h3>
                  <p className="text-sm text-slate-500 font-medium mt-1">Multi-client command center for accounting firms.</p>
                  <div className="mt-4 flex items-baseline gap-1">
                    <span className="text-4xl sm:text-5xl font-black text-slate-950">$197</span>
                    <span className="text-sm font-bold text-slate-500">/month</span>
                  </div>
                </div>

                {/* Bullet Points */}
                <div className="space-y-3 pt-2 border-t border-slate-100 text-sm">
                  {[
                    'Unlimited clients & businesses',
                    'Unlimited employees',
                    'Unlimited payroll runs & payslips',
                    'Full Cayla AI + Multi-client intelligence',
                    'Cayla Smart Payroll Reminders',
                    '150 OCR scans/month',
                    'Voice commands & tax calculations',
                    'All 12 payslip templates',
                    'Accountant Dashboard included',
                    'Batch multi-tenant payroll runs',
                    'Client approvals & team access',
                    'Multi-client portfolio reports',
                  ].map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2.5 text-slate-700 font-medium">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2.5 pt-4">
                <button
                  onClick={() => onChoosePlan ? onChoosePlan('accountant') : onStartOnboarding()}
                  className="w-full py-3.5 px-4 bg-slate-900 hover:bg-slate-800 text-white font-black text-sm rounded-xl transition-all shadow-sm hover:shadow flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Layers className="w-4 h-4" />
                  <span>Get Accountant Plan</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
                <p className="text-center text-[11px] text-slate-500 font-semibold">
                  Includes practice staff seats &amp; client portal
                </p>
              </div>
            </div>
          </div>

          {/* Natural Conversion Trigger Highlight Callout */}
          <div className="max-w-4xl mx-auto bg-gradient-to-r from-emerald-950 via-slate-900 to-slate-950 text-white rounded-3xl p-6 sm:p-8 border border-emerald-500/30 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-emerald-400">
                <Sparkles className="w-4 h-4" />
                <span>Natural In-Product Upgrade Experience</span>
              </div>
              <span className="text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2.5 py-0.5 rounded-full">
                10-Payslip Trial Cap
              </span>
            </div>

            <div className="bg-slate-800/80 rounded-2xl p-4 sm:p-5 border border-slate-700/80 flex items-start gap-3.5 shadow-inner">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center shrink-0 mt-0.5">
                <CaylaPenMascot size="xs" />
              </div>
              <div className="space-y-1.5 text-sm sm:text-base">
                <div className="font-bold text-emerald-300 text-xs flex items-center gap-2">
                  <span>Cayla</span>
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-200 px-2 py-0.5 rounded-full font-mono">Agent Alert</span>
                </div>
                <p className="text-white font-medium italic leading-relaxed">
                  &ldquo;You&apos;ve used your 10 free payslips this month. Upgrade to Business for unlimited payroll, unlimited payslips and full access to Cayla.&rdquo;
                </p>
              </div>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-slate-300">
              <p className="leading-relaxed">
                <strong className="text-white">Unrestricted statutory tax engine:</strong> All statutory calculations (NIS, PAYE, health surcharge, pensions) remain fully enabled on the Free tier so you can verify complete tax accuracy before upgrading.
              </p>
              <button
                onClick={onStartOnboarding}
                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-lg text-xs transition-colors shrink-0 cursor-pointer"
              >
                Try Free Now &rarr;
              </button>
            </div>
          </div>

          {/* Full Feature Comparison Table */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden p-6 sm:p-8 space-y-6">
            <div className="border-b border-slate-100 pb-4">
              <h3 className="text-xl sm:text-2xl font-black text-slate-950">
                Detailed Feature Comparison
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">
                Everything you need to know about limits, AI capabilities, and practice features across all plans.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-900">
                    <th className="py-3.5 px-4 font-black text-xs uppercase tracking-wider text-slate-500">Feature</th>
                    <th className="py-3.5 px-4 font-black text-center text-slate-900 bg-slate-50 rounded-t-xl min-w-[110px]">Free</th>
                    <th className="py-3.5 px-4 font-black text-center text-emerald-800 bg-emerald-50 rounded-t-xl min-w-[130px]">Business</th>
                    <th className="py-3.5 px-4 font-black text-center text-slate-900 bg-slate-100/80 rounded-t-xl min-w-[140px]">Accountant</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr className="hover:bg-slate-50/60 transition-colors font-bold">
                    <td className="py-3.5 px-4 text-slate-900">Price</td>
                    <td className="py-3.5 px-4 text-center text-slate-900 bg-slate-50/40">$0</td>
                    <td className="py-3.5 px-4 text-center text-emerald-700 bg-emerald-50/30">$97/mo</td>
                    <td className="py-3.5 px-4 text-center text-slate-900 bg-slate-50/40 font-bold">$197/mo</td>
                  </tr>
                  <tr className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4 font-medium text-slate-700">Employees</td>
                    <td className="py-3 px-4 text-center text-slate-700 bg-slate-50/40 font-semibold">Up to 10</td>
                    <td className="py-3 px-4 text-center text-emerald-700 bg-emerald-50/30 font-semibold">Unlimited</td>
                    <td className="py-3 px-4 text-center text-slate-800 bg-slate-50/40 font-semibold">Unlimited</td>
                  </tr>
                  <tr className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4 font-medium text-slate-700">Businesses</td>
                    <td className="py-3 px-4 text-center text-slate-700 bg-slate-50/40 font-semibold">1</td>
                    <td className="py-3 px-4 text-center text-emerald-700 bg-emerald-50/30 font-semibold">Unlimited</td>
                    <td className="py-3 px-4 text-center text-slate-800 bg-slate-50/40 font-semibold">Unlimited</td>
                  </tr>
                  <tr className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4 font-medium text-slate-700">Clients</td>
                    <td className="py-3 px-4 text-center text-slate-400 bg-slate-50/40">&mdash;</td>
                    <td className="py-3 px-4 text-center text-slate-400 bg-emerald-50/30">&mdash;</td>
                    <td className="py-3 px-4 text-center text-emerald-700 bg-slate-50/40 font-bold">Unlimited</td>
                  </tr>
                  <tr className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4 font-medium text-slate-700">Payroll runs</td>
                    <td className="py-3 px-4 text-center text-slate-700 bg-slate-50/40 font-semibold">10/month</td>
                    <td className="py-3 px-4 text-center text-emerald-700 bg-emerald-50/30 font-semibold">Unlimited</td>
                    <td className="py-3 px-4 text-center text-slate-800 bg-slate-50/40 font-semibold">Unlimited</td>
                  </tr>
                  <tr className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4 font-medium text-slate-700">Payslips</td>
                    <td className="py-3 px-4 text-center text-slate-700 bg-slate-50/40 font-semibold">10/month</td>
                    <td className="py-3 px-4 text-center text-emerald-700 bg-emerald-50/30 font-semibold">Unlimited</td>
                    <td className="py-3 px-4 text-center text-slate-800 bg-slate-50/40 font-semibold">Unlimited</td>
                  </tr>
                  <tr className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4 font-medium text-slate-700">Cayla AI</td>
                    <td className="py-3 px-4 text-center text-slate-700 bg-slate-50/40 font-semibold">Limited</td>
                    <td className="py-3 px-4 text-center text-emerald-700 bg-emerald-50/30 font-semibold">Full</td>
                    <td className="py-3 px-4 text-center text-slate-800 bg-slate-50/40 font-semibold">Full + Multi-client</td>
                  </tr>
                  <tr className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4 font-medium text-slate-700">OCR scans</td>
                    <td className="py-3 px-4 text-center text-slate-700 bg-slate-50/40 font-semibold">3/month</td>
                    <td className="py-3 px-4 text-center text-emerald-700 bg-emerald-50/30 font-semibold">50/month</td>
                    <td className="py-3 px-4 text-center text-slate-800 bg-slate-50/40 font-semibold">150/month</td>
                  </tr>
                  <tr className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4 font-medium text-slate-700">Voice commands</td>
                    <td className="py-3 px-4 text-center text-slate-700 bg-slate-50/40 font-semibold">Limited</td>
                    <td className="py-3 px-4 text-center text-emerald-700 bg-emerald-50/30 font-semibold">Included</td>
                    <td className="py-3 px-4 text-center text-slate-800 bg-slate-50/40 font-semibold">Included</td>
                  </tr>
                  <tr className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4 font-medium text-slate-700">Tax calculations</td>
                    <td className="py-3 px-4 text-center text-emerald-700 bg-slate-50/40 font-bold">Included</td>
                    <td className="py-3 px-4 text-center text-emerald-700 bg-emerald-50/30 font-bold">Included</td>
                    <td className="py-3 px-4 text-center text-emerald-700 bg-slate-50/40 font-bold">Included</td>
                  </tr>
                  <tr className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4 font-medium text-slate-700">Payslip templates</td>
                    <td className="py-3 px-4 text-center text-slate-700 bg-slate-50/40 font-semibold">2</td>
                    <td className="py-3 px-4 text-center text-emerald-700 bg-emerald-50/30 font-semibold">All 12</td>
                    <td className="py-3 px-4 text-center text-slate-800 bg-slate-50/40 font-semibold">All 12</td>
                  </tr>
                  <tr className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4 font-medium text-slate-700">Tax forms</td>
                    <td className="py-3 px-4 text-center text-slate-700 bg-slate-50/40 font-semibold">Basic</td>
                    <td className="py-3 px-4 text-center text-emerald-700 bg-emerald-50/30 font-semibold">Included</td>
                    <td className="py-3 px-4 text-center text-slate-800 bg-slate-50/40 font-semibold">Included</td>
                  </tr>
                  <tr className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4 font-medium text-slate-700">Reports</td>
                    <td className="py-3 px-4 text-center text-slate-700 bg-slate-50/40 font-semibold">Basic</td>
                    <td className="py-3 px-4 text-center text-emerald-700 bg-emerald-50/30 font-semibold">Full</td>
                    <td className="py-3 px-4 text-center text-slate-800 bg-slate-50/40 font-semibold">Multi-client</td>
                  </tr>
                  <tr className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4 font-medium text-slate-700">Accountant Dashboard</td>
                    <td className="py-3 px-4 text-center text-slate-400 bg-slate-50/40">&mdash;</td>
                    <td className="py-3 px-4 text-center text-slate-400 bg-emerald-50/30">&mdash;</td>
                    <td className="py-3 px-4 text-center text-emerald-700 bg-slate-50/40 font-bold">Included</td>
                  </tr>
                  <tr className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4 font-medium text-slate-700">Batch payroll</td>
                    <td className="py-3 px-4 text-center text-slate-400 bg-slate-50/40">&mdash;</td>
                    <td className="py-3 px-4 text-center text-slate-400 bg-emerald-50/30">&mdash;</td>
                    <td className="py-3 px-4 text-center text-emerald-700 bg-slate-50/40 font-bold">Included</td>
                  </tr>
                  <tr className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4 font-medium text-slate-700">Client approvals</td>
                    <td className="py-3 px-4 text-center text-slate-400 bg-slate-50/40">&mdash;</td>
                    <td className="py-3 px-4 text-center text-slate-400 bg-emerald-50/30">&mdash;</td>
                    <td className="py-3 px-4 text-center text-emerald-700 bg-slate-50/40 font-bold">Included</td>
                  </tr>
                  <tr className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4 font-medium text-slate-700">Team access</td>
                    <td className="py-3 px-4 text-center text-slate-400 bg-slate-50/40">&mdash;</td>
                    <td className="py-3 px-4 text-center text-slate-400 bg-emerald-50/30">&mdash;</td>
                    <td className="py-3 px-4 text-center text-emerald-700 bg-slate-50/40 font-bold">Included</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </section>

      {/* ------------------------------------------------------------- */}
      {/* 9. DRAMATIC MINIMAL BOTTOM CTA */}
      {/* ------------------------------------------------------------- */}
      <section className="py-24 sm:py-36 bg-gradient-to-b from-slate-50 via-emerald-50/40 to-slate-100 text-slate-900 border-t border-slate-200 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(#10b981_1.2px,transparent_1.2px)] [background-size:32px_32px] opacity-15 pointer-events-none" />
        
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-8 relative z-10">
          <div className="w-20 h-20 rounded-3xl bg-emerald-100 border border-emerald-300 flex items-center justify-center mx-auto shadow-xl shadow-emerald-600/15">
            <CaylaPenMascot size="xl" />
          </div>

          <h2 className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight leading-tight text-slate-950">
            Your next payroll starts with <span className="text-emerald-600">one sentence</span>.
          </h2>

          <p className="text-lg sm:text-xl text-slate-600 font-medium max-w-2xl mx-auto">
            Join hundreds of Caribbean and global businesses who run payroll by simply asking Cayla.
          </p>

          {/* Large Cayla Command Input Simulation */}
          <div className="max-w-2xl mx-auto bg-white p-2.5 rounded-2xl border-2 border-emerald-300 shadow-xl flex items-center gap-3">
            <div className="pl-4">
              <Mic className="w-6 h-6 text-emerald-600 animate-pulse" />
            </div>
            <input
              type="text"
              value={ctaInputValue}
              onChange={(e) => setCtaInputValue(e.target.value)}
              className="flex-1 bg-transparent border-none text-slate-900 text-base sm:text-lg font-semibold focus:outline-none placeholder-slate-400 font-sans"
              placeholder="Ask Cayla anything..."
            />
            <button
              onClick={onStartOnboarding}
              className="px-8 py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm sm:text-base rounded-xl transition-all cursor-pointer shrink-0 shadow-lg shadow-emerald-600/25 flex items-center gap-2"
            >
              <CaylaPenMascot size="xs" />
              <span>Try Cayla Free</span>
            </button>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- */}
      {/* 10. COMPREHENSIVE FOOTER */}
      {/* ------------------------------------------------------------- */}
      <footer className="bg-white border-t border-slate-200 pt-16 pb-12 text-slate-600 text-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
            
            {/* Brand Col */}
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
                Sheetpay brings conversational payroll to modern Caribbean and global businesses. Cayla handles the work—calculating statutory taxes, building interactive registers, and generating compliant payslips.
              </p>
              <div className="text-xs text-slate-400 font-mono">
                &copy; {new Date().getFullYear()} Sheetpay Inc. Powered by Cayla Autonomous Payroll Engine.
              </div>
            </div>

            {/* Product Col */}
            <div className="space-y-3">
              <div className="font-black text-slate-900 uppercase tracking-wider text-xs">Product</div>
              <ul className="space-y-2.5 font-semibold">
                <li><a href="#pricing" className="text-emerald-700 font-bold hover:text-emerald-800 transition-colors">Pricing &amp; Plans</a></li>
                <li><a href="#how-it-works" className="hover:text-emerald-700 transition-colors">How Cayla Works</a></li>
                <li><a href="#features" className="hover:text-emerald-700 transition-colors">Voice Payroll</a></li>
                <li><a href="#caribbean-reviews" className="hover:text-emerald-700 transition-colors">Caribbean Reviews</a></li>
                <li><a href="#templates" className="hover:text-emerald-700 transition-colors">12 Payslip Designs</a></li>
                <li><a href="#demo" className="hover:text-emerald-700 transition-colors">Live Demo</a></li>
              </ul>
            </div>

            {/* Statutory Tax Calculators */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="font-black text-slate-900 uppercase tracking-wider text-xs">Payroll Calculators</div>
                <button
                  onClick={() => onNavigate('/calculators')}
                  className="text-xs font-bold text-emerald-700 hover:text-emerald-800 cursor-pointer"
                >
                  View All &rarr;
                </button>
              </div>
              <ul className="space-y-2.5 font-semibold text-xs sm:text-sm">
                <li>
                  <button
                    onClick={() => onNavigate('/nis-calculator-trinidad')}
                    className="hover:text-emerald-700 cursor-pointer text-left"
                  >
                    Trinidad NIS Calculator
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => onNavigate('/nis-calculator-barbados')}
                    className="hover:text-emerald-700 cursor-pointer text-left"
                  >
                    Barbados NIS Calculator
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => onNavigate('/paye-calculator-st-lucia')}
                    className="hover:text-emerald-700 cursor-pointer text-left"
                  >
                    Saint Lucia PAYE Calculator
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => onNavigate('/income-tax-calculator-belize')}
                    className="hover:text-emerald-700 cursor-pointer text-left"
                  >
                    Belize Income Tax Calculator
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => onNavigate('/calculators')}
                    className="hover:text-emerald-700 cursor-pointer text-left text-emerald-700 font-bold"
                  >
                    Explore 18+ Caribbean Calculators &rarr;
                  </button>
                </li>
              </ul>
            </div>

            {/* Resources & Legal */}
            <div className="space-y-3">
              <div className="font-black text-slate-900 uppercase tracking-wider text-xs">Resources &amp; Trust</div>
              <ul className="space-y-2.5 font-semibold text-xs sm:text-sm">
                <li>
                  <button
                    onClick={() => onNavigate('/refund-policy')}
                    className="hover:text-emerald-700 cursor-pointer text-left flex items-center gap-1.5"
                  >
                    <span>Refund Policy</span>
                    <span className="text-[9px] font-black uppercase bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded-md">14-Day</span>
                  </button>
                </li>
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
                    onClick={() => onNavigate('/security')}
                    className="hover:text-emerald-700 cursor-pointer text-left"
                  >
                    Security &amp; Encryption
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => onNavigate('/compliance')}
                    className="hover:text-emerald-700 cursor-pointer text-left"
                  >
                    Statutory Compliance Guide
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

      {/* Nia support widget — anonymous mode on landing */}
      <NiaWidget variant="landing" currentPage="landing" />
    </div>
  );
};
