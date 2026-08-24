import React, { useState } from 'react';
import { AccountantClient, FirmRole, FirmTeamMember } from '../../types';
import {
  Users,
  UserPlus,
  Shield,
  Mail,
  CheckCircle2,
  X,
  Building2,
  MoreVertical,
} from 'lucide-react';
import { CaylaPenMascot } from '../CaylaPenMascot';

interface AccountantTeamViewProps {
  teamMembers: FirmTeamMember[];
  clients: AccountantClient[];
  onAddTeamMember: (member: FirmTeamMember) => void;
}

export const AccountantTeamView: React.FC<AccountantTeamViewProps> = ({
  teamMembers,
  clients,
  onAddTeamMember,
}) => {
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<FirmRole>('Accountant');
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>([]);
  const [successNotice, setSuccessNotice] = useState(false);

  const toggleClientSelection = (id: string) => {
    if (selectedClientIds.includes(id)) {
      setSelectedClientIds(selectedClientIds.filter((cid) => cid !== id));
    } else {
      setSelectedClientIds([...selectedClientIds, id]);
    }
  };

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;

    const newMember: FirmTeamMember = {
      id: `team-${Date.now()}`,
      name: name.trim(),
      email: email.trim(),
      role,
      assignedClientIds: selectedClientIds,
      assignedClientCount: selectedClientIds.length,
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80',
      status: 'active',
      addedAt: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    };

    onAddTeamMember(newMember);
    setSuccessNotice(true);
    setTimeout(() => {
      setSuccessNotice(false);
      setIsInviteModalOpen(false);
      setName('');
      setEmail('');
      setSelectedClientIds([]);
    }, 1200);
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 md:px-8 py-6 space-y-6 select-none animate-in fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase tracking-wider">
              Firm Management
            </span>
            <span className="text-xs text-slate-400 font-medium">Team &amp; Access Controls</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-1">
            Accounting Practice Team ({teamMembers.length} Members)
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            Manage firm staff, client allocations, and role-based permissions
          </p>
        </div>

        <button
          onClick={() => setIsInviteModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
        >
          <UserPlus className="w-4 h-4" />
          <span>Invite Practice Member</span>
        </button>
      </div>

      {/* Role Hierarchy Legend */}
      <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
        <div className="p-2.5 bg-white rounded-xl border border-slate-200 space-y-1">
          <div className="font-bold text-slate-900 flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-emerald-600" />
            <span>Firm Owner &amp; Admin</span>
          </div>
          <p className="text-[11px] text-slate-500">Full practice management, client creation, billing and firm settings.</p>
        </div>

        <div className="p-2.5 bg-white rounded-xl border border-slate-200 space-y-1">
          <div className="font-bold text-slate-900 flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-blue-600" />
            <span>Payroll Manager</span>
          </div>
          <p className="text-[11px] text-slate-500">Can finalize, sign off, and batch process payrolls across all assigned clients.</p>
        </div>

        <div className="p-2.5 bg-white rounded-xl border border-slate-200 space-y-1">
          <div className="font-bold text-slate-900 flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-indigo-600" />
            <span>Accountant / Clerk</span>
          </div>
          <p className="text-[11px] text-slate-500">Drafts payroll, ingests timesheets, and manages client employee rosters.</p>
        </div>

        <div className="p-2.5 bg-white rounded-xl border border-slate-200 space-y-1">
          <div className="font-bold text-slate-900 flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-slate-500" />
            <span>Auditor / Viewer</span>
          </div>
          <p className="text-[11px] text-slate-500">Read-only access to historical registers, TD4 tax returns, and audit trails.</p>
        </div>
      </div>

      {/* Team Members List */}
      {teamMembers.length === 0 ? (
        <div className="bg-white rounded-3xl border border-dashed border-slate-200 p-12 text-center space-y-3">
          <Users className="w-12 h-12 text-slate-300 mx-auto" />
          <h3 className="text-base font-bold text-slate-800">No practice members added yet</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Invite fellow accountants, payroll clerks, or audit partners to collaborate on client accounts.
          </p>
          <button
            onClick={() => setIsInviteModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Invite First Member</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {teamMembers.map((member) => {
            const assignedClientsList = clients.filter(
              (c) => member.assignedClientIds.includes(c.id) || member.role === 'Firm Owner' || member.role === 'Admin'
            );

            return (
              <div
                key={member.id}
                className="bg-white rounded-3xl border border-slate-200 p-5 shadow-2xs space-y-4 flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <img
                        src={member.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80'}
                        alt={member.name}
                        className="w-12 h-12 rounded-2xl object-cover border border-slate-200 shadow-xs"
                      />
                      <div>
                        <h3 className="font-black text-sm text-slate-900">{member.name}</h3>
                        <p className="text-[11px] text-slate-500 font-medium">{member.email}</p>
                        <span className="inline-block mt-1 text-[10px] font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md">
                          {member.role}
                        </span>
                      </div>
                    </div>

                    <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-200">
                      Active
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <div className="text-xs font-bold text-slate-700 flex items-center justify-between">
                      <span>Assigned Clients:</span>
                      <span className="text-emerald-700 font-mono">
                        {member.role === 'Firm Owner' || member.role === 'Admin'
                          ? 'All Clients (Firm-wide)'
                          : `${assignedClientsList.length} Entities`}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                      {assignedClientsList.length === 0 ? (
                        <span className="text-[11px] text-slate-400 italic">No assigned clients</span>
                      ) : (
                        assignedClientsList.map((c) => (
                          <span
                            key={c.id}
                            className="text-[10px] bg-slate-50 border border-slate-200 text-slate-700 px-2 py-0.5 rounded-md font-medium"
                          >
                            {c.name}
                          </span>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                  <span>Joined {member.addedAt}</span>
                  <button className="text-emerald-700 hover:text-emerald-800 font-bold cursor-pointer">
                    Edit Permissions
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Invite Member Modal */}
      {isInviteModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto select-none">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-auto animate-in zoom-in-95 duration-200">
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
                  <UserPlus className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <h2 className="font-extrabold text-sm text-white">Invite Practice Team Member</h2>
                  <p className="text-[11px] text-slate-400">Add an accountant or payroll specialist to your firm</p>
                </div>
              </div>
              <button
                onClick={() => setIsInviteModalOpen(false)}
                className="p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {successNotice ? (
              <div className="p-8 text-center space-y-3">
                <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                </div>
                <h3 className="font-black text-slate-900 text-lg">Invitation Sent!</h3>
                <p className="text-xs text-slate-500">
                  {name} has been added to your accounting practice workspace.
                </p>
              </div>
            ) : (
              <form onSubmit={handleInvite} className="p-6 space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Team Member Name *</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Jason Rodriguez"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:border-emerald-600 focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Email Address *</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. jason@firm.com"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:border-emerald-600 focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Practice Role</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:border-emerald-600 focus:outline-none"
                  >
                    <option value="Payroll Manager">Payroll Manager</option>
                    <option value="Accountant">Accountant</option>
                    <option value="Payroll Clerk">Payroll Clerk</option>
                    <option value="Viewer">Viewer / Auditor</option>
                    <option value="Admin">Admin</option>
                  </select>
                </div>

                <div className="space-y-2 pt-2">
                  <label className="text-xs font-bold text-slate-700">Assign Clients (Optional)</label>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                    {clients.map((c) => {
                      const isChecked = selectedClientIds.includes(c.id);
                      return (
                        <div
                          key={c.id}
                          onClick={() => toggleClientSelection(c.id)}
                          className={`p-2 rounded-xl border text-xs cursor-pointer flex items-center justify-between ${
                            isChecked ? 'bg-emerald-50 border-emerald-400 font-bold' : 'bg-slate-50 border-slate-200'
                          }`}
                        >
                          <span>{c.name}</span>
                          <span className="text-[10px] text-slate-500 font-mono">{c.country}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-3 flex justify-between items-center">
                  <button
                    type="button"
                    onClick={() => setIsInviteModalOpen(false)}
                    className="px-5 py-2.5 text-slate-600 hover:text-slate-900 font-bold text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer"
                  >
                    <CaylaPenMascot size="xs" />
                    <span>Send Invitation</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
