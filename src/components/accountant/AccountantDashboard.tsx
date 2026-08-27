import React, { useState, useRef, useEffect } from 'react';
import {
  AccountantClient,
  AttentionItem,
  BusinessDetails,
  CaylaMessage,
  Employee,
  FirmTeamMember,
  PayrollQueueStatus,
  PayrollRun,
} from '../../types';
import { formatCurrency } from '../../lib/taxEngine';
import {
  Building2,
  Users,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Search,
  Mic,
  Send,
  ChevronRight,
  Layers,
  FileCheck2,
  Plus,
  ExternalLink,
  Upload,
  FileSpreadsheet,
  UserPlus,
  Sparkles,
  X,
  ArrowRight,
  FileText,
} from 'lucide-react';
import { CaylaPenMascot } from '../CaylaPenMascot';
import { AddClientModal } from './AddClientModal';
import { ClientInviteModal } from './ClientInviteModal';
import { BatchPayrollModal } from './BatchPayrollModal';
import { AccountantImportModal } from './AccountantImportModal';

interface AccountantDashboardProps {
  userName?: string;
  firebaseUid?: string;
  clients?: AccountantClient[];
  teamMembers?: FirmTeamMember[];
  attentionItems?: AttentionItem[];
  batchJobs?: any[];
  activeClient?: AccountantClient | null;
  onSelectClient?: (clientOrId: any) => void;
  onRunBatchPayroll?: () => void;
  onAddNewClient?: (client: AccountantClient) => void;
  onOpenAddClient?: () => void;
  onOpenImport?: () => void;
  onGuestImport?: (
    business: BusinessDetails,
    employees: Employee[],
    payrollRuns: PayrollRun[]
  ) => void | Promise<void>;
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

type LaunchMethod = 'upload_payroll' | 'csv' | 'ask_cayla' | 'manual';

interface ImportLauncherProps {
  isOpen: boolean;
  onClose: () => void;
  onPick: (method: LaunchMethod) => void;
}

const ImportLauncher: React.FC<ImportLauncherProps> = ({ isOpen, onClose, onPick }) => {
  if (!isOpen) return null;

  const options: Array<{
    id: LaunchMethod;
    label: string;
    subtitle: string;
    Icon: React.ComponentType<{ className?: string }>;
    accent: string;
    bg: string;
  }> = [
    {
      id: 'upload_payroll',
      label: 'Upload Previous Payroll',
      subtitle: 'Drop a payroll report, payslip PDF, or export. Sheetpay reads it and prepares the client and employees for review.',
      Icon: Upload,
      accent: 'text-emerald-700',
      bg: 'bg-emerald-50 border-emerald-200 hover:border-emerald-400',
    },
    {
      id: 'csv',
      label: 'Upload Employee Spreadsheet',
      subtitle: 'CSV or Excel. Columns are auto-mapped to Sheetpay employee fields — no template required.',
      Icon: FileSpreadsheet,
      accent: 'text-blue-700',
      bg: 'bg-blue-50 border-blue-200 hover:border-blue-400',
    },
    {
      id: 'ask_cayla',
      label: 'Ask Cayla',
      subtitle: 'Describe the client in plain language. Cayla can set up the client and import employees from files you attach.',
      Icon: Sparkles,
      accent: 'text-amber-700',
      bg: 'bg-amber-50 border-amber-200 hover:border-amber-400',
    },
    {
      id: 'manual',
      label: 'Add Manually',
      subtitle: 'Type in the client details yourself. Best for a client with just a few employees you already know.',
      Icon: UserPlus,
      accent: 'text-slate-700',
      bg: 'bg-slate-50 border-slate-200 hover:border-slate-400',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="w-full max-w-3xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95">
        <div className="flex items-start justify-between p-6 border-b border-slate-100">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase tracking-wider">
              One file is enough
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight mt-2">
              Add Client / Import Payroll
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1">
              Pick how you want to bring this client into Sheetpay.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {options.map((opt) => {
            const Icon = opt.Icon;
            return (
              <button
                key={opt.id}
                onClick={() => onPick(opt.id)}
                className={`text-left rounded-2xl border p-4 transition-all cursor-pointer ${opt.bg} focus:outline-none focus:ring-2 focus:ring-emerald-500/30`}
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white border border-slate-200/80 flex items-center justify-center shrink-0 shadow-2xs">
                    <Icon className={`w-5 h-5 ${opt.accent}`} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                      {opt.label}
                      <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                    </div>
                    <p className="text-[11px] text-slate-600 mt-1 leading-relaxed font-medium">
                      {opt.subtitle}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="px-6 pb-5 -mt-1 text-[11px] text-slate-500 font-medium">
          Sheetpay reviews everything before it saves — no records are created without your confirmation.
        </div>
      </div>
    </div>
  );
};

export const AccountantDashboard: React.FC<AccountantDashboardProps> = ({
  userName = 'Accountant',
  firebaseUid,
  clients = [],
  teamMembers = [],
  attentionItems = [],
  activeClient = null,
  onSelectClient = (_client?: any) => {},
  onRunBatchPayroll = () => {},
  onAddNewClient = (_client: AccountantClient) => {},
  onOpenAddClient,
  onOpenImport,
  onGuestImport,
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
  const [isLauncherOpen, setIsLauncherOpen] = useState(false);
  const [isAddClientOpen, setIsAddClientOpen] = useState(false);
  const [addClientInitialMethod, setAddClientInitialMethod] = useState<
    'manual' | 'csv' | 'upload_payroll' | 'payslips' | undefined
  >(undefined);
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [selectedInviteClient, setSelectedInviteClient] = useState<AccountantClient | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);

  const caylaInputRef = useRef<HTMLInputElement | null>(null);

  const firstName = (userName || 'Accountant').split(' ')[0] || 'Accountant';

  const totalClients = clients.length;
  const totalEmployees = clients.reduce((acc, c) => acc + (c.employeeCount || 0), 0);
  const totalPayrollValue = clients.reduce((acc, c) => acc + (c.monthlyPayrollValue || 0), 0);
  const payrollsDue = clients.filter(
    (c) => c.payrollStatus && c.payrollStatus !== 'Completed' && c.payrollStatus !== 'Finalized'
  ).length;
  const readyForApproval = clients.filter(
    (c) => c.payrollStatus === 'Ready for Approval' || c.payrollStatus === 'Ready to Run'
  ).length;
  const needsAttention = attentionItems.length;
  const hasAnyData = totalClients > 0;

  const filteredClients = clients.filter((c) => {
    const search = (searchQuery || '').toLowerCase();
    const matchesSearch =
      (c.name || c.companyName || '').toLowerCase().includes(search) ||
      (c.country || '').toLowerCase().includes(search) ||
      (c.assignedTo || '').toLowerCase().includes(search);
    const matchesStatus = statusFilter === 'all' || c.payrollStatus === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const upcomingDeadlines = clients
    .filter((c) => c.nextPayrollDate)
    .slice(0, 4);

  const openLauncher = () => {
    setIsLauncherOpen(true);
  };

  const handleLauncherPick = (method: LaunchMethod) => {
    setIsLauncherOpen(false);
    if (method === 'ask_cayla') {
      focusCayla('Set up a new client for me. I can attach their existing payroll or employee file.');
      return;
    }
    if (method === 'upload_payroll' || method === 'csv') {
      if (onOpenImport) {
        onOpenImport();
        return;
      }
      // Guest funnel: onGuestImport signals the internal review modal should
      // handle upload + review, then hand the extraction to the parent to
      // save in the guest session (never production Convex).
      if (onGuestImport) {
        setIsImportModalOpen(true);
        return;
      }
      if (onOpenAddClient) {
        onOpenAddClient();
        return;
      }
      setIsImportModalOpen(true);
      return;
    }
    if (onOpenAddClient) {
      onOpenAddClient();
      return;
    }
    setAddClientInitialMethod(method);
    setIsAddClientOpen(true);
  };

  const focusCayla = (prefill?: string) => {
    if (prefill) setInputText(prefill);
    setTimeout(() => {
      caylaInputRef.current?.focus();
      caylaInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 50);
  };

  const handleCaylaSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isProcessing) return;
    onSendMessage(inputText.trim());
    setInputText('');
  };

  const handleVoiceSimulation = () => {
    setIsMicActive(true);
    setTimeout(() => setIsMicActive(false), 1200);
  };

  const closeQuickAdd = () => setIsQuickAddOpen(false);

  return (
    <div className="w-full max-w-7xl mx-auto px-4 md:px-8 py-6 space-y-6 select-none animate-in fade-in">

      {/* Header & Greeting */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase tracking-wider">
              Accountant
            </span>
            <span className="text-xs text-slate-400 font-medium">Sheetpay</span>
          </div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-slate-900 tracking-tight mt-1">
            Good day, {firstName} 👋
          </h1>
          <p className="text-xs md:text-sm text-slate-500 font-medium mt-0.5">
            Upload a file, review it, run payroll. That&apos;s the whole workflow.
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {readyForApproval > 0 && onOpenBatchPayroll && (
            <button
              onClick={onOpenBatchPayroll}
              className="inline-flex items-center justify-center gap-2 px-3 sm:px-4 py-2.5 bg-white hover:bg-slate-50 active:scale-98 text-slate-900 text-xs font-bold rounded-xl border border-slate-200 shadow-2xs transition-all cursor-pointer"
              title="Batch payroll runs"
            >
              <Layers className="w-4 h-4 shrink-0" />
              <span className="truncate">Batch ({readyForApproval})</span>
            </button>
          )}

          <button
            onClick={openLauncher}
            className="inline-flex items-center justify-center gap-2 px-3 sm:px-4 py-2.5 bg-slate-900 hover:bg-slate-800 active:scale-98 text-white text-xs font-bold rounded-xl shadow-md shadow-slate-900/10 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4 shrink-0" />
            <span className="truncate">Add Client / Import Payroll</span>
          </button>
        </div>
      </div>

      {/* Primary Import Card */}
      <div className="relative overflow-hidden bg-gradient-to-br from-emerald-600 via-emerald-700 to-emerald-800 text-white rounded-3xl p-6 sm:p-10 shadow-xl shadow-emerald-900/20 border border-emerald-500/20">
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-white/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -left-16 w-96 h-96 bg-emerald-900/30 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-6 lg:gap-10 items-center">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 border border-white/20 text-[11px] font-bold uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" /> One file is enough
            </div>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight leading-tight">
              Run payroll for a new client.
            </h2>
            <p className="text-sm sm:text-base text-emerald-50/90 leading-relaxed max-w-xl">
              Upload their existing payroll, employee spreadsheet, or payslips and
              Sheetpay will prepare everything for review — client, employees,
              salaries, statutory deductions.
            </p>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 pt-1">
              <button
                onClick={openLauncher}
                className="inline-flex items-center justify-center gap-2 px-5 py-3.5 bg-white text-emerald-800 hover:bg-emerald-50 active:scale-98 text-sm font-black rounded-2xl shadow-lg transition-all cursor-pointer"
              >
                <Upload className="w-4 h-4" />
                <span>Add Client / Import Payroll</span>
              </button>
              <button
                onClick={() => focusCayla('Set up a new client and import their employees for me.')}
                className="inline-flex items-center justify-center gap-2 px-5 py-3.5 bg-white/10 hover:bg-white/20 border border-white/25 text-white text-sm font-bold rounded-2xl transition-all cursor-pointer"
              >
                <CaylaPenMascot size="xs" />
                <span>Ask Cayla</span>
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-emerald-50/80 pt-1">
              <span className="inline-flex items-center gap-1.5"><FileText className="w-3.5 h-3.5" /> PDF payslips</span>
              <span className="inline-flex items-center gap-1.5"><FileSpreadsheet className="w-3.5 h-3.5" /> CSV / Excel</span>
              <span className="inline-flex items-center gap-1.5"><Upload className="w-3.5 h-3.5" /> Prior payroll exports</span>
            </div>
          </div>

          {/* Preview of the 4 launcher options */}
          <div className="hidden lg:grid grid-cols-2 gap-3">
            {[
              { Icon: Upload, label: 'Previous payroll' },
              { Icon: FileSpreadsheet, label: 'Employee sheet' },
              { Icon: Sparkles, label: 'Ask Cayla' },
              { Icon: UserPlus, label: 'Add manually' },
            ].map((opt) => (
              <div
                key={opt.label}
                className="bg-white/10 border border-white/20 rounded-2xl p-4 backdrop-blur-sm"
              >
                <opt.Icon className="w-5 h-5 mb-2" />
                <div className="text-xs font-bold">{opt.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Compact real-data stat strip */}
      {hasAnyData && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-1">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Clients</span>
            <div className="text-xl font-black text-slate-900 font-mono">{totalClients}</div>
          </div>
          <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-1">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Employees</span>
            <div className="text-xl font-black text-slate-900 font-mono">{totalEmployees}</div>
          </div>
          <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-1">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Payrolls Due</span>
            <div className="text-xl font-black text-emerald-700 font-mono">{payrollsDue}</div>
          </div>
          <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-1">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Needs Attention</span>
            <div className="text-xl font-black text-amber-700 font-mono">{needsAttention}</div>
          </div>
        </div>
      )}

      {/* Ask Cayla surface (compact) */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CaylaPenMascot size="xs" isProcessing={isProcessing} />
            <h2 className="text-sm sm:text-base font-black text-slate-900 tracking-tight">
              Ask Cayla
            </h2>
          </div>
          <span className="text-[11px] text-slate-500 font-semibold">
            Reuses your existing Sheetpay tax engine and OCR
          </span>
        </div>

        {messages.length > 0 && (
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 max-h-40 overflow-y-auto space-y-3 text-xs">
            {messages.slice(-3).map((m) => (
              <div
                key={m.id}
                className={`flex gap-2.5 ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {m.sender === 'cayla' && (
                  <div className="w-6 h-6 rounded-full bg-emerald-100 border border-emerald-200 flex items-center justify-center shrink-0 mt-0.5">
                    <CaylaPenMascot size="xs" />
                  </div>
                )}
                <div
                  className={`p-3 rounded-2xl max-w-xl text-xs leading-relaxed ${
                    m.sender === 'user'
                      ? 'bg-emerald-700 text-white font-semibold rounded-br-none'
                      : 'bg-white text-slate-800 border border-slate-200 rounded-bl-none font-medium'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{m.text}</p>
                  {m.actionSummary && (
                    <div className="mt-2 pt-2 border-t border-slate-100 text-[11px] text-emerald-800 font-bold">
                      ✓ {m.actionSummary.title}: {m.actionSummary.description}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <form
          onSubmit={handleCaylaSubmit}
          className="flex items-center gap-2 bg-white border border-slate-300 hover:border-slate-400 focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/20 rounded-2xl p-2 transition-all"
        >
          <input
            ref={caylaInputRef}
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="e.g. Create ABC Construction as a weekly payroll client…"
            className="flex-1 bg-transparent px-3 py-2 text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none font-medium"
          />
          <button
            type="button"
            onClick={handleVoiceSimulation}
            className={`p-2.5 rounded-xl transition-colors cursor-pointer ${
              isMicActive
                ? 'bg-rose-500 text-white animate-pulse'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200'
            }`}
            title="Voice"
          >
            <Mic className="w-4 h-4" />
          </button>
          <button
            type="submit"
            disabled={!inputText.trim() || isProcessing}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            {isProcessing ? <CaylaPenMascot size="xs" isProcessing={true} /> : <Send className="w-4 h-4" />}
            <span className="hidden sm:inline">Send</span>
          </button>
        </form>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-bold text-slate-500 mr-1">Try:</span>
          {[
            'Create ABC Construction as a weekly payroll client.',
            'Import these employees for Trini Builders.',
            'Which clients have payroll due this week?',
          ].map((chip) => (
            <button
              key={chip}
              type="button"
              onClick={() => onSendMessage(chip)}
              className="text-[11px] font-semibold bg-slate-50 hover:bg-emerald-50 hover:text-emerald-800 hover:border-emerald-300 text-slate-700 border border-slate-200 px-3 py-1.5 rounded-xl transition-all cursor-pointer"
            >
              &ldquo;{chip}&rdquo;
            </button>
          ))}
        </div>
      </div>

      {/* Needs Attention — only when there's real data */}
      {attentionItems.length > 0 && (
        <div className="bg-amber-50/70 border border-amber-200/80 rounded-3xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-amber-900">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              <h2 className="text-sm font-black tracking-tight">Needs Your Attention ({attentionItems.length})</h2>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {attentionItems.map((item) => (
              <div
                key={item.id}
                className="bg-white p-4 rounded-2xl border border-amber-200/70 shadow-2xs space-y-3"
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
                    className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-bold rounded-lg cursor-pointer"
                  >
                    {item.actionLabel || 'Take action'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Clients — real data only */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
              <Building2 className="w-4 h-4 text-slate-500" />
              <span>Your Clients</span>
              {hasAnyData && (
                <span className="text-xs bg-slate-100 text-slate-700 font-mono px-2 py-0.5 rounded-full font-bold">
                  {filteredClients.length}
                </span>
              )}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {hasAnyData ? 'Recent activity across your portfolio' : 'You haven’t added any clients yet.'}
            </p>
          </div>

          {hasAnyData && (
            <div className="flex flex-wrap items-center gap-2">
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
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:border-emerald-600 focus:outline-none"
              >
                <option value="all">All statuses</option>
                <option value="Ready to Run">Ready to Run</option>
                <option value="Ready for Approval">Ready for Approval</option>
                <option value="Waiting on Client">Waiting on Client</option>
                <option value="Missing Information">Missing Information</option>
                <option value="Approved">Approved</option>
              </select>
            </div>
          )}
        </div>

        {!hasAnyData ? (
          <div className="p-8 sm:p-12 text-center bg-slate-50/50 rounded-2xl border border-dashed border-slate-200 space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-200 mx-auto flex items-center justify-center">
              <Upload className="w-6 h-6 text-emerald-700" />
            </div>
            <div>
              <div className="text-sm font-black text-slate-900">No clients yet</div>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Add your first client by uploading their existing payroll — Sheetpay will read the file and prepare everything for review.
              </p>
            </div>
            <button
              type="button"
              onClick={openLauncher}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Client / Import Payroll</span>
            </button>
          </div>
        ) : filteredClients.length === 0 ? (
          <div className="p-8 text-center bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
            <div className="text-xs font-bold text-slate-600">No clients match this filter.</div>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredClients.map((client) => {
              const hasMissing = client.missingInformation && client.missingInformation.length > 0;
              return (
                <div
                  key={client.id}
                  className="p-4 bg-slate-50/70 hover:bg-slate-50 border border-slate-200/80 rounded-2xl flex flex-col lg:flex-row lg:items-center justify-between gap-4 group transition-all"
                >
                  <div className="flex items-start sm:items-center gap-3.5">
                    <div className="w-11 h-11 rounded-2xl bg-white border border-slate-200 flex items-center justify-center font-black text-slate-900 text-sm shrink-0 shadow-2xs">
                      {(client.name || 'CL').slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-extrabold text-sm text-slate-900 group-hover:text-emerald-700 transition-colors">
                          {client.name}
                        </span>
                        {client.country && (
                          <span className="text-[10px] font-bold text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded-md">
                            {client.country}{client.currency ? ` (${client.currency})` : ''}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-slate-500 mt-1">
                        <span>{client.employeeCount || 0} employees</span>
                        {client.payFrequency && <><span>•</span><span className="capitalize">{client.payFrequency}</span></>}
                        {client.nextPayrollDate && <><span>•</span><span className="font-bold text-slate-700">Next: {client.nextPayrollDate}</span></>}
                        {client.lastPayroll && <><span>•</span><span>Last: {client.lastPayroll}</span></>}
                      </div>
                      {hasMissing && (
                        <div className="mt-1.5 text-[11px] text-amber-700 font-semibold flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          <span>{client.missingInformation?.join('; ')}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 self-end lg:self-center">
                    {client.payrollStatus && (
                      <span
                        className={`text-[10px] font-extrabold px-3 py-1 rounded-full border uppercase tracking-wider font-mono ${getStatusBadgeStyle(
                          client.payrollStatus
                        )}`}
                      >
                        {client.payrollStatus}
                      </span>
                    )}

                    {client.payrollStatus === 'Ready to Run' && (
                      <button
                        onClick={() => onSelectClient(client)}
                        className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer"
                      >
                        <CaylaPenMascot size="xs" />
                        <span>Run Payroll</span>
                      </button>
                    )}
                    {client.payrollStatus === 'Waiting on Client' && (
                      <button
                        onClick={() => onSendMessage(`Request timesheet for ${client.name}`)}
                        className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer"
                      >
                        <Clock className="w-3.5 h-3.5" />
                        <span>Request Timesheet</span>
                      </button>
                    )}
                    {client.payrollStatus === 'Ready for Approval' && (
                      <button
                        onClick={() => onSelectClient(client)}
                        className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer"
                      >
                        <FileCheck2 className="w-3.5 h-3.5" />
                        <span>Review &amp; Approve</span>
                      </button>
                    )}
                    {client.payrollStatus === 'Approved' && (
                      <button
                        onClick={() => onSelectClient(client)}
                        className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Finalize</span>
                      </button>
                    )}
                    <button
                      onClick={() => onSelectClient(client)}
                      className="p-2 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 cursor-pointer"
                      title="Open client workspace"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Deadlines — only when real */}
      {upcomingDeadlines.length > 0 && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-emerald-600" />
              <h2 className="text-sm font-black text-slate-900">Upcoming Payroll</h2>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            {upcomingDeadlines.map((c) => (
              <div key={c.id} className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
                <span className="text-[10px] font-bold uppercase text-emerald-700">Due {c.nextPayrollDate}</span>
                <div className="font-extrabold text-slate-900 truncate">{c.name}</div>
                <div className="text-[11px] text-slate-500">
                  {c.payFrequency || 'monthly'} • {c.employeeCount || 0} workers
                  {c.monthlyPayrollValue ? ` • ${formatCurrency(c.monthlyPayrollValue, c.currencySymbol)}` : ''}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Persistent Quick Add (bottom-right, above mobile pill) */}
      <div className="fixed right-4 bottom-24 md:bottom-6 z-40">
        {isQuickAddOpen && (
          <div className="mb-2 w-64 bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden animate-in fade-in slide-in-from-bottom-2">
            <div className="px-4 py-2.5 text-[10px] font-black uppercase tracking-wider text-slate-500 border-b border-slate-100 bg-slate-50/50">
              Quick add
            </div>
            <button
              onClick={() => { closeQuickAdd(); openLauncher(); }}
              className="w-full flex items-center gap-2.5 px-4 py-3 text-left text-xs font-bold text-slate-800 hover:bg-slate-50 cursor-pointer"
            >
              <Plus className="w-4 h-4 text-slate-500" /> Add Client
            </button>
            <button
              onClick={() => { closeQuickAdd(); handleLauncherPick('upload_payroll'); }}
              className="w-full flex items-center gap-2.5 px-4 py-3 text-left text-xs font-bold text-slate-800 hover:bg-slate-50 cursor-pointer"
            >
              <Upload className="w-4 h-4 text-emerald-700" /> Import Payroll
            </button>
            <button
              onClick={() => { closeQuickAdd(); handleLauncherPick('csv'); }}
              className="w-full flex items-center gap-2.5 px-4 py-3 text-left text-xs font-bold text-slate-800 hover:bg-slate-50 cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4 text-blue-700" /> Upload Employees
            </button>
            <button
              onClick={() => { closeQuickAdd(); handleLauncherPick('manual'); }}
              className="w-full flex items-center gap-2.5 px-4 py-3 text-left text-xs font-bold text-slate-800 hover:bg-slate-50 cursor-pointer"
            >
              <UserPlus className="w-4 h-4 text-slate-700" /> Add Employee Manually
            </button>
            <button
              onClick={() => { closeQuickAdd(); focusCayla('Help me set up a new client.'); }}
              className="w-full flex items-center gap-2.5 px-4 py-3 text-left text-xs font-bold text-slate-800 hover:bg-slate-50 cursor-pointer border-t border-slate-100"
            >
              <Sparkles className="w-4 h-4 text-amber-600" /> Ask Cayla
            </button>
          </div>
        )}
        <button
          onClick={() => setIsQuickAddOpen((v) => !v)}
          className="w-14 h-14 rounded-full bg-slate-900 hover:bg-slate-800 text-white shadow-xl shadow-slate-900/30 flex items-center justify-center transition-all cursor-pointer active:scale-95"
          title="Quick add"
          aria-label="Quick add"
        >
          {isQuickAddOpen ? <X className="w-5 h-5" /> : <Plus className="w-6 h-6" />}
        </button>
      </div>

      {/* Modals */}
      <ImportLauncher
        isOpen={isLauncherOpen}
        onClose={() => setIsLauncherOpen(false)}
        onPick={handleLauncherPick}
      />

      <AddClientModal
        isOpen={isAddClientOpen}
        onClose={() => { setIsAddClientOpen(false); setAddClientInitialMethod(undefined); }}
        onAddClient={onAddNewClient}
        initialImportMethod={addClientInitialMethod}
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

      <AccountantImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        firebaseUid={firebaseUid}
        onClientImported={(client) => onAddNewClient(client)}
        onGuestImport={onGuestImport}
      />
    </div>
  );
};
