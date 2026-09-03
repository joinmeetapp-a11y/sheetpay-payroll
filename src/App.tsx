/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import confetti from 'canvas-confetti';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { useAction, useMutation, useQuery } from 'convex/react';
import { auth } from './lib/firebase';
import { api } from '../convex/_generated/api';
import { AuthScreen } from './components/auth/AuthScreen';
import {
  AccountType,
  AccountantClient,
  AttentionItem,
  AuditLogEntry,
  BatchPayrollJob,
  BusinessDetails,
  CaylaMessage,
  Employee,
  FirmTeamMember,
  PayrollRun,
  PayslipCustomization,
} from './types';
import {
  defaultPayslipCustomization,
  initialAugustPayrollRun,
  initialBusinessDetails,
  initialEmployees,
} from './lib/initialData';
import {
  initialAccountantClients,
  initialAttentionItems,
  initialBatchJobs,
  initialFirmTeamMembers,
} from './lib/accountantData';
import { CaylaAgentEngine } from './lib/caylaEngine';
import { recalculateEmployee, recalculatePayrollRun, formatCurrency } from './lib/taxEngine';
import { filterOutDemoOnceReal } from './lib/employees';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { CaylaTranscript } from './components/CaylaTranscript';
import { PayrollWorkspace } from './components/PayrollWorkspace';
import {
  MobileBottomNav,
  MobilePayrollCards,
  MobilePayslipModal,
} from './components/MobileViews';
import {
  AuditTrailModal,
  BusinessEditModal,
  EmailPayslipModal,
  TimesheetUploadModal,
} from './components/Modals';
import { EmployeesView } from './components/tabs/EmployeesView';
import { PayrollRunsView } from './components/tabs/PayrollRunsView';
import { PayslipsPortalView } from './components/tabs/PayslipsPortalView';
import { TaxFormsView } from './components/tabs/TaxFormsView';
import { ReportsView } from './components/tabs/ReportsView';
import { AttendanceView } from './components/tabs/AttendanceView';
import { SettingsView } from './components/tabs/SettingsView';
import { AccountantDashboard } from './components/accountant/AccountantDashboard';
import { ClientsView } from './components/accountant/ClientsView';
import { AccountantTeamView } from './components/accountant/AccountantTeamView';
import { AccountantReportsView } from './components/accountant/AccountantReportsView';
import { AddClientModal } from './components/accountant/AddClientModal';
import { ClientInviteModal } from './components/accountant/ClientInviteModal';
import { BatchPayrollModal } from './components/accountant/BatchPayrollModal';
import { CaylaPenMascot } from './components/CaylaPenMascot';
import { UpgradeBanner } from './components/UpgradeBanner';
import { ProGate } from './components/ProGate';
import { openPaddleCheckout, isPaddleConfigured } from './lib/paddle';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { PayrollReminders } from './components/reminders/PayrollReminders';
import { NiaWidget } from './components/nia/NiaWidget';
import { InviteAcceptPage } from './components/invite/InviteAcceptPage';
import { EmailPreviewPage } from './components/dev/EmailPreviewPage';
import { isAdminEmail } from './lib/admin';
import { LandingPage } from './components/landing/LandingPage';
import { GuestAccountantExperience } from './components/guest/GuestAccountantExperience';
import { OnboardingFlow } from './components/onboarding/OnboardingFlow';
import { CalculatorPage } from './components/calculators/CalculatorPage';
import { CalculatorHub } from './components/calculators/CalculatorHub';
import { CountryHub } from './components/calculators/CountryHub';
import { LegalPage } from './components/legal/LegalPage';
import { getCalculatorByPath } from './lib/calculators/registry';
import { getLegalDocumentByPath } from './lib/legalContent';
import { CountryCode } from './lib/tax-rules';
import { Sparkles, ArrowUp, X } from 'lucide-react';

// Paddle price IDs — module-level so every handler (including handleAuthComplete)
// can access them without a stale-closure risk.
const PADDLE_PRICE_IDS: Record<'pro' | 'accountant', string> = {
  pro: 'pri_01m00gw728zjvw770d1k94fh6y',
  accountant: 'pri_01m0r19pgkx604y5q3gp1trhqh',
} as const;

