import React, { useMemo, useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import {
  Bell,
  Plus,
  Trash2,
  Edit3,
  ArrowLeft,
  Bot,
  Calendar,
  Clock,
  Power,
} from 'lucide-react';

interface Props {
  currentUser: { uid: string; email: string; displayName: string } | null;
  onNavigate: (path: string) => void;
  onOpenCayla: () => void;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Detect the browser's timezone so we save reminders in the user's local TZ.
const localTz = typeof Intl !== 'undefined'
  ? (Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC')
  : 'UTC';

const emptyDraft = {
  title: '',
  type: 'payroll',
  frequency: 'weekly',
  dayOfWeek: 5, // Friday
  dayOfMonth: 25,
  scheduledTime: '09:00',
  timezone: localTz,
  deepLink: '/app',
  messageTemplate: '',
};

const fmtNextRun = (ms: number, tz: string) =>
  new Intl.DateTimeFormat(undefined, {
    timeZone: tz,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(ms));

const fmtFrequency = (r: any) => {
  if (r.frequency === 'daily') return 'Every day';
  if (r.frequency === 'weekly') return `Every ${DAYS[r.dayOfWeek ?? 0]}`;
  if (r.frequency === 'biweekly') return `Every other ${DAYS[r.dayOfWeek ?? 0]}`;
  if (r.frequency === 'monthly') return `Day ${r.dayOfMonth ?? 1} of each month`;
  if (r.frequency === 'once') return 'One-time';
  if (r.frequency === 'before_payroll') return 'Before payroll';
  return r.frequency;
};

export const PayrollReminders: React.FC<Props> = ({ currentUser, onNavigate, onOpenCayla }) => {
  const uid = currentUser?.uid;
  const reminders = useQuery(
    (api as any).reminders.listReminders,
    uid ? { requesterUid: uid } : 'skip'
  ) as any;

  const create = useMutation((api as any).reminders.createReminder);
  const update = useMutation((api as any).reminders.updateReminder);
  const del = useMutation((api as any).reminders.deleteReminder);

  const [editing, setEditing] = useState<any | null>(null);
  const [draft, setDraft] = useState<any>(emptyDraft);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openCreate = () => {
    setEditing(null);
    setDraft({ ...emptyDraft, timezone: localTz });
    setShowForm(true);
    setError(null);
  };

  const openEdit = (r: any) => {
    setEditing(r);
    setDraft({
      title: r.title,
      type: r.type,
      frequency: r.frequency,
      dayOfWeek: r.dayOfWeek ?? 5,
      dayOfMonth: r.dayOfMonth ?? 25,
      scheduledTime: r.scheduledTime,
      timezone: r.timezone,
      deepLink: r.deepLink ?? '/app',
      messageTemplate: '',
    });
    setShowForm(true);
    setError(null);
  };

  const save = async () => {
    if (!uid) return;
    setSaving(true);
    setError(null);
    try {
      if (editing) {
        await update({
          requesterUid: uid,
          reminderId: editing.id,
          patch: {
            title: draft.title,
            frequency: draft.frequency,
            dayOfWeek: draft.frequency === 'weekly' || draft.frequency === 'biweekly' ? Number(draft.dayOfWeek) : undefined,
            dayOfMonth: draft.frequency === 'monthly' ? Number(draft.dayOfMonth) : undefined,
            scheduledTime: draft.scheduledTime,
            timezone: draft.timezone,
            deepLink: draft.deepLink || undefined,
            messageTemplate: draft.messageTemplate || undefined,
          },
        });
      } else {
        await create({
          requesterUid: uid,
          type: draft.type,
          title: draft.title || 'Payroll reminder',
          frequency: draft.frequency,
          dayOfWeek: draft.frequency === 'weekly' || draft.frequency === 'biweekly' ? Number(draft.dayOfWeek) : undefined,
          dayOfMonth: draft.frequency === 'monthly' ? Number(draft.dayOfMonth) : undefined,
          scheduledTime: draft.scheduledTime,
          timezone: draft.timezone,
          deepLink: draft.deepLink || undefined,
          messageTemplate: draft.messageTemplate || undefined,
        });
      }
      setShowForm(false);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (r: any) => {
    if (!uid) return;
    await update({ requesterUid: uid, reminderId: r.id, patch: { enabled: !r.enabled } });
  };

  const remove = async (r: any) => {
    if (!uid) return;
    if (!confirm(`Delete "${r.title}"? This can't be undone.`)) return;
    await del({ requesterUid: uid, reminderId: r.id });
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-8 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigate('/app')}
            className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back
          </button>
          <div className="h-6 w-px bg-slate-200" />
          <div>
            <div className="font-black text-sm text-slate-900 flex items-center gap-2">
              <Bell className="w-4 h-4 text-emerald-600" /> Payroll Reminders
            </div>
            <div className="text-[11px] text-slate-500">Automatic notifications so you never miss a payroll deadline</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenCayla}
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-bold cursor-pointer"
          >
            <Bot className="w-3.5 h-3.5" /> Create with Cayla
          </button>
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" /> New reminder
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-8 py-6 space-y-4">
        {showForm && (
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-3">
            <div className="text-sm font-black text-slate-900">
              {editing ? 'Edit reminder' : 'New reminder'}
            </div>

            <label className="block">
              <span className="text-[11px] font-bold text-slate-600">Title</span>
              <input
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                placeholder="Run weekly payroll"
                className="mt-1 w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:bg-white focus:border-emerald-500 focus:outline-none"
              />
            </label>

            <div className="grid sm:grid-cols-2 gap-3">
              <label className="block">
                <span className="text-[11px] font-bold text-slate-600">Category</span>
                <select
                  value={draft.type}
                  onChange={(e) => setDraft({ ...draft, type: e.target.value })}
                  className="mt-1 w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold"
                >
                  <option value="payroll">Payroll</option>
                  <option value="attendance">Attendance</option>
                  <option value="timesheet">Timesheet</option>
                  <option value="payslip">Payslip</option>
                  <option value="tax_deadline">Tax deadline</option>
                  <option value="custom">Custom</option>
                </select>
              </label>

              <label className="block">
                <span className="text-[11px] font-bold text-slate-600">Frequency</span>
                <select
                  value={draft.frequency}
                  onChange={(e) => setDraft({ ...draft, frequency: e.target.value })}
                  className="mt-1 w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="biweekly">Every 2 weeks</option>
                  <option value="monthly">Monthly</option>
                </select>
              </label>

              {(draft.frequency === 'weekly' || draft.frequency === 'biweekly') && (
                <label className="block">
                  <span className="text-[11px] font-bold text-slate-600">Day of week</span>
                  <select
                    value={draft.dayOfWeek}
                    onChange={(e) => setDraft({ ...draft, dayOfWeek: Number(e.target.value) })}
                    className="mt-1 w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold"
                  >
                    {DAYS.map((d, i) => (
                      <option key={i} value={i}>{d}</option>
                    ))}
                  </select>
                </label>
              )}
              {draft.frequency === 'monthly' && (
                <label className="block">
                  <span className="text-[11px] font-bold text-slate-600">Day of month</span>
                  <input
                    type="number"
                    min={1}
                    max={31}
                    value={draft.dayOfMonth}
                    onChange={(e) => setDraft({ ...draft, dayOfMonth: Number(e.target.value) })}
                    className="mt-1 w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold"
                  />
                </label>
              )}

              <label className="block">
                <span className="text-[11px] font-bold text-slate-600">Time</span>
                <input
                  type="time"
                  value={draft.scheduledTime}
                  onChange={(e) => setDraft({ ...draft, scheduledTime: e.target.value })}
                  className="mt-1 w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold"
                />
              </label>

              <label className="block">
                <span className="text-[11px] font-bold text-slate-600">Timezone</span>
                <input
                  value={draft.timezone}
                  onChange={(e) => setDraft({ ...draft, timezone: e.target.value })}
                  className="mt-1 w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-mono"
                  placeholder="America/Port_of_Spain"
                />
              </label>

              <label className="block sm:col-span-2">
                <span className="text-[11px] font-bold text-slate-600">Tap-through link</span>
                <select
                  value={draft.deepLink}
                  onChange={(e) => setDraft({ ...draft, deepLink: e.target.value })}
                  className="mt-1 w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold"
                >
                  <option value="/app">Payroll workspace</option>
                  <option value="/app/attendance">Attendance</option>
                  <option value="/app/payslips">Payslips</option>
                  <option value="/app/cayla">Open Cayla</option>
                </select>
              </label>

              <label className="block sm:col-span-2">
                <span className="text-[11px] font-bold text-slate-600">Custom message (optional)</span>
                <textarea
                  value={draft.messageTemplate}
                  onChange={(e) => setDraft({ ...draft, messageTemplate: e.target.value })}
                  placeholder="Leave blank to use the default message for this category."
                  rows={2}
                  className="mt-1 w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"
                />
              </label>
            </div>

            {error && (
              <div className="p-2 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 font-semibold">
                {error}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => setShowForm(false)}
                className="px-3 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={save}
                disabled={saving || !draft.title.trim()}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg cursor-pointer"
              >
                {saving ? 'Saving…' : editing ? 'Save changes' : 'Create reminder'}
              </button>
            </div>
          </div>
        )}

        {reminders === undefined ? (
          <div className="text-center py-16 text-sm text-slate-400">Loading reminders…</div>
        ) : reminders.length === 0 ? (
          <div className="text-center py-16 space-y-3 bg-white rounded-2xl border border-dashed border-slate-300">
            <Bell className="w-8 h-8 text-slate-300 mx-auto" />
            <div className="font-bold text-slate-700">No reminders yet</div>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Ask Cayla to remind you about payroll, or tap <b>New reminder</b> above to set one up manually.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {reminders.map((r: any) => (
              <li
                key={r.id}
                className={`bg-white rounded-2xl border p-4 flex items-start gap-4 ${r.enabled ? 'border-slate-200' : 'border-slate-200 opacity-60'}`}
              >
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${r.enabled ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-slate-100 text-slate-400'}`}>
                  <Bell className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm text-slate-900 truncate">{r.title}</div>
                  <div className="text-[11px] text-slate-500 flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                    <span className="inline-flex items-center gap-1"><Calendar className="w-3 h-3" />{fmtFrequency(r)}</span>
                    <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" />{r.scheduledTime} · {r.timezone}</span>
                    <span>Next: {fmtNextRun(r.nextRunAt, r.timezone)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => toggle(r)}
                    title={r.enabled ? 'Pause' : 'Enable'}
                    className={`w-8 h-8 rounded-lg flex items-center justify-center hover:bg-slate-100 cursor-pointer ${r.enabled ? 'text-slate-500' : 'text-emerald-600'}`}
                  >
                    <Power className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => openEdit(r)}
                    title="Edit"
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 cursor-pointer"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => remove(r)}
                    title="Delete"
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-rose-500 hover:bg-rose-50 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="text-[10px] text-slate-400 text-center pt-4">
          Notifications require push permission and a signed-in device. If you don't see any, go to Settings → Notifications.
        </div>
      </main>
    </div>
  );
};
