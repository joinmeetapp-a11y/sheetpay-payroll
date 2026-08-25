import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAction, useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import {
  MessageCircle,
  X,
  Send,
  Phone,
  HeadphonesIcon,
  Loader2,
  Sparkles,
} from 'lucide-react';

interface NiaWidgetProps {
  /** 'landing' anchors bottom-6; 'app' anchors bottom-24 to sit above the mobile bottom nav. */
  variant: 'landing' | 'app';
  /** Firebase UID when the user is signed in. Anonymous chats pass anonSessionId only. */
  currentUid?: string;
  /** Optional page hint injected into the Nia system prompt for better answers. */
  currentPage?: string;
  /** Optional pre-filled contact for anonymous handoff. */
  defaultContactName?: string;
  defaultContactEmail?: string;
}

const SUPPORT_PHONE_DISPLAY = '1-868-292-3787';
const SUPPORT_PHONE_TEL = '+18682923787';

// Anonymous session id so a visitor's conversation survives page reloads.
function getAnonSessionId(): string {
  const KEY = 'nia:anon-session-id';
  try {
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = `anon_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return `anon_${Date.now().toString(36)}`;
  }
}

export const NiaWidget: React.FC<NiaWidgetProps> = ({
  variant,
  currentUid,
  currentPage,
  defaultContactName,
  defaultContactEmail,
}) => {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [pendingReply, setPendingReply] = useState(false);
  const [conversationId, setConversationId] = useState<any>(null);
  const [handoffPromptOpen, setHandoffPromptOpen] = useState(false);
  const [contactName, setContactName] = useState(defaultContactName ?? '');
  const [contactEmail, setContactEmail] = useState(defaultContactEmail ?? '');
  const [error, setError] = useState<string | null>(null);
  const [handoffSent, setHandoffSent] = useState(false);

  const anonSessionId = useMemo(() => (currentUid ? undefined : getAnonSessionId()), [currentUid]);
  const chat = useAction((api as any).nia.chat);
  const handoff = useAction((api as any).nia.requestHumanHandoff);

  // Subscribes to live message list — support agent replies (future) will
  // appear automatically. `skip` when we haven't created a conversation yet.
  const remote = useQuery(
    (api as any).niaInternal.getConversationMessages,
    conversationId ? { conversationId } : 'skip'
  ) as
    | undefined
    | null
    | {
        mode: string;
        messages: Array<{ id: string; senderType: string; content: string; createdAt: number }>;
      };

  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [remote?.messages?.length, pendingReply, handoffSent]);

  const send = async (text?: string) => {
    const content = (text ?? draft).trim();
    if (!content || pendingReply) return;
    setDraft('');
    setPendingReply(true);
    setError(null);
    try {
      const result: any = await chat({
        requesterUid: currentUid,
        anonSessionId,
        conversationId: conversationId ?? undefined,
        message: content,
        currentPage,
      });
      if (result?.conversationId) setConversationId(result.conversationId);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setPendingReply(false);
    }
  };

  const requestHuman = async () => {
    // Anonymous visitors must give us a reachable contact.
    if (!currentUid && (!contactEmail || !contactName)) {
      setHandoffPromptOpen(true);
      return;
    }
    if (!conversationId) {
      // Kick off the conversation first with a minimal handoff message.
      await send("I'd like to talk to a Sheetpay Support person.");
    }
    setPendingReply(true);
    setError(null);
    try {
      const result: any = await handoff({
        conversationId,
        requesterUid: currentUid,
        contactName: contactName || undefined,
        contactEmail: contactEmail || undefined,
        currentPage,
        summary: `Support handoff from ${variant === 'landing' ? 'landing page' : 'app'}`,
      });
      if (result?.ok) {
        setHandoffSent(true);
        setHandoffPromptOpen(false);
      } else {
        setError(result?.error === 'missing_contact_email' ? 'Please share your email so we can reach you.' : 'Support request failed. Try again.');
      }
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setPendingReply(false);
    }
  };

  const messages = remote?.messages ?? [];
  const mode = remote?.mode ?? 'nia';
  const modeBadge =
    mode === 'human'
      ? { label: 'Support', color: 'bg-blue-100 text-blue-800 border-blue-200' }
      : mode === 'waiting_for_human'
        ? { label: 'Waiting for support', color: 'bg-amber-100 text-amber-800 border-amber-200' }
        : { label: 'Online', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' };

  const anchor =
    variant === 'landing'
      ? 'bottom-4 right-4 sm:bottom-6 sm:right-6'
      : 'bottom-24 right-4 sm:bottom-6 sm:right-6';

  return (
    <>
      {/* Floating trigger */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Open Nia support"
          className={`fixed ${anchor} z-40 group flex items-center gap-2.5 pl-3 pr-4 py-3 bg-white hover:bg-slate-50 text-slate-900 rounded-full shadow-2xl border border-slate-200 transition-all cursor-pointer`}
        >
          <span className="relative w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-700 text-white flex items-center justify-center shadow-inner">
            <HeadphonesIcon className="w-4 h-4" />
            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-white animate-pulse" />
          </span>
          <span className="text-left leading-tight">
            <span className="block text-[13px] font-black text-slate-900">Nia</span>
            <span className="block text-[10px] text-slate-500 font-semibold">Need help?</span>
          </span>
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div
          className={`fixed ${anchor} z-40 w-[calc(100vw-2rem)] sm:w-[380px] max-h-[calc(100vh-6rem)] sm:max-h-[600px] bg-white rounded-3xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200`}
          role="dialog"
          aria-labelledby="nia-title"
        >
          {/* Header */}
          <div className="bg-slate-900 text-white px-4 py-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center shadow-inner">
              <HeadphonesIcon className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div id="nia-title" className="text-sm font-black flex items-center gap-2">
                Nia
                <span className={`text-[9px] uppercase tracking-wider font-black px-1.5 py-0.5 rounded-full border ${modeBadge.color}`}>
                  {modeBadge.label}
                </span>
              </div>
              <div className="text-[11px] text-slate-400">Sheetpay Support</div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/10 cursor-pointer"
              aria-label="Close Nia"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Messages */}
          <div ref={listRef} className="flex-1 overflow-y-auto p-4 bg-slate-50 space-y-3">
            {messages.length === 0 && !pendingReply && (
              <div className="text-center py-6 space-y-2">
                <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 mx-auto flex items-center justify-center">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div className="text-sm font-bold text-slate-800">Hi, I'm Nia.</div>
                <div className="text-xs text-slate-500 max-w-[260px] mx-auto">
                  Ask me anything about Sheetpay — payroll, Cayla, plans, or getting started.
                </div>
                <div className="pt-2 flex flex-wrap justify-center gap-1.5">
                  {['How do I add employees?', 'What is Cayla?', 'Pricing', 'Talk to a human'].map((s) => (
                    <button
                      key={s}
                      onClick={() => (s === 'Talk to a human' ? requestHuman() : send(s))}
                      className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-white border border-slate-200 hover:border-emerald-400 hover:text-emerald-700 text-slate-600 cursor-pointer"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex ${m.senderType === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                    m.senderType === 'user'
                      ? 'bg-emerald-600 text-white rounded-tr-sm'
                      : m.senderType === 'support'
                        ? 'bg-blue-50 text-slate-800 border border-blue-200 rounded-tl-sm'
                        : 'bg-white text-slate-800 border border-slate-200 rounded-tl-sm'
                  }`}
                >
                  {m.senderType === 'support' && (
                    <div className="text-[10px] font-black uppercase tracking-wider text-blue-700 mb-1">
                      Sheetpay Support
                    </div>
                  )}
                  {m.content}
                </div>
              </div>
            ))}

            {pendingReply && (
              <div className="flex justify-start">
                <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-sm px-3.5 py-2.5 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce" />
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            )}

            {handoffSent && (
              <div className="text-center py-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-800 font-semibold">
                Sent to Sheetpay Support. Someone will pick up from here — check your email if we need more info.
              </div>
            )}

            {error && (
              <div className="text-center text-[11px] text-rose-700 font-semibold bg-rose-50 border border-rose-200 rounded-lg px-2 py-1.5">
                {error}
              </div>
            )}
          </div>

          {/* Handoff email prompt for anonymous visitors */}
          {handoffPromptOpen && (
            <div className="border-t border-slate-200 p-3 bg-white space-y-2">
              <div className="text-[11px] font-bold text-slate-700">
                Share your details so support can follow up:
              </div>
              <input
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder="Your name"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
              />
              <input
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder="you@company.com"
                type="email"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => setHandoffPromptOpen(false)}
                  className="flex-1 text-xs font-bold text-slate-600 py-2 hover:text-slate-900 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={requestHuman}
                  disabled={!contactEmail || !contactName || pendingReply}
                  className="flex-1 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-lg py-2 cursor-pointer"
                >
                  Send to Support
                </button>
              </div>
            </div>
          )}

          {/* Footer: quick actions + input */}
          {!handoffPromptOpen && !handoffSent && (
            <>
              <div className="border-t border-slate-100 px-3 pt-2 pb-1 bg-white flex flex-wrap gap-1.5">
                <button
                  onClick={requestHuman}
                  disabled={pendingReply || mode !== 'nia'}
                  className="text-[10px] font-bold px-2 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-40 cursor-pointer"
                >
                  Talk to a human
                </button>
                <a
                  href={`tel:${SUPPORT_PHONE_TEL}`}
                  className="text-[10px] font-bold px-2 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 inline-flex items-center gap-1"
                >
                  <Phone className="w-3 h-3" /> {SUPPORT_PHONE_DISPLAY}
                </a>
              </div>

              <div className="border-t border-slate-100 p-2 bg-white flex items-end gap-2">
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                  placeholder={mode === 'nia' ? "Ask Nia anything…" : 'Support has been notified…'}
                  rows={1}
                  disabled={mode !== 'nia' || pendingReply}
                  className="flex-1 resize-none max-h-32 px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-500 focus:outline-none disabled:opacity-50"
                />
                <button
                  onClick={() => send()}
                  disabled={!draft.trim() || pendingReply || mode !== 'nia'}
                  className="w-9 h-9 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center disabled:opacity-40 cursor-pointer"
                  aria-label="Send"
                >
                  {pendingReply ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
};