export default function App() {
  // Path Routing State
  const [currentPath, setCurrentPath] = useState<string>(() => window.location.pathname);

  // Navigation / View State
  const [viewMode, setViewMode] = useState<'landing' | 'auth' | 'app'>('landing');
  const [authMode, setAuthMode] = useState<'signup' | 'signin'>('signup');
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  // Plan the user selected on the landing/paywall before being prompted to sign in.
  // Cleared after checkout is opened (or user goes back without authing).
  const [pendingPlanAfterAuth, setPendingPlanAfterAuth] = useState<'pro' | 'accountant' | null>(null);
  // Prevents duplicate checkout sessions from rapid button clicks.
  const [isCheckoutLoading, setIsCheckoutLoading] = useState(false);

  // Auth State
  const [currentUser, setCurrentUser] = useState<{
    uid: string;
    email: string;
    displayName: string;
  } | null>(null);
  const [pendingOnboardingData, setPendingOnboardingData] = useState<{
    business: BusinessDetails;
    employees: Employee[];
    accountType: AccountType;
    payrollRuns?: PayrollRun[];
  } | null>(null);

  // Role & Mode State
  const [accountType, setAccountType] = useState<AccountType>('accountant');
  const [activeTab, setActiveTab] = useState<string>('accountant_dashboard');

  // Accountant State
  const [clients, setClients] = useState<AccountantClient[]>(initialAccountantClients);
  const [teamMembers, setTeamMembers] = useState<FirmTeamMember[]>(initialFirmTeamMembers);
  const [batchJobs, setBatchJobs] = useState<BatchPayrollJob[]>(initialBatchJobs);
  const [attentionItems, setAttentionItems] = useState<AttentionItem[]>(initialAttentionItems);
  const [activeClientId, setActiveClientId] = useState<string>('client-1');

  // Accountant Modals State
  const [isAddClientOpen, setIsAddClientOpen] = useState(false);
  const [inviteModalClient, setInviteModalClient] = useState<AccountantClient | null>(null);
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);

  // Sync browser popstate (back/forward)
  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = (path: string) => {
    if (path === currentPath) return;
    window.history.pushState({}, '', path);
    setCurrentPath(path);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Application State
  const [userName, setUserName] = useState('Marcus Vance');
  const [userAvatar, setUserAvatar] = useState(
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80'
  );

  const [business, setBusiness] = useState<BusinessDetails>(initialBusinessDetails);
  const [customization, setCustomization] = useState<PayslipCustomization>(
    defaultPayslipCustomization
  );
  const [employees, setEmployees] = useState<Employee[]>(initialEmployees);
  // Preview/demo rows (isDemo === true) are dropped the moment at least one
  // real employee exists. See src/lib/employees.ts. `employees` remains the raw
  // state so mutations, imports, and Cayla actions still operate on the full
  // list — only the render surface uses `visibleEmployees`.
  const visibleEmployees = useMemo(() => filterOutDemoOnceReal(employees), [employees]);

  // Payroll State (null initially to preserve pure Cayla-centric empty hero state!)
  const [payrollRun, setPayrollRun] = useState<PayrollRun | null>(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('emp-1');

  // Cayla Conversation State
  const [messages, setMessages] = useState<CaylaMessage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);

  // Modals & Mobile View States
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [isTimesheetModalOpen, setIsTimesheetModalOpen] = useState(false);
  const [isBusinessModalOpen, setIsBusinessModalOpen] = useState(false);
  const [emailModalEmployee, setEmailModalEmployee] = useState<Employee | null>(null);
  const [mobilePayslipEmployee, setMobilePayslipEmployee] = useState<Employee | null>(null);

  // Floating Cayla Quick Command State
  const [showFloatingCayla, setShowFloatingCayla] = useState(false);
  const [floatingInput, setFloatingInput] = useState('');
  const [showFloatingBar, setShowFloatingBar] = useState(false);

  // Agent Engine Reference
  const agentEngineRef = useRef<CaylaAgentEngine>(new CaylaAgentEngine());

  // Convex Mutations (graceful no-op when Convex URL not configured)
  const convexCreateOrUpdateUser = useMutation(api.users.createOrUpdate);
  const convexCreateBusiness = useMutation(api.businesses.create);
  const convexUpdateBusiness = useMutation(api.businesses.update);
  const convexBulkCreateEmployees = useMutation(api.employees.bulkCreate);
  const convexCreatePayrollRun = useMutation(api.payrollRuns.create);
  const convexCreateEmployee = useMutation(api.employees.create);
  const convexCreateAccountantClient = useMutation((api as any).accountantClients.create);
  const convexUpdateAccountantClient = useMutation((api as any).accountantClients.update);
  const convexDeleteAccountantClient = useMutation((api as any).accountantClients.deleteClient);
  const convexUpdateAccountType = useMutation((api as any).users.updateAccountType);
  const convexSetOnboardingCompleted = useMutation((api as any).users.setOnboardingCompleted);

  // Convex reactive reads — restore persisted data on login / page refresh
  const convexUserData = useQuery(
    api.users.getByFirebaseUid,
    currentUser?.uid ? { firebaseUid: currentUser.uid } : 'skip'
  );
  const convexBusinessData = useQuery(
    api.businesses.getByUser,
    convexUserData?._id ? { userId: convexUserData._id } : 'skip'
  );
  const convexEmployeesData = useQuery(
    api.employees.getByBusiness,
    convexBusinessData?._id ? { businessId: convexBusinessData._id } : 'skip'
  );
  const convexPayrollRunsData = useQuery(
    api.payrollRuns.getByBusiness,
    convexBusinessData?._id ? { businessId: convexBusinessData._id } : 'skip'
  );
  const convexAccountantClientsData = useQuery(
    (api as any).accountantClients.getByUser,
    convexUserData?._id ? { userId: convexUserData._id } : 'skip'
  );

  // Convex Actions — AI, email, and payments
  const caylaChatAction = useAction(api.cayla.chat);
  const sendEmailAction = useAction(api.emailService.sendEmail);
  const createCheckoutSession = useAction((api as any).paddle.createCheckoutSession);

  // True until Firebase auth reports its first state (prevents white-flash on cold load)
  const [isAuthInitialized, setIsAuthInitialized] = useState(false);

  // Convex — reactive billing entitlement (unlocks features the moment plan changes)
  const activateFromCheckout = useMutation((api as any).subscriptions.activateFromCheckout);
  const entitlement = useQuery(
    (api as any).subscriptions.getEntitlement,
    { firebaseUid: currentUser?.uid }
  ) as { plan: 'free' | 'pro' | 'accountant'; planStatus: string; isPro: boolean; isAccountant: boolean } | undefined;
  // Admin accounts (e.g. the owner) get full access to every feature.
  const isAdmin = isAdminEmail(currentUser?.email);
  const plan = isAdmin ? 'accountant' : (entitlement?.plan ?? 'free');
  const isPro = isAdmin || (entitlement?.isPro ?? false);
  const isAccountant = isAdmin || (entitlement?.isAccountant ?? false);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  // Firebase auth state sync. Runs on cold load / session restore too, not
  // just after a fresh sign-in — so this is where we make sure a Convex user
  // row exists regardless of which provider Firebase used (Google popup,
  // Google redirect, email/password, future Apple/Microsoft). users.createOrUpdate
  // is idempotent (by firebaseUid) and fires the welcome email exactly once
  // via idempotencyKey `welcome:${userId}`, so calling it here every time is
  // safe and closes the race where handleAuthComplete would otherwise miss
  // firing after a redirect callback.
  const upsertedUidsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setIsAuthInitialized(true);
      if (user) {
        const name = user.displayName || user.email?.split('@')[0] || 'User';
        setCurrentUser({ uid: user.uid, email: user.email!, displayName: name });
        setUserName(name);

        // Ensure a Convex user row exists for every authenticated Firebase
        // user — regardless of provider. Guarded so we only round-trip once
        // per uid per browser session.
        if (user.email && !upsertedUidsRef.current.has(user.uid)) {
          upsertedUidsRef.current.add(user.uid);
          convexCreateOrUpdateUser({
            firebaseUid: user.uid,
            email: user.email,
            displayName: name,
            // Insert-time default only; users.createOrUpdate never overwrites
            // accountType on existing rows.
            accountType: 'business',
          }).catch((err) => {
            console.error('[auth] Convex user upsert failed:', err);
            // Allow a future auth-state change to retry.
            upsertedUidsRef.current.delete(user.uid);
          });
        }

        // Returning authenticated user — go straight to app if on landing
        // (but never hijack the /admin route).
        if (
          viewMode === 'landing' &&
          !pendingOnboardingData &&
          !window.location.pathname.startsWith('/admin') &&
          !window.location.pathname.startsWith('/payroll/')
        ) {
          setViewMode('app');
          navigate('/app');
        }
      } else {
        setCurrentUser(null);
      }
    });
    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Route protection: unauthenticated users on /app → redirect to landing.
  useEffect(() => {
    if (!isAuthInitialized) return;
    if (currentUser) return;
    if (window.location.pathname.startsWith('/app')) {
      navigate('/');
      setViewMode('landing');
    }
  }, [isAuthInitialized, currentUser]);

  // Handle Paddle checkout success redirect (?upgraded=pro|accountant).
  // Optimistically activates the plan via Convex; the Paddle webhook reconciles.
  useEffect(() => {
    if (!currentUser?.uid) return;
    const params = new URLSearchParams(window.location.search);
    const upgraded = params.get('upgraded');
    if (upgraded === 'pro' || upgraded === 'accountant') {
      activateFromCheckout({ firebaseUid: currentUser.uid, plan: upgraded }).catch(() => {});
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#059669', '#10b981', '#34d399', '#6ee7b7'],
      });
      // Strip the query param without a reload
      params.delete('upgraded');
      const clean = window.location.pathname + (params.toString() ? `?${params}` : '');
      window.history.replaceState({}, '', clean);
      setViewMode('app');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.uid]);

  // Show floating Cayla trigger when scrolling down into payroll results
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 280 && payrollRun) {
        setShowFloatingBar(true);
      } else {
        setShowFloatingBar(false);
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [payrollRun]);

  /**
   * Handle switching active client tenant
   */
  const handleSelectClient = (clientId: string, targetTab: string = 'dashboard') => {
    setActiveClientId(clientId);
    const target = clients.find((c) => c.id === clientId);
    if (target) {
      const companyDisplayName = target.companyName || target.name || 'Client Corporation';
      const cleanEmailDomain = companyDisplayName.toLowerCase().replace(/[^a-z0-9]/g, '') || 'company';
      setBusiness({
        name: companyDisplayName,
        currency: target.currency || 'TTD',
        currencySymbol: target.currency === 'GYD' ? 'G$' : target.currency === 'BBD' ? 'Bds$' : '$',
        address: target.businessAddress || `${companyDisplayName} Corporate Headquarters, Port of Spain`,
        phone: target.contactPhone || '+1 (868) 555-0100',
        email: target.contactEmail || `payroll@${cleanEmailDomain}.com`,
        taxRegistrationId: target.taxRegistrationId || `BIR-${Math.floor(10000000 + Math.random() * 90000000)}`,
        nisNumber: target.nisNumber || `NIB-EMP-${Math.floor(100000 + Math.random() * 900000)}`,
        signatoryName: userName || 'Accountant',
        signatoryTitle: 'Senior Practice Accountant',
      });
      // If client has isolated employees, use them; otherwise keep active employees
      if (target.employees && target.employees.length > 0) {
        setEmployees(target.employees);
      }
      // If client has active payroll runs, load the latest
      if (target.payrollRuns && target.payrollRuns.length > 0) {
        setPayrollRun(target.payrollRuns[0]);
      } else {
        setPayrollRun(null);
      }
      setActiveTab(targetTab);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  /**
   * Handle switching account type from settings or onboarding.
   * Accountant workspace is gated on an active Accountant subscription — free
   * users see the Paddle checkout for the Accountant plan instead of being
   * silently switched. Server-side mutations (see convex/usage.ts requirePlan)
   * are the authoritative gate; this frontend check only shapes the UX.
   */
  const handleSwitchAccountType = (newType: AccountType) => {
    if (newType === 'accountant' && !isAccountant) {
      handleOpenCheckout('accountant');
      return;
    }
    setAccountType(newType);
    if (newType === 'accountant') {
      setActiveTab('accountant_dashboard');
    } else {
      setActiveTab('dashboard');
    }
  };

  // Defensive gate: if entitlement resolves and the user is NOT on an
  // Accountant plan while accountant state is active (e.g. stale local state
  // from before their subscription lapsed), snap them back to the business
  // workspace. The server-side requirePlan on future accountant mutations is
  // the authoritative check; this just prevents a confusing empty-data UI.
  useEffect(() => {
    if (!entitlement) return;
    if (accountType === 'accountant' && !isAccountant) {
      setAccountType('business');
      setActiveTab('dashboard');
    }
  }, [entitlement, accountType, isAccountant]);

  // ── Restore persisted business details from Convex on login / page refresh ─
  const dataRestoredRef = useRef(false);
  useEffect(() => {
    if (!currentUser) { dataRestoredRef.current = false; }
  }, [currentUser]);

  useEffect(() => {
    if (!convexBusinessData || !currentUser) return;
    setBusiness({
      name: convexBusinessData.name,
      address: convexBusinessData.address || '',
      phone: convexBusinessData.phone || '',
      email: convexBusinessData.email || '',
      website: (convexBusinessData as any).website || '',
      taxRegistrationId: convexBusinessData.taxRegistrationId || '',
      nisNumber: convexBusinessData.nisNumber || '',
      signatoryName: convexBusinessData.signatoryName || '',
      signatoryTitle: convexBusinessData.signatoryTitle || '',
      currency: convexBusinessData.currency || 'TTD',
      currencySymbol: convexBusinessData.currencySymbol || '$',
      logo: (convexBusinessData as any).logo || '',
      signatureUrl: (convexBusinessData as any).signatureUrl || '',
    });
    // Restore payslip customization if it was saved
    const cbd = convexBusinessData as any;
    if (cbd.templateId || cbd.primaryColor) {
      setCustomization({
        templateId: cbd.templateId || 'template_01',
        primaryColor: cbd.primaryColor || '#059669',
        accentColor: cbd.accentColor || '#10b981',
        showCompanyLogo: cbd.showCompanyLogo ?? true,
        showSignature: cbd.showSignature ?? true,
        showYTD: cbd.showYTD ?? true,
        showBankDetails: cbd.showBankDetails ?? true,
        showTaxId: cbd.showTaxId ?? true,
        showQrVerification: cbd.showQrVerification ?? true,
      });
    }
  }, [convexBusinessData?._id, currentUser?.uid]);

  // ── Restore persisted employees from Convex on login / page refresh ─────────
  useEffect(() => {
    if (!convexEmployeesData || convexEmployeesData.length === 0 || !currentUser) return;
    if (dataRestoredRef.current) return;
    dataRestoredRef.current = true;
    setEmployees(
      convexEmployeesData.map((e) => ({
        id: e.localId,
        name: e.name,
        employeeId: e.employeeId,
        position: e.position,
        department: e.department,
        avatar: e.avatar || '',
        email: e.email || '',
        phone: e.phone || '',
        payFrequency: (e.payFrequency as any) || 'monthly',
        basicPay: e.basicPay,
        frequencySalary: e.frequencySalary,
        overtimeHours: e.overtimeHours,
        overtimeRate: e.overtimeRate,
        bonus: e.bonus,
        commission: e.commission,
        allowances: e.allowances,
        paye: e.paye,
        nis: e.nis,
        healthSurcharge: e.healthSurcharge,
        otherDeductions: e.otherDeductions,
        grossPay: e.grossPay,
        netPay: e.netPay,
        status: (e.status as any) || 'active',
        changedFields: [],
        isDemo: false,
      }))
    );
  }, [convexEmployeesData, currentUser?.uid]);

  // ── Restore most-recent payroll run from Convex on login / page refresh ───────
  const payrollRunRestoredRef = useRef(false);
  useEffect(() => {
    if (!currentUser) { payrollRunRestoredRef.current = false; }
  }, [currentUser]);
  useEffect(() => {
    if (!convexPayrollRunsData || convexPayrollRunsData.length === 0 || !currentUser) return;
    if (payrollRunRestoredRef.current) return;
    payrollRunRestoredRef.current = true;
    // convexPayrollRunsData is ordered desc (newest first)
    const r = convexPayrollRunsData[0];
    setPayrollRun({
      id: String(r._id),
      periodLabel: r.periodLabel || `${r.month} ${r.year}`,
      month: r.month,
      year: r.year,
      payDate: '',
      periodStart: '',
      periodEnd: '',
      currency: 'TTD',
      currencySymbol: '$',
      status: r.status as any,
      employeesCount: (r.employeesSnapshot || []).length,
      grossPay: r.totalGross,
      totalTax: r.totalPaye,
      totalNis: r.totalNis,
      totalHealthSurcharge: r.totalHealthSurcharge,
      totalDeductions: r.totalDeductions,
      netPay: r.totalNet,
      payeTotal: r.totalPaye,
      nisTotal: r.totalNis,
      hsTotal: r.totalHealthSurcharge,
      otherDeductionsTotal: 0,
      employees: (r.employeesSnapshot || []) as any,
      createdAt: new Date(r.createdAt).toISOString(),
    });
  }, [convexPayrollRunsData, currentUser?.uid]);

  // ── Restore accountant clients from Convex on login / page refresh ────────────
  const clientsRestoredRef = useRef(false);
  useEffect(() => {
    if (!currentUser) { clientsRestoredRef.current = false; }
  }, [currentUser]);
  useEffect(() => {
    if (!convexAccountantClientsData || convexAccountantClientsData.length === 0 || !currentUser) return;
    if (clientsRestoredRef.current) return;
    clientsRestoredRef.current = true;
    setClients(
      convexAccountantClientsData.map((c: any) => ({
        id: c.localId,
        _convexId: c._id,
        name: c.name,
        companyName: c.companyName || '',
        country: c.country,
        countryCode: c.countryCode,
        currency: c.currency,
        currencySymbol: c.currencySymbol,
        payFrequency: c.payFrequency as any,
        payrollSchedule: c.payFrequency as any,
        employeeCount: c.employeeCount || 0,
        nextPayrollDate: c.nextPayrollDate || '',
        payrollStatus: (c.payrollStatus || 'Not Started') as any,
        monthlyPayrollValue: c.monthlyPayrollValue || 0,
        totalMonthlyPayroll: c.totalMonthlyPayroll || 0,
        assignedTo: c.assignedTo || '',
        assignedToAvatar: c.assignedToAvatar || '',
        contactName: c.contactName || '',
        contactEmail: c.contactEmail || '',
        contactPhone: c.contactPhone || '',
        businessAddress: c.businessAddress || '',
        taxRegistrationId: c.taxRegistrationId || '',
        nisNumber: c.nisNumber || '',
        signatoryName: c.signatoryName || '',
        signatoryTitle: c.signatoryTitle || '',
        approvalStatus: (c.approvalStatus || 'not_requested') as any,
        notes: c.notes || '',
        employees: c.employeesJson ? JSON.parse(c.employeesJson) : [],
        payrollRun: c.payrollRunJson ? JSON.parse(c.payrollRunJson) : null,
        payrollRuns: c.payrollRunsJson ? JSON.parse(c.payrollRunsJson) : [],
        missingInformation: [],
        anomalies: [],
        clientPermissions: [],
        lastPayroll: '',
      }))
    );
  }, [convexAccountantClientsData, currentUser?.uid]);

  // ── Route to the correct dashboard the moment entitlement resolves after login
  const hasRoutedAfterLoginRef = useRef(false);
  useEffect(() => {
    if (!currentUser) { hasRoutedAfterLoginRef.current = false; }
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser || entitlement === undefined || viewMode !== 'app') return;
    if (convexUserData === undefined) return; // wait for user data to resolve
    if (hasRoutedAfterLoginRef.current) return;
    hasRoutedAfterLoginRef.current = true;
    // Route to accountant dashboard if plan is accountant OR if user selected accountant type
    const goToAccountant = isAccountant || convexUserData?.accountType === 'accountant';
    if (goToAccountant) {
      setAccountType('accountant');
      setActiveTab('accountant_dashboard');
    } else {
      setAccountType('business');
      setActiveTab('dashboard');
    }
  }, [currentUser?.uid, entitlement, viewMode, isAccountant, convexUserData]);

  // ── Re-route after a Paddle payment upgrades the plan ───────────────────────
  const prevPlanRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    const newPlan = entitlement?.plan;
    if (prevPlanRef.current === newPlan) return;
    const prev = prevPlanRef.current;
    prevPlanRef.current = newPlan;
    if (!prev || !currentUser || viewMode !== 'app') return;
    if (newPlan === 'accountant') {
      setAccountType('accountant');
      setActiveTab('accountant_dashboard');
    } else if (prev === 'accountant' && newPlan !== 'accountant') {
      setAccountType('business');
      setActiveTab('dashboard');
    }
  }, [entitlement?.plan]);

  // Auto-show onboarding for authenticated users who have no business data yet.
  // This covers: (1) users who signed up directly without going through onboarding,
  // (2) users whose onboarding was interrupted before data was saved.
  // Guard: if onboardingCompleted=true in Convex, we know they've been through onboarding
  // (even if the business reactive query hasn't updated yet — this prevents re-triggering).
  useEffect(() => {
    if (!currentUser || !isAuthInitialized) return;
    if (viewMode !== 'app') return;
    if (isOnboardingOpen) return;
    if (pendingOnboardingData) return; // handleAuthComplete is mid-flight
    if (convexUserData === undefined || convexUserData === null) return; // user query loading
    if ((convexUserData as any).onboardingCompleted) return; // already did onboarding
    if (convexBusinessData === undefined) return; // business query loading (or skipped)
    if (convexBusinessData === null) {
      setIsOnboardingOpen(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.uid, isAuthInitialized, viewMode, isOnboardingOpen, pendingOnboardingData, convexUserData, convexBusinessData]);

  // Pending confirmation state for Cayla sensitive actions
  const [pendingCaylaConfirmation, setPendingCaylaConfirmation] = useState<CaylaMessage['confirmationRequired'] | null>(null);

  /**
   * Main Natural Language Dispatcher for Cayla — uses Convex OpenAI action
   */
  const handleSendMessage = async (text: string, confirmingAction?: string, confirmationPayload?: any) => {
    if (!text.trim() || isProcessing) return;

    const userMsg: CaylaMessage = {
      id: `msg-${Date.now()}`,
      sender: 'user',
      text: text.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsProcessing(true);
    setPendingCaylaConfirmation(null);

    // Show typing indicator
    const thinkingId = `thinking-${Date.now()}`;
    const thinkingMsg: CaylaMessage = {
      id: thinkingId,
      sender: 'cayla',
      text: '...',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isWorking: true,
    };
    setMessages((prev) => [...prev, thinkingMsg]);

    try {
      const userId = currentUser?.uid ?? 'demo';

      const result = await caylaChatAction({
        message: text.trim(),
        userId,
        businessId: undefined,
        confirmingAction,
        confirmationPayload,
      });

      // Replace thinking indicator with real response
      const caylaMsg: CaylaMessage = {
        id: `cayla-${Date.now()}`,
        sender: 'cayla',
        text: result.text ?? "I'm not sure how to help with that.",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        confirmationRequired: result.pendingConfirmation ?? undefined,
      };

      setMessages((prev) => prev.filter((m) => m.id !== thinkingId).concat(caylaMsg));

      if (result.pendingConfirmation) {
        setPendingCaylaConfirmation(result.pendingConfirmation);
      }
    } catch (err) {
      console.error('Cayla dispatch error:', err);
      // Fallback to local engine on error
      setMessages((prev) => prev.filter((m) => m.id !== thinkingId));

      try {
        if (accountType === 'accountant') {
          const result = await agentEngineRef.current.processAccountantPrompt(
            text,
            clients,
            teamMembers,
            activeClientId
          );
          setMessages((prev) => [...prev, result.message]);
          if (result.newActiveClientId) handleSelectClient(result.newActiveClientId, 'dashboard');
          if (result.updatedClients) setClients(result.updatedClients);
          if (result.updatedBatchJobs) setBatchJobs(result.updatedBatchJobs);
          if (result.updatedPayroll) setPayrollRun(result.updatedPayroll);
        } else {
          const result = await agentEngineRef.current.processPrompt(
            text,
            payrollRun,
            initialAugustPayrollRun,
            selectedEmployeeId
          );
          setMessages((prev) => [...prev, result.message]);
          if (result.updatedPayroll) setPayrollRun(result.updatedPayroll);
          if (result.triggerPayrollDisplay && !payrollRun) setPayrollRun(result.updatedPayroll || initialAugustPayrollRun);
          if (result.selectedEmployeeId) setSelectedEmployeeId(result.selectedEmployeeId);
          if (result.newAuditEntry) setAuditLogs((prev) => [result.newAuditEntry!, ...prev]);
        }
      } catch (fallbackErr) {
        console.error('Fallback engine error:', fallbackErr);
        setMessages((prev) => [...prev, {
          id: `err-${Date.now()}`,
          sender: 'cayla',
          text: "I'm having trouble right now. Please try again in a moment.",
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        }]);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  /**
   * Handle Cayla confirmation dialog
   */
  const handleCaylaConfirm = () => {
    if (!pendingCaylaConfirmation) return;
    handleSendMessage(
      'Yes, confirmed.',
      pendingCaylaConfirmation.confirmAction,
      pendingCaylaConfirmation.payload
    );
  };

  const handleCaylaCancel = () => {
    setPendingCaylaConfirmation(null);
    const cancelMsg: CaylaMessage = {
      id: `cancel-${Date.now()}`,
      sender: 'cayla',
      text: 'Action cancelled. Let me know if you need anything else.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages((prev) => [...prev, cancelMsg]);
  };

  /**
   * Handle Undo for an action
   */
  const handleUndo = (undoAction: NonNullable<CaylaMessage['undoAction']>) => {
    if (!payrollRun) return;

    const targetEmp = payrollRun.employees.find((e) => e.name === undoAction.employeeName);
    if (!targetEmp) return;

    const restoredEmp = recalculateEmployee({
      ...targetEmp,
      [undoAction.field]: undoAction.previousValue,
      changedFields: [undoAction.field],
    });

    const updatedPayroll = recalculatePayrollRun({
      ...payrollRun,
      employees: payrollRun.employees.map((e) => (e.id === restoredEmp.id ? restoredEmp : e)),
    });

    setPayrollRun(updatedPayroll);

    const auditEntry: AuditLogEntry = {
      id: `audit-${Date.now()}`,
      timestamp: new Date().toLocaleTimeString(),
      actor: 'user',
      action: `Undid ${undoAction.field} change for ${undoAction.employeeName}`,
      employeeName: undoAction.employeeName,
      previousValue: undoAction.newValue,
      newValue: undoAction.previousValue,
      reversible: false,
    };
    setAuditLogs((prev) => [auditEntry, ...prev]);

    const systemMsg: CaylaMessage = {
      id: `msg-${Date.now()}`,
      sender: 'cayla',
      text: `Reverted ${undoAction.field} for ${undoAction.employeeName} back to ${undoAction.previousValue}.`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages((prev) => [...prev, systemMsg]);
  };

  /**
   * Finalize Payroll Action (with confetti!)
   */
  const handleConfirmFinalize = () => {
    if (!payrollRun) return;

    const finalized: PayrollRun = {
      ...payrollRun,
      status: 'finalized',
      finalizedAt: new Date().toISOString(),
    };
    setPayrollRun(finalized);

    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#059669', '#10b981', '#34d399', '#047857'],
    });

    const auditEntry: AuditLogEntry = {
      id: `audit-${Date.now()}`,
      timestamp: new Date().toLocaleTimeString(),
      actor: 'user',
      action: 'Authorized and finalized August 2026 payroll',
      reversible: false,
    };
    setAuditLogs((prev) => [auditEntry, ...prev]);

    const msg: CaylaMessage = {
      id: `msg-${Date.now()}`,
      sender: 'cayla',
      text: `August 2026 payroll has been officially finalized. ${finalized.employeesCount} payslips are sealed, and bank payment batch files are ready for transfer.`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      actionSummary: {
        type: 'payroll_run',
        title: 'Payroll Run Finalized',
        description: `Net disbursement: ${formatCurrency(finalized.netPay)} to ${finalized.employeesCount} staff.`,
      },
    };
    setMessages((prev) => [...prev, msg]);
  };

  /**
   * Handle Inline Employee Update from table or mobile card
   */
  const handleUpdateEmployee = (updatedEmp: Employee, fieldChanged?: string) => {
    setEmployees((prev) =>
      prev.map((e) => (e.id === updatedEmp.id ? updatedEmp : e))
    );

    if (payrollRun) {
      const updatedPayroll = recalculatePayrollRun({
        ...payrollRun,
        employees: payrollRun.employees.map((e) => (e.id === updatedEmp.id ? updatedEmp : e)),
      });
      setPayrollRun(updatedPayroll);
    }

    if (fieldChanged) {
      const auditEntry: AuditLogEntry = {
        id: `audit-${Date.now()}`,
        timestamp: new Date().toLocaleTimeString(),
        actor: 'user',
        action: `Manually updated ${fieldChanged}`,
        employeeName: updatedEmp.name,
        employeeId: updatedEmp.id,
        newValue: (updatedEmp as any)[fieldChanged],
        reversible: true,
      };
      setAuditLogs((prev) => [auditEntry, ...prev]);
    }
  };

  const handleAddEmployee = (newEmp: Employee) => {
    setEmployees((prev) => [newEmp, ...prev]);
    if (payrollRun) {
      const updatedPayroll = recalculatePayrollRun({
        ...payrollRun,
        employeesCount: payrollRun.employeesCount + 1,
        employees: [newEmp, ...payrollRun.employees],
      });
      setPayrollRun(updatedPayroll);
    }
    // Persist to Convex so the employee survives page refresh
    if (convexBusinessData?._id && convexUserData?._id) {
      convexCreateEmployee({
        businessId: convexBusinessData._id,
        userId: convexUserData._id,
        name: newEmp.name,
        employeeId: newEmp.employeeId || `EMP-${Date.now()}`,
        position: newEmp.position || 'Team Member',
        department: newEmp.department || 'General',
        avatar: newEmp.avatar,
        email: newEmp.email,
        phone: newEmp.phone,
        payFrequency: newEmp.payFrequency || 'monthly',
        basicPay: newEmp.basicPay || 0,
        frequencySalary: newEmp.frequencySalary || newEmp.basicPay || 0,
        overtimeHours: newEmp.overtimeHours || 0,
        overtimeRate: newEmp.overtimeRate || 0,
        bonus: newEmp.bonus || 0,
        commission: newEmp.commission || 0,
        allowances: newEmp.allowances || 0,
        paye: newEmp.paye || 0,
        nis: newEmp.nis || 0,
        healthSurcharge: newEmp.healthSurcharge || 0,
        otherDeductions: newEmp.otherDeductions || 0,
        grossPay: newEmp.grossPay || 0,
        netPay: newEmp.netPay || 0,
        status: newEmp.status || 'pending',
        localId: newEmp.id,
      }).catch((err) => console.error('[employees] Convex create failed:', err));
    }
    const auditEntry: AuditLogEntry = {
      id: `audit-${Date.now()}`,
      timestamp: new Date().toLocaleTimeString(),
      actor: 'user',
      action: `Added new employee ${newEmp.name}`,
      employeeName: newEmp.name,
      employeeId: newEmp.id,
      reversible: false,
    };
    setAuditLogs((prev) => [auditEntry, ...prev]);
  };

  const handleDeleteEmployee = (empId: string) => {
    const target = employees.find((e) => e.id === empId);
    setEmployees((prev) => prev.filter((e) => e.id !== empId));
    if (payrollRun) {
      const updatedPayroll = recalculatePayrollRun({
        ...payrollRun,
        employeesCount: Math.max(1, payrollRun.employeesCount - 1),
        employees: payrollRun.employees.filter((e) => e.id !== empId),
      });
      setPayrollRun(updatedPayroll);
    }
    if (target) {
      const auditEntry: AuditLogEntry = {
        id: `audit-${Date.now()}`,
        timestamp: new Date().toLocaleTimeString(),
        actor: 'user',
        action: `Removed employee ${target.name}`,
        employeeName: target.name,
        employeeId: target.id,
        reversible: false,
      };
      setAuditLogs((prev) => [auditEntry, ...prev]);
    }
  };

  /**
   * Handle Timesheet Overtime Data Import
   */
  const handleApplyTimesheetData = (otMap: Record<string, number>) => {
    if (!payrollRun) {
      const base = recalculatePayrollRun(initialAugustPayrollRun);
      const updatedEmployees = base.employees.map((e) => {
        const firstName = (e.name || '').split(' ')[0]?.toLowerCase() || '';
        if (otMap[firstName] !== undefined) {
          return recalculateEmployee({
            ...e,
            overtimeHours: otMap[firstName],
            changedFields: ['overtimeHours', 'grossPay', 'paye', 'nis', 'netPay'],
          });
        }
        return e;
      });
      const newRun = recalculatePayrollRun({ ...base, employees: updatedEmployees });
      setPayrollRun(newRun);
      setEmployees(updatedEmployees);
    } else {
      const updatedEmployees = payrollRun.employees.map((e) => {
        const firstName = (e.name || '').split(' ')[0]?.toLowerCase() || '';
        if (otMap[firstName] !== undefined) {
          return recalculateEmployee({
            ...e,
            overtimeHours: otMap[firstName],
            changedFields: ['overtimeHours', 'grossPay', 'paye', 'nis', 'netPay'],
          });
        }
        return e;
      });
      const newRun = recalculatePayrollRun({ ...payrollRun, employees: updatedEmployees });
      setPayrollRun(newRun);
      setEmployees(updatedEmployees);
    }

    const countApplied = Object.keys(otMap).length;
    const msg: CaylaMessage = {
      id: `msg-${Date.now()}`,
      sender: 'cayla',
      text: `Successfully ingested biometric punch logs. Overtime hours applied to ${countApplied} staff and payroll values recalculated.`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      actionSummary: {
        type: 'timesheet_imported',
        title: 'Timesheet Processed',
        description: `${countApplied} overtime records synchronized.`,
      },
    };
    setMessages((prev) => [...prev, msg]);
  };

  /**
   * Handle Sending Email — uses Resend via Convex action
   */
  const handleSendEmail = async (recipientEmail: string) => {
    const employee = emailModalEmployee;
    try {
      await sendEmailAction({
        to: recipientEmail,
        emailType: 'employeePayslip',
        data: {
          employeeName: employee?.name ?? 'Employee',
          period: payrollRun?.periodLabel ?? `${payrollRun?.month ?? ''} ${payrollRun?.year ?? ''}`.trim(),
          businessName: business.name,
          grossPay: (employee?.grossPay ?? 0).toFixed(2),
          netPay: (employee?.netPay ?? 0).toFixed(2),
          currency: business.currency || 'TTD',
          deductions: [
            { label: 'PAYE', amount: (employee?.paye ?? 0).toFixed(2) },
            { label: 'NIS', amount: (employee?.nis ?? 0).toFixed(2) },
            { label: 'Health Surcharge', amount: (employee?.healthSurcharge ?? 0).toFixed(2) },
          ].filter((d) => parseFloat(d.amount) > 0),
          payslipLink: 'https://mysheetpay.web.app/app',
        },
        userId: currentUser?.uid,
      });
    } catch (_) { /* graceful fallback if Resend not yet configured */ }

    confetti({ particleCount: 50, spread: 60, origin: { y: 0.7 }, colors: ['#059669', '#10b981'] });
    setMessages((prev) => [
      ...prev,
      {
        id: `msg-${Date.now()}`,
        sender: 'cayla',
        text: `Payslip dispatched to ${recipientEmail}.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  };

  /**
   * Accountant Action Handlers
   */
  const handleAddClient = (newClient: AccountantClient) => {
    setClients((prev) => [newClient, ...prev]);
    setIsAddClientOpen(false);
    confetti({
      particleCount: 60,
      spread: 60,
      origin: { y: 0.6 },
      colors: ['#059669', '#10b981'],
    });
    // Persist to Convex
    if (convexUserData?._id && currentUser?.uid) {
      convexCreateAccountantClient({
        accountantUserId: convexUserData._id,
        accountantFirebaseUid: currentUser.uid,
        localId: newClient.id,
        name: newClient.name,
        companyName: newClient.companyName,
        country: newClient.country,
        countryCode: newClient.countryCode,
        currency: newClient.currency,
        currencySymbol: newClient.currencySymbol,
        payFrequency: newClient.payFrequency,
        employeeCount: newClient.employeeCount,
        nextPayrollDate: newClient.nextPayrollDate,
        payrollStatus: newClient.payrollStatus,
        monthlyPayrollValue: newClient.monthlyPayrollValue,
        totalMonthlyPayroll: newClient.totalMonthlyPayroll,
        assignedTo: newClient.assignedTo,
        contactName: newClient.contactName,
        contactEmail: newClient.contactEmail,
        contactPhone: newClient.contactPhone,
        businessAddress: newClient.businessAddress,
        taxRegistrationId: newClient.taxRegistrationId,
        nisNumber: newClient.nisNumber,
        signatoryName: newClient.signatoryName,
        signatoryTitle: newClient.signatoryTitle,
        notes: newClient.notes,
        employeesJson: newClient.employees?.length ? JSON.stringify(newClient.employees) : undefined,
        payrollRunJson: newClient.payrollRun ? JSON.stringify(newClient.payrollRun) : undefined,
        payrollRunsJson: newClient.payrollRuns?.length ? JSON.stringify(newClient.payrollRuns) : undefined,
      }).catch((err) => console.error('[clients] Convex create failed:', err));
    }
  };

  const handleUpdateClient = (updatedClient: AccountantClient) => {
    setClients((prev) =>
      prev.map((c) => (c.id === updatedClient.id ? updatedClient : c))
    );
    // Persist to Convex — find the Convex ID from the current clients list
    const existing = convexAccountantClientsData?.find((c: any) => c.localId === updatedClient.id);
    if (existing?._id) {
      convexUpdateAccountantClient({
        clientId: existing._id,
        name: updatedClient.name,
        companyName: updatedClient.companyName,
        country: updatedClient.country,
        countryCode: updatedClient.countryCode,
        currency: updatedClient.currency,
        currencySymbol: updatedClient.currencySymbol,
        payFrequency: updatedClient.payFrequency,
        employeeCount: updatedClient.employeeCount,
        nextPayrollDate: updatedClient.nextPayrollDate,
        payrollStatus: updatedClient.payrollStatus,
        monthlyPayrollValue: updatedClient.monthlyPayrollValue,
        totalMonthlyPayroll: updatedClient.totalMonthlyPayroll,
        assignedTo: updatedClient.assignedTo,
        contactName: updatedClient.contactName,
        contactEmail: updatedClient.contactEmail,
        contactPhone: updatedClient.contactPhone,
        businessAddress: updatedClient.businessAddress,
        taxRegistrationId: updatedClient.taxRegistrationId,
        nisNumber: updatedClient.nisNumber,
        signatoryName: updatedClient.signatoryName,
        signatoryTitle: updatedClient.signatoryTitle,
        notes: updatedClient.notes,
        employeesJson: updatedClient.employees?.length ? JSON.stringify(updatedClient.employees) : undefined,
        payrollRunJson: updatedClient.payrollRun ? JSON.stringify(updatedClient.payrollRun) : undefined,
        payrollRunsJson: updatedClient.payrollRuns?.length ? JSON.stringify(updatedClient.payrollRuns) : undefined,
      }).catch((err) => console.error('[clients] Convex update failed:', err));
    }
  };

  const handleDeleteClient = (clientId: string) => {
    setClients((prev) => prev.filter((c) => c.id !== clientId));
    // Delete from Convex
    const existing = convexAccountantClientsData?.find((c: any) => c.localId === clientId);
    if (existing?._id) {
      convexDeleteAccountantClient({ clientId: existing._id })
        .catch((err) => console.error('[clients] Convex delete failed:', err));
    }
  };

  const handleAddTeamMember = (member: FirmTeamMember) => {
    setTeamMembers((prev) => [...prev, member]);
  };

  const handleUpdateTeamMember = (updatedMember: FirmTeamMember) => {
    setTeamMembers((prev) =>
      prev.map((m) => (m.id === updatedMember.id ? updatedMember : m))
    );
  };

  const handleDeleteTeamMember = (memberId: string) => {
    setTeamMembers((prev) => prev.filter((m) => m.id !== memberId));
  };

  const handleRunBatchJob = (jobId: string) => {
    setBatchJobs((prev) =>
      prev.map((job) =>
        job.id === jobId
          ? {
              ...job,
              status: 'completed',
              completedAt: new Date().toISOString(),
              clientsProcessed: job.totalClients,
            }
          : job
      )
    );
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#059669', '#10b981', '#34d399'],
    });
  };

  // Auth flow callbacks — declared before render branches to avoid temporal dead zone
  const handleOnboardingComplete = useCallback(
    (
      newBiz: BusinessDetails,
      newEmps: Employee[],
      newAccountType: AccountType,
      importedPayrollRuns?: PayrollRun[]
    ) => {
      const collected = {
        business: newBiz,
        employees: newEmps,
        accountType: newAccountType,
        payrollRuns: importedPayrollRuns,
      };
      setIsOnboardingOpen(false);

      if (currentUser) {
        // Already authenticated — bypass auth screen and persist data directly
        handleAuthComplete(currentUser.uid, currentUser.email!, currentUser.displayName || '', collected);
      } else {
        setPendingOnboardingData(collected);
        setViewMode('auth');
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentUser]
  );

  const handleAuthComplete = useCallback(
    async (uid: string, email: string, displayName: string, directPendingData?: {
      business: BusinessDetails;
      employees: Employee[];
      accountType: AccountType;
      payrollRuns?: PayrollRun[];
    }) => {
      setCurrentUser({ uid, email, displayName });
      setUserName(displayName || email.split('@')[0]);

      const pending = directPendingData ?? pendingOnboardingData;
      setPendingOnboardingData(null);

      let convexUserId: any = null;
      let convexBusinessId: any = null;
      try {
        const accountTypeToSave = pending?.accountType ?? accountType;
        convexUserId = await convexCreateOrUpdateUser({
          firebaseUid: uid,
          email,
          displayName,
          accountType: accountTypeToSave === 'accountant' ? 'accountant' : 'business',
        });
      } catch (_) { /* Convex not yet configured */ }

      if (pending) {
        const { business: newBiz, employees: newEmps, accountType: newAccountType, payrollRuns: importedRuns } = pending;

        setBusiness(newBiz);
        setEmployees(newEmps);
        if (newEmps.length > 0) setSelectedEmployeeId(newEmps[0].id);
        // Set accountType directly — bypasses the paywall check in handleSwitchAccountType
        // which would open checkout instead of setting state during initial onboarding.
        setAccountType(newAccountType as AccountType);

        try {
          if (convexUserId) {
            // Explicitly update accountType in Convex — fixes the race where onAuthStateChanged
            // creates the user with 'business' before handleAuthComplete runs.
            if (newAccountType === 'accountant') {
              await convexUpdateAccountType({ firebaseUid: uid, accountType: 'accountant' }).catch(() => {});
            }

            // Mark onboarding complete NOW (before creating the business) so the
            // auto-onboarding effect can't re-trigger in the gap between user creation
            // and business creation — it checks convexUserData?.onboardingCompleted.
            await convexSetOnboardingCompleted({ firebaseUid: uid }).catch(() => {});

            convexBusinessId = await convexCreateBusiness({
              userId: convexUserId,
              name: newBiz.name,
              address: newBiz.address,
              phone: newBiz.phone,
              email: newBiz.email,
              taxRegistrationId: newBiz.taxRegistrationId,
              nisNumber: newBiz.nisNumber,
              signatoryName: newBiz.signatoryName,
              signatoryTitle: newBiz.signatoryTitle,
              currency: newBiz.currency || 'TTD',
              currencySymbol: newBiz.currencySymbol || '$',
              logo: newBiz.logo,
              signatureUrl: newBiz.signatureUrl,
              templateId: customization.templateId,
              primaryColor: customization.primaryColor,
              accentColor: customization.accentColor,
              showCompanyLogo: customization.showCompanyLogo,
              showSignature: customization.showSignature,
              showYTD: customization.showYTD,
              showBankDetails: customization.showBankDetails,
              showTaxId: customization.showTaxId,
              showQrVerification: customization.showQrVerification,
            });
            if (newEmps.length > 0) {
              await convexBulkCreateEmployees({
                businessId: convexBusinessId,
                userId: convexUserId,
                employees: newEmps,
              });
            }
          }
        } catch (_) { /* Convex not yet configured */ }

        if (importedRuns && importedRuns.length > 0) {
          const latestRun = importedRuns[importedRuns.length - 1];
          setPayrollRun(latestRun);
          setActiveTab('dashboard');

          try {
            if (convexUserId && convexBusinessId) {
              for (const run of importedRuns) {
                await convexCreatePayrollRun({
                  businessId: convexBusinessId,
                  userId: convexUserId,
                  month: run.month || '',
                  year: run.year || new Date().getFullYear(),
                  status: run.status || 'finalized',
                  periodLabel: run.periodLabel,
                  employeesSnapshot: run.employees || [],
                  totalGross: run.grossPay || 0,
                  totalPaye: run.totalPaye || run.totalTax || 0,
                  totalNis: run.totalNis || 0,
                  totalHealthSurcharge: run.totalHealthSurcharge || 0,
                  totalDeductions: run.totalDeductions || 0,
                  totalNet: run.netPay || 0,
                });
              }
            }
          } catch (_) { /* Convex not yet configured */ }

          const welcomeMsg: CaylaMessage = {
            id: `cayla-import-${Date.now()}`,
            sender: 'cayla',
            text: `🎉 **Migration Complete!** I've extracted and imported your payroll data for **${newBiz.name}** with **${newEmps.length} active employees** and **${importedRuns.length} historical payroll cycles** (up to ${latestRun.periodLabel}). All statutory calculations (PAYE, NIS, Health Surcharge) and payslips are calculated and ready in your real workspace.`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          };
          setMessages([welcomeMsg]);
          confetti({
            particleCount: 100,
            spread: 80,
            origin: { y: 0.6 },
            colors: ['#059669', '#10b981', '#34d399', '#6ee7b7'],
          });
        } else {
          if (newAccountType === 'accountant') {
            handleSendMessage('Show my client payroll status');
          } else {
            handleSendMessage('Run payroll for this month');
          }
        }

      }

      // If the user clicked a paid pricing CTA before authenticating, open the
      // Paddle checkout now that we have their verified uid + email.
      if (pendingPlanAfterAuth) {
        const plan = pendingPlanAfterAuth;
        setPendingPlanAfterAuth(null);
        // Route to app first so the dashboard is visible after checkout redirect.
        setViewMode('app');
        navigate('/app');
        // Then open checkout — use uid/email from auth params directly (not from
        // currentUser state which may not have updated yet in this render cycle).
        const origin = window.location.origin;
        const successUrl = `${origin}/app?upgraded=${plan}`;
        createCheckoutSession({
          priceId: PADDLE_PRICE_IDS[plan],
          plan,
          firebaseUid: uid,
          customerEmail: email,
          successUrl,
        }).then((result: any) => {
          if (result?.url) {
            window.location.href = result.url;
          }
        }).catch((err: any) => {
          console.error('[checkout-after-auth] Error:', err);
        });
        return;
      }

      setViewMode('app');
      navigate('/app');
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pendingOnboardingData, accountType, customization, pendingPlanAfterAuth]
  );

  // ── Loading screen: show until Firebase resolves auth on cold load ───────────
  if (!isAuthInitialized) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-600 flex items-center justify-center animate-pulse">
            <span className="text-white font-black text-sm">S</span>
          </div>
          <p className="text-xs text-slate-400 font-medium">Loading Sheetpay…</p>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // Router Branch: Team invitation acceptance (/invite/[token])
  // -------------------------------------------------------------
  if (currentPath.startsWith('/invite/')) {
    return (
      <InviteAcceptPage
        currentUser={
          currentUser
            ? {
                uid: currentUser.uid,
                email: currentUser.email ?? '',
                displayName: currentUser.displayName ?? null,
              }
            : null
        }
        onSignedInRedirect={(path) => {
          setViewMode(path === '/app' ? 'app' : 'landing');
          navigate(path);
        }}
      />
    );
  }

  // -------------------------------------------------------------
  // Router Branch: Dev-only email template preview (/dev/email-preview)
  // -------------------------------------------------------------
  if (currentPath === '/dev/email-preview' && import.meta.env.DEV) {
    return <EmailPreviewPage />;
  }

  // -------------------------------------------------------------
  // Router Branch 0: Admin Console (/admin, /admin/*)
  // -------------------------------------------------------------
  if (currentPath === '/admin' || currentPath.startsWith('/admin/')) {
    return (
      <AdminDashboard
        currentUser={currentUser}
        currentPath={currentPath}
        onNavigate={(path) => {
          if (path === '/app') setViewMode('app');
          else setViewMode('landing');
          navigate(path);
        }}
        onEnsureUser={async (uid, email, name) => {
          try {
            await convexCreateOrUpdateUser({
              firebaseUid: uid,
              email,
              displayName: name,
              accountType: 'business',
            });
          } catch {
            /* Convex not configured — analytics will show unauthorized until reachable */
          }
        }}
      />
    );
  }

  // -------------------------------------------------------------
  // Router Branch 0.5: Payroll Reminders (/payroll/reminders)
  // -------------------------------------------------------------
  if (currentPath === '/payroll/reminders') {
    return (
      <PayrollReminders
        currentUser={currentUser}
        onNavigate={(path) => {
          if (path === '/app') setViewMode('app');
          navigate(path);
        }}
        onOpenCayla={() => {
          setViewMode('app');
          navigate('/app');
          // Cayla is opened from within the app via its normal trigger; the
          // user lands on the workspace and can tap the Cayla button.
        }}
      />
    );
  }

  // -------------------------------------------------------------
  // Router Branch 1: Specific Calculator Page
  // -------------------------------------------------------------
  const calculatorConfig = getCalculatorByPath(currentPath);
  if (calculatorConfig) {
    return (
      <div className="min-h-screen bg-slate-50">
        <CalculatorPage
          config={calculatorConfig}
          onNavigate={navigate}
          onLaunchApp={() => {
            setViewMode('app');
            navigate('/app');
          }}
          onStartOnboarding={() => setIsOnboardingOpen(true)}
        />

        {isOnboardingOpen && (
          <OnboardingFlow
            initialBusiness={business}
            initialEmployees={visibleEmployees}
            initialAccountType={accountType}
            onComplete={handleOnboardingComplete}
            onCancel={() => setIsOnboardingOpen(false)}
          />
        )}
      </div>
    );
  }

  // -------------------------------------------------------------
  // Router Branch 2: Master Calculator Hub (/calculators)
  // -------------------------------------------------------------
  if (currentPath === '/calculators') {
    return (
      <div className="min-h-screen bg-slate-50">
        <CalculatorHub
          onNavigate={navigate}
          onLaunchApp={() => {
            setViewMode('app');
            navigate('/app');
          }}
          onStartOnboarding={() => setIsOnboardingOpen(true)}
        />

        {isOnboardingOpen && (
          <OnboardingFlow
            initialBusiness={business}
            initialEmployees={visibleEmployees}
            initialAccountType={accountType}
            onComplete={handleOnboardingComplete}
            onCancel={() => setIsOnboardingOpen(false)}
          />
        )}
      </div>
    );
  }

  // -------------------------------------------------------------
  // Router Branch 3: Country Hubs
  // -------------------------------------------------------------
  const countryHubMap: Record<string, CountryCode> = {
    '/trinidad-and-tobago': 'TT',
    '/barbados': 'BB',
    '/saint-lucia': 'LC',
    '/belize': 'BZ',
  };

  const matchedCountry = countryHubMap[currentPath];
  if (matchedCountry) {
    return (
      <div className="min-h-screen bg-slate-50">
        <CountryHub
          countryCode={matchedCountry}
          onNavigate={navigate}
          onLaunchApp={() => {
            setViewMode('app');
            navigate('/app');
          }}
          onStartOnboarding={() => setIsOnboardingOpen(true)}
        />

        {isOnboardingOpen && (
          <OnboardingFlow
            initialBusiness={business}
            initialEmployees={visibleEmployees}
            initialAccountType={accountType}
            onComplete={handleOnboardingComplete}
            onCancel={() => setIsOnboardingOpen(false)}
          />
        )}
      </div>
    );
  }

  // -------------------------------------------------------------
  // Router Branch 4: Legal & Trust Pages (/privacy-policy, /terms-of-service, /refund-policy, /security, /compliance, /contact)
  // -------------------------------------------------------------
  const legalDoc = getLegalDocumentByPath(currentPath);
  if (legalDoc) {
    return (
      <div className="min-h-screen bg-slate-50">
        <LegalPage
          document={legalDoc}
          onNavigate={navigate}
          onLaunchApp={() => {
            setViewMode('app');
            navigate('/app');
          }}
          onStartOnboarding={() => setIsOnboardingOpen(true)}
        />

        {isOnboardingOpen && (
          <OnboardingFlow
            initialBusiness={business}
            initialEmployees={visibleEmployees}
            initialAccountType={accountType}
            onComplete={handleOnboardingComplete}
            onCancel={() => setIsOnboardingOpen(false)}
          />
        )}
      </div>
    );
  }

  const handleUpdateCustomization = (c: Partial<PayslipCustomization>) => {
    setCustomization((prev) => {
      const next = { ...prev, ...c };
      if (convexBusinessData?._id) {
        convexUpdateBusiness({
          businessId: convexBusinessData._id,
          templateId: next.templateId,
          primaryColor: next.primaryColor,
          accentColor: next.accentColor,
          showCompanyLogo: next.showCompanyLogo,
          showSignature: next.showSignature,
          showYTD: next.showYTD,
          showBankDetails: next.showBankDetails,
          showTaxId: next.showTaxId,
          showQrVerification: next.showQrVerification,
        }).catch((e) => console.error('[customization] Convex update failed:', e));
      }
      return next;
    });
  };

  const handleLogout = async () => {
    await signOut(auth).catch(() => {});
    setCurrentUser(null);
    // Clear all user-specific state so a subsequent login with a different
    // account never sees another user's data.
    setBusiness(initialBusinessDetails);
    setCustomization(defaultPayslipCustomization);
    setEmployees(initialEmployees);
    setPayrollRun(null);
    setClients([]);
    setTeamMembers([]);
    setBatchJobs([]);
    setAttentionItems([]);
    setMessages([]);
    setAuditLogs([]);
    setUserName('User');
    setUserAvatar('');
    dataRestoredRef.current = false;
    hasRoutedAfterLoginRef.current = false;
    payrollRunRestoredRef.current = false;
    clientsRestoredRef.current = false;
    setPendingPlanAfterAuth(null);
    setViewMode('landing');
    if (window.location.pathname !== '/') {
      navigate('/');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenCheckout = async (checkoutPlan: 'pro' | 'accountant') => {
    // If the user is not signed in, save the plan and route to auth first.
    // After sign-in/sign-up, handleAuthComplete will open checkout automatically.
    if (!currentUser) {
      setPendingPlanAfterAuth(checkoutPlan);
      setAuthMode('signup');
      setViewMode('auth');
      return;
    }

    // Prevent duplicate sessions from rapid clicks.
    if (isCheckoutLoading) return;
    setIsCheckoutLoading(true);

    try {
      const origin = window.location.origin;
      const successUrl = `${origin}/app?upgraded=${checkoutPlan}`;

      // Carry over the guest session id when relevant (guest→paid migration).
      let guestSessionId: string | null = null;
      try {
        guestSessionId =
          (window as any).__sheetpayGuestSessionId ||
          window.sessionStorage.getItem('sheetpay_guest_session_id') ||
          window.sessionStorage.getItem('sheetpay_guest_session_id_hint');
      } catch { /* sessionStorage unavailable */ }

      const result = await createCheckoutSession({
        priceId: PADDLE_PRICE_IDS[checkoutPlan],
        plan: checkoutPlan,
        firebaseUid: currentUser.uid,
        customerEmail: currentUser.email,
        successUrl,
      });

      if (result?.url) {
        // Navigate in the same tab — avoids popup-blocker issues and works on mobile.
        // The Paddle success_url redirects back to /app?upgraded=... automatically.
        window.location.href = result.url;
      } else {
        console.error('[checkout] No URL returned from Paddle', result);
        alert('Could not open checkout. Please try again.');
      }
    } catch (err) {
      console.error('[checkout] Error:', err);
      const msg = err instanceof Error ? err.message : String(err);
      alert(`Checkout error: ${msg}`);
    } finally {
      setIsCheckoutLoading(false);
    }
  };

  // -------------------------------------------------------------
  // -------------------------------------------------------------
  // Router Branch 4.4: Guest Accountant Dashboard (/try-accountant-dashboard)
  //
  // Public, unauthenticated preview of the REAL accountant dashboard. Enforces
  // guest limits (1 client, 50 employees, 1 payroll run) via the guest shell
  // and convex/guestDashboard.ts. Never break /app or /accountants.
  // -------------------------------------------------------------
  if (currentPath === '/try-accountant-dashboard' || currentPath === '/accountant-dashboard') {
    return (
      <GuestAccountantExperience
        onNavigate={navigate}
        onSignIn={() => {
          setAuthMode('signin');
          setViewMode('auth');
        }}
        onUnlock={(plan, guestSessionId) => {
          // The Paddle webhook (convex/paddle_webhook.ts, follow-up task) will
          // look up the guestSessions row by this id in custom_data and copy
          // the client/employees/payroll into the paying user's real tables.
          try {
            (window as any).__sheetpayGuestSessionId = guestSessionId;
            window.sessionStorage.setItem('sheetpay_guest_session_id_hint', guestSessionId);
          } catch {
            /* ignore */
          }
          // Paddle only distinguishes monthly/yearly on the price id; the
          // entitlement plan itself remains 'accountant'. Once a yearly price
          // is provisioned, add it to PADDLE_PRICE_IDS and pass it through here.
          handleOpenCheckout('accountant');
        }}
      />
    );
  }

  // Router Branch 4.5: legacy /accountants — replaced by the guest dashboard
  // funnel above. Route kept as a permanent redirect so any backlinks (docs,
  // ads, referrals, email footers) land on the new experience.
  // -------------------------------------------------------------
  if (currentPath === '/accountants') {
    if (typeof window !== 'undefined') {
      window.history.replaceState({}, '', '/try-accountant-dashboard');
    }
    return (
      <GuestAccountantExperience
        onNavigate={navigate}
        onSignIn={() => {
          setAuthMode('signin');
          setViewMode('auth');
        }}
        onUnlock={(_plan, guestSessionId) => {
          try {
            (window as any).__sheetpayGuestSessionId = guestSessionId;
            window.sessionStorage.setItem('sheetpay_guest_session_id_hint', guestSessionId);
          } catch {
            /* ignore */
          }
          handleOpenCheckout('accountant');
        }}
      />
    );
  }

  // -------------------------------------------------------------
  // Router Branch 5a: Auth Screen (after onboarding completes)
  // -------------------------------------------------------------
  if (viewMode === 'auth') {
    return (
      <AuthScreen
        onAuthComplete={handleAuthComplete}
        onBack={() => {
          setPendingPlanAfterAuth(null);
          setPendingOnboardingData(null);
          setViewMode('landing');
          navigate('/');
        }}
        defaultMode={authMode === 'signin' ? 'signin' : 'signup'}
      />
    );
  }

  // -------------------------------------------------------------
  // Router Branch 5: Landing Page (Default if not in /app or when viewMode is landing)
  // -------------------------------------------------------------
  if (viewMode === 'landing' || currentPath === '/') {
    return (
      <div className="min-h-screen bg-white">
        <LandingPage
          onNavigate={navigate}
          onLaunchApp={() => {
            setViewMode('app');
            navigate('/app');
          }}
          onStartOnboarding={() => setIsOnboardingOpen(true)}
          onChoosePlan={handleOpenCheckout}
          onLogin={() => {
            setAuthMode('signin');
            setViewMode('auth');
          }}
        />

        {isOnboardingOpen && (
          <OnboardingFlow
            initialBusiness={business}
            initialEmployees={visibleEmployees}
            initialAccountType={accountType}
            onComplete={handleOnboardingComplete}
            onCancel={() => setIsOnboardingOpen(false)}
          />
        )}
      </div>
    );
  }

  const activeClientObj = clients.find((c) => c.id === activeClientId);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col md:flex-row antialiased selection:bg-emerald-500/20">
      {/* Desktop Persistent Left Sidebar */}
      <Sidebar
        activeTab={activeTab}
        onTabChange={(tab) => {
          setActiveTab(tab);
          if (tab === 'cayla' || tab === 'dashboard' || tab === 'accountant_dashboard') {
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }
        }}
        isPayrollActive={payrollRun !== null}
        onOpenCayla={() => {
          if (accountType === 'accountant') {
            setActiveTab('accountant_dashboard');
          } else {
            setActiveTab('dashboard');
          }
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        accountType={accountType}
        clientsCount={clients.length}
        employeesCount={employees.length}
        activeClientName={activeClientObj?.companyName || business.name}
        onOpenBatchPayroll={() => setIsBatchModalOpen(true)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <Header
          userName={userName}
          userAvatar={userAvatar}
          onUpdateAvatar={setUserAvatar}
          onUpdateUserName={setUserName}
          business={business}
          onSwitchBusiness={(name) => setBusiness((prev) => ({ ...prev, name }))}
          auditCount={auditLogs.length}
          onOpenAudit={() => setIsAuditModalOpen(true)}
          onOpenLanding={handleLogout}
          onOpenOnboarding={() => setIsOnboardingOpen(true)}
          accountType={accountType}
          accountantClients={clients}
          activeClientId={activeClientId}
          onSelectClient={(cId) => handleSelectClient(cId)}
          onOpenAddClientModal={() => setIsAddClientOpen(true)}
          onSwitchAccountType={handleSwitchAccountType}
          activeTab={activeTab}
          onTabChange={(tab) => {
            setActiveTab(tab);
            if (tab === 'dashboard' || tab === 'accountant_dashboard' || tab === 'cayla') {
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }
          }}
          onOpenBatchPayroll={() => setIsBatchModalOpen(true)}
        />

        {/* Tab Routing Router */}
        <main className="flex-1 flex flex-col pb-24 md:pb-12">
          {/* Upgrade to Pro banner (business accounts) — reactively reflects Convex plan */}
          {accountType === 'business' && (isPro || !bannerDismissed) && (
            <UpgradeBanner
              plan={plan}
              planStatus={entitlement?.planStatus}
              onUpgrade={handleOpenCheckout}
              onDismiss={() => setBannerDismissed(true)}
            />
          )}

          {/* ACCOUNTANT TAB 1: Accountant Dashboard */}
          {accountType === 'accountant' && activeTab === 'accountant_dashboard' && (
            <AccountantDashboard
              userName={userName}
              firebaseUid={currentUser?.uid}
              clients={clients}
              teamMembers={teamMembers}
              batchJobs={batchJobs}
              attentionItems={attentionItems}
              activeClient={activeClientObj || null}
              onSelectClient={(cId) => handleSelectClient(cId, 'dashboard')}
              onOpenAddClient={() => setIsAddClientOpen(true)}
              onOpenBatchPayroll={() => setIsBatchModalOpen(true)}
              onOpenInviteClient={(c) => setInviteModalClient(c)}
              onAddNewClient={handleAddClient}
              onUpdateClients={(updated) => {
                setClients(updated);
                // Persist each updated client to Convex
                updated.forEach((updatedClient) => {
                  const existing = convexAccountantClientsData?.find((c: any) => c.localId === updatedClient.id);
                  if (existing?._id) {
                    convexUpdateAccountantClient({
                      clientId: existing._id,
                      name: updatedClient.name,
                      companyName: updatedClient.companyName,
                      country: updatedClient.country,
                      countryCode: updatedClient.countryCode,
                      currency: updatedClient.currency,
                      currencySymbol: updatedClient.currencySymbol,
                      payFrequency: updatedClient.payFrequency,
                      employeeCount: updatedClient.employeeCount,
                      nextPayrollDate: updatedClient.nextPayrollDate,
                      payrollStatus: updatedClient.payrollStatus,
                      monthlyPayrollValue: updatedClient.monthlyPayrollValue,
                      employeesJson: updatedClient.employees?.length ? JSON.stringify(updatedClient.employees) : undefined,
                      payrollRunJson: updatedClient.payrollRun ? JSON.stringify(updatedClient.payrollRun) : undefined,
                      payrollRunsJson: updatedClient.payrollRuns?.length ? JSON.stringify(updatedClient.payrollRuns) : undefined,
                    }).catch((e: any) => console.error('[clients] bulk update failed:', e));
                  }
                });
              }}
              messages={messages}
              onSendMessage={handleSendMessage}
              isProcessing={isProcessing}
              onQuickExecuteCayla={(prompt) => {
                handleSendMessage(prompt);
              }}
            />
          )}

          {/* ACCOUNTANT TAB 2: Clients Directory */}
          {accountType === 'accountant' && activeTab === 'accountant_clients' && (
            <ClientsView
              clients={clients}
              teamMembers={teamMembers}
              onSelectClient={(cId) => handleSelectClient(cId, 'dashboard')}
              onAddClient={() => setIsAddClientOpen(true)}
              onUpdateClient={handleUpdateClient}
              onDeleteClient={handleDeleteClient}
              onInviteClient={(c) => setInviteModalClient(c)}
            />
          )}

          {/* ACCOUNTANT TAB 3: Firm Team & Permissions */}
          {accountType === 'accountant' && activeTab === 'accountant_team' && (
            <AccountantTeamView
              teamMembers={teamMembers}
              clients={clients}
              onAddMember={handleAddTeamMember}
              onUpdateMember={handleUpdateTeamMember}
              onDeleteMember={handleDeleteTeamMember}
            />
          )}

          {/* ACCOUNTANT TAB 4: Portfolio Reports */}
          {accountType === 'accountant' && activeTab === 'accountant_reports' && (
            <AccountantReportsView
              clients={clients}
              onSelectClient={(cId) => handleSelectClient(cId, 'dashboard')}
            />
          )}

          {/* TAB: Dashboard / Cayla (Cayla transcript + dynamic payroll table) - Only for Single Business Account */}
          {accountType === 'business' && (activeTab === 'dashboard' || activeTab === 'cayla') && (
            <>
              {/* Main Hero with Cayla Transcript */}
              <CaylaTranscript
                messages={messages}
                onSendMessage={handleSendMessage}
                isProcessing={isProcessing}
                onUndo={handleUndo}
                onConfirmAction={handleConfirmFinalize}
                onCancelAction={() => {}}
                onOpenUpload={(type) => {
                  if (type === 'timesheet') setIsTimesheetModalOpen(true);
                }}
                isPayrollActive={payrollRun !== null}
                pendingConfirmation={pendingCaylaConfirmation ?? undefined}
                onCaylaConfirm={handleCaylaConfirm}
                onCaylaCancel={handleCaylaCancel}
              />

              {/* Dynamically Generated Payroll Workspace */}
              {payrollRun && (
                <>
                  {/* Desktop View */}
                  <div className="hidden md:block">
                    <PayrollWorkspace
                      payroll={payrollRun}
                      selectedEmployeeId={selectedEmployeeId}
                      onSelectEmployee={setSelectedEmployeeId}
                      onUpdateEmployee={handleUpdateEmployee}
                      onFinalizePayroll={handleConfirmFinalize}
                      onOpenAudit={() => setIsAuditModalOpen(true)}
                      business={business}
                      customization={customization}
                      onUpdateCustomization={handleUpdateCustomization}
                      onOpenEmailModal={(emp) => setEmailModalEmployee(emp)}
                      onOpenBusinessEditModal={() => setIsBusinessModalOpen(true)}
                    />
                  </div>

                  {/* Mobile View */}
                  <div className="md:hidden">
                    <MobilePayrollCards
                      payroll={payrollRun}
                      onSelectEmployee={setSelectedEmployeeId}
                      onViewPayslipModal={(emp) => setMobilePayslipEmployee(emp)}
                      onUpdateEmployee={handleUpdateEmployee}
                    />
                  </div>
                </>
              )}
            </>
          )}

          {/* TAB: Employees Directory */}
          {activeTab === 'employees' && (
            <EmployeesView
              employees={visibleEmployees}
              onUpdateEmployee={handleUpdateEmployee}
              onAddEmployee={handleAddEmployee}
              onDeleteEmployee={handleDeleteEmployee}
              onViewPayslip={(emp) => {
                setSelectedEmployeeId(emp.id);
                setActiveTab('payslips');
              }}
            />
          )}

          {/* TAB: Payroll Runs */}
          {activeTab === 'payroll_runs' && (
            <PayrollRunsView
              currentPayroll={payrollRun}
              business={business}
              onOpenRun={(run) => {
                setPayrollRun(run);
                setActiveTab('dashboard');
              }}
              onFinalizeCurrent={handleConfirmFinalize}
              onOpenCayla={() => {
                setActiveTab('dashboard');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            />
          )}

          {/* TAB: Payslips Customizer & Batch Portal */}
          {activeTab === 'payslips' && (
            <PayslipsPortalView
              payroll={payrollRun}
              employees={visibleEmployees}
              business={business}
              customization={customization}
              onUpdateCustomization={handleUpdateCustomization}
              onOpenEmailModal={(emp) => setEmailModalEmployee(emp)}
              onOpenBusinessEditModal={() => setIsBusinessModalOpen(true)}
            />
          )}

          {/* TAB: Tax Forms (TD4 / NIB / Health Surcharge) */}
          {activeTab === 'tax_forms' && (
            <TaxFormsView
              employees={visibleEmployees}
              business={business}
              currentPayroll={payrollRun}
              onOpenCayla={() => {
                setActiveTab('dashboard');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            />
          )}

          {/* TAB: Reports & Analytics (Pro feature for single-business accounts) */}
          {activeTab === 'reports' && (
            accountType === 'business' ? (
              <ProGate
                isPro={isPro}
                title="Advanced Reports & Analytics"
                description="Payroll trends, statutory summaries, and export-ready analytics are part of Business Pro."
                features={[
                  'Monthly payroll trend charts',
                  'PAYE / NIS / Health Surcharge summaries',
                  'Export-ready statutory reports',
                ]}
                onUpgrade={handleOpenCheckout}
              >
                <ReportsView
                  employees={visibleEmployees}
                  business={business}
                  currentPayroll={payrollRun}
                />
              </ProGate>
            ) : (
              <ReportsView
                employees={visibleEmployees}
                business={business}
                currentPayroll={payrollRun}
              />
            )
          )}

          {/* TAB: Attendance & Biometric Timesheets */}
          {activeTab === 'attendance' && (
            <AttendanceView
              employees={visibleEmployees}
              onUpdateEmployee={handleUpdateEmployee}
              onOpenTimesheetModal={() => setIsTimesheetModalOpen(true)}
            />
          )}

          {/* TAB: Organization & Statutory Settings */}
          {activeTab === 'settings' && (
            <SettingsView
              business={business}
              onSaveBusiness={(b) => {
                setBusiness(b);
                if (convexBusinessData?._id) {
                  convexUpdateBusiness({
                    businessId: convexBusinessData._id,
                    name: b.name, address: b.address, phone: b.phone, email: b.email,
                    website: b.website, taxRegistrationId: b.taxRegistrationId,
                    nisNumber: b.nisNumber, signatoryName: b.signatoryName,
                    signatoryTitle: b.signatoryTitle, currency: b.currency,
                    currencySymbol: b.currencySymbol, logo: b.logo,
                    signatureUrl: b.signatureUrl,
                  }).catch((e) => console.error('[business] settings save failed:', e));
                }
              }}
              accountType={accountType}
              onSwitchAccountType={handleSwitchAccountType}
              onLogout={handleLogout}
              onUpgrade={handleOpenCheckout}
              plan={plan}
              isPro={isPro}
              currentUid={currentUser?.uid}
              onImportData={(newBiz, newEmps, importedRuns) => {
                setBusiness(newBiz);
                setEmployees(newEmps);
                if (newEmps.length > 0) {
                  setSelectedEmployeeId(newEmps[0].id);
                }
                if (importedRuns && importedRuns.length > 0) {
                  const latestRun = importedRuns[importedRuns.length - 1];
                  setPayrollRun(latestRun);
                  setActiveTab('dashboard');

                  const welcomeMsg: CaylaMessage = {
                    id: `cayla-import-settings-${Date.now()}`,
                    sender: 'cayla',
                    text: `🎉 **Payroll Archive Successfully Migrated!** I've updated your workspace with **${newBiz.name}**, **${newEmps.length} employees**, and **${importedRuns.length} historical payroll cycles** (up to ${latestRun.periodLabel}).`,
                    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                  };
                  setMessages([welcomeMsg]);
                  confetti({
                    particleCount: 80,
                    spread: 70,
                    origin: { y: 0.6 },
                    colors: ['#059669', '#10b981', '#34d399'],
                  });
                }
              }}
            />
          )}
        </main>
      </div>

      {/* Floating Cayla Quick Command Button */}
      {showFloatingBar && (
        <div className="fixed bottom-20 md:bottom-6 right-6 z-40 flex items-center gap-2 animate-in fade-in zoom-in-95">
          {showFloatingCayla ? (
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 p-3 flex items-center gap-2 w-80 md:w-96 animate-in fade-in slide-in-from-right-4">
              <CaylaPenMascot size="xs" />
              <input
                type="text"
                value={floatingInput}
                onChange={(e) => setFloatingInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && floatingInput.trim()) {
                    handleSendMessage(floatingInput.trim());
                    setFloatingInput('');
                    setShowFloatingCayla(false);
                  }
                }}
                placeholder={accountType === 'accountant' ? 'Ask cross-client Cayla...' : 'Ask Cayla anything...'}
                autoFocus
                className="flex-1 text-xs bg-transparent border-none focus:outline-none text-slate-800 placeholder:text-slate-400"
              />
              <button
                onClick={() => {
                  if (floatingInput.trim()) {
                    handleSendMessage(floatingInput.trim());
                    setFloatingInput('');
                    setShowFloatingCayla(false);
                  }
                }}
                className="p-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 cursor-pointer"
              >
                <ArrowUp className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setShowFloatingCayla(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              id="floating-cayla-trigger-btn"
              onClick={() => setShowFloatingCayla(true)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-full p-2 sm:p-2.5 shadow-xl shadow-emerald-600/30 flex items-center gap-2 text-xs font-semibold transform hover:scale-105 transition-all cursor-pointer ring-2 ring-white"
            >
              <CaylaPenMascot size="xs" />
              <span className="hidden sm:inline font-bold">Ask Cayla</span>
            </button>
          )}
        </div>
      )}

      {/* Dedicated Mobile Floating Bottom Pill Navigation */}
      <MobileBottomNav
        activeTab={activeTab}
        onTabChange={(tab) => {
          setActiveTab(tab);
          if (tab === 'dashboard' || tab === 'accountant_dashboard' || tab === 'cayla') {
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }
        }}
        onCaylaClick={() => {
          window.scrollTo({ top: 0, behavior: 'smooth' });
          setShowFloatingCayla(true);
        }}
        accountType={accountType}
        onOpenBatchPayroll={() => setIsBatchModalOpen(true)}
        clientsCount={clients.length}
        onOpenLanding={handleLogout}
      />

      {/* Mobile Fullscreen Payslip Modal */}
      {payrollRun && (
        <MobilePayslipModal
          isOpen={mobilePayslipEmployee !== null}
          onClose={() => setMobilePayslipEmployee(null)}
          employee={mobilePayslipEmployee || payrollRun.employees[0]}
          allEmployees={payrollRun.employees}
          onSelectEmployee={(emp) => setMobilePayslipEmployee(emp)}
          payroll={payrollRun}
          business={business}
          customization={customization}
          onUpdateCustomization={handleUpdateCustomization}
          onOpenEmailModal={(emp) => setEmailModalEmployee(emp)}
          onOpenBusinessEditModal={() => setIsBusinessModalOpen(true)}
        />
      )}

      {/* Accountant Specific Modals */}
      <AddClientModal
        isOpen={isAddClientOpen}
        onClose={() => setIsAddClientOpen(false)}
        onAddClient={handleAddClient}
        teamMembers={teamMembers}
      />

      <ClientInviteModal
        isOpen={inviteModalClient !== null}
        onClose={() => setInviteModalClient(null)}
        client={inviteModalClient}
      />

      <BatchPayrollModal
        isOpen={isBatchModalOpen}
        onClose={() => setIsBatchModalOpen(false)}
        clients={clients}
        onRunBatch={(selectedClientIds, period) => {
          const newBatchJob: BatchPayrollJob = {
            id: `batch-${Date.now()}`,
            name: `${period} Batch Run`,
            periodLabel: period,
            clientIds: selectedClientIds,
            status: 'completed',
            createdAt: new Date().toISOString(),
            completedAt: new Date().toISOString(),
            totalClients: selectedClientIds.length,
            clientsProcessed: selectedClientIds.length,
            errorsCount: 0,
          };
          setBatchJobs((prev) => [newBatchJob, ...prev]);
          setIsBatchModalOpen(false);
          confetti({
            particleCount: 80,
            spread: 70,
            origin: { y: 0.6 },
            colors: ['#059669', '#10b981', '#34d399'],
          });
        }}
      />

      {/* Supporting Modals */}
      <AuditTrailModal
        isOpen={isAuditModalOpen}
        onClose={() => setIsAuditModalOpen(false)}
        logs={auditLogs}
      />

      <TimesheetUploadModal
        isOpen={isTimesheetModalOpen}
        onClose={() => setIsTimesheetModalOpen(false)}
        onApplyTimesheetData={handleApplyTimesheetData}
      />

      <EmailPayslipModal
        isOpen={emailModalEmployee !== null}
        onClose={() => setEmailModalEmployee(null)}
        employee={emailModalEmployee}
        onSendEmail={handleSendEmail}
      />

      <BusinessEditModal
        isOpen={isBusinessModalOpen}
        onClose={() => setIsBusinessModalOpen(false)}
        business={business}
        onSave={(b) => {
          setBusiness(b);
          if (convexBusinessData?._id) {
            convexUpdateBusiness({
              businessId: convexBusinessData._id,
              name: b.name, address: b.address, phone: b.phone, email: b.email,
              website: b.website, taxRegistrationId: b.taxRegistrationId,
              nisNumber: b.nisNumber, signatoryName: b.signatoryName,
              signatoryTitle: b.signatoryTitle, currency: b.currency,
              currencySymbol: b.currencySymbol, logo: b.logo,
              signatureUrl: b.signatureUrl,
            }).catch((e) => console.error('[business] modal save failed:', e));
          }
        }}
      />

      {isOnboardingOpen && (
        <OnboardingFlow
          initialBusiness={business}
          initialEmployees={visibleEmployees}
          initialAccountType={accountType}
          onComplete={handleOnboardingComplete}
          onCancel={() => setIsOnboardingOpen(false)}
        />
      )}

      {/* Nia support widget — authenticated mode inside the app.
          Positioned bottom-24 on mobile so it sits above the pill nav. */}
      <NiaWidget
        variant="app"
        currentUid={currentUser?.uid}
        currentPage={activeTab}
        defaultContactName={currentUser?.displayName}
        defaultContactEmail={currentUser?.email}
      />
    </div>
  );
}
