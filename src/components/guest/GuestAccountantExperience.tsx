/**
 * /try-accountant-dashboard — the guest accountant funnel.
 *
 * Renders the same production Accountant Dashboard components (AccountantDashboard,
 * ClientsView, EmployeesView, PayrollWorkspace, AddClientModal) inside a guest
 * permission shell that:
 *
 *   • starts every visitor on a marketing hero (Router branch 0)
 *   • after "Start Free Payroll" mounts the full dashboard (Router branch 1)
 *   • enforces the guest limits (1 client, 50 employees, 1 payroll run) by
 *     intercepting every add / run / download / print / whatsapp callback and
 *     opening the GuestPaywallModal instead
 *   • persists the whole session to convex/guestDashboard.ts::guestSessions so
 *     the visitor can refresh the tab without losing work, and so that a Paddle
 *     webhook can later migrate the row into a paying user's real tables
 *
 * NOTE: real OCR/import wiring, anonymous Cayla NL processing, and Paddle
 * webhook conversion are separate follow-ups tracked in TaskList. The shell
 * hands hooks (`enforceLimit`) to those callbacks so they only need to swap
 * their producer without changing this file.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import {
  ArrowRight,
  Sparkles,
  ShieldCheck,
  Zap,
  CheckCircle2,
  Building2,
  Users,
  PlayCircle,
  LayoutDashboard,
  LogIn,
} from 'lucide-react';
import { CaylaPenMascot } from '../CaylaPenMascot';
import { GuestLimitsBar } from './GuestLimitsBar';
import { GuestPaywallModal } from './GuestPaywallModal';
import {
  GUEST_LIMITS,
  GuestLockedAction,
  getOrCreateGuestSessionId,
} from '../../lib/guestSession';
import {
  AccountantClient,
  Employee,
  PayrollRun,
  PayslipCustomization,
  BusinessDetails,
  PayrollQueueStatus,
} from '../../types';
import { defaultPayslipCustomization } from '../../lib/initialData';
import { AccountantDashboard } from '../accountant/AccountantDashboard';
import { ClientsView } from '../accountant/ClientsView';
import { AddClientModal } from '../accountant/AddClientModal';
import { EmployeesView } from '../tabs/EmployeesView';
import { PayrollWorkspace } from '../PayrollWorkspace';
import { recalculatePayrollRun } from '../../lib/taxEngine';

interface Props {
  onNavigate: (path: string) => void;
  onSignIn: () => void;
  onUnlock: (plan: 'accountant' | 'accountant_yearly', guestSessionId: string) => void;
}

type GuestTab = 'dashboard' | 'clients' | 'employees' | 'payroll';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export const GuestAccountantExperience: React.FC<Props> = ({
  onNavigate,
  onSignIn,
  onUnlock,
}) => {
  // ── Session bootstrap ──────────────────────────────────────────────────
  const [guestSessionId] = useState<string>(() => getOrCreateGuestSessionId());
  const getOrCreate = useMutation(api.guestDashboard.getOrCreate);
  const setEmployees = useMutation(api.guestDashboard.setEmployees);
  const savePayrollRunMut = useMutation(api.guestDashboard.savePayrollRun);
  const savePayslipCustomizationMut = useMutation(
    api.guestDashboard.savePayslipCustomization,
  );
  const upsertClient = useMutation(api.guestDashboard.upsertClient);
  const setPendingActionMut = useMutation(api.guestDashboard.setPendingAction);
  const serverSession = useQuery(api.guestDashboard.get, {
    anonSessionId: guestSessionId,
  });

  useEffect(() => {
    // Fire-and-forget — worst case the server row is created lazily on the
    // first write mutation, which every write path already handles gracefully.
    getOrCreate({ anonSessionId: guestSessionId }).catch(() => {});
  }, [getOrCreate, guestSessionId]);

  // ── UI state ───────────────────────────────────────────────────────────
  const [hasEntered, setHasEntered] = useState(false);
  const [tab, setTab] = useState<GuestTab>('dashboard');
  const [paywall, setPaywall] = useState<{ reason: GuestLockedAction | 'generic' } | null>(
    null,
  );
  const [addClientOpen, setAddClientOpen] = useState(false);

  // ── Guest domain state (mirrors what a real accountant would hold) ────
  const [clients, setClients] = useState<AccountantClient[]>([]);
  const [customization, setCustomization] = useState<PayslipCustomization>(
    defaultPayslipCustomization,
  );

  // Rehydrate from server row when it first arrives (page refresh / new tab)
  useEffect(() => {
    if (!serverSession) return;
    if (clients.length === 0 && serverSession.client) {
      setClients([serverSession.client as AccountantClient]);
      setHasEntered(true);
    }
    if (serverSession.payslipCustomization) {
      setCustomization(serverSession.payslipCustomization as PayslipCustomization);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverSession?._id]);

  const activeClient = clients[0] ?? null;
  const activePayroll = activeClient?.payrollRun ?? null;
  const employeeCount = activeClient?.employees.length ?? 0;
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');

  // ── Limits ─────────────────────────────────────────────────────────────
  const clientsUsed = clients.length;
  const payrollRunsUsed = activeClient?.payrollRun ? 1 : 0;

  const triggerPaywall = useCallback(
    (reason: GuestLockedAction) => {
      setPaywall({ reason });
      setPendingActionMut({ anonSessionId: guestSessionId, pendingAction: reason }).catch(
        () => {},
      );
      try {
        window.dispatchEvent(
          new CustomEvent('sheetpay_analytics', { detail: { event: 'paywall_viewed', reason } }),
        );
      } catch {
        /* ignore */
      }
    },
    [guestSessionId, setPendingActionMut],
  );

  // ── Client management ──────────────────────────────────────────────────
  const handleAddClient = useCallback(
    (client: AccountantClient) => {
      if (clientsUsed >= GUEST_LIMITS.maxClients) {
        triggerPaywall('add_client_2');
        setAddClientOpen(false);
        return;
      }
      setClients([client]);
      setAddClientOpen(false);
      upsertClient({ anonSessionId: guestSessionId, client }).catch(() => {});
    },
    [clientsUsed, guestSessionId, triggerPaywall, upsertClient],
  );

  const requestAddClient = useCallback(() => {
    if (clientsUsed >= GUEST_LIMITS.maxClients) {
      triggerPaywall('add_client_2');
      return;
    }
    setAddClientOpen(true);
  }, [clientsUsed, triggerPaywall]);

  const handleUpdateClient = useCallback(
    (updated: AccountantClient) => {
      setClients([updated]);
      upsertClient({ anonSessionId: guestSessionId, client: updated }).catch(() => {});
    },
    [guestSessionId, upsertClient],
  );

  // ── Employee management ────────────────────────────────────────────────
  const handleAddEmployees = useCallback(
    (newEmployees: Employee[]) => {
      if (!activeClient) return { added: 0, rejected: newEmployees.length };
      const remaining = GUEST_LIMITS.maxEmployees - activeClient.employees.length;
      if (remaining <= 0) {
        triggerPaywall('add_employee_51');
        return { added: 0, rejected: newEmployees.length };
      }
      const accepted = newEmployees.slice(0, remaining);
      const rejected = newEmployees.length - accepted.length;
      const merged = [...activeClient.employees, ...accepted];
      const updated = { ...activeClient, employees: merged, employeeCount: merged.length };
      handleUpdateClient(updated);
      setEmployees({ anonSessionId: guestSessionId, employees: merged }).catch(() => {});
      if (rejected > 0) triggerPaywall('add_employee_51');
      return { added: accepted.length, rejected };
    },
    [activeClient, guestSessionId, handleUpdateClient, setEmployees, triggerPaywall],
  );

  const handleUpdateEmployee = useCallback(
    (emp: Employee) => {
      if (!activeClient) return;
      const nextEmployees = activeClient.employees.map((e) => (e.id === emp.id ? emp : e));
      const updated: AccountantClient = { ...activeClient, employees: nextEmployees };
      // Keep the payroll snapshot in sync if there's an active run.
      if (updated.payrollRun) {
        const runEmps = updated.payrollRun.employees.map((e) => (e.id === emp.id ? emp : e));
        updated.payrollRun = recalculatePayrollRun({
          ...updated.payrollRun,
          employees: runEmps,
        });
      }
      handleUpdateClient(updated);
      setEmployees({ anonSessionId: guestSessionId, employees: nextEmployees }).catch(() => {});
      if (updated.payrollRun) {
        savePayrollRunMut({
          anonSessionId: guestSessionId,
          payrollRun: updated.payrollRun,
        }).catch(() => {});
      }
    },
    [activeClient, guestSessionId, handleUpdateClient, savePayrollRunMut, setEmployees],
  );

  // ── Payroll ────────────────────────────────────────────────────────────
  const handleStartPayroll = useCallback(() => {
    if (!activeClient) return;
    if (activeClient.payrollRun) {
      triggerPaywall('run_payroll_2');
      return;
    }
    if (activeClient.employees.length === 0) return;

    const now = new Date();
    const monthName = now.toLocaleString('en-US', { month: 'long' });
    const year = now.getFullYear();
    const draft = recalculatePayrollRun({
      id: `guest-run-${Date.now()}`,
      periodLabel: `${monthName} ${year} Payroll`,
      month: monthName,
      year,
      payDate: '',
      periodStart: '',
      periodEnd: '',
      currency: activeClient.currency,
      currencySymbol: activeClient.currencySymbol,
      status: 'draft',
      employees: activeClient.employees,
      employeesCount: activeClient.employees.length,
      grossPay: 0,
      totalTax: 0,
      totalNis: 0,
      totalHealthSurcharge: 0,
      totalDeductions: 0,
      netPay: 0,
      createdAt: new Date().toISOString(),
    });

    const updated: AccountantClient = {
      ...activeClient,
      payrollRun: draft,
      payrollStatus: 'Ready for Approval' as PayrollQueueStatus,
    };
    handleUpdateClient(updated);
    setSelectedEmployeeId(draft.employees[0]?.id ?? '');
    setTab('payroll');
    savePayrollRunMut({ anonSessionId: guestSessionId, payrollRun: draft }).catch(() => {});
  }, [activeClient, guestSessionId, handleUpdateClient, savePayrollRunMut, triggerPaywall]);

  const handleFinalizePayroll = useCallback(() => {
    if (!activeClient?.payrollRun) return;
    const finalized: PayrollRun = { ...activeClient.payrollRun, status: 'finalized' };
    const updated: AccountantClient = {
      ...activeClient,
      payrollRun: finalized,
      payrollStatus: 'Finalized' as PayrollQueueStatus,
    };
    handleUpdateClient(updated);
    savePayrollRunMut({ anonSessionId: guestSessionId, payrollRun: finalized }).catch(() => {});
  }, [activeClient, guestSessionId, handleUpdateClient, savePayrollRunMut]);

  // ── Customization ──────────────────────────────────────────────────────
  const handleUpdateCustomization = useCallback(
    (partial: Partial<PayslipCustomization>) => {
      setCustomization((prev) => {
        const next = { ...prev, ...partial };
        savePayslipCustomizationMut({
          anonSessionId: guestSessionId,
          customization: next,
        }).catch(() => {});
        return next;
      });
    },
    [guestSessionId, savePayslipCustomizationMut],
  );

  // ── Unlock / paywall ────────────────────────────────────────────────────
  const handleUnlock = useCallback(
    (plan: 'accountant' | 'accountant_yearly') => {
      onUnlock(plan, guestSessionId);
    },
    [guestSessionId, onUnlock],
  );

  // ── Business shape derived from the guest client (for PayrollWorkspace) ─
  const businessFromClient: BusinessDetails = useMemo(() => {
    if (!activeClient) {
      return {
        name: 'Your Client',
        logo: '',
        address: '',
        phone: '',
        email: '',
        taxRegistrationId: '',
        nisNumber: '',
        currency: 'TTD',
        currencySymbol: '$',
      };
    }
    return {
      name: activeClient.companyName || activeClient.name,
      logo: '',
      address: activeClient.businessAddress,
      phone: activeClient.contactPhone,
      email: activeClient.contactEmail,
      taxRegistrationId: activeClient.taxRegistrationId,
      nisNumber: activeClient.nisNumber,
      currency: activeClient.currency,
      currencySymbol: activeClient.currencySymbol,
      signatoryName: activeClient.signatoryName,
      signatoryTitle: activeClient.signatoryTitle,
    };
  }, [activeClient]);

  // ── Render: hero ───────────────────────────────────────────────────────
  if (!hasEntered && clients.length === 0) {
    return <HeroScreen onStart={() => setHasEntered(true)} onSignIn={onSignIn} onNavigate={onNavigate} />;
  }

  // ── Render: guest dashboard shell ──────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50">
      <meta name="robots" content="noindex, nofollow" />
      <TopBar
        onNavigate={onNavigate}
        onSignIn={onSignIn}
        onUnlock={() => triggerPaywall('download_all_payslips')}
      />

      <GuestLimitsBar
        clientsUsed={clientsUsed}
        employeesUsed={employeeCount}
        payrollRunsUsed={payrollRunsUsed}
        onUpgrade={() => triggerPaywall('download_all_payslips')}
      />

      <GuestTabs tab={tab} onChange={setTab} hasPayroll={!!activePayroll} />

      <main className="max-w-7xl mx-auto">
        {tab === 'dashboard' && (
          <AccountantDashboard
            userName="Guest Accountant"
            clients={clients}
            teamMembers={[]}
            attentionItems={[]}
            batchJobs={[]}
            activeClient={activeClient}
            onSelectClient={(c) => {
              if (typeof c === 'object' && c) setTab('employees');
            }}
            onRunBatchPayroll={() => triggerPaywall('run_payroll_2')}
            onAddNewClient={handleAddClient}
            onOpenAddClient={requestAddClient}
            onOpenBatchPayroll={() => triggerPaywall('run_payroll_2')}
            onOpenInviteClient={() => triggerPaywall('download_all_payslips')}
            onQuickExecuteCayla={() => {
              /* Anonymous Cayla NL is a follow-up task; for now nudge the user. */
              if (!activeClient) requestAddClient();
              else if (employeeCount === 0) setTab('employees');
              else if (!activePayroll) handleStartPayroll();
            }}
            onUpdateClients={(updated) => setClients(updated.slice(0, 1))}
            messages={[]}
            isProcessing={false}
          />
        )}

        {tab === 'clients' && (
          <ClientsView
            clients={clients}
            onSelectClient={() => setTab('employees')}
            onAddNewClient={handleAddClient}
            onUpdateClients={(updated) => setClients(updated.slice(0, 1))}
          />
        )}

        {tab === 'employees' && (
          <EmployeesView
            employees={activeClient?.employees ?? []}
            business={businessFromClient}
            onUpdateEmployee={handleUpdateEmployee}
            onAddEmployee={(emp) => {
              // Single-employee add path. handleAddEmployees enforces the 50-cap
              // and opens the paywall if the addition would push us past it.
              handleAddEmployees([emp]);
            }}
            onViewPayslip={() => triggerPaywall('download_payslip')}
          />
        )}

        {tab === 'payroll' && activePayroll && activeClient && (
          <PayrollWorkspace
            payroll={activePayroll}
            selectedEmployeeId={selectedEmployeeId || activePayroll.employees[0]?.id || ''}
            onSelectEmployee={setSelectedEmployeeId}
            onUpdateEmployee={handleUpdateEmployee}
            onFinalizePayroll={handleFinalizePayroll}
            onOpenAudit={() => {}}
            business={businessFromClient}
            customization={customization}
            onUpdateCustomization={handleUpdateCustomization}
            onOpenEmailModal={() => triggerPaywall('whatsapp_share')}
            onOpenBusinessEditModal={() => {}}
          />
        )}

        {tab === 'payroll' && !activePayroll && (
          <EmptyPayroll
            hasClient={!!activeClient}
            hasEmployees={employeeCount > 0}
            onAddClient={requestAddClient}
            onGoEmployees={() => setTab('employees')}
            onRunPayroll={handleStartPayroll}
          />
        )}
      </main>

      {/* Real client-creation modal, reused from production */}
      <AddClientModal
        isOpen={addClientOpen}
        onClose={() => setAddClientOpen(false)}
        onAddClient={handleAddClient}
      />

      {/* Persistent upgrade CTA after first payroll */}
      {activePayroll && (
        <div className="fixed bottom-4 right-4 z-40 hidden sm:block">
          <button
            onClick={() => triggerPaywall('download_all_payslips')}
            className="inline-flex items-center gap-2 px-4 py-3 bg-slate-950 hover:bg-slate-800 text-white text-sm font-black rounded-2xl shadow-2xl shadow-emerald-600/20 hover:-translate-y-0.5 transition-all cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-emerald-400" />
            Unlock Unlimited Payroll
          </button>
        </div>
      )}

      <GuestPaywallModal
        isOpen={!!paywall}
        reason={paywall?.reason ?? 'generic'}
        onClose={() => setPaywall(null)}
        onUnlock={handleUnlock}
        onSignIn={onSignIn}
      />
    </div>
  );
};

