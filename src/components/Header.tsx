import { useEffect, useRef, useState } from 'react';
import {
  Search,
  ShoppingCart,
  User,
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
}

export default function Header({
  search,
  onSearchChange,
  onOpenCart,
  onNavigateHelp,
}: HeaderProps) {
  const { count } = useCart();
  const [accountOpen, setAccountOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
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
                  <User className="h-5 w-5" />
                  <span className="hidden md:inline">Account</span>
                  <ChevronDown className={`hidden h-3.5 w-3.5 md:inline transition ${accountOpen ? 'rotate-180' : ''}`} />
                </button>
                {accountOpen && (
                  <div className="absolute right-0 mt-2 w-60 rounded-2xl border border-gray-100 bg-white p-2 shadow-xl animate-scale-in">
                    <div className="px-3 py-2">
                      <p className="text-sm font-semibold text-gray-800">Welcome back</p>
                      <p className="text-xs text-gray-500">Sign in to track orders &amp; save favourites</p>
                    </div>
                    <div className="my-1 h-px bg-gray-100" />
                    <button className="w-full rounded-xl bg-brand-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-brand-700">
                      Sign In
                    </button>
                    <button className="mt-1 w-full rounded-xl px-3 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-100">
                      My Orders
                    </button>
                    <button className="w-full rounded-xl px-3 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-100">
                      Saved Items
                    </button>
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
