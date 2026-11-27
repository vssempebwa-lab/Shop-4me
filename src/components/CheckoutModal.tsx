import { useEffect, useState, type FormEvent } from 'react';
import { X, MapPin, User, Phone, CheckCircle2, Truck, Loader2, WalletCards, Download } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { formatUGX } from '../lib/format';
import { supabase } from '../lib/supabase';
import type { Outlet, Order, OrderItem, UserRoleProfile } from '../types';
import { DEMO_ORDER_PREFIX, updateSharedDemoOrder } from '../lib/demoOrders';
import { getStatusDisplay } from '../lib/orderStatus';
import {
  findOutletByCode,
  formatOutletOption,
  formatDistributionAreas,
  OFFICIAL_OUTLETS,
  suggestOutletFromText,
} from '../lib/outlets';
import { fetchPublicAttendantForOutlet } from '../lib/attendants';
import { generateShopListPDF, preloadShopListPdfGenerator } from '../lib/shopListPdf';
import { DEFAULT_PAYMENT_SETTINGS, fetchPaymentSettings, type PaymentSettings } from '../lib/paymentSettings';
import AttendantProfileCard from './AttendantProfileCard';
import FinalBillPanel from './FinalBillPanel';
import { getOrderCode, trackOrder, type GuestOrderAccess } from '../lib/orderTracking';

interface CheckoutModalProps {
  open: boolean;
  onClose: () => void;
  onOrderPlaced: (order: Order) => void;
  initialSelectedOutletCode?: string;
  initialOutlet?: Outlet | null;
  initialAttendant?: UserRoleProfile | null;
  onSelectedOutletCodeChange?: (outletCode: string) => void;
  userId?: string | null;
}

