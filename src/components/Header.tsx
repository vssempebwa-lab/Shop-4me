import { useEffect, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import {
  Search,
  ShoppingCart,
  User as UserIcon,
  HelpCircle,
  ChevronDown,
  MapPin,
  Phone,
  Truck,
  ShieldCheck,
  X,
  Menu,
} from 'lucide-react';
import { useCart } from '../context/CartContext';

interface HeaderProps {
  search: string;
  onSearchChange: (v: string) => void;
  onOpenCart: () => void;
  onNavigateHelp: () => void;
  user: User | null;
  role: 'admin' | 'attendant' | 'merchant' | 'customer' | null;
  merchantRole: boolean;
  onToggleMerchant: () => void;
  onCustomerLogin: () => void;
  onCustomerSignIn: (email: string, password: string) => Promise<unknown>;
  onCustomerSignUp: (email: string, password: string) => Promise<unknown>;
  onCustomerLogout: () => void;
}

export default function Header({
  search,
  onSearchChange,
  onOpenCart,
  onNavigateHelp,
  user,
  role,
  merchantRole,
  onToggleMerchant,
  onCustomerLogin,
  onCustomerSignIn,
  onCustomerSignUp,
  onCustomerLogout,
}: HeaderProps) {
  const { count } = useCart();
  const [accountOpen, setAccountOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [showSignUp, setShowSignUp] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);
  const helpRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (accountRef.current && !accountRef.current.contains(e.target as Node))
        setAccountOpen(false);
      if (helpRef.current && !helpRef.current.contains(e.target as Node))
        setHelpOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  return (
    <header className="sticky top-0 z-40">
      {/* Top announcement banner */}
      <div className="bg-brand-800 text-brand-50 text-xs sm:text-sm">
        <div className="mx-auto max-w-7xl px-4 py-2 flex items-center gap-2">
          <Truck className="h-4 w-4 shrink-0 text-gold-300" />
          <p className="truncate">
            Welcome to Shop for me Uganda — We offer a reliable, affordable, and
            convenient way to get everything you need delivered straight to your doorsteps.
          </p>
        </div>
      </div>

      {/* Main header */}
      <div
        className={`bg-white shadow-sm transition-all duration-300 ${
          scrolled ? 'shadow-md' : ''
        }`}
      >
        <div className="mx-auto max-w-7xl px-4">
          <div className="flex items-center gap-3 py-3">
            {/* Logo */}
            <a href="#" className="flex items-center gap-2 shrink-0">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-md">
                <ShoppingCart className="h-5 w-5" />
              </div>
              <div className="hidden sm:block leading-tight">
                <p className="font-extrabold text-brand-800 text-lg tracking-tight">
                  Shop For Me
                </p>
                <p className="text-[11px] font-semibold text-gold-600 -mt-0.5">
                  List, Order &amp; Delivered
                </p>
              </div>
            </a>

            {/* Search */}
            <div className="relative flex-1 max-w-xl">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Search products, brands and categories"
                className="w-full rounded-full border border-gray-200 bg-gray-50 py-2.5 pl-10 pr-4 text-sm outline-none transition focus:border-brand-400 focus:bg-white focus:ring-2 focus:ring-brand-100"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 sm:gap-2">
              {/* Help */}
              <div className="relative" ref={helpRef}>
                <button
                  onClick={() => setHelpOpen((v) => !v)}
                  className="flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-100 hover:text-brand-700"
                >
                  <HelpCircle className="h-5 w-5" />
                  <span className="hidden md:inline">Help</span>
                  <ChevronDown className={`hidden h-3.5 w-3.5 md:inline transition ${helpOpen ? 'rotate-180' : ''}`} />
                </button>
                {helpOpen && (
                  <div className="absolute right-0 mt-2 w-64 rounded-2xl border border-gray-100 bg-white p-2 shadow-xl animate-scale-in">
                    <button
                      onClick={() => { setHelpOpen(false); onNavigateHelp(); }}
                      className="flex w-full items-start gap-3 rounded-xl p-3 text-left transition hover:bg-brand-50"
                    >
                      <Phone className="mt-0.5 h-5 w-5 text-brand-600" />
                      <div>
                        <p className="text-sm font-semibold text-gray-800">Contact Us</p>
                        <p className="text-xs text-gray-500">Call / WhatsApp support</p>
                      </div>
                    </button>
                    <div className="flex items-start gap-3 rounded-xl p-3">
                      <MapPin className="mt-0.5 h-5 w-5 text-brand-600" />
                      <div>
                        <p className="text-sm font-semibold text-gray-800">Track Order</p>
                        <p className="text-xs text-gray-500">Follow your delivery live</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 rounded-xl p-3">
                      <ShieldCheck className="mt-0.5 h-5 w-5 text-brand-600" />
                      <div>
                        <p className="text-sm font-semibold text-gray-800">Quality Promise</p>
                        <p className="text-xs text-gray-500">Fresh or refunded</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Account */}
              <div className="relative" ref={accountRef}>
                <button
                  onClick={() => setAccountOpen((v) => !v)}
                  className="flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-100 hover:text-brand-700"
                >
                  <UserIcon className="h-5 w-5" />
                  <span className="hidden md:inline">Account</span>
                  <ChevronDown className={`hidden h-3.5 w-3.5 md:inline transition ${accountOpen ? 'rotate-180' : ''}`} />
                </button>
                {accountOpen && (
                  <div className="absolute right-0 mt-2 w-72 rounded-2xl border border-gray-100 bg-white p-2 shadow-xl animate-scale-in">
                    <div className="px-3 py-2">
                      <p className="text-sm font-semibold text-gray-800">Account</p>
                      <p className="text-xs text-gray-500">
                        Sign in with Google or email/password to place orders and access merchant tools if authorized.
                      </p>
                    </div>
                    <div className="my-2 h-px bg-gray-100" />
                    {user ? (
                      <div className="space-y-2 p-1">
                        <div className="rounded-xl bg-brand-50 px-3 py-2 text-sm font-medium text-brand-700">
                          <p>Signed in as {user.email ?? 'Customer'}</p>
                          <p className="text-xs text-gray-500">Role: {role ?? 'customer'}</p>
                        </div>
                        {merchantRole && (
                          <button
                            onClick={() => {
                              onToggleMerchant();
                              setAccountOpen(false);
                            }}
                            className="w-full rounded-xl bg-brand-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-brand-700"
                          >
                            Open Merchant Dashboard
                          </button>
                        )}
                        <button
                          onClick={() => {
                            onCustomerLogout();
                            setAccountOpen(false);
                            setAuthError('');
                          }}
                          className="w-full rounded-xl px-3 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-100"
                        >
                          Sign Out
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-3 p-1">
                        <button
                          type="button"
                          onClick={() => {
                            onCustomerLogin();
                            setAccountOpen(false);
                          }}
                          className="flex w-full items-center justify-center gap-3 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 hover:border-gray-300"
                        >
                          <svg className="h-5 w-5" viewBox="0 0 24 24">
                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                          </svg>
                          Sign in with Google
                        </button>
                        <div className="rounded-2xl bg-gray-50 p-3">
                          <div className="flex items-center justify-between gap-3">
                            <button
                              type="button"
                              onClick={() => setShowSignUp(false)}
                              className={`flex-1 rounded-full px-3 py-2 text-sm font-semibold transition ${showSignUp ? 'bg-white text-gray-600' : 'bg-brand-600 text-white'}`}
                            >
                              Sign In
                            </button>
                            <button
                              type="button"
                              onClick={() => setShowSignUp(true)}
                              className={`flex-1 rounded-full px-3 py-2 text-sm font-semibold transition ${showSignUp ? 'bg-brand-600 text-white' : 'bg-white text-gray-600'}`}
                            >
                              Sign Up
                            </button>
                          </div>
                          <form
                            onSubmit={async (e) => {
                              e.preventDefault();
                              setAuthError('');
                              if (!authEmail.trim() || !authPassword.trim()) {
                                setAuthError('Email and password are required.');
                                return;
                              }
                              const error = showSignUp
                                ? await onCustomerSignUp(authEmail.trim(), authPassword)
                                : await onCustomerSignIn(authEmail.trim(), authPassword);
                              if (error) {
                                setAuthError((error as { message?: string })?.message || 'Authentication failed.');
                                return;
                              }
                              setAccountOpen(false);
                              setAuthEmail('');
                              setAuthPassword('');
                            }}
                            className="mt-3 space-y-3"
                          >
                            <label className="block text-xs font-semibold text-gray-600">
                              Email
                              <input
                                type="email"
                                value={authEmail}
                                onChange={(e) => setAuthEmail(e.target.value)}
                                className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
                              />
                            </label>
                            <label className="block text-xs font-semibold text-gray-600">
                              Password
                              <input
                                type="password"
                                value={authPassword}
                                onChange={(e) => setAuthPassword(e.target.value)}
                                className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
                              />
                            </label>
                            {authError && (
                              <p className="text-xs font-medium text-red-600">{authError}</p>
                            )}
                            <button
                              type="submit"
                              className="w-full rounded-xl bg-brand-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-brand-700"
                            >
                              {showSignUp ? 'Create Account' : 'Sign In'}
                            </button>
                          </form>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Cart */}
              <button
                onClick={onOpenCart}
                className="relative flex items-center gap-2 rounded-full bg-brand-600 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700"
              >
                <ShoppingCart className="h-5 w-5" />
                <span className="hidden sm:inline">Cart</span>
                {count > 0 && (
                  <span className="absolute -right-1 -top-1 grid h-5 min-w-[20px] place-items-center rounded-full bg-gold-400 px-1 text-[11px] font-bold text-brand-900 ring-2 ring-white animate-pop">
                    {count}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

export function MerchantToggle({
  merchantMode,
  onToggle,
}: {
  merchantMode: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className="group flex items-center gap-2.5 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 shadow-sm transition hover:border-brand-300 hover:bg-brand-50"
    >
      <span className={merchantMode ? 'text-brand-700' : 'text-gray-500'}>
        {merchantMode ? 'Merchant View' : 'Customer View'}
      </span>
      <span
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition ${
          merchantMode ? 'bg-brand-500' : 'bg-gray-300'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${
            merchantMode ? 'translate-x-4' : 'translate-x-0.5'
          }`}
        />
      </span>
    </button>
  );
}

export { Menu, X };
