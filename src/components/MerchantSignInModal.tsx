import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { Briefcase, Loader2, LockKeyhole, Mail, X } from 'lucide-react';
import type { MerchantSignInResult } from '../hooks/useAuth';

interface MerchantSignInModalProps {
  open: boolean;
  onClose: () => void;
  onSignIn: (emailOrPhone: string, password: string) => Promise<MerchantSignInResult>;
  onSuccess: () => void;
}

type MerchantSignInError = Exclude<MerchantSignInResult, { ok: true }>['reason'];

const ERROR_COPY: Record<MerchantSignInError, string> = {
  invalid_credentials: 'Invalid credentials. Check your email or phone and password.',
  not_authorized: 'This account is not an authorized merchant.',
  not_approved: 'This merchant account is still awaiting approval.',
};

export default function MerchantSignInModal({
  open,
  onClose,
  onSignIn,
  onSuccess,
}: MerchantSignInModalProps) {
  const titleId = useId();
  const emailId = useId();
  const passwordId = useId();
  const [emailOrPhone, setEmailOrPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.setTimeout(() => closeButtonRef.current?.focus(), 0);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !loading) {
        onClose();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [loading, onClose, open]);

  if (!open) return null;

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
    onSuccess();
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center px-0 sm:items-center sm:px-4">
      <button
        type="button"
        aria-label="Close merchant sign in"
        className="absolute inset-0 cursor-default bg-brand-950/55 backdrop-blur-sm"
        onClick={() => {
          if (!loading) onClose();
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
              disabled={loading}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-gray-500 transition hover:bg-white hover:text-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 disabled:opacity-50"
              aria-label="Close merchant sign in"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-5 py-5">
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
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                className="w-full rounded-2xl border border-gray-200 bg-gray-50 py-3 pl-10 pr-3 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-100"
                placeholder="Enter your password"
              />
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
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-gold-500 px-4 py-3 text-sm font-extrabold text-brand-950 shadow-md transition hover:bg-gold-400 focus:outline-none focus:ring-2 focus:ring-gold-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-600"
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
