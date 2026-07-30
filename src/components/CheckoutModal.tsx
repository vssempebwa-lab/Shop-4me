import { useEffect, useState, type FormEvent } from 'react';
import { X, MapPin, User, Phone, CheckCircle2, Truck, Loader2, WalletCards } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { formatUGX } from '../lib/format';
import { supabase } from '../lib/supabase';
import type { Depot, Order } from '../types';
import { DEMO_ORDER_PREFIX, updateDemoOrder } from '../lib/demoOrders';
import { getStatusDisplay } from '../lib/orderStatus';
import {
  findDepotByCode,
  formatDepotOption,
  formatDistributionAreas,
  OFFICIAL_DEPOTS,
  suggestDepotFromText,
} from '../lib/depots';

interface CheckoutModalProps {
  open: boolean;
  onClose: () => void;
  onOrderPlaced: (order: Order) => void;
  userId?: string | null;
}

const PAYMENT_OPTIONS = [
  {
    label: 'MTN MoMoPay',
    till: 'Merchant Till: 700000',
    value: 'MTN MoMoPay - Till 700000',
  },
  {
    label: 'Airtel Money Merchant',
    till: 'Merchant Till: 700001',
    value: 'Airtel Money Merchant - Till 700001',
  },
];

export default function CheckoutModal({ open, onClose, onOrderPlaced, userId }: CheckoutModalProps) {
  const { items, subtotal, clear } = useCart();
  const DELIVERY_FEE = 5000;
  const total = subtotal + DELIVERY_FEE;
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [selectedArea, setSelectedArea] = useState('');
  const [selectedDepotCode, setSelectedDepotCode] = useState('');
  const [depots, setDepots] = useState<Depot[]>([]);
  const [paymentMethod, setPaymentMethod] = useState('MTN MoMoPay - Till 700000');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const locationOptions = buildLocationOptions(depots);
  const selectedLocation = locationOptions.find((option) => option.value === selectedArea);
  const suggestedDepot = suggestDepotFromText(
    depots,
    selectedLocation?.area,
    selectedLocation?.division,
    address,
  );
  const selectedDepot = findDepotByCode(depots, selectedDepotCode);
  const depotMismatch = Boolean(
    selectedLocation &&
      suggestedDepot?.depot_code &&
      selectedDepotCode &&
      suggestedDepot.depot_code !== selectedDepotCode,
  );

  useEffect(() => {
    if (!open) return;

    const loadDepots = async () => {
      const { data, error: depotError } = await supabase
        .from('depots')
        .select('*')
        .eq('is_active', true)
        .order('depot_code');

      if (!depotError && data?.length) {
        setDepots((data as Depot[]) ?? []);
      } else {
        setDepots(OFFICIAL_DEPOTS);
      }
    };

    void loadDepots();
  }, [open]);

  useEffect(() => {
    const location = locationOptions.find((option) => option.value === selectedArea);
    if (!location) return;

    const matchedDepot = findDepotByCode(depots, location.depotCode);
    if (matchedDepot) setSelectedDepotCode(matchedDepot.depot_code);
  }, [depots, selectedArea]);

  if (!open) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim() || !phone.trim()) {
      setError('Please enter your name and phone number.');
      return;
    }
    if (!selectedArea && !address.trim()) {
      setError('Choose an area or type your pickup landmark.');
      return;
    }
    if (!selectedDepotCode) {
      setError('Please select your pickup depot.');
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

    const orderId = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    const orderPayload: Order = {
      id: orderId,
      contact_name: name.trim(),
      phone: phone.trim(),
      delivery_address: address.trim() || selectedLocation?.area || 'Pickup station to confirm',
      market_location: selectedLocation?.area ?? address.trim() ?? null,
      depot_code: selectedDepot?.depot_code ?? selectedDepotCode,
      division: selectedDepot?.division ?? null,
      suggested_depot_code: suggestedDepot?.depot_code ?? selectedDepot?.depot_code ?? null,
      subtotal,
      delivery_fee: DELIVERY_FEE,
      total_amount: total,
      payment_method: paymentMethod,
      payment_status: 'PENDING',
      order_status: 'Order Received',
      is_shared_with_depot: false,
      user_id: userId ?? null,
      items: orderItems,
      status: 'Order Received',
      created_at: createdAt,
    };

    const resetCheckoutForm = () => {
      clear();
      setName('');
      setPhone('');
      setAddress('');
      setSelectedArea('');
      setSelectedDepotCode('');
      setPaymentMethod('MTN MoMoPay - Till 700000');
    };

    const finishOrder = (order: Order) => {
      onOrderPlaced(order);
      resetCheckoutForm();
    };

    const saveLocalGuestOrder = (reason: unknown) => {
      console.error('Supabase checkout insert failed; saved as a local guest order instead.', reason);
      const localOrder: Order = {
        ...orderPayload,
        id: `${DEMO_ORDER_PREFIX}guest-${orderId}`,
        user_id: null,
      };

      updateDemoOrder(localOrder);
      finishOrder(localOrder);
    };

    const { error: insertError } = await supabase
      .from('orders')
      .insert(orderPayload);

    if (insertError) {
      setSubmitting(false);
      saveLocalGuestOrder(insertError);
      return;
    }

    const { error: itemsError } = await supabase.from('order_items').insert(
      orderItems.map((item) => ({
        ...item,
        order_id: orderId,
      })),
    );

    setSubmitting(false);

    if (itemsError) {
      console.error('Supabase order_items insert failed; using the order items stored on the order row.', itemsError);
      finishOrder(orderPayload);
      return;
    }

    finishOrder(orderPayload);
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
                <span className="text-sm font-semibold text-gray-700">Total Amount Due</span>
                <span className="text-lg font-extrabold text-brand-700">{formatUGX(total)}</span>
              </div>
            </div>
          </div>

          {/* Contact details */}
          <p className="mt-5 text-xs font-semibold uppercase tracking-wide text-gray-500">
            Contact Details
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
          </div>

          <section className="mt-5 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-brand-600" />
              <h3 className="text-sm font-extrabold text-gray-800">Choose your location</h3>
            </div>
            <div className="mt-3 space-y-3">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-gray-600">Known Area</span>
                <select
                  value={selectedArea}
                  onChange={(event) => setSelectedArea(event.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none transition focus:border-brand-400 focus:bg-white focus:ring-2 focus:ring-brand-100"
                >
                  <option value="">Select your area</option>
                  {locationOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.area} - {option.division}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-gray-600">Pickup Depot</span>
                <select
                  value={selectedDepotCode}
                  onChange={(event) => setSelectedDepotCode(event.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none transition focus:border-brand-400 focus:bg-white focus:ring-2 focus:ring-brand-100"
                  required
                >
                  <option value="">Select pickup depot</option>
                  {depots.map((depot) => (
                    <option key={depot.depot_code} value={depot.depot_code}>
                      {depot.hub_market || depot.name} - {depot.division}
                    </option>
                  ))}
                </select>
              </label>
              {depotMismatch && (
                <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">
                  This is outside your area's usual depot - pickup may take slightly longer.
                </p>
              )}
              <Field
                icon={<MapPin className="h-4 w-4" />}
                label="Specific Address or Landmark"
                value={address}
                onChange={setAddress}
                placeholder="e.g. near Kalerwe stage"
                textarea
              />
              {selectedDepot && (
                <div className="rounded-xl bg-brand-50 px-3 py-2.5 text-sm">
                  <p className="font-bold text-brand-800">
                    Your order will be handled by {selectedDepot.hub_market || selectedDepot.name}.
                  </p>
                  <p className="mt-1 text-xs font-medium text-brand-700">
                    {formatDepotOption(selectedDepot)}
                  </p>
                  <p className="mt-1 text-xs text-brand-700">
                    Covers: {formatDistributionAreas(selectedDepot)}
                  </p>
                </div>
              )}
              <div className="flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2.5 text-sm">
                <span className="font-semibold text-gray-700">Delivery Fee</span>
                <span className="font-extrabold text-brand-700">{formatUGX(DELIVERY_FEE)}</span>
              </div>
              <p className="text-xs font-medium text-gray-500">
                Flat rate, all areas. Estimated dispatch: same day, based on depot availability.
              </p>
            </div>
          </section>

          <section className="mt-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <WalletCards className="h-4 w-4 text-brand-600" />
              <h3 className="text-sm font-extrabold text-gray-800">Pay on Delivery</h3>
            </div>
            <p className="mt-1 text-xs font-medium text-gray-500">
              You'll pay via Mobile Money when your order arrives at your pickup station. No upfront payment required.
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {PAYMENT_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className={`cursor-pointer rounded-2xl border p-3 transition ${
                    paymentMethod === option.value
                      ? 'border-brand-400 bg-brand-50 ring-2 ring-brand-100'
                      : 'border-gray-100 bg-gray-50 hover:border-brand-200'
                  }`}
                >
                  <input
                    type="radio"
                    name="payment_method"
                    value={option.value}
                    checked={paymentMethod === option.value}
                    onChange={(event) => setPaymentMethod(event.target.value)}
                    className="sr-only"
                  />
                  <span className="block text-sm font-extrabold text-gray-800">{option.label}</span>
                  <span className="mt-1 block text-xs font-semibold text-brand-700">{option.till}</span>
                </label>
              ))}
            </div>
          </section>

          {error && (
            <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-600">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting || items.length === 0 || !selectedDepotCode}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-brand-600 py-3 text-sm font-bold text-white shadow-md transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Placing order...
              </>
            ) : (
              <>Place Order - {formatUGX(total)}</>
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

function buildLocationOptions(depots: Depot[]) {
  return depots.flatMap((depot) =>
    depot.distribution_areas.map((area) => ({
      value: `${depot.depot_code}:${area}`,
      area,
      depotCode: depot.depot_code,
      division: depot.division,
    })),
  );
}

export function OrderConfirmation({
  order,
  onClose,
}: {
  order: Order;
  onClose: () => void;
}) {
  const [currentOrder, setCurrentOrder] = useState(order);
  const statusDisplay = getStatusDisplay(currentOrder.order_status ?? currentOrder.status);
  const isDemoOrder = currentOrder.id.startsWith(DEMO_ORDER_PREFIX);

  useEffect(() => {
    setCurrentOrder(order);
  }, [order]);

  useEffect(() => {
    if (isDemoOrder) return;

    const channel = supabase
      .channel(`client-order-${order.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `id=eq.${order.id}`,
        },
        (payload) => {
          setCurrentOrder((current) => ({
            ...current,
            ...(payload.new as Partial<Order>),
            items: current.items,
          }));
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [isDemoOrder, order.id]);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl animate-scale-in">
        <div className="bg-gradient-to-br from-brand-600 to-brand-800 px-6 py-8 text-center text-white">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-white/20 ring-4 ring-white/30">
            <CheckCircle2 className="h-9 w-9 text-gold-300" />
          </div>
          <h2 className="mt-4 text-xl font-extrabold">Order Received!</h2>
          <p className="mt-1 text-sm text-brand-50/90">
            Thank you, {currentOrder.contact_name}. A depot team will process your order.
          </p>
        </div>
        <div className="px-6 py-5">
          <div className="rounded-xl bg-brand-50 px-3 py-2.5 text-sm">
            <div className="flex items-center gap-2">
            <Truck className="h-4 w-4 text-brand-600" />
              <span className="font-semibold text-brand-700">{statusDisplay.clientLabel}</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-white">
              <div
                className="h-full rounded-full bg-brand-600 transition-all"
                style={{ width: `${statusDisplay.progress}%` }}
              />
            </div>
            <div className="mt-1 flex justify-between text-[11px] font-semibold text-brand-700">
              <span>{statusDisplay.progress}% complete</span>
              {currentOrder.payment_status === 'PAID' && statusDisplay.status === 'Delivered' && (
                <span>Payment confirmed</span>
              )}
            </div>
          </div>
          <div className="mt-3 space-y-2 text-sm">
            <Row label="Order ID" value={`#${currentOrder.id.slice(0, 8).toUpperCase()}`} />
            <Row label="Contact" value={currentOrder.contact_name} />
            <Row label="Phone" value={currentOrder.phone} />
            <Row label="Delivery to" value={currentOrder.delivery_address} />
            <Row label="Payment" value={currentOrder.payment_method || 'Pay on Delivery'} />
            <Row label="Items" value={`${currentOrder.items.length} item(s)`} />
            <div className="flex items-center justify-between border-t border-gray-100 pt-2">
              <span className="text-sm text-gray-500">Subtotal</span>
              <span className="text-gray-800">{formatUGX(currentOrder.subtotal)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Delivery Fee</span>
              <span className="text-gray-800">{formatUGX(currentOrder.delivery_fee ?? 0)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-semibold text-gray-700">Total</span>
              <span className="text-lg font-extrabold text-brand-700">
                {formatUGX(currentOrder.total_amount ?? (currentOrder.subtotal ?? 0) + (currentOrder.delivery_fee ?? 0))}
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
