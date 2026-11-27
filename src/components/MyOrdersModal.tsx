import { useEffect, useState } from 'react';
import { ChevronRight, Loader2, Package, Receipt, X } from 'lucide-react';
import type { Order, OrderItem } from '../types';
import { supabase } from '../lib/supabase';
import { formatUGX } from '../lib/format';
import { getStatusDisplay } from '../lib/orderStatus';
import { BILL_STATUS_META, getBillStatus, getEstimatedTotal } from '../lib/finalBill';

interface MyOrdersModalProps {
  userId: string;
  onClose: () => void;
  onSelect: (order: Order) => void;
}

/** Signed-in customer's order history, with bills that need approval first. */
export default function MyOrdersModal({ userId, onClose, onSelect }: MyOrdersModalProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      const { data, error: loadError } = await supabase
        .from('orders')
        .select('*, order_items(*)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (cancelled) return;
      setLoading(false);

      if (loadError) {
        setError('We could not load your orders. Please try again.');
        return;
      }

      const rows = ((data as Array<Record<string, unknown>>) ?? []).map((row) => {
        const joined = Array.isArray(row.order_items) ? (row.order_items as OrderItem[]) : [];
        const json = Array.isArray(row.items) ? (row.items as OrderItem[]) : [];
        return { ...(row as unknown as Order), items: joined.length ? joined : json };
      });

      // Bills waiting on the customer float to the top.
      rows.sort((a, b) => {
        const aWaiting = getBillStatus(a) === 'awaiting_approval' ? 0 : 1;
        const bWaiting = getBillStatus(b) === 'awaiting_approval' ? 0 : 1;
        return aWaiting - bWaiting;
      });
      setOrders(rows);
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return (
    <div className="fixed inset-0 z-[65] flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex max-h-[88vh] w-full max-w-md flex-col rounded-t-3xl bg-white shadow-2xl animate-slide-up sm:rounded-3xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h2 className="text-base font-extrabold text-gray-800">My orders</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {loading ? (
            <div className="py-12 text-center text-sm text-gray-400">
              <Loader2 className="mx-auto h-6 w-6 animate-spin" />
            </div>
          ) : error ? (
            <p className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>
          ) : orders.length === 0 ? (
            <div className="py-12 text-center">
              <Package className="mx-auto h-8 w-8 text-gray-300" />
              <p className="mt-2 text-sm font-bold text-gray-600">No orders yet</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {orders.map((order) => {
                const billStatus = getBillStatus(order);
                const needsApproval = billStatus === 'awaiting_approval';
                const amount =
                  billStatus === 'approved' && typeof order.final_total === 'number'
                    ? order.final_total
                    : getEstimatedTotal(order);

                return (
                  <li key={order.id}>
                    <button
                      type="button"
                      onClick={() => onSelect(order)}
                      className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition hover:bg-gray-50 ${
                        needsApproval ? 'border-amber-200 bg-amber-50/50' : 'border-gray-100'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-bold text-gray-800">#{order.id.slice(0, 8).toUpperCase()}</p>
                          <p className="text-sm font-extrabold text-brand-700">{formatUGX(amount)}</p>
                        </div>
                        <p className="text-xs text-gray-500">
                          {new Date(order.created_at).toLocaleDateString()} · {order.items.length} item(s) ·{' '}
                          {getStatusDisplay(order.order_status ?? order.status).label}
                        </p>
                        {billStatus !== 'not_started' && (
                          <span
                            className={`mt-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ring-1 ${BILL_STATUS_META[billStatus].badgeClass}`}
                          >
                            <Receipt className="h-3 w-3" />
                            {needsApproval ? 'Approve your final bill' : BILL_STATUS_META[billStatus].label}
                          </span>
                        )}
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-gray-300" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
