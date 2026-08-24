import React, { useState } from 'react';
import { useAction } from 'convex/react';
import { api } from '../../../convex/_generated/api';

const PREVIEW_TEMPLATES: Array<{ key: string; label: string; sample: any }> = [
  {
    key: 'welcome',
    label: 'Welcome',
    sample: { displayName: 'Marcus Joseph' },
  },
  {
    key: 'teamInvite',
    label: 'Team invitation',
    sample: {
      inviterName: 'Sarah Mohammed',
      businessName: 'Apex Dynamics Logistics Ltd',
      role: 'Accountant',
      inviteeEmail: 'marcus@example.com',
      token: 'preview-token',
      inviteLink: 'https://sheetpay.app/invite/preview-token',
      expiresLabel: 'Sat, Sep 06 2026',
    },
  },
  {
    key: 'payrollCompleted',
    label: 'Payroll completed',
    sample: {
      period: 'August 2026',
      employeeCount: 24,
      currency: 'TTD',
      totalGross: '182450.00',
      totalDeductions: '38620.00',
      totalNet: '143830.00',
      payrollLink: 'https://sheetpay.app/app/payroll/example',
    },
  },
  {
    key: 'payslipReady',
    label: 'Payslip ready',
    sample: {
      employeeName: 'Marcus Joseph',
      period: 'August 2026',
      businessName: 'Apex Dynamics Logistics Ltd',
      payslipLink: 'https://sheetpay.app/portal',
    },
  },
  {
    key: 'importCompleted',
    label: 'Import completed',
    sample: {
      fileName: 'Q3_2026_payroll_register.xlsx',
      employeesDetected: 18,
      recordsImported: 144,
      needsReviewCount: 3,
    },
  },
  {
    key: 'importRequiresReview',
    label: 'Import needs review',
    sample: { fileName: 'August_2026_payslips.pdf', questionCount: 4 },
  },
  {
    key: 'paymentFailed',
    label: 'Payment failed',
    sample: { amount: '29.00', currency: 'USD', reason: 'Card was declined' },
  },
  {
    key: 'subscriptionStarted',
    label: 'Subscription started',
    sample: {
      planName: 'Sheetpay Pro',
      amount: '29.00',
      currency: 'USD',
      billingPeriod: 'monthly',
    },
  },
];

/**
 * Dev-only email template preview. Renders subject + HTML for any registered
 * template by round-tripping through the Convex `previewTemplate` action so we
 * exercise the exact same rendering path production uses.
 *
 * The action itself refuses to run under NODE_ENV=production, so this page is
 * safe to leave routed in the client bundle.
 */
export const EmailPreviewPage: React.FC = () => {
  const [selected, setSelected] = useState(PREVIEW_TEMPLATES[0]);
  const [rendered, setRendered] = useState<{ subject?: string; html?: string; error?: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const preview = useAction(api.emails.previewTemplate);

  const handlePreview = async (t: typeof PREVIEW_TEMPLATES[number]) => {
    setSelected(t);
    setLoading(true);
    setRendered(null);
    try {
      const result: any = await preview({ emailType: t.key, data: t.sample });
      if (result.ok) {
        setRendered({ subject: result.subject, html: result.html });
      } else {
        setRendered({ error: result.error || 'Preview refused' });
      }
    } catch (err: any) {
      setRendered({ error: err?.message || 'Preview failed' });
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    handlePreview(PREVIEW_TEMPLATES[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="max-w-6xl mx-auto p-6 space-y-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Sheetpay email preview</h1>
          <p className="text-xs text-slate-500 mt-1">
            Development-only rendering of every template registered in{' '}
            <span className="font-mono">convex/lib/emailTemplates.ts</span>. Nothing is sent to Resend.
          </p>
        </div>
        <div className="grid grid-cols-12 gap-4">
          <aside className="col-span-4 bg-white rounded-2xl border border-slate-200 p-2 space-y-1 h-fit">
            {PREVIEW_TEMPLATES.map((t) => (
              <button
                key={t.key}
                onClick={() => handlePreview(t)}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  selected.key === t.key
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                {t.label}
                <span className="block text-[10px] font-mono opacity-70">{t.key}</span>
              </button>
            ))}
          </aside>
          <main className="col-span-8 bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-slate-50">
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                Subject
              </div>
              <div className="text-sm text-slate-900 font-bold mt-0.5">
                {loading ? 'Rendering…' : rendered?.subject || rendered?.error || '—'}
              </div>
            </div>
            <div className="bg-slate-50" style={{ minHeight: 600 }}>
              {rendered?.html && (
                <iframe
                  title={selected.key}
                  srcDoc={rendered.html}
                  style={{ width: '100%', height: 800, border: '0' }}
                />
              )}
              {rendered?.error && (
                <div className="p-6 text-xs font-mono text-rose-900">{rendered.error}</div>
              )}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
};
