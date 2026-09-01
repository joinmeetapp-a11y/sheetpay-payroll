import React, { useState, useRef } from 'react';
import { useAction } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import {
  BusinessDetails,
  Employee,
  ExtractedEmployee,
  ImportExtractionResult,
  PayrollRun,
} from '../../types';
import {
  buildExtractionFromData,
  buildExtractionFromOcrEmployees,
  convertImportToRealCaylaData,
  parseCSVToExtractionResult,
} from '../../lib/payrollImportEngine';
import { formatCurrency } from '../../lib/taxEngine';
import { CaylaPenMascot } from '../CaylaPenMascot';
import {
  Upload,
  FileSpreadsheet,
  FileText,
  Camera,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ArrowRight,
  ShieldCheck,
  Sparkles,
  RefreshCw,
  Edit3,
  Check,
  ChevronDown,
  ChevronUp,
  FileUp,
  Layers,
  Database,
  Search,
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface PayrollImportStepProps {
  initialBusiness: BusinessDetails;
  onImportComplete: (
    business: BusinessDetails,
    employees: Employee[],
    payrollRuns: PayrollRun[],
    extractionSummary: any
  ) => void;
  onManualSetup: () => void;
  onBack?: () => void;
  isAccountantMode?: boolean;
  /**
   * Firebase UID of the signed-in caller. Forwarded to the Convex OCR action
   * so the free-plan cap is enforced and successful scans are counted against
   * the right account. Omit for the anonymous / guest funnel — the OCR action
   * skips both checks in that case.
   */
  firebaseUid?: string;
}

export const PayrollImportStep: React.FC<PayrollImportStepProps> = ({
  initialBusiness,
  onImportComplete,
  onManualSetup,
  onBack,
  isAccountantMode = false,
  firebaseUid,
}) => {
  // Sub-stages within the import workflow:
  // 'upload' -> 'processing' -> 'review' -> 'confirmation' -> 'complete'
  const [stage, setStage] = useState<'upload' | 'processing' | 'review' | 'confirmation' | 'complete'>('upload');

  // Drag & drop state
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Processing state
  const [processingProgress, setProcessingProgress] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);
  const [currentStepText, setCurrentStepText] = useState('');

  // Extraction result state
  const [extraction, setExtraction] = useState<ImportExtractionResult | null>(null);
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'needs_attention' | 'ready'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedEmpId, setExpandedEmpId] = useState<string | null>(null);

  // Editable values map for user overrides
  const [editedFields, setEditedFields] = useState<Record<string, Record<string, any>>>({});

  // Question answers map
  const [resolvedQuestions, setResolvedQuestions] = useState<Record<string, any>>({});

  // OCR error banner (only shown if OpenAI OCR fails and we fall back)
  const [ocrError, setOcrError] = useState<string | null>(null);
  const extractPayrollDocument = useAction(api.ai.extractPayrollDocument);

  // Processing sequence steps
  const PROCESSING_STEPS = [
    'Reading uploaded payroll files...',
    'Identifying unique employee profiles...',
    'Finding chronological payroll periods (Jan - Aug 2026)...',
    'Extracting earnings, basic salaries & hourly rates...',
    'Extracting statutory PAYE, NIS & Health Surcharge...',
    'Matching employees across multi-period registers...',
    'Checking for duplicate records and inconsistencies...',
    'Validating cumulative payroll totals...',
    'Preparing your Cayla account...',
  ];

  /**
   * Trigger processing sequence
   */
  const startProcessing = (extractionData: ImportExtractionResult) => {
    setStage('processing');
    setExtraction(extractionData);
    setCompletedSteps([]);
    setProcessingProgress(0);

    PROCESSING_STEPS.forEach((stepMsg, idx) => {
      setTimeout(() => {
        setCurrentStepText(stepMsg);
        setCompletedSteps((prev) => [...prev, stepMsg]);
        setProcessingProgress(Math.round(((idx + 1) / PROCESSING_STEPS.length) * 100));

        if (idx === PROCESSING_STEPS.length - 1) {
          setTimeout(() => {
            setStage('review');
            confetti({
              particleCount: 50,
              spread: 60,
              origin: { y: 0.6 },
              colors: ['#059669', '#10b981', '#34d399'],
            });
          }, 600);
        }
      }, (idx + 1) * 450);
    });
  };

  /**
   * Handle file upload (real user files)
   * - CSV/TSV/TXT: parsed locally (deterministic)
   * - Images (payslip photos, scans): OCR via OpenAI (Convex action)
   * - PDF/XLSX/XLS: fall back to deterministic scaffolding
   */
  const readAsBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1] || '');
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handleFileUpload = async (files: FileList | File[]) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    setOcrError(null);

    if (file.name.endsWith('.csv') || file.name.endsWith('.txt') || file.name.endsWith('.tsv')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        const parsed = parseCSVToExtractionResult(text, file.name);
        startProcessing(parsed);
      };
      reader.readAsText(file);
      return;
    }

    if (file.type.startsWith('image/')) {
      // Show processing UI immediately, then swap in OCR-derived data when ready.
      setStage('processing');
      setCompletedSteps([]);
      setProcessingProgress(0);
      setCurrentStepText('Sending document to OCR...');

      try {
        const fileBase64 = await readAsBase64(file);
        const ocr = await extractPayrollDocument({
          fileBase64,
          mimeType: file.type,
          fileName: file.name,
          requesterUid: firebaseUid,
        });

        if (!ocr.ok || !ocr.employees || ocr.employees.length === 0) {
          // Distinguish the free-plan cap from a soft extraction failure so
          // the UI can nudge the user to upgrade instead of showing a
          // deceptive "we scaffolded something" state.
          if (ocr.error && ocr.error.startsWith('FREE_LIMIT_REACHED')) {
            setOcrError(
              ocr.reason ||
                'You have used all of your free OCR scans this month. Upgrade to keep scanning payroll files.'
            );
            setStage('upload');
            return;
          }
          setOcrError(
            ocr.error ||
              'OCR did not return any employees — falling back to deterministic scaffolding.'
          );
          startProcessing(buildExtractionFromData(initialBusiness.name, file.name));
          return;
        }

        const extractionFromOcr = buildExtractionFromOcrEmployees(
          initialBusiness.name,
          file.name,
          ocr
        );
        startProcessing(extractionFromOcr);
      } catch (err: any) {
        console.error('OCR failed:', err);
        setOcrError(err?.message || 'OCR failed');
        startProcessing(buildExtractionFromData(initialBusiness.name, file.name));
      }
      return;
    }

    // XLSX / XLS / PDF: deterministic scaffolding for now.
    const sampleExtraction = buildExtractionFromData(initialBusiness.name, file.name);
    startProcessing(sampleExtraction);
  };

  /**
   * 1-Click test with realistic 24-employee sample dataset
   */
  const handleLoadSample = (sampleName: string = 'Apex_Logistics_2026_YTD_Payroll_Register.xlsx') => {
    const sampleData = buildExtractionFromData(initialBusiness.name || 'Apex Dynamics Logistics Ltd', sampleName);
    startProcessing(sampleData);
  };

  /**
   * Handle field edit
   */
  const handleInlineFieldEdit = (empId: string, fieldName: string, val: any) => {
    setEditedFields((prev) => ({
      ...prev,
      [empId]: {
        ...(prev[empId] || {}),
        [fieldName]: val,
      },
    }));
  };

  /**
   * Handle resolving question
   */
  const handleAnswerQuestion = (qId: string, value: any) => {
    setResolvedQuestions((prev) => ({
      ...prev,
      [qId]: value,
    }));
  };

  /**
   * Finalize and apply to real Cayla data
   */
  const handleConfirmAndImport = () => {
    if (!extraction) return;

    // Apply any inline user edits into extraction
    const updatedEmployees = extraction.employees.map((emp) => {
      const edits = editedFields[emp.rawId];
      if (!edits) return emp;

      const updated = { ...emp };
      if (edits.name) updated.name = { ...updated.name, value: edits.name, status: 'verified', confidence: 1.0 };
      if (edits.employeeId) updated.employeeId = { ...updated.employeeId, value: edits.employeeId, status: 'verified', confidence: 1.0 };
      if (edits.basicSalary) updated.basicSalary = { ...updated.basicSalary, value: Number(edits.basicSalary), status: 'verified', confidence: 1.0 };
      if (edits.nisNumber) updated.nisNumber = { ...updated.nisNumber, value: edits.nisNumber, status: 'verified', confidence: 1.0 };
      if (edits.birNumber) updated.birNumber = { ...updated.birNumber, value: edits.birNumber, status: 'verified', confidence: 1.0 };
      return updated;
    });

    const finalExtraction: ImportExtractionResult = {
      ...extraction,
      employees: updatedEmployees,
    };

    const realData = convertImportToRealCaylaData(finalExtraction, initialBusiness);

    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.5 },
      colors: ['#059669', '#10b981', '#3b82f6'],
    });

    setStage('complete');
  };

  const handleFinishAndRedirect = () => {
    if (!extraction) return;
    const realData = convertImportToRealCaylaData(extraction, initialBusiness);
    onImportComplete(realData.business, realData.employees, realData.payrollRuns, extraction.summary);
  };

  // Filtered employees for review
  const filteredEmployees = (extraction?.employees || []).filter((emp) => {
    const matchesSearch =
      emp.name.value.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.employeeId.value.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.position.value.toLowerCase().includes(searchQuery.toLowerCase());

    const hasMissingNis = !emp.nisNumber.value;
    const isNeedsAttention = emp.status === 'needs_review' || hasMissingNis;

    if (selectedFilter === 'needs_attention') return matchesSearch && isNeedsAttention;
    if (selectedFilter === 'ready') return matchesSearch && !isNeedsAttention;
    return matchesSearch;
  });

  return (
    <div className="space-y-6 animate-in fade-in select-none">
      
      {/* ========================================================= */}
      {/* STAGE 1: UPLOAD SCREEN */}
      {/* ========================================================= */}
      {stage === 'upload' && (
        <div className="space-y-6">
          {/* Header Title */}
          <div className="text-center space-y-2 max-w-xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold uppercase tracking-wider shadow-xs">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              <span>Zero-Effort Migration</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              Bring your payroll with you.
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              Upload your previous payroll and Cayla will automatically configure your employees, pay rates, statutory taxes, and historical payslips.
            </p>
          </div>

          {/* Drag & Drop Box */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              handleFileUpload(e.dataTransfer.files);
            }}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-3xl p-6 sm:p-8 text-center transition-all cursor-pointer relative overflow-hidden ${
              isDragging
                ? 'border-emerald-500 bg-emerald-50/70 ring-4 ring-emerald-500/20'
                : 'border-slate-300 hover:border-emerald-500 bg-slate-50/70 hover:bg-emerald-50/30'
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
              multiple
              accept=".csv,.xls,.xlsx,.pdf,.txt,.tsv,image/*"
              className="hidden"
            />
            <input
              type="file"
              ref={cameraInputRef}
              capture="environment"
              accept="image/*"
              onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
              className="hidden"
            />

            <div className="flex flex-col items-center justify-center space-y-3">
              <div className="w-16 h-16 rounded-2xl bg-white shadow-md border border-slate-200 flex items-center justify-center text-emerald-600 group-hover:scale-105 transition-transform">
                <FileUp className="w-8 h-8" />
              </div>

              <div className="space-y-1">
                <p className="text-sm font-extrabold text-slate-900">
                  <span className="text-emerald-700 underline underline-offset-2">Click to upload</span> or drag and drop
                </p>
                <p className="text-xs text-slate-500">
                  Upload multiple files at once: Payroll Registers, Spreadsheets, PDF Reports, or Payslips
                </p>
              </div>

              {/* Supported Format Pills */}
              <div className="flex flex-wrap items-center justify-center gap-1.5 pt-2 max-w-lg">
                {[
                  'CSV',
                  'XLS',
                  'XLSX',
                  'PDF Reports',
                  'PDF Payslips',
                  'Scanned Payslips',
                  'Employee Lists',
                  'Registers',
                  'Timesheets',
                ].map((fmt) => (
                  <span
                    key={fmt}
                    className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-white border border-slate-200 text-slate-700 shadow-2xs font-mono"
                  >
                    {fmt}
                  </span>
                ))}
              </div>
            </div>

            {/* Mobile Camera Option Bar */}
            <div className="mt-4 sm:hidden pt-3 border-t border-slate-200 flex justify-center">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  cameraInputRef.current?.click();
                }}
                className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 flex items-center gap-2 shadow-xs"
              >
                <Camera className="w-4 h-4 text-emerald-600" />
                <span>Snap / Scan Payslip Photo</span>
              </button>
            </div>
          </div>

          {/* Quick-Demo Sample Option */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-emerald-500/10 border border-emerald-200 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs shrink-0">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div className="text-left">
                <div className="text-xs font-extrabold text-slate-900 flex items-center gap-2">
                  <span>Want to test with realistic Caribbean payroll data?</span>
                  <span className="text-[9px] bg-emerald-600 text-white px-2 py-0.5 rounded font-mono uppercase">
                    Instant Demo
                  </span>
                </div>
                <p className="text-[11px] text-slate-600">
                  Load full 24-employee register with 8 months of historical PAYE, NIS &amp; overtime.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleLoadSample('Apex_Logistics_2026_YTD_Payroll_Register.xlsx')}
              className="w-full sm:w-auto px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md transition-all shrink-0 cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Load 24-Staff Sample</span>
            </button>
          </div>

          {/* "Explain What Cayla Will Do" Section */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4 shadow-xs">
            <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <CaylaPenMascot size="xs" />
                <h3 className="font-extrabold text-sm text-slate-900">What Cayla Extracts</h3>
              </div>
              <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-emerald-600" />
                Strict Compliance: Never guesses missing data
              </span>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Cayla's extraction engine deterministically reads columns and statutory lines, mapping only data actually present in your documents:
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 pt-1">
              {[
                'Employee names',
                'Employee IDs',
                'Job titles',
                'Salary / Hourly rates',
                'Pay frequency',
                'Regular earnings',
                'Overtime hours & pay',
                'Bonuses & Commissions',
                'Allowances & Stipends',
                'Gross pay',
                'PAYE Income Tax',
                'NIS Contributions',
                'Health Surcharge',
                'Benefits in kind',
                'Other deductions',
                'Employer contributions',
                'Net pay',
                'Payroll period & dates',
                'Year-to-date values',
                'Business tax & NIS IDs',
              ].map((field) => (
                <div key={field} className="flex items-center gap-2 text-[11px] font-semibold text-slate-700">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>{field}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="w-full sm:w-auto px-5 py-2.5 text-slate-600 hover:text-slate-900 font-bold text-xs cursor-pointer"
              >
                Back
              </button>
            )}
            
            <button
              type="button"
              onClick={onManualSetup}
              className="w-full sm:w-auto px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
            >
              I&apos;ll Set It Up Manually
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full sm:w-auto px-8 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-600/25 transition-all flex items-center justify-center gap-2 cursor-pointer ml-auto"
            >
              <Upload className="w-4 h-4" />
              <span>Upload Previous Payroll</span>
            </button>
          </div>
        </div>
      )}

      {ocrError && stage === 'upload' && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900 font-semibold">
          <span className="font-bold">OCR notice:</span> {ocrError}
        </div>
      )}

      {/* ========================================================= */}
      {/* STAGE 2: PROCESSING SCREEN */}
      {/* ========================================================= */}
      {stage === 'processing' && (
        <div className="space-y-6 py-6 text-center animate-in fade-in max-w-lg mx-auto">
          <div className="w-20 h-20 mx-auto bg-emerald-50 rounded-full border-2 border-emerald-200 flex items-center justify-center shadow-lg shadow-emerald-600/10 animate-pulse">
            <CaylaPenMascot size="xl" isProcessing={true} />
          </div>

          <div className="space-y-1">
            <h3 className="text-xl font-black text-slate-900 tracking-tight">
              I&apos;m reading your previous payroll.
            </h3>
            <p className="text-xs text-slate-500 font-medium">
              Extracting employee profiles, historical pay periods, and tax schedules...
            </p>
          </div>

          {/* Progress Bar */}
          <div className="space-y-1.5 text-left">
            <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
              <div
                className="bg-emerald-600 h-2.5 rounded-full transition-all duration-300"
                style={{ width: `${processingProgress}%` }}
              />
            </div>
            <div className="flex justify-between text-[11px] text-slate-400 font-mono">
              <span className="truncate pr-2 font-medium text-slate-600">{currentStepText}</span>
              <span className="shrink-0">{processingProgress}%</span>
            </div>
          </div>

          {/* Real-time Checklist of Steps */}
          <div className="bg-slate-950 text-slate-200 font-mono text-xs p-4 rounded-2xl border border-slate-800 space-y-2 text-left min-h-[160px] max-h-56 overflow-y-auto">
            {completedSteps.map((step, idx) => (
              <div key={idx} className="flex items-center gap-2 animate-in fade-in">
                <span className="text-emerald-400">✓</span>
                <span>{step}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* STAGE 3: REVIEW SCREEN ("Cayla found your payroll") */}
      {/* ========================================================= */}
      {stage === 'review' && extraction && (
        <div className="space-y-6 animate-in fade-in">
          
          {/* Header & Stats Banner */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
            <div>
              <div className="flex items-center gap-2 text-emerald-700 font-bold text-xs uppercase tracking-wider">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Extraction Complete</span>
              </div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                Cayla found your payroll.
              </h2>
              <p className="text-xs text-slate-500">
                Verified high-confidence entries are ready. Review any highlighted fields below before finalizing.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setStage('confirmation')}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer"
              >
                <span>Continue to Import</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Quick Metrics Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="p-3.5 rounded-2xl bg-emerald-50/80 border border-emerald-200 space-y-0.5">
              <div className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">Employees</div>
              <div className="text-lg font-black text-emerald-950">{extraction.summary.totalEmployees} found</div>
              <div className="text-[10px] text-emerald-700">{extraction.summary.salariesFound} salaries verified</div>
            </div>

            <div className="p-3.5 rounded-2xl bg-blue-50/80 border border-blue-200 space-y-0.5">
              <div className="text-[10px] font-bold text-blue-800 uppercase tracking-wider">History Found</div>
              <div className="text-lg font-black text-blue-950">{extraction.summary.totalPeriods} months</div>
              <div className="text-[10px] text-blue-700">{extraction.summary.totalPayslips} historical payslips</div>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-0.5">
              <div className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Gross Value</div>
              <div className="text-lg font-black text-slate-900">{formatCurrency(extraction.summary.historicalGrossPayroll)}</div>
              <div className="text-[10px] text-slate-500">Cumulative YTD total</div>
            </div>

            <div className="p-3.5 rounded-2xl bg-amber-50/80 border border-amber-200 space-y-0.5">
              <div className="text-[10px] font-bold text-amber-800 uppercase tracking-wider">Needs Review</div>
              <div className="text-lg font-black text-amber-950">{extraction.summary.needsReviewCount} items</div>
              <div className="text-[10px] text-amber-700">{extraction.summary.missingNisCount} missing NIS numbers</div>
            </div>
          </div>

          {/* Cayla Questions / Needs Your Attention Box */}
          {extraction.attentionQuestions.length > 0 && (
            <div className="bg-amber-50/60 border border-amber-200 rounded-2xl p-4 space-y-3">
              <div className="flex items-center gap-2 text-amber-900 font-extrabold text-xs">
                <HelpCircle className="w-4 h-4 text-amber-600" />
                <span>Needs Your Attention ({extraction.attentionQuestions.length} Questions)</span>
              </div>

              <div className="space-y-2">
                {extraction.attentionQuestions.map((q) => {
                  const isResolved = resolvedQuestions[q.id] !== undefined;

                  return (
                    <div
                      key={q.id}
                      className={`p-3 rounded-xl border transition-all ${
                        isResolved
                          ? 'bg-white/80 border-emerald-200 opacity-80'
                          : 'bg-white border-amber-300 shadow-xs'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="space-y-0.5">
                          <p className="text-xs font-bold text-slate-900">{q.question}</p>
                          <span className="text-[10px] text-slate-500 font-mono">
                            Employee: {q.employeeName} • Field: {q.fieldName}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {q.options.map((opt) => (
                            <button
                              key={opt.label}
                              type="button"
                              onClick={() => handleAnswerQuestion(q.id, opt.value)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                resolvedQuestions[q.id] === opt.value
                                  ? 'bg-emerald-600 text-white shadow-xs'
                                  : opt.isPrimary
                                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-300 hover:bg-emerald-100'
                                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                              }`}
                            >
                              {resolvedQuestions[q.id] === opt.value && '✓ '}
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Filter Bar & Employee Cards */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl w-fit">
                <button
                  type="button"
                  onClick={() => setSelectedFilter('all')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    selectedFilter === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  All ({extraction.employees.length})
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedFilter('needs_attention')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                    selectedFilter === 'needs_attention'
                      ? 'bg-white text-amber-900 shadow-xs'
                      : 'text-amber-700'
                  }`}
                >
                  <span>Needs Review</span>
                  <span className="px-1.5 py-0.2 bg-amber-100 text-amber-800 text-[10px] rounded-full font-mono">
                    {extraction.summary.needsReviewCount}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedFilter('ready')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    selectedFilter === 'ready' ? 'bg-white text-emerald-900 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  Ready ({extraction.employees.length - extraction.summary.needsReviewCount})
                </button>
              </div>

              {/* Search */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search extracted employees..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:border-emerald-500 w-full sm:w-60"
                />
              </div>
            </div>

            {/* Employee Cards List */}
            <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
              {filteredEmployees.map((emp) => {
                const isExpanded = expandedEmpId === emp.rawId;
                const edits = editedFields[emp.rawId] || {};
                const currentName = edits.name ?? emp.name.value;
                const currentSalary = edits.basicSalary ?? emp.basicSalary.value;
                const currentNis = edits.nisNumber ?? emp.nisNumber.value;
                const isMissingNis = !currentNis;

                return (
                  <div
                    key={emp.rawId}
                    className={`rounded-2xl border transition-all ${
                      isMissingNis
                        ? 'bg-amber-50/40 border-amber-200'
                        : 'bg-white hover:bg-slate-50/80 border-slate-200'
                    }`}
                  >
                    <div
                      onClick={() => setExpandedEmpId(isExpanded ? null : emp.rawId)}
                      className="p-3.5 flex items-center justify-between gap-3 cursor-pointer"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <img
                          src={emp.avatar}
                          alt={currentName}
                          className="w-9 h-9 rounded-full object-cover border border-slate-200 shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-xs text-slate-900 truncate">
                              {currentName}
                            </span>
                            <span className="text-[10px] font-mono text-slate-400">
                              {emp.employeeId.value}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 truncate">
                            {emp.position.value} • {emp.department.value}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right">
                          <div className="font-extrabold text-xs text-slate-900">
                            {formatCurrency(currentSalary)}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            Net: {formatCurrency(emp.netPay.value)}
                          </div>
                        </div>

                        {/* Status Badge */}
                        {isMissingNis ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-200">
                            Missing NIS
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-200 flex items-center gap-1">
                            <Check className="w-3 h-3 stroke-[3]" />
                            <span>Ready</span>
                          </span>
                        )}

                        <div className="text-slate-400">
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </div>
                      </div>
                    </div>

                    {/* Expanded Inline Detail & Edit View */}
                    {isExpanded && (
                      <div className="px-4 pb-4 pt-2 border-t border-slate-100 space-y-3 bg-slate-50/50 rounded-b-2xl animate-in fade-in">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                          
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-500">Basic Monthly Pay</label>
                            <input
                              type="number"
                              value={currentSalary}
                              onChange={(e) => handleInlineFieldEdit(emp.rawId, 'basicSalary', e.target.value)}
                              className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:border-emerald-500"
                            />
                            <span className="text-[9px] text-emerald-700 flex items-center gap-1 font-mono">
                              ✓ {Math.round(emp.basicSalary.confidence * 100)}% confidence
                            </span>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-500">
                              NIS / Social Security ID
                            </label>
                            <input
                              type="text"
                              value={currentNis}
                              placeholder="Missing (Add now or later)"
                              onChange={(e) => handleInlineFieldEdit(emp.rawId, 'nisNumber', e.target.value)}
                              className={`w-full px-2.5 py-1.5 rounded-lg text-xs font-mono font-semibold focus:outline-none ${
                                isMissingNis
                                  ? 'bg-amber-50 border border-amber-300 text-amber-900 placeholder:text-amber-500'
                                  : 'bg-white border border-slate-200'
                              }`}
                            />
                            <span className="text-[9px] text-slate-500 font-mono">
                              {isMissingNis ? '⚠️ Needs input or leave blank' : `✓ ${emp.nisNumber.sourceLocation}`}
                            </span>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-500">PAYE Income Tax</label>
                            <div className="px-2.5 py-1.5 bg-slate-100 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700">
                              {formatCurrency(emp.paye.value)}
                            </div>
                            <span className="text-[9px] text-slate-400">Calculated deterministically</span>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-500">History Verified</label>
                            <div className="px-2.5 py-1.5 bg-slate-100 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 truncate">
                              {emp.periodsFound.length} Pay Cycles
                            </div>
                            <span className="text-[9px] text-slate-400">Jan 2026 → Aug 2026</span>
                          </div>

                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Review Footer */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
            <button
              type="button"
              onClick={() => setStage('upload')}
              className="w-full sm:w-auto px-5 py-2.5 text-slate-600 hover:text-slate-900 font-bold text-xs cursor-pointer"
            >
              Upload Different Files
            </button>

            <button
              type="button"
              onClick={() => setStage('confirmation')}
              className="w-full sm:w-auto px-8 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-600/25 transition-all flex items-center justify-center gap-2 cursor-pointer ml-auto"
            >
              <span>Review Import Summary</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* STAGE 4: CONFIRMATION SCREEN */}
      {/* ========================================================= */}
      {stage === 'confirmation' && extraction && (
        <div className="space-y-6 animate-in fade-in max-w-xl mx-auto">
          <div className="text-center space-y-1.5">
            <div className="w-14 h-14 mx-auto bg-emerald-100 rounded-full border border-emerald-300 flex items-center justify-center shadow-md">
              <Database className="w-7 h-7 text-emerald-600" />
            </div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">
              Ready to import
            </h2>
            <p className="text-xs text-slate-500">
              Cayla will create real production entities and historical payroll records.
            </p>
          </div>

          {/* Summary Breakdown Card */}
          <div className="bg-slate-50 rounded-2xl border border-slate-200 p-5 space-y-3 shadow-xs">
            <div className="flex items-center justify-between py-1.5 border-b border-slate-200 text-xs">
              <span className="font-bold text-slate-600">Company Legal Entity</span>
              <span className="font-extrabold text-slate-900">{extraction.businessName?.value || initialBusiness.name}</span>
            </div>

            <div className="flex items-center justify-between py-1.5 border-b border-slate-200 text-xs">
              <span className="font-bold text-slate-600">Employees to Create</span>
              <span className="font-extrabold text-slate-900">{extraction.summary.totalEmployees} Active Staff</span>
            </div>

            <div className="flex items-center justify-between py-1.5 border-b border-slate-200 text-xs">
              <span className="font-bold text-slate-600">Historical Pay Cycles</span>
              <span className="font-extrabold text-slate-900">{extraction.summary.totalPeriods} Months (Jan - Aug 2026)</span>
            </div>

            <div className="flex items-center justify-between py-1.5 border-b border-slate-200 text-xs">
              <span className="font-bold text-slate-600">Historical Payslips</span>
              <span className="font-extrabold text-slate-900">{extraction.summary.totalPayslips} Real Payslips</span>
            </div>

            <div className="flex items-center justify-between py-1.5 border-b border-slate-200 text-xs">
              <span className="font-bold text-slate-600">Historical Gross Payroll</span>
              <span className="font-extrabold text-emerald-700">{formatCurrency(extraction.summary.historicalGrossPayroll)}</span>
            </div>

            <div className="flex items-center justify-between py-1.5 text-xs">
              <span className="font-bold text-slate-600">Missing Information</span>
              <span className="font-bold text-amber-700 font-mono">
                {extraction.summary.missingFieldsCount} fields marked as Missing
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
            <button
              type="button"
              onClick={() => setStage('review')}
              className="w-full sm:w-auto px-5 py-2.5 text-slate-600 hover:text-slate-900 font-bold text-xs cursor-pointer"
            >
              Review Missing Information
            </button>

            <button
              type="button"
              onClick={handleConfirmAndImport}
              className="w-full sm:w-auto px-8 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm rounded-xl shadow-xl shadow-emerald-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer ml-auto"
            >
              <CaylaPenMascot size="xs" />
              <span>Import into Cayla</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* STAGE 5: COMPLETION SCREEN */}
      {/* ========================================================= */}
      {stage === 'complete' && extraction && (
        <div className="space-y-6 text-center py-6 animate-in fade-in max-w-lg mx-auto">
          <div className="w-20 h-20 mx-auto bg-emerald-100 rounded-full border-2 border-emerald-300 flex items-center justify-center shadow-lg shadow-emerald-600/15">
            <CheckCircle2 className="w-10 h-10 text-emerald-600" />
          </div>

          <div className="space-y-2">
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">
              You&apos;re ready. 🎉
            </h2>
            <div className="text-xs font-bold text-emerald-800 bg-emerald-50 px-3 py-1 rounded-full inline-block border border-emerald-200">
              Cayla imported {extraction.summary.totalEmployees} employees &amp; {extraction.summary.totalPeriods} pay periods
            </div>
            <p className="text-xs sm:text-sm text-slate-600 pt-2 leading-relaxed">
              &quot;Your previous payroll is now in Cayla. Next time, just tell me what changed or ask me to run the next payroll.&quot;
            </p>
          </div>

          <div className="pt-4 flex justify-center">
            <button
              type="button"
              onClick={handleFinishAndRedirect}
              className="px-10 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm rounded-2xl shadow-xl shadow-emerald-600/30 transition-all flex items-center gap-2.5 cursor-pointer"
            >
              <CaylaPenMascot size="xs" />
              <span>Go to Cayla Dashboard</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