// ---------------------------------------------------------------------------
// Hero — the entry screen visitors see before starting
// ---------------------------------------------------------------------------
const HeroScreen: React.FC<{
  onStart: () => void;
  onSignIn: () => void;
  onNavigate: (path: string) => void;
}> = ({ onStart, onSignIn, onNavigate }) => (
  <div className="min-h-screen bg-gradient-to-b from-white via-emerald-50/40 to-emerald-100/30">
    <header className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
      <button
        onClick={() => onNavigate('/')}
        className="flex items-center gap-2.5 cursor-pointer"
      >
        <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center">
          <CaylaPenMascot size="sm" />
        </div>
        <div>
          <div className="font-black text-lg tracking-tight text-slate-950">Sheetpay</div>
          <div className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">
            Accountant preview
          </div>
        </div>
      </button>
      <button
        onClick={onSignIn}
        className="inline-flex items-center gap-1.5 px-3.5 py-2 border border-slate-200 hover:border-emerald-300 bg-white hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 text-xs sm:text-sm font-bold rounded-xl transition-all cursor-pointer"
      >
        <LogIn className="w-3.5 h-3.5" />
        Sign in
      </button>
    </header>

    <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 text-center">
      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 border border-emerald-200 text-emerald-800 text-[11px] font-black uppercase tracking-widest mb-6">
        <Sparkles className="w-3.5 h-3.5" />
        Free — no credit card
      </div>
      <h1 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tighter text-slate-950 leading-[1.05]">
        Run Your First Client Payroll With Cayla
      </h1>
      <p className="mt-6 text-base sm:text-lg text-slate-600 font-medium max-w-2xl mx-auto leading-relaxed">
        Add up to 50 employees, run a real payroll and preview branded payslips before you
        pay. It’s the real Sheetpay Accountant dashboard — with a preview cap.
      </p>
      <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
        <button
          onClick={onStart}
          className="inline-flex items-center gap-2 px-6 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white text-base font-black rounded-2xl shadow-lg shadow-emerald-600/20 hover:shadow-emerald-600/30 hover:-translate-y-0.5 transition-all cursor-pointer"
        >
          Start Free Payroll
          <ArrowRight className="w-4 h-4" />
        </button>
        <div className="text-xs text-slate-500 font-semibold">
          1 client · up to 50 employees · 1 real payroll
        </div>
      </div>
    </section>

    <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-20 grid sm:grid-cols-3 gap-3">
      <HeroCard
        icon={<Building2 className="w-4 h-4" />}
        title="Add one real client"
        body="Country, business info, brand colors — everything Sheetpay stores."
      />
      <HeroCard
        icon={<Users className="w-4 h-4" />}
        title="Import up to 50 employees"
        body="OCR, CSV, Excel or add them manually. The 50 cap is per free payroll."
      />
      <HeroCard
        icon={<PlayCircle className="w-4 h-4" />}
        title="Run one real payroll"
        body="Deterministic PAYE / NIS / Health Surcharge — never invented by an LLM."
      />
    </section>
  </div>
);

