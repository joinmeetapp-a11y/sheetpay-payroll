import React, { useState } from 'react';
import {
  AccountantClient,
  AttentionItem,
  CaylaMessage,
  FirmTeamMember,
  PayrollQueueStatus,
} from '../../types';
import { formatCurrency } from '../../lib/taxEngine';
import {
  Building2,
  Users,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowRight,
  Search,
  Sparkles,
  Mic,
  Send,
  SlidersHorizontal,
  ChevronRight,
  Layers,
  FileCheck2,
  Plus,
  ExternalLink,
  DollarSign,
  ShieldCheck,
  ChevronDown,
} from 'lucide-react';
import { CaylaPenMascot } from '../CaylaPenMascot';
import { AddClientModal } from './AddClientModal';
import { ClientInviteModal } from './ClientInviteModal';
import { BatchPayrollModal } from './BatchPayrollModal';

interface AccountantDashboardProps {
  userName?: string;
  clients?: AccountantClient[];
  teamMembers?: FirmTeamMember[];
  attentionItems?: AttentionItem[];
  batchJobs?: any[];
  activeClient?: AccountantClient | null;
  onSelectClient?: (clientOrId: any) => void;
  onRunBatchPayroll?: () => void;
  onAddNewClient?: (client: AccountantClient) => void;
  onOpenAddClient?: () => void;
  onOpenBatchPayroll?: () => void;
  onOpenInviteClient?: (client: AccountantClient) => void;
  onQuickExecuteCayla?: (prompt: string) => void;
  onUpdateClients?: (updated: AccountantClient[]) => void;
  messages?: CaylaMessage[];
  onSendMessage?: (text: string) => void;
  isProcessing?: boolean;
  onOpenTeamTab?: () => void;
}

export const getStatusBadgeStyle = (status: PayrollQueueStatus) => {
  switch (status) {
    case 'Ready to Run':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'Ready for Approval':
      return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'Approved':
      return 'bg-indigo-50 text-indigo-700 border-indigo-200';
    case 'Finalized':
    case 'Completed':
    case 'Payslips Sent':
      return 'bg-slate-900 text-white border-slate-900';
    case 'Waiting on Client':
      return 'bg-amber-50 text-amber-800 border-amber-200';
    case 'Missing Information':
    case 'Needs Review':
      return 'bg-rose-50 text-rose-700 border-rose-200';
    case 'Cayla Working':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200 animate-pulse';
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200';
  }
};

