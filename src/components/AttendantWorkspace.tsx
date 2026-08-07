import { useEffect, useMemo, useState } from 'react';
import {
  Bike,
  ClipboardList,
  Clock,
  Loader2,
  MapPin,
  Phone,
  Truck,
  User,
  LogOut,
} from 'lucide-react';
import type { Outlet, OutletRider, Order, UserRoleProfile } from '../types';
import { supabase } from '../lib/supabase';
import {
  findOutletByCode,
  formatOutletOption,
  formatDistributionAreas,
  OFFICIAL_OUTLETS,
} from '../lib/outlets';
import { DEMO_ORDER_PREFIX, readDemoOrders, updateDemoOrder } from '../lib/demoOrders';
import { formatUGX } from '../lib/format';
import {
  getNextOrderStatus,
  getStatusDisplay,
  normalizeOrderStatus,
  ORDER_STATUS_FLOW,
  type OrderStatus,
} from '../lib/orderStatus';
import UserAvatar from './UserAvatar';

const STALE_MINUTES: Partial<Record<OrderStatus, number>> = {
  'Order Received': 20,
  Processing: 30,
  Transit: 60,
};

interface AttendantWorkspaceProps {
  profile: UserRoleProfile | null;
  sessionStartedAt?: string | null;
  onLogout: () => Promise<void>;
  onRedirectToAdmin: () => void;
  onRedirectToStorefront: () => void;
}

