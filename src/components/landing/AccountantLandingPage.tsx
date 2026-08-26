import React, { useEffect, useMemo, useState, useRef } from 'react';
import {
  ArrowRight,
  ArrowUp,
  Building2,
  Check,
  CheckCircle2,
  Crown,
  Download,
  FileText,
  Loader2,
  LogIn,
  Mic,
  Paperclip,
  Printer,
  ShieldCheck,
  Sparkles,
  Star,
  Upload,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { CaylaPenMascot } from '../CaylaPenMascot';
import { NiaWidget } from '../nia/NiaWidget';
import {
  recalculateEmployee,
  recalculatePayrollRun,
  formatCurrency,
} from '../../lib/taxEngine';
import type { Employee, PayrollRun } from '../../types';

/* -------------------------------------------------------------------------- */
/*  Props                                                                      */
/* -------------------------------------------------------------------------- */

interface AccountantLandingPageProps {
  onNavigate: (path: string) => void;
  onLaunchApp: () => void;
  onLogin: () => void;
  onStartOnboarding: () => void;
  onChoosePlan: (plan: 'pro' | 'accountant') => void;
}

/* -------------------------------------------------------------------------- */
/*  SEO metadata (unique to /accountants — separate from homepage)             */
/* -------------------------------------------------------------------------- */

const SEO_TITLE = 'AI Payroll Software for Accountants | Sheetpay';
const SEO_DESCRIPTION =
  "Run payroll for every client with Cayla, Sheetpay's AI payroll agent. Calculate taxes, process payroll and create payslips in minutes. Built for Caribbean accountants.";
const CANONICAL_URL = 'https://sheetpay.app/accountants';
const OG_TITLE = 'Sheetpay for Accountants | AI Payroll Agent';
const OG_DESCRIPTION =
  '10 clients. 10 payrolls. One AI agent. Let Cayla prepare payroll while you review and approve.';

function useAccountantSEO() {
  useEffect(() => {
    const originalTitle = document.title;
    document.title = SEO_TITLE;

    const setMeta = (name: string, content: string, isProperty = false) => {
      const attr = isProperty ? 'property' : 'name';
      let el = document.querySelector(`meta[${attr}="${name}"]`) as HTMLMetaElement | null;
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attr, name);
        document.head.appendChild(el);
      }
      el.setAttribute('content', content);
    };

    setMeta('description', SEO_DESCRIPTION);
    setMeta('robots', 'index, follow');
    setMeta('og:title', OG_TITLE, true);
    setMeta('og:description', OG_DESCRIPTION, true);
    setMeta('og:type', 'website', true);
    setMeta('og:url', CANONICAL_URL, true);
    setMeta('og:site_name', 'Sheetpay', true);
    setMeta('twitter:card', 'summary_large_image');
    setMeta('twitter:title', OG_TITLE);
    setMeta('twitter:description', OG_DESCRIPTION);

    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.setAttribute('rel', 'canonical');
      document.head.appendChild(canonical);
    }
    canonical.setAttribute('href', CANONICAL_URL);

    // JSON-LD: SoftwareApplication with real Accountant plan offers
    const scriptId = 'sheetpay-accountants-jsonld';
    let script = document.getElementById(scriptId) as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement('script');
      script.id = scriptId;
      script.type = 'application/ld+json';
      document.head.appendChild(script);
    }
    script.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'Sheetpay',
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web',
      description: SEO_DESCRIPTION,
      brand: { '@type': 'Brand', name: 'Sheetpay' },
      offers: [
        {
          '@type': 'Offer',
          name: 'Accountant Monthly',
          price: '197',
          priceCurrency: 'USD',
          url: CANONICAL_URL,
          category: 'subscription',
        },
        {
          '@type': 'Offer',
          name: 'Accountant Yearly',
          price: '1970',
          priceCurrency: 'USD',
          url: CANONICAL_URL,
          category: 'subscription',
        },
      ],
    });

    return () => {
      document.title = originalTitle;
    };
  }, []);
}

/* -------------------------------------------------------------------------- */
/*  Analytics helper (funnel events — reuses window.gtag if configured)        */
/* -------------------------------------------------------------------------- */

type FunnelEvent =
  | 'accountant_landing_view'
  | 'cayla_started'
  | 'employee_import_started'
  | 'employee_import_completed'
  | 'ocr_started'
  | 'ocr_completed'
  | 'manual_employee_added'
  | 'payroll_started'
  | 'payroll_completed'
  | 'payroll_reviewed'
  | 'payslips_generated'
  | 'payslip_previewed'
  | 'download_clicked'
  | 'print_clicked'
  | 'whatsapp_clicked'
  | 'paywall_viewed'
  | 'monthly_selected'
  | 'yearly_selected'
  | 'checkout_started';

function track(event: FunnelEvent, params?: Record<string, unknown>) {
  try {
    const w = window as any;
    if (typeof w.gtag === 'function') {
      w.gtag('event', event, { event_category: 'accountant_funnel', ...(params || {}) });
    }
    if (typeof w.fbq === 'function') {
      w.fbq('trackCustom', event, params || {});
    }
  } catch {
    /* analytics is best-effort */
  }
}

