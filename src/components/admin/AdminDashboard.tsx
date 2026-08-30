import React, { useState } from 'react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
} from 'firebase/auth';
import { useQuery } from 'convex/react';
import { auth } from '../../lib/firebase';
import { api } from '../../../convex/_generated/api';
import { isAdminEmail, ADMIN_EMAILS } from '../../lib/admin';
import { CaylaPenMascot } from '../CaylaPenMascot';
import {
  AdminUsersView,
  AdminSubscriptionsView,
  AdminRevenueView,
  AdminGaAnalyticsView,
  AdminSeoView,
  AdminPayrollView,
  AdminCaylaView,
  AdminSystemView,
  AdminSupportView,
} from './sections';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import {
  Lock,
  Mail,
  Eye,
  EyeOff,
  ArrowLeft,
  Users,
  CreditCard,
  DollarSign,
  TrendingUp,
  ShieldCheck,
  LogOut,
  RefreshCw,
  Crown,
  LayoutDashboard,
  Receipt,
  BarChart3,
  Search,
  Wallet,
  Bot,
  ActivitySquare,
  HeadphonesIcon,
} from 'lucide-react';

interface AdminDashboardProps {
  currentUser: { uid: string; email: string; displayName: string } | null;
  currentPath: string;
  onNavigate: (path: string) => void;
  onEnsureUser: (uid: string, email: string, displayName: string) => Promise<void>;
}

type AdminSection =
  | 'overview'
  | 'users'
  | 'subscriptions'
  | 'revenue'
  | 'analytics'
  | 'seo'
  | 'payroll'
  | 'cayla'
  | 'system'
  | 'support';

const NAV: { section: AdminSection; label: string; path: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { section: 'overview', label: 'Overview', path: '/admin', icon: LayoutDashboard },
  { section: 'users', label: 'Users', path: '/admin/users', icon: Users },
  { section: 'subscriptions', label: 'Subscriptions', path: '/admin/subscriptions', icon: Receipt },
  { section: 'revenue', label: 'Revenue', path: '/admin/revenue', icon: DollarSign },
  { section: 'analytics', label: 'Analytics', path: '/admin/analytics', icon: BarChart3 },
  { section: 'seo', label: 'SEO', path: '/admin/seo', icon: Search },
  { section: 'payroll', label: 'Payroll', path: '/admin/payroll', icon: Wallet },
  { section: 'cayla', label: 'Cayla', path: '/admin/cayla', icon: Bot },
  { section: 'system', label: 'System', path: '/admin/system', icon: ActivitySquare },
  { section: 'support', label: 'Support', path: '/admin/support', icon: HeadphonesIcon },
];

function sectionForPath(path: string): AdminSection {
  const tail = path.replace(/^\/admin\/?/, '');
  const found = NAV.find((n) => n.section === tail);
  return found ? found.section : 'overview';
}

