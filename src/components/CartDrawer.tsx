import { useEffect, useMemo, useState } from 'react';
import {
  X,
  Plus,
  Minus,
  Trash2,
  ShoppingBag,
  ArrowRight,
} from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import { useCart } from '../context/CartContext';
import { formatUGX } from '../lib/format';
import { supabase } from '../lib/supabase';
import type { SiteSettings } from '../lib/siteSettings';
import type { Outlet, UserRoleProfile } from '../types';
import { findOutletByCode, OFFICIAL_OUTLETS } from '../lib/outlets';
import { fetchPublicAttendantForOutlet } from '../lib/attendants';

interface CartDrawerProps {
  open: boolean;
  onClose: () => void;
  onCheckout: () => void;
  selectedOutletCode: string;
  onSelectedOutletCodeChange: (outletCode: string) => void;
  onOutletContextChange: (outlet: Outlet | null, attendant: UserRoleProfile | null) => void;
  user: User | null;
  siteSettings: SiteSettings;
}

export default function CartDrawer({
  open,
  onClose,
  onCheckout,
  selectedOutletCode,
  onSelectedOutletCodeChange,
  onOutletContextChange,
  siteSettings,
}: CartDrawerProps) {
  const { items, subtotal, increment, decrement, remove, count } = useCart();
  const [outlets, setOutlets] = useState<Outlet[]>(OFFICIAL_OUTLETS);
  const [attendant, setAttendant] = useState<UserRoleProfile | null>(null);
  const selectedOutlet = useMemo(
    () => findOutletByCode(outlets, selectedOutletCode),
    [outlets, selectedOutletCode],
  );
  const DELIVERY_FEE = 5000;

  useEffect(() => {
    if (!open) return;

    const loadOutlets = async () => {
      const { data, error } = await supabase
        .from('outlets')
        .select('*')
        .eq('is_active', true)
        .order('outlet_code');

      const nextOutlets = !error && data?.length ? (data as Outlet[]) : OFFICIAL_OUTLETS;
      setOutlets(nextOutlets);

      if (!selectedOutletCode && nextOutlets[0]) {
        onSelectedOutletCodeChange(nextOutlets[0].outlet_code);
      }
    };

    void loadOutlets();
  }, [onSelectedOutletCodeChange, open, selectedOutletCode]);

  useEffect(() => {
    if (!selectedOutletCode) {
      setAttendant(null);
      return;
    }

    let cancelled = false;

    const loadAttendant = async () => {
      // Preloads the outlet's attendant so checkout can show it immediately.
      setAttendant(null);
      const { attendant: profile } = await fetchPublicAttendantForOutlet(selectedOutletCode);
      if (cancelled) return;
      setAttendant(profile);
    };

    void loadAttendant();

    return () => {
      cancelled = true;
    };
  }, [selectedOutletCode]);

  useEffect(() => {
    onOutletContextChange(selectedOutlet, attendant);
  }, [attendant, onOutletContextChange, selectedOutlet]);

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className={`fixed inset-0 z-50 bg-black/40 backdrop-blur-sm transition-opacity duration-300 ${
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      />

      {/* Drawer */}
      <aside
        className={`fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col bg-white shadow-2xl transition-transform duration-300 ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5 text-brand-600" />
            <h2 className="text-base font-bold text-gray-800">
              Your Cart {count > 0 && <span className="text-gray-400">({count})</span>}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-full text-gray-500 transition hover:bg-gray-100"
            aria-label="Close cart"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Items */}
        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
            <div className="grid h-20 w-20 place-items-center rounded-full bg-brand-50 text-brand-300">
              <ShoppingBag className="h-9 w-9" />
            </div>
            <p className="mt-4 text-sm font-semibold text-gray-700" data-site-text="cartEmptyTitle">
              {siteSettings.cartEmptyTitle}
            </p>
            <p className="mt-1 text-xs text-gray-500" data-site-text="cartEmptyText">
              {siteSettings.cartEmptyText}
            </p>
            <button
              onClick={onClose}
              className="mt-5 rounded-full bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700"
            >
              <span data-site-text="continueShoppingLabel">
                {siteSettings.continueShoppingLabel}
              </span>
            </button>
          </div>
        ) : (
          <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
            {items.map(({ product, quantity }) => (
              <div key={product.id} className="flex gap-3 border-b border-gray-100 pb-3 last:border-0">
                <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-gray-50">
                  {product.image_url ? (
                    <img
                      src={product.image_url}
                      alt={product.name}
                      className="h-full w-full object-cover"
                    />
                  ) : null}
                </div>
                <div className="flex flex-1 flex-col">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{product.name}</p>
                      <p className="text-xs text-gray-500">{product.unit}</p>
                    </div>
                    <button
                      onClick={() => remove(product.id)}
                      className="-m-2 grid h-9 w-9 place-items-center rounded-full text-gray-400 transition hover:bg-red-50 hover:text-red-500"
                      aria-label={`Remove ${product.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="mt-auto flex items-center justify-between pt-2">
                    <div className="flex items-center rounded-xl bg-brand-50">
                      <button
                        onClick={() => decrement(product.id)}
                        aria-label={`Remove one ${product.name}`}
                        className="grid h-9 w-9 place-items-center rounded-xl text-brand-700 transition hover:bg-brand-100"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="min-w-[24px] text-center text-sm font-bold text-brand-800" aria-live="polite">
                        {quantity}
                      </span>
                      <button
                        onClick={() => increment(product.id)}
                        aria-label={`Add one more ${product.name}`}
                        className="grid h-9 w-9 place-items-center rounded-xl text-brand-700 transition hover:bg-brand-100"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <p className="text-sm font-bold text-gray-900">
                      {formatUGX(product.price * quantity)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        {items.length > 0 && (
          <div className="border-t border-gray-100 px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4">
            <dl className="space-y-1 text-sm">
              <div className="flex items-center justify-between text-gray-600">
                <dt>Items (estimate)</dt>
                <dd>{formatUGX(subtotal)}</dd>
              </div>
              <div className="flex items-center justify-between text-gray-600">
                <dt>Delivery</dt>
                <dd>{formatUGX(DELIVERY_FEE)}</dd>
              </div>
              <div className="flex items-center justify-between pt-1 text-base font-bold text-gray-900">
                <dt>Estimated total</dt>
                <dd>{formatUGX(subtotal + DELIVERY_FEE)}</dd>
              </div>
            </dl>
            <p className="mt-2 text-xs leading-relaxed text-gray-500">
              Market prices change daily. You approve the final bill before delivery and pay by Mobile Money when
              it arrives. No sign-in needed.
            </p>
            <button
              onClick={onCheckout}
              className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand-600 text-sm font-bold text-white transition hover:bg-brand-700"
            >
              <span data-site-text="checkoutButtonLabel">{siteSettings.checkoutButtonLabel}</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </aside>
    </>
  );
}
