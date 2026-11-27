import type { BillStatus, FinalBillItem, Order } from '../types';

/**
 * Final bill helpers.
 *
 * Catalogue prices are estimates. After shopping, the attendant records what
 * each line really cost; that final bill is what the customer pays. The
 * database trigger `orders_compute_final_bill` is the source of truth for
 * totals and auto-approval. `applyFinalBillRules` mirrors it so the UI can
 * preview the outcome, and so local demo orders (dev only) behave the same.
 */

export function getEstimatedTotal(order: Pick<Order, 'total_amount' | 'subtotal' | 'delivery_fee'>) {
  return order.total_amount ?? (order.subtotal ?? 0) + (order.delivery_fee ?? 0);
}

export function getBillStatus(order: Pick<Order, 'bill_status'>): BillStatus {
  return order.bill_status ?? 'not_started';
}

/** Starting point for the attendant's bill editor. */
export function draftFinalBillItems(order: Order): FinalBillItem[] {
  if (order.final_items?.length) {
    return order.final_items.map((item) => ({ ...item }));
  }

  return order.items.map((item) => ({
    product_id: item.product_id,
    name: item.name,
    unit: item.unit,
    quantity: item.quantity,
    estimated_unit_price: item.price,
    status: 'bought',
    actual_line_total: item.price * item.quantity,
    substitute_name: null,
    note: null,
  }));
}

export function summarizeFinalBill(
  order: Pick<Order, 'total_amount' | 'subtotal' | 'delivery_fee'>,
  items: FinalBillItem[],
) {
  const subtotal = items.reduce(
    (sum, item) =>
      item.status === 'unavailable' ? sum : sum + Math.max(0, Math.round(item.actual_line_total || 0)),
    0,
  );
  const deliveryFee = order.delivery_fee ?? 0;
  const total = subtotal + deliveryFee;
  const estimatedTotal = getEstimatedTotal(order);
  const hasSubstitution = items.some((item) => item.status === 'substituted');
  const hasPurchasedLine = items.some((item) => item.status !== 'unavailable');

  return {
    subtotal,
    deliveryFee,
    total,
    estimatedTotal,
    difference: total - estimatedTotal,
    hasSubstitution,
    /** Mirrors the DB rule: within estimate and no swaps means no customer approval needed. */
    autoApproves: hasPurchasedLine && !hasSubstitution && total <= estimatedTotal,
  };
}

/** Problems that must be fixed before a bill can be submitted. */
export function validateFinalBillItems(items: FinalBillItem[]) {
  if (items.length === 0) return 'The bill has no items.';
  if (items.every((item) => item.status === 'unavailable')) {
    return 'Every item is marked unavailable. Call the customer before continuing.';
  }

  for (const item of items) {
    if (item.status === 'unavailable') continue;
    if (!Number.isFinite(item.actual_line_total) || item.actual_line_total <= 0) {
      return `Enter what you paid for ${item.name}.`;
    }
    if (item.status === 'substituted' && !item.substitute_name?.trim()) {
      return `Say what ${item.name} was replaced with.`;
    }
  }

  return null;
}

/**
 * Client-side mirror of the DB trigger, used for local demo orders and for
 * optimistic UI. Live orders are always re-read from the database.
 */
export function applyFinalBillRules(order: Order, patch: Partial<Order>): Order {
  const next: Order = { ...order, ...patch };
  if (!next.final_items?.length) return next;

  const summary = summarizeFinalBill(next, next.final_items);
  next.final_subtotal = summary.subtotal;
  next.final_total = summary.total;

  const submittedNow =
    next.bill_status === 'awaiting_approval' &&
    (order.bill_status !== 'awaiting_approval' || order.final_items !== next.final_items);

  if (submittedNow) {
    if (summary.autoApproves) {
      next.bill_status = 'approved';
      next.bill_approval_method = 'auto_within_estimate';
      next.bill_responded_at = new Date().toISOString();
    } else {
      next.bill_approval_method = null;
      next.bill_responded_at = null;
    }
  }

  return next;
}

/** What the rider/attendant should collect at the door. */
export function getAmountToCollect(order: Order) {
  if (getBillStatus(order) === 'approved' && typeof order.final_total === 'number') {
    return order.final_total;
  }
  return getEstimatedTotal(order);
}

export const BILL_STATUS_META: Record<
  BillStatus,
  { label: string; customerLabel: string; badgeClass: string }
> = {
  not_started: {
    label: 'Bill not started',
    customerLabel: 'Prices shown are estimates. Your attendant will confirm the final bill after shopping.',
    badgeClass: 'bg-gray-100 text-gray-600 ring-gray-200',
  },
  awaiting_approval: {
    label: 'Awaiting customer approval',
    customerLabel: 'Your final bill is ready. Please review and approve it.',
    badgeClass: 'bg-amber-50 text-amber-700 ring-amber-200',
  },
  approved: {
    label: 'Bill approved',
    customerLabel: 'Final bill approved.',
    badgeClass: 'bg-brand-50 text-brand-700 ring-brand-200',
  },
  queried: {
    label: 'Customer queried bill',
    customerLabel: 'You queried this bill. Your attendant will review it and get back to you.',
    badgeClass: 'bg-red-50 text-red-700 ring-red-200',
  },
};

export function describeApprovalMethod(order: Pick<Order, 'bill_approval_method'>) {
  switch (order.bill_approval_method) {
    case 'auto_within_estimate':
      return 'Within the estimate, no approval needed';
    case 'phone_call':
      return 'Approved by the customer on a phone call';
    case 'customer_app':
      return 'Approved by the customer in the app';
    default:
      return null;
  }
}
