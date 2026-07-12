import { useEffect, useState, type FormEvent } from 'react';
import {
  Plus,
  Pencil,
  Package,
  ClipboardList,
  Phone,
  MapPin,
  User,
  CheckCircle2,
  X,
  Loader2,
  TrendingUp,
  Boxes,
} from 'lucide-react';
import type { Category, Order, Product } from '../types';
import { supabase } from '../lib/supabase';
import { formatUGX } from '../lib/format';
import { CATEGORIES } from './CategoryBar';

interface MerchantDashboardProps {
  products: Product[];
  onProductsChanged: () => void;
}

type Tab = 'orders' | 'products';

export default function MerchantDashboard({
  products,
  onProductsChanged,
}: MerchantDashboardProps) {
  const [tab, setTab] = useState<Tab>('orders');
  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);

  useEffect(() => {
    void loadOrders();
  }, []);

  const loadOrders = async () => {
    setLoadingOrders(true);
    const { data, error } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .order('created_at', { ascending: false });

    const normalizedOrders = ((data as Array<Record<string, unknown>>) ?? []).map((order) => {
      const orderItems = Array.isArray((order as Record<string, unknown>).order_items)
        ? ((order as Record<string, unknown>).order_items as Array<Record<string, unknown>>).map((item) => ({
            ...item,
            product_id: item.product_id as string,
            name: item.name as string,
            price: item.price as number,
            unit: item.unit as string,
            quantity: item.quantity as number,
          }))
        : Array.isArray((order as Record<string, unknown>).items)
          ? ((order as Record<string, unknown>).items as Order['items'])
          : [];

      return {
        ...(order as Order),
        items: orderItems,
      } as Order;
    });

    setOrders(normalizedOrders);
    setLoadingOrders(false);
  };

  const totalRevenue = orders.reduce((s, o) => s + o.subtotal, 0);
  const totalItems = orders.reduce(
    (s, o) => s + o.items.reduce((q, i) => q + i.quantity, 0),
    0,
  );

  const handleStatusChange = async (orderId: string, status: string) => {
    const { error } = await supabase.from('orders').update({ status }).eq('id', orderId);
    if (!error) {
      setOrders((current) => current.map((order) => (order.id === orderId ? { ...order, status } : order)));
    }
  };

  return (
    <section className="mx-auto max-w-7xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-extrabold text-brand-800">Merchant Dashboard</h2>
          <p className="text-sm text-gray-500">
            Manage your products, prices and incoming delivery orders.
          </p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 rounded-full bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700"
        >
          <Plus className="h-4 w-4" /> Add Product
        </button>
      </div>

      {/* Stats */}
      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          icon={<ClipboardList className="h-5 w-5" />}
          label="Incoming Orders"
          value={String(orders.length)}
          tone="brand"
        />
        <StatCard
          icon={<TrendingUp className="h-5 w-5" />}
          label="Total Revenue"
          value={formatUGX(totalRevenue)}
          tone="gold"
        />
        <StatCard
          icon={<Boxes className="h-5 w-5" />}
          label="Items Sold"
          value={String(totalItems)}
          tone="brand"
        />
      </div>

      {/* Tabs */}
      <div className="mt-6 flex gap-2 border-b border-gray-200">
        <TabButton active={tab === 'orders'} onClick={() => setTab('orders')}>
          <ClipboardList className="h-4 w-4" /> Orders
        </TabButton>
        <TabButton active={tab === 'products'} onClick={() => setTab('products')}>
          <Package className="h-4 w-4" /> Products
        </TabButton>
      </div>

      {tab === 'orders' ? (
        <OrdersTab orders={orders} loading={loadingOrders} onStatusChange={handleStatusChange} />
      ) : (
        <ProductsTab products={products} onEdit={(p) => setEditing(p)} />
      )}

      {(showAdd || editing) && (
        <ProductFormModal
          product={editing}
          onClose={() => {
            setShowAdd(false);
            setEditing(null);
          }}
          onSaved={() => {
            setShowAdd(false);
            setEditing(null);
            onProductsChanged();
          }}
        />
      )}
    </section>
  );
}

function StatCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: 'brand' | 'gold';
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <div
        className={`grid h-11 w-11 place-items-center rounded-xl ${
          tone === 'brand' ? 'bg-brand-50 text-brand-600' : 'bg-gold-50 text-gold-600'
        }`}
      >
        {icon}
      </div>
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-lg font-extrabold text-gray-800">{value}</p>
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm font-semibold transition ${
        active
          ? 'border-brand-600 text-brand-700'
          : 'border-transparent text-gray-500 hover:text-gray-700'
      }`}
    >
      {children}
    </button>
  );
}

function OrdersTab({
  orders,
  loading,
  onStatusChange,
}: {
  orders: Order[];
  loading: boolean;
  onStatusChange: (orderId: string, status: string) => Promise<void>;
}) {
  if (loading) {
    return (
      <div className="py-10 text-center text-sm text-gray-400">
        <Loader2 className="mx-auto h-6 w-6 animate-spin" />
      </div>
    );
  }
  if (orders.length === 0) {
    return (
      <div className="mt-4 rounded-2xl border border-dashed border-gray-200 bg-white py-12 text-center">
        <ClipboardList className="mx-auto h-8 w-8 text-gray-300" />
        <p className="mt-2 text-sm font-semibold text-gray-500">No orders yet.</p>
        <p className="text-xs text-gray-400">Customer orders will appear here.</p>
      </div>
    );
  }
  return (
    <div className="mt-4 space-y-3">
      {orders.map((o) => (
        <div
          key={o.id}
          className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm transition hover:shadow-md"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-gray-800">
                #{o.id.slice(0, 8).toUpperCase()}
              </p>
              <p className="text-xs text-gray-400">
                {new Date(o.created_at).toLocaleString()}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-gray-500">
                <span className="sr-only">Order status</span>
                <select
                  value={o.status}
                  onChange={(e) => void onStatusChange(o.id, e.target.value)}
                  className="rounded-full border border-gray-200 bg-white px-2.5 py-1 text-xs font-semibold text-brand-700 outline-none ring-0"
                >
                  <option value="Dispatched to Doorstep">Dispatched to Doorstep</option>
                  <option value="Confirmed">Confirmed</option>
                  <option value="Packed">Packed</option>
                  <option value="Out for Delivery">Out for Delivery</option>
                  <option value="Delivered">Delivered</option>
                </select>
              </label>
              <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700 ring-1 ring-brand-200">
                <CheckCircle2 className="h-3.5 w-3.5" /> {o.status}
              </span>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
            <InfoLine icon={<User className="h-3.5 w-3.5" />} text={o.contact_name} />
            <InfoLine icon={<Phone className="h-3.5 w-3.5" />} text={o.phone} />
            <InfoLine icon={<MapPin className="h-3.5 w-3.5" />} text={o.delivery_address} />
          </div>
          <div className="mt-3 rounded-xl bg-gray-50 p-3">
            {o.items.map((it, idx) => (
              <div key={idx} className="flex justify-between text-xs">
                <span className="text-gray-700">
                  {it.name} ({it.unit}) × {it.quantity}
                </span>
                <span className="font-medium text-gray-800">{formatUGX(it.price * it.quantity)}</span>
              </div>
            ))}
            <div className="mt-2 flex justify-between border-t border-gray-200 pt-2">
              <span className="text-sm font-semibold text-gray-700">Total</span>
              <span className="text-sm font-extrabold text-brand-700">{formatUGX(o.subtotal)}</span>
            </div>
          </div>
        </div>
      ))}
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

function ProductsTab({
  products,
  onEdit,
}: {
  products: Product[];
  onEdit: (p: Product) => void;
}) {
  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3 font-semibold">Product</th>
              <th className="px-4 py-3 font-semibold">Category</th>
              <th className="px-4 py-3 font-semibold">Unit</th>
              <th className="px-4 py-3 font-semibold">Price</th>
              <th className="px-4 py-3 font-semibold">Stock</th>
              <th className="px-4 py-3 font-semibold text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {products.map((p) => (
              <tr key={p.id} className="transition hover:bg-brand-50/40">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="h-9 w-9 overflow-hidden rounded-lg bg-gray-50">
                      {p.image_url && (
                        <img src={p.image_url} alt={p.name} className="h-full w-full object-cover" />
                      )}
                    </div>
                    <span className="font-semibold text-gray-800">{p.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-600">{p.category}</td>
                <td className="px-4 py-3 text-gray-600">{p.unit}</td>
                <td className="px-4 py-3 font-bold text-brand-700">{formatUGX(p.price)}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      p.in_stock
                        ? 'bg-brand-50 text-brand-700'
                        : 'bg-red-50 text-red-600'
                    }`}
                  >
                    {p.in_stock ? 'In stock' : 'Out'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => onEdit(p)}
                    className="inline-flex items-center gap-1 rounded-full border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 transition hover:border-brand-300 hover:bg-brand-50"
                  >
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ProductFormModal({
  product,
  onClose,
  onSaved,
}: {
  product: Product | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!product;
  const [name, setName] = useState(product?.name ?? '');
  const [category, setCategory] = useState<Category>(product?.category ?? 'Food Sauce');
  const [price, setPrice] = useState(String(product?.price ?? ''));
  const [unit, setUnit] = useState(product?.unit ?? '');
  const [imageUrl, setImageUrl] = useState(product?.image_url ?? '');
  const [description, setDescription] = useState(product?.description ?? '');
  const [inStock, setInStock] = useState(product?.in_stock ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const priceNum = Number(price);
    if (!name.trim() || !unit.trim() || !priceNum || priceNum <= 0) {
      setError('Name, unit and a valid price are required.');
      return;
    }
    setSaving(true);
    const payload = {
      name: name.trim(),
      category,
      price: priceNum,
      unit: unit.trim(),
      image_url: imageUrl.trim() || null,
      description: description.trim() || null,
      in_stock: inStock,
    };
    let res;
    if (isEdit) {
      res = await supabase.from('products').update(payload).eq('id', product!.id);
    } else {
      res = await supabase.from('products').insert(payload);
    }
    setSaving(false);
    if (res.error) {
      setError('Could not save product. Please try again.');
      return;
    }
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg overflow-hidden rounded-t-3xl bg-white shadow-2xl animate-slide-up sm:rounded-3xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h2 className="text-base font-bold text-gray-800">
            {isEdit ? 'Edit Product' : 'Add New Product'}
          </h2>
          <button
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-full text-gray-500 transition hover:bg-gray-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="max-h-[80vh] overflow-y-auto px-5 py-4">
          <div className="space-y-3">
            <FormField label="Product Name" value={name} onChange={setName} placeholder="e.g. Tomatoes" />
            <div>
              <span className="mb-1 block text-xs font-semibold text-gray-600">Category</span>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as Category)}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none transition focus:border-brand-400 focus:bg-white focus:ring-2 focus:ring-brand-100"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormField
                label="Price (UGX)"
                value={price}
                onChange={setPrice}
                placeholder="5000"
                type="number"
              />
              <FormField
                label="Unit / Portion"
                value={unit}
                onChange={setUnit}
                placeholder="7 pieces"
              />
            </div>
            <FormField
              label="Image URL"
              value={imageUrl}
              onChange={setImageUrl}
              placeholder="https://..."
            />
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-gray-600">Description</span>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder="Short description"
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none transition focus:border-brand-400 focus:bg-white focus:ring-2 focus:ring-brand-100"
              />
            </label>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <input
                type="checkbox"
                checked={inStock}
                onChange={(e) => setInStock(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
              />
              In stock
            </label>
          </div>

          {error && (
            <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-600">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-brand-600 py-3 text-sm font-bold text-white shadow-md transition hover:bg-brand-700 disabled:bg-gray-300"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Saving...
              </>
            ) : (
              <>{isEdit ? 'Update Product' : 'Add Product'}</>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

function FormField({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-gray-600">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none transition focus:border-brand-400 focus:bg-white focus:ring-2 focus:ring-brand-100"
      />
    </label>
  );
}
