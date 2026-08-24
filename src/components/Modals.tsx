import React, { useState, useEffect } from 'react';
import {
  AuditLogEntry,
  BusinessDetails,
  Employee,
  PayrollRun,
} from '../types';
import {
  X,
  ShieldCheck,
  FileSpreadsheet,
  UploadCloud,
  CheckCircle2,
  Mail,
  Send,
  Building,
  RotateCcw,
  Sparkles,
  MessageCircle,
  Share2,
  Copy,
  Download,
  ExternalLink,
  FileImage,
  FileText,
  Check,
  Printer,
  Smartphone,
  CheckCheck,
} from 'lucide-react';
import { formatCurrency } from '../lib/taxEngine';
import {
  buildWhatsAppMessageText,
  formatWhatsAppPhone,
  downloadPayslipImage,
  downloadPayslipPDF,
  copyPayslipImageToClipboard,
  sharePayslipViaWhatsApp,
  sharePayslipNative,
  generatePayslipImageDataUrl,
} from '../lib/payslipExporter';

// 1. Audit Trail Modal
interface AuditTrailModalProps {
  isOpen: boolean;
  onClose: () => void;
  logs: AuditLogEntry[];
}

export const AuditTrailModal: React.FC<AuditTrailModalProps> = ({ isOpen, onClose, logs }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
        <div className="p-4 md:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
            <h3 className="font-semibold text-slate-900 text-sm md:text-base">
              Deterministic Payroll Audit Trail
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 md:p-6 overflow-y-auto space-y-3 divide-y divide-slate-100 flex-1">
          {logs.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-xs">
              No audit records recorded yet. All modifications by Cayla and user are tracked here.
            </div>
          ) : (
            logs.map((log) => (
              <div key={log.id} className="pt-3 first:pt-0 text-xs">
                <div className="flex items-center justify-between text-slate-500 mb-1 font-mono text-[11px]">
                  <span className="flex items-center gap-1.5">
                    {log.actor === 'cayla' ? (
                      <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-semibold uppercase text-[9px]">
                        Cayla Agent
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.5 rounded bg-slate-200 text-slate-800 font-semibold uppercase text-[9px]">
                        Admin
                      </span>
                    )}
                    <span>{log.action}</span>
                  </span>
                  <span>{log.timestamp}</span>
                </div>
                {log.employeeName && (
                  <div className="text-slate-800 font-medium">
                    Target: {log.employeeName}{' '}
                    {log.previousValue !== undefined && (
                      <span className="text-slate-500 font-mono text-[11px]">
                        ({String(log.previousValue)} → {String(log.newValue)})
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-semibold hover:bg-slate-800"
          >
            Close Audit Trail
          </button>
        </div>
      </div>
    </div>
  );
};

// 2. Timesheet Upload Modal
interface TimesheetUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyTimesheetData: (overtimeMap: Record<string, number>) => void;
}

export const TimesheetUploadModal: React.FC<TimesheetUploadModalProps> = ({
  isOpen,
  onClose,
  onApplyTimesheetData,
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSimulateImport = () => {
    setIsProcessing(true);
    setTimeout(() => {
      // Sample overtime data mapped by employee name fragment
      const otMap: Record<string, number> = {
        marcus: 8,
        sarah: 4,
        kevin: 6,
        nathanial: 14,
        rondell: 18,
        daryl: 12,
        terrence: 16,
      };
      setIsProcessing(false);
      onApplyTimesheetData(otMap);
      onClose();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
            <h3 className="font-bold text-slate-900 text-base">Import Timesheet & Attendance</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-slate-600 mb-4">
          Upload biometric punch logs or Excel timesheets (.csv, .xlsx). Cayla will automatically
          extract regular hours, compute overtime rates, and update the draft payroll.
        </p>

        {/* Drag and Drop Zone */}
        <div
          onClick={handleSimulateImport}
          className="border-2 border-dashed border-slate-200 hover:border-emerald-500 rounded-xl p-8 text-center bg-slate-50 hover:bg-emerald-50/40 cursor-pointer transition-colors"
        >
          <UploadCloud className="w-10 h-10 text-emerald-600 mx-auto mb-2" />
          <div className="text-xs font-semibold text-slate-800">
            Click to upload August_Timesheet_Punches.csv
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Supports CSV, XLSX, Biometric DAT files</div>
        </div>

        {isProcessing && (
          <div className="mt-4 flex items-center justify-center gap-2 text-xs text-emerald-700 font-medium">
            <Sparkles className="w-4 h-4 animate-spin text-emerald-600" />
            <span>Parsing biometric timesheet and recalculating overtime...</span>
          </div>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3.5 py-2 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            onClick={handleSimulateImport}
            disabled={isProcessing}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs"
          >
            {isProcessing ? 'Processing...' : 'Simulate Import (Auto Overtime)'}
          </button>
        </div>
      </div>
    </div>
  );
};

// 3. Email Payslip Modal
interface EmailPayslipModalProps {
  isOpen: boolean;
  onClose: () => void;
  employee: Employee | null;
  onSendEmail: (email: string) => void;
}

export const EmailPayslipModal: React.FC<EmailPayslipModalProps> = ({
  isOpen,
  onClose,
  employee,
  onSendEmail,
}) => {
  const [recipient, setRecipient] = useState(employee?.email || '');
  const [sent, setSent] = useState(false);

  if (!isOpen || !employee) return null;

  const handleSend = () => {
    setSent(true);
    setTimeout(() => {
      onSendEmail(recipient);
      setSent(false);
      onClose();
    }, 900);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
          <div className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-emerald-600" />
            <h3 className="font-bold text-slate-900 text-base">Email Payslip Advice</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3 text-xs">
          <div>
            <label className="text-slate-600 font-medium block mb-1">Employee</label>
            <div className="font-semibold text-slate-900">{employee.name} ({employee.position})</div>
          </div>

          <div>
            <label className="text-slate-600 font-medium block mb-1">Recipient Email</label>
            <input
              type="email"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono bg-slate-50"
            />
          </div>

          <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-800 text-[11px]">
            The payslip will be dispatched as a password-protected PDF document. The password is
            the employee&apos;s Date of Birth or NIS number.
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3.5 py-2 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={sent}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center gap-1.5"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{sent ? 'Sending...' : 'Send Payslip'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

// 4. Business Edit Modal
interface BusinessEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  business: BusinessDetails;
  onSave: (b: BusinessDetails) => void;
}

export const BusinessEditModal: React.FC<BusinessEditModalProps> = ({
  isOpen,
  onClose,
  business,
  onSave,
}) => {
  const [form, setForm] = useState<BusinessDetails>({ ...business });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
          <div className="flex items-center gap-2">
            <Building className="w-5 h-5 text-emerald-600" />
            <h3 className="font-bold text-slate-900 text-base">Business & Payslip Settings</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3 text-xs">
          <div>
            <label className="text-slate-600 font-medium block mb-1">Company Legal Name</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg"
            />
          </div>

          <div>
            <label className="text-slate-600 font-medium block mb-1">Registered Address</label>
            <input
              type="text"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-slate-600 font-medium block mb-1">BIR Tax ID</label>
              <input
                type="text"
                value={form.taxRegistrationId}
                onChange={(e) => setForm({ ...form, taxRegistrationId: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono"
              />
            </div>
            <div>
              <label className="text-slate-600 font-medium block mb-1">NIS Registration</label>
              <input
                type="text"
                value={form.nisNumber}
                onChange={(e) => setForm({ ...form, nisNumber: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-slate-600 font-medium block mb-1">Signatory Name</label>
              <input
                type="text"
                value={form.signatoryName}
                onChange={(e) => setForm({ ...form, signatoryName: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg"
              />
            </div>
            <div>
              <label className="text-slate-600 font-medium block mb-1">Signatory Title</label>
              <input
                type="text"
                value={form.signatoryTitle}
                onChange={(e) => setForm({ ...form, signatoryTitle: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg"
              />
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3.5 py-2 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onSave(form);
              onClose();
            }}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs"
          >
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
};

// 5. WhatsApp Direct Share Modal
interface WhatsAppShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  employee: Employee | null;
  payroll: PayrollRun | null;
  business: BusinessDetails;
  renderElementId?: string;
}

export const WhatsAppShareModal: React.FC<WhatsAppShareModalProps> = ({
  isOpen,
  onClose,
  employee,
  payroll,
  business,
  renderElementId = 'payslip-document-render',
}) => {
  const [phone, setPhone] = useState(employee?.phone || '');
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedText, setCopiedText] = useState(false);
  const [copiedImage, setCopiedImage] = useState(false);
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);

  useEffect(() => {
    if (employee) {
      setPhone(employee.phone || '');
      setCopiedText(false);
      setCopiedImage(false);

      // Generate preview snapshot if element exists
      const el = document.getElementById(renderElementId);
      if (el) {
        generatePayslipImageDataUrl(el)
          .then((url) => setPreviewDataUrl(url))
          .catch(() => setPreviewDataUrl(null));
      }
    }
  }, [employee, isOpen, renderElementId]);

  if (!isOpen || !employee || !payroll) return null;

  const messageText = buildWhatsAppMessageText(employee, business, payroll);
  const cleanPhone = formatWhatsAppPhone(phone);

  const handleOpenWhatsAppWithImageDownload = async () => {
    setIsGenerating(true);
    const el = document.getElementById(renderElementId);
    if (el) {
      try {
        await sharePayslipViaWhatsApp(el, employee, business, payroll);
      } catch (err) {
        console.error('Failed to share via WhatsApp:', err);
      }
    } else {
      // Fallback: Just open WhatsApp with prefilled text
      const encoded = encodeURIComponent(messageText);
      const url = cleanPhone
        ? `https://wa.me/${cleanPhone}?text=${encoded}`
        : `https://wa.me/?text=${encoded}`;
      window.open(url, '_blank');
    }
    setIsGenerating(false);
    onClose();
  };

  const handleDownloadImage = async () => {
    const el = document.getElementById(renderElementId);
    if (!el) return;
    setIsGenerating(true);
    try {
      const filename = `Payslip_${employee.name.replace(/\s+/g, '_')}_${payroll.month}_${payroll.year}.png`;
      await downloadPayslipImage(el, filename);
    } catch (err) {
      console.error('Failed to download image:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyImageToClipboard = async () => {
    const el = document.getElementById(renderElementId);
    if (!el) return;
    setIsGenerating(true);
    try {
      const success = await copyPayslipImageToClipboard(el);
      if (success) {
        setCopiedImage(true);
        setTimeout(() => setCopiedImage(false), 3000);
      }
    } catch (err) {
      console.error('Failed to copy image:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyText = () => {
    navigator.clipboard.writeText(messageText);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-emerald-100 flex items-center justify-center text-emerald-600">
              <MessageCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-1.5">
                Share Payslip to WhatsApp
              </h3>
              <p className="text-[11px] text-slate-500">
                Dispatches high-res payslip image &amp; salary breakdown to worker
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Worker Summary Card */}
        <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <img
              src={employee.avatar}
              alt={employee.name}
              className="w-10 h-10 rounded-full object-cover ring-2 ring-emerald-500/30"
              referrerPolicy="no-referrer"
            />
            <div>
              <div className="font-bold text-slate-900 text-sm">{employee.name}</div>
              <div className="text-xs text-slate-500 font-medium">
                Net Pay: <span className="font-bold text-emerald-700">{formatCurrency(employee.netPay)}</span> • {payroll.periodLabel}
              </div>
            </div>
          </div>
          <div className="text-right">
            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold uppercase tracking-wider">
              Ready
            </span>
          </div>
        </div>

        {/* Phone Input */}
        <div className="space-y-3 mb-4">
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1.5 flex items-center justify-between">
              <span>Worker WhatsApp Phone Number</span>
              <span className="text-[10px] font-normal text-slate-400">Include country code</span>
            </label>
            <div className="relative">
              <Smartphone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 (868) 555-0192"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Quick Action Pill Buttons */}
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              onClick={handleDownloadImage}
              disabled={isGenerating}
              className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-slate-600" />
              <span>Download Image (.PNG)</span>
            </button>
            <button
              onClick={handleCopyImageToClipboard}
              disabled={isGenerating}
              className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              {copiedImage ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-600" />}
              <span>{copiedImage ? 'Image Copied!' : 'Copy Image'}</span>
            </button>
            <button
              onClick={handleCopyText}
              className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              {copiedText ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <FileText className="w-3.5 h-3.5 text-slate-600" />}
              <span>{copiedText ? 'Text Copied!' : 'Copy Text'}</span>
            </button>
          </div>
        </div>

        {/* Message Preview Accordion */}
        <div className="mb-4">
          <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
            WhatsApp Message Preview:
          </label>
          <div className="p-3 bg-emerald-50/50 rounded-xl border border-emerald-100 font-mono text-[11px] text-slate-700 max-h-32 overflow-y-auto whitespace-pre-wrap">
            {messageText}
          </div>
        </div>

        {/* Primary Modal Action */}
        <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-100">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleOpenWhatsAppWithImageDownload}
            disabled={isGenerating}
            className="flex-1 max-w-xs px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/25 flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <MessageCircle className="w-4 h-4" />
            <span>{isGenerating ? 'Generating Image...' : 'Send to WhatsApp'}</span>
            <ExternalLink className="w-3.5 h-3.5 opacity-80" />
          </button>
        </div>
      </div>
    </div>
  );
};

// 6. Comprehensive Share Payslip Modal (All Channels)
interface SharePayslipModalProps {
  isOpen: boolean;
  onClose: () => void;
  employee: Employee | null;
  payroll: PayrollRun | null;
  business: BusinessDetails;
  onOpenEmailModal: (emp: Employee) => void;
  renderElementId?: string;
}

export const SharePayslipModal: React.FC<SharePayslipModalProps> = ({
  isOpen,
  onClose,
  employee,
  payroll,
  business,
  onOpenEmailModal,
  renderElementId = 'payslip-document-render',
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedImage, setCopiedImage] = useState(false);

  if (!isOpen || !employee || !payroll) return null;

  const handleDownloadImage = async () => {
    const el = document.getElementById(renderElementId);
    if (!el) return;
    setIsProcessing(true);
    try {
      const filename = `Payslip_${employee.name.replace(/\s+/g, '_')}_${payroll.month}_${payroll.year}.png`;
      await downloadPayslipImage(el, filename);
    } catch (err) {
      console.error('Failed to download image:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownloadPDF = async () => {
    const el = document.getElementById(renderElementId);
    if (!el) return;
    setIsProcessing(true);
    try {
      const filename = `Payslip_${employee.name.replace(/\s+/g, '_')}_${payroll.month}_${payroll.year}.pdf`;
      await downloadPayslipPDF(el, filename);
    } catch (err) {
      console.error('Failed to download PDF:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCopyImage = async () => {
    const el = document.getElementById(renderElementId);
    if (!el) return;
    setIsProcessing(true);
    try {
      const ok = await copyPayslipImageToClipboard(el);
      if (ok) {
        setCopiedImage(true);
        setTimeout(() => setCopiedImage(false), 3000);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePrint = () => {
    window.print();
    onClose();
  };

  const handleNativeShare = async () => {
    const el = document.getElementById(renderElementId);
    if (!el) return;
    setIsProcessing(true);
    try {
      await sharePayslipNative(el, employee, business, payroll);
    } finally {
      setIsProcessing(false);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-emerald-100 flex items-center justify-center text-emerald-600">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Share &amp; Export Payslip</h3>
              <p className="text-[11px] text-slate-500">
                {employee.name} • {payroll.periodLabel}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Share Options Grid */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          {/* 1. WhatsApp */}
          <button
            onClick={async () => {
              const el = document.getElementById(renderElementId);
              if (el) {
                await sharePayslipViaWhatsApp(el, employee, business, payroll);
              }
              onClose();
            }}
            className="p-4 rounded-2xl border border-emerald-200 bg-emerald-50/50 hover:bg-emerald-100/60 text-left transition-all cursor-pointer group"
          >
            <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center mb-2 shadow-xs group-hover:scale-105 transition-transform">
              <MessageCircle className="w-4 h-4" />
            </div>
            <div className="font-bold text-slate-900 text-xs">Share to WhatsApp</div>
            <div className="text-[10px] text-slate-500 mt-0.5">Send PNG image &amp; salary advice</div>
          </button>

          {/* 2. Download Image (PNG) */}
          <button
            onClick={handleDownloadImage}
            disabled={isProcessing}
            className="p-4 rounded-2xl border border-slate-200 hover:border-slate-300 bg-slate-50/70 hover:bg-slate-100 text-left transition-all cursor-pointer group"
          >
            <div className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center mb-2 shadow-xs group-hover:scale-105 transition-transform">
              <FileImage className="w-4 h-4" />
            </div>
            <div className="font-bold text-slate-900 text-xs">Download Image (PNG)</div>
            <div className="text-[10px] text-slate-500 mt-0.5">High-res 2x retina graphic</div>
          </button>

          {/* 3. Download PDF */}
          <button
            onClick={handleDownloadPDF}
            disabled={isProcessing}
            className="p-4 rounded-2xl border border-slate-200 hover:border-slate-300 bg-slate-50/70 hover:bg-slate-100 text-left transition-all cursor-pointer group"
          >
            <div className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center mb-2 shadow-xs group-hover:scale-105 transition-transform">
              <FileText className="w-4 h-4" />
            </div>
            <div className="font-bold text-slate-900 text-xs">Download PDF Document</div>
            <div className="text-[10px] text-slate-500 mt-0.5">Standard A4 printable format</div>
          </button>

          {/* 4. Email */}
          <button
            onClick={() => {
              onClose();
              onOpenEmailModal(employee);
            }}
            className="p-4 rounded-2xl border border-slate-200 hover:border-slate-300 bg-slate-50/70 hover:bg-slate-100 text-left transition-all cursor-pointer group"
          >
            <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center mb-2 shadow-xs group-hover:scale-105 transition-transform">
              <Mail className="w-4 h-4" />
            </div>
            <div className="font-bold text-slate-900 text-xs">Email Payslip</div>
            <div className="text-[10px] text-slate-500 mt-0.5">Direct to {employee.email}</div>
          </button>

          {/* 5. Print */}
          <button
            onClick={handlePrint}
            className="p-4 rounded-2xl border border-slate-200 hover:border-slate-300 bg-slate-50/70 hover:bg-slate-100 text-left transition-all cursor-pointer group"
          >
            <div className="w-8 h-8 rounded-xl bg-slate-700 text-white flex items-center justify-center mb-2 shadow-xs group-hover:scale-105 transition-transform">
              <Printer className="w-4 h-4" />
            </div>
            <div className="font-bold text-slate-900 text-xs">Print Payslip</div>
            <div className="text-[10px] text-slate-500 mt-0.5">Send directly to office printer</div>
          </button>

          {/* 6. Copy Image or Native Share */}
          <button
            onClick={navigator.share ? handleNativeShare : handleCopyImage}
            className="p-4 rounded-2xl border border-slate-200 hover:border-slate-300 bg-slate-50/70 hover:bg-slate-100 text-left transition-all cursor-pointer group"
          >
            <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center mb-2 shadow-xs group-hover:scale-105 transition-transform">
              <Copy className="w-4 h-4" />
            </div>
            <div className="font-bold text-slate-900 text-xs">
              {copiedImage ? 'Image Copied!' : 'Copy to Clipboard'}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">Paste into Slack, Teams, Chat</div>
          </button>
        </div>

        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-semibold hover:bg-slate-800 cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

// 7. Batch WhatsApp Roster Modal
interface BatchWhatsAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  employees: Employee[];
  payroll: PayrollRun | null;
  business: BusinessDetails;
}

export const BatchWhatsAppModal: React.FC<BatchWhatsAppModalProps> = ({
  isOpen,
  onClose,
  employees,
  payroll,
  business,
}) => {
  const [sentMap, setSentMap] = useState<Record<string, boolean>>({});

  if (!isOpen || !payroll) return null;

  const handleSendSingle = (emp: Employee) => {
    const message = buildWhatsAppMessageText(emp, business, payroll);
    const phone = formatWhatsAppPhone(emp.phone || '');
    const encoded = encodeURIComponent(message);
    const url = phone ? `https://wa.me/${phone}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
    
    window.open(url, '_blank');
    setSentMap((prev) => ({ ...prev, [emp.id]: true }));
  };

  const allSent = employees.every((e) => sentMap[e.id]);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-emerald-100 flex items-center justify-center text-emerald-600">
              <MessageCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Batch WhatsApp Dispatch</h3>
              <p className="text-[11px] text-slate-500">
                Send payslip advices directly to all {employees.length} employees on WhatsApp
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress header */}
        <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-200/80 mb-4 flex items-center justify-between">
          <div className="text-xs text-emerald-800 font-semibold">
            Status: {Object.keys(sentMap).length} of {employees.length} Dispatched
          </div>
          <div className="text-xs font-bold text-emerald-700">
            {payroll.periodLabel}
          </div>
        </div>

        {/* Employee Roster */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {employees.map((emp) => {
            const isSent = !!sentMap[emp.id];
            return (
              <div
                key={emp.id}
                className={`p-3 rounded-2xl border flex items-center justify-between gap-3 transition-colors ${
                  isSent ? 'bg-slate-50 border-slate-200' : 'bg-white border-slate-200 hover:border-emerald-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <img
                    src={emp.avatar}
                    alt={emp.name}
                    className="w-9 h-9 rounded-full object-cover ring-1 ring-slate-200"
                    referrerPolicy="no-referrer"
                  />
                  <div>
                    <div className="font-bold text-slate-900 text-xs">{emp.name}</div>
                    <div className="text-[11px] text-slate-500">
                      {emp.phone || 'No phone set'} • Net: {formatCurrency(emp.netPay)}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => handleSendSingle(emp)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                    isSent
                      ? 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                  }`}
                >
                  {isSent ? (
                    <>
                      <CheckCheck className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Resend WhatsApp</span>
                    </>
                  ) : (
                    <>
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span>Send to WhatsApp</span>
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>

        <div className="pt-4 border-t border-slate-100 flex justify-end gap-2 mt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-semibold hover:bg-slate-800 cursor-pointer"
          >
            {allSent ? 'Done' : 'Close Roster'}
          </button>
        </div>
      </div>
    </div>
  );
};

