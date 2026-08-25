import React, { useState } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  signInWithPopup,
} from 'firebase/auth';
import { auth } from '../../lib/firebase';
import { CaylaPenMascot } from '../CaylaPenMascot';
import {
  ArrowRight,
  Eye,
  EyeOff,
  Mail,
  Lock,
  User,
  AlertCircle,
  CheckCircle2,
  ArrowLeft,
} from 'lucide-react';

interface AuthScreenProps {
  onAuthComplete: (uid: string, email: string, displayName: string) => void;
  onBack?: () => void;
  defaultMode?: 'signup' | 'signin';
}

function getAuthError(code: string): string {
  switch (code) {
    case 'auth/email-already-in-use':
      return 'An account with this email already exists. Try signing in instead.';
    case 'auth/weak-password':
      return 'Password must be at least 6 characters long.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/user-not-found':
    case 'auth/invalid-credential':
      return 'Invalid email or password. Please try again.';
    case 'auth/wrong-password':
      return 'Incorrect password. Please try again.';
    case 'auth/too-many-requests':
      return 'Too many failed attempts. Please try again later.';
    case 'auth/network-request-failed':
      return 'Network error. Check your connection and try again.';
    default:
      return 'Something went wrong. Please try again.';
  }
}

export const AuthScreen: React.FC<AuthScreenProps> = ({
  onAuthComplete,
  onBack,
  defaultMode = 'signup',
}) => {
  const [mode, setMode] = useState<'signup' | 'signin' | 'reset'>(defaultMode);
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [resetSent, setResetSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      if (mode === 'reset') {
        await sendPasswordResetEmail(auth, email);
        setResetSent(true);
        setIsLoading(false);
        return;
      }

      if (mode === 'signup') {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        if (displayName.trim()) {
          await updateProfile(cred.user, { displayName: displayName.trim() });
        }
        onAuthComplete(
          cred.user.uid,
          cred.user.email!,
          displayName.trim() || cred.user.email!.split('@')[0]
        );
      } else {
        const cred = await signInWithEmailAndPassword(auth, email, password);
        onAuthComplete(
          cred.user.uid,
          cred.user.email!,
          cred.user.displayName || cred.user.email!.split('@')[0]
        );
      }
    } catch (err: any) {
      setError(getAuthError(err.code));
    } finally {
      setIsLoading(false);
    }
  };

  const switchMode = (newMode: 'signup' | 'signin') => {
    setMode(newMode);
    setError('');
    setResetSent(false);
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setIsLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const cred = await signInWithPopup(auth, provider);
      onAuthComplete(
        cred.user.uid,
        cred.user.email!,
        cred.user.displayName || cred.user.email!.split('@')[0]
      );
    } catch (err: any) {
      // Ignore user-closed popup — no need to surface as an error.
      if (err?.code === 'auth/popup-closed-by-user' || err?.code === 'auth/cancelled-popup-request') {
        setIsLoading(false);
        return;
      }
      setError(getAuthError(err.code));
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto font-sans select-none">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-auto animate-in zoom-in-95 duration-300">

        {/* Header — identical style to OnboardingFlow header */}
        <div className="bg-slate-50 text-slate-900 px-6 py-4 flex items-center justify-between border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 border border-emerald-200 flex items-center justify-center">
              <CaylaPenMascot size="xs" />
            </div>
            <div>
              <div className="font-extrabold text-sm text-slate-900">Sheetpay</div>
              <p className="text-[11px] text-slate-500">
                {mode === 'signup'
                  ? 'Create your account to secure your workspace'
                  : mode === 'reset'
                  ? 'Reset your password'
                  : 'Welcome back to your workspace'}
              </p>
            </div>
          </div>

          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back
            </button>
          )}
        </div>

        {/* Full progress bar (onboarding is complete) */}
        <div className="w-full bg-emerald-500 h-1" />

        {/* Body */}
        <div className="p-6 sm:p-8 space-y-6">

          {/* Mascot + Title */}
          <div className="text-center space-y-3">
            <div className="w-16 h-16 rounded-full bg-emerald-50 border-2 border-emerald-200 flex items-center justify-center mx-auto shadow-lg shadow-emerald-600/10">
              <CaylaPenMascot size="2xl" showStatusDot />
            </div>

            {mode === 'reset' ? (
              <>
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                  Reset password
                </h2>
                <p className="text-xs text-slate-500 max-w-xs mx-auto">
                  Enter your email and we'll send you a link to reset your password.
                </p>
              </>
            ) : mode === 'signup' ? (
              <>
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                  Save your workspace
                </h2>
                <p className="text-xs text-slate-500 max-w-xs mx-auto">
                  Create an account to securely store your payroll data and access it anywhere.
                </p>
              </>
            ) : (
              <>
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                  Welcome back
                </h2>
                <p className="text-xs text-slate-500 max-w-xs mx-auto">
                  Sign in to access your payroll workspace, employees, and reports.
                </p>
              </>
            )}
          </div>

          {/* Google sign-in (skip on password reset) */}
          {mode !== 'reset' && !resetSent && (
            <>
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2.5 py-3 bg-white border border-slate-300 hover:border-slate-400 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed text-slate-700 font-bold text-xs rounded-2xl transition-colors cursor-pointer"
                aria-label="Continue with Google"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Continue with Google
              </button>

              <div className="flex items-center gap-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                <div className="flex-1 h-px bg-slate-200" />
                or
                <div className="flex-1 h-px bg-slate-200" />
              </div>
            </>
          )}

          {/* Mode tabs (only signup / signin) */}
          {mode !== 'reset' && (
            <div className="flex gap-1 p-1 bg-slate-100 rounded-xl">
              <button
                type="button"
                onClick={() => switchMode('signup')}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  mode === 'signup'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Create Account
              </button>
              <button
                type="button"
                onClick={() => switchMode('signin')}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  mode === 'signin'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Sign In
              </button>
            </div>
          )}

          {/* Password reset success state */}
          {resetSent ? (
            <div className="text-center space-y-4 py-4">
              <div className="w-14 h-14 rounded-full bg-emerald-100 border border-emerald-200 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-7 h-7 text-emerald-600" />
              </div>
              <div>
                <p className="font-bold text-slate-900 text-sm">Check your inbox</p>
                <p className="text-xs text-slate-500 mt-1">
                  We sent a reset link to <span className="font-bold text-slate-700">{email}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => { setMode('signin'); setResetSent(false); }}
                className="text-xs font-bold text-emerald-700 hover:underline cursor-pointer"
              >
                Back to Sign In
              </button>
            </div>
          ) : (
            /* Form */
            <form onSubmit={handleSubmit} className="space-y-3">
              {mode === 'signup' && (
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Full Name</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="e.g. Sarah Mohammed"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      autoComplete="name"
                      className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold placeholder:text-slate-400 focus:bg-white focus:border-emerald-500 focus:outline-none transition-colors"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="email"
                    placeholder="you@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold placeholder:text-slate-400 focus:bg-white focus:border-emerald-500 focus:outline-none transition-colors"
                  />
                </div>
              </div>

              {mode !== 'reset' && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700">Password</label>
                    {mode === 'signin' && (
                      <button
                        type="button"
                        onClick={() => { setMode('reset'); setError(''); }}
                        className="text-[11px] text-emerald-700 font-bold hover:underline cursor-pointer"
                      >
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      placeholder={mode === 'signup' ? 'Minimum 6 characters' : 'Your password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                      className="w-full pl-9 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold placeholder:text-slate-400 focus:bg-white focus:border-emerald-500 focus:outline-none transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}

              {error && (
                <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl animate-in fade-in">
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-red-700 font-semibold leading-snug">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading || !email || (mode !== 'reset' && !password)}
                className="w-full mt-1 py-3.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-sm rounded-2xl shadow-lg shadow-emerald-600/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {isLoading ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : mode === 'signup' ? (
                  <>
                    <span>Create Account &amp; Launch Workspace</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                ) : mode === 'reset' ? (
                  <>
                    <span>Send Reset Link</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                ) : (
                  <>
                    <span>Sign In to Workspace</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* Legal / hint footer */}
          {mode === 'signup' && !resetSent && (
            <p className="text-center text-[11px] text-slate-400 leading-relaxed">
              By creating an account, you agree to our{' '}
              <a href="/terms-of-service" className="text-emerald-700 font-bold hover:underline">
                Terms of Service
              </a>{' '}
              and{' '}
              <a href="/privacy-policy" className="text-emerald-700 font-bold hover:underline">
                Privacy Policy
              </a>
              .
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