export const AccountantDashboard: React.FC<AccountantDashboardProps> = ({
  userName = 'Accountant',
  clients = [],
  teamMembers = [],
  attentionItems = [],
  activeClient = null,
  onSelectClient = (_client?: any) => {},
  onRunBatchPayroll = () => {},
  onAddNewClient = (_client: AccountantClient) => {},
  onOpenAddClient,
  onOpenBatchPayroll,
  onOpenInviteClient,
  onQuickExecuteCayla,
  onUpdateClients = (_updated: AccountantClient[]) => {},
  messages = [],
  onSendMessage = (_text: string) => {},
  isProcessing = false,
  onOpenTeamTab,
}) => {
  const [inputText, setInputText] = useState('');
  const [isMicActive, setIsMicActive] = useState(false);
  const [isAddClientOpen, setIsAddClientOpen] = useState(false);
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [selectedInviteClient, setSelectedInviteClient] = useState<AccountantClient | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [activeDeadlineTab, setActiveDeadlineTab] = useState<'this_week' | 'next_week' | 'today'>('this_week');

  const firstName = (userName || 'Accountant').split(' ')[0] || 'Accountant';

  // Cross-Client Calculations
  const totalClients = clients.length;
  const totalEmployees = clients.reduce((acc, c) => acc + c.employeeCount, 0);
  const totalPayrollValue = clients.reduce((acc, c) => acc + c.monthlyPayrollValue, 0);
  const payrollsDue = clients.filter((c) => c.payrollStatus !== 'Completed' && c.payrollStatus !== 'Finalized').length;
  const readyForApproval = clients.filter((c) => c.payrollStatus === 'Ready for Approval' || c.payrollStatus === 'Ready to Run').length;
  const needsAttention = attentionItems.length;

  const filteredClients = clients.filter((c) => {
    const search = (searchQuery || '').toLowerCase();
    const matchesSearch =
      (c.name || c.companyName || '').toLowerCase().includes(search) ||
      (c.country || '').toLowerCase().includes(search) ||
      (c.assignedTo || '').toLowerCase().includes(search);
    const matchesStatus = statusFilter === 'all' || c.payrollStatus === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleCaylaSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isProcessing) return;
    onSendMessage(inputText.trim());
    setInputText('');
  };

  const handleVoiceSimulation = () => {
    setIsMicActive(true);
    const simulatedPrompts = [
      'Which clients have payroll due this week?',
      'Prepare all ready payrolls.',
      'Show my assigned clients.',
      'How much PAYE is due across my clients?',
      'Check statutory compliance status.',
    ];
    const picked = simulatedPrompts[Math.floor(Math.random() * simulatedPrompts.length)];
    let i = 0;
    setInputText('');
    const timer = setInterval(() => {
      if (i < picked.length) {
        setInputText(picked.slice(0, i + 1));
        i++;
      } else {
        clearInterval(timer);
        setIsMicActive(false);
      }
    }, 35);
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 md:px-8 py-6 space-y-8 select-none animate-in fade-in">
      
      {/* 1. Header & Greeting */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase tracking-wider">
              Accountant Command Center
            </span>
            <span className="text-xs text-slate-400 font-medium">Multi-Client Engine</span>
          </div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-slate-900 tracking-tight mt-1">
            Good morning, {firstName} 👋
          </h1>
          <p className="text-xs md:text-sm text-slate-500 font-medium mt-0.5">
            Here&apos;s what&apos;s happening across your clients.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 sm:gap-2.5 w-full sm:w-auto">
          <button
            onClick={() => setIsBatchModalOpen(true)}
            className="inline-flex items-center justify-center gap-2 px-3 sm:px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
          >
            <Layers className="w-4 h-4 shrink-0" />
            <span className="truncate">Batch ({readyForApproval})</span>
          </button>

          <button
            onClick={() => setIsAddClientOpen(true)}
            className="inline-flex items-center justify-center gap-2 px-3 sm:px-4 py-2.5 bg-slate-900 hover:bg-slate-800 active:scale-98 text-white text-xs font-bold rounded-xl shadow-md shadow-slate-900/10 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4 shrink-0" />
            <span className="truncate">Add Client</span>
          </button>
        </div>
      </div>

      {/* 2. Prominent Headline & Large Cayla Live Transcript Box (Grey & White Mix Canvas) */}
      <div className="bg-gradient-to-b from-slate-50 via-white to-slate-100/90 text-slate-900 rounded-3xl p-6 sm:p-8 shadow-xl shadow-slate-200/60 border border-slate-200/90 relative overflow-hidden space-y-5">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-100/30 rounded-full blur-3xl pointer-events-none" />

        <div className="space-y-1.5 relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold shadow-2xs">
            <CaylaPenMascot size="xs" isProcessing={isProcessing} />
            <span>Conversational Firm AI Agent</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-950 tracking-tight">
            Manage every client&apos;s payroll with Cayla
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 max-w-2xl leading-relaxed font-medium">
            Ask Cayla to run multi-client payrolls, identify missing timesheets, calculate cross-border statutory liabilities, or switch workspaces instantly.
          </p>
        </div>

        {/* Live Conversation Stream (Last messages) */}
        {messages.length > 0 && (
          <div className="bg-slate-100/80 backdrop-blur-md rounded-2xl p-4 border border-slate-200/90 max-h-48 overflow-y-auto space-y-3 font-sans text-xs">
            {messages.slice(-3).map((m) => (
              <div
                key={m.id}
                className={`flex gap-2.5 ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {m.sender === 'cayla' && (
                  <div className="w-6 h-6 rounded-full bg-emerald-100 border border-emerald-200 flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                    <CaylaPenMascot size="xs" />
                  </div>
                )}
                <div
                  className={`p-3.5 rounded-2xl max-w-xl text-xs leading-relaxed ${
                    m.sender === 'user'
                      ? 'bg-emerald-700 text-white font-semibold rounded-br-none shadow-xs'
                      : 'bg-white text-slate-800 border border-slate-200/90 rounded-bl-none shadow-2xs font-medium'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{m.text}</p>
                  {m.actionSummary && (
                    <div className="mt-2 pt-2 border-t border-slate-100 text-[11px] text-emerald-800 font-bold flex items-center gap-1">
                      <span>✓</span>
                      <span>{m.actionSummary.title}: {m.actionSummary.description}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Cayla Main Input Box with Voice & Text */}
        <form
          onSubmit={handleCaylaSubmit}
          className="relative flex items-center gap-2 bg-white border border-slate-300 hover:border-slate-400 focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/20 rounded-2xl p-2 sm:p-2.5 shadow-sm transition-all"
        >
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Ask Cayla about any client... (e.g. 'Which clients have payroll due this week?' or 'Prepare all ready payrolls')"
            className="flex-1 bg-transparent px-3 py-2 text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none font-medium"
          />

          <button
            type="button"
            onClick={handleVoiceSimulation}
            className={`p-2.5 rounded-xl transition-colors cursor-pointer ${
              isMicActive
                ? 'bg-rose-500 text-white animate-pulse'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 border border-slate-200'
            }`}
            title="Simulate Voice Prompt"
          >
            <Mic className="w-4 h-4" />
          </button>

          <button
            type="submit"
            disabled={!inputText.trim() || isProcessing}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-600/20 flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            {isProcessing ? (
              <CaylaPenMascot size="xs" isProcessing={true} />
            ) : (
              <Send className="w-4 h-4" />
            )}
            <span className="hidden sm:inline">Ask Cayla</span>
          </button>
        </form>

        {/* Quick Suggestion Chips */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <span className="text-[11px] font-bold text-slate-500 mr-1">Try:</span>
          {[
            'Which clients have payroll due this week?',
            'Prepare all ready payrolls',
            'How much PAYE is due across my clients?',
            'Check statutory tax deadlines',
            'How do I add a new client?',
          ].map((chip) => (
            <button
              key={chip}
              type="button"
              onClick={() => onSendMessage(chip)}
              className="text-[11px] font-semibold bg-white hover:bg-emerald-50 hover:text-emerald-800 hover:border-emerald-300 text-slate-700 border border-slate-200/90 px-3 py-1.5 rounded-xl transition-all shadow-2xs cursor-pointer"
            >
              &ldquo;{chip}&rdquo;
            </button>
          ))}
        </div>
      </div>

      {/* 3. Minimal Overview Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-1">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Total Clients</span>
          <div className="text-xl font-black text-slate-900 font-mono">{totalClients}</div>
          <span className="text-[10px] text-emerald-700 font-semibold">Active enterprise accounts</span>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-1">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Active Employees</span>
          <div className="text-xl font-black text-slate-900 font-mono">{totalEmployees}</div>
          <span className="text-[10px] text-slate-500">Across {totalClients} businesses</span>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-1">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Payrolls Due</span>
          <div className="text-xl font-black text-emerald-700 font-mono">{payrollsDue}</div>
          <span className="text-[10px] text-emerald-700 font-semibold">This pay cycle</span>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-1">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Ready for Approval</span>
          <div className="text-xl font-black text-blue-700 font-mono">{readyForApproval}</div>
          <span className="text-[10px] text-blue-700 font-semibold">Awaiting sign-off</span>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-1">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Needs Attention</span>
          <div className="text-xl font-black text-amber-700 font-mono">{needsAttention}</div>
          <span className="text-[10px] text-amber-700 font-semibold">Exceptions flagged</span>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-1">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Monthly Payroll Value</span>
          <div className="text-xl font-black text-slate-900 font-mono truncate">{formatCurrency(totalPayrollValue)}</div>
          <span className="text-[10px] text-slate-500 font-mono">Managed volume</span>
        </div>
      </div>

      {/* 4. "Needs Your Attention" Section (Actionable operational problems) */}
      {attentionItems.length > 0 && (
        <div className="bg-amber-50/70 border border-amber-200/80 rounded-3xl p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-amber-900">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              <h2 className="text-base font-black tracking-tight">Needs Your Attention ({attentionItems.length})</h2>
            </div>
            <span className="text-xs text-amber-700 font-bold">Automatic Cayla Exception Detection</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {attentionItems.map((item) => (
              <div
                key={item.id}
                className="bg-white p-4 rounded-2xl border border-amber-200/70 shadow-2xs space-y-3 flex flex-col justify-between"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-xs text-slate-900">{item.clientName}</span>
                    <span
                      className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full ${
                        item.severity === 'high'
                          ? 'bg-rose-100 text-rose-800'
                          : item.severity === 'medium'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {item.severity}
                    </span>
                  </div>
                  <h4 className="text-xs font-bold text-slate-800">{item.title}</h4>
                  <p className="text-[11px] text-slate-600 leading-snug">{item.description}</p>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                  <button
                    onClick={() => {
                      const c = clients.find((client) => client.id === item.clientId);
                      if (c) onSelectClient(c);
                    }}
                    className="text-[11px] text-slate-500 hover:text-slate-900 font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <span>Open Client</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => {
                      if (item.actionType === 'ask_cayla') {
                        onSendMessage(`Check approval status for ${item.clientName}`);
                      } else if (item.actionType === 'request_info') {
                        onSendMessage(`Request timesheet for ${item.clientName}`);
                      } else if (item.actionType === 'review') {
                        onSendMessage(`Review allowances for ${item.clientName}`);
                      } else {
                        onSendMessage(`Run payroll for ${item.clientName}`);
                      }
                    }}
                    className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-bold rounded-lg transition-colors cursor-pointer"
                  >
                    {item.actionLabel}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. Client Payroll Queue (Main Work Component) */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
              <span>Payroll Queue</span>
              <span className="text-xs bg-slate-100 text-slate-700 font-mono px-2 py-0.5 rounded-full font-bold">
                {filteredClients.length} Clients
              </span>
            </h2>
            <p className="text-xs text-slate-500">
              Operational work queue across your accounting portfolio
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Search */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search clients..."
                className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:border-emerald-600 focus:outline-none"
              />
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:border-emerald-600 focus:outline-none"
            >
              <option value="all">All Statuses</option>
              <option value="Ready to Run">Ready to Run</option>
              <option value="Ready for Approval">Ready for Approval</option>
              <option value="Waiting on Client">Waiting on Client</option>
              <option value="Missing Information">Missing Information</option>
              <option value="Approved">Approved</option>
            </select>
          </div>
        </div>

        {/* Client Queue Items List */}
        <div className="space-y-3">
          {filteredClients.length === 0 ? (
            <div className="p-12 text-center bg-slate-50/50 rounded-2xl border border-dashed border-slate-200 space-y-3">
              <Building2 className="w-10 h-10 text-slate-300 mx-auto" />
              <div className="text-sm font-bold text-slate-700">No clients found in queue</div>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                {clients.length === 0
                  ? 'Add your first client to start running automated payrolls, managing timesheets, and preparing statutory reports.'
                  : 'No clients match the current search or status filter.'}
              </p>
              {clients.length === 0 && (
                <button
                  type="button"
                  onClick={() => setIsAddClientOpen(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add New Client</span>
                </button>
              )}
            </div>
          ) : (
            filteredClients.map((client) => {
              const hasMissing = client.missingInformation && client.missingInformation.length > 0;
              return (
                <div
                  key={client.id}
                  className="p-4 bg-slate-50/70 hover:bg-slate-50 border border-slate-200/80 rounded-2xl transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-4 group"
                >
                  {/* Client Core Information */}
                  <div className="flex items-start sm:items-center gap-3.5">
                    <div className="w-11 h-11 rounded-2xl bg-white border border-slate-200 flex items-center justify-center font-black text-slate-900 text-sm shrink-0 shadow-2xs">
                      {client.name.slice(0, 2).toUpperCase()}
                    </div>

                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-extrabold text-sm text-slate-900 group-hover:text-emerald-700 transition-colors">
                          {client.name}
                        </span>
                        <span className="text-[10px] font-bold text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded-md">
                          {client.country} ({client.currency})
                        </span>
                        <span className="text-[10px] text-slate-500 font-medium">
                          • Assigned: <strong>{client.assignedTo || 'Unassigned'}</strong>
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 mt-1">
                        <span>{client.employeeCount} employees</span>
                        <span>•</span>
                        <span className="capitalize">{client.payFrequency}</span>
                        <span>•</span>
                        <span className="font-bold text-slate-700">Due: {client.nextPayrollDate || 'Not scheduled'}</span>
                        <span>•</span>
                        <span>Last: {client.lastPayroll || 'None'}</span>
                      </div>

                      {hasMissing && (
                        <div className="mt-1.5 text-[11px] text-amber-700 font-semibold flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          <span>{client.missingInformation?.join('; ')}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Status & Actions */}
                  <div className="flex flex-wrap items-center gap-3 self-end lg:self-center">
                    {/* Status Badge */}
                    <span
                      className={`text-[10px] font-extrabold px-3 py-1 rounded-full border uppercase tracking-wider font-mono ${getStatusBadgeStyle(
                        client.payrollStatus
                      )}`}
                    >
                      {client.payrollStatus}
                    </span>

                    {/* Primary Context Action */}
                    {client.payrollStatus === 'Ready to Run' && (
                      <button
                        onClick={() => onSelectClient(client)}
                        className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        <CaylaPenMascot size="xs" />
                        <span>Run Payroll</span>
                      </button>
                    )}

                    {client.payrollStatus === 'Waiting on Client' && (
                      <button
                        onClick={() => onSendMessage(`Request timesheet for ${client.name}`)}
                        className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        <Clock className="w-3.5 h-3.5" />
                        <span>Request Timesheet</span>
                      </button>
                    )}

                    {client.payrollStatus === 'Ready for Approval' && (
                      <button
                        onClick={() => onSelectClient(client)}
                        className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        <FileCheck2 className="w-3.5 h-3.5" />
                        <span>Review &amp; Approve</span>
                      </button>
                    )}

                    {client.payrollStatus === 'Approved' && (
                      <button
                        onClick={() => onSelectClient(client)}
                        className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Finalize &amp; Payslips</span>
                      </button>
                    )}

                    {/* Workspace Switcher Button */}
                    <button
                      onClick={() => onSelectClient(client)}
                      className="p-2 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 transition-colors cursor-pointer"
                      title="Open Isolated Client Workspace"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 6. Deadline View (Calendar / Timeline) */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-emerald-600" />
            <h2 className="text-base font-black text-slate-900">Payroll &amp; Statutory Deadlines</h2>
          </div>

          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-bold">
            <button
              onClick={() => setActiveDeadlineTab('this_week')}
              className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                activeDeadlineTab === 'this_week' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              This Week
            </button>
            <button
              onClick={() => setActiveDeadlineTab('next_week')}
              className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                activeDeadlineTab === 'next_week' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Next Week
            </button>
            <button
              onClick={() => setActiveDeadlineTab('today')}
              className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                activeDeadlineTab === 'today' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Today
            </button>
          </div>
        </div>

        {clients.filter((c) => c.nextPayrollDate).length === 0 ? (
          <div className="p-8 text-center bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
            <Clock className="w-7 h-7 text-slate-300 mx-auto mb-2" />
            <div className="text-xs font-bold text-slate-600">No scheduled payroll deadlines</div>
            <p className="text-[11px] text-slate-400 mt-1">
              Client pay dates and statutory deadlines will automatically appear here once scheduled.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            {clients
              .filter((c) => c.nextPayrollDate)
              .slice(0, 4)
              .map((c) => (
                <div key={c.id} className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
                  <span className="text-[10px] font-bold uppercase text-emerald-700">Due {c.nextPayrollDate}</span>
                  <div className="font-extrabold text-slate-900 truncate">{c.name}</div>
                  <div className="text-[11px] text-slate-500">
                    {c.payFrequency} • {c.employeeCount} workers ({formatCurrency(c.monthlyPayrollValue, c.currencySymbol)})
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* Modals */}
      <AddClientModal
        isOpen={isAddClientOpen}
        onClose={() => setIsAddClientOpen(false)}
        onAddClient={onAddNewClient}
      />

      <ClientInviteModal
        isOpen={!!selectedInviteClient}
        onClose={() => setSelectedInviteClient(null)}
        client={selectedInviteClient}
        onSendInvite={() => {}}
      />

      <BatchPayrollModal
        isOpen={isBatchModalOpen}
        onClose={() => setIsBatchModalOpen(false)}
        clients={clients}
        onCompleteBatch={onUpdateClients}
      />
    </div>
  );
};
