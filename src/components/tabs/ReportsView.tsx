import React from 'react';
import { Employee, BusinessDetails, PayrollRun } from '../../types';
import { formatCurrency } from '../../lib/taxEngine';
import {
  FileBarChart,
  Download,
  TrendingUp,
  PieChart as PieIcon,
  DollarSign,
  Building,
  ShieldCheck,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

interface ReportsViewProps {
  employees: Employee[];
  business: BusinessDetails;
  currentPayroll: PayrollRun | null;
}

export const ReportsView: React.FC<ReportsViewProps> = ({
  employees,
  business,
  currentPayroll,
}) => {
  const totalGross = employees.reduce((s, e) => s + (e.grossPay || 0), 0);
  const totalNet = employees.reduce((s, e) => s + (e.netPay || 0), 0);
  const totalPaye = employees.reduce((s, e) => s + (e.paye || 0), 0);
  const totalNis = employees.reduce((s, e) => s + (e.nis || 0), 0);
  const totalHs = employees.reduce((s, e) => s + (e.healthSurcharge || 0), 0);
  const totalOt = employees.reduce((s, e) => s + ((e.overtimeHours || 0) * (e.overtimeRate || 0) * 1.5), 0);

  // Department Distribution Data
  const deptMap: Record<string, number> = {};
  employees.forEach((emp) => {
    const dept = emp.department || 'General';
    deptMap[dept] = (deptMap[dept] || 0) + (emp.grossPay || 0);
  });

  const departmentData = Object.keys(deptMap).map((dept) => ({
    name: dept,
    value: deptMap[dept],
  }));

  // Historical Payroll Trends
  const trendData = [
    { month: 'Apr', gross: 0, net: 0, tax: 0 },
    { month: 'May', gross: 0, net: 0, tax: 0 },
    { month: 'Jun', gross: 0, net: 0, tax: 0 },
    { month: 'Jul', gross: 0, net: 0, tax: 0 },
    { month: 'Aug (Current)', gross: totalGross, net: totalNet, tax: totalPaye + totalNis + totalHs },
  ];

  // Statutory Breakdown Data for Pie Chart
  const statutoryPieData = [
    { name: 'Net Salary', value: totalNet, color: '#10b981' },
    { name: 'PAYE Income Tax', value: totalPaye, color: '#f59e0b' },
    { name: 'NIS Contribution', value: totalNis, color: '#06b6d4' },
    { name: 'Health Surcharge', value: totalHs, color: '#6366f1' },
  ];

  const COLORS = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ec4899'];

  const handleExportCsv = () => {
    const headers = 'Employee ID,Name,Department,Position,Basic Pay,Overtime Hours,Gross Pay,PAYE,NIS,Health Surcharge,Net Pay\n';
    const rows = employees
      .map(
        (e) =>
          `"${e.employeeId || ''}","${e.name || ''}","${e.department || ''}","${e.position || ''}",${e.basicPay || 0},${e.overtimeHours || 0},${e.grossPay || 0},${e.paye || 0},${e.nis || 0},${e.healthSurcharge || 0},${e.netPay || 0}`
      )
      .join('\n');
    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `PAYROLL_ANALYTICS_REPORT_AUG_2026.csv`;
    a.click();
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 md:px-8 py-6 space-y-6 select-none animate-in fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <FileBarChart className="w-7 h-7 text-emerald-600" />
            Payroll & Tax Analytics
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Visual breakdown of company payroll expenditures, department cost allocations, and statutory tax liabilities.
          </p>
        </div>

        <button
          onClick={handleExportCsv}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
        >
          <Download className="w-4 h-4" />
          <span>Export Analytics CSV</span>
        </button>
      </div>

      {/* Metric Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="text-xs font-bold text-slate-400 uppercase">Gross Payroll Spend</div>
          <div className="text-2xl font-black text-slate-900 font-mono mt-1">{formatCurrency(totalGross)}</div>
          <div className="text-xs text-emerald-700 font-semibold mt-1 flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5" /> +2.4% vs July
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="text-xs font-bold text-slate-400 uppercase">Direct Net Disbursed</div>
          <div className="text-2xl font-black text-emerald-600 font-mono mt-1">{formatCurrency(totalNet)}</div>
          <div className="text-xs text-slate-500 font-medium mt-1">ACH Transferred</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="text-xs font-bold text-slate-400 uppercase">Total Tax & NIS Remittance</div>
          <div className="text-2xl font-black text-amber-600 font-mono mt-1">
            {formatCurrency(totalPaye + totalNis + totalHs)}
          </div>
          <div className="text-xs text-slate-500 font-medium mt-1">BIR & NIB Legal Compliance</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="text-xs font-bold text-slate-400 uppercase">Overtime Premium Spend</div>
          <div className="text-2xl font-black text-slate-900 font-mono mt-1">{formatCurrency(totalOt)}</div>
          <div className="text-xs text-slate-500 font-medium mt-1">Time-and-a-half (1.5x)</div>
        </div>
      </div>

      {/* Visual Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Monthly Payroll Expenditure Trend */}
        <div className="lg:col-span-7 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h2 className="text-base font-bold text-slate-900 mb-1">Monthly Payroll Trend (TTD)</h2>
          <p className="text-xs text-slate-500 mb-4">Gross Earnings vs Net Disbursement vs Tax Obligations</p>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v / 1000}k`} />
                <Tooltip
                  formatter={(value: any) => [`TTD $${Number(value).toLocaleString()}`, '']}
                  contentStyle={{ borderRadius: '12px', fontSize: '12px' }}
                />
                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                <Bar dataKey="gross" name="Gross Pay" fill="#059669" radius={[4, 4, 0, 0]} />
                <Bar dataKey="net" name="Net Pay" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="tax" name="Statutory Deductions" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Statutory Deductions Distribution */}
        <div className="lg:col-span-5 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h2 className="text-base font-bold text-slate-900 mb-1">Payroll Distribution Ratio</h2>
          <p className="text-xs text-slate-500 mb-4">Share of Net wages vs BIR PAYE vs NIS</p>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statutoryPieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={95}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {statutoryPieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: any) => [`TTD $${Number(value).toLocaleString()}`, '']}
                  contentStyle={{ borderRadius: '12px', fontSize: '12px' }}
                />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
