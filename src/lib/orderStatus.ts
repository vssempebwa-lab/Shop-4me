import type { Order } from '../types';

export type OrderStatus = 'Order Received' | 'Processing' | 'Transit' | 'Delivered';

export const ORDER_STATUS_FLOW: OrderStatus[] = [
  'Order Received',
  'Processing',
  'Transit',
  'Delivered',
];

const STATUS_META: Record<OrderStatus, {
  label: string;
  clientLabel: string;
  progress: number;
  badgeClass: string;
}> = {
  'Order Received': {
    label: 'Order Received',
    clientLabel: 'Order received by Shop For Me',
    progress: 25,
    badgeClass: 'bg-gray-100 text-gray-700 ring-gray-200',
  },
  Processing: {
    label: 'Processing',
    clientLabel: 'Your order is being processed',
    progress: 50,
    badgeClass: 'bg-amber-50 text-amber-700 ring-amber-200',
  },
  Transit: {
    label: 'Transit',
    clientLabel: 'Your order is on the way',
    progress: 75,
    badgeClass: 'bg-blue-50 text-blue-700 ring-blue-200',
  },
  Delivered: {
    label: 'Delivered',
    clientLabel: 'Order delivered',
    progress: 100,
    badgeClass: 'bg-brand-50 text-brand-700 ring-brand-200',
  },
};

export function normalizeOrderStatus(value?: string | null): OrderStatus {
  if (value === 'Order Received' || value === 'Processing' || value === 'Transit' || value === 'Delivered') {
    return value;
  }

  if (value === 'Assigned to Outlet' || value === 'Assigned to Attendant' || value === 'Packed') {
    return 'Processing';
  }

  if (value === 'Out for Delivery' || value === 'Dispatched to Doorstep') {
    return 'Transit';
  }

  return 'Order Received';
}

export function getStatusDisplay(value?: string | null) {
  const status = normalizeOrderStatus(value);
  return {
    status,
    ...STATUS_META[status],
  };
}

export function getNextOrderStatus(order: Pick<Order, 'order_status' | 'status'>): OrderStatus | null {
  const status = normalizeOrderStatus(order.order_status ?? order.status);
  const currentIndex = ORDER_STATUS_FLOW.indexOf(status);
  return ORDER_STATUS_FLOW[currentIndex + 1] ?? null;
}
