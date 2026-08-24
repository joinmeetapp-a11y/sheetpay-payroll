import React, { useState } from 'react';
import { AccountantClient, ClientInvitation } from '../../types';
import { formatCurrency } from '../../lib/taxEngine';
import {
  Building2,
  Users,
  Search,
  Plus,
  Mail,
  ExternalLink,
  SlidersHorizontal,
  LayoutGrid,
  List,
  ChevronRight,
  ShieldCheck,
  AlertTriangle,
  FileCheck2,
  Send,
  MoreVertical,
  CheckCircle2,
} from 'lucide-react';
import { CaylaPenMascot } from '../CaylaPenMascot';
import { AddClientModal } from './AddClientModal';
import { ClientInviteModal } from './ClientInviteModal';
import { getStatusBadgeStyle } from './AccountantDashboard';

interface ClientsViewProps {
  clients: AccountantClient[];
  onSelectClient: (client: AccountantClient) => void;
  onAddNewClient: (client: AccountantClient) => void;
  onUpdateClients: (updated: AccountantClient[]) => void;
}

export const ClientsView: React.FC<ClientsViewProps> = ({
  clients,
  onSelectClient,
  onAddNewClient,
  onUpdateClients,
}) => {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [countryFilter, setCountryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [frequencyFilter, setFrequencyFilter] = useState('all');
  const [isAddClientOpen, setIsAddClientOpen] = useState(false);
  const [selectedInviteClient, setSelectedInviteClient] = useState<AccountantClient | null>(null);

  const filtered = clients.filter((c) => {
    const search = (searchQuery || '').toLowerCase();
    const matchesSearch =
      (c.name || c.companyName || '').toLowerCase().includes(search) ||
      (c.contactName || '').toLowerCase().includes(search) ||
      (c.assignedTo || '').toLowerCase().includes(search);
    const matchesCountry = countryFilter === 'all' || c.country === countryFilter;
    const matchesStatus = statusFilter === 'all' || c.payrollStatus === statusFilter;
    const matchesFreq = frequencyFilter === 'all' || c.payFrequency === frequencyFilter;
    return matchesSearch && matchesCountry && matchesStatus && matchesFreq;
  });

  return (
    <div className="w-full max-w-7xl mx-auto px-4 md:px-8 py-6 space-y-6 select-none animate-in fade-in">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase tracking-wider">
              Client Portfolio
            </span>
            <span className="text-xs text-slate-400 font-medium">Tenant Directory</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-1">
            Client Directory ({clients.length} Entities)
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            Isolated tenant workspaces with dedicated tax rules and permissions
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-lg transition-colors cursor-pointer ${
                viewMode === 'grid' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
              }`}
              title="Grid View"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-lg transition-colors cursor-pointer ${
                viewMode === 'list' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
              }`}
              title="List View"
            >
              <List className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={() => setIsAddClientOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Client</span>
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-3.5 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by business name, contact, or assigned accountant..."
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:border-emerald-600 focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Country */}
          <select
            value={countryFilter}
            onChange={(e) => setCountryFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:border-emerald-600 focus:outline-none"
          >
            <option value="all">All Jurisdictions</option>
            <option value="Trinidad & Tobago">Trinidad &amp; Tobago</option>
            <option value="Barbados">Barbados</option>
            <option value="Guyana">Guyana</option>
            <option value="Jamaica">Jamaica</option>
          </select>

          {/* Pay Frequency */}
          <select
            value={frequencyFilter}
            onChange={(e) => setFrequencyFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:border-emerald-600 focus:outline-none"
          >
            <option value="all">All Pay Frequencies</option>
            <option value="monthly">Monthly</option>
            <option value="fortnightly">Fortnightly</option>
            <option value="weekly">Weekly</option>
          </select>

          {/* Status */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:border-emerald-600 focus:outline-none"
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

      {/* Grid View */}
      {viewMode === 'grid' ? (
        filtered.length === 0 ? (
          <div className="bg-white rounded-3xl border border-dashed border-slate-200 p-12 text-center space-y-3">
            <Building2 className="w-12 h-12 text-slate-300 mx-auto" />
            <h3 className="text-base font-bold text-slate-800">No client entities found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {clients.length === 0
                ? 'Your practice portfolio is currently clean. Add your first client to start automated multi-country payroll management.'
                : 'No clients match your filter criteria.'}
            </p>
            {clients.length === 0 && (
              <button
                onClick={() => setIsAddClientOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add First Client</span>
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((client) => {
              const hasMissing = client.missingInformation && client.missingInformation.length > 0;
              return (
                <div
                  key={client.id}
                  className="bg-white rounded-3xl border border-slate-200/90 shadow-2xs hover:shadow-md transition-all p-5 flex flex-col justify-between space-y-4 group"
                >
                  <div className="space-y-3">
                    {/* Top line */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-2xl bg-emerald-50 border border-emerald-100 text-emerald-800 font-black flex items-center justify-center text-sm shadow-2xs">
                          {client.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <h3 className="font-black text-sm text-slate-900 group-hover:text-emerald-700 transition-colors line-clamp-1">
                            {client.name}
                          </h3>
                          <div className="text-[11px] text-slate-500 flex items-center gap-1 font-medium">
                            <span>{client.country}</span>
                            <span>•</span>
                            <span className="font-mono font-bold">{client.currency}</span>
                          </div>
                        </div>
                      </div>

                      <span
                        className={`text-[9px] font-extrabold px-2.5 py-0.5 rounded-full border uppercase tracking-wider font-mono ${getStatusBadgeStyle(
                          client.payrollStatus
                        )}`}
                      >
                        {client.payrollStatus}
                      </span>
                    </div>

                    {/* Operational Metrics */}
                    <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-slate-400 text-[10px] font-bold block uppercase">Employees</span>
                        <span className="font-black text-slate-900 font-mono text-sm">{client.employeeCount}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[10px] font-bold block uppercase">Schedule</span>
                        <span className="font-bold text-slate-800 capitalize text-xs">{client.payFrequency}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[10px] font-bold block uppercase">Next Due</span>
                        <span className="font-bold text-emerald-800 text-xs">{client.nextPayrollDate || 'Not set'}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[10px] font-bold block uppercase">Monthly Vol</span>
                        <span className="font-bold text-slate-900 font-mono text-xs">{formatCurrency(client.monthlyPayrollValue, client.currencySymbol)}</span>
                      </div>
                    </div>

                    {/* Assigned & Missing Alerts */}
                    <div className="space-y-1.5 text-[11px]">
                      <div className="text-slate-500">
                        Assigned Accountant: <strong className="text-slate-800">{client.assignedTo || 'Unassigned'}</strong>
                      </div>
                      {hasMissing && (
                        <div className="text-amber-800 bg-amber-50 border border-amber-200/70 p-2 rounded-xl flex items-center gap-1.5 font-semibold">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          <span className="truncate">{client.missingInformation?.[0]}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Bottom Actions */}
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                    <button
                      onClick={() => setSelectedInviteClient(client)}
                      className="p-2 rounded-xl text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-bold"
                      title="Invite Client Portal User"
                    >
                      <Mail className="w-4 h-4" />
                      <span>Invite</span>
                    </button>

                    <button
                      onClick={() => onSelectClient(client)}
                      className="px-4 py-2 bg-slate-900 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer ml-auto"
                    >
                      <CaylaPenMascot size="xs" />
                      <span>Work on Client</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : (
        /* List View */
        <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] border-b border-slate-200 tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">Client Name</th>
                  <th className="py-3.5 px-4">Country</th>
                  <th className="py-3.5 px-4">Frequency</th>
                  <th className="py-3.5 px-4">Staff</th>
                  <th className="py-3.5 px-4">Next Due</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Assigned</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-slate-400">
                      No client entities found.
                    </td>
                  </tr>
                ) : (
                  filtered.map((client) => (
                    <tr key={client.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-bold text-slate-900 flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-800 font-bold flex items-center justify-center text-[10px]">
                          {client.name.slice(0, 2).toUpperCase()}
                        </div>
                        <span>{client.name}</span>
                      </td>
                      <td className="py-3 px-4">{client.country}</td>
                      <td className="py-3 px-4 capitalize">{client.payFrequency}</td>
                      <td className="py-3 px-4 font-mono font-bold">{client.employeeCount}</td>
                      <td className="py-3 px-4 font-semibold text-slate-900">{client.nextPayrollDate || 'Not set'}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full border uppercase tracking-wider font-mono ${getStatusBadgeStyle(
                            client.payrollStatus
                          )}`}
                        >
                          {client.payrollStatus}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-600">{client.assignedTo || 'Unassigned'}</td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setSelectedInviteClient(client)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-700 hover:bg-slate-100"
                            title="Invite Portal User"
                          >
                            <Mail className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => onSelectClient(client)}
                            className="px-3 py-1 bg-slate-900 hover:bg-emerald-600 text-white font-bold rounded-lg text-[11px] flex items-center gap-1"
                          >
                            <span>Open</span>
                            <ChevronRight className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

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
    </div>
  );
};
