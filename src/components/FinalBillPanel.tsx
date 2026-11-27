import { useState } from 'react';
import { CheckCircle2, Loader2, Receipt } from 'lucide-react';
import type { Order } from '../types';
import { supabase } from '../lib/supabase';
import { formatUGX } from '../lib/format';
import { DEMO_ORDER_PREFIX, updateSharedDemoOrder } from '../lib/demoOrders';
import {
  BILL_STATUS_META,
  describeApprovalMethod,
  getBillStatus,
  getEstimatedTotal,
} from '../lib/finalBill';
import { respondToBillWithCode, type GuestOrderAccess } from '../lib/orderTracking';

interface FinalBillPanelProps {
  order: Order;
  /** True when the signed-in viewer owns this order and may approve it. */
  canRespond: boolean;
  /** Guests respond with their order code + phone instead of a session. */
  guestAccess?: GuestOrderAccess | null;
  onOrderUpdated: (order: Order) => void;
}

/** Customer-facing view of the final bill, with approve / query actions. */
export default function FinalBillPanel({
  order,
  canRespond: signedInCanRespond,
  guestAccess = null,
  onOrderUpdated,
}: FinalBillPanelProps) {
  const [querying, setQuerying] = useState(false);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const billStatus = getBillStatus(order);
  const meta = BILL_STATUS_META[billStatus];
  const estimatedTotal = getEstimatedTotal(order);
  const hasBill = Boolean(order.final_items?.length) && typeof order.final_total === 'number';
  const isDemoOrder = order.id.startsWith(DEMO_ORDER_PREFIX);
  const canRespond = signedInCanRespond || Boolean(guestAccess);

  const respond = async (approve: boolean) => {
    setError(null);
    if (!approve && !note.trim()) {
      setError('Tell the attendant what is wrong with the bill.');
      return;
    }

    setSubmitting(true);

    if (isDemoOrder) {
      const updated: Order = {
        ...order,
        bill_status: approve ? 'approved' : 'queried',
        bill_approval_method: approve ? 'customer_app' : null,
        bill_responded_at: new Date().toISOString(),
        bill_customer_note: approve ? null : note.trim(),
      };
      await updateSharedDemoOrder(updated);
      setSubmitting(false);
      setQuerying(false);
      onOrderUpdated(updated);
      return;
    }

    if (guestAccess) {
      const result = await respondToBillWithCode(guestAccess, approve, approve ? null : note.trim());
      setSubmitting(false);
      if (!result.order) {
        setError(result.error);
        return;
      }
      setQuerying(false);
      setNote('');
      onOrderUpdated(result.order);
      return;
    }

    const { data, error: rpcError } = await supabase.rpc('respond_to_final_bill', {
      p_order_id: order.id,
      p_approve: approve,
      p_note: approve ? null : note.trim(),
    });
    setSubmitting(false);

    if (rpcError || !data) {
      setError(rpcError?.message || 'Could not send your response. Please try again.');
      return;
    }

    setQuerying(false);
    setNote('');
    onOrderUpdated({ ...order, ...(data as Partial<Order>), items: order.items });
  };

  return (
    <div className="mt-3 rounded-2xl border border-gray-100 p-3">
      <div className={`flex items-start gap-2 rounded-xl px-3 py-2 text-xs font-semibold ring-1 ${meta.badgeClass}`}>
        <Receipt className="mt-0.5 h-4 w-4 shrink-0" />
        <span>{meta.customerLabel}</span>
      </div>

      {hasBill && (
        <div className="mt-3 space-y-1.5 text-sm">
          {order.final_items!.map((item, index) => (
            <div key={`${item.product_id}-${index}`} className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className={item.status === 'unavailable' ? 'text-gray-400 line-through' : 'text-gray-700'}>
                  {item.name} × {item.quantity}
                </p>
                {item.status === 'substituted' && item.substitute_name && (
                  <p className="text-xs font-semibold text-amber-700">Replaced with {item.substitute_name}</p>
                )}
                {item.status === 'unavailable' && (
                  <p className="text-xs font-semibold text-gray-500">Not available, not charged</p>
                )}
                {item.note && <p className="text-xs text-gray-500">{item.note}</p>}
              </div>
              <span className="shrink-0 font-semibold text-gray-800">
                {item.status === 'unavailable' ? '—' : formatUGX(item.actual_line_total)}
              </span>
            </div>
          ))}
          <div className="flex items-center justify-between border-t border-gray-100 pt-1.5">
            <span className="text-gray-500">Delivery fee</span>
            <span className="text-gray-800">{formatUGX(order.delivery_fee ?? 0)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-400">Your estimate was</span>
            <span className="text-gray-400">{formatUGX(estimatedTotal)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-bold text-gray-800">Final bill</span>
            <span className="text-lg font-extrabold text-brand-700">{formatUGX(order.final_total!)}</span>
          </div>
          {(order.bill_photos?.length ?? 0) > 0 && (
            <div className="pt-1">
              <p className="mb-1.5 text-xs font-semibold text-gray-500">Photos from your attendant</p>
              <div className="flex flex-wrap gap-2">
                {order.bill_photos!.map((url) => (
                  <a
                    key={url}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block h-16 w-16 overflow-hidden rounded-xl border border-gray-200 bg-gray-50"
                  >
                    <img src={url} alt="Goods or market receipt" loading="lazy" className="h-full w-full object-cover" />
                  </a>
                ))}
              </div>
            </div>
          )}
          {billStatus === 'approved' && describeApprovalMethod(order) && (
            <p className="flex items-center gap-1.5 text-xs font-semibold text-brand-700">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {describeApprovalMethod(order)}
            </p>
          )}
        </div>
      )}

      {hasBill && billStatus === 'awaiting_approval' && (
        canRespond ? (
          <div className="mt-3">
            {querying ? (
              <div className="space-y-2">
                <textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  rows={3}
                  maxLength={500}
                  placeholder="What is wrong? e.g. I don't want the replacement onions."
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setQuerying(false)}
                    disabled={submitting}
                    className="flex-1 rounded-full border border-gray-200 py-2.5 text-sm font-bold text-gray-700"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={() => void respond(false)}
                    disabled={submitting}
                    className="flex flex-1 items-center justify-center gap-2 rounded-full bg-red-600 py-2.5 text-sm font-bold text-white disabled:bg-gray-300"
                  >
                    {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                    Send query
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setQuerying(true)}
                  disabled={submitting}
                  className="flex-1 rounded-full border border-gray-200 py-2.5 text-sm font-bold text-gray-700 transition hover:bg-gray-50"
                >
                  Something's wrong
                </button>
                <button
                  type="button"
                  onClick={() => void respond(true)}
                  disabled={submitting}
                  className="flex flex-1 items-center justify-center gap-2 rounded-full bg-brand-600 py-2.5 text-sm font-bold text-white transition hover:bg-brand-700 disabled:bg-gray-300"
                >
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  Approve {formatUGX(order.final_total!)}
                </button>
              </div>
            )}
          </div>
        ) : (
          <p className="mt-3 text-xs font-medium text-gray-500">
            Your attendant will call you to confirm this bill before delivery.
          </p>
        )
      )}

      {error && <p className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">{error}</p>}
    </div>
  );
}
