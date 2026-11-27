import type { Order } from '../types';

export const DEMO_ORDER_PREFIX = 'demo-order-';
const LOCAL_DEMO_ORDERS_KEY = 'sfm-demo-orders';
const SHARED_DEMO_ORDERS_ENDPOINT = '/local-api/demo-orders';

const DEMO_PENDING_ORDERS: Order[] = [
  {
    id: 'demo-order-kawempe',
    contact_name: 'Nabweteme Sarah',
    phone: '+256701234567',
    delivery_address: 'Kawempe, near Kalerwe stage',
    market_location: 'Kawempe',
    items: [
      { product_id: 'demo-tomatoes', name: 'Tomatoes', price: 8000, unit: 'Per basket', quantity: 3 },
      { product_id: 'demo-onions', name: 'Onions', price: 6000, unit: 'Per kg', quantity: 3 },
    ],
    subtotal: 42000,
    delivery_fee: 5000,
    status: 'Order Received',
    order_status: 'Order Received',
    payment_status: 'PENDING',
    is_shared_with_outlet: false,
    outlet_code: null,
    division: 'Kawempe Division',
    created_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
  },
  {
    id: 'demo-order-nakawa',
    contact_name: 'Mugisha Daniel',
    phone: '+256772345678',
    delivery_address: 'Ntinda, opposite Capital Shoppers',
    market_location: 'Ntinda',
    items: [
      { product_id: 'demo-matooke', name: 'Matooke', price: 20000, unit: 'Per bunch', quantity: 2 },
      { product_id: 'demo-rice', name: 'Rice', price: 12000, unit: 'Per kg', quantity: 2 },
      { product_id: 'demo-onions-small', name: 'Onions', price: 4000, unit: 'Small bundle', quantity: 1 },
    ],
    subtotal: 68000,
    delivery_fee: 5000,
    status: 'Order Received',
    order_status: 'Order Received',
    payment_status: 'PENDING',
    is_shared_with_outlet: false,
    outlet_code: null,
    division: 'Nakawa Division',
    created_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'demo-order-central',
    contact_name: 'Achieng Grace',
    phone: '+256753456789',
    delivery_address: 'Nakasero, Parliamentary Avenue',
    market_location: 'Nakasero',
    items: [
      { product_id: 'demo-rice-bulk', name: 'Rice', price: 12000, unit: 'Per kg', quantity: 5 },
      { product_id: 'demo-charcoal', name: 'Charcoal', price: 15000, unit: 'Per sack', quantity: 2 },
      { product_id: 'demo-tomatoes-small', name: 'Tomatoes', price: 5000, unit: 'Small basket', quantity: 1 },
    ],
    subtotal: 95000,
    delivery_fee: 5000,
    status: 'Order Received',
    order_status: 'Order Received',
    payment_status: 'PENDING',
    is_shared_with_outlet: false,
    outlet_code: null,
    division: 'Kampala Central',
    created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'demo-order-makindye',
    contact_name: 'Kato Brian',
    phone: '+256784567890',
    delivery_address: 'Kabalagala, Muyenga Road',
    market_location: 'Kabalagala',
    items: [
      { product_id: 'demo-tomatoes-mak', name: 'Tomatoes', price: 8000, unit: 'Per basket', quantity: 2 },
      { product_id: 'demo-matooke-mak', name: 'Matooke', price: 20000, unit: 'Per bunch', quantity: 2 },
    ],
    subtotal: 56000,
    delivery_fee: 5000,
    status: 'Order Received',
    order_status: 'Order Received',
    payment_status: 'PENDING',
    is_shared_with_outlet: false,
    outlet_code: null,
    division: 'Makindye Division',
    created_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'demo-order-rubaga',
    contact_name: 'Namirembe Joan',
    phone: '+256705678901',
    delivery_address: 'Rubaga, near Mengo Hospital',
    market_location: 'Rubaga',
    items: [
      { product_id: 'demo-charcoal-rub', name: 'Charcoal', price: 15000, unit: 'Per sack', quantity: 3 },
      { product_id: 'demo-rice-rub', name: 'Rice', price: 12000, unit: 'Per kg', quantity: 3 },
    ],
    subtotal: 81000,
    delivery_fee: 5000,
    status: 'Order Received',
    order_status: 'Order Received',
    payment_status: 'PENDING',
    is_shared_with_outlet: false,
    outlet_code: null,
    division: 'Rubaga Division',
    created_at: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
  },
];

