import React, { useState } from 'react';
import { AccountantClient, Employee } from '../../types';
import {
  Building2,
  X,
  ArrowRight,
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  Users,
  ShieldCheck,
  Calendar,
} from 'lucide-react';
import { CaylaPenMascot } from '../CaylaPenMascot';

interface AddClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddClient: (newClient: AccountantClient) => void;
}

export const AddClientModal: React.FC<AddClientModalProps> = ({
  isOpen,
  onClose,
  onAddClient,
}) => {
  const [step, setStep] = useState<'details' | 'tax' | 'employees'>('details');

  const [name, setName] = useState('');
  const [country, setCountry] = useState('Trinidad & Tobago');
  const [countryCode, setCountryCode] = useState('TT');
  const [currency, setCurrency] = useState('TTD');
  const [currencySymbol, setCurrencySymbol] = useState('$');
  const [payFrequency, setPayFrequency] = useState<'monthly' | 'fortnightly' | 'weekly'>('monthly');
  const [nextPayrollDate, setNextPayrollDate] = useState('2026-08-31');
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [businessAddress, setBusinessAddress] = useState('');
  const [taxRegistrationId, setTaxRegistrationId] = useState('');
  const [nisNumber, setNisNumber] = useState('');
  const [signatoryName, setSignatoryName] = useState('');
  const [signatoryTitle, setSignatoryTitle] = useState('Managing Director');
  const [importMethod, setImportMethod] = useState<'manual' | 'csv' | 'upload_payroll' | 'payslips'>('csv');
  const [employeeCount, setEmployeeCount] = useState(10);
  const [assignedTo, setAssignedTo] = useState('Sarah Mohammed');

  if (!isOpen) return null;

  const handleCountryChange = (val: string) => {
    setCountry(val);
    if (val === 'Trinidad & Tobago') {
      setCountryCode('TT');
      setCurrency('TTD');
      setCurrencySymbol('$');
    } else if (val === 'Barbados') {
      setCountryCode('BB');
      setCurrency('BBD');
      setCurrencySymbol('$');
    } else if (val === 'Guyana') {
      setCountryCode('GY');
      setCurrency('GYD');
      setCurrencySymbol('$');
    } else if (val === 'Jamaica') {
      setCountryCode('JM');
      setCurrency('JMD');
      setCurrencySymbol('$');
    } else {
      setCountryCode('US');
      setCurrency('USD');
      setCurrencySymbol('$');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    // Generate starter employees
    const starterEmployees: Employee[] = Array.from({ length: employeeCount }).map((_, i) => ({
      id: `emp-${Date.now()}-${i}`,
      name: i === 0 ? (contactName || 'Lead Executive') : `Team Member ${i + 1}`,
      employeeId: `EMP-0${101 + i}`,
      position: i === 0 ? 'Managing Director' : 'Staff Associate',
      department: i % 2 === 0 ? 'Operations' : 'Administration',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80',
      email: `${(contactEmail ? contactEmail.split('@')[0] : 'employee')}${i + 1}@example.com`,
      phone: contactPhone || '+1 (868) 555-0100',
      birNumber: `109${84000 + i}-01`,
      ssnNumber: `77${49000 + i}`,
      payFrequency,
      basicPay: 8500 + i * 500,
      frequencySalary: 8500 + i * 500,
      overtimeHours: 0,
      overtimeRate: (8500 + i * 500) / 160,
      bonus: 0,
      commission: 0,
      allowances: 0,
      paye: Math.round((8500 + i * 500) * 0.12),
      nis: Math.round((8500 + i * 500) * 0.05),
      healthSurcharge: 33,
      otherDeductions: 0,
      grossPay: 8500 + i * 500,
      netPay: Math.round((8500 + i * 500) - ((8500 + i * 500) * 0.17 + 33)),
      status: 'pending',
    }));

    const client: AccountantClient = {
      id: `client-${Date.now()}`,
      name: name.trim(),
      country,
      countryCode,
      currency,
      currencySymbol,
      payFrequency,
      employeeCount,
      nextPayrollDate,
      payrollStatus: 'Ready to Run',
      missingInformation: [],
      monthlyPayrollValue: starterEmployees.reduce((acc, e) => acc + e.basicPay, 0),
      assignedTo,
      contactName: contactName || 'Primary Contact',
      contactEmail: contactEmail || 'contact@client.com',
      contactPhone: contactPhone || '+1 (868) 555-0100',
      businessAddress: businessAddress || 'Port of Spain, Trinidad',
      taxRegistrationId: taxRegistrationId || '10984920-01',
      nisNumber: nisNumber || '8839201',
      signatoryName: signatoryName || contactName || 'Authorized Officer',
      signatoryTitle: signatoryTitle || 'Managing Director',
      approvalStatus: 'not_requested',
      clientPermissions: ['view_payroll', 'upload_timesheets', 'approve_payroll', 'view_payslips'],
      employees: starterEmployees,
      payrollRun: null,
      notes: `New client onboarded via Accountant Wizard. Import method: ${importMethod}.`,
    };

    onAddClient(client);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto select-none">
      <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-auto animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h2 className="font-extrabold text-sm text-white flex items-center gap-2">
                <span>Onboard New Client Entity</span>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded font-mono">
                  Multi-Tenant
                </span>
              </h2>
              <p className="text-[11px] text-slate-400">Add an isolated enterprise client to your firm portfolio</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Indicator */}
        <div className="grid grid-cols-3 bg-slate-100 border-b border-slate-200 text-xs font-bold text-slate-600">
          <button
            onClick={() => setStep('details')}
            className={`py-3 text-center border-b-2 transition-colors cursor-pointer ${
              step === 'details' ? 'border-emerald-600 text-emerald-700 bg-white' : 'border-transparent'
            }`}
          >
            1. Business Details
          </button>
          <button
            onClick={() => setStep('tax')}
            className={`py-3 text-center border-b-2 transition-colors cursor-pointer ${
              step === 'tax' ? 'border-emerald-600 text-emerald-700 bg-white' : 'border-transparent'
            }`}
          >
            2. Tax &amp; Payroll Config
          </button>
          <button
            onClick={() => setStep('employees')}
            className={`py-3 text-center border-b-2 transition-colors cursor-pointer ${
              step === 'employees' ? 'border-emerald-600 text-emerald-700 bg-white' : 'border-transparent'
            }`}
          >
            3. Employee Import
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {step === 'details' && (
            <div className="space-y-4 animate-in fade-in">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Client Legal Business Name *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Atlantic Logistics &amp; Transport Ltd"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:border-emerald-600 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Operating Country</label>
                  <select
                    value={country}
                    onChange={(e) => handleCountryChange(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:border-emerald-600 focus:outline-none"
                  >
                    <option value="Trinidad & Tobago">🇹🇹 Trinidad &amp; Tobago (TTD)</option>
                    <option value="Barbados">🇧🇧 Barbados (BBD)</option>
                    <option value="Guyana">🇬🇾 Guyana (GYD)</option>
                    <option value="Jamaica">🇯🇲 Jamaica (JMD)</option>
                    <option value="United States">🇺🇸 United States (USD)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Assigned Firm Accountant</label>
                  <select
                    value={assignedTo}
                    onChange={(e) => setAssignedTo(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:border-emerald-600 focus:outline-none"
                  >
                    <option value="Sarah Mohammed">Sarah Mohammed (Firm Owner)</option>
                    <option value="Kevin Ramsaran">Kevin Ramsaran (Payroll Manager)</option>
                    <option value="Marcus Vance">Marcus Vance (Senior Accountant)</option>
                    <option value="Priya Singh">Priya Singh (Payroll Clerk)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Primary Contact Person</label>
                  <input
                    type="text"
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    placeholder="e.g. Darren Hosein"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:border-emerald-600 focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Client Email Address</label>
                  <input
                    type="email"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    placeholder="e.g. payroll@client.com"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:border-emerald-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Business Physical Address</label>
                <input
                  type="text"
                  value={businessAddress}
                  onChange={(e) => setBusinessAddress(e.target.value)}
                  placeholder="e.g. 14 Independence Square, Port of Spain"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:border-emerald-600 focus:outline-none"
                />
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => setStep('tax')}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <span>Next: Tax &amp; Schedule</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {step === 'tax' && (
            <div className="space-y-4 animate-in fade-in">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Pay Frequency</label>
                  <select
                    value={payFrequency}
                    onChange={(e) => setPayFrequency(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:border-emerald-600 focus:outline-none"
                  >
                    <option value="monthly">Monthly (12 periods/year)</option>
                    <option value="fortnightly">Fortnightly / Bi-Weekly (26 periods/year)</option>
                    <option value="weekly">Weekly (52 periods/year)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Next Upcoming Payroll Date</label>
                  <input
                    type="date"
                    value={nextPayrollDate}
                    onChange={(e) => setNextPayrollDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:border-emerald-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Tax / BIR Employer Registration</label>
                  <input
                    type="text"
                    value={taxRegistrationId}
                    onChange={(e) => setTaxRegistrationId(e.target.value)}
                    placeholder="e.g. 10948392-01"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:border-emerald-600 focus:outline-none font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">National Insurance (NIS) Employer ID</label>
                  <input
                    type="text"
                    value={nisNumber}
                    onChange={(e) => setNisNumber(e.target.value)}
                    placeholder="e.g. 8849204"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:border-emerald-600 focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Authorizing Signatory Full Name</label>
                  <input
                    type="text"
                    value={signatoryName}
                    onChange={(e) => setSignatoryName(e.target.value)}
                    placeholder="e.g. Darren Hosein"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:border-emerald-600 focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Signatory Title</label>
                  <input
                    type="text"
                    value={signatoryTitle}
                    onChange={(e) => setSignatoryTitle(e.target.value)}
                    placeholder="e.g. Managing Director"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:border-emerald-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-between">
                <button
                  type="button"
                  onClick={() => setStep('details')}
                  className="px-5 py-2.5 text-slate-600 hover:text-slate-900 font-bold text-xs cursor-pointer"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => setStep('employees')}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <span>Next: Employee Import</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {step === 'employees' && (
            <div className="space-y-4 animate-in fade-in">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">How would you like to onboard employees?</label>
                <p className="text-[11px] text-slate-500">Choose the fastest method to import client team records into Cayla.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  {
                    id: 'csv',
                    title: 'CSV / Excel Roster',
                    desc: 'Upload standard spreadsheet with salaries, NIS, and BIR IDs.',
                    icon: FileSpreadsheet,
                  },
                  {
                    id: 'upload_payroll',
                    title: 'Upload Existing Payroll File',
                    desc: 'Cayla parses legacy software exports (QuickBooks, Sage, Excel).',
                    icon: Upload,
                  },
                  {
                    id: 'payslips',
                    title: 'Upload Previous Payslips',
                    desc: 'Cayla extracts employee details directly from PDF payslips.',
                    icon: ShieldCheck,
                  },
                  {
                    id: 'manual',
                    title: 'Manual & Assisted',
                    desc: 'Create starter roster and edit directly in workspace.',
                    icon: Users,
                  },
                ].map((item) => {
                  const Icon = item.icon;
                  const isSelected = importMethod === item.id;
                  return (
                    <div
                      key={item.id}
                      onClick={() => setImportMethod(item.id as any)}
                      className={`p-3.5 rounded-2xl border transition-all cursor-pointer space-y-1.5 flex flex-col justify-between ${
                        isSelected
                          ? 'bg-emerald-50/90 border-emerald-500 ring-2 ring-emerald-500/20'
                          : 'bg-slate-50 hover:bg-white border-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Icon className={`w-4 h-4 ${isSelected ? 'text-emerald-600' : 'text-slate-500'}`} />
                          <span className="font-bold text-xs text-slate-900">{item.title}</span>
                        </div>
                        {isSelected && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                      </div>
                      <p className="text-[11px] text-slate-500 leading-snug">{item.desc}</p>
                    </div>
                  );
                })}
              </div>

              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                <div className="flex justify-between items-center text-xs font-bold text-slate-700">
                  <span>Initial Headcount:</span>
                  <span className="text-emerald-700 font-mono font-black text-sm">{employeeCount} Employees</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={50}
                  value={employeeCount}
                  onChange={(e) => setEmployeeCount(parseInt(e.target.value))}
                  className="w-full accent-emerald-600 cursor-pointer"
                />
              </div>

              <div className="pt-2 flex justify-between items-center">
                <button
                  type="button"
                  onClick={() => setStep('tax')}
                  className="px-5 py-2.5 text-slate-600 hover:text-slate-900 font-bold text-xs cursor-pointer"
                >
                  Back
                </button>
                <button
                  type="submit"
                  className="px-7 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-emerald-600/20 transition-all flex items-center gap-2 cursor-pointer"
                >
                  <CaylaPenMascot size="xs" />
                  <span>Create Client Workspace</span>
                </button>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};
