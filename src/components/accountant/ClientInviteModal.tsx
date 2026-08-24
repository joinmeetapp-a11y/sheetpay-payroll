import React, { useState } from 'react';
import { AccountantClient, ClientInvitation } from '../../types';
import {
  Mail,
  X,
  Send,
  ShieldCheck,
  CheckCircle2,
  Lock,
} from 'lucide-react';
import { CaylaPenMascot } from '../CaylaPenMascot';

interface ClientInviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  client: AccountantClient | null;
  onSendInvite: (invite: ClientInvitation) => void;
}

export const ClientInviteModal: React.FC<ClientInviteModalProps> = ({
  isOpen,
  onClose,
  client,
  onSendInvite,
}) => {
  const [recipientName, setRecipientName] = useState(client?.contactName || '');
  const [recipientEmail, setRecipientEmail] = useState(client?.contactEmail || '');
  const [role, setRole] = useState<'Client Admin' | 'Client Reviewer' | 'Client Approver' | 'Client Viewer'>('Client Approver');
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([
    'view_payroll',
    'upload_timesheets',
    'approve_payroll',
    'view_payslips',
    'download_reports',
  ]);
  const [sentSuccess, setSentSuccess] = useState(false);

  if (!isOpen || !client) return null;

  const permissionsList = [
    { id: 'view_payroll', label: 'View Payroll Figures', desc: 'Can view summary gross, statutory deductions, and net pay.' },
    { id: 'upload_timesheets', label: 'Upload Timesheets & Punch Files', desc: 'Allows client staff to submit timesheets directly.' },
    { id: 'upload_documents', label: 'Upload Invoices & Contracts', desc: 'Submit tax exemption certificates and expense receipts.' },
    { id: 'review_payroll', label: 'Review Draft Payroll', desc: 'Verify employee overtime, bonuses, and allowances.' },
    { id: 'approve_payroll', label: 'Approve & Authorize Payroll', desc: 'One-click executive sign-off required before finalizing.' },
    { id: 'view_payslips', label: 'View Employee Payslips', desc: 'Access printable and emailable PDF payslips.' },
    { id: 'download_reports', label: 'Download Tax & Cost Reports', desc: 'Export TD4 tax forms, NIS schedules, and bank ACH files.' },
    { id: 'manage_employees', label: 'Manage Employee Directory', desc: 'Add new hires, update banking details, and terminate staff.' },
  ];

  const togglePermission = (id: string) => {
    if (selectedPermissions.includes(id)) {
      setSelectedPermissions(selectedPermissions.filter((p) => p !== id));
    } else {
      setSelectedPermissions([...selectedPermissions, id]);
    }
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipientEmail.trim()) return;

    const invite: ClientInvitation = {
      id: `inv-${Date.now()}`,
      clientId: client.id,
      clientName: client.name,
      recipientEmail: recipientEmail.trim(),
      recipientName: recipientName.trim() || 'Client Representative',
      role,
      permissions: selectedPermissions,
      sentAt: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      status: 'pending',
    };

    onSendInvite(invite);
    setSentSuccess(true);
    setTimeout(() => {
      setSentSuccess(false);
      onClose();
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto select-none">
      <div className="bg-white w-full max-w-xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-auto animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
              <Mail className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h2 className="font-extrabold text-sm text-white flex items-center gap-2">
                <span>Invite Client Portal User</span>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded font-mono">
                  Tenant Isolation
                </span>
              </h2>
              <p className="text-[11px] text-slate-400">
                Grant secure access to {client.name} only
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {sentSuccess ? (
          <div className="p-8 text-center space-y-3">
            <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8 text-emerald-600" />
            </div>
            <h3 className="font-black text-slate-900 text-lg">Invitation Dispatched!</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              An invitation email has been sent to <strong>{recipientEmail}</strong> with secure single-tenant access credentials.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSend} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
            {/* Notice */}
            <div className="p-3 bg-emerald-50/80 border border-emerald-200 rounded-2xl flex items-start gap-2.5 text-xs text-slate-700">
              <Lock className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <p>
                <strong>Tenant Security Guarantee:</strong> This user will strictly only have access to <strong>{client.name}</strong> and cannot see any other accounting clients.
              </p>
            </div>

            {/* Recipient Details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Contact Full Name</label>
                <input
                  type="text"
                  required
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  placeholder="e.g. Camille Seepersad"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:border-emerald-600 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Email Address *</label>
                <input
                  type="email"
                  required
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  placeholder="e.g. camille@islandfoods.com"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:border-emerald-600 focus:outline-none"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">Client Portal Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as any)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:border-emerald-600 focus:outline-none"
              >
                <option value="Client Approver">Client Approver (Review, Timesheet Upload &amp; Executive Sign-off)</option>
                <option value="Client Admin">Client Admin (Full Organization Access)</option>
                <option value="Client Reviewer">Client Reviewer (View, Timesheet Upload &amp; Review only)</option>
                <option value="Client Viewer">Client Viewer (Read-only Payslips &amp; Reports)</option>
              </select>
            </div>

            {/* Granular Permissions Checklist */}
            <div className="space-y-2 pt-2">
              <label className="text-xs font-bold text-slate-800 block">Configure Portal Permissions</label>
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {permissionsList.map((perm) => {
                  const isChecked = selectedPermissions.includes(perm.id);
                  return (
                    <div
                      key={perm.id}
                      onClick={() => togglePermission(perm.id)}
                      className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-start gap-2.5 ${
                        isChecked
                          ? 'bg-emerald-50/70 border-emerald-400/80 text-slate-900'
                          : 'bg-slate-50/70 border-slate-200 text-slate-600 hover:bg-slate-100/70'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}}
                        className="mt-0.5 accent-emerald-600 rounded"
                      />
                      <div className="text-[11px] flex-1">
                        <span className="font-bold block text-slate-900">{perm.label}</span>
                        <span className="text-slate-500">{perm.desc}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="pt-3 flex justify-between items-center">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 text-slate-600 hover:text-slate-900 font-bold text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-md shadow-emerald-600/20 transition-all flex items-center gap-2 cursor-pointer"
              >
                <Send className="w-4 h-4" />
                <span>Send Client Invitation</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