/* -------------------------------------------------------------------------- */
/*  UTM + attribution capture                                                  */
/* -------------------------------------------------------------------------- */

interface Attribution {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  landing_page: string;
  referrer: string;
  landed_at: string;
}

function captureAttribution(): Attribution {
  const url = new URL(window.location.href);
  const attribution: Attribution = {
    utm_source: url.searchParams.get('utm_source') ?? undefined,
    utm_medium: url.searchParams.get('utm_medium') ?? undefined,
    utm_campaign: url.searchParams.get('utm_campaign') ?? undefined,
    utm_content: url.searchParams.get('utm_content') ?? undefined,
    utm_term: url.searchParams.get('utm_term') ?? undefined,
    landing_page: '/accountants',
    referrer: document.referrer || '',
    landed_at: new Date().toISOString(),
  };
  try {
    // Preserve across pages until server records it after signup/paddle.
    // Session-only, no sensitive data.
    const existing = sessionStorage.getItem('sheetpay_attribution');
    if (!existing) {
      sessionStorage.setItem('sheetpay_attribution', JSON.stringify(attribution));
    }
  } catch {
    /* storage may be blocked (private mode) — attribution is best-effort */
  }
  return attribution;
}

/* -------------------------------------------------------------------------- */
/*  Opaque guest-session id                                                    */
/*                                                                             */
/*  Client storage holds ONLY this identifier so the eventual server-side      */
/*  guest→permanent conversion can attach the completed payroll after the      */
/*  visitor pays. Sensitive payroll data itself lives in component state, not  */
/*  localStorage.                                                              */
/* -------------------------------------------------------------------------- */

function useGuestSessionId(): string {
  return useMemo(() => {
    try {
      const key = 'sheetpay_guest_session_id';
      let id = sessionStorage.getItem(key);
      if (!id) {
        id = 'gs_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
        sessionStorage.setItem(key, id);
      }
      return id;
    } catch {
      return 'gs_local';
    }
  }, []);
}

/* -------------------------------------------------------------------------- */
/*  Demo dataset — a plausible Caribbean accountant client                     */
/*                                                                             */
/*  These are seed employees. All monetary values below (PAYE, NIS, Health,    */
/*  Net) come from the REAL Sheetpay tax engine via recalculateEmployee /      */
/*  recalculatePayrollRun — Cayla does not invent numbers.                     */
/* -------------------------------------------------------------------------- */

const DEMO_CLIENT_NAME = 'Palm Court Consultancy Ltd';

function buildDemoEmployees(): Employee[] {
  const seed: Array<Pick<
    Employee,
    | 'id'
    | 'name'
    | 'employeeId'
    | 'position'
    | 'department'
    | 'avatar'
    | 'email'
    | 'phone'
    | 'basicPay'
    | 'overtimeHours'
    | 'overtimeRate'
    | 'bonus'
    | 'commission'
    | 'allowances'
    | 'otherDeductions'
    | 'status'
  >> = [
    {
      id: 'demo-1', name: 'Anisa Mohammed', employeeId: 'PCC-001',
      position: 'Managing Partner', department: 'Executive', avatar: '',
      email: 'anisa@palmcourt.tt', phone: '',
      basicPay: 22000, overtimeHours: 0, overtimeRate: 0, bonus: 0, commission: 0, allowances: 2500, otherDeductions: 0, status: 'approved',
    },
    {
      id: 'demo-2', name: 'Ravi Persaud', employeeId: 'PCC-002',
      position: 'Senior Accountant', department: 'Practice', avatar: '',
      email: 'ravi@palmcourt.tt', phone: '',
      basicPay: 14500, overtimeHours: 6, overtimeRate: 90, bonus: 0, commission: 0, allowances: 1200, otherDeductions: 0, status: 'approved',
    },
    {
      id: 'demo-3', name: 'Keisha Alleyne', employeeId: 'PCC-003',
      position: 'Payroll Specialist', department: 'Practice', avatar: '',
      email: 'keisha@palmcourt.tt', phone: '',
      basicPay: 9800, overtimeHours: 4, overtimeRate: 65, bonus: 500, commission: 0, allowances: 800, otherDeductions: 0, status: 'approved',
    },
    {
      id: 'demo-4', name: 'Marlon De Silva', employeeId: 'PCC-004',
      position: 'Junior Accountant', department: 'Practice', avatar: '',
      email: 'marlon@palmcourt.tt', phone: '',
      basicPay: 7200, overtimeHours: 8, overtimeRate: 55, bonus: 0, commission: 0, allowances: 600, otherDeductions: 200, status: 'approved',
    },
    {
      id: 'demo-5', name: 'Simone Charles', employeeId: 'PCC-005',
      position: 'Office Administrator', department: 'Operations', avatar: '',
      email: 'simone@palmcourt.tt', phone: '',
      basicPay: 5600, overtimeHours: 0, overtimeRate: 0, bonus: 0, commission: 0, allowances: 400, otherDeductions: 0, status: 'approved',
    },
    {
      id: 'demo-6', name: 'Terrence Lewis', employeeId: 'PCC-006',
      position: 'Client Services Lead', department: 'Practice', avatar: '',
      email: 'terrence@palmcourt.tt', phone: '',
      basicPay: 11200, overtimeHours: 3, overtimeRate: 75, bonus: 0, commission: 400, allowances: 900, otherDeductions: 0, status: 'approved',
    },
  ];

  return seed.map((emp) => recalculateEmployee({
    ...emp,
    grossPay: 0, paye: 0, nis: 0, healthSurcharge: 0, netPay: 0,
  } as Employee));
}

