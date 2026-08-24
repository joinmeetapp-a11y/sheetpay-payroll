import React, { useMemo, useState } from 'react';
import { useAction, useMutation, useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';

interface InviteAcceptPageProps {
  currentUser: { uid: string; email: string; displayName?: string | null } | null;
  onSignedInRedirect: (path: string) => void;
}

/**
 * Route: /invite/[token]
 * Validates the token, surfaces every legitimate rejection state (expired,
 * revoked, invalid, already accepted), and completes acceptance for a
 * signed-in user whose email matches the invitee address.
 */
export const InviteAcceptPage: React.FC<InviteAcceptPageProps> = ({
  currentUser,
  onSignedInRedirect,
}) => {
  const token = useMemo(() => {
    const parts = window.location.pathname.split('/').filter(Boolean);
    return parts[parts.length - 1] || '';
  }, []);

  const verification = useQuery(api.invitations.verifyToken, { token });
  const acceptInvite = useMutation(api.invitations.accept);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);

  const handleAccept = async () => {
    if (!currentUser) {
      // Stash intent so the login flow can bring the user back here.
      window.sessionStorage.setItem('pendingInviteToken', token);
      onSignedInRedirect('/?intent=login');
      return;
    }
    setAccepting(true);
    setError(null);
    try {
      await acceptInvite({
        token,
        acceptingUserId: currentUser.uid,
        acceptingUserEmail: currentUser.email,
      });
      setAccepted(true);
    } catch (err: any) {
      setError(err?.message || 'Could not accept invitation');
    } finally {
      setAccepting(false);
    }
  };

  const renderCard = (title: string, body: React.ReactNode, cta?: React.ReactNode) => (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="w-full max-w-lg bg-white rounded-3xl border border-slate-200 shadow-xl p-8 space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-emerald-600 flex items-center justify-center text-white font-black text-lg">
          S
        </div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">{title}</h1>
        <div className="text-sm text-slate-600 leading-relaxed">{body}</div>
        {cta}
      </div>
    </div>
  );

  if (verification === undefined) {
    return renderCard('Checking invitation…', 'One moment while we verify your invite.');
  }

  if (!verification) {
    return renderCard('Invitation not found', 'We could not find this invitation link.');
  }

  if (verification.state === 'invalid') {
    return renderCard(
      'Invitation link is invalid',
      "This invitation link doesn't match anything in our records. Ask the person who invited you to send a fresh one.",
    );
  }

  if (verification.state === 'revoked') {
    return renderCard(
      'Invitation revoked',
      'The workspace owner cancelled this invitation. Contact them if you think this was a mistake.',
    );
  }

  if (verification.state === 'expired') {
    return renderCard(
      'Invitation expired',
      'This invite has expired. Ask your workspace admin to send a new one.',
    );
  }

  if (verification.state === 'already_accepted') {
    return renderCard(
      "You're already in this workspace",
      'This invitation was already accepted. You can head straight to Sheetpay.',
      <button
        onClick={() => onSignedInRedirect('/app')}
        className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl transition-colors cursor-pointer"
      >
        Open Sheetpay
      </button>,
    );
  }

  if (accepted) {
    return renderCard(
      "You're in! 🎉",
      'Welcome to the team. Redirecting you to Sheetpay now.',
      <button
        onClick={() => onSignedInRedirect('/app')}
        className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl transition-colors cursor-pointer"
      >
        Open Sheetpay
      </button>,
    );
  }

  const invite = verification.invite;
  return renderCard(
    `You're invited to join ${invite.inviterName || 'a workspace'} on Sheetpay`,
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 border border-slate-200 rounded-xl p-4">
        <div>
          <div className="text-slate-500 font-semibold uppercase text-[10px]">Invited by</div>
          <div className="text-slate-900 font-bold mt-0.5">{invite.inviterName}</div>
        </div>
        <div>
          <div className="text-slate-500 font-semibold uppercase text-[10px]">Role</div>
          <div className="text-slate-900 font-bold mt-0.5">{invite.role}</div>
        </div>
        <div className="col-span-2">
          <div className="text-slate-500 font-semibold uppercase text-[10px]">Invitee email</div>
          <div className="text-slate-900 font-bold mt-0.5 font-mono">{invite.inviteeEmail}</div>
        </div>
      </div>
      {currentUser && currentUser.email.toLowerCase() !== invite.inviteeEmail && (
        <div className="text-xs bg-amber-50 border border-amber-200 rounded-xl p-3 text-amber-900 font-semibold">
          You're signed in as <span className="font-mono">{currentUser.email}</span>. Sign in with{' '}
          <span className="font-mono">{invite.inviteeEmail}</span> to accept.
        </div>
      )}
      {error && (
        <div className="text-xs bg-rose-50 border border-rose-200 rounded-xl p-3 text-rose-900 font-semibold">
          {error}
        </div>
      )}
    </div>,
    <button
      onClick={handleAccept}
      disabled={accepting}
      className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold text-sm rounded-xl transition-colors cursor-pointer"
    >
      {accepting ? 'Accepting…' : currentUser ? 'Accept invitation' : 'Sign in to accept'}
    </button>,
  );
};
