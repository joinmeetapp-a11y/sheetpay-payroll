import React, { useState, useEffect, useRef } from 'react';
import { useAction } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { CaylaPenMascot } from '../CaylaPenMascot';
import { AccountType, BusinessDetails, Employee, PayrollRun } from '../../types';
import {
  ArrowRight,
  CheckCircle2,
  Building2,
  Calendar,
  Users,
  Mic,
  FileSpreadsheet,
  Check,
  X,
  Layers,
  Sparkles,
  Briefcase,
  FileUp,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { PayrollImportStep } from './PayrollImportStep';

interface OnboardingFlowProps {
  initialBusiness: BusinessDetails;
  initialEmployees: Employee[];
  initialAccountType?: AccountType;
  onComplete: (
    business: BusinessDetails,
    employees: Employee[],
    accountType: AccountType,
    importedPayrollRuns?: PayrollRun[]
  ) => void;
  onCancel: () => void;
}

export const OnboardingFlow: React.FC<OnboardingFlowProps> = ({
  initialBusiness,
  initialEmployees,
  initialAccountType = 'business',
  onComplete,
  onCancel,
}) => {
  // Step tracker:
  // 1: Meet Cayla
  // 2: Role Selection ("How will you use Cayla?")
  // 3: Business Setup
  // 4: Bring Your Payroll With You (Payroll Migration / Extraction)
  // 5: Payroll Frequency (Manual path)
  // 6: Add / Verify Employees (Manual path)
  // 7: Voice & Prompt Tutorial
  // 8: Autonomous First Payroll Run
  // 9: Product Walkthrough & Launch
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [accountType, setAccountType] = useState<AccountType>(initialAccountType);

  // Business Setup State
  const [businessData, setBusinessData] = useState<BusinessDetails>({
    ...initialBusiness,
    name: initialBusiness.name || 'Apex Dynamics Logistics Ltd',
    currency: initialBusiness.currency || 'TTD',
    currencySymbol: initialBusiness.currencySymbol || '$',
  });

  // Payroll Config State
  const [payFrequency, setPayFrequency] = useState<'monthly' | 'fortnightly' | 'weekly'>('monthly');
  const [nextPayDate, setNextPayDate] = useState<string>('2026-08-31');

  // Employees State
  const [employeesList, setEmployeesList] = useState<Employee[]>(initialEmployees);
  const [importedRuns, setImportedRuns] = useState<PayrollRun[]>([]);
  const [newEmpName, setNewEmpName] = useState('');
  const [newEmpPos, setNewEmpPos] = useState('');
  const [newEmpSalary, setNewEmpSalary] = useState('8500');

  // Tutorial Interactive Voice — real recording + OpenAI transcription via Convex
  const [isMicActive, setIsMicActive] = useState(false);
  const [transcriptText, setTranscriptText] = useState('');
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const transcribeAudio = useAction(api.ai.transcribeAudio);

  // Agent Multi-Step Run State
  const [runProgress, setRunProgress] = useState(0);
  const [runLogs, setRunLogs] = useState<string[]>([]);

  // -------------------------------------------------------------
  // Voice Tutorial — real microphone capture + OpenAI transcription
  // -------------------------------------------------------------
  const blobToBase64 = (blob: Blob): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        // strip the `data:<mime>;base64,` prefix
        const base64 = result.split(',')[1] || '';
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

  const stopAudioStream = () => {
    audioStreamRef.current?.getTracks().forEach((t) => t.stop());
    audioStreamRef.current = null;
  };

  const startVoiceTutorial = async () => {
    setVoiceError(null);

    // If we're already recording, stop and let the onstop handler transcribe.
    if (isMicActive && mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
      return;
    }

    setTranscriptText('');

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setVoiceError('Microphone not available in this browser.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;
      const mime =
        typeof MediaRecorder !== 'undefined' &&
        MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : 'audio/webm';
      const recorder = new MediaRecorder(stream, { mimeType: mime });
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stopAudioStream();
        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType });
        audioChunksRef.current = [];
        if (blob.size === 0) {
          setIsMicActive(false);
          return;
        }
        setTranscriptText('Transcribing…');
        try {
          const audioBase64 = await blobToBase64(blob);
          const result = await transcribeAudio({
            audioBase64,
            mimeType: recorder.mimeType || 'audio/webm',
            language: 'en',
          });
          if (result.error) {
            setVoiceError(result.error);
            setTranscriptText('');
          } else {
            setTranscriptText(result.text || '');
          }
        } catch (err: any) {
          setVoiceError(err?.message || 'Transcription failed');
          setTranscriptText('');
        } finally {
          setIsMicActive(false);
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsMicActive(true);
    } catch (err: any) {
      setVoiceError(err?.message || 'Microphone permission denied.');
      stopAudioStream();
      setIsMicActive(false);
    }
  };

  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current?.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      stopAudioStream();
    };
  }, []);

  // -------------------------------------------------------------
  // Autonomous Run Generator in Step 8
  // -------------------------------------------------------------
  useEffect(() => {
    if (currentStep === 8) {
      setRunLogs([]);
      setRunProgress(0);

      const steps =
        accountType === 'accountant'
          ? [
              'Connecting multi-tenant client instances...',
              'Validating regional tax compliance rules (PAYE, NIS, Health Surcharge)...',
              'Checking client timesheets and attendance anomalies...',
              'Generating isolated draft registers across client entities...',
              'Cayla cross-client workspace initialized.',
            ]
          : [
              'Checking employees...',
              'Loading payroll information...',
              'Calculating earnings & overtime...',
              'Calculating statutory deductions (PAYE, NIS, Health Surcharge)...',
              'Checking payroll for anomalies...',
              'Generating draft payslips with authorized signatures...',
              'Your first payroll is ready.',
            ];

      steps.forEach((msg, idx) => {
        setTimeout(() => {
          setRunLogs((prev) => [...prev, msg]);
          setRunProgress(((idx + 1) / steps.length) * 100);
          if (idx === steps.length - 1) {
            confetti({
              particleCount: 60,
              spread: 70,
              origin: { y: 0.6 },
            });
          }
        }, (idx + 1) * 600);
      });
    }
  }, [currentStep, accountType]);

  const handleAddEmployee = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmpName.trim()) return;

    const salaryNum = parseFloat(newEmpSalary) || 8500;
    const newEmp: Employee = {
      id: `emp-${Date.now()}`,
      name: newEmpName.trim(),
      employeeId: `EMP-0${employeesList.length + 101}`,
      position: newEmpPos.trim() || 'Team Member',
      department: 'Operations',
      avatar: `https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80`,
      email: `${newEmpName.toLowerCase().replace(/\s+/g, '.')}@example.com`,
      phone: '+1 (868) 555-0199',
      payFrequency: payFrequency,
      basicPay: salaryNum,
      frequencySalary: salaryNum,
      overtimeHours: 0,
      overtimeRate: salaryNum / 160,
      bonus: 0,
      commission: 0,
      allowances: 0,
      paye: Math.round(salaryNum * 0.12),
      nis: Math.round(salaryNum * 0.05),
      healthSurcharge: 33,
      otherDeductions: 0,
      grossPay: salaryNum,
      netPay: Math.round(salaryNum - (salaryNum * 0.17 + 33)),
      status: 'pending',
    };

    setEmployeesList([...employeesList, newEmp]);
    setNewEmpName('');
    setNewEmpPos('');
  };

  /**
   * Handle when user finishes the Import Payroll Step
   */
  const handlePayrollImportSuccess = (
    importedBiz: BusinessDetails,
    importedEmps: Employee[],
    importedPayrollRuns: PayrollRun[]
  ) => {
    setBusinessData(importedBiz);
    setEmployeesList(importedEmps);
    setImportedRuns(importedPayrollRuns);
    // Direct completion to populate the dashboard immediately with real data
    onComplete(importedBiz, importedEmps, accountType, importedPayrollRuns);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto font-sans select-none">
      <div className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-auto animate-in zoom-in-95 duration-300">
        
        {/* Top Progress Bar & Header (Grey-White Mix Styling) */}
        <div className="bg-slate-50 text-slate-900 px-6 py-4 flex items-center justify-between border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 border border-emerald-200 flex items-center justify-center">
              <CaylaPenMascot size="xs" isProcessing={currentStep === 8} />
            </div>
            <div>
              <div className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                <span>Sheetpay Onboarding</span>
                <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-mono font-bold">
                  Step {currentStep} of 9
                </span>
              </div>
              <p className="text-[11px] text-slate-500">Set up Cayla, your AI Payroll Agent in under 2 minutes</p>
            </div>
          </div>

          <button
            onClick={onCancel}
            className="p-1.5 rounded-full hover:bg-slate-200 text-slate-500 hover:text-slate-900 transition-colors cursor-pointer"
            title="Skip Onboarding"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Linear Step Indicator Line */}
        <div className="w-full bg-slate-200 h-1">
          <div
            className="bg-emerald-500 h-1 transition-all duration-500"
            style={{ width: `${(currentStep / 9) * 100}%` }}
          />
        </div>

        {/* Content Body based on Step */}
        <div className="p-6 sm:p-8 flex-1 overflow-y-auto max-h-[75vh]">
          
          {/* ========================================================= */}
          {/* STEP 1: Meet Cayla */}
          {/* ========================================================= */}
          {currentStep === 1 && (
            <div className="space-y-6 text-center py-4 animate-in fade-in">
              <div className="w-24 h-24 mx-auto bg-emerald-50 rounded-full border-2 border-emerald-200 flex items-center justify-center shadow-lg shadow-emerald-600/10">
                <CaylaPenMascot size="2xl" showStatusDot={true} />
              </div>

              <div className="space-y-2 max-w-md mx-auto">
                <h2 className="text-2xl sm:text-3xl font-black text-slate-950 tracking-tight">
                  Hi, I&apos;m Cayla 👋
                </h2>
                <div className="text-xs font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full inline-block border border-emerald-200">
                  Your AI Payroll Agent
                </div>
                <p className="text-slate-600 text-sm leading-relaxed pt-2">
                  I handle payroll calculations, statutory taxes, multi-client portfolios, and compliant payslips.
                </p>
                <p className="text-xs font-semibold text-slate-500">
                  Let&apos;s get your workspace set up in a few quick steps.
                </p>
              </div>

              <div className="pt-4 flex justify-center">
                <button
                  onClick={() => setCurrentStep(2)}
                  className="px-8 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-2xl shadow-lg shadow-emerald-600/25 transition-all flex items-center gap-2 cursor-pointer"
                >
                  <span>Let&apos;s Begin</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* STEP 2: Role Selection ("How will you use Cayla?") */}
          {/* ========================================================= */}
          {currentStep === 2 && (
            <div className="space-y-6 animate-in fade-in">
              <div className="space-y-1 text-center max-w-md mx-auto">
                <div className="flex items-center justify-center gap-2 text-emerald-700 font-bold text-xs uppercase tracking-wider">
                  <Sparkles className="w-4 h-4" />
                  <span>Account Type</span>
                </div>
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                  How will you use Cayla?
                </h2>
                <p className="text-xs text-slate-500">
                  Select your primary role to configure single-company tools or multi-tenant accountant features.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3 max-w-xl mx-auto pt-2">
                {[
                  {
                    type: 'business' as AccountType,
                    title: 'Business Owner / Employer',
                    badge: 'Single Business',
                    description: 'Run payroll for your own company, track employee hours, and generate compliant payslips.',
                    icon: Building2,
                  },
                  {
                    type: 'accountant' as AccountType,
                    title: 'Accountant / Accounting Firm',
                    badge: 'Multi-Client Command Center',
                    description: 'Manage payroll for multiple client businesses from one account with batch processing and client portals.',
                    icon: Layers,
                  },
                  {
                    type: 'accountant' as AccountType,
                    title: 'Payroll Professional',
                    badge: 'Practitioner',
                    description: 'Execute high-volume payroll cycles across regional Caribbean & international corporate entities.',
                    icon: Briefcase,
                  },
                ].map((option, idx) => {
                  const Icon = option.icon;
                  const isSelected = accountType === option.type && (idx !== 2 || accountType === 'accountant');

                  return (
                    <div
                      key={option.title}
                      onClick={() => setAccountType(option.type)}
                      className={`p-4 sm:p-5 rounded-2xl border transition-all cursor-pointer flex items-start gap-4 ${
                        isSelected
                          ? 'bg-emerald-50/90 border-emerald-500 ring-2 ring-emerald-500/20 shadow-md'
                          : 'bg-white hover:bg-slate-50 border-slate-200'
                      }`}
                    >
                      <div
                        className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                          isSelected
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        <Icon className="w-6 h-6" />
                      </div>

                      <div className="flex-1 space-y-1">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <h3 className="font-extrabold text-sm text-slate-900">{option.title}</h3>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-md font-mono ${
                              isSelected
                                ? 'bg-emerald-200/70 text-emerald-900'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {option.badge}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 leading-relaxed">{option.description}</p>
                      </div>

                      <div className="mt-1">
                        <div
                          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                            isSelected
                              ? 'border-emerald-600 bg-emerald-600 text-white'
                              : 'border-slate-300'
                          }`}
                        >
                          {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="pt-4 flex justify-between items-center max-w-xl mx-auto">
                <button
                  type="button"
                  onClick={() => setCurrentStep(1)}
                  className="px-5 py-2.5 text-slate-600 hover:text-slate-900 font-bold text-xs cursor-pointer"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentStep(3)}
                  className="px-8 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-600/25 transition-all flex items-center gap-2 cursor-pointer"
                >
                  <span>Continue</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* STEP 3: Business Setup */}
          {/* ========================================================= */}
          {currentStep === 3 && (
            <div className="space-y-6 animate-in fade-in">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-emerald-700 font-bold text-xs uppercase tracking-wider">
                  <Building2 className="w-4 h-4" />
                  <span>{accountType === 'accountant' ? 'Firm & Primary Entity' : 'Company Profile'}</span>
                </div>
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                  {accountType === 'accountant'
                    ? 'Configure your accounting practice'
                    : 'Tell Cayla about your business'}
                </h2>
                <p className="text-xs text-slate-500">
                  {accountType === 'accountant'
                    ? 'Set your firm details and initial client entity defaults.'
                    : 'Cayla uses this info on payslips and for statutory tax remittance calculations.'}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-xs font-bold text-slate-700">
                    {accountType === 'accountant' ? 'Accounting Firm / Practice Name' : 'Company Legal Name'}
                  </label>
                  <input
                    type="text"
                    value={businessData.name}
                    onChange={(e) => setBusinessData({ ...businessData, name: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:border-emerald-600 focus:outline-none"
                    placeholder={accountType === 'accountant' ? 'e.g. Apex Advisory & Payroll Services' : 'e.g. Apex Dynamics Ltd'}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Tax / BIR Registration Number</label>
                  <input
                    type="text"
                    value={businessData.taxRegistrationId}
                    onChange={(e) => setBusinessData({ ...businessData, taxRegistrationId: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:border-emerald-600 focus:outline-none font-mono"
                    placeholder="e.g. 10948392-01"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">National Insurance / NIS Employer ID</label>
                  <input
                    type="text"
                    value={businessData.nisNumber}
                    onChange={(e) => setBusinessData({ ...businessData, nisNumber: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:border-emerald-600 focus:outline-none font-mono"
                    placeholder="e.g. 8849204"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Operating Currency</label>
                  <select
                    value={businessData.currency}
                    onChange={(e) => setBusinessData({ ...businessData, currency: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:border-emerald-600 focus:outline-none"
                  >
                    <option value="TTD">Trinidad &amp; Tobago Dollar ($ TTD)</option>
                    <option value="USD">United States Dollar ($ USD)</option>
                    <option value="BBD">Barbados Dollar ($ BBD)</option>
                    <option value="GYD">Guyana Dollar ($ GYD)</option>
                    <option value="JMD">Jamaica Dollar ($ JMD)</option>
                    <option value="GBP">British Pound (£ GBP)</option>
                    <option value="CAD">Canadian Dollar ($ CAD)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Authorizing Signatory</label>
                  <input
                    type="text"
                    value={businessData.signatoryName}
                    onChange={(e) => setBusinessData({ ...businessData, signatoryName: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:border-emerald-600 focus:outline-none"
                    placeholder="e.g. Sarah Mohammed (HR Director)"
                  />
                </div>
              </div>

              <div className="pt-4 flex justify-between items-center">
                <button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  className="px-5 py-2.5 text-slate-600 hover:text-slate-900 font-bold text-xs cursor-pointer"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentStep(4)}
                  className="px-8 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-600/25 transition-all flex items-center gap-2 cursor-pointer"
                >
                  <span>Next: Import Payroll</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* STEP 4: Bring Your Payroll With You (Payroll Migration) */}
          {/* ========================================================= */}
          {currentStep === 4 && (
            <PayrollImportStep
              initialBusiness={businessData}
              onImportComplete={handlePayrollImportSuccess}
              onManualSetup={() => setCurrentStep(5)}
              onBack={() => setCurrentStep(3)}
              isAccountantMode={accountType === 'accountant'}
            />
          )}

          {/* ========================================================= */}
          {/* STEP 5: Payroll Frequency (Manual fallback) */}
          {/* ========================================================= */}
          {currentStep === 5 && (
            <div className="space-y-6 animate-in fade-in">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-emerald-700 font-bold text-xs uppercase tracking-wider">
                  <Calendar className="w-4 h-4" />
                  <span>Pay Frequency</span>
                </div>
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                  How often do you run payroll?
                </h2>
                <p className="text-xs text-slate-500">
                  Cayla sets statutory calculation periods and reminders based on your cycle.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  {
                    id: 'monthly',
                    title: 'Monthly',
                    desc: '12 pay periods per year. Standard for salaried teams.',
                    badge: 'Most Common',
                  },
                  {
                    id: 'fortnightly',
                    title: 'Fortnightly',
                    desc: '26 pay periods per year. Bi-weekly pay schedule.',
                    badge: 'Popular',
                  },
                  {
                    id: 'weekly',
                    title: 'Weekly',
                    desc: '52 pay periods per year. Ideal for shifts & hourly crews.',
                    badge: 'Hourly Crews',
                  },
                ].map((item) => (
                  <div
                    key={item.id}
                    onClick={() => setPayFrequency(item.id as any)}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between space-y-3 ${
                      payFrequency === item.id
                        ? 'bg-emerald-50/90 border-emerald-500 ring-2 ring-emerald-500/20'
                        : 'bg-white hover:bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-sm text-slate-900">{item.title}</span>
                      {payFrequency === item.id && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                    </div>
                    <p className="text-[11px] text-slate-500 leading-snug">{item.desc}</p>
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/60 px-2 py-0.5 rounded w-fit">
                      {item.badge}
                    </span>
                  </div>
                ))}
              </div>

              <div className="pt-2">
                <label className="text-xs font-bold text-slate-700 block mb-1.5">
                  Upcoming Payroll Pay Date
                </label>
                <input
                  type="date"
                  value={nextPayDate}
                  onChange={(e) => setNextPayDate(e.target.value)}
                  className="w-full sm:w-64 px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:border-emerald-600 focus:outline-none"
                />
              </div>

              <div className="pt-4 flex justify-between items-center">
                <button
                  type="button"
                  onClick={() => setCurrentStep(4)}
                  className="px-5 py-2.5 text-slate-600 hover:text-slate-900 font-bold text-xs cursor-pointer"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentStep(6)}
                  className="px-8 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-600/25 transition-all flex items-center gap-2 cursor-pointer"
                >
                  <span>Next: Employee Directory</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* STEP 6: Add / Verify Employees (Manual roster) */}
          {/* ========================================================= */}
          {currentStep === 6 && (
            <div className="space-y-6 animate-in fade-in">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-emerald-700 font-bold text-xs uppercase tracking-wider">
                  <Users className="w-4 h-4" />
                  <span>Team Members</span>
                </div>
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                  Your active employee roster ({employeesList.length})
                </h2>
                <p className="text-xs text-slate-500">
                  Review starter team members or quickly add new employees now.
                </p>
              </div>

              {/* Employees List Preview */}
              <div className="bg-slate-50 rounded-2xl border border-slate-200 p-3 max-h-48 overflow-y-auto divide-y divide-slate-200/70">
                {employeesList.slice(0, 6).map((emp) => (
                  <div key={emp.id} className="py-2 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2.5">
                      <img src={emp.avatar} alt={emp.name} className="w-7 h-7 rounded-full object-cover" />
                      <div>
                        <div className="font-bold text-slate-900">{emp.name}</div>
                        <div className="text-[10px] text-slate-500">{emp.position}</div>
                      </div>
                    </div>
                    <div className="font-mono font-bold text-slate-800">
                      ${emp.basicPay.toLocaleString()} / mo
                    </div>
                  </div>
                ))}
              </div>

              {/* Quick Add Form */}
              <form onSubmit={handleAddEmployee} className="p-3.5 bg-emerald-50/70 rounded-2xl border border-emerald-200 space-y-3">
                <div className="text-xs font-bold text-emerald-900">Add an Employee</div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <input
                    type="text"
                    placeholder="Full Name"
                    value={newEmpName}
                    onChange={(e) => setNewEmpName(e.target.value)}
                    className="px-3 py-1.5 bg-white border border-emerald-300 rounded-lg text-xs"
                  />
                  <input
                    type="text"
                    placeholder="Position"
                    value={newEmpPos}
                    onChange={(e) => setNewEmpPos(e.target.value)}
                    className="px-3 py-1.5 bg-white border border-emerald-300 rounded-lg text-xs"
                  />
                  <input
                    type="number"
                    placeholder="Monthly Basic Pay"
                    value={newEmpSalary}
                    onChange={(e) => setNewEmpSalary(e.target.value)}
                    className="px-3 py-1.5 bg-white border border-emerald-300 rounded-lg text-xs"
                  />
                </div>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-lg cursor-pointer transition-colors"
                >
                  + Add to Roster
                </button>
              </form>

              <div className="pt-4 flex justify-between items-center">
                <button
                  type="button"
                  onClick={() => setCurrentStep(5)}
                  className="px-5 py-2.5 text-slate-600 hover:text-slate-900 font-bold text-xs cursor-pointer"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentStep(7)}
                  className="px-8 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-600/25 transition-all flex items-center gap-2 cursor-pointer"
                >
                  <span>Next: Voice &amp; Prompt Tutorial</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* STEP 7: Voice & Prompt Tutorial */}
          {/* ========================================================= */}
          {currentStep === 7 && (
            <div className="space-y-6 animate-in fade-in text-center max-w-lg mx-auto">
              <div className="space-y-1">
                <div className="flex items-center justify-center gap-2 text-emerald-700 font-bold text-xs uppercase tracking-wider">
                  <Mic className="w-4 h-4" />
                  <span>Conversational Control</span>
                </div>
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                  How you talk to Cayla
                </h2>
                <p className="text-xs text-slate-500">
                  {accountType === 'accountant'
                    ? 'Say what you need across your client portfolio — Cayla executes multi-tenant commands immediately.'
                    : 'Say what you need in plain English — Cayla calculates taxes and updates numbers immediately.'}
                </p>
              </div>

              <div className="p-6 bg-slate-900 text-white rounded-3xl space-y-4 shadow-xl">
                <div className="flex items-center justify-center">
                  <button
                    onClick={startVoiceTutorial}
                    className={`w-16 h-16 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                      isMicActive
                        ? 'bg-rose-500 shadow-lg shadow-rose-500/50 scale-110 animate-pulse'
                        : 'bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-600/30'
                    }`}
                  >
                    <Mic className="w-8 h-8 text-white" />
                  </button>
                </div>

                <div className="text-xs text-slate-400 font-medium">
                  {isMicActive
                    ? 'Recording — click again to stop and transcribe.'
                    : 'Click the microphone and say a command.'}
                </div>

                <div className="min-h-[50px] p-3 bg-slate-950 rounded-2xl border border-slate-800 flex items-center justify-center">
                  <p className="text-sm font-bold text-emerald-400 italic">
                    {transcriptText || (
                      accountType === 'accountant'
                        ? '"Which clients have payroll due this week?"'
                        : '"Run payroll for this month and give Marcus 8 hours overtime."'
                    )}
                  </p>
                </div>

                {voiceError && (
                  <p className="text-[11px] font-semibold text-rose-300">
                    {voiceError}
                  </p>
                )}
              </div>

              <div className="pt-2 flex justify-between items-center">
                <button
                  type="button"
                  onClick={() => setCurrentStep(6)}
                  className="px-5 py-2.5 text-slate-600 hover:text-slate-900 font-bold text-xs cursor-pointer"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentStep(8)}
                  className="px-8 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-600/25 transition-all flex items-center gap-2 cursor-pointer"
                >
                  <span>Run Initial Payroll</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* STEP 8: Autonomous First Payroll Run */}
          {/* ========================================================= */}
          {currentStep === 8 && (
            <div className="space-y-6 animate-in fade-in max-w-lg mx-auto">
              <div className="text-center space-y-1">
                <div className="flex items-center justify-center gap-2 text-emerald-700 font-bold text-xs uppercase tracking-wider">
                  <CaylaPenMascot size="xs" isProcessing={runProgress < 100} />
                  <span>Autonomous Engine</span>
                </div>
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                  {accountType === 'accountant' ? 'Initializing Client Workspaces' : 'Running your first payroll'}
                </h2>
                <p className="text-xs text-slate-500">
                  Cayla is executing calculations and building compliant records.
                </p>
              </div>

              {/* Progress Bar */}
              <div className="space-y-1">
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-emerald-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${runProgress}%` }}
                  />
                </div>
                <div className="flex justify-between text-[11px] text-slate-400 font-mono">
                  <span>Progress</span>
                  <span>{Math.round(runProgress)}%</span>
                </div>
              </div>

              {/* Terminal Logs (Grey-White Mix Styling) */}
              <div className="bg-slate-50 text-slate-800 font-mono text-xs p-4 rounded-2xl border border-slate-200 space-y-1.5 min-h-[140px] max-h-52 overflow-y-auto">
                {runLogs.map((log, i) => (
                  <div key={i} className="flex items-center gap-2 animate-in fade-in">
                    <span className="text-emerald-600 font-bold">✓</span>
                    <span className="text-slate-700">{log}</span>
                  </div>
                ))}
              </div>

              {runProgress >= 100 && (
                <div className="pt-2 text-center animate-in fade-in">
                  <button
                    onClick={() => setCurrentStep(9)}
                    className="px-8 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-600/25 transition-all flex items-center gap-2 mx-auto cursor-pointer"
                  >
                    <span>View Workspace &amp; Finalize</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ========================================================= */}
          {/* STEP 9: Product Walkthrough & Launch */}
          {/* ========================================================= */}
          {currentStep === 9 && (
            <div className="space-y-6 animate-in fade-in">
              <div className="text-center space-y-2">
                <div className="w-16 h-16 rounded-full bg-emerald-100 border border-emerald-300 flex items-center justify-center mx-auto shadow-md">
                  <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                </div>
                <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                  You&apos;re all set! 🚀
                </h2>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  {accountType === 'accountant'
                    ? 'Your Accountant Command Center is active. Manage clients, run batch payrolls, and invite clients to their portal.'
                    : 'Next time you need to run payroll, add a bonus, or check statutory taxes, just ask Cayla.'}
                </p>
              </div>

              {/* Contextual Teach-Through Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
                  <div className="flex items-center gap-2 font-bold text-xs text-slate-900">
                    <CaylaPenMascot size="xs" />
                    <span>{accountType === 'accountant' ? 'Multi-Client Cayla' : 'Editable at any time'}</span>
                  </div>
                  <p className="text-[11px] text-slate-600">
                    {accountType === 'accountant'
                      ? 'Ask Cayla questions across all clients, e.g. "Prepare all ready payrolls".'
                      : 'You can tap and edit any payroll value directly inside the workspace cards.'}
                  </p>
                </div>

                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
                  <div className="flex items-center gap-2 font-bold text-xs text-slate-900">
                    <Mic className="w-4 h-4 text-emerald-600" />
                    <span>Cross-Client Commands</span>
                  </div>
                  <p className="text-[11px] text-slate-600">
                    {accountType === 'accountant'
                      ? 'Say "Run payroll for Caribbean Tech" to immediately switch context.'
                      : 'Say "Give Marcus $500 bonus" and Cayla updates the numbers for you.'}
                  </p>
                </div>

                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
                  <div className="flex items-center gap-2 font-bold text-xs text-slate-900">
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                    <span>Batch Payroll &amp; Payslips</span>
                  </div>
                  <p className="text-[11px] text-slate-600">
                    {accountType === 'accountant'
                      ? 'Run 20+ client payrolls simultaneously with separate compliance checks.'
                      : 'All 24 printable and emailable PDF payslips recalculate in real time.'}
                  </p>
                </div>

                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
                  <div className="flex items-center gap-2 font-bold text-xs text-slate-900">
                    <Building2 className="w-4 h-4 text-emerald-600" />
                    <span>Client Portal Sign-offs</span>
                  </div>
                  <p className="text-[11px] text-slate-600">
                    {accountType === 'accountant'
                      ? 'Invite client executives to review and authorize drafts before you finalize.'
                      : 'Custom brand colors, company stamps, and layouts are 1-click away.'}
                  </p>
                </div>
              </div>

              <div className="pt-4 flex justify-center">
                <button
                  onClick={() => onComplete(businessData, employeesList, accountType, importedRuns)}
                  className="px-10 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm rounded-2xl shadow-xl shadow-emerald-600/30 transition-all flex items-center gap-2.5 cursor-pointer"
                >
                  <CaylaPenMascot size="xs" />
                  <span>
                    {accountType === 'accountant' ? 'Go to Accountant Command Center' : 'Go to Sheetpay Workspace'}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
