import React, { useState, useEffect, useRef } from 'react';
import { useAction } from 'convex/react';
import { api } from '../../convex/_generated/api';
import {
  Mic,
  MicOff,
  Paperclip,
  ArrowUp,
  RotateCcw,
  CheckCircle2,
  FileSpreadsheet,
  FileText,
  UploadCloud,
  ChevronRight,
  ShieldCheck,
  Check,
} from 'lucide-react';
import { CaylaMessage } from '../types';
import { CaylaPenMascot } from './CaylaPenMascot';

interface CaylaTranscriptProps {
  messages: CaylaMessage[];
  onSendMessage: (text: string) => void;
  isProcessing: boolean;
  onUndo: (undoAction: NonNullable<CaylaMessage['undoAction']>) => void;
  onConfirmAction: (payload: any) => void;
  onCancelAction: () => void;
  onOpenUpload: (type: 'timesheet' | 'payslip' | 'csv_roster') => void;
  isPayrollActive: boolean;
  pendingConfirmation?: CaylaMessage['confirmationRequired'];
  onCaylaConfirm?: () => void;
  onCaylaCancel?: () => void;
}

export const CaylaTranscript: React.FC<CaylaTranscriptProps> = ({
  messages,
  onSendMessage,
  isProcessing,
  onUndo,
  onConfirmAction,
  onCancelAction,
  onOpenUpload,
  isPayrollActive,
  pendingConfirmation,
  onCaylaConfirm,
  onCaylaCancel,
}) => {
  const [inputValue, setInputValue] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [speechTranscript, setSpeechTranscript] = useState('');
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const transcribeAudio = useAction(api.ai.transcribeAudio);

  const suggestionChips = [
    "Run this month's payroll",
    'Create payslips',
    'Add overtime',
    'Check my payroll taxes',
    'Upload a timesheet',
  ];

  // Auto-scroll transcript on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isProcessing, isListening, speechTranscript]);

  // Voice input: record via MediaRecorder, transcribe through OpenAI (Convex action)
  const blobToBase64 = (blob: Blob): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1] || '');
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

  const stopAudioStream = () => {
    audioStreamRef.current?.getTracks().forEach((t) => t.stop());
    audioStreamRef.current = null;
  };

  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current?.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      stopAudioStream();
    };
  }, []);

  const toggleListening = async () => {
    // Already recording → stop and transcribe
    if (isListening && mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
      return;
    }

    setSpeechTranscript('');

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setSpeechTranscript('Microphone not available.');
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
        setIsListening(false);

        if (blob.size === 0) return;

        setSpeechTranscript('Transcribing…');
        try {
          const audioBase64 = await blobToBase64(blob);
          const result = await transcribeAudio({
            audioBase64,
            mimeType: recorder.mimeType || 'audio/webm',
            language: 'en',
          });
          if (result.text?.trim()) {
            const text = result.text.trim();
            setSpeechTranscript(text);
            onSendMessage(text);
            setSpeechTranscript('');
          } else {
            setSpeechTranscript(result.error ? `Error: ${result.error}` : '');
          }
        } catch (err: any) {
          setSpeechTranscript(err?.message || 'Transcription failed');
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsListening(true);
    } catch (err: any) {
      console.warn('Microphone error:', err);
      setSpeechTranscript(err?.message || 'Microphone permission denied.');
      stopAudioStream();
      setIsListening(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isProcessing) return;
    onSendMessage(inputValue.trim());
    setInputValue('');
  };

  return (
    <section
      id="cayla-hero-section"
      className="w-full max-w-4xl mx-auto px-4 py-6 md:py-10 flex flex-col items-center select-none"
    >
      {/* Main Headline & Supporting Text */}
      <div className="text-center max-w-3xl w-full mb-6 md:mb-8 flex flex-col items-center">
        {/* Sheetpay & Cayla Persona Badge with Animated Pen Mascot */}
        <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-emerald-50/80 border border-emerald-200/80 mb-4 shadow-2xs">
          <CaylaPenMascot size="sm" showStatusDot={true} isProcessing={isProcessing} />
          <span className="text-xs font-bold text-slate-800">
            Sheetpay <span className="text-slate-400 font-normal">•</span> <span className="text-emerald-700 font-semibold">Cayla Payroll Agent</span>
          </span>
        </div>

        <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-slate-900 mb-3 md:mb-4">
          Run your payroll with Cayla on Sheetpay
        </h1>
        <p className="text-base md:text-lg text-slate-600 max-w-2xl mx-auto font-normal leading-relaxed">
          Tell Cayla what you need. She runs payroll, calculates statutory taxes, updates employees, and creates
          verified payslips instantly.
        </p>
      </div>

      {/* Large Cayla Live Transcript Box (Clean Grey-White Mix Canvas) */}
      <div
        id="cayla-transcript-card"
        className="max-w-3xl w-full bg-slate-50/80 rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-200/90 flex flex-col overflow-hidden transition-all duration-300 backdrop-blur-xs"
        style={{ minHeight: isPayrollActive ? '360px' : '420px' }}
      >
        {/* Message Thread History */}
        <div className="flex-1 p-6 md:p-8 overflow-y-auto space-y-5 max-h-[380px] bg-gradient-to-b from-slate-100/50 via-slate-50/40 to-slate-100/60">
          {messages.length === 0 && (
            <div className="py-6 flex flex-col items-center justify-center text-center">
              <div className="relative mb-3.5">
                <CaylaPenMascot size="2xl" showStatusDot={true} isProcessing={isProcessing} />
              </div>
              <p className="text-base font-bold text-slate-900">Hi there 👋! I&apos;m Cayla, your Sheetpay payroll agent</p>
              <p className="text-xs text-slate-600 max-w-sm mt-1 leading-relaxed">
                I calculate Trinidad &amp; Tobago BIR PAYE, NIS, and Health Surcharge automatically. Ask me to &ldquo;Run payroll for August&rdquo; or choose an action below.
              </p>
            </div>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${
                msg.sender === 'user' ? 'items-end' : 'items-start'
              } animate-in fade-in slide-in-from-bottom-2 duration-200`}
            >
              {/* Message with Avatar Row */}
              <div className={`flex items-start gap-3 md:gap-4 max-w-[90%] md:max-w-[85%] ${msg.sender === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                {msg.sender === 'cayla' ? (
                  <div className="relative shrink-0 mt-0.5">
                    <CaylaPenMascot size="md" showStatusDot={false} isProcessing={msg.isWorking} />
                  </div>
                ) : null}

                <div className="flex flex-col">
                  {/* Message Bubble with Grey-White Mix styling (No dark backgrounds) */}
                  <div
                    className={`p-4 rounded-2xl text-sm md:text-base leading-relaxed ${
                      msg.sender === 'user'
                        ? 'bg-slate-100 text-slate-900 rounded-tr-none border border-slate-200/90 shadow-2xs font-semibold'
                        : 'bg-white rounded-2xl rounded-tl-none border border-slate-200/80 shadow-2xs text-slate-700 font-medium'
                    }`}
                  >
                {msg.text}

                {/* Real-time Step Progress States */}
                {msg.progressSteps && msg.progressSteps.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-200 space-y-1.5 font-mono text-xs">
                    {msg.progressSteps.map((step, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-2 text-slate-600 animate-in fade-in"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>{step}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Structured Action Summary Card */}
                {msg.actionSummary && (
                  <div className="mt-3 p-3 bg-white rounded-xl border border-slate-200/90 text-xs">
                    <div className="font-semibold text-slate-900 mb-0.5">
                      {msg.actionSummary.title}
                    </div>
                    <div className="text-slate-600">{msg.actionSummary.description}</div>
                    {msg.actionSummary.details && (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2 pt-2 border-t border-slate-100 font-mono">
                        {msg.actionSummary.details.map((d, i) => (
                          <div key={i} className="bg-slate-50 p-1.5 rounded">
                            <div className="text-[10px] text-slate-500">{d.label}</div>
                            <div className="text-xs font-semibold text-slate-800">{d.value}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Undo Action Chip */}
                {msg.undoAction && (
                  <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between gap-3 text-xs">
                    <div className="text-slate-600">
                      <span className="font-bold text-slate-800">{msg.undoAction.employeeName}</span>:{' '}
                      <span className="text-slate-400 font-mono">{msg.undoAction.previousValue}</span>{' '}
                      →{' '}
                      <span className="font-bold text-emerald-600 font-mono">
                        {msg.undoAction.newValue}
                      </span>
                    </div>
                    <button
                      onClick={() => onUndo(msg.undoAction!)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-[11px] font-bold transition-colors cursor-pointer shadow-2xs"
                    >
                      <RotateCcw className="w-3 h-3 text-slate-500" />
                      Undo
                    </button>
                  </div>
                )}

                {/* Explicit Confirmation Action */}
                {msg.confirmationRequired && (
                  <div className="mt-3 p-3.5 bg-emerald-50/90 border border-emerald-200 rounded-xl text-xs">
                    <div className="font-bold text-emerald-950 mb-1 text-sm">
                      {msg.confirmationRequired.title}
                    </div>
                    <div className="text-emerald-800 mb-3 font-normal">
                      {msg.confirmationRequired.description}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onConfirmAction(msg.confirmationRequired?.payload)}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold transition-colors shadow-sm"
                      >
                        {msg.confirmationRequired.confirmAction}
                      </button>
                      <button
                        onClick={onCancelAction}
                        className="px-4 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl font-semibold transition-colors"
                      >
                        {msg.confirmationRequired.cancelAction}
                      </button>
                    </div>
                  </div>
                )}
              </div>
              <span className="text-[10px] text-slate-400 font-medium mt-1 px-1">{msg.timestamp}</span>
            </div>
          </div>
        </div>
      ))}

          {/* Live Voice Streaming or Processing Indicator */}
          {isListening && (
            <div className="flex items-center gap-3 px-6 md:px-10 py-3 bg-emerald-50 border border-emerald-100 rounded-2xl animate-in fade-in">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-bold uppercase tracking-widest text-emerald-700">Listening</span>
              <div className="flex gap-1 items-end h-4">
                <div className="w-1 h-2 bg-emerald-300 rounded-full animate-bounce" />
                <div className="w-1 h-4 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }} />
                <div className="w-1 h-2 bg-emerald-200 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }} />
                <div className="w-1 h-3 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '0.45s' }} />
                <div className="w-1 h-4 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '0.6s' }} />
              </div>
              <span className="text-xs font-medium text-slate-700 ml-1">
                {speechTranscript ? speechTranscript : 'Listening to your command...'}
              </span>
            </div>
          )}

          {isProcessing && !isListening && (
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 py-1">
              <CaylaPenMascot size="xs" isProcessing={true} />
              <span>Cayla is thinking...</span>
            </div>
          )}

          {/* Cayla AI sensitive action confirmation banner */}
          {pendingConfirmation && onCaylaConfirm && onCaylaCancel && (
            <div className="mx-2 mt-2 p-4 bg-amber-50 border border-amber-200 rounded-2xl shadow-sm">
              <div className="font-bold text-amber-900 text-sm mb-1">{pendingConfirmation.title}</div>
              <div className="text-amber-800 text-xs mb-3 leading-relaxed">{pendingConfirmation.description}</div>
              <div className="flex items-center gap-2">
                <button
                  onClick={onCaylaConfirm}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-colors"
                >
                  Confirm
                </button>
                <button
                  onClick={onCaylaCancel}
                  className="px-4 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold rounded-xl transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 md:p-6 bg-white border-t border-slate-100">
          <form onSubmit={handleSubmit} className="relative flex items-center gap-3 md:gap-4">
            {/* Attachment Dropdown Button */}
            <div className="relative">
              <button
                type="button"
                id="cayla-attachment-btn"
                onClick={() => setShowAttachmentMenu(!showAttachmentMenu)}
                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer"
                title="Attach files (Timesheets, Payslips, CSV)"
              >
                <Paperclip className="w-5 h-5" />
              </button>

              {showAttachmentMenu && (
                <div className="absolute bottom-14 left-0 w-64 bg-white rounded-2xl shadow-2xl border border-slate-200 py-2.5 z-50 animate-in fade-in slide-in-from-bottom-2">
                  <div className="px-4 py-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Upload & Ingestion
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAttachmentMenu(false);
                      onOpenUpload('timesheet');
                    }}
                    className="w-full text-left px-4 py-2.5 text-xs font-semibold flex items-center gap-3 hover:bg-slate-50 text-slate-700 transition-colors"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                    <span>Upload Timesheet (CSV/Excel)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAttachmentMenu(false);
                      onOpenUpload('payslip');
                    }}
                    className="w-full text-left px-4 py-2.5 text-xs font-semibold flex items-center gap-3 hover:bg-slate-50 text-slate-700 transition-colors"
                  >
                    <FileText className="w-4 h-4 text-emerald-600" />
                    <span>Upload Payslip PDF/Scan</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAttachmentMenu(false);
                      onOpenUpload('csv_roster');
                    }}
                    className="w-full text-left px-4 py-2.5 text-xs font-semibold flex items-center gap-3 hover:bg-slate-50 text-slate-700 transition-colors"
                  >
                    <UploadCloud className="w-4 h-4 text-emerald-600" />
                    <span>Import Employee Roster CSV</span>
                  </button>
                </div>
              )}
            </div>

            {/* Natural Language Input Field */}
            <div className="relative flex-1">
              <input
                ref={inputRef}
                id="cayla-main-input"
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Ask Cayla to run your payroll..."
                disabled={isProcessing}
                className="w-full border-none focus:outline-none text-base md:text-lg font-medium text-slate-900 placeholder:text-slate-300 bg-transparent"
              />
            </div>

            {/* Voice Microphone Button */}
            <button
              type="button"
              id="cayla-voice-mic-btn"
              onClick={toggleListening}
              className={`p-2.5 rounded-full transition-all cursor-pointer ${
                isListening
                  ? 'bg-rose-500 text-white animate-pulse shadow-md shadow-rose-500/20'
                  : 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100'
              }`}
              title={isListening ? 'Stop listening' : 'Start voice transcription'}
            >
              {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>

            {/* Submit Send Button */}
            <button
              type="submit"
              id="cayla-send-btn"
              disabled={!inputValue.trim() || isProcessing}
              className="bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 text-white p-2.5 md:p-3 rounded-2xl shadow-lg shadow-emerald-200 transition-all cursor-pointer flex items-center justify-center"
              title="Send command"
            >
              <ArrowUp className="w-5 h-5 stroke-[2.5]" />
            </button>
          </form>

        </div>
      </div>

      {/* Empty-State Suggestion Chips */}
      <div className="flex flex-wrap gap-2.5 md:gap-3 mt-6 md:mt-8 justify-center">
        {suggestionChips.map((chip, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onSendMessage(chip)}
            className="px-4 py-2 bg-white border border-slate-200 rounded-full text-xs md:text-sm font-semibold text-slate-600 cursor-pointer hover:border-emerald-300 hover:text-emerald-600 transition-colors shadow-2xs"
          >
            {chip}
          </button>
        ))}
      </div>
    </section>
  );
};