type LegacyOrder = {
  is_shared_with_depot?: boolean;
  depot_code?: string | null;
  manual_depot_override?: boolean | null;
  suggested_depot_code?: string | null;
};

function normalizeStoredOrder(order: Order & LegacyOrder): Order {
  const {
    is_shared_with_depot,
    depot_code,
    manual_depot_override,
    suggested_depot_code,
    ...current
  } = order;

  return {
    ...current,
    is_shared_with_outlet: current.is_shared_with_outlet ?? is_shared_with_depot ?? false,
    outlet_code: current.outlet_code ?? depot_code ?? null,
    manual_outlet_override: current.manual_outlet_override ?? manual_depot_override ?? null,
    suggested_outlet_code: current.suggested_outlet_code ?? suggested_depot_code ?? null,
  };
}

function mergeDemoOrders(orders: Order[]) {
  const byId = new Map<string, Order>();

  for (const order of orders) {
    if (!order?.id) continue;
    byId.set(order.id, normalizeStoredOrder(order as Order & LegacyOrder));
  }

  return Array.from(byId.values()).sort((a, b) =>
    String(b.created_at || '').localeCompare(String(a.created_at || '')),
  );
}

export function readDemoOrders() {
  try {
    const stored = window.localStorage.getItem(LOCAL_DEMO_ORDERS_KEY);
    if (stored) {
      return mergeDemoOrders(JSON.parse(stored) as Array<Order & LegacyOrder>);
    }
  } catch {
    return DEMO_PENDING_ORDERS;
  }

  writeDemoOrders(DEMO_PENDING_ORDERS);
  return DEMO_PENDING_ORDERS;
}

export function writeDemoOrders(orders: Order[]) {
  const merged = mergeDemoOrders(orders);
  window.localStorage.setItem(LOCAL_DEMO_ORDERS_KEY, JSON.stringify(merged));
  return merged;
}

export function updateDemoOrder(order: Order) {
  const orders = readDemoOrders();
  const orderExists = orders.some((item) => item.id === order.id);
  const nextOrders = orderExists
    ? orders.map((item) => (item.id === order.id ? order : item))
    : [order, ...orders];

  return writeDemoOrders(nextOrders);
}

export async function readSharedDemoOrders() {
  const localOrders = readDemoOrders();

  try {
    const response = await fetch(SHARED_DEMO_ORDERS_ENDPOINT);
    if (!response.ok) return localOrders;

    const payload = (await response.json()) as { orders?: Order[] };
    const sharedOrders = (payload.orders ?? []).map((order) =>
      normalizeStoredOrder(order as Order & LegacyOrder),
    );

    // Shared file is the source of truth across admin/attendant ports.
    // Local cache is only a fallback for missing ids.
    const merged = mergeDemoOrders([...localOrders, ...sharedOrders]);
    writeDemoOrders(merged);

    await fetch(SHARED_DEMO_ORDERS_ENDPOINT, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orders: merged }),
    }).catch(() => null);

    return merged;
  } catch {
    return localOrders;
  }
}

export async function updateSharedDemoOrder(order: Order) {
  const nextOrders = updateDemoOrder(order);

  try {
    await fetch(SHARED_DEMO_ORDERS_ENDPOINT, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orders: nextOrders }),
    });
  } catch {
    // Local cache still has the update for this origin.
  }

  return nextOrders;
}
