import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { Briefcase, Eye, EyeOff, Loader2, LockKeyhole, Mail, X } from 'lucide-react';
import type { MerchantSignInResult } from '../hooks/useAuth';
import shopForMeLogo from '../../Admin-Pics/shop for me logo free.png';

interface MerchantSignInModalProps {
  open: boolean;
  onClose: () => void;
  onSignIn: (emailOrPhone: string, password: string) => Promise<MerchantSignInResult>;
  onGoogleSignIn?: () => void | Promise<unknown>;
  onSuccess: () => void;
}

type MerchantSignInError = Exclude<MerchantSignInResult, { ok: true }>['reason'];

const ERROR_COPY: Record<MerchantSignInError, string> = {
  invalid_credentials: 'Invalid credentials. Check your email or phone and password.',
  not_authorized: 'This account is not an authorized merchant.',
  not_approved: 'This merchant account is still awaiting approval.',
};

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

export default function MerchantSignInModal({
  open,
  onClose,
  onSignIn,
  onGoogleSignIn,
  onSuccess,
}: MerchantSignInModalProps) {
  const titleId = useId();
  const emailId = useId();
  const passwordId = useId();
  const [emailOrPhone, setEmailOrPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.setTimeout(() => closeButtonRef.current?.focus(), 0);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !loading && !googleLoading) {
        onClose();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [googleLoading, loading, onClose, open]);

  if (!open) return null;

  const busy = loading || googleLoading;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!emailOrPhone.trim() || !password.trim()) {
      setError('Email or phone and password are required.');
      return;
    }

    setLoading(true);
    const result = await onSignIn(emailOrPhone, password);
    setLoading(false);

    if (!result.ok) {
      setError(ERROR_COPY[result.reason]);
      return;
    }

    setEmailOrPhone('');
    setPassword('');
    setShowPassword(false);
    onSuccess();
  };

  const handleGoogleSignIn = async () => {
    if (!onGoogleSignIn) return;
    setError(null);
    setGoogleLoading(true);
    try {
      const result = await onGoogleSignIn();
      if (result) {
        const message =
          typeof result === 'object' && result && 'message' in result
            ? String((result as { message?: string }).message || '')
            : '';
        setError(message || 'Google sign-in failed. Please try again.');
        setGoogleLoading(false);
      }
      // On success the browser redirects to Google; keep loading state.
    } catch {
      setError('Google sign-in failed. Please try again.');
      setGoogleLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center px-0 sm:items-center sm:px-4">
      <button
        type="button"
        aria-label="Close merchant sign in"
        className="absolute inset-0 cursor-default bg-brand-950/55 backdrop-blur-sm"
        onClick={() => {
          if (!busy) onClose();
        }}
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative w-full max-w-md overflow-hidden rounded-t-3xl bg-white shadow-2xl animate-slide-up sm:rounded-3xl"
      >
        <div className="border-b border-gray-100 bg-brand-50/70 px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <img
                src={shopForMeLogo}
                alt="Shop For Me Uganda"
                className="mb-3 h-14 w-40 object-contain object-left"
              />
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-bold text-brand-700 shadow-sm ring-1 ring-brand-100">
                <Briefcase className="h-3.5 w-3.5" />
                Merchant Portal
              </span>
              <h2 id={titleId} className="mt-3 text-xl font-extrabold text-brand-900">
                Sign in as Merchant
              </h2>
              <p className="mt-1 text-sm text-gray-600">
                Manage products, pricing and incoming delivery orders.
              </p>
            </div>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={onClose}
              disabled={busy}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-gray-500 transition hover:bg-white hover:text-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 disabled:opacity-50"
              aria-label="Close merchant sign in"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-5 py-5">
          {onGoogleSignIn && (
            <>
              <button
                type="button"
                onClick={() => void handleGoogleSignIn()}
                disabled={busy}
                className="flex w-full items-center justify-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-700 shadow-sm transition hover:border-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {googleLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin text-gray-500" />
                ) : (
                  <GoogleIcon className="h-5 w-5" />
                )}
                {googleLoading ? 'Redirecting to Google...' : 'Sign in with Google'}
              </button>

              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-gray-200" />
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                  or
                </span>
                <div className="h-px flex-1 bg-gray-200" />
              </div>
            </>
          )}

          <label htmlFor={emailId} className="block">
            <span className="mb-1.5 block text-sm font-semibold text-gray-700">
              Email or phone
            </span>
            <span className="relative block">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                id={emailId}
                value={emailOrPhone}
                onChange={(event) => setEmailOrPhone(event.target.value)}
                autoComplete="username"
                inputMode="email"
                className="w-full rounded-2xl border border-gray-200 bg-gray-50 py-3 pl-10 pr-3 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-100"
                placeholder="merchant@example.com"
              />
            </span>
          </label>

          <label htmlFor={passwordId} className="block">
            <span className="mb-1.5 block text-sm font-semibold text-gray-700">
              Password
            </span>
            <span className="relative block">
              <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                id={passwordId}
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                className="w-full rounded-2xl border border-gray-200 bg-gray-50 py-3 pl-10 pr-11 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-100"
                placeholder="Enter your password"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-gray-400 transition hover:bg-white hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-200"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </span>
          </label>

          <div className="flex items-center justify-between gap-3">
            <a
              href="mailto:support@shopforme.ug?subject=Merchant%20password%20reset"
              className="text-sm font-semibold text-brand-700 underline-offset-4 transition hover:text-brand-800 hover:underline focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2"
            >
              Forgot password?
            </a>
          </div>

          {error && (
            <p className="rounded-2xl border border-red-100 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-gold-500 px-4 py-3 text-sm font-extrabold text-white shadow-md transition hover:bg-gold-400 focus:outline-none focus:ring-2 focus:ring-gold-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-600"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Signing in...
              </>
            ) : (
              'Sign In'
            )}
          </button>

          <p className="rounded-2xl bg-gray-50 px-3 py-3 text-xs font-medium leading-relaxed text-gray-600">
            Merchant accounts are pre-authorized - contact support to register your shop.
          </p>
        </form>
      </section>
    </div>
  );
}
