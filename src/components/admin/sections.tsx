import React, { useEffect, useState } from 'react';
import { useQuery, useAction } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { AlertTriangle, CheckCircle2, ExternalLink, RefreshCw, Search } from 'lucide-react';

const money = (n: number) => `$${(n || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
const pct = (n: number) => `${((n || 0) * 100).toFixed(1)}%`;
const dt = (t: number) => new Date(t).toLocaleDateString();

const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div className={`bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs ${className}`}>{children}</div>
);

const Kpi: React.FC<{ label: string; value: string | number; hint?: string }> = ({ label, value, hint }) => (
  <Card>
    <div className="text-2xl font-black text-slate-900 tabular-nums">{value}</div>
    <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">{label}</div>
    {hint && <div className="text-[10px] text-slate-400 mt-1">{hint}</div>}
  </Card>
);

const Unauthorized: React.FC = () => (
  <Card>
    <div className="text-sm font-semibold text-rose-700">Your role does not have access to this section.</div>
  </Card>
);

const Loading: React.FC = () => (
  <div className="text-xs text-slate-400 font-semibold inline-flex items-center gap-1.5">
    <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Loading…
  </div>
);

const ConfigureCta: React.FC<{ envKeys: string[]; docsHint: string }> = ({ envKeys, docsHint }) => (
  <Card>
    <div className="flex items-start gap-3">
      <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
      <div className="text-sm">
        <div className="font-bold text-slate-900">Not connected yet</div>
        <p className="text-xs text-slate-600 mt-1">{docsHint}</p>
        <div className="mt-3 text-[11px] text-slate-500">
          Set these on your Convex deployment:
          <div className="mt-1 flex flex-wrap gap-1.5">
            {envKeys.map((k) => (
              <code key={k} className="px-2 py-0.5 bg-slate-100 rounded font-mono text-[10px]">{k}</code>
            ))}
          </div>
          <div className="mt-2 text-slate-400">
            <code className="font-mono">npx convex env set KEY value</code>
          </div>
        </div>
      </div>
    </div>
  </Card>
);

// ═════════════════════════════════════════════════════════════════════════════
// Users
// ═════════════════════════════════════════════════════════════════════════════

export const AdminUsersView: React.FC<{ requesterUid?: string }> = ({ requesterUid }) => {
  const [search, setSearch] = useState('');
  const [plan, setPlan] = useState<string>('');
  const [accountType, setAccountType] = useState<string>('');
  const [cursor, setCursor] = useState<string | null>(null);

  const res = useQuery((api as any).admin.listUsers, {
    requesterUid,
    paginationOpts: { numItems: 50, cursor },
    search: search || undefined,
    plan: plan || undefined,
    accountType: accountType || undefined,
  }) as any;

  if (res === undefined) return <Loading />;
  if (res.authorized === false) return <Unauthorized />;

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setCursor(null); }}
              placeholder="Search email or name"
              className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:bg-white focus:border-emerald-500 focus:outline-none"
            />
          </div>
          <select value={plan} onChange={(e) => { setPlan(e.target.value); setCursor(null); }} className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold">
            <option value="">All plans</option>
            <option value="free">Free</option>
            <option value="pro">Pro</option>
            <option value="accountant">Accountant</option>
          </select>
          <select value={accountType} onChange={(e) => { setAccountType(e.target.value); setCursor(null); }} className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold">
            <option value="">All accounts</option>
            <option value="business">Business</option>
            <option value="accountant">Accountant</option>
          </select>
        </div>
      </Card>

      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-wider text-slate-400 border-b border-slate-100">
                <th className="px-4 py-2.5 font-bold">Email</th>
                <th className="px-4 py-2.5 font-bold">Type</th>
                <th className="px-4 py-2.5 font-bold">Plan</th>
                <th className="px-4 py-2.5 font-bold">Status</th>
                <th className="px-4 py-2.5 font-bold text-right">Employees</th>
                <th className="px-4 py-2.5 font-bold text-right">Payrolls</th>
                <th className="px-4 py-2.5 font-bold">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {res.users.map((u: any) => (
                <tr key={u.id} className="hover:bg-slate-50/60">
                  <td className="px-4 py-2.5 font-semibold text-slate-800">
                    {u.email}
                    {u.displayName ? <span className="text-slate-400 font-normal"> · {u.displayName}</span> : null}
                  </td>
                  <td className="px-4 py-2.5 capitalize text-slate-600">{u.accountType}</td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${u.plan !== 'free' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
                      {u.plan}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">{u.planStatus}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{u.employeeCount}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{u.payrollCount}</td>
                  <td className="px-4 py-2.5 text-slate-500 tabular-nums">{dt(u.joinedAt)}</td>
                </tr>
              ))}
              {res.users.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">No users match.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="p-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
          <div>{res.users.length} shown{res.isDone ? '' : ' · more available'}</div>
          <div className="flex gap-2">
            {cursor && <button onClick={() => setCursor(null)} className="px-2.5 py-1 bg-slate-100 rounded font-bold cursor-pointer">Reset</button>}
            {!res.isDone && <button onClick={() => setCursor(res.continueCursor)} className="px-2.5 py-1 bg-slate-900 text-white rounded font-bold cursor-pointer">Next page</button>}
          </div>
        </div>
      </Card>
    </div>
  );
};

// ═════════════════════════════════════════════════════════════════════════════
// Subscriptions
// ═════════════════════════════════════════════════════════════════════════════

export const AdminSubscriptionsView: React.FC<{ requesterUid?: string }> = ({ requesterUid }) => {
  const [status, setStatus] = useState('');
  const [cursor, setCursor] = useState<string | null>(null);
  const res = useQuery((api as any).admin.listSubscriptions, {
    requesterUid,
    paginationOpts: { numItems: 50, cursor },
    status: status || undefined,
  }) as any;
  if (res === undefined) return <Loading />;
  if (res.authorized === false) return <Unauthorized />;

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex gap-2">
          <select value={status} onChange={(e) => { setStatus(e.target.value); setCursor(null); }} className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold">
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="pending">Pending</option>
            <option value="past_due">Past due</option>
            <option value="paused">Paused</option>
            <option value="canceled">Canceled</option>
          </select>
        </div>
      </Card>

      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-wider text-slate-400 border-b border-slate-100">
                <th className="px-4 py-2.5 font-bold">Email</th>
                <th className="px-4 py-2.5 font-bold">Plan</th>
                <th className="px-4 py-2.5 font-bold">Status</th>
                <th className="px-4 py-2.5 font-bold">Paddle Customer</th>
                <th className="px-4 py-2.5 font-bold">Paddle Subscription</th>
                <th className="px-4 py-2.5 font-bold">Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {res.subscriptions.map((s: any) => (
                <tr key={s.id}>
                  <td className="px-4 py-2.5 font-semibold text-slate-800">{s.email}</td>
                  <td className="px-4 py-2.5"><span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-100 text-emerald-800">{s.plan}</span></td>
                  <td className="px-4 py-2.5 text-slate-600">{s.planStatus}</td>
                  <td className="px-4 py-2.5 text-slate-500 font-mono text-[10px]">{s.paddleCustomerId ?? '—'}</td>
                  <td className="px-4 py-2.5 text-slate-500 font-mono text-[10px]">{s.paddleSubscriptionId ?? '—'}</td>
                  <td className="px-4 py-2.5 text-slate-500 tabular-nums">{s.planUpdatedAt ? dt(s.planUpdatedAt) : '—'}</td>
                </tr>
              ))}
              {res.subscriptions.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">No subscriptions.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="p-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
          <div>{res.subscriptions.length} shown</div>
          {!res.isDone && <button onClick={() => setCursor(res.continueCursor)} className="px-2.5 py-1 bg-slate-900 text-white rounded font-bold cursor-pointer">Next page</button>}
        </div>
      </Card>
    </div>
  );
};

// ═════════════════════════════════════════════════════════════════════════════
// Revenue
// ═════════════════════════════════════════════════════════════════════════════

export const AdminRevenueView: React.FC<{ requesterUid?: string }> = ({ requesterUid }) => {
  const res = useQuery((api as any).admin.getRevenue, { requesterUid }) as any;
  if (res === undefined) return <Loading />;
  if (res.authorized === false) return <Unauthorized />;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="MRR" value={money(res.mrr)} />
        <Kpi label="ARR" value={money(res.arr)} />
        <Kpi label="MRR · Pro" value={money(res.mrrByPlan.pro ?? 0)} />
        <Kpi label="MRR · Accountant" value={money(res.mrrByPlan.accountant ?? 0)} />
      </div>
      <Card>
        <h3 className="text-sm font-black text-slate-900 mb-3">Last 12 months</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="text-left text-[10px] uppercase text-slate-400 border-b"><th className="py-2 font-bold">Month</th><th className="py-2 font-bold text-right">New paid</th><th className="py-2 font-bold text-right">MRR at close</th></tr></thead>
            <tbody className="divide-y divide-slate-50">
              {res.months.map((m: any) => (
                <tr key={m.month}><td className="py-2 font-semibold">{m.month}</td><td className="py-2 text-right tabular-nums">{m.newPaid}</td><td className="py-2 text-right tabular-nums">{money(m.mrr)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

// ═════════════════════════════════════════════════════════════════════════════
// Google Analytics
// ═════════════════════════════════════════════════════════════════════════════

export const AdminGaAnalyticsView: React.FC<{ requesterUid?: string }> = ({ requesterUid }) => {
  const run = useAction((api as any).googleAnalytics.getSiteAnalytics);
  const [data, setData] = useState<any>(undefined);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setData(undefined); setError(null);
    run({ requesterUid, days: 28 })
      .then((r: any) => { if (alive) setData(r); })
      .catch((e: any) => { if (alive) setError(String(e?.message ?? e)); });
    return () => { alive = false; };
  }, [requesterUid, run]);

  if (error) return <Card><div className="text-sm text-rose-700 font-semibold">{error}</div></Card>;
  if (data === undefined) return <Loading />;
  if (data.authorized === false) return <Unauthorized />;
  if (data.configured === false) {
    return <ConfigureCta envKeys={['GOOGLE_SERVICE_ACCOUNT_JSON', 'GA4_PROPERTY_ID']} docsHint="Grant a Google service account 'Viewer' on GA4 property G-WL7MPTEXNV, then paste its JSON key and the numeric property ID into Convex env vars." />;
  }
  const t = data.totals;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <Kpi label="Active Users" value={t.activeUsers} />
        <Kpi label="Total Users" value={t.totalUsers} />
        <Kpi label="New Users" value={t.newUsers} />
        <Kpi label="Sessions" value={t.sessions} />
        <Kpi label="Engagement" value={pct(t.engagementRate)} />
        <Kpi label="Conversions" value={t.conversions} />
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <TwoColTable title="Top traffic sources" rows={data.bySource} left={(r: any) => r.source} right={(r: any) => r.sessions} />
        <TwoColTable title="Top countries" rows={data.byCountry} left={(r: any) => r.country} right={(r: any) => r.activeUsers} />
        <TwoColTable title="Devices" rows={data.byDevice} left={(r: any) => r.device} right={(r: any) => r.activeUsers} />
        <TwoColTable title="Landing pages" rows={data.byLanding} left={(r: any) => r.path} right={(r: any) => r.sessions} />
      </div>
      <Card>
        <h3 className="text-sm font-black text-slate-900 mb-3">Product events (last {data.days} days)</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {data.byEvent.map((e: any) => (
            <div key={e.event} className="p-2 bg-slate-50 rounded-lg flex items-center justify-between text-xs">
              <span className="font-mono text-[11px] text-slate-700">{e.event}</span>
              <span className="font-black tabular-nums">{e.count}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};

const TwoColTable: React.FC<{ title: string; rows: any[]; left: (r: any) => string; right: (r: any) => number | string }> = ({ title, rows, left, right }) => (
  <Card className="p-0 overflow-hidden">
    <div className="px-4 py-3 border-b border-slate-100 text-sm font-black text-slate-900">{title}</div>
    <table className="w-full text-xs">
      <tbody className="divide-y divide-slate-50">
        {rows.map((r, i) => (
          <tr key={i}><td className="px-4 py-2 text-slate-700 truncate max-w-[240px]">{left(r) || '—'}</td><td className="px-4 py-2 text-right tabular-nums font-semibold">{right(r)}</td></tr>
        ))}
        {rows.length === 0 && (<tr><td className="px-4 py-6 text-center text-slate-400" colSpan={2}>No data.</td></tr>)}
      </tbody>
    </table>
  </Card>
);

// ═════════════════════════════════════════════════════════════════════════════
// SEO / Search Console
// ═════════════════════════════════════════════════════════════════════════════

export const AdminSeoView: React.FC<{ requesterUid?: string }> = ({ requesterUid }) => {
  const run = useAction((api as any).searchConsole.getSearchAnalytics);
  const [data, setData] = useState<any>(undefined);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    setData(undefined); setError(null);
    run({ requesterUid, days: 28 })
      .then((r: any) => { if (alive) setData(r); })
      .catch((e: any) => { if (alive) setError(String(e?.message ?? e)); });
    return () => { alive = false; };
  }, [requesterUid, run]);

  if (error) return <Card><div className="text-sm text-rose-700 font-semibold">{error}</div></Card>;
  if (data === undefined) return <Loading />;
  if (data.authorized === false) return <Unauthorized />;
  if (data.configured === false) {
    return <ConfigureCta envKeys={['GOOGLE_SERVICE_ACCOUNT_JSON', 'SEARCH_CONSOLE_SITE_URL']} docsHint="Add your service account as an owner or restricted user on the Search Console property, then set the site URL (e.g. sc-domain:sheetpay.app or https://sheetpay.app/)." />;
  }
  const t = data.totals;
  const opp = data.opportunities;
  return (
    <div className="space-y-4">
      <div className="text-[11px] text-slate-500">Site: <span className="font-mono">{data.site}</span></div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Clicks" value={t.clicks} />
        <Kpi label="Impressions" value={t.impressions} />
        <Kpi label="CTR" value={pct(t.ctr)} />
        <Kpi label="Avg. position" value={t.position.toFixed(1)} />
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <SeoTable title="Top queries" rows={data.topQueries} />
        <SeoTable title="Top pages" rows={data.topPages} />
      </div>
      <h3 className="text-sm font-black text-slate-900 pt-2">Opportunities</h3>
      <div className="grid md:grid-cols-2 gap-4">
        <SeoTable title="Position 1–3" rows={opp.pos1to3} />
        <SeoTable title="Position 4–10" rows={opp.pos4to10} />
        <SeoTable title="Position 11–20" rows={opp.pos11to20} />
        <SeoTable title="High impressions · low CTR" rows={opp.highImpLowCtr} />
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <GrowthTable title="Fastest-growing queries" rows={opp.growingQueries} keyLabel="Query" keyField="query" />
        <GrowthTable title="Fastest-growing pages" rows={opp.growingPages} keyLabel="Page" keyField="page" />
      </div>
    </div>
  );
};

const SeoTable: React.FC<{ title: string; rows: any[] }> = ({ title, rows }) => (
  <Card className="p-0 overflow-hidden">
    <div className="px-4 py-3 border-b border-slate-100 text-sm font-black text-slate-900">{title}</div>
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead><tr className="text-left text-[10px] uppercase text-slate-400 border-b"><th className="px-4 py-2 font-bold">Key</th><th className="px-4 py-2 font-bold text-right">Clicks</th><th className="px-4 py-2 font-bold text-right">Impr</th><th className="px-4 py-2 font-bold text-right">CTR</th><th className="px-4 py-2 font-bold text-right">Pos</th></tr></thead>
        <tbody className="divide-y divide-slate-50">
          {rows.map((r, i) => (
            <tr key={i}>
              <td className="px-4 py-2 text-slate-700 truncate max-w-[220px]">{r.key || '—'}</td>
              <td className="px-4 py-2 text-right tabular-nums">{r.clicks}</td>
              <td className="px-4 py-2 text-right tabular-nums">{r.impressions}</td>
              <td className="px-4 py-2 text-right tabular-nums">{pct(r.ctr)}</td>
              <td className="px-4 py-2 text-right tabular-nums">{r.position.toFixed(1)}</td>
            </tr>
          ))}
          {rows.length === 0 && (<tr><td colSpan={5} className="px-4 py-6 text-center text-slate-400">Nothing yet.</td></tr>)}
        </tbody>
      </table>
    </div>
  </Card>
);

const GrowthTable: React.FC<{ title: string; rows: any[]; keyLabel: string; keyField: string }> = ({ title, rows, keyLabel, keyField }) => (
  <Card className="p-0 overflow-hidden">
    <div className="px-4 py-3 border-b border-slate-100 text-sm font-black text-slate-900">{title}</div>
    <table className="w-full text-xs">
      <thead><tr className="text-left text-[10px] uppercase text-slate-400 border-b"><th className="px-4 py-2 font-bold">{keyLabel}</th><th className="px-4 py-2 font-bold text-right">Prev</th><th className="px-4 py-2 font-bold text-right">Now</th><th className="px-4 py-2 font-bold text-right">Δ</th></tr></thead>
      <tbody className="divide-y divide-slate-50">
        {rows.map((r, i) => (
          <tr key={i}><td className="px-4 py-2 text-slate-700 truncate max-w-[240px]">{r[keyField]}</td><td className="px-4 py-2 text-right tabular-nums text-slate-400">{r.prevClicks}</td><td className="px-4 py-2 text-right tabular-nums">{r.clicks}</td><td className="px-4 py-2 text-right tabular-nums font-bold text-emerald-700">+{r.delta}</td></tr>
        ))}
        {rows.length === 0 && (<tr><td colSpan={4} className="px-4 py-6 text-center text-slate-400">No growth yet.</td></tr>)}
      </tbody>
    </table>
  </Card>
);

// ═════════════════════════════════════════════════════════════════════════════
// Payroll
// ═════════════════════════════════════════════════════════════════════════════

export const AdminPayrollView: React.FC<{ requesterUid?: string }> = ({ requesterUid }) => {
  const res = useQuery((api as any).admin.getPayrollStats, { requesterUid }) as any;
  if (res === undefined) return <Loading />;
  if (res.authorized === false) return <Unauthorized />;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Kpi label="Payroll runs" value={res.totalRuns} />
        <Kpi label="Employees" value={res.totalEmployees} />
        <Kpi label="Total net paid" value={money(res.totalNetPaid)} />
        <Kpi label="Total PAYE" value={money(res.totalPaye)} />
        <Kpi label="Total NIS" value={money(res.totalNis)} />
      </div>
      <Card className="p-0 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 text-sm font-black text-slate-900">Recent payroll runs</div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="text-left text-[10px] uppercase text-slate-400 border-b"><th className="px-4 py-2 font-bold">Period</th><th className="px-4 py-2 font-bold">Status</th><th className="px-4 py-2 font-bold text-right">Employees</th><th className="px-4 py-2 font-bold text-right">Total net</th><th className="px-4 py-2 font-bold">Created</th></tr></thead>
            <tbody className="divide-y divide-slate-50">
              {res.recent.map((r: any) => (
                <tr key={r.id}><td className="px-4 py-2 font-semibold">{r.period}</td><td className="px-4 py-2">{r.status}</td><td className="px-4 py-2 text-right tabular-nums">{r.employeeCount}</td><td className="px-4 py-2 text-right tabular-nums">{money(r.totalNet)}</td><td className="px-4 py-2 text-slate-500 tabular-nums">{dt(r.createdAt)}</td></tr>
              ))}
              {res.recent.length === 0 && (<tr><td colSpan={5} className="px-4 py-6 text-center text-slate-400">No runs yet.</td></tr>)}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

// ═════════════════════════════════════════════════════════════════════════════
// Cayla costs
// ═════════════════════════════════════════════════════════════════════════════

export const AdminCaylaView: React.FC<{ requesterUid?: string }> = ({ requesterUid }) => {
  const res = useQuery((api as any).admin.getCaylaCosts, { requesterUid }) as any;
  if (res === undefined) return <Loading />;
  if (res.authorized === false) return <Unauthorized />;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Total calls" value={res.totalCalls} />
        <Kpi label="Total cost" value={money(res.totalCostUsd)} />
        <Kpi label="Input tokens" value={res.inputTokens.toLocaleString()} />
        <Kpi label="Output tokens" value={res.outputTokens.toLocaleString()} />
      </div>
      <Card className="p-0 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 text-sm font-black text-slate-900">By model</div>
        <table className="w-full text-xs">
          <thead><tr className="text-left text-[10px] uppercase text-slate-400 border-b"><th className="px-4 py-2 font-bold">Model</th><th className="px-4 py-2 font-bold text-right">Calls</th><th className="px-4 py-2 font-bold text-right">Input tokens</th><th className="px-4 py-2 font-bold text-right">Output tokens</th><th className="px-4 py-2 font-bold text-right">Cost</th></tr></thead>
          <tbody className="divide-y divide-slate-50">
            {Object.entries(res.byModel).map(([model, m]: [string, any]) => (
              <tr key={model}><td className="px-4 py-2 font-mono text-[11px]">{model}</td><td className="px-4 py-2 text-right tabular-nums">{m.calls}</td><td className="px-4 py-2 text-right tabular-nums">{m.inputTokens.toLocaleString()}</td><td className="px-4 py-2 text-right tabular-nums">{m.outputTokens.toLocaleString()}</td><td className="px-4 py-2 text-right tabular-nums">{money(m.costUsd)}</td></tr>
            ))}
            {Object.keys(res.byModel).length === 0 && (<tr><td colSpan={5} className="px-4 py-6 text-center text-slate-400">No Cayla usage yet.</td></tr>)}
          </tbody>
        </table>
      </Card>
      <Card className="p-0 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 text-sm font-black text-slate-900">Top accounts by spend</div>
        <table className="w-full text-xs">
          <thead><tr className="text-left text-[10px] uppercase text-slate-400 border-b"><th className="px-4 py-2 font-bold">User</th><th className="px-4 py-2 font-bold text-right">Calls</th><th className="px-4 py-2 font-bold text-right">Cost</th></tr></thead>
          <tbody className="divide-y divide-slate-50">
            {res.topUsers.map((u: any) => (
              <tr key={u.userId}><td className="px-4 py-2 font-mono text-[10px]">{u.userId}</td><td className="px-4 py-2 text-right tabular-nums">{u.calls}</td><td className="px-4 py-2 text-right tabular-nums">{money(u.costUsd)}</td></tr>
            ))}
            {res.topUsers.length === 0 && (<tr><td colSpan={3} className="px-4 py-6 text-center text-slate-400">No usage yet.</td></tr>)}
          </tbody>
        </table>
      </Card>
    </div>
  );
};

// ═════════════════════════════════════════════════════════════════════════════
// System health
// ═════════════════════════════════════════════════════════════════════════════

export const AdminSystemView: React.FC<{ requesterUid?: string }> = ({ requesterUid }) => {
  const res = useQuery((api as any).admin.getSystemHealth, { requesterUid }) as any;
  if (res === undefined) return <Loading />;
  if (res.authorized === false) return <Unauthorized />;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Kpi label="Failed emails (24h)" value={res.failedEmails24h} />
        <Kpi label="Failed webhooks (24h)" value={res.failedWebhooks24h} />
        <Kpi label="Ignored webhooks (24h)" value={res.ignoredWebhooks24h} />
      </div>
      <Card>
        <h3 className="text-sm font-black text-slate-900 mb-3">Provider status</h3>
        <div className="grid md:grid-cols-2 gap-2">
          {res.providers.map((p: any) => (
            <div key={p.name} className={`flex items-center justify-between p-3 rounded-lg border ${p.ok ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
              <div className="flex items-center gap-2">
                {p.ok ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertTriangle className="w-4 h-4 text-amber-600" />}
                <span className="font-bold text-sm">{p.name}</span>
              </div>
              <span className="text-[11px] text-slate-600">{p.note}</span>
            </div>
          ))}
        </div>
      </Card>
      <Card className="p-0 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 text-sm font-black text-slate-900 flex items-center justify-between">
          <span>Recent Paddle events</span>
          <a href="https://vendors.paddle.com/notifications-v2" target="_blank" rel="noreferrer" className="text-[11px] text-emerald-700 font-bold inline-flex items-center gap-1"><ExternalLink className="w-3 h-3" /> Paddle dashboard</a>
        </div>
        <table className="w-full text-xs">
          <thead><tr className="text-left text-[10px] uppercase text-slate-400 border-b"><th className="px-4 py-2 font-bold">Event</th><th className="px-4 py-2 font-bold">Type</th><th className="px-4 py-2 font-bold">Status</th><th className="px-4 py-2 font-bold">Received</th></tr></thead>
          <tbody className="divide-y divide-slate-50">
            {res.recentPaddleEvents.map((e: any) => (
              <tr key={e.eventId}>
                <td className="px-4 py-2 font-mono text-[10px]">{e.eventId}</td>
                <td className="px-4 py-2 text-slate-700">{e.eventType}</td>
                <td className="px-4 py-2"><span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${e.status === 'processed' ? 'bg-emerald-100 text-emerald-800' : e.status === 'failed' ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-600'}`}>{e.status}</span></td>
                <td className="px-4 py-2 text-slate-500 tabular-nums">{dt(e.receivedAt)}</td>
              </tr>
            ))}
            {res.recentPaddleEvents.length === 0 && (<tr><td colSpan={4} className="px-4 py-6 text-center text-slate-400">No webhooks received yet.</td></tr>)}
          </tbody>
        </table>
      </Card>
    </div>
  );
};