function buildDemoPayrollRun(employees: Employee[]): PayrollRun {
  return recalculatePayrollRun({
    id: 'demo-accountant-run',
    periodLabel: 'August 2026 Payroll',
    month: 'August',
    year: 2026,
    payDate: 'August 28, 2026',
    periodStart: 'August 1, 2026',
    periodEnd: 'August 31, 2026',
    currency: 'TTD',
    currencySymbol: 'TT$',
    status: 'under_review',
    employeesCount: employees.length,
    grossPay: 0,
    totalTax: 0,
    totalNis: 0,
    totalHealthSurcharge: 0,
    totalDeductions: 0,
    netPay: 0,
    payeTotal: 0,
    nisTotal: 0,
    hsTotal: 0,
    otherDeductionsTotal: 0,
    employees,
    createdAt: new Date().toISOString(),
  });
}

/* -------------------------------------------------------------------------- */
/*  Progressive workflow stages                                                */
/* -------------------------------------------------------------------------- */

type Stage =
  | 'awaiting_source'    // Cayla asks how to add employees
  | 'importing'          // Import/OCR/manual in progress
  | 'confirming'         // Confirm 2 uncertain fields
  | 'processing'         // Payroll calculating
  | 'ready_for_review'   // Totals visible, "Review payroll"
  | 'reviewed'           // User approved, payslips generating
  | 'payslips_ready';    // Preview payslips, Download/Print/WhatsApp

interface CaylaBubble {
  id: string;
  sender: 'cayla' | 'user';
  text: React.ReactNode;
  ts: string;
}

const now = () =>
  new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

/* -------------------------------------------------------------------------- */
/*  Component                                                                  */
/* -------------------------------------------------------------------------- */