export default function CheckoutModal({
  open,
  onClose,
  onOrderPlaced,
  initialSelectedOutletCode,
  initialOutlet,
  initialAttendant,
  onSelectedOutletCodeChange,
  userId,
}: CheckoutModalProps) {
  const { items, subtotal, clear } = useCart();
  const DELIVERY_FEE = 5000;
  const total = subtotal + DELIVERY_FEE;
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [selectedArea, setSelectedArea] = useState('');
  const [selectedOutletCode, setSelectedOutletCode] = useState(initialSelectedOutletCode ?? '');
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings>(DEFAULT_PAYMENT_SETTINGS);
  const [paymentMethod, setPaymentMethod] = useState(formatPaymentMethodValue('mtn', DEFAULT_PAYMENT_SETTINGS));
  const [attendant, setAttendant] = useState<UserRoleProfile | null>(
    initialAttendant?.assigned_outlet === initialSelectedOutletCode ? initialAttendant ?? null : null,
  );
  const [attendantLoading, setAttendantLoading] = useState(false);
  const [attendantError, setAttendantError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const locationOptions = buildLocationOptions(outlets);
  const selectedLocation = locationOptions.find((option) => option.value === selectedArea);
  const suggestedOutlet = suggestOutletFromText(
    outlets,
    selectedLocation?.area,
    selectedLocation?.division,
    address,
  );
  const selectedOutlet =
    findOutletByCode(outlets, selectedOutletCode) ??
    (initialOutlet?.outlet_code === selectedOutletCode ? initialOutlet : null);
  const selectedAttendant = attendant?.assigned_outlet === selectedOutletCode ? attendant : null;
  const paymentOptions = buildCheckoutPaymentOptions(paymentSettings);
  const outletMismatch = Boolean(
    selectedLocation &&
      suggestedOutlet?.outlet_code &&
      selectedOutletCode &&
      suggestedOutlet.outlet_code !== selectedOutletCode,
  );

  useEffect(() => {
    if (!open) return;

    if (initialSelectedOutletCode) {
      setSelectedOutletCode(initialSelectedOutletCode);
    }

    const loadOutlets = async () => {
      const { data, error: outletError } = await supabase
        .from('outlets')
        .select('*')
        .eq('is_active', true)
        .order('outlet_code');

      if (!outletError && data?.length) {
        setOutlets((data as Outlet[]) ?? []);
      } else {
        setOutlets(OFFICIAL_OUTLETS);
      }
    };

    void loadOutlets();
  }, [initialSelectedOutletCode, open]);

  useEffect(() => {
    if (!open) return;

    void fetchPaymentSettings().then((nextSettings) => {
      setPaymentSettings(nextSettings);
      setPaymentMethod((current) => {
        if (current.toLowerCase().includes('airtel')) return formatPaymentMethodValue('airtel', nextSettings);
        return formatPaymentMethodValue('mtn', nextSettings);
      });
    });
  }, [open]);

  useEffect(() => {
    if (selectedOutletCode || !outlets[0]) return;
    updateSelectedOutlet(outlets[0].outlet_code);
  }, [outlets, selectedOutletCode]);

  useEffect(() => {
    const location = locationOptions.find((option) => option.value === selectedArea);
    if (!location) return;

    const matchedOutlet = findOutletByCode(outlets, location.outletCode);
    if (matchedOutlet) updateSelectedOutlet(matchedOutlet.outlet_code);
  }, [outlets, selectedArea]);

  useEffect(() => {
    if (!selectedOutletCode) {
      setAttendant(null);
      setAttendantError(null);
      return;
    }

    let cancelled = false;

    const loadAttendant = async () => {
      const matchingInitialAttendant =
        initialAttendant?.assigned_outlet === selectedOutletCode ? initialAttendant : null;

      setAttendantLoading(true);
      setAttendantError(null);
      setAttendant(matchingInitialAttendant);

      const { attendant: profile, error } = await fetchPublicAttendantForOutlet(selectedOutletCode);

      if (cancelled) return;

      setAttendant(profile ?? matchingInitialAttendant);
      setAttendantError(error && !matchingInitialAttendant ? error : null);
      setAttendantLoading(false);
    };

    void loadAttendant();

    return () => {
      cancelled = true;
    };
  }, [initialAttendant, selectedOutletCode]);

  if (!open) return null;

  function updateSelectedOutlet(outletCode: string) {
    setSelectedOutletCode(outletCode);
    onSelectedOutletCodeChange?.(outletCode);
  }

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
    if (!selectedOutletCode) {
      setError('Please select your pickup outlet.');
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
      outlet_code: selectedOutlet?.outlet_code ?? selectedOutletCode,
      division: selectedOutlet?.division ?? null,
      suggested_outlet_code: suggestedOutlet?.outlet_code ?? selectedOutlet?.outlet_code ?? null,
      subtotal,
      delivery_fee: DELIVERY_FEE,
      total_amount: total,
      payment_method: paymentMethod,
      payment_status: 'PENDING',
      order_status: 'Order Received',
      is_shared_with_outlet: false,
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
      setSelectedOutletCode('');
      setPaymentMethod(formatPaymentMethodValue('mtn', paymentSettings));
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

      updateSharedDemoOrder(localOrder);
      finishOrder(localOrder);
    };

    const { error: insertError } = await supabase
      .from('orders')
      .insert(orderPayload);

    if (insertError) {
      setSubmitting(false);
      // P0001 = a check raised by the order trigger (out of stock, removed
      // product, bad quantity). Its message is written for customers.
      if (insertError.code === 'P0001' && insertError.message) {
        setError(insertError.message);
        return;
      }
      // The browser-only "local guest order" fallback is a dev convenience: in
      // production nothing reads it, so the customer would see a success screen
      // for an order no one ever receives. Surface the failure instead.
      if (import.meta.env.DEV) {
        saveLocalGuestOrder(insertError);
        return;
      }
      console.error('Supabase checkout insert failed.', insertError);
      setError(
        'We could not place your order right now. Please check your connection and try again. Your cart has been kept.',
      );
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
                <span className="text-sm font-semibold text-gray-700">Estimated subtotal</span>
                <span className="text-gray-800">{formatUGX(subtotal)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-700">Delivery Fee</span>
                <span className="text-gray-800">{formatUGX(DELIVERY_FEE)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-700">Estimated total</span>
                <span className="text-lg font-extrabold text-brand-700">{formatUGX(total)}</span>
              </div>
              <p className="text-xs leading-relaxed text-gray-500">
                Market prices change daily. Your attendant sends a final bill after shopping. If it is above
                this estimate or anything is replaced, you approve it before delivery.
              </p>
            </div>
          </div>

          {selectedOutlet && (
            <section className="mt-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Active Attendant
              </p>
              <AttendantProfileCard
                attendant={selectedAttendant}
                attendantError={attendantError}
                loading={attendantLoading}
                outlet={selectedOutlet}
              />
            </section>
          )}

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
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none transition focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-100"
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
                <span className="mb-1 block text-xs font-semibold text-gray-600">Choose Your Outlet</span>
                <select
                  value={selectedOutletCode}
                  onChange={(event) => updateSelectedOutlet(event.target.value)}
                  required
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none transition focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-100"
                >
                  <option value="">Select an outlet</option>
                  {outlets.map((outlet) => (
                    <option key={outlet.outlet_code} value={outlet.outlet_code}>
                      {outlet.hub_market || outlet.name} - {outlet.division}
                    </option>
                  ))}
                </select>
                {selectedOutlet && (
                  <span className="mt-1.5 block text-xs font-medium text-gray-500">
                    Your order will be prepared at this outlet.
                  </span>
                )}
              </label>
              {outletMismatch && (
                <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">
                  This is outside your area's usual outlet - pickup may take slightly longer.
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
              {selectedOutlet && (
                <div className="rounded-xl bg-brand-50 px-3 py-2.5 text-sm">
                  <p className="font-bold text-brand-800">
                    Your order will be handled by {selectedOutlet.hub_market || selectedOutlet.name}.
                  </p>
                  <p className="mt-1 text-xs font-medium text-brand-700">
                    {formatOutletOption(selectedOutlet)}
                  </p>
                  <p className="mt-1 text-xs text-brand-700">
                    Covers: {formatDistributionAreas(selectedOutlet)}
                  </p>
                </div>
              )}
              <div className="flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2.5 text-sm">
                <span className="font-semibold text-gray-700">Delivery Fee</span>
                <span className="font-extrabold text-brand-700">{formatUGX(DELIVERY_FEE)}</span>
              </div>
              <p className="text-xs font-medium text-gray-500">
                Flat rate, all areas. Estimated dispatch: same day, based on outlet availability.
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
              {paymentOptions.map((option) => (
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

          <div className="mt-5">
            <button
              type="submit"
              disabled={submitting || items.length === 0 || !selectedOutletCode}
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-brand-600 px-4 py-3 text-sm font-bold text-white shadow-md transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-gray-300"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Placing order...
                </>
              ) : (
                <>Place Order · est. {formatUGX(total)}</>
              )}
            </button>
            <p className="mt-2 text-center text-[11px] text-gray-400">
              By placing an order you agree to our{' '}
              <a href="/terms" target="_blank" rel="noopener" className="underline hover:text-brand-700">terms</a>{' '}
              and{' '}
              <a href="/privacy" target="_blank" rel="noopener" className="underline hover:text-brand-700">privacy policy</a>.
            </p>
          </div>
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

function buildLocationOptions(outlets: Outlet[]) {
  return outlets.flatMap((outlet) =>
    outlet.distribution_areas.map((area) => ({
      value: `${outlet.outlet_code}:${area}`,
      area,
      outletCode: outlet.outlet_code,
      division: outlet.division,
    })),
  );
}

function buildCheckoutPaymentOptions(settings: PaymentSettings) {
  return [
    {
      label: 'MTN MoMoPay',
      till: `Merchant Till: ${settings.mtnTillNumber}`,
      value: formatPaymentMethodValue('mtn', settings),
    },
    {
      label: settings.airtelLabel,
      till: `Merchant Till: ${settings.airtelTillNumber}`,
      value: formatPaymentMethodValue('airtel', settings),
    },
  ];
}

function formatPaymentMethodValue(provider: 'mtn' | 'airtel', settings: PaymentSettings) {
  return provider === 'mtn'
    ? `MTN MoMoPay - Till ${settings.mtnTillNumber}`
    : `${settings.airtelLabel} - Till ${settings.airtelTillNumber}`;
}

export function OrderConfirmation({
  order,
  onClose,
  viewerUserId = null,
  variant = 'placed',
  guestAccess = null,
}: {
  order: Order;
  onClose: () => void;
  /** Signed-in user's id; lets the owner approve or query the final bill. */
  viewerUserId?: string | null;
  /** 'placed' right after checkout, 'tracking' when reopened from My orders. */
  variant?: 'placed' | 'tracking';
  /** Order code + phone for guests, who cannot read orders directly. */
  guestAccess?: GuestOrderAccess | null;
}) {
  const [currentOrder, setCurrentOrder] = useState(order);
  const [outlets, setOutlets] = useState<Outlet[]>(OFFICIAL_OUTLETS);
  const [attendant, setAttendant] = useState<UserRoleProfile | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const statusDisplay = getStatusDisplay(currentOrder.order_status ?? currentOrder.status);
  const isDemoOrder = currentOrder.id.startsWith(DEMO_ORDER_PREFIX);
  const selectedOutlet =
    findOutletByCode(outlets, currentOrder.outlet_code ?? '') ??
    (currentOrder.outlet_code
      ? {
          outlet_code: currentOrder.outlet_code,
          name: currentOrder.outlet_code,
          hub_market: currentOrder.outlet_code,
          division: currentOrder.division || 'Division to confirm',
          distribution_areas: [],
          is_active: true,
        }
      : null);
  const attendantName = attendant?.full_name || 'Not assigned yet';
  const attendantPhone = attendant?.phone_number?.trim() || 'Not available';

  useEffect(() => {
    setCurrentOrder(order);
  }, [order]);

  useEffect(() => {
    void preloadShopListPdfGenerator();
  }, []);

  useEffect(() => {
    if (isDemoOrder || guestAccess) return;

    let cancelled = false;

    const loadSavedOrder = async () => {
      const [{ data: orderRow, error: orderError }, { data: itemRows, error: itemError }] = await Promise.all([
        supabase
          .from('orders')
          .select('*')
          .eq('id', order.id)
          .maybeSingle(),
        supabase
          .from('order_items')
          .select('id,order_id,product_id,name,price,unit,quantity,created_at')
          .eq('order_id', order.id)
          .order('created_at', { ascending: true }),
      ]);

      if (cancelled) return;

      if (orderError || itemError || !orderRow) {
        console.error('Unable to refresh saved order for PDF download.', orderError ?? itemError);
        return;
      }

      setCurrentOrder({
        ...(orderRow as Order),
        items: itemRows?.length ? (itemRows as OrderItem[]) : order.items,
      });
    };

    void loadSavedOrder();

    return () => {
      cancelled = true;
    };
  }, [guestAccess, isDemoOrder, order]);

  useEffect(() => {
    const loadOutlets = async () => {
      const { data, error: outletError } = await supabase
        .from('outlets')
        .select('*')
        .eq('is_active', true)
        .order('outlet_code');

      setOutlets(!outletError && data?.length ? (data as Outlet[]) : OFFICIAL_OUTLETS);
    };

    void loadOutlets();
  }, []);

  useEffect(() => {
    if (!currentOrder.outlet_code) {
      setAttendant(null);
      return;
    }

    const outletCode = currentOrder.outlet_code;
    let cancelled = false;

    const loadAttendant = async () => {
      const { attendant: profile } = await fetchPublicAttendantForOutlet(outletCode);

      if (!cancelled) setAttendant(profile);
    };

    void loadAttendant();

    return () => {
      cancelled = true;
    };
  }, [currentOrder.outlet_code]);

  // Guests have no realtime access to orders, so poll the tracking RPC.
  useEffect(() => {
    if (isDemoOrder || !guestAccess) return;

    let cancelled = false;
    const refresh = async () => {
      const { order: tracked } = await trackOrder(guestAccess);
      if (!cancelled && tracked) setCurrentOrder(tracked);
    };

    void refresh();
    const intervalId = window.setInterval(() => void refresh(), 20000);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [guestAccess, isDemoOrder]);

  useEffect(() => {
    if (isDemoOrder || guestAccess) return;

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
  }, [guestAccess, isDemoOrder, order.id]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const handleDownloadShopList = async () => {
    setDownloading(true);
    try {
      await generateShopListPDF({
        orderId: currentOrder.id,
        generatedAt: currentOrder.created_at,
        contactName: currentOrder.contact_name,
        contactPhone: currentOrder.phone,
        pickupLocation: currentOrder.market_location || currentOrder.delivery_address,
        outlet: selectedOutlet,
        attendant,
        items: currentOrder.items.map((item) => ({
          name: item.name,
          quantity: item.quantity,
          unit: item.unit,
          price: item.price,
        })),
        subtotal: currentOrder.subtotal,
        deliveryFee: currentOrder.delivery_fee ?? 0,
        totalAmount:
          currentOrder.total_amount ?? (currentOrder.subtotal ?? 0) + (currentOrder.delivery_fee ?? 0),
        paymentMethod: currentOrder.payment_method,
      });
      setToast('Your shop list has been downloaded');
    } catch (downloadError) {
      console.error('Shop list PDF download failed', downloadError);
      setToast('Unable to download the shop list right now');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div className="relative max-h-[92vh] w-full max-w-md overflow-y-auto rounded-3xl bg-white shadow-2xl animate-scale-in">
        {toast && (
          <div className="absolute right-5 top-5 z-10 rounded-xl bg-gray-900 px-4 py-2 text-xs font-semibold text-white shadow-lg">
            {toast}
          </div>
        )}
        <div className="bg-gradient-to-br from-brand-600 to-brand-800 px-6 py-8 text-center text-white">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-white/20 ring-4 ring-white/30">
            <CheckCircle2 className="h-9 w-9 text-brand-200" />
          </div>
          <h2 className="mt-4 text-xl font-extrabold">
            {variant === 'tracking' ? `Order #${currentOrder.id.slice(0, 8).toUpperCase()}` : 'Order Received!'}
          </h2>
          <p className="mt-1 text-sm text-brand-50/90">
            {variant === 'tracking'
              ? `Placed ${new Date(currentOrder.created_at).toLocaleString()}`
              : `Thank you, ${currentOrder.contact_name}. An outlet team will process your order.`}
          </p>
        </div>
        <div className="px-6 py-5">
          {variant === 'placed' && !viewerUserId && (
            <div className="mb-3 rounded-xl border border-gold-200 bg-gold-50 px-3 py-2.5 text-sm text-gold-800">
              <p className="font-bold">
                Your order code: <span className="font-mono tracking-wider">#{getOrderCode(currentOrder.id)}</span>
              </p>
              <p className="mt-0.5 text-xs">
                Save it. Use it with your phone number under Help → Track Order to follow your order and approve the final bill.
              </p>
            </div>
          )}
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
            <Row label="Order code" value={`#${getOrderCode(currentOrder.id)}`} />
            <Row label="Contact" value={currentOrder.contact_name} />
            <Row label="Phone" value={currentOrder.phone} />
            <Row label="Delivery to" value={currentOrder.delivery_address} />
            <Row label="Outlet" value={selectedOutlet ? selectedOutlet.hub_market || selectedOutlet.name : currentOrder.outlet_code || 'To confirm'} />
            <Row label="Attendant" value={attendantName} />
            <Row label="Attendant Phone" value={attendantPhone} />
            <Row label="Payment" value={currentOrder.payment_method || 'Pay on Delivery'} />
            <Row label="Items" value={`${currentOrder.items.length} item(s)`} />
            <div className="flex items-center justify-between border-t border-gray-100 pt-2">
              <span className="text-sm text-gray-500">Estimated subtotal</span>
              <span className="text-gray-800">{formatUGX(currentOrder.subtotal)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Delivery Fee</span>
              <span className="text-gray-800">{formatUGX(currentOrder.delivery_fee ?? 0)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-semibold text-gray-700">Estimated total</span>
              <span className="text-lg font-extrabold text-brand-700">
                {formatUGX(currentOrder.total_amount ?? (currentOrder.subtotal ?? 0) + (currentOrder.delivery_fee ?? 0))}
              </span>
            </div>
          </div>

          <FinalBillPanel
            order={currentOrder}
            canRespond={Boolean(viewerUserId && currentOrder.user_id === viewerUserId)}
            guestAccess={guestAccess}
            onOrderUpdated={setCurrentOrder}
          />

          <button
            onClick={handleDownloadShopList}
            disabled={downloading}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-full border border-brand-200 bg-white py-3 text-sm font-bold text-brand-700 transition hover:bg-brand-50 disabled:cursor-not-allowed disabled:border-gray-200 disabled:text-gray-400"
          >
            {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Download Your Shop List
          </button>
          <button
            onClick={onClose}
            className="mt-3 w-full rounded-full bg-brand-600 py-3 text-sm font-bold text-white transition hover:bg-brand-700"
          >
            {variant === 'tracking' ? 'Close' : 'Continue Shopping'}
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
