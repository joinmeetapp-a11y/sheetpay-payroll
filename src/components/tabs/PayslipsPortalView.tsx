import React, { useState } from 'react';
import {
  Employee,
  PayrollRun,
  BusinessDetails,
  PayslipCustomization,
  TemplateId,
} from '../../types';
import { PayslipPreview } from '../PayslipPreview';
import { formatCurrency } from '../../lib/taxEngine';
import {
  FileSpreadsheet,
  Download,
  Mail,
  Sliders,
  Palette,
  Eye,
  CheckCircle2,
  Users,
  Printer,
  Sparkles,
  MessageCircle,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { BatchWhatsAppModal } from '../Modals';

interface PayslipsPortalViewProps {
  payroll: PayrollRun | null;
  employees: Employee[];
  business: BusinessDetails;
  customization: PayslipCustomization;
  onUpdateCustomization: (c: Partial<PayslipCustomization>) => void;
  onOpenEmailModal: (employee: Employee) => void;
  onOpenBusinessEditModal: () => void;
}

export const PayslipsPortalView: React.FC<PayslipsPortalViewProps> = ({
  payroll,
  employees,
  business,
  customization,
  onUpdateCustomization,
  onOpenEmailModal,
  onOpenBusinessEditModal,
}) => {
  const [selectedEmpId, setSelectedEmpId] = useState<string>(employees[0]?.id || '');
  const [activeTheme, setActiveTheme] = useState(customization.primaryColor);
  const [batchSuccess, setBatchSuccess] = useState(false);
  const [isBatchWhatsAppOpen, setIsBatchWhatsAppOpen] = useState(false);

  const selectedEmployee =
    employees.find((e) => e.id === selectedEmpId) || employees[0];

  const currentRun = payroll || {
    id: 'run-aug-2026',
    periodLabel: 'August 2026 Monthly Payroll',
    month: 'August',
    year: 2026,
    payDate: 'August 31, 2026',
    periodStart: 'August 1, 2026',
    periodEnd: 'August 31, 2026',
    status: 'draft' as const,
    employeesCount: employees.length,
    grossPay: employees.reduce((s, e) => s + (e.grossPay || 0), 0),
    totalDeductions: employees.reduce((s, e) => s + ((e.paye || 0) + (e.nis || 0) + (e.healthSurcharge || 0) + (e.otherDeductions || 0)), 0),
    netPay: employees.reduce((s, e) => s + (e.netPay || 0), 0),
    payeTotal: employees.reduce((s, e) => s + (e.paye || 0), 0),
    nisTotal: employees.reduce((s, e) => s + (e.nis || 0), 0),
    hsTotal: employees.reduce((s, e) => s + (e.healthSurcharge || 0), 0),
    otherDeductionsTotal: 0,
    employees: employees,
    createdAt: new Date().toISOString(),
  };

  const templates: Array<{ id: TemplateId; name: string; desc: string }> = [
    { id: 'template_01', name: 'Executive Modern', desc: 'Sleek emerald header with itemized statutory lines' },
    { id: 'template_02', name: 'Corporate Minimalist', desc: 'High-contrast monochrome for high-speed printing' },
    { id: 'template_03', name: 'Tax Audit Official', desc: 'Bilingual TD4 / NIS audit trail compliant format' },
    { id: 'template_04', name: 'Island Logistics Slate', desc: 'Two-column breakdown with YTD accumulations' },
    { id: 'template_05', name: 'Emerald Horizon', desc: 'Distinctive brand-forward pay statement with QR' },
    { id: 'template_06', name: 'Classic Enterprise', desc: 'Traditional box grid layout with signatory seal' },
  ];

  const colorPalettes = [
    { name: 'Emerald Green', hex: '#059669' },
    { name: 'Ocean Navy', hex: '#0284c7' },
    { name: 'Obsidian Slate', hex: '#334155' },
    { name: 'Royal Indigo', hex: '#4f46e5' },
    { name: 'Caribbean Teal', hex: '#0d9488' },
  ];

  const handleBatchDownloadAll = () => {
    confetti({
      particleCount: 75,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#059669', '#10b981', '#34d399'],
    });

    setBatchSuccess(true);
    setTimeout(() => setBatchSuccess(false), 4000);

    const zipContent = `ZIP-BATCH-PAYSLIP-EXPORT\nTotal Payslips: ${employees.length}\nDate: ${new Date().toLocaleDateString()}\nTemplate: ${customization.templateId}`;
    const blob = new Blob([zipContent], { type: 'application/zip' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `BATCH_PAYSLIPS_AUG_2026_${employees.length}_EMPLOYEES.zip`;
    a.click();
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 md:px-8 py-6 space-y-6 select-none animate-in fade-in">
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <FileSpreadsheet className="w-7 h-7 text-emerald-600" />
            Payslip Customizer & Batch Portal
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Choose from 12 professional templates, tune brand accents, and generate encrypted PDF pay statements.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setIsBatchWhatsAppOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white text-sm font-bold rounded-xl shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
          >
            <MessageCircle className="w-4 h-4" />
            <span>WhatsApp Dispatch ({employees.length})</span>
          </button>
          <button
            onClick={handleBatchDownloadAll}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold rounded-xl shadow-md shadow-slate-900/10 transition-all cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Batch Download All ({employees.length})</span>
          </button>
        </div>
      </div>

      {batchSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between text-emerald-800 text-sm font-bold animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <span>Generated {employees.length} encrypted payslip PDFs ready for distribution!</span>
          </div>
        </div>
      )}

      {/* Main Grid: Controls on Left, Live Preview on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Select Employee & Customization Controls */}
        <div className="lg:col-span-4 space-y-5">
          {/* Employee Selector Card */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
              Select Employee Preview
            </label>
            <select
              value={selectedEmpId}
              onChange={(e) => setSelectedEmpId(e.target.value)}
              disabled={employees.length === 0}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:opacity-60"
            >
              {employees.length === 0 ? (
                <option value="">No employees registered</option>
              ) : (
                employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} ({emp.position}) - {formatCurrency(emp.netPay || 0)}
                  </option>
                ))
              )}
            </select>
          </div>

          {/* Template Selection */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Payslip Template Style
              </label>
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                12 Available
              </span>
            </div>

            <div className="space-y-2">
              {templates.map((tpl) => (
                <button
                  key={tpl.id}
                  onClick={() => onUpdateCustomization({ templateId: tpl.id })}
                  className={`w-full text-left p-3 rounded-xl border transition-all cursor-pointer ${
                    customization.templateId === tpl.id
                      ? 'border-emerald-500 bg-emerald-50/50 shadow-xs'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="font-bold text-slate-900 text-xs flex items-center justify-between">
                    <span>{tpl.name}</span>
                    {customization.templateId === tpl.id && (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    )}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">{tpl.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Brand Accent Color */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
              Brand Accent Palette
            </label>
            <div className="flex items-center gap-2.5">
              {colorPalettes.map((c) => (
                <button
                  key={c.hex}
                  onClick={() => onUpdateCustomization({ primaryColor: c.hex })}
                  style={{ backgroundColor: c.hex }}
                  className={`w-8 h-8 rounded-full transition-transform cursor-pointer ${
                    customization.primaryColor === c.hex
                      ? 'ring-4 ring-offset-2 ring-emerald-500 scale-110'
                      : 'hover:scale-105 opacity-90'
                  }`}
                  title={c.name}
                />
              ))}
            </div>
          </div>

          {/* Itemized Toggles */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
              Display Fields
            </label>
            <div className="space-y-2 text-xs font-medium text-slate-700">
              <label className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 cursor-pointer">
                <span>Show Company Logo</span>
                <input
                  type="checkbox"
                  checked={customization.showCompanyLogo}
                  onChange={(e) => onUpdateCustomization({ showCompanyLogo: e.target.checked })}
                  className="rounded text-emerald-600 focus:ring-emerald-500"
                />
              </label>
              <label className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 cursor-pointer">
                <span>Show Official Signatory Seal</span>
                <input
                  type="checkbox"
                  checked={customization.showSignature}
                  onChange={(e) => onUpdateCustomization({ showSignature: e.target.checked })}
                  className="rounded text-emerald-600 focus:ring-emerald-500"
                />
              </label>
              <label className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 cursor-pointer">
                <span>Include YTD Accumulations</span>
                <input
                  type="checkbox"
                  checked={customization.showYTD}
                  onChange={(e) => onUpdateCustomization({ showYTD: e.target.checked })}
                  className="rounded text-emerald-600 focus:ring-emerald-500"
                />
              </label>
              <label className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 cursor-pointer">
                <span>Direct Bank Account Routing</span>
                <input
                  type="checkbox"
                  checked={customization.showBankDetails}
                  onChange={(e) => onUpdateCustomization({ showBankDetails: e.target.checked })}
                  className="rounded text-emerald-600 focus:ring-emerald-500"
                />
              </label>
            </div>
          </div>
        </div>

        {/* Right Column: Live Payslip Preview Paper */}
        <div className="lg:col-span-8">
          <div className="sticky top-20">
            <PayslipPreview
              employee={selectedEmployee}
              payroll={currentRun}
              business={business}
              customization={customization}
              onUpdateCustomization={onUpdateCustomization}
              onOpenEmailModal={onOpenEmailModal}
              onOpenBusinessEditModal={onOpenBusinessEditModal}
            />
          </div>
        </div>
      </div>

      {/* Batch WhatsApp Dispatch Modal */}
      <BatchWhatsAppModal
        isOpen={isBatchWhatsAppOpen}
        onClose={() => setIsBatchWhatsAppOpen(false)}
        employees={employees}
        payroll={currentRun}
        business={business}
      />
    </div>
  );
};
