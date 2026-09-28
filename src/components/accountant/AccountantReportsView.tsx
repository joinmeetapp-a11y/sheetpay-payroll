import React, { useState } from 'react';
import { AccountantClient } from '../../types';
import { formatCurrency } from '../../lib/taxEngine';
import {
  Download,
  Building2,
  TrendingUp,
  Landmark,
} from 'lucide-react';
import { CaylaPenMascot } from '../CaylaPenMascot';

interface AccountantReportsViewProps {
  clients: AccountantClient[];
  onSelectClient?: (clientOrId: any) => void;
}

function getLatestPayrollTotals(client: AccountantClient) {
  const run = client.payrollRun || client.payrollRuns?.[client.payrollRuns.length - 1];
  const employees = run?.employees || [];
  const sum = (field: 'grossPay' | 'paye' | 'nis' | 'healthSurcharge' | 'otherDeductions' | 'netPay') =>
    employees.reduce((total, employee) => total + (Number(employee[field]) || 0), 0);
  return {
    gross: employees.length ? sum('grossPay') : Number(run?.grossPay) || 0,
    paye: employees.length ? sum('paye') : 0,
    nis: employees.length ? sum('nis') : Number(run?.totalNis) || 0,
    health: employees.length ? sum('healthSurcharge') : Number(run?.totalHealthSurcharge) || 0,
    net: employees.length ? sum('netPay') : Number(run?.netPay) || 0,
    employees: employees.length || Number(run?.employeesCount) || 0,
  };
}

