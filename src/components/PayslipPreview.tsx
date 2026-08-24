import React, { useRef, useState } from 'react';
import {
  BusinessDetails,
  Employee,
  PayrollRun,
  PayslipCustomization,
  TemplateId,
} from '../types';
import { formatCurrency } from '../lib/taxEngine';
import {
  Download,
  Mail,
  Printer,
  ShieldCheck,
  Check,
  QrCode,
  Building2,
  Calendar,
  CheckCircle2,
  FileCheck2,
  CreditCard,
  Hash,
  MessageCircle,
  Share2,
  FileImage,
  FileText,
  Copy,
  Sparkles,
} from 'lucide-react';
import {
  downloadPayslipImage,
  downloadPayslipPDF,
  sharePayslipViaWhatsApp,
  copyPayslipImageToClipboard,
  sharePayslipNative,
} from '../lib/payslipExporter';
import { WhatsAppShareModal, SharePayslipModal } from './Modals';

interface PayslipPreviewProps {
  employee: Employee;
  payroll: PayrollRun;
  business: BusinessDetails;
  customization: PayslipCustomization;
  onUpdateCustomization: (c: Partial<PayslipCustomization>) => void;
  onOpenEmailModal: (employee: Employee) => void;
  onOpenBusinessEditModal: () => void;
}