const HeroCard: React.FC<{ icon: React.ReactNode; title: string; body: string }> = ({
  icon,
  title,
  body,
}) => (
  <div className="rounded-2xl bg-white border border-slate-200 p-5 shadow-sm">
    <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 mb-3">
      {icon}
    </div>
    <div className="font-black text-slate-900 text-sm">{title}</div>
    <p className="text-xs text-slate-500 font-medium mt-1 leading-relaxed">{body}</p>
  </div>
);

// ---------------------------------------------------------------------------
// Top bar — a stripped-down header replacement while inside the guest shell
// ---------------------------------------------------------------------------
const TopBar: React.FC<{
  onNavigate: (path: string) => void;
  onSignIn: () => void;
  onUnlock: () => void;
}> = ({ onNavigate, onSignIn, onUnlock }) => (
  <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
      <button
        onClick={() => onNavigate('/')}
        className="flex items-center gap-2 cursor-pointer"
      >
        <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center">
          <CaylaPenMascot size="xs" />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="font-black text-slate-950 tracking-tight">Sheetpay</span>
          <span className="text-[9px] font-black uppercase tracking-widest bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded-md">
            Preview
          </span>
        </div>
      </button>
      <div className="flex items-center gap-2">
        <div className="hidden md:flex items-center gap-1.5 text-[11px] text-slate-500 font-semibold">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          Real tax engine · real payslips
        </div>
        <button
          onClick={onSignIn}
          className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 text-xs font-bold rounded-lg transition-all cursor-pointer"
        >
          <LogIn className="w-3 h-3" />
          Sign in
        </button>
        <button
          onClick={onUnlock}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-lg shadow-sm shadow-emerald-600/20 transition-all cursor-pointer"
        >
          <Zap className="w-3 h-3" />
          Unlock Sheetpay
        </button>
      </div>
    </div>
  </header>
);