// ═════════════════════════════════════════════════════════════════════════════
// Support inbox — Nia handoffs
// ═════════════════════════════════════════════════════════════════════════════

export const AdminSupportView: React.FC<{ requesterUid?: string }> = ({ requesterUid }) => {
  const res = useQuery((api as any).niaInternal.listSupportCasesForAdmin, { requesterUid }) as any;
  if (res === undefined) return <Loading />;
  if (res.authorized === false) return <Unauthorized />;

  const groups: Record<string, any[]> = { open: [], waiting: [], in_progress: [], resolved: [], closed: [] };
  for (const c of res.cases) (groups[c.status] ?? groups.open).push(c);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Kpi label="Open" value={groups.open.length} />
        <Kpi label="Waiting" value={groups.waiting.length} />
        <Kpi label="In progress" value={groups.in_progress.length} />
        <Kpi label="Resolved" value={groups.resolved.length} />
        <Kpi label="Closed" value={groups.closed.length} />
      </div>
      <Card className="p-0 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 text-sm font-black text-slate-900">Recent cases</div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-[10px] uppercase text-slate-400 border-b">
                <th className="px-4 py-2 font-bold">User</th>
                <th className="px-4 py-2 font-bold">Plan</th>
                <th className="px-4 py-2 font-bold">Page</th>
                <th className="px-4 py-2 font-bold">Summary</th>
                <th className="px-4 py-2 font-bold">Email</th>
                <th className="px-4 py-2 font-bold">Status</th>
                <th className="px-4 py-2 font-bold">Received</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {res.cases.map((c: any) => (
                <tr key={c.id}>
                  <td className="px-4 py-2 font-semibold text-slate-800">
                    {c.contactName}
                    <div className="text-[10px] text-slate-400 font-normal font-mono">{c.contactEmail}</div>
                  </td>
                  <td className="px-4 py-2 text-slate-600">{c.plan ?? '—'}</td>
                  <td className="px-4 py-2 text-slate-500 font-mono text-[10px]">{c.currentPage ?? '—'}</td>
                  <td className="px-4 py-2 text-slate-700 max-w-[300px] truncate">{c.summary}</td>
                  <td className="px-4 py-2">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${c.transcriptEmailStatus === 'sent' ? 'bg-emerald-100 text-emerald-800' : c.transcriptEmailStatus === 'failed' ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-500'}`}>
                      {c.transcriptEmailStatus ?? 'pending'}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-slate-100 text-slate-700">{c.status}</span>
                  </td>
                  <td className="px-4 py-2 text-slate-500 tabular-nums">{dt(c.createdAt)}</td>
                </tr>
              ))}
              {res.cases.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">No support cases yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
      <div className="text-[10px] text-slate-400 text-center">
        Full reply/take-over UI ships next iteration — for now, respond to the transcript email or reach the user directly.
      </div>
    </div>
  );
};