export const PayslipPreview: React.FC<PayslipPreviewProps> = ({
  employee,
  payroll,
  business,
  customization,
  onUpdateCustomization,
  onOpenEmailModal,
  onOpenBusinessEditModal,
}) => {
  const printContainerRef = useRef<HTMLDivElement>(null);
  const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isExporting, setIsExporting] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPNG = async () => {
    const el = document.getElementById('payslip-document-render');
    if (!el) return;
    setIsExporting('png');
    try {
      const filename = `Payslip_${employee.name.replace(/\s+/g, '_')}_${payroll.month}_${payroll.year}.png`;
      await downloadPayslipImage(el, filename);
      showToast(`Downloaded PNG image for ${employee.name}`);
    } catch (err) {
      console.error(err);
    } finally {
      setIsExporting(null);
    }
  };

  const handleDownloadPDF = async () => {
    const el = document.getElementById('payslip-document-render');
    if (!el) return;
    setIsExporting('pdf');
    try {
      const filename = `Payslip_${employee.name.replace(/\s+/g, '_')}_${payroll.month}_${payroll.year}.pdf`;
      await downloadPayslipPDF(el, filename);
      showToast(`Downloaded PDF document for ${employee.name}`);
    } catch (err) {
      console.error(err);
    } finally {
      setIsExporting(null);
    }
  };

  const handleCopyImage = async () => {
    const el = document.getElementById('payslip-document-render');
    if (!el) return;
    setIsExporting('copy');
    try {
      const ok = await copyPayslipImageToClipboard(el);
      if (ok) {
        showToast('Payslip image copied to clipboard! (Ready to paste in chat)');
      } else {
        // Fallback to downloading image
        const filename = `Payslip_${employee.name.replace(/\s+/g, '_')}.png`;
        await downloadPayslipImage(el, filename);
        showToast('Image downloaded (Clipboard permission unavailable)');
      }
    } finally {
      setIsExporting(null);
    }
  };

  const templatesList: { id: TemplateId; label: string; desc: string; previewColor: string; layoutDesc: string }[] = [
    { id: 'template_01', label: 'Template 01', desc: 'Cayla Emerald', previewColor: '#059669', layoutDesc: 'Fintech Dual-Card' },
    { id: 'template_02', label: 'Template 02', desc: 'Classic Corporate', previewColor: '#334155', layoutDesc: '3-Column Ledger' },
    { id: 'template_03', label: 'Template 03', desc: 'Minimalist Mono', previewColor: '#0f172a', layoutDesc: 'Clean Wireframe' },
    { id: 'template_04', label: 'Template 04', desc: 'Executive Navy', previewColor: '#1e3a8a', layoutDesc: 'Split Hero Payout' },
    { id: 'template_05', label: 'Template 05', desc: 'Modern Tabular', previewColor: '#0d9488', layoutDesc: 'Badge Grid Matrix' },
    { id: 'template_06', label: 'Template 06', desc: 'High-Density Audit', previewColor: '#475569', layoutDesc: 'Audit Itemized Grid' },
    { id: 'template_07', label: 'Template 07', desc: 'Editorial Serif', previewColor: '#78350f', layoutDesc: 'Crest & Parchment' },
    { id: 'template_08', label: 'Template 08', desc: 'Left-Sidebar Panel', previewColor: '#0284c7', layoutDesc: 'Vertical Sidebar Split' },
    { id: 'template_09', label: 'Template 09', desc: 'Perforated Studio', previewColor: '#4f46e5', layoutDesc: 'Official Receipt Stamp' },
    { id: 'template_10', label: 'Template 10', desc: 'Vibrant Ruby', previewColor: '#be123c', layoutDesc: 'Bold Contrast Hero' },
    { id: 'template_11', label: 'Template 11', desc: 'Dark Obsidian', previewColor: '#18181b', layoutDesc: 'Midnight Neon Glow' },
    { id: 'template_12', label: 'Template 12', desc: 'Govt TD4 Standard', previewColor: '#166534', layoutDesc: 'Official BIR Certified' },
  ];

  if (!employee) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[420px] h-full bg-slate-50/60 rounded-3xl border border-dashed border-slate-200 p-8 text-center space-y-3">
        <FileText className="w-12 h-12 text-slate-300 mx-auto" />
        <h3 className="text-base font-bold text-slate-800">No Employee Selected</h3>
        <p className="text-xs text-slate-500 max-w-sm mx-auto">
          Add employees to your company roster or select an employee from the directory to preview, customize, and export their payslip.
        </p>
      </div>
    );
  }

  const totalDeductions =
    (employee.paye || 0) + (employee.nis || 0) + (employee.healthSurcharge || 0) + (employee.otherDeductions || 0);

  return (
    <div className="flex flex-col h-full bg-slate-100/70 border-l border-slate-200 p-4 md:p-6 overflow-y-auto relative">
      {/* Toast feedback */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-2xl shadow-xl border border-slate-800 text-xs font-semibold flex items-center gap-2 animate-in slide-in-from-top duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
            Live Document Preview
          </span>
          <h3 className="text-sm font-bold text-slate-900 mt-1">
            {employee.name} — Payslip ({payroll.periodLabel})
          </h3>
        </div>

        {/* Action Buttons Hub */}
        <div className="flex flex-wrap items-center gap-1.5">
          {/* 1. Direct WhatsApp Share */}
          <button
            onClick={() => setIsWhatsAppModalOpen(true)}
            className="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm shadow-emerald-600/25 transition-all cursor-pointer"
            title="Share payslip image & advice to WhatsApp"
          >
            <MessageCircle className="w-3.5 h-3.5" />
            <span>WhatsApp</span>
          </button>

          {/* 2. Download Image (.PNG) */}
          <button
            onClick={handleDownloadPNG}
            disabled={isExporting === 'png'}
            className="p-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-slate-900 text-xs flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
            title="Download high-resolution image (.png)"
          >
            <FileImage className="w-3.5 h-3.5 text-emerald-600" />
            <span className="hidden sm:inline font-medium">PNG</span>
          </button>

          {/* 3. Download PDF */}
          <button
            onClick={handleDownloadPDF}
            disabled={isExporting === 'pdf'}
            className="p-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-slate-900 text-xs flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
            title="Download PDF document"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline font-medium">PDF</span>
          </button>

          {/* 4. Email Payslip */}
          <button
            onClick={() => onOpenEmailModal(employee)}
            className="p-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-slate-900 text-xs flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
            title="Email Payslip Advice"
          >
            <Mail className="w-3.5 h-3.5 text-blue-600" />
            <span className="hidden sm:inline font-medium">Email</span>
          </button>

          {/* 5. Print */}
          <button
            onClick={handlePrint}
            className="p-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-slate-900 text-xs flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
            title="Print Payslip"
          >
            <Printer className="w-3.5 h-3.5" />
            <span className="hidden md:inline font-medium">Print</span>
          </button>

          {/* 6. All Share Options */}
          <button
            onClick={() => setIsShareModalOpen(true)}
            className="p-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-slate-900 text-xs flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
            title="More Share Options"
          >
            <Share2 className="w-3.5 h-3.5 text-indigo-600" />
            <span className="hidden md:inline font-medium">Share</span>
          </button>

          {/* Company Details Edit */}
          <button
            onClick={onOpenBusinessEditModal}
            className="p-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-slate-900 text-xs flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
            title="Edit Business Details"
          >
            <span className="hidden lg:inline font-medium text-slate-500">Company Info</span>
          </button>
        </div>
      </div>

      {/* 12 Templates Selector Strip */}
      <div className="mb-5 bg-white p-3 rounded-2xl border border-slate-200/90 shadow-2xs space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            Select Professional Payslip Template ({templatesList.length} Layouts):
          </div>
          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
            {templatesList.find((t) => t.id === customization.templateId)?.layoutDesc}
          </span>
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
          {templatesList.map((tmpl) => {
            const isSelected = customization.templateId === tmpl.id;
            return (
              <button
                key={tmpl.id}
                onClick={() =>
                  onUpdateCustomization({
                    templateId: tmpl.id,
                    primaryColor: tmpl.previewColor,
                  })
                }
                className={`p-2 rounded-xl text-left border transition-all cursor-pointer flex flex-col justify-between relative group ${
                  isSelected
                    ? 'border-emerald-600 bg-emerald-50/50 shadow-xs ring-2 ring-emerald-500/20'
                    : 'border-slate-200 hover:border-slate-300 bg-slate-50/60 hover:bg-slate-100/80'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <div
                    className="w-3.5 h-3.5 rounded-full border border-white shadow-2xs"
                    style={{ backgroundColor: tmpl.previewColor }}
                  />
                  {isSelected && <Check className="w-3 h-3 text-emerald-600 font-bold" />}
                </div>
                <div>
                  <div className="font-bold text-[11px] text-slate-800 leading-tight">
                    {tmpl.label}
                  </div>
                  <div className="text-[9px] text-slate-500 font-medium truncate mt-0.5">
                    {tmpl.desc}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Printable Payslip Card Container */}
      <div
        ref={printContainerRef}
        id="payslip-document-render"
        className="flex-1 bg-white rounded-2xl border border-slate-200/90 shadow-sm p-4 sm:p-6 text-slate-800 transition-all font-sans relative"
      >
        {renderTemplateContent(
          customization.templateId,
          employee,
          payroll,
          business,
          customization,
          totalDeductions
        )}
      </div>

      {/* Modals */}
      <WhatsAppShareModal
        isOpen={isWhatsAppModalOpen}
        onClose={() => setIsWhatsAppModalOpen(false)}
        employee={employee}
        payroll={payroll}
        business={business}
        renderElementId="payslip-document-render"
      />

      <SharePayslipModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        employee={employee}
        payroll={payroll}
        business={business}
        onOpenEmailModal={onOpenEmailModal}
        renderElementId="payslip-document-render"
      />
    </div>
  );
};

/**
 * 12 Truly Distinct, Professional Payslip Renderers
 */
function renderTemplateContent(
  templateId: TemplateId,
  employee: Employee,
  payroll: PayrollRun,
  business: BusinessDetails,
  customization: PayslipCustomization,
  totalDeductions: number
) {
  const primaryColor = customization.primaryColor || '#059669';

  switch (templateId) {
    // -------------------------------------------------------------
    // TEMPLATE 01: Sheetpay Modern Emerald (Dual-Card Fintech)
    // -------------------------------------------------------------
    case 'template_01':
      return (
        <div className="text-xs space-y-4 max-w-xl mx-auto">
          {/* Header */}
          <div className="pb-4 border-b border-emerald-100 flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white font-black flex items-center justify-center text-base shadow-sm">
                S
              </div>
              <div>
                <h4 className="font-bold text-sm text-slate-900">{business.name}</h4>
                <p className="text-[11px] text-slate-500">{business.address}</p>
                <div className="font-mono text-[10px] text-emerald-800 font-semibold mt-0.5">
                  BIR: {business.taxRegistrationId} • NIS: {business.nisNumber}
                </div>
              </div>
            </div>
            <div className="text-right">
              <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-extrabold text-[10px] uppercase tracking-wider">
                Payslip Advice
              </span>
              <div className="text-xs font-bold text-slate-900 mt-1">{payroll.periodLabel}</div>
              <div className="text-[10px] text-slate-400">Date: {payroll.payDate}</div>
            </div>
          </div>

          {/* Employee ID Matrix with Photo */}
          <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-100 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <img
                src={employee.avatar}
                alt={employee.name}
                className="w-10 h-10 rounded-full object-cover ring-2 ring-emerald-400"
                referrerPolicy="no-referrer"
              />
              <div>
                <div className="font-bold text-slate-900 text-sm">{employee.name}</div>
                <div className="text-[11px] text-slate-600">{employee.position} • <span className="font-semibold text-emerald-800">{employee.department}</span></div>
              </div>
            </div>
            <div className="text-right font-mono text-[10px]">
              <div><span className="text-slate-400">ID:</span> <span className="font-bold text-slate-800">{employee.employeeId}</span></div>
              <div><span className="text-slate-400">BIR:</span> <span className="font-bold text-slate-800">{employee.birNumber || '104-892-334'}</span></div>
              <div><span className="text-slate-400">NIS:</span> <span className="font-bold text-slate-800">{employee.ssnNumber || '849-20-4491'}</span></div>
            </div>
          </div>

          {/* 2-Column Earnings & Deductions Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="bg-slate-50/80 rounded-xl p-3.5 border border-slate-200/80 space-y-2">
              <div className="font-bold text-emerald-800 text-xs border-b border-slate-200 pb-1.5 flex justify-between">
                <span>Earnings &amp; Additions</span>
                <span>Amount</span>
              </div>
              <div className="space-y-1 divide-y divide-slate-100 text-[11px]">
                <div className="flex justify-between pt-1">
                  <span className="text-slate-600">Basic Monthly Pay</span>
                  <span className="font-mono font-bold text-slate-900">{formatCurrency(employee.basicPay)}</span>
                </div>
                {employee.overtimeHours > 0 && (
                  <div className="flex justify-between pt-1 text-emerald-700">
                    <span>Overtime ({employee.overtimeHours}h @ {formatCurrency(employee.overtimeRate)}/h)</span>
                    <span className="font-mono font-bold">{formatCurrency(employee.overtimeHours * employee.overtimeRate)}</span>
                  </div>
                )}
                {employee.bonus > 0 && (
                  <div className="flex justify-between pt-1 text-emerald-700">
                    <span>Performance Bonus</span>
                    <span className="font-mono font-bold">{formatCurrency(employee.bonus)}</span>
                  </div>
                )}
                <div className="flex justify-between pt-2 font-bold text-slate-900 border-t border-slate-300">
                  <span>Gross Pay</span>
                  <span className="font-mono text-emerald-700">{formatCurrency(employee.grossPay)}</span>
                </div>
              </div>
            </div>

            <div className="bg-slate-50/80 rounded-xl p-3.5 border border-slate-200/80 space-y-2">
              <div className="font-bold text-rose-800 text-xs border-b border-slate-200 pb-1.5 flex justify-between">
                <span>Statutory Deductions</span>
                <span>Amount</span>
              </div>
              <div className="space-y-1 divide-y divide-slate-100 text-[11px]">
                <div className="flex justify-between pt-1">
                  <span className="text-slate-600">PAYE Income Tax (BIR)</span>
                  <span className="font-mono text-rose-700">{formatCurrency(employee.paye)}</span>
                </div>
                <div className="flex justify-between pt-1">
                  <span className="text-slate-600">NIS (National Insurance)</span>
                  <span className="font-mono text-rose-700">{formatCurrency(employee.nis)}</span>
                </div>
                <div className="flex justify-between pt-1">
                  <span className="text-slate-600">Health Surcharge</span>
                  <span className="font-mono text-rose-700">{formatCurrency(employee.healthSurcharge)}</span>
                </div>
                <div className="flex justify-between pt-2 font-bold text-slate-900 border-t border-slate-300">
                  <span>Total Deductions</span>
                  <span className="font-mono text-rose-700">{formatCurrency(totalDeductions)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Net Pay Banner */}
          <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-700 to-emerald-600 text-white flex items-center justify-between shadow-md">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-emerald-200">Total Net Take-Home</div>
              <div className="text-[11px] text-emerald-100 mt-0.5">Disbursed via {employee.bankName || 'Republic Bank'} (•••• 4920)</div>
            </div>
            <div className="text-2xl font-black font-mono tracking-tight">{formatCurrency(employee.netPay)}</div>
          </div>
        </div>
      );

    // -------------------------------------------------------------
    // TEMPLATE 02: Classic Corporate 3-Column Ledger
    // -------------------------------------------------------------
    case 'template_02':
      return (
        <div className="text-xs space-y-4 max-w-xl mx-auto font-sans">
          {/* Formal Corporate Header */}
          <div className="text-center pb-3 border-b-2 border-slate-800">
            <h2 className="font-black text-base uppercase tracking-wider text-slate-900">{business.name}</h2>
            <div className="text-[10px] text-slate-500 uppercase tracking-widest">Official Remittance &amp; Compensation Ledger</div>
            <div className="text-[10px] text-slate-500 font-mono mt-0.5">
              TAX ID: {business.taxRegistrationId} | NIS ID: {business.nisNumber} | PERIOD: {payroll.periodLabel}
            </div>
          </div>

          {/* Formal 4-cell table */}
          <table className="w-full border-collapse border border-slate-400 text-[11px]">
            <tbody>
              <tr className="bg-slate-100">
                <td className="border border-slate-400 p-1.5 font-bold text-slate-700">EMPLOYEE NAME</td>
                <td className="border border-slate-400 p-1.5 font-bold text-slate-900">{employee.name}</td>
                <td className="border border-slate-400 p-1.5 font-bold text-slate-700">EMPLOYEE ID</td>
                <td className="border border-slate-400 p-1.5 font-mono">{employee.employeeId}</td>
              </tr>
              <tr>
                <td className="border border-slate-400 p-1.5 font-bold text-slate-700">DEPARTMENT</td>
                <td className="border border-slate-400 p-1.5">{employee.department}</td>
                <td className="border border-slate-400 p-1.5 font-bold text-slate-700">BIR / SSN</td>
                <td className="border border-slate-400 p-1.5 font-mono">{employee.birNumber || '104-889'} / {employee.ssnNumber || '849-20'}</td>
              </tr>
            </tbody>
          </table>

          {/* 3-Column Ledger Table */}
          <table className="w-full border-collapse border border-slate-400 text-[11px]">
            <thead>
              <tr className="bg-slate-800 text-white uppercase text-[10px] tracking-wider">
                <th className="border border-slate-500 p-2 text-left">Description / Particulars</th>
                <th className="border border-slate-500 p-2 text-right">Earnings (TTD)</th>
                <th className="border border-slate-500 p-2 text-right">Deductions (TTD)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-300">
              <tr>
                <td className="border-r border-slate-400 p-2">Basic Monthly Salary</td>
                <td className="border-r border-slate-400 p-2 text-right font-mono">{formatCurrency(employee.basicPay)}</td>
                <td className="p-2 text-right font-mono text-slate-400">—</td>
              </tr>
              {employee.overtimeHours > 0 && (
                <tr>
                  <td className="border-r border-slate-400 p-2">Overtime ({employee.overtimeHours} hrs @ {formatCurrency(employee.overtimeRate)})</td>
                  <td className="border-r border-slate-400 p-2 text-right font-mono">{formatCurrency(employee.overtimeHours * employee.overtimeRate)}</td>
                  <td className="p-2 text-right font-mono text-slate-400">—</td>
                </tr>
              )}
              <tr>
                <td className="border-r border-slate-400 p-2">PAYE Statutory Tax (Board of Inland Revenue)</td>
                <td className="border-r border-slate-400 p-2 text-right font-mono text-slate-400">—</td>
                <td className="p-2 text-right font-mono text-rose-700">{formatCurrency(employee.paye)}</td>
              </tr>
              <tr>
                <td className="border-r border-slate-400 p-2">National Insurance Scheme (NIS Tier 16)</td>
                <td className="border-r border-slate-400 p-2 text-right font-mono text-slate-400">—</td>
                <td className="p-2 text-right font-mono text-rose-700">{formatCurrency(employee.nis)}</td>
              </tr>
              <tr>
                <td className="border-r border-slate-400 p-2">Health Surcharge Act</td>
                <td className="border-r border-slate-400 p-2 text-right font-mono text-slate-400">—</td>
                <td className="p-2 text-right font-mono text-rose-700">{formatCurrency(employee.healthSurcharge)}</td>
              </tr>
              <tr className="bg-slate-100 font-bold">
                <td className="border-t-2 border-slate-800 border-r border-slate-400 p-2 uppercase">TOTALS</td>
                <td className="border-t-2 border-slate-800 border-r border-slate-400 p-2 text-right font-mono text-slate-900">{formatCurrency(employee.grossPay)}</td>
                <td className="border-t-2 border-slate-800 p-2 text-right font-mono text-rose-800">{formatCurrency(totalDeductions)}</td>
              </tr>
            </tbody>
          </table>

          {/* Bottom Net Pay Box */}
          <div className="border-2 border-slate-800 p-3 flex justify-between items-center bg-slate-50">
            <span className="font-extrabold uppercase tracking-wider text-slate-900">NET SALARY PAYABLE:</span>
            <span className="font-mono font-black text-xl text-slate-900">{formatCurrency(employee.netPay)}</span>
          </div>
        </div>
      );

    // -------------------------------------------------------------
    // TEMPLATE 03: Minimalist Mono Stark & Clean
    // -------------------------------------------------------------
    case 'template_03':
      return (
        <div className="text-xs space-y-4 max-w-xl mx-auto font-mono text-slate-900">
          <div className="flex justify-between items-start border-b border-black pb-2">
            <div>
              <div className="font-black text-sm uppercase">{business.name}</div>
              <div className="text-[10px] text-slate-600">DOC_ID: PAY-{payroll.periodLabel.replace(/\s+/g, '-')}-{employee.employeeId}</div>
            </div>
            <div className="text-right">
              <div className="font-bold">PAY_PERIOD: {payroll.periodLabel}</div>
              <div className="text-[10px] text-slate-500">DISBURSED: {payroll.payDate}</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 border border-black p-3 text-[11px]">
            <div>
              <div>EMPLOYEE : {employee.name.toUpperCase()}</div>
              <div>ID_NO    : {employee.employeeId}</div>
              <div>ROLE     : {employee.position.toUpperCase()}</div>
            </div>
            <div>
              <div>DEPT     : {employee.department.toUpperCase()}</div>
              <div>BIR_NO   : {employee.birNumber || '104-892-334'}</div>
              <div>SSN_NO   : {employee.ssnNumber || '849-20-4491'}</div>
            </div>
          </div>

          <div className="space-y-1 text-[11px]">
            <div className="flex justify-between border-b border-slate-300 pb-1 font-bold">
              <span>ITEM_DESCRIPTION</span>
              <span>AMOUNT_TTD</span>
            </div>
            <div className="flex justify-between py-0.5">
              <span>+ BASIC MONTHLY SALARY</span>
              <span>{formatCurrency(employee.basicPay)}</span>
            </div>
            {employee.overtimeHours > 0 && (
              <div className="flex justify-between py-0.5 text-emerald-800">
                <span>+ OVERTIME COMPENSATION</span>
                <span>{formatCurrency(employee.overtimeHours * employee.overtimeRate)}</span>
              </div>
            )}
            <div className="flex justify-between py-0.5 border-t border-slate-200 font-bold">
              <span>= GROSS INCOME</span>
              <span>{formatCurrency(employee.grossPay)}</span>
            </div>
            <div className="flex justify-between py-0.5 text-rose-700">
              <span>- STATUTORY PAYE WITHHOLDING</span>
              <span>{formatCurrency(employee.paye)}</span>
            </div>
            <div className="flex justify-between py-0.5 text-rose-700">
              <span>- NIS CONTRIBUTION</span>
              <span>{formatCurrency(employee.nis)}</span>
            </div>
            <div className="flex justify-between py-0.5 text-rose-700">
              <span>- HEALTH SURCHARGE</span>
              <span>{formatCurrency(employee.healthSurcharge)}</span>
            </div>
          </div>

          <div className="border-t-2 border-black pt-2 flex justify-between items-center text-sm font-black">
            <span>NET_TRANSFERRED</span>
            <span className="text-lg bg-black text-white px-2 py-0.5">{formatCurrency(employee.netPay)}</span>
          </div>
        </div>
      );

    // -------------------------------------------------------------
    // TEMPLATE 04: Executive Navy Split-Hero
    // -------------------------------------------------------------
    case 'template_04':
      return (
        <div className="text-xs space-y-4 max-w-xl mx-auto">
          {/* Executive Navy Header Banner */}
          <div className="bg-blue-950 text-white p-4 rounded-xl flex items-center justify-between">
            <div className="space-y-1">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-800 text-blue-100 uppercase tracking-widest">
                Executive Compensation
              </span>
              <h3 className="text-lg font-black tracking-tight">{business.name}</h3>
              <p className="text-[10px] text-blue-300 font-mono">BIR {business.taxRegistrationId} • NIS {business.nisNumber}</p>
            </div>
            <div className="bg-blue-900/80 p-3 rounded-lg border border-blue-700 text-right">
              <div className="text-[9px] font-bold uppercase tracking-wider text-blue-300">Net Executive Payout</div>
              <div className="text-xl font-black font-mono text-emerald-400 mt-0.5">{formatCurrency(employee.netPay)}</div>
            </div>
          </div>

          {/* Member Profile */}
          <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-100 flex items-center justify-between">
            <div>
              <div className="font-bold text-blue-950 text-sm">{employee.name}</div>
              <div className="text-xs text-blue-800">{employee.position} — <span className="font-semibold">{employee.department}</span></div>
            </div>
            <div className="text-right text-[11px] font-mono text-blue-900">
              <div>{employee.employeeId}</div>
              <div className="text-[10px] text-slate-500">BIR: {employee.birNumber || '104-992-011'}</div>
            </div>
          </div>

          {/* Tabular Grid */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="border border-blue-200 rounded-xl p-3 bg-white space-y-1.5">
              <div className="font-bold text-blue-950 border-b border-blue-100 pb-1">Earnings Portfolio</div>
              <div className="flex justify-between text-slate-600"><span>Base Salary</span><span className="font-mono font-bold text-slate-900">{formatCurrency(employee.basicPay)}</span></div>
              <div className="flex justify-between text-slate-600"><span>Allowances</span><span className="font-mono">{formatCurrency(employee.allowances)}</span></div>
              <div className="flex justify-between font-bold text-blue-950 pt-1 border-t border-blue-100"><span>Gross</span><span className="font-mono">{formatCurrency(employee.grossPay)}</span></div>
            </div>

            <div className="border border-blue-200 rounded-xl p-3 bg-white space-y-1.5">
              <div className="font-bold text-rose-900 border-b border-rose-100 pb-1">Statutory Withholdings</div>
              <div className="flex justify-between text-slate-600"><span>PAYE Tax</span><span className="font-mono text-rose-700">{formatCurrency(employee.paye)}</span></div>
              <div className="flex justify-between text-slate-600"><span>NIS</span><span className="font-mono text-rose-700">{formatCurrency(employee.nis)}</span></div>
              <div className="flex justify-between text-slate-600"><span>Health Surcharge</span><span className="font-mono text-rose-700">{formatCurrency(employee.healthSurcharge)}</span></div>
            </div>
          </div>
        </div>
      );

    // -------------------------------------------------------------
    // TEMPLATE 07: Editorial Serif & Gold Crest
    // -------------------------------------------------------------
    case 'template_07':
      return (
        <div className="text-xs space-y-4 max-w-xl mx-auto font-serif bg-amber-50/40 p-4 rounded-xl border-2 border-amber-900/30">
          <div className="text-center pb-3 border-b border-amber-900/20">
            <div className="text-amber-800 text-lg font-bold">⚜</div>
            <h3 className="text-base font-bold tracking-wide uppercase text-amber-950">{business.name}</h3>
            <p className="text-[11px] italic text-amber-800">Certificate of Monthly Remuneration • {payroll.periodLabel}</p>
          </div>

          <div className="text-center italic text-slate-700 text-xs">
            This document certifies that <span className="font-bold not-italic">{employee.name}</span>, serving as <span className="font-bold not-italic">{employee.position}</span> ({employee.department}), has been officially remunerated for the period of {payroll.periodLabel}.
          </div>

          <div className="grid grid-cols-2 gap-4 text-xs font-sans">
            <div className="p-3 bg-white/80 rounded border border-amber-200 space-y-1">
              <div className="font-serif font-bold text-amber-900 border-b border-amber-200 pb-1">I. Earnings Schedule</div>
              <div className="flex justify-between"><span>Basic Remuneration:</span><span className="font-mono font-bold">{formatCurrency(employee.basicPay)}</span></div>
              <div className="flex justify-between font-bold border-t border-amber-100 pt-1"><span>Total Gross:</span><span className="font-mono text-amber-950">{formatCurrency(employee.grossPay)}</span></div>
            </div>

            <div className="p-3 bg-white/80 rounded border border-amber-200 space-y-1">
              <div className="font-serif font-bold text-amber-900 border-b border-amber-200 pb-1">II. Statutory Taxes</div>
              <div className="flex justify-between"><span>Inland Revenue PAYE:</span><span className="font-mono text-rose-800">{formatCurrency(employee.paye)}</span></div>
              <div className="flex justify-between"><span>NIS Board:</span><span className="font-mono text-rose-800">{formatCurrency(employee.nis)}</span></div>
              <div className="flex justify-between"><span>Health Surcharge:</span><span className="font-mono text-rose-800">{formatCurrency(employee.healthSurcharge)}</span></div>
            </div>
          </div>

          <div className="text-center font-serif text-amber-950 p-2 bg-amber-100/60 rounded border border-amber-300">
            <span className="text-xs uppercase tracking-widest font-bold">Net Remuneration Disbursed: </span>
            <span className="font-sans font-black text-base font-mono">{formatCurrency(employee.netPay)}</span>
          </div>
        </div>
      );

    // -------------------------------------------------------------
    // TEMPLATE 08: Contemporary Left-Sidebar Layout
    // -------------------------------------------------------------
    case 'template_08':
      return (
        <div className="text-xs max-w-xl mx-auto flex flex-col sm:flex-row rounded-xl border border-teal-200 overflow-hidden shadow-sm">
          {/* Left Dark Teal Sidebar */}
          <div className="w-full sm:w-1/3 bg-teal-900 text-white p-4 space-y-3 shrink-0">
            <div>
              <div className="w-7 h-7 rounded bg-teal-500 text-teal-950 font-black flex items-center justify-center text-xs mb-1.5">
                S
              </div>
              <h4 className="font-bold text-sm leading-tight">{business.name}</h4>
              <p className="text-[10px] text-teal-300 font-mono mt-0.5">BIR: {business.taxRegistrationId}</p>
            </div>

            <div className="border-t border-teal-800 pt-2 text-[10px] space-y-1">
              <div className="text-teal-400 font-bold uppercase">Employee Details</div>
              <div className="font-bold text-white text-xs">{employee.name}</div>
              <div className="text-teal-200">{employee.position}</div>
              <div className="font-mono text-teal-300">{employee.employeeId}</div>
              <div className="text-teal-300">BIR: {employee.birNumber || '104-892'}</div>
              <div className="text-teal-300">NIS: {employee.ssnNumber || '849-201'}</div>
            </div>

            <div className="border-t border-teal-800 pt-2 text-[10px]">
              <div className="text-teal-400 font-bold uppercase">Pay Period</div>
              <div className="text-white font-bold">{payroll.periodLabel}</div>
              <div className="text-teal-300">{payroll.payDate}</div>
            </div>
          </div>

          {/* Right Main Content */}
          <div className="w-full sm:w-2/3 p-4 bg-white space-y-3 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="font-bold text-teal-950 text-xs border-b border-slate-100 pb-1">Earnings &amp; Deductions Breakdown</div>
              <div className="space-y-1 text-[11px]">
                <div className="flex justify-between"><span className="text-slate-600">Basic Monthly:</span><span className="font-mono font-bold">{formatCurrency(employee.basicPay)}</span></div>
                {employee.overtimeHours > 0 && (
                  <div className="flex justify-between text-emerald-700"><span>Overtime Pay:</span><span className="font-mono font-bold">{formatCurrency(employee.overtimeHours * employee.overtimeRate)}</span></div>
                )}
                <div className="flex justify-between font-bold text-slate-900 border-t border-slate-200 pt-1"><span>Total Gross:</span><span className="font-mono">{formatCurrency(employee.grossPay)}</span></div>
                <div className="flex justify-between text-rose-700"><span>PAYE Income Tax:</span><span className="font-mono">-{formatCurrency(employee.paye)}</span></div>
                <div className="flex justify-between text-rose-700"><span>NIS Statutory:</span><span className="font-mono">-{formatCurrency(employee.nis)}</span></div>
                <div className="flex justify-between text-rose-700"><span>Health Surcharge:</span><span className="font-mono">-{formatCurrency(employee.healthSurcharge)}</span></div>
              </div>
            </div>

            <div className="p-3 bg-teal-50 rounded-xl border border-teal-200 flex items-center justify-between">
              <div>
                <div className="text-[9px] font-bold text-teal-800 uppercase">Net Salary Transferred</div>
                <div className="text-[10px] text-teal-600">Direct Deposit (ACH)</div>
              </div>
              <div className="text-xl font-black font-mono text-teal-900">{formatCurrency(employee.netPay)}</div>
            </div>
          </div>
        </div>
      );

    // -------------------------------------------------------------
    // TEMPLATE 11: Dark Obsidian Executive Slip
    // -------------------------------------------------------------
    case 'template_11':
      return (
        <div className="text-xs space-y-4 max-w-xl mx-auto bg-slate-950 text-slate-100 p-5 rounded-2xl border border-slate-800 shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-500 text-slate-950 font-black flex items-center justify-center text-sm shadow-md">
                S
              </div>
              <div>
                <div className="font-black text-sm text-white">{business.name}</div>
                <div className="text-[10px] text-slate-400 font-mono">OBSIDIAN ENCRYPTED PAYROLL</div>
              </div>
            </div>
            <div className="text-right">
              <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-mono text-[10px] font-bold">
                {payroll.periodLabel}
              </span>
            </div>
          </div>

          {/* Employee ID Matrix */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-[10px]">
            <div><div className="text-slate-500">NAME</div><div className="font-bold text-white text-xs">{employee.name}</div></div>
            <div><div className="text-slate-500">ID</div><div className="font-mono text-emerald-400 text-xs">{employee.employeeId}</div></div>
            <div><div className="text-slate-500">BIR NO.</div><div className="font-mono text-slate-300">{employee.birNumber || '104-892'}</div></div>
            <div><div className="text-slate-500">SSN NO.</div><div className="font-mono text-slate-300">{employee.ssnNumber || '849-201'}</div></div>
          </div>

          {/* 2-Column Obsidian Breakdown */}
          <div className="grid grid-cols-2 gap-3 text-[11px]">
            <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1.5">
              <div className="text-emerald-400 font-bold text-xs uppercase tracking-wider">Earnings</div>
              <div className="flex justify-between"><span className="text-slate-400">Basic Pay</span><span className="font-mono text-white font-bold">{formatCurrency(employee.basicPay)}</span></div>
              <div className="flex justify-between font-bold border-t border-slate-800 pt-1 text-white"><span>Gross</span><span className="font-mono text-emerald-400">{formatCurrency(employee.grossPay)}</span></div>
            </div>

            <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1.5">
              <div className="text-rose-400 font-bold text-xs uppercase tracking-wider">Withholdings</div>
              <div className="flex justify-between"><span className="text-slate-400">PAYE Tax</span><span className="font-mono text-rose-400">{formatCurrency(employee.paye)}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">NIS Scheme</span><span className="font-mono text-rose-400">{formatCurrency(employee.nis)}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Health Surch.</span><span className="font-mono text-rose-400">{formatCurrency(employee.healthSurcharge)}</span></div>
            </div>
          </div>

          {/* Glowing Net Pay */}
          <div className="p-4 rounded-xl bg-emerald-950/60 border border-emerald-500/30 flex items-center justify-between">
            <div>
              <div className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">Net Disbursed</div>
              <div className="text-[10px] text-slate-400">Transferred via Bank ACH</div>
            </div>
            <div className="text-2xl font-black font-mono text-emerald-400 drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]">
              {formatCurrency(employee.netPay)}
            </div>
          </div>
        </div>
      );

    // -------------------------------------------------------------
    // TEMPLATE 12: Official T&T Government TD4 / NIS Standard Format
    // -------------------------------------------------------------
    case 'template_12':
      return (
        <div className="text-xs space-y-3.5 max-w-xl mx-auto border-2 border-emerald-800 p-4 rounded-xl bg-white font-sans">
          {/* Official Govt TD4 Form Title */}
          <div className="text-center pb-2 border-b-2 border-emerald-800">
            <div className="text-[10px] font-extrabold tracking-widest text-emerald-900 uppercase">
              REPUBLIC OF TRINIDAD AND TOBAGO — BOARD OF INLAND REVENUE
            </div>
            <h3 className="text-sm font-black uppercase text-slate-900 mt-0.5">
              TD4 / NIS OFFICIAL STATUTORY REMITTANCE ADVICE
            </h3>
            <div className="text-[10px] font-mono text-slate-600 mt-0.5">
              EMPLOYER REG: {business.taxRegistrationId} | NIS ER NO: {business.nisNumber}
            </div>
          </div>

          {/* Formal Statutory Identification Box */}
          <div className="grid grid-cols-2 gap-2 border border-slate-300 p-2.5 bg-slate-50 text-[10px] font-mono">
            <div>
              <div>EMPLOYEE NAME: <span className="font-bold text-slate-900">{employee.name}</span></div>
              <div>BIR TAX NO: <span className="font-bold text-emerald-800">{employee.birNumber || '104-892-334'}</span></div>
              <div>NIS NUMBER: <span className="font-bold text-emerald-800">{employee.ssnNumber || '849-20-4491'}</span></div>
            </div>
            <div>
              <div>EMPLOYEE ID: <span className="font-bold">{employee.employeeId}</span></div>
              <div>TAX YEAR: <span className="font-bold">2026 (TAX CYCLE 08)</span></div>
              <div>PAY DATE: <span className="font-bold">{payroll.payDate}</span></div>
            </div>
          </div>

          {/* Statutory Calculations Table */}
          <table className="w-full border-collapse border border-slate-300 text-[11px]">
            <thead>
              <tr className="bg-emerald-800 text-white text-[10px] uppercase font-bold">
                <th className="border border-slate-300 p-1.5 text-left">Statutory Assessment Box</th>
                <th className="border border-slate-300 p-1.5 text-right">Income (TTD)</th>
                <th className="border border-slate-300 p-1.5 text-right">Tax Withheld (TTD)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              <tr>
                <td className="p-1.5">Box 1: Total Gross Remuneration &amp; Allowances</td>
                <td className="p-1.5 text-right font-mono font-bold text-slate-900">{formatCurrency(employee.grossPay)}</td>
                <td className="p-1.5 text-right font-mono text-slate-400">—</td>
              </tr>
              <tr>
                <td className="p-1.5">Box 2: PAYE Income Tax Deducted (BIR Remittance)</td>
                <td className="p-1.5 text-right font-mono text-slate-400">—</td>
                <td className="p-1.5 text-right font-mono font-bold text-rose-700">{formatCurrency(employee.paye)}</td>
              </tr>
              <tr>
                <td className="p-1.5">Box 3: National Insurance Deducted (Class 16 NIB)</td>
                <td className="p-1.5 text-right font-mono text-slate-400">—</td>
                <td className="p-1.5 text-right font-mono font-bold text-rose-700">{formatCurrency(employee.nis)}</td>
              </tr>
              <tr>
                <td className="p-1.5">Box 4: Health Surcharge Act Withholding</td>
                <td className="p-1.5 text-right font-mono text-slate-400">—</td>
                <td className="p-1.5 text-right font-mono font-bold text-rose-700">{formatCurrency(employee.healthSurcharge)}</td>
              </tr>
              <tr className="bg-slate-100 font-bold">
                <td className="p-1.5 uppercase">Box 5: Net Statutory Payout to Beneficiary</td>
                <td colSpan={2} className="p-1.5 text-right font-mono text-emerald-800 text-sm">
                  {formatCurrency(employee.netPay)}
                </td>
              </tr>
            </tbody>
          </table>

          {/* Official Stamp Block */}
          <div className="border border-emerald-700 p-2.5 rounded bg-emerald-50/50 flex items-center justify-between text-[10px]">
            <div className="flex items-center gap-2">
              <FileCheck2 className="w-5 h-5 text-emerald-700 shrink-0" />
              <div>
                <div className="font-bold text-emerald-900">CERTIFIED IN ACCORDANCE WITH LAWS OF TRINIDAD &amp; TOBAGO</div>
                <div className="text-slate-500">Board of Inland Revenue Act Chap. 75:01 • TD4 Certified Compliant</div>
              </div>
            </div>
            <div className="text-right font-mono text-emerald-900 font-bold">
              AUTH: {business.signatoryName || 'Payroll Officer'}
            </div>
          </div>
        </div>
      );

    // -------------------------------------------------------------
    // DEFAULT & REMAINING TEMPLATES (05, 06, 09, 10)
    // -------------------------------------------------------------
    default:
      return (
        <div className="text-xs space-y-4 max-w-xl mx-auto">
          {/* Header */}
          <div className="pb-3 border-b border-slate-200 flex items-start justify-between">
            <div>
              <div className="font-black text-sm text-slate-900">{business.name}</div>
              <div className="text-[11px] text-slate-500">{business.address}</div>
              <div className="font-mono text-[10px] text-slate-400 mt-0.5">
                BIR: {business.taxRegistrationId} • NIS: {business.nisNumber}
              </div>
            </div>
            <div className="text-right">
              <span
                className="px-2.5 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider text-white"
                style={{ backgroundColor: primaryColor }}
              >
                Payslip Advice
              </span>
              <div className="text-xs font-bold text-slate-900 mt-1">{payroll.periodLabel}</div>
              <div className="text-[10px] text-slate-400">Date: {payroll.payDate}</div>
            </div>
          </div>

          {/* Employee Metadata */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200/80">
            <div><div className="text-[10px] text-slate-400 uppercase">Employee</div><div className="font-bold text-slate-900">{employee.name}</div></div>
            <div><div className="text-[10px] text-slate-400 uppercase">ID / Dept</div><div className="font-mono text-slate-800">{employee.employeeId} • {employee.department}</div></div>
            <div><div className="text-[10px] text-slate-400 uppercase">BIR No.</div><div className="font-mono text-slate-800">{employee.birNumber || '104-892'}</div></div>
            <div><div className="text-[10px] text-slate-400 uppercase">SSN No.</div><div className="font-mono text-slate-800">{employee.ssnNumber || '849-201'}</div></div>
          </div>

          {/* 2-Column Earnings & Deductions */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="border border-slate-200 rounded-xl p-3 bg-white space-y-1.5">
              <div className="font-bold text-slate-900 text-xs border-b border-slate-100 pb-1 flex justify-between">
                <span>Earnings</span><span>Amount</span>
              </div>
              <div className="flex justify-between text-slate-600"><span>Basic Salary</span><span className="font-mono font-bold text-slate-900">{formatCurrency(employee.basicPay)}</span></div>
              {employee.overtimeHours > 0 && (
                <div className="flex justify-between text-emerald-700"><span>Overtime</span><span className="font-mono font-bold">{formatCurrency(employee.overtimeHours * employee.overtimeRate)}</span></div>
              )}
              <div className="flex justify-between font-bold text-slate-900 pt-1 border-t border-slate-200"><span>Gross Pay</span><span className="font-mono">{formatCurrency(employee.grossPay)}</span></div>
            </div>

            <div className="border border-slate-200 rounded-xl p-3 bg-white space-y-1.5">
              <div className="font-bold text-rose-900 text-xs border-b border-rose-100 pb-1 flex justify-between">
                <span>Deductions</span><span>Amount</span>
              </div>
              <div className="flex justify-between text-slate-600"><span>PAYE Income Tax</span><span className="font-mono text-rose-700">{formatCurrency(employee.paye)}</span></div>
              <div className="flex justify-between text-slate-600"><span>NIS Statutory</span><span className="font-mono text-rose-700">{formatCurrency(employee.nis)}</span></div>
              <div className="flex justify-between text-slate-600"><span>Health Surcharge</span><span className="font-mono text-rose-700">{formatCurrency(employee.healthSurcharge)}</span></div>
              <div className="flex justify-between font-bold text-rose-900 pt-1 border-t border-rose-200"><span>Total Deductions</span><span className="font-mono">{formatCurrency(totalDeductions)}</span></div>
            </div>
          </div>

          {/* Net Pay */}
          <div
            className="p-3.5 rounded-xl text-white flex items-center justify-between shadow-sm"
            style={{ backgroundColor: primaryColor }}
          >
            <div>
              <div className="text-[10px] uppercase font-bold tracking-wider opacity-80">Net Pay Transferable</div>
              <div className="text-[11px] opacity-90 mt-0.5">Disbursed to {employee.bankName || 'Direct Deposit'}</div>
            </div>
            <div className="text-xl font-black font-mono">{formatCurrency(employee.netPay)}</div>
          </div>
        </div>
      );
  }
}