export const AccountantReportsView: React.FC<AccountantReportsViewProps> = ({ clients = [] }) => {
  const [selectedPeriod, setSelectedPeriod] = useState('August 2026');
  const [exporting, setExporting] = useState(false);

  const totalGross = clients.reduce((acc, c) => acc + getLatestPayrollTotals(c).gross, 0);
  const totalEmployees = clients.reduce((acc, c) => acc + getLatestPayrollTotals(c).employees, 0);

  // Reports use the saved results from the current/most recent payroll run.
  // They never infer statutory amounts from a flat percentage of gross pay.
  const trinidadClients = clients.filter((c) => (c.country || '').includes('Trinidad') || (c.countryCode || '') === 'TT');
  const barbadosClients = clients.filter((c) => (c.country || '').includes('Barbados') || (c.countryCode || '') === 'BB');
  const guyanaClients = clients.filter((c) => (c.country || '').includes('Guyana') || (c.countryCode || '') === 'GY');
  const jamaicaClients = clients.filter((c) => (c.country || '').includes('Jamaica') || (c.countryCode || '') === 'JM');

  const sumTotals = (group: AccountantClient[], field: 'gross' | 'paye' | 'nis' | 'health' | 'net') =>
    group.reduce((acc, client) => acc + getLatestPayrollTotals(client)[field], 0);
  const trinidadGross = sumTotals(trinidadClients, 'gross');
  const trinidadPAYE = sumTotals(trinidadClients, 'paye');
  const trinidadNIS = sumTotals(trinidadClients, 'nis');
  const trinidadHealth = sumTotals(trinidadClients, 'health');
  const barbadosGross = sumTotals(barbadosClients, 'gross');
  const barbadosTax = sumTotals(barbadosClients, 'paye');
  const barbadosNIS = sumTotals(barbadosClients, 'nis');
  const guyanaGross = sumTotals(guyanaClients, 'gross');
  const guyanaTax = sumTotals(guyanaClients, 'paye');
  const guyanaNIS = sumTotals(guyanaClients, 'nis');
  const jamaicaGross = sumTotals(jamaicaClients, 'gross');
  const jamaicaTax = sumTotals(jamaicaClients, 'paye');
  const jamaicaNIS = sumTotals(jamaicaClients, 'nis');

  const totalPAYE = clients.reduce((acc, c) => acc + getLatestPayrollTotals(c).paye, 0);
  const totalNIS = clients.reduce((acc, c) => acc + getLatestPayrollTotals(c).nis, 0);
  const estimatedNet = clients.reduce((acc, c) => acc + getLatestPayrollTotals(c).net, 0);

  const handleExportAll = () => {
    if (clients.length === 0) return;
    setExporting(true);
    setTimeout(() => {
      setExporting(false);
      const csvContent =
        'data:text/csv;charset=utf-8,' +
        [
          ['Client Name', 'Country', 'Employees', 'Pay Frequency', 'Latest Run Gross', 'Latest Run Net', 'Assigned Accountant'].join(','),
          ...clients.map((c) =>
            [
              `"${c.name || c.companyName || ''}"`,
              `"${c.country || ''}"`,
              getLatestPayrollTotals(c).employees,
              c.payFrequency || 'monthly',
              getLatestPayrollTotals(c).gross,
              getLatestPayrollTotals(c).net,
              `"${c.assignedTo || 'Unassigned'}"`,
            ].join(',')
          ),
        ].join('\n');

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `Accountant_Payroll_Portfolio_${selectedPeriod.replace(' ', '_')}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }, 800);
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 md:px-8 py-6 space-y-6 select-none animate-in fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase tracking-wider">
              Cross-Client Intelligence
            </span>
            <span className="text-xs text-slate-400 font-medium">Practice Aggregates</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-1">
            Firm Portfolio Payroll Reports
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            Multi-client tax liabilities, statutory remittances, and gross-to-net reconciliation
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none"
          >
            <option value="August 2026">August 2026 (Active Period)</option>
            <option value="July 2026">July 2026</option>
            <option value="June 2026">June 2026</option>
            <option value="Q3 2026">Q3 2026 Aggregate</option>
          </select>

          <button
            onClick={handleExportAll}
            disabled={exporting || clients.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 active:scale-98 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
          >
            {exporting ? (
              <CaylaPenMascot size="xs" isProcessing={true} />
            ) : (
              <Download className="w-4 h-4" />
            )}
            <span>Export Master Register</span>
          </button>
        </div>
      </div>

      {/* Top Executive KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-2xs space-y-1">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Latest Run Gross</span>
          <div className="text-2xl font-black text-slate-900 font-mono">{formatCurrency(totalGross)}</div>
          <span className="text-xs text-emerald-700 font-semibold flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Across {clients.length} corporate clients</span>
          </span>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-2xs space-y-1">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Latest Run Net Pay</span>
          <div className="text-2xl font-black text-slate-900 font-mono">{formatCurrency(estimatedNet)}</div>
          <span className="text-xs text-slate-500">Disbursed to {totalEmployees} workers</span>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-2xs space-y-1">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Total Statutory PAYE</span>
          <div className="text-2xl font-black text-indigo-700 font-mono">{formatCurrency(totalPAYE)}</div>
          <span className="text-xs text-indigo-700 font-semibold">Government revenue remittance</span>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-2xs space-y-1">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Total National Insurance (NIS)</span>
          <div className="text-2xl font-black text-blue-700 font-mono">{formatCurrency(totalNIS)}</div>
          <span className="text-xs text-blue-700 font-semibold">Social security liabilities</span>
        </div>
      </div>

      {/* Statutory Authorities Remittance Grid */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 space-y-4 shadow-2xs">
        <div className="flex items-center gap-2">
          <Landmark className="w-5 h-5 text-emerald-700" />
          <h2 className="text-base font-black text-slate-900">Regional Statutory Breakdown ({selectedPeriod})</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-extrabold text-slate-900 text-sm">🇹🇹 Trinidad &amp; Tobago</span>
              <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded">
                {trinidadClients.length} Clients
              </span>
            </div>
            <div className="space-y-1 text-slate-600">
              <div className="flex justify-between">
                <span>PAYE (BIR Form):</span>
                <span className="font-mono font-bold text-slate-900">{formatCurrency(trinidadPAYE)}</span>
              </div>
              <div className="flex justify-between">
                <span>NIS (NIB Form):</span>
                <span className="font-mono font-bold text-slate-900">{formatCurrency(trinidadNIS)}</span>
              </div>
              <div className="flex justify-between">
                <span>Health Surcharge:</span>
                <span className="font-mono font-bold text-slate-900">{formatCurrency(trinidadHealth)}</span>
              </div>
            </div>
          </div>

          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-extrabold text-slate-900 text-sm">🇧🇧 Barbados</span>
              <span className="text-[10px] font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                {barbadosClients.length} Clients
              </span>
            </div>
            <div className="space-y-1 text-slate-600">
              <div className="flex justify-between">
                <span>BRA Income Tax:</span>
                <span className="font-mono font-bold text-slate-900">{formatCurrency(barbadosTax, '$')}</span>
              </div>
              <div className="flex justify-between">
                <span>NIS Contribution:</span>
                <span className="font-mono font-bold text-slate-900">{formatCurrency(barbadosNIS, '$')}</span>
              </div>
            </div>
          </div>

          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-extrabold text-slate-900 text-sm">🇬🇾 Guyana</span>
              <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded">
                {guyanaClients.length} Clients
              </span>
            </div>
            <div className="space-y-1 text-slate-600">
              <div className="flex justify-between">
                <span>GRA PAYE:</span>
                <span className="font-mono font-bold text-slate-900">{formatCurrency(guyanaTax, 'G$')}</span>
              </div>
              <div className="flex justify-between">
                <span>NIS Scheme:</span>
                <span className="font-mono font-bold text-slate-900">{formatCurrency(guyanaNIS, 'G$')}</span>
              </div>
            </div>
          </div>

          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-extrabold text-slate-900 text-sm">🇯🇲 Jamaica</span>
              <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded">
                {jamaicaClients.length} Clients
              </span>
            </div>
            <div className="space-y-1 text-slate-600">
              <div className="flex justify-between">
                <span>TAJ Income Tax:</span>
                <span className="font-mono font-bold text-slate-900">{formatCurrency(jamaicaTax, 'J$')}</span>
              </div>
              <div className="flex justify-between">
                <span>NIS &amp; NHT:</span>
                <span className="font-mono font-bold text-slate-900">{formatCurrency(jamaicaNIS, 'J$')}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Client-by-Client Cost & Payroll Comparison Table */}
      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-2xs">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="font-extrabold text-sm text-slate-900">Client Comparison Breakdown</h3>
          <span className="text-xs text-slate-500 font-mono">Sorted by Payroll Volume</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] border-b border-slate-200 tracking-wider">
              <tr>
                <th className="py-3 px-4">Business Entity</th>
                <th className="py-3 px-4">Country</th>
                <th className="py-3 px-4">Headcount</th>
                <th className="py-3 px-4">Gross Payroll</th>
                <th className="py-3 px-4">PAYE (latest run)</th>
                <th className="py-3 px-4">NIS (latest run)</th>
                <th className="py-3 px-4">Net pay (latest run)</th>
                <th className="py-3 px-4">Assigned Accountant</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {clients.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <Building2 className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    <div className="font-bold text-slate-600 text-xs">No client data in portfolio</div>
                    <p className="text-[11px] text-slate-400 mt-1">Add clients and execute payroll to view comparative statutory reports.</p>
                  </td>
                </tr>
              ) : (
                clients.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/80">
                    <td className="py-3 px-4 font-bold text-slate-900">{c.name || c.companyName}</td>
                    <td className="py-3 px-4">{c.country}</td>
                    <td className="py-3 px-4 font-mono">{c.employeeCount}</td>
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">{formatCurrency(getLatestPayrollTotals(c).gross, c.currencySymbol)}</td>
                    <td className="py-3 px-4 font-mono text-indigo-700">{formatCurrency(getLatestPayrollTotals(c).paye, c.currencySymbol)}</td>
                    <td className="py-3 px-4 font-mono text-blue-700">{formatCurrency(getLatestPayrollTotals(c).nis, c.currencySymbol)}</td>
                    <td className="py-3 px-4 font-mono text-emerald-700">{formatCurrency(getLatestPayrollTotals(c).net, c.currencySymbol)}</td>
                    <td className="py-3 px-4 text-slate-600">{c.assignedTo || 'Unassigned'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
