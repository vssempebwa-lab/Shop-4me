import { useState, type FormEvent } from 'react';
import { X, MapPin, User, Phone, CheckCircle2, Truck, Loader2 } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { formatUGX } from '../lib/format';
import { supabase } from '../lib/supabase';
import type { Order } from '../types';

interface CheckoutModalProps {
  open: boolean;
  onClose: () => void;
  onOrderPlaced: (order: Order) => void;
  userId?: string | null;
}

export default function CheckoutModal({ open, onClose, onOrderPlaced, userId }: CheckoutModalProps) {
  const { items, subtotal, clear } = useCart();
  const DELIVERY_FEE = 5000;
  const total = subtotal + DELIVERY_FEE;
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [marketLocation, setMarketLocation] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!userId) {
      setError('Please sign in to place your order.');
      return;
    }
    if (!name.trim() || !phone.trim() || !address.trim()) {
      setError('Please fill in all fields.');
      return;
    }
    setSubmitting(true);

    const orderItems = items.map((i) => ({
      product_id: i.product.id,
      name: i.product.name,
      price: i.product.price,
      unit: i.product.unit,
      quantity: i.quantity,
    }));

    const { data: orderData, error: insertError } = await supabase
      .from('orders')
      .insert({
        contact_name: name.trim(),
        phone: phone.trim(),
        delivery_address: address.trim(),
        market_location: marketLocation.trim() || null,
        subtotal,
        delivery_fee: DELIVERY_FEE,
        user_id: userId ?? null,
        items: orderItems,
        status: 'Dispatched to Doorstep',
      })
      .select('*')
      .single();

    if (insertError || !orderData) {
      setSubmitting(false);
      setError('Could not place order. Please try again.');
      return;
    }

    const { error: itemsError } = await supabase.from('order_items').insert(
      orderItems.map((item) => ({
        ...item,
        order_id: orderData.id,
      })),
    );

    setSubmitting(false);

    if (itemsError) {
      setError('Could not save order items. Please try again.');
      return;
    }

    onOrderPlaced({
      ...orderData,
      items: orderItems,
      market_location: orderData.market_location ?? marketLocation,
      user_id: orderData.user_id ?? userId ?? null,
    } as Order);
    clear();
    setName('');
    setPhone('');
    setAddress('');
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center">
      <div
        onClick={onClose}
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
      />
      <div className="relative w-full max-w-lg overflow-hidden rounded-t-3xl bg-white shadow-2xl animate-slide-up sm:rounded-3xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h2 className="text-base font-bold text-gray-800">Checkout</h2>
          <button
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-full text-gray-500 transition hover:bg-gray-100"
            aria-label="Close checkout"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="max-h-[80vh] overflow-y-auto px-5 py-4">
          {/* Order summary */}
          <div className="rounded-2xl bg-brand-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">
              Order Summary
            </p>
            <div className="mt-2 space-y-1.5">
              {items.map(({ product, quantity }) => (
                <div key={product.id} className="flex justify-between text-sm">
                  <span className="text-gray-700">
                    {product.name} <span className="text-gray-400">× {quantity}</span>
                  </span>
                  <span className="font-medium text-gray-800">
                    {formatUGX(product.price * quantity)}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-3 space-y-2 border-t border-brand-200/60 pt-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-700">Subtotal</span>
                <span className="text-gray-800">{formatUGX(subtotal)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-700">Delivery Fee</span>
                <span className="text-gray-800">{formatUGX(DELIVERY_FEE)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-700">Total</span>
                <span className="text-lg font-extrabold text-brand-700">{formatUGX(total)}</span>
              </div>
            </div>
          </div>

          {/* Delivery details */}
          <p className="mt-5 text-xs font-semibold uppercase tracking-wide text-gray-500">
            Delivery Details
          </p>
          <div className="mt-3 space-y-3">
            <Field
              icon={<User className="h-4 w-4" />}
              label="Contact Name"
              value={name}
              onChange={setName}
              placeholder="e.g. John Mukasa"
            />
            <Field
              icon={<Phone className="h-4 w-4" />}
              label="Phone Number (MTN / Airtel)"
              value={phone}
              onChange={setPhone}
              placeholder="e.g. 0772 123 456"
              type="tel"
            />
            <Field
              icon={<MapPin className="h-4 w-4" />}
              label="Delivery Address"
              value={address}
              onChange={setAddress}
              placeholder="Plot, street, area, town"
              textarea
            />
            <Field
              icon={<MapPin className="h-4 w-4" />}
              label="Market / Location"
              value={marketLocation}
              onChange={setMarketLocation}
              placeholder="e.g. Nakawa Market / Kisenyi"
            />
          </div>

          {error && (
            <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-600">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting || items.length === 0}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-brand-600 py-3 text-sm font-bold text-white shadow-md transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Placing order...
              </>
            ) : (
              <>Place Order — {formatUGX(total)}</>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

function Field({
  icon,
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  textarea = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  textarea?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-gray-600">{label}</span>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-3 text-gray-400">{icon}</span>
        {textarea ? (
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            rows={2}
            className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-brand-400 focus:bg-white focus:ring-2 focus:ring-brand-100"
          />
        ) : (
          <input
            type={type}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-brand-400 focus:bg-white focus:ring-2 focus:ring-brand-100"
          />
        )}
      </div>
    </label>
  );
}

export function OrderConfirmation({
  order,
  onClose,
}: {
  order: Order;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl animate-scale-in">
        <div className="bg-gradient-to-br from-brand-600 to-brand-800 px-6 py-8 text-center text-white">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-white/20 ring-4 ring-white/30">
            <CheckCircle2 className="h-9 w-9 text-gold-300" />
          </div>
          <h2 className="mt-4 text-xl font-extrabold">Dispatched to Doorstep!</h2>
          <p className="mt-1 text-sm text-brand-50/90">
            Thank you, {order.contact_name}. Your order is on its way.
          </p>
        </div>
        <div className="px-6 py-5">
          <div className="flex items-center gap-2 rounded-xl bg-brand-50 px-3 py-2.5 text-sm">
            <Truck className="h-4 w-4 text-brand-600" />
            <span className="font-semibold text-brand-700">{order.status}</span>
          </div>
          <div className="mt-3 space-y-2 text-sm">
            <Row label="Order ID" value={`#${order.id.slice(0, 8).toUpperCase()}`} />
            <Row label="Contact" value={order.contact_name} />
            <Row label="Phone" value={order.phone} />
            <Row label="Delivery to" value={order.delivery_address} />
            <Row label="Items" value={`${order.items.length} item(s)`} />
            <div className="flex items-center justify-between border-t border-gray-100 pt-2">
              <span className="text-sm text-gray-500">Subtotal</span>
              <span className="text-gray-800">{formatUGX(order.subtotal)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Delivery Fee</span>
              <span className="text-gray-800">{formatUGX(order.delivery_fee ?? 0)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-semibold text-gray-700">Total</span>
              <span className="text-lg font-extrabold text-brand-700">
                {formatUGX((order.subtotal ?? 0) + (order.delivery_fee ?? 0))}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="mt-5 w-full rounded-full bg-brand-600 py-3 text-sm font-bold text-white transition hover:bg-brand-700"
          >
            Continue Shopping
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-gray-500">{label}</span>
      <span className="text-right font-medium text-gray-800">{value}</span>
    </div>
  );
}