export const AccountantLandingPage: React.FC<AccountantLandingPageProps> = ({
  onNavigate,
  onLaunchApp,
  onLogin,
  onStartOnboarding,
  onChoosePlan,
}) => {
  useAccountantSEO();
  const guestSessionId = useGuestSessionId();

  const [stage, setStage] = useState<Stage>('awaiting_source');
  const [messages, setMessages] = useState<CaylaBubble[]>([
    {
      id: 'cayla-1',
      sender: 'cayla',
      ts: now(),
      text: (
        <>
          Hi, I&rsquo;m Cayla. Let&rsquo;s run payroll for one of your clients.{' '}
          <span className="font-semibold">How would you like to add their employees?</span>
        </>
      ),
    },
  ]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [payroll, setPayroll] = useState<PayrollRun | null>(null);
  const [paywall, setPaywall] = useState<null | {
    action: 'download' | 'print' | 'whatsapp';
    plan: 'monthly' | 'yearly';
  }>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Capture attribution + landing view exactly once on mount.
  useEffect(() => {
    captureAttribution();
    track('accountant_landing_view');
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, stage]);

  const appendCayla = (text: React.ReactNode) => {
    setMessages((prev) => [
      ...prev,
      { id: `c-${Date.now()}-${Math.random()}`, sender: 'cayla', ts: now(), text },
    ]);
  };
  const appendUser = (text: React.ReactNode) => {
    setMessages((prev) => [
      ...prev,
      { id: `u-${Date.now()}-${Math.random()}`, sender: 'user', ts: now(), text },
    ]);
  };

  /* ------------------------------ workflow -------------------------------- */

  const startImport = (source: 'upload' | 'ocr' | 'manual') => {
    track('cayla_started', { source });
    if (source === 'upload') track('employee_import_started');
    if (source === 'ocr') track('ocr_started');
    if (source === 'manual') track('manual_employee_added');

    const labels: Record<typeof source, string> = {
      upload: 'Upload existing payroll (CSV/Excel)',
      ocr: 'Scan payslips with OCR',
      manual: 'Add employees manually',
    };
    appendUser(labels[source]);
    setStage('importing');

    // Simulate the extract step. The real product flow lives in
    // OnboardingFlow → PayrollImportStep — we mirror its result surface here.
    window.setTimeout(() => {
      const demoEmployees = buildDemoEmployees();
      setEmployees(demoEmployees);
      if (source === 'ocr') track('ocr_completed');
      if (source === 'upload') track('employee_import_completed');
      appendCayla(
        <>
          I found <span className="font-semibold">{demoEmployees.length} employees</span> for{' '}
          <span className="font-semibold">{DEMO_CLIENT_NAME}</span>. I need you to confirm{' '}
          <span className="font-semibold">2 fields</span> that were ambiguous before I run payroll.
        </>
      );
      setStage('confirming');
    }, 900);
  };

  const confirmFields = () => {
    appendUser('Confirmed — details look correct.');
    setStage('processing');
    track('payroll_started');
    appendCayla(
      <>Great — running payroll now with Trinidad &amp; Tobago statutory rules (PAYE, NIS, Health Surcharge)&hellip;</>
    );
    window.setTimeout(() => {
      const run = buildDemoPayrollRun(employees);
      setPayroll(run);
      track('payroll_completed', {
        gross: run.grossPay,
        net: run.netPay,
      });
      appendCayla(
        <div className="space-y-1">
          <div className="font-black text-slate-900">Payroll ready.</div>
          <div>{run.employeesCount} employees processed.</div>
          <div>
            Gross Payroll:{' '}
            <span className="font-semibold">{formatCurrency(run.grossPay, 'TT$')}</span>
          </div>
          <div>
            Statutory Deductions:{' '}
            <span className="font-semibold">{formatCurrency(run.totalDeductions, 'TT$')}</span>
          </div>
          <div>
            Net Payroll:{' '}
            <span className="font-semibold text-emerald-700">{formatCurrency(run.netPay, 'TT$')}</span>
          </div>
          <div className="text-slate-600 mt-1">
            <span className="font-semibold">1 item</span> needs your attention.
          </div>
        </div>
      );
      setStage('ready_for_review');
    }, 1100);
  };

  const reviewPayroll = () => {
    appendUser('Review payroll');
    track('payroll_reviewed');
    setStage('reviewed');
    appendCayla('Everything looks good. Generating payslips now…');
    window.setTimeout(() => {
      if (payroll) {
        track('payslips_generated', { count: payroll.employeesCount });
        appendCayla(
          <>
            <span className="font-semibold">{payroll.employeesCount} payslips ready.</span> Preview them below.
          </>
        );
      }
      setStage('payslips_ready');
    }, 800);
  };

  const triggerPaywall = (action: 'download' | 'print' | 'whatsapp') => {
    track(
      action === 'download' ? 'download_clicked'
        : action === 'print' ? 'print_clicked'
        : 'whatsapp_clicked'
    );
    // Persist the ATTEMPTED action so we can resume it after checkout.
    try {
      sessionStorage.setItem(
        'sheetpay_pending_action',
        JSON.stringify({ action, guestSessionId, at: new Date().toISOString() })
      );
    } catch { /* best-effort */ }
    setPaywall({ action, plan: 'yearly' });
    track('paywall_viewed', { action });
  };

  /* ------------------------------ render ---------------------------------- */

  return (
    <div className="min-h-screen bg-white text-slate-900 antialiased selection:bg-emerald-500/20">
      {/* ------------------ FOCUSED HEADER ------------------ */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <button
            onClick={() => onNavigate('/')}
            className="flex items-center gap-2.5 cursor-pointer"
            aria-label="Sheetpay home"
          >
            <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center">
              <CaylaPenMascot size="sm" />
            </div>
            <div className="text-left leading-tight">
              <div className="font-black text-slate-950 text-lg tracking-tight">Sheetpay</div>
              <div className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">
                For Accountants
              </div>
            </div>
          </button>
          <div className="flex items-center gap-2.5">
            <button
              onClick={onLogin}
              className="hidden sm:inline-flex items-center gap-1.5 text-sm font-bold text-slate-700 hover:text-slate-950 px-3 py-2 rounded-lg cursor-pointer"
            >
              <LogIn className="w-4 h-4" />
              <span>Sign In</span>
            </button>
            <a
              href="#try-cayla"
              className="inline-flex items-center gap-1.5 px-3.5 sm:px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-black rounded-xl shadow-sm shadow-emerald-600/30 transition-all"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Try Cayla</span>
            </a>
          </div>
        </div>
      </header>

      {/* ------------------ HERO + CAYLA (single fold) ------------------ */}
      <section className="relative overflow-hidden bg-gradient-to-b from-emerald-50/60 via-white to-white">
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-emerald-300/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-teal-300/15 rounded-full blur-3xl pointer-events-none" />

        <div id="try-cayla" className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 relative z-10">
          {/* Single-column, centered hero */}
          <div className="text-center space-y-6 sm:space-y-7 max-w-3xl mx-auto">
            {/* User Rating Badge — same as main landing page hero */}
            <div className="inline-flex items-center justify-center gap-2.5 sm:gap-3 px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-full bg-white/95 border border-slate-200/90 shadow-sm hover:shadow-md transition-all">
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

              {/* Text */}
              <span className="text-xs sm:text-sm font-bold text-slate-800 tracking-tight whitespace-nowrap">
                Accountants Love Cayla ❤️
              </span>
            </div>

            <span className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-emerald-800 bg-emerald-100 border border-emerald-200 px-3 py-1 rounded-full">
              <Sparkles className="w-3 h-3" />
              AI Payroll Agent for Caribbean Accountants
            </span>
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-[4.2rem] font-black text-slate-950 tracking-tight leading-[1.05]">
              Stop Doing Payroll.{' '}
              <span className="text-emerald-600">Start Approving It.</span>
            </h1>
            <p className="text-slate-600 text-base sm:text-lg lg:text-xl font-medium leading-relaxed max-w-2xl mx-auto">
              Cayla prepares payroll, calculates statutory deductions and creates payslips for
              your clients. <span className="font-semibold text-slate-800">You review and approve.</span>
            </p>
            <div className="flex flex-wrap justify-center gap-2 text-xs font-semibold text-slate-600 pt-1">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-slate-200">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                Deterministic TT / BB / LC / BZ tax engine
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-slate-200">
                <Users className="w-3.5 h-3.5 text-emerald-600" />
                Unlimited clients &amp; employees
              </span>
            </div>
            <p className="text-[11px] font-semibold text-slate-500">
              Try Cayla on a real payroll first &mdash; no signup required.
            </p>
          </div>

          {/* Cayla transcript panel — full width beneath hero */}
          <div className="mt-10 sm:mt-12">
            <div className="rounded-3xl bg-white border border-slate-200 shadow-2xl shadow-emerald-950/5 overflow-hidden flex flex-col max-h-[640px]">
                <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-emerald-50/70 to-white">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-emerald-100 border border-emerald-200 flex items-center justify-center">
                      <CaylaPenMascot size="xs" />
                    </div>
                    <div className="leading-tight">
                      <div className="text-sm font-black text-slate-900">Cayla</div>
                      <div className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">
                        AI Payroll Agent
                      </div>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full uppercase tracking-wider">
                    Live Demo
                  </span>
                </div>

                {/* Transcript */}
                <div className="flex-1 overflow-y-auto px-4 sm:px-5 py-4 space-y-3 bg-slate-50/40">
                  {messages.map((m) => (
                    <TranscriptBubble key={m.id} bubble={m} />
                  ))}
                  {stage === 'importing' && <ProcessingBubble label="Extracting employees…" />}
                  {stage === 'processing' && <ProcessingBubble label="Running statutory calculations…" />}
                  {stage === 'reviewed' && <ProcessingBubble label="Generating payslips…" />}
                  <div ref={messagesEndRef} />
                </div>

                {/* Action Panel */}
                <div className="border-t border-slate-100 bg-white p-4 sm:p-5">
                  {stage === 'awaiting_source' && (
                    <div className="space-y-2.5">
                      <div className="text-[11px] font-black uppercase tracking-wider text-slate-500">
                        Pick a starting point
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <SourceButton
                          icon={<Upload className="w-4 h-4" />}
                          label="Upload Payroll"
                          hint="CSV / Excel"
                          onClick={() => startImport('upload')}
                        />
                        <SourceButton
                          icon={<Paperclip className="w-4 h-4" />}
                          label="Scan With OCR"
                          hint="Previous payslips"
                          onClick={() => startImport('ocr')}
                        />
                        <SourceButton
                          icon={<UserPlus className="w-4 h-4" />}
                          label="Add Manually"
                          hint="Type each employee"
                          onClick={() => startImport('manual')}
                        />
                      </div>
                      <div className="pt-2 flex items-center gap-2 text-[11px] font-semibold text-slate-500">
                        <Mic className="w-3.5 h-3.5" />
                        <span>Voice input available inside Sheetpay after signup.</span>
                      </div>
                    </div>
                  )}

                  {stage === 'confirming' && (
                    <div className="space-y-3">
                      <div className="text-[11px] font-black uppercase tracking-wider text-amber-700">
                        Confirm 2 fields
                      </div>
                      <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-xs text-slate-700 space-y-1.5">
                        <div>
                          <span className="font-bold">Ravi Persaud</span> &mdash; overtime rate detected as{' '}
                          <span className="font-semibold">TT$90/hr</span>. Correct?
                        </div>
                        <div>
                          <span className="font-bold">Marlon De Silva</span> &mdash; deduction column mapped to{' '}
                          <span className="font-semibold">Other Deductions</span>. Correct?
                        </div>
                      </div>
                      <button
                        onClick={confirmFields}
                        className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-black cursor-pointer"
                      >
                        <Check className="w-4 h-4" />
                        Confirm &amp; run payroll
                      </button>
                    </div>
                  )}

                  {stage === 'ready_for_review' && payroll && (
                    <button
                      onClick={reviewPayroll}
                      className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-black shadow-md shadow-emerald-600/20 cursor-pointer"
                    >
                      <FileText className="w-4 h-4" />
                      Review payroll
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  )}

                  {stage === 'payslips_ready' && (
                    <div className="text-[11px] font-semibold text-slate-500 text-center py-1">
                      Scroll down to preview payslips.
                    </div>
                  )}
                </div>
              </div>

              <p className="text-[11px] text-slate-500 font-medium text-center mt-3">
                Guest session <span className="font-mono">{guestSessionId.slice(0, 12)}&hellip;</span> &middot;
                nothing is billed until you unlock your payslips.
              </p>
            </div>
        </div>
      </section>

      {/* ------------------ PAYROLL SUMMARY (progressive) ------------------ */}
      {payroll && (
        <section className="py-14 sm:py-20 bg-slate-50/70 border-t border-slate-200">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
            <div className="flex items-start justify-between flex-wrap gap-4">
              <div>
                <span className="text-[11px] font-black uppercase tracking-widest text-emerald-800 bg-emerald-100 px-3 py-1 rounded-full border border-emerald-200">
                  Client &middot; {DEMO_CLIENT_NAME}
                </span>
                <h2 className="text-2xl sm:text-3xl font-black text-slate-950 mt-3 tracking-tight">
                  {payroll.periodLabel}
                </h2>
                <p className="text-sm text-slate-500 font-medium">
                  {payroll.periodStart} &ndash; {payroll.periodEnd} &middot; Pay date {payroll.payDate}
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs font-bold">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Cayla completed the calculations
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <SummaryTile label="Employees" value={String(payroll.employeesCount)} />
              <SummaryTile label="Gross Payroll" value={formatCurrency(payroll.grossPay, 'TT$')} />
              <SummaryTile label="Statutory Deductions" value={formatCurrency(payroll.totalDeductions, 'TT$')} />
              <SummaryTile
                label="Net Payroll"
                value={formatCurrency(payroll.netPay, 'TT$')}
                accent
              />
            </div>

            {/* Payslip preview strip */}
            {stage === 'payslips_ready' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[11px] font-black uppercase tracking-widest text-slate-500">Payslips</div>
                    <div className="text-lg font-black text-slate-900">
                      {payroll.employeesCount} payslips ready
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {payroll.employees.slice(0, 6).map((emp) => (
                    <PayslipMiniPreview
                      key={emp.id}
                      employee={emp}
                      payroll={payroll}
                      onPreview={() => {
                        track('payslip_previewed', { employee: emp.employeeId });
                      }}
                    />
                  ))}
                </div>

                {/* Action bar: Download / Print / WhatsApp (paywall trigger) */}
                <div className="rounded-3xl border border-emerald-500/40 bg-gradient-to-r from-emerald-50/80 via-white to-white p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
                  <div>
                    <div className="text-sm font-black text-slate-950 flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-emerald-600" />
                      Take your payroll with you.
                    </div>
                    <div className="text-xs text-slate-600 font-medium mt-0.5">
                      Download all {payroll.employeesCount} payslips as PDF, print, or share via WhatsApp.
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                    <ActionButton
                      icon={<Download className="w-4 h-4" />}
                      label="Download"
                      onClick={() => triggerPaywall('download')}
                    />
                    <ActionButton
                      icon={<Printer className="w-4 h-4" />}
                      label="Print"
                      onClick={() => triggerPaywall('print')}
                    />
                    <ActionButton
                      icon={<Share className="w-4 h-4" />}
                      label="WhatsApp"
                      onClick={() => triggerPaywall('whatsapp')}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ------------------ PAYWALL MODAL ------------------ */}
      {paywall && (
        <PaywallModal
          action={paywall.action}
          selectedPlan={paywall.plan}
          onSelectPlan={(p) => {
            setPaywall((prev) => (prev ? { ...prev, plan: p } : prev));
            track(p === 'monthly' ? 'monthly_selected' : 'yearly_selected');
          }}
          onClose={() => setPaywall(null)}
          onLogin={onLogin}
          onCheckout={() => {
            track('checkout_started', { plan: paywall.plan, action: paywall.action });
            // Reuse the existing App-level Paddle checkout for the Accountant plan.
            // Yearly/monthly variants share the accountant entitlement — the plan
            // toggle is presentational until Paddle exposes a separate yearly
            // priceId; hook that into PADDLE_PRICE_IDS.accountant_yearly when live.
            onChoosePlan('accountant');
          }}
        />
      )}

      {/* ------------------ FOOTER (reuses the site footer surface) ------------------ */}
      <SharedFooter onNavigate={onNavigate} onLaunchApp={onLaunchApp} onStartOnboarding={onStartOnboarding} />

      {/* ------------------ BIG BOLD SHEETPAY BRANDING ------------------ */}
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
          <p className="text-sm sm:text-base font-semibold text-slate-500 max-w-xl">
            AI payroll for Caribbean accountants and their clients.
          </p>
        </div>
      </section>

      {/* Nia support widget */}
      <NiaWidget variant="landing" currentPage="accountants" />
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/*  Sub-components                                                             */
/* -------------------------------------------------------------------------- */

const TranscriptBubble: React.FC<{ bubble: CaylaBubble }> = ({ bubble }) => {
  const isCayla = bubble.sender === 'cayla';
  return (
    <div className={`flex ${isCayla ? 'justify-start' : 'justify-end'} gap-2`}>
      {isCayla && (
        <div className="w-7 h-7 rounded-xl bg-emerald-100 border border-emerald-200 flex items-center justify-center shrink-0 mt-0.5">
          <CaylaPenMascot size="xs" />
        </div>
      )}
      <div
        className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-snug ${
          isCayla
            ? 'bg-white border border-slate-200 text-slate-800 shadow-xs'
            : 'bg-emerald-600 text-white font-semibold'
        }`}
      >
        <div>{bubble.text}</div>
        <div className={`text-[9px] mt-1 font-semibold ${isCayla ? 'text-slate-400' : 'text-emerald-100/90'}`}>
          {bubble.ts}
        </div>
      </div>
    </div>
  );
};

const ProcessingBubble: React.FC<{ label: string }> = ({ label }) => (
  <div className="flex justify-start gap-2">
    <div className="w-7 h-7 rounded-xl bg-emerald-100 border border-emerald-200 flex items-center justify-center shrink-0 mt-0.5">
      <CaylaPenMascot size="xs" />
    </div>
    <div className="max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm bg-white border border-slate-200 text-slate-700 shadow-xs flex items-center gap-2">
      <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />
      <span>{label}</span>
    </div>
  </div>
);

const SourceButton: React.FC<{
  icon: React.ReactNode;
  label: string;
  hint: string;
  onClick: () => void;
}> = ({ icon, label, hint, onClick }) => (
  <button
    onClick={onClick}
    className="w-full text-left rounded-xl border border-slate-200 hover:border-emerald-400 bg-white hover:bg-emerald-50/60 p-3 transition-all cursor-pointer group"
  >
    <div className="flex items-center gap-2 text-emerald-700 font-black text-xs">
      {icon}
      <span>{label}</span>
    </div>
    <div className="text-[11px] text-slate-500 font-medium mt-0.5">{hint}</div>
  </button>
);

const SummaryTile: React.FC<{
  label: string;
  value: string;
  accent?: boolean;
}> = ({ label, value, accent }) => (
  <div
    className={`rounded-2xl p-4 border ${
      accent
        ? 'bg-emerald-600 border-emerald-500 text-white shadow-md shadow-emerald-600/20'
        : 'bg-white border-slate-200'
    }`}
  >
    <div
      className={`text-[10px] font-black uppercase tracking-wider ${
        accent ? 'text-emerald-100/90' : 'text-slate-500'
      }`}
    >
      {label}
    </div>
    <div
      className={`text-xl sm:text-2xl font-black tracking-tight mt-1 ${
        accent ? 'text-white' : 'text-slate-950'
      }`}
    >
      {value}
    </div>
  </div>
);

const PayslipMiniPreview: React.FC<{
  employee: Employee;
  payroll: PayrollRun;
  onPreview: () => void;
}> = ({ employee, payroll, onPreview }) => (
  <button
    onClick={onPreview}
    className="text-left rounded-2xl border border-slate-200 bg-white hover:border-emerald-400 hover:shadow-md transition-all p-4 space-y-3 cursor-pointer group"
  >
    <div className="flex items-center justify-between">
      <div>
        <div className="text-sm font-black text-slate-900">{employee.name}</div>
        <div className="text-[11px] font-semibold text-slate-500">
          {employee.employeeId} &middot; {employee.position}
        </div>
      </div>
      <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center">
        <FileText className="w-4 h-4 text-emerald-700" />
      </div>
    </div>
    <div className="border-t border-slate-100 pt-3 grid grid-cols-3 gap-2 text-[11px]">
      <MiniStat label="Gross" value={formatCurrency(employee.grossPay, 'TT$')} />
      <MiniStat label="Deductions" value={formatCurrency(employee.paye + employee.nis + employee.healthSurcharge + employee.otherDeductions, 'TT$')} />
      <MiniStat label="Net" value={formatCurrency(employee.netPay, 'TT$')} strong />
    </div>
    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
      {payroll.periodLabel}
    </div>
  </button>
);

const MiniStat: React.FC<{ label: string; value: string; strong?: boolean }> = ({
  label,
  value,
  strong,
}) => (
  <div>
    <div className="text-[9px] font-black uppercase tracking-wider text-slate-400">{label}</div>
    <div className={`font-black ${strong ? 'text-emerald-700' : 'text-slate-800'} truncate`}>
      {value}
    </div>
  </div>
);

const ActionButton: React.FC<{
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}> = ({ icon, label, onClick }) => (
  <button
    onClick={onClick}
    className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-black rounded-xl shadow-sm cursor-pointer"
  >
    {icon}
    <span>{label}</span>
  </button>
);

// Local Share icon — lucide's Share/Share2 handle mobile fine
const Share: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7" />
    <path d="M16 6l-4-4-4 4" />
    <path d="M12 2v13" />
  </svg>
);

/* -------------------------------------------------------------------------- */
/*  Paywall Modal                                                              */
/* -------------------------------------------------------------------------- */

const PaywallModal: React.FC<{
  action: 'download' | 'print' | 'whatsapp';
  selectedPlan: 'monthly' | 'yearly';
  onSelectPlan: (p: 'monthly' | 'yearly') => void;
  onClose: () => void;
  onLogin: () => void;
  onCheckout: () => void;
}> = ({ action, selectedPlan, onSelectPlan, onClose, onLogin, onCheckout }) => {
  const actionLabel = action === 'download' ? 'download' : action === 'print' ? 'print' : 'share on WhatsApp';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-3 sm:px-6 bg-slate-950/60 backdrop-blur-sm">
      <div className="w-full max-w-2xl bg-white rounded-t-3xl sm:rounded-3xl border border-slate-200 shadow-2xl overflow-hidden">
        <div className="relative px-6 sm:px-8 pt-8 pb-6 bg-gradient-to-b from-emerald-50/80 to-white text-center">
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute top-3 right-3 text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-600/30">
            <Crown className="w-7 h-7" />
          </div>
          <h2 className="mt-4 text-2xl sm:text-3xl font-black text-slate-950 tracking-tight">
            Your Payroll Is Ready.
          </h2>
          <p className="mt-2 text-sm sm:text-base text-slate-600 font-medium">
            Unlock your payslips and keep everything you&rsquo;ve just created &mdash;
            we&rsquo;ll resume your <span className="font-semibold">{actionLabel}</span> the moment
            payment is confirmed.
          </p>
        </div>

        <div className="px-6 sm:px-8 py-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <PlanCard
              title="Accountant Monthly"
              price="$197"
              cadence="/month"
              features={['Unlimited clients', 'Unlimited employees', 'Cancel anytime']}
              selected={selectedPlan === 'monthly'}
              onSelect={() => onSelectPlan('monthly')}
            />
            <PlanCard
              title="Accountant Yearly"
              price="$1,970"
              cadence="/year"
              features={['Save $394 (2 months free)', 'Unlimited clients', 'Unlimited employees']}
              selected={selectedPlan === 'yearly'}
              recommended
              onSelect={() => onSelectPlan('yearly')}
            />
          </div>

          <button
            onClick={onCheckout}
            className="w-full inline-flex items-center justify-center gap-2 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm shadow-lg shadow-emerald-600/25 cursor-pointer"
          >
            <Crown className="w-4 h-4" />
            Unlock My Payroll
            <ArrowRight className="w-4 h-4" />
          </button>

          <div className="text-center text-xs text-slate-500 font-semibold">
            Already use Sheetpay?{' '}
            <button
              onClick={onLogin}
              className="text-emerald-700 hover:text-emerald-800 font-black underline underline-offset-2 cursor-pointer"
            >
              Sign in to continue.
            </button>
          </div>

          <div className="pt-2 flex items-center justify-center gap-2 text-[11px] text-slate-500 font-semibold">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Secure checkout by Paddle &middot; USD &middot; 14-day refund</span>
          </div>
        </div>
      </div>
    </div>
  );
};

const PlanCard: React.FC<{
  title: string;
  price: string;
  cadence: string;
  features: string[];
  selected: boolean;
  recommended?: boolean;
  onSelect: () => void;
}> = ({ title, price, cadence, features, selected, recommended, onSelect }) => (
  <button
    onClick={onSelect}
    className={`relative text-left rounded-2xl p-4 border-2 transition-all cursor-pointer ${
      selected
        ? 'border-emerald-500 bg-emerald-50/60 shadow-md shadow-emerald-600/10'
        : 'border-slate-200 bg-white hover:border-slate-300'
    }`}
  >
    {recommended && (
      <span className="absolute -top-2.5 right-3 text-[10px] font-black uppercase tracking-wider bg-emerald-600 text-white px-2 py-0.5 rounded-full shadow-sm">
        Recommended
      </span>
    )}
    <div className="flex items-center justify-between">
      <div className="text-xs font-black uppercase tracking-wider text-slate-700">{title}</div>
      {selected && <Check className="w-4 h-4 text-emerald-600" />}
    </div>
    <div className="mt-2 flex items-baseline gap-1">
      <span className="text-2xl font-black text-slate-950">{price}</span>
      <span className="text-xs font-bold text-slate-500">{cadence}</span>
    </div>
    <ul className="mt-3 space-y-1.5 text-[11px] font-semibold text-slate-600">
      {features.map((f) => (
        <li key={f} className="flex items-center gap-1.5">
          <Check className="w-3 h-3 text-emerald-600 shrink-0" />
          <span>{f}</span>
        </li>
      ))}
    </ul>
  </button>
);

/* -------------------------------------------------------------------------- */
/*  Footer — mirrors the site footer surface (kept in this file to avoid      */
/*  extracting the marketing footer from LandingPage in this PR).             */
/* -------------------------------------------------------------------------- */

const SharedFooter: React.FC<{
  onNavigate: (path: string) => void;
  onLaunchApp: () => void;
  onStartOnboarding: () => void;
}> = ({ onNavigate, onLaunchApp, onStartOnboarding }) => (
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
              <button onClick={() => onNavigate('/')} className="hover:text-emerald-700 cursor-pointer text-left">
                Sheetpay for Business
              </button>
            </li>
            <li>
              <button onClick={onStartOnboarding} className="hover:text-emerald-700 cursor-pointer text-left">
                Start free onboarding
              </button>
            </li>
            <li>
              <button onClick={() => onNavigate('/calculators')} className="hover:text-emerald-700 cursor-pointer text-left">
                Caribbean tax calculators
              </button>
            </li>
          </ul>
        </div>
        <div className="space-y-3">
          <div className="font-black text-slate-900 uppercase tracking-wider text-xs">Trust</div>
          <ul className="space-y-2.5 font-semibold text-xs sm:text-sm">
            <li><button onClick={() => onNavigate('/privacy-policy')} className="hover:text-emerald-700 cursor-pointer text-left">Privacy Policy</button></li>
            <li><button onClick={() => onNavigate('/terms-of-service')} className="hover:text-emerald-700 cursor-pointer text-left">Terms of Service</button></li>
            <li><button onClick={() => onNavigate('/refund-policy')} className="hover:text-emerald-700 cursor-pointer text-left">Refund Policy</button></li>
            <li><button onClick={() => onNavigate('/security')} className="hover:text-emerald-700 cursor-pointer text-left">Security &amp; Encryption</button></li>
            <li><button onClick={() => onNavigate('/contact')} className="hover:text-emerald-700 cursor-pointer text-left">Support &amp; Contact</button></li>
          </ul>
        </div>
      </div>
    </div>
  </footer>
);

/* Prevent an unused-var lint warning from the header icon import list. */
export const _accountantLandingIconRegistry = { Building2, ArrowUp };