const money = (n: number) => `$${(n || 0).toLocaleString('en-US')}`;
const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  currentUser,
  currentPath,
  onNavigate,
  onEnsureUser,
}) => {
  const isAdmin = isAdminEmail(currentUser?.email);
  const section = sectionForPath(currentPath);

  // Analytics query (returns { authorized:false } for non-admins)
  const analytics = useQuery(
    (api as any).admin.getAnalytics,
    isAdmin && section === 'overview' ? { requesterUid: currentUser?.uid } : 'skip'
  ) as any;

  // ── Admin login gate ────────────────────────────────────────────────────────
  const [email, setEmail] = useState(ADMIN_EMAILS[0] ?? '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [noAccount, setNoAccount] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfo('');
    if (!isAdminEmail(email)) {
      setError('This email is not authorized for admin access.');
      return;
    }
    setIsLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
      const signedEmail = cred.user.email || email;
      if (!isAdminEmail(signedEmail)) {
        await signOut(auth);
        setError('This account is not authorized for admin access.');
        return;
      }
      // Ensure a Convex user row exists so analytics authorization succeeds.
      await onEnsureUser(
        cred.user.uid,
        signedEmail,
        cred.user.displayName || signedEmail.split('@')[0]
      ).catch(() => {});
      // App's auth listener will flip currentUser → dashboard renders.
    } catch (err: any) {
      const code = err?.code as string | undefined;
      if (code === 'auth/user-not-found' || code === 'auth/invalid-credential') {
        // No Firebase account exists for this allowlisted email yet — offer
        // to create it in-place so the founder can bootstrap without leaving
        // this screen.
        setNoAccount(true);
        setError('No admin account exists for this email yet. Set a password to create it.');
      } else if (code === 'auth/wrong-password') {
        setError('Incorrect password. Use "Forgot password?" to reset it.');
      } else if (code === 'auth/too-many-requests') {
        setError('Too many attempts. Please try again later.');
      } else {
        setError('Sign in failed. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateAccount = async () => {
    setError('');
    setInfo('');
    if (!isAdminEmail(email)) {
      setError('This email is not authorized for admin access.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    setIsLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      const signedEmail = cred.user.email || email;
      await onEnsureUser(
        cred.user.uid,
        signedEmail,
        cred.user.displayName || signedEmail.split('@')[0]
      ).catch(() => {});
      setNoAccount(false);
      // Auth listener will render the dashboard.
    } catch (err: any) {
      const code = err?.code as string | undefined;
      if (code === 'auth/email-already-in-use') {
        // Account exists after all — go back to the normal sign-in path.
        setNoAccount(false);
        setError('An account with this email already exists. Enter its password, or use "Forgot password?".');
      } else if (code === 'auth/weak-password') {
        setError('Password must be at least 6 characters.');
      } else {
        setError('Could not create admin account. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    setError('');
    setInfo('');
    if (!isAdminEmail(email)) {
      setError('Enter your admin email first.');
      return;
    }
    setIsLoading(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setInfo(`Password reset link sent to ${email.trim()}. Check your inbox (and spam folder).`);
    } catch (err: any) {
      const code = err?.code as string | undefined;
      if (code === 'auth/user-not-found') {
        setNoAccount(true);
        setError('No admin account exists for this email yet. Set a password below to create it.');
      } else if (code === 'auth/too-many-requests') {
        setError('Too many attempts. Please try again later.');
      } else {
        setError('Could not send reset email. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden">
          <div className="bg-slate-900 text-white px-6 py-5 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <div className="font-black text-sm">Sheetpay Admin</div>
              <div className="text-[11px] text-slate-400">Restricted analytics console</div>
            </div>
          </div>

          <form onSubmit={handleLogin} className="p-6 sm:p-8 space-y-4">
            <div className="text-center space-y-1 mb-2">
              <div className="w-14 h-14 rounded-2xl bg-slate-900 text-white flex items-center justify-center mx-auto">
                <Lock className="w-6 h-6" />
              </div>
              <h2 className="text-lg font-black text-slate-900 pt-2">Admin sign in</h2>
              <p className="text-xs text-slate-500">Authorized administrators only.</p>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">Admin Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:border-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700">
                  {noAccount ? 'Set Password (min. 6 characters)' : 'Password'}
                </label>
                {!noAccount && (
                  <button
                    type="button"
                    onClick={handleForgotPassword}
                    disabled={isLoading || !email}
                    className="text-[11px] text-emerald-700 font-bold hover:underline disabled:opacity-50 cursor-pointer"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete={noAccount ? 'new-password' : 'current-password'}
                  className="w-full pl-9 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:border-emerald-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-semibold">
                {error}
              </div>
            )}

            {info && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-semibold">
                {info}
              </div>
            )}

            {noAccount ? (
              <button
                type="button"
                onClick={handleCreateAccount}
                disabled={isLoading || !email || password.length < 6}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2 cursor-pointer"
              >
                {isLoading ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>Create Admin Account</span>
                  </>
                )}
              </button>
            ) : (
              <button
                type="submit"
                disabled={isLoading || !email || !password}
                className="w-full py-3 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2 cursor-pointer"
              >
                {isLoading ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>Enter Admin Console</span>
                  </>
                )}
              </button>
            )}

            <button
              type="button"
              onClick={() => onNavigate('/')}
              className="w-full text-center text-xs font-bold text-slate-500 hover:text-slate-700 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to site
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ── Authorized admin view ───────────────────────────────────────────────────
  const loading = analytics === undefined;
  const unauthorized = analytics && analytics.authorized === false;

  const t = analytics?.totals;
  const planData = analytics
    ? [
        { name: 'Free', value: analytics.byPlan?.free ?? 0, color: '#94a3b8' },
        { name: 'Pro', value: analytics.byPlan?.pro ?? 0, color: '#10b981' },
        { name: 'Accountant', value: analytics.byPlan?.accountant ?? 0, color: '#0d9488' },
      ]
    : [];

  const kpis = [
    { label: 'Total Users', value: t?.totalUsers ?? 0, icon: Users, tint: 'bg-slate-100 text-slate-700' },
    { label: 'Paid Users', value: t?.paidUsers ?? 0, icon: CreditCard, tint: 'bg-emerald-100 text-emerald-700' },
    { label: 'Free Users', value: t?.freeUsers ?? 0, icon: Users, tint: 'bg-amber-100 text-amber-700' },
    { label: 'MRR', value: money(t?.mrr ?? 0), icon: DollarSign, tint: 'bg-emerald-100 text-emerald-700' },
    { label: 'ARR', value: money(t?.arr ?? 0), icon: TrendingUp, tint: 'bg-teal-100 text-teal-700' },
    { label: 'Conversion', value: pct(t?.conversionRate ?? 0), icon: TrendingUp, tint: 'bg-blue-100 text-blue-700' },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="h-16 bg-slate-900 text-white px-4 sm:px-8 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center">
            <CaylaPenMascot size="xs" />
          </div>
          <div>
            <div className="font-black text-sm flex items-center gap-2">
              Sheetpay Admin
              <span className="text-[9px] font-black uppercase tracking-wider bg-emerald-500 text-white px-2 py-0.5 rounded-full">
                Live
              </span>
            </div>
            <div className="text-[11px] text-slate-400">{currentUser?.email}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onNavigate('/app')}
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-bold transition-colors cursor-pointer"
          >
            <Crown className="w-3.5 h-3.5 text-emerald-400" /> Open App
          </button>
          <button
            onClick={() => signOut(auth).then(() => onNavigate('/'))}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 text-xs font-bold transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" /> Sign out
          </button>
        </div>
      </header>

      {/* Section tabs */}
      <nav className="sticky top-16 z-20 bg-white border-b border-slate-200 overflow-x-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 flex items-center gap-1">
          {NAV.map((n) => {
            const Icon = n.icon;
            const active = section === n.section;
            return (
              <button
                key={n.section}
                onClick={() => onNavigate(n.path)}
                className={`flex items-center gap-2 px-3 py-3 text-xs font-bold whitespace-nowrap border-b-2 transition-colors cursor-pointer ${
                  active
                    ? 'border-emerald-600 text-slate-900'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {n.label}
              </button>
            );
          })}
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-8 py-6 space-y-6">
        {section !== 'overview' && (
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight capitalize">{section}</h1>
              <p className="text-xs text-slate-500">Real production data · Convex + Paddle + Google</p>
            </div>
          </div>
        )}

        {section === 'users' && <AdminUsersView requesterUid={currentUser?.uid} />}
        {section === 'subscriptions' && <AdminSubscriptionsView requesterUid={currentUser?.uid} />}
        {section === 'revenue' && <AdminRevenueView requesterUid={currentUser?.uid} />}
        {section === 'analytics' && <AdminGaAnalyticsView requesterUid={currentUser?.uid} />}
        {section === 'seo' && <AdminSeoView requesterUid={currentUser?.uid} />}
        {section === 'payroll' && <AdminPayrollView requesterUid={currentUser?.uid} />}
        {section === 'cayla' && <AdminCaylaView requesterUid={currentUser?.uid} />}
        {section === 'system' && <AdminSystemView requesterUid={currentUser?.uid} />}
        {section === 'support' && <AdminSupportView requesterUid={currentUser?.uid} />}

        {section === 'overview' && (<>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight">Overview</h1>
            <p className="text-xs text-slate-500">Real-time data from Convex · paid vs free breakdown</p>
          </div>
          {loading && (
            <span className="inline-flex items-center gap-1.5 text-xs text-slate-400 font-semibold">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Loading…
            </span>
          )}
        </div>

        {unauthorized ? (
          <div className="p-6 bg-rose-50 border border-rose-200 rounded-2xl text-sm text-rose-700 font-semibold">
            Your account is signed in but not present in the backend yet. Reload in a moment, or make sure
            you have logged into the main app at least once with this email.
          </div>
        ) : (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
              {kpis.map((k) => {
                const Icon = k.icon;
                return (
                  <div key={k.label} className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${k.tint}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="mt-3 text-2xl font-black text-slate-900 tracking-tight tabular-nums">
                      {k.value}
                    </div>
                    <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">{k.label}</div>
                  </div>
                );
              })}
            </div>

            {/* Secondary stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <MiniStat label="New (7 days)" value={t?.newLast7 ?? 0} />
              <MiniStat label="New (30 days)" value={t?.newLast30 ?? 0} />
              <MiniStat label="Business accounts" value={analytics?.byAccountType?.business ?? 0} />
              <MiniStat label="Accountant accounts" value={analytics?.byAccountType?.accountant ?? 0} />
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs">
                <h3 className="text-sm font-black text-slate-900 mb-3">Signups — last 30 days</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={analytics?.signupsByDay ?? []}>
                      <defs>
                        <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#10b981" stopOpacity={0.35} />
                          <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 10, fill: '#94a3b8' }}
                        tickFormatter={(d: string) => d.slice(5)}
                        interval={4}
                      />
                      <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} allowDecimals={false} width={24} />
                      <Tooltip contentStyle={{ fontSize: 12, borderRadius: 12, border: '1px solid #e2e8f0' }} />
                      <Area type="monotone" dataKey="count" stroke="#10b981" strokeWidth={2} fill="url(#sg)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs">
                <h3 className="text-sm font-black text-slate-900 mb-3">Plan distribution</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={planData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={3}
                      >
                        {planData.map((entry) => (
                          <Cell key={entry.name} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ fontSize: 12, borderRadius: 12, border: '1px solid #e2e8f0' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex items-center justify-center gap-4 mt-1">
                  {planData.map((p) => (
                    <div key={p.name} className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: p.color }} />
                      {p.name} ({p.value})
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Paid vs Free bar */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs">
              <h3 className="text-sm font-black text-slate-900 mb-3">Paid vs Free</h3>
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={[
                      { name: 'Paid', value: t?.paidUsers ?? 0, color: '#10b981' },
                      { name: 'Free', value: t?.freeUsers ?? 0, color: '#94a3b8' },
                    ]}
                    layout="vertical"
                  >
                    <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} allowDecimals={false} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: '#475569' }} width={48} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 12, border: '1px solid #e2e8f0' }} />
                    <Bar dataKey="value" radius={[0, 8, 8, 0]}>
                      <Cell fill="#10b981" />
                      <Cell fill="#94a3b8" />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Users table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-sm font-black text-slate-900">Users ({analytics?.recentUsers?.length ?? 0})</h3>
                <span className="text-[11px] text-slate-400 font-semibold">Newest first · up to 100</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-[10px] uppercase tracking-wider text-slate-400 border-b border-slate-100">
                      <th className="px-4 py-2.5 font-bold">Email</th>
                      <th className="px-4 py-2.5 font-bold">Account</th>
                      <th className="px-4 py-2.5 font-bold">Plan</th>
                      <th className="px-4 py-2.5 font-bold">Status</th>
                      <th className="px-4 py-2.5 font-bold">Joined</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {(analytics?.recentUsers ?? []).map((u: any) => (
                      <tr key={u.id} className="hover:bg-slate-50/60">
                        <td className="px-4 py-2.5 font-semibold text-slate-800">
                          {u.email}
                          {u.displayName ? <span className="text-slate-400 font-normal"> · {u.displayName}</span> : null}
                        </td>
                        <td className="px-4 py-2.5 capitalize text-slate-600">{u.accountType}</td>
                        <td className="px-4 py-2.5">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                              u.paid ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {u.plan}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-slate-600">{u.planStatus}</td>
                        <td className="px-4 py-2.5 text-slate-500 tabular-nums">
                          {new Date(u.createdAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                    {(!analytics?.recentUsers || analytics.recentUsers.length === 0) && !loading && (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                          No users yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
        </>)}
      </main>
    </div>
  );
};

const MiniStat: React.FC<{ label: string; value: number | string }> = ({ label, value }) => (
  <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs">
    <div className="text-xl font-black text-slate-900 tabular-nums">{value}</div>
    <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">{label}</div>
  </div>
);