// ---------------------------------------------------------------------------
// Tab bar — the guest experience only exposes 4 tabs; the paid dashboard's
// other tabs (reports, tax forms, team) are outside the free preview scope.
// ---------------------------------------------------------------------------
const GuestTabs: React.FC<{
  tab: GuestTab;
  onChange: (t: GuestTab) => void;
  hasPayroll: boolean;
}> = ({ tab, onChange, hasPayroll }) => {
  const items: { id: GuestTab; label: string; icon: React.ReactNode }[] = [
    { id: 'dashboard', label: 'Practice Command', icon: <LayoutDashboard className="w-3.5 h-3.5" /> },
    { id: 'clients', label: 'Client Directory', icon: <Building2 className="w-3.5 h-3.5" /> },
    { id: 'employees', label: 'Employees', icon: <Users className="w-3.5 h-3.5" /> },
    {
      id: 'payroll',
      label: hasPayroll ? 'Payroll Run' : 'Run Payroll',
      icon: <PlayCircle className="w-3.5 h-3.5" />,
    },
  ];
  return (
    <div className="bg-white border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center gap-1 overflow-x-auto">
        {items.map((item) => {
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onChange(item.id)}
              className={`inline-flex items-center gap-1.5 px-3 py-3 text-xs font-black uppercase tracking-wider border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
                active
                  ? 'border-emerald-600 text-emerald-700'
                  : 'border-transparent text-slate-500 hover:text-slate-900'
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          );
        })}
      </div>
    </div>
  );
};

const EmptyPayroll: React.FC<{
  hasClient: boolean;
  hasEmployees: boolean;
  onAddClient: () => void;
  onGoEmployees: () => void;
  onRunPayroll: () => void;
}> = ({ hasClient, hasEmployees, onAddClient, onGoEmployees, onRunPayroll }) => (
  <div className="w-full max-w-3xl mx-auto px-4 md:px-8 py-16 text-center">
    <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center mb-4">
      <PlayCircle className="w-7 h-7 text-emerald-700" />
    </div>
    <h2 className="text-2xl font-black tracking-tight text-slate-950">Ready to run payroll</h2>
    <p className="mt-2 text-sm text-slate-500 font-medium max-w-lg mx-auto">
      Sheetpay uses the deterministic Caribbean tax engine — every PAYE, NIS and Health
      Surcharge value is calculated, never guessed.
    </p>
    <div className="mt-6 grid sm:grid-cols-3 gap-3 text-left">
      <Step
        done={hasClient}
        title="Add your client"
        onClick={onAddClient}
        cta="Add client"
      />
      <Step
        done={hasEmployees}
        title="Add employees"
        onClick={onGoEmployees}
        cta="Open employees"
      />
      <Step
        done={false}
        title="Run the payroll"
        onClick={onRunPayroll}
        cta="Run payroll"
        disabled={!hasClient || !hasEmployees}
      />
    </div>
  </div>
);

const Step: React.FC<{
  done: boolean;
  title: string;
  cta: string;
  onClick: () => void;
  disabled?: boolean;
}> = ({ done, title, cta, onClick, disabled }) => (
  <div
    className={`rounded-2xl border p-4 flex flex-col gap-3 ${
      done ? 'border-emerald-200 bg-emerald-50/60' : 'border-slate-200 bg-white'
    }`}
  >
    <div className="flex items-center gap-2">
      {done ? (
        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
      ) : (
        <span className="w-4 h-4 rounded-full border-2 border-slate-300" />
      )}
      <span className="text-sm font-black text-slate-900">{title}</span>
    </div>
    <button
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
        disabled
          ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
          : done
          ? 'bg-white border border-emerald-200 text-emerald-700 hover:bg-emerald-50'
          : 'bg-emerald-600 hover:bg-emerald-700 text-white'
      }`}
    >
      {cta}
      <ArrowRight className="w-3 h-3" />
    </button>
  </div>
);