export default function AttendantWorkspace({
  profile,
  sessionStartedAt,
  onLogout,
  onRedirectToAdmin,
  onRedirectToStorefront,
}: AttendantWorkspaceProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [outlets, setOutlets] = useState<Outlet[]>(OFFICIAL_OUTLETS);
  const [riders, setRiders] = useState<OutletRider[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [dispatchOrder, setDispatchOrder] = useState<Order | null>(null);
  const [paymentOrder, setPaymentOrder] = useState<Order | null>(null);
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const assignedOutlet = profile?.assigned_outlet ?? '';
  const attendantName = profile?.full_name || profile?.email || 'Market Attendant';
  const attendantUserId = profile?.user_id ?? null;
  const profileUser: UserRoleProfile = profile ?? {
    user_id: 'attendant-session',
    full_name: attendantName,
    email: null,
    avatar_url: null,
    role: 'attendant',
  };
  const outlet = findOutletByCode(outlets, assignedOutlet);
  const outletRiders = useMemo(
    () => riders.filter((rider) => rider.outlet_code === assignedOutlet),
    [assignedOutlet, riders],
  );

  useEffect(() => {
    if (!profile) return;

    if (profile.role === 'admin' || profile.role === 'merchant') {
      onRedirectToAdmin();
      return;
    }

    if (profile.role !== 'attendant') {
      onRedirectToStorefront();
    }
  }, [onRedirectToAdmin, onRedirectToStorefront, profile]);

  useEffect(() => {
    void loadWorkspaceData();
  }, [assignedOutlet]);

  useEffect(() => {
    if (!assignedOutlet) return;

    const channel = supabase
      .channel(`attendant-orders-${assignedOutlet || 'unassigned'}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `outlet_code=eq.${assignedOutlet}`,
        },
        () => {
          void loadOrders();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [assignedOutlet]);

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 3200);
  };

  const writeActivityLog = async (
    action: string,
    order: Order,
    metadata: Record<string, unknown> = {},
  ) => {
    await supabase.from('admin_audit_logs').insert({
      actor_user_id: attendantUserId,
      action,
      target_type: 'order',
      target_id: order.id,
      metadata: {
        ...metadata,
        attendant_user_id: attendantUserId,
        attendant_name: attendantName,
        outlet_code: assignedOutlet,
      },
    });
  };

  const loadWorkspaceData = async () => {
    setLoading(true);
    await Promise.all([loadOutlets(), loadRiders(), loadOrders()]);
    setLoading(false);
  };

  const loadOutlets = async () => {
    const { data, error } = await supabase
      .from('outlets')
      .select('*')
      .eq('is_active', true)
      .order('outlet_code');

    if (!error && data?.length) {
      setOutlets(data as Outlet[]);
    } else {
      setOutlets(OFFICIAL_OUTLETS);
    }
  };

  const loadRiders = async () => {
    if (!assignedOutlet) {
      setRiders([]);
      return;
    }

    const { data, error } = await supabase
      .from('outlet_riders')
      .select('*')
      .eq('outlet_code', assignedOutlet)
      .eq('is_active', true)
      .order('name');

    if (!error) {
      setRiders((data as OutletRider[]) ?? []);
    }
  };

  const loadOrders = async () => {
    if (!assignedOutlet) {
      setOrders([]);
      return;
    }

    const { data, error } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .eq('outlet_code', assignedOutlet)
      .eq('is_shared_with_outlet', true)
      .order('created_at', { ascending: false });

    if (error) {
      setOrders(getDemoOrdersForOutlet(assignedOutlet));
      return;
    }

    const liveOrders = ((data as Array<Record<string, unknown>>) ?? []).map(normalizeOrder);
    const demoOrders = getDemoOrdersForOutlet(assignedOutlet);
    const liveIds = new Set(liveOrders.map((order) => order.id));
    const localOnlyOrders = demoOrders.filter((order) => !liveIds.has(order.id));

    setOrders([...localOnlyOrders, ...liveOrders]);
  };

  const changeOutletOrderStatus = async (order: Order, nextState: OrderStatus) => {
    setUpdatingOrderId(order.id);

    const patch: Partial<Order> = {
      order_status: nextState,
      status: nextState,
      handled_by_attendant_id: attendantUserId,
      handled_by_attendant_name: attendantName,
    };

    if (nextState === 'Delivered') {
      patch.payment_status = 'PAID';
      patch.delivered_at = new Date().toISOString();
    }

    if (order.id.startsWith(DEMO_ORDER_PREFIX)) {
      const updatedOrder = { ...order, ...patch };
      updateDemoOrder(updatedOrder);
      setOrders((current) =>
        current.map((item) => (item.id === order.id ? updatedOrder : item)),
      );
      setUpdatingOrderId(null);
      showToast(`Order updated to ${getStatusDisplay(nextState).label}.`);
      return;
    }

    const { error } = await supabase.from('orders').update(patch).eq('id', order.id);
    setUpdatingOrderId(null);

    if (error) {
      showToast(error.message || 'Could not update order status.');
      return;
    }

    setOrders((current) =>
      current.map((item) => (item.id === order.id ? { ...item, ...patch } : item)),
    );
    await writeActivityLog('attendant_order_status_changed', order, {
      from: normalizeOrderStatus(order.order_status ?? order.status),
      to: nextState,
      payment_status: patch.payment_status ?? order.payment_status ?? 'PENDING',
    });
    showToast(`Order updated to ${getStatusDisplay(nextState).label}.`);
  };

  const dispatchRider = async (order: Order, rider: OutletRider) => {
    setUpdatingOrderId(order.id);

    const patch: Partial<Order> = {
      dispatched_rider_id: rider.id,
      dispatched_rider_name: rider.name,
      dispatched_at: new Date().toISOString(),
      order_status: 'Transit',
      status: 'Transit',
      handled_by_attendant_id: attendantUserId,
      handled_by_attendant_name: attendantName,
    };

    if (order.id.startsWith(DEMO_ORDER_PREFIX)) {
      const updatedOrder = { ...order, ...patch };
      updateDemoOrder(updatedOrder);
      setDispatchOrder(null);
      setOrders((current) =>
        current.map((item) => (item.id === order.id ? updatedOrder : item)),
      );
      setUpdatingOrderId(null);
      showToast(`${rider.name} dispatched. Order is now in transit.`);
      return;
    }

    const { error } = await supabase.from('orders').update(patch).eq('id', order.id);
    setUpdatingOrderId(null);

    if (error) {
      showToast(error.message || 'Could not dispatch rider.');
      return;
    }

    setDispatchOrder(null);
    setOrders((current) =>
      current.map((item) => (item.id === order.id ? { ...item, ...patch } : item)),
    );
    await writeActivityLog('attendant_rider_dispatched', order, {
      rider_id: rider.id,
      rider_name: rider.name,
      to: 'Transit',
    });
    showToast(`${rider.name} dispatched. Order is now in transit.`);
  };

  const requestAdvance = (order: Order) => {
    const nextState = getNextOrderStatus(order);
    if (!nextState) return;

    if (nextState === 'Delivered') {
      setPaymentConfirmed(false);
      setPaymentOrder(order);
      return;
    }

    void changeOutletOrderStatus(order, nextState);
  };

  if (!profile || profile.role !== 'attendant') {
    return (
      <section className="mx-auto max-w-4xl px-4 py-12">
        <EmptyState
          icon={<ClipboardList className="h-8 w-8" />}
          title="Attendant access required"
          text="Sign in with a Market Attendant account to view a localized outlet queue."
        />
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-brand-800">Market Attendant Workspace</h2>
          <p className="text-sm text-gray-500">Process routed orders from your assigned hub.</p>
        </div>
        {outlet ? (
          <div className="min-w-[280px] rounded-2xl border border-brand-100 bg-white px-4 py-3 shadow-sm">
            <div className="flex items-start gap-3">
              <UserAvatar user={profileUser} size="md" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-extrabold text-brand-800">
                  {outlet.hub_market || outlet.name} - {outlet.outlet_code}
                </p>
                <p className="text-xs font-medium text-brand-700">{outlet.division}</p>
                <p className="mt-2 text-xs font-semibold text-gray-700">
                  Attendant: {attendantName}
                </p>
                <p className="text-[11px] font-medium text-gray-500">
                  Session: {formatSessionTime(sessionStartedAt)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void onLogout()}
                className="inline-flex shrink-0 items-center gap-2 rounded-full border border-red-100 bg-red-50 px-3 py-2 text-xs font-extrabold text-red-600 transition hover:border-red-200 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-200 focus:ring-offset-2"
              >
                <LogOut className="h-4 w-4" />
                Logout
              </button>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            Invalid assigned outlet: {assignedOutlet || 'Not assigned'}
          </div>
        )}
      </div>

      {outlet && (
        <p className="mt-3 rounded-2xl border border-gray-100 bg-white px-4 py-3 text-xs font-medium text-gray-500 shadow-sm">
          Distribution range: {formatDistributionAreas(outlet)}
        </p>
      )}

      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SummaryCard label="Queue" value={String(orders.length)} />
        <SummaryCard
          label="Processing"
          value={String(orders.filter((order) => order.order_status === 'Processing').length)}
        />
        <SummaryCard
          label="In Transit"
          value={String(orders.filter((order) => order.order_status === 'Transit').length)}
        />
      </div>

      {loading ? (
        <div className="py-12 text-center text-sm text-gray-400">
          <Loader2 className="mx-auto h-6 w-6 animate-spin" />
          <p className="mt-2">Loading outlet queue...</p>
        </div>
      ) : orders.length === 0 ? (
        <EmptyState
          icon={<Truck className="h-8 w-8" />}
          title="No orders in your queue right now"
          text="Orders routed to this outlet will appear here automatically."
        />
      ) : (
        <div className="mt-5 space-y-4">
          {orders.map((order) => (
            <OrderQueueCard
              key={order.id}
              order={order}
              outlet={outlet}
              loading={updatingOrderId === order.id}
              onAdvance={() => requestAdvance(order)}
              onDispatch={() => setDispatchOrder(order)}
            />
          ))}
        </div>
      )}

      {dispatchOrder && (
        <RiderDispatchPanel
          order={dispatchOrder}
          riders={outletRiders}
          loading={updatingOrderId === dispatchOrder.id}
          onClose={() => setDispatchOrder(null)}
          onDispatch={(rider) => void dispatchRider(dispatchOrder, rider)}
        />
      )}

      {paymentOrder && (
        <PaymentConfirmationModal
          order={paymentOrder}
          confirmed={paymentConfirmed}
          loading={updatingOrderId === paymentOrder.id}
          onConfirmedChange={setPaymentConfirmed}
          onClose={() => setPaymentOrder(null)}
          onSubmit={() => {
            void changeOutletOrderStatus(paymentOrder, 'Delivered');
            setPaymentOrder(null);
          }}
        />
      )}

      {toast && <Toast message={toast} />}
    </section>
  );
}

function OrderQueueCard({
  order,
  outlet,
  loading,
  onAdvance,
  onDispatch,
}: {
  order: Order;
  outlet: Outlet | null;
  loading: boolean;
  onAdvance: () => void;
  onDispatch: () => void;
}) {
  const status = normalizeOrderStatus(order.order_status ?? order.status);
  const statusDisplay = getStatusDisplay(status);
  const nextStatus = getNextOrderStatus(order);
  const stale = isOrderStale(order, status);
  const total = (order.subtotal ?? 0) + (order.delivery_fee ?? 0);
  const routedBy = order.shared_by_admin_name || 'Admin';

  return (
    <article className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-extrabold text-gray-800">
            #{order.id.slice(0, 8).toUpperCase()}
          </p>
          <p className="text-xs text-gray-400">{new Date(order.created_at).toLocaleString()}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {stale && (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-xs font-bold text-red-600">
              <Clock className="h-3.5 w-3.5" />
              Needs attention
            </span>
          )}
          <span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-bold text-brand-700">
            {statusDisplay.label}
          </span>
          {order.manual_outlet_override && (
            <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700">
              Manually assigned
            </span>
          )}
        </div>
      </div>

      {order.shared_at && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-gold-100 bg-gold-50 px-3 py-2 text-xs font-semibold text-gold-800">
          <span>Routed by {routedBy}</span>
          <span className="text-gold-600">-</span>
          <span>{formatRelativeTime(order.shared_at)}</span>
        </div>
      )}

      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
        <InfoLine icon={<User className="h-3.5 w-3.5" />} text={order.contact_name} />
        <InfoLine icon={<Phone className="h-3.5 w-3.5" />} text={order.phone} />
        <InfoLine
          icon={<MapPin className="h-3.5 w-3.5" />}
          text={outlet ? formatOutletOption(outlet) : order.outlet_code || 'Pickup station'}
        />
      </div>

      <div className="mt-4 rounded-xl bg-gray-50 p-3">
        <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Items</p>
        <div className="mt-2 space-y-1">
          {order.items.map((item, index) => (
            <div key={item.id ?? `${order.id}-${index}`} className="flex justify-between gap-3 text-xs">
              <span className="text-gray-700">
                {item.name} ({item.unit}) x {item.quantity}
              </span>
              <span className="font-semibold text-gray-800">
                {formatUGX(item.price * item.quantity)}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-2 flex justify-between border-t border-gray-200 pt-2 text-sm">
          <span className="font-semibold text-gray-700">Total</span>
          <span className="font-extrabold text-brand-700">{formatUGX(total)}</span>
        </div>
      </div>

      <StatusStepper status={status} />

      {order.dispatched_rider_name && (
        <p className="mt-3 text-xs font-semibold text-gray-500">
          Rider assigned: {order.dispatched_rider_name}
        </p>
      )}

      <div className="mt-4 flex flex-wrap justify-end gap-2">
        {status === 'Processing' && (
          <button
            type="button"
            onClick={onDispatch}
            className="inline-flex items-center gap-2 rounded-full border border-gold-200 bg-gold-50 px-4 py-2 text-sm font-bold text-gold-700 transition hover:bg-gold-100"
          >
            <Bike className="h-4 w-4" />
            Call Rider
          </button>
        )}
        {nextStatus && (
          <button
            type="button"
            onClick={onAdvance}
            disabled={loading}
            className="inline-flex min-w-40 items-center justify-center gap-2 rounded-full bg-brand-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-brand-700 disabled:bg-gray-300"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {getAdvanceLabel(nextStatus)}
          </button>
        )}
      </div>
    </article>
  );
}

function StatusStepper({ status }: { status: OrderStatus }) {
  const currentIndex = ORDER_STATUS_FLOW.indexOf(status);

  return (
    <div className="mt-4 grid grid-cols-4 gap-2">
      {ORDER_STATUS_FLOW.map((step, index) => {
        const complete = index <= currentIndex;
        return (
          <div key={step} className="min-w-0">
            <div
              className={`h-1.5 rounded-full ${complete ? 'bg-brand-600' : 'bg-gray-200'}`}
            />
            <p
              className={`mt-1 truncate text-[11px] font-bold ${
                complete ? 'text-brand-700' : 'text-gray-400'
              }`}
            >
              {getStatusDisplay(step).label}
            </p>
          </div>
        );
      })}
    </div>
  );
}

function RiderDispatchPanel({
  order,
  riders,
  loading,
  onClose,
  onDispatch,
}: {
  order: Order;
  riders: OutletRider[];
  loading: boolean;
  onClose: () => void;
  onDispatch: (rider: OutletRider) => void;
}) {
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={loading ? undefined : onClose} />
      <div className="relative w-full max-w-md rounded-t-3xl bg-white p-5 shadow-2xl animate-slide-up sm:rounded-3xl">
        <h3 className="text-base font-extrabold text-gray-800">Call Rider</h3>
        <p className="mt-1 text-sm text-gray-500">
          Assign a rider for #{order.id.slice(0, 8).toUpperCase()}.
        </p>
        <div className="mt-4 space-y-2">
          {riders.length === 0 ? (
            <p className="rounded-xl bg-gray-50 p-3 text-sm text-gray-500">
              No active Boda-boda riders are registered for this outlet yet.
            </p>
          ) : (
            riders.map((rider) => (
              <div
                key={rider.id}
                className="flex items-center justify-between gap-3 rounded-2xl border border-gray-100 p-3"
              >
                <div>
                  <p className="font-bold text-gray-800">{rider.name}</p>
                  <a href={`tel:${rider.phone}`} className="text-sm font-semibold text-brand-700">
                    {rider.phone}
                  </a>
                </div>
                <button
                  type="button"
                  onClick={() => onDispatch(rider)}
                  disabled={loading}
                  className="inline-flex items-center gap-2 rounded-full bg-gold-500 px-3 py-1.5 text-xs font-bold text-white disabled:bg-gray-300 disabled:text-gray-600"
                >
                  {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Dispatch
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function PaymentConfirmationModal({
  order,
  confirmed,
  loading,
  onConfirmedChange,
  onClose,
  onSubmit,
}: {
  order: Order;
  confirmed: boolean;
  loading: boolean;
  onConfirmedChange: (confirmed: boolean) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={loading ? undefined : onClose} />
      <div className="relative w-full max-w-md rounded-t-3xl bg-white p-5 shadow-2xl animate-slide-up sm:rounded-3xl">
        <h3 className="text-base font-extrabold text-gray-800">Confirm Delivery Payment</h3>
        <p className="mt-1 text-sm text-gray-500">
          Before closing #{order.id.slice(0, 8).toUpperCase()}, confirm the client paid at doorstep.
        </p>
        <label className="mt-4 flex items-start gap-2 rounded-2xl bg-gray-50 p-3 text-sm font-semibold text-gray-700">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(event) => onConfirmedChange(event.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
          />
          Confirm client paid via MoMo/Airtel at doorstep.
        </label>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-full border border-gray-200 px-4 py-2 text-sm font-bold text-gray-700"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={!confirmed || loading}
            className="inline-flex items-center gap-2 rounded-full bg-brand-600 px-4 py-2 text-sm font-bold text-white disabled:bg-gray-300"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Confirm Delivered &amp; Paid
          </button>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-extrabold text-brand-800">{value}</p>
    </div>
  );
}

function InfoLine({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-1.5 text-xs text-gray-600">
      <span className="text-gray-400">{icon}</span>
      <span className="truncate">{text}</span>
    </div>
  );
}

function EmptyState({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="mt-5 rounded-2xl border border-dashed border-gray-200 bg-white py-12 text-center">
      <div className="mx-auto grid h-12 w-12 place-items-center text-gray-300">{icon}</div>
      <p className="mt-2 text-sm font-bold text-gray-600">{title}</p>
      <p className="text-xs text-gray-400">{text}</p>
    </div>
  );
}

function Toast({ message }: { message: string }) {
  return (
    <div className="fixed bottom-4 right-4 z-[80] max-w-sm animate-slide-in-right px-4 sm:px-0">
      <div className="rounded-2xl border border-brand-100 bg-white px-4 py-3 text-sm font-semibold text-brand-800 shadow-xl">
        {message}
      </div>
    </div>
  );
}

function getAdvanceLabel(nextStatus: OrderStatus) {
  if (nextStatus === 'Processing') return 'Start Processing';
  if (nextStatus === 'Transit') return 'Mark In Transit';
  if (nextStatus === 'Delivered') return 'Confirm Delivered & Paid';
  return `Mark ${getStatusDisplay(nextStatus).label}`;
}

function isOrderStale(order: Order, status: OrderStatus) {
  const threshold = STALE_MINUTES[status];
  if (!threshold) return false;

  const minutesOld = (Date.now() - new Date(order.created_at).getTime()) / 60000;
  return minutesOld >= threshold;
}


function formatSessionTime(value?: string | null) {
  if (!value) return 'Started now';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Started now';
  return `Started ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

function formatRelativeTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Shared recently';

  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.max(0, Math.round(diffMs / 60000));

  if (diffMinutes < 1) return 'Shared just now';
  if (diffMinutes < 60) return `Shared ${diffMinutes} min${diffMinutes === 1 ? '' : 's'} ago`;

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `Shared ${diffHours} hr${diffHours === 1 ? '' : 's'} ago`;

  return `Shared ${date.toLocaleDateString()} ${date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}

function normalizeOrder(order: Record<string, unknown>): Order {
  const joinedItems = Array.isArray(order.order_items)
    ? (order.order_items as Order['items'])
    : [];
  const jsonItems = Array.isArray(order.items)
    ? (order.items as Order['items'])
    : [];

  return {
    ...(order as unknown as Order),
    items: joinedItems.length ? joinedItems : jsonItems,
    order_status: normalizeOrderStatus((order.order_status ?? order.status) as string),
    payment_status: (order.payment_status as Order['payment_status']) ?? 'PENDING',
    is_shared_with_outlet: Boolean(order.is_shared_with_outlet),
  };
}

function getDemoOrdersForOutlet(assignedOutlet: string) {
  return readDemoOrders()
    .map((order) => normalizeOrder(order as unknown as Record<string, unknown>))
    .filter(
      (order) =>
        order.outlet_code === assignedOutlet &&
        order.is_shared_with_outlet === true,
    );
}
