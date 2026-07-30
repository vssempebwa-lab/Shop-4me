import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  Plus,
  Pencil,
  Trash2,
  Share2,
  Package,
  ClipboardList,
  Phone,
  MapPin,
  User,
  Users,
  Building2,
  Activity,
  BarChart3,
  CalendarDays,
  Download,
  ShieldCheck,
  Bike,
  CheckCircle2,
  X,
  Loader2,
  TrendingUp,
  Boxes,
  Palette,
  Eye,
  RotateCcw,
  Save,
  History,
  Lock,
  Type,
  ImagePlus,
  Upload,
  Link,
} from 'lucide-react';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import type {
  AdminAuditLog,
  Category,
  Outlet,
  OutletRider,
  Order,
  Product,
  UserRoleProfile,
} from '../types';
import { supabase } from '../lib/supabase';
import { formatUGX } from '../lib/format';
import {
  findOutletByCode,
  formatOutletOption,
  formatDistributionAreas,
  OFFICIAL_OUTLETS,
  suggestOutletFromText,
} from '../lib/outlets';
import { DEMO_ORDER_PREFIX, readDemoOrders, updateDemoOrder } from '../lib/demoOrders';
import {
  getNextOrderStatus,
  getStatusDisplay,
  normalizeOrderStatus,
  type OrderStatus,
} from '../lib/orderStatus';
import { readLocalAdminUsers, updateLocalAdminUser, writeLocalAdminUser } from '../lib/localAdminUsers';
import { CATEGORIES } from './CategoryBar';
import ImageUploader from './ImageUploader';
import ConfirmDeleteModal from './ConfirmDeleteModal';
import AvatarUploader from './AvatarUploader';
import UserAvatar from './UserAvatar';
import type { AppRole } from '../hooks/useAuth';
import {
  applySiteSettings,
  fetchSiteContentDraft,
  fetchSiteContentVersions,
  fetchSiteSettingRecords,
  getCategoryContent,
  normalizeSiteSettings,
  publishSiteSettings,
  rollbackSiteSettings,
  resetSettingsSection,
  saveSiteContentDraft,
  validateSiteSettings,
  type CategoryContent,
  type SiteSettingRecord,
  type SiteContentVersion,
  type SiteSettings,
  type TrustBadgeContent,
} from '../lib/siteSettings';

interface MerchantDashboardProps {
  products: Product[];
  user: SupabaseUser | null;
  role: AppRole;
  profile: UserRoleProfile | null;
  onOpenAttendantWorkspace?: () => void;
  onProductsChanged: () => void;
  siteSettings: SiteSettings;
  onSiteSettingsChanged: (settings: SiteSettings) => void;
}

type Tab =
  | 'pending'
  | 'orders'
  | 'attendant'
  | 'accounts'
  | 'audit'
  | 'reports'
  | 'settings'
  | 'products';

const FREE_ACCESS_HEADER = 'local-free-access';

async function fetchAdminUsersApi(init: RequestInit) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch('/.netlify/functions/admin-users', {
      ...init,
      signal: controller.signal,
    });
    const text = await response.text();
    let payload: { message?: string; users?: UserRoleProfile[]; user?: UserRoleProfile; userId?: string } = {};
    let validJson = true;

    if (text) {
      try {
        payload = JSON.parse(text) as { message?: string; users?: UserRoleProfile[]; user?: UserRoleProfile; userId?: string };
      } catch {
        validJson = false;
        payload = {
          message:
            'Account service is not available on this dev server. Run `netlify dev` or deploy the Netlify function.',
        };
      }
    }

    return {
      response: validJson ? response : ({ ok: false, status: response.status } as Response),
      payload,
    };
  } catch (error) {
    const aborted = error instanceof DOMException && error.name === 'AbortError';
    return {
      response: { ok: false } as Response,
      payload: {
        message: aborted
          ? 'Account creation timed out. Run the app with `netlify dev` so the admin-users function is available.'
          : 'Could not reach the account service. Run `netlify dev` or check your Netlify function environment variables.',
      },
    };
  } finally {
    window.clearTimeout(timeoutId);
  }
}

async function uploadAvatarForUser(userId: string, file: File, replaceExisting = false) {
  const extension = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
  const path = `${userId}/profile.${extension}`;

  if (replaceExisting) {
    await deleteUserAvatarFiles(userId);
  }

  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(path, file, { upsert: true, contentType: file.type });

  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from('avatars').getPublicUrl(path);
  const avatarUrl = data.publicUrl;
  const { error: updateError } = await supabase
    .from('user_roles')
    .update({ avatar_url: avatarUrl })
    .eq('user_id', userId);

  if (updateError) throw updateError;
  return avatarUrl;
}

async function deleteUserAvatarFiles(userId: string) {
  const { data, error } = await supabase.storage.from('avatars').list(userId);
  if (error || !data?.length) return;

  const files = data
    .filter((item) => item.name.startsWith('profile.'))
    .map((item) => `${userId}/${item.name}`);

  if (files.length) {
    await supabase.storage.from('avatars').remove(files);
  }
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export default function MerchantDashboard({
  products,
  user,
  role,
  profile,
  onOpenAttendantWorkspace,
  onProductsChanged,
  siteSettings,
  onSiteSettingsChanged,
}: MerchantDashboardProps) {
  const isAdmin = role === 'admin' || role === 'merchant';
  const canManageSiteSettings = role === 'admin';
  const isAttendant = role === 'attendant';
  const [tab, setTab] = useState<Tab>(isAttendant ? 'attendant' : 'pending');
  const [orders, setOrders] = useState<Order[]>([]);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [riders, setRiders] = useState<OutletRider[]>([]);
  const [adminUsers, setAdminUsers] = useState<UserRoleProfile[]>([]);
  const [auditLogs, setAuditLogs] = useState<AdminAuditLog[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [loadingAdminData, setLoadingAdminData] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [shareOrder, setShareOrder] = useState<Order | null>(null);
  const [shareOutlet, setShareOutlet] = useState('');
  const [sharingOrderId, setSharingOrderId] = useState<string | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);
  const [dispatchOrder, setDispatchOrder] = useState<Order | null>(null);
  const [accountPanelOpen, setAccountPanelOpen] = useState(false);
  const [localAdminUsers, setLocalAdminUsers] = useState<UserRoleProfile[]>([]);
  const [pendingDelete, setPendingDelete] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    if (isAttendant && tab !== 'attendant') {
      setTab('attendant');
      return;
    }

    if (isAdmin && tab === 'attendant') {
      setTab('pending');
    }
  }, [isAdmin, isAttendant, tab]);

  useEffect(() => {
    setLocalAdminUsers(readLocalAdminUsers());
    void loadOrders();
    void loadAdminData();
    void loadAdminUsers();
  }, [profile?.assigned_outlet, role]);

  useEffect(() => {
    const channel = supabase
      .channel('merchant-dashboard-orders')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        () => {
          void loadOrders();
          void loadAdminData();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [profile?.assigned_outlet, role]);

  useEffect(() => {
    if (!shareOrder || shareOutlet) return;
    const suggestedOutlet = suggestOutletForOrder(shareOrder, outlets);
    setShareOutlet(suggestedOutlet?.outlet_code ?? outlets[0]?.outlet_code ?? '');
  }, [outlets, shareOutlet, shareOrder]);

  const loadOrders = async () => {
    setLoadingOrders(true);
    let query = supabase
      .from('orders')
      .select('*, order_items(*)')
      .order('created_at', { ascending: false });

    if (isAttendant && profile?.assigned_outlet) {
      query = query
        .eq('outlet_code', profile.assigned_outlet)
        .eq('is_shared_with_outlet', true);
    }

    const { data, error } = await query;

    if (error) {
      setOrders(isAdmin ? getDemoOrdersForDashboard(isAttendant, profile?.assigned_outlet) : []);
      setLoadingOrders(false);
      return;
    }

    const normalizedOrders = ((data as Array<Record<string, unknown>>) ?? []).map((order) => {
      const joinedItems = Array.isArray((order as Record<string, unknown>).order_items)
        ? ((order as Record<string, unknown>).order_items as Array<Record<string, unknown>>).map((item) => ({
            ...item,
            product_id: item.product_id as string,
            name: item.name as string,
            price: item.price as number,
            unit: item.unit as string,
            quantity: item.quantity as number,
          }))
        : [];
      const jsonItems = Array.isArray((order as Record<string, unknown>).items)
        ? ((order as Record<string, unknown>).items as Order['items'])
        : [];

      return {
        ...(order as unknown as Order),
        items: joinedItems.length ? joinedItems : jsonItems,
      } as Order;
    });

    const liveOrders = normalizedOrders.map(normalizeOrder);
    const demoOrders = isAdmin ? getDemoOrdersForDashboard(isAttendant, profile?.assigned_outlet) : [];
    const liveIds = new Set(liveOrders.map((order) => order.id));
    const localOnlyOrders = demoOrders.filter((order) => !liveIds.has(order.id));
    const nextOrders = [...localOnlyOrders, ...liveOrders];

    setOrders(nextOrders);
    setLoadingOrders(false);
  };

  const loadAdminData = async () => {
    setLoadingAdminData(true);

    const [outletsResult, ridersResult, auditResult] = await Promise.all([
      supabase.from('outlets').select('*').eq('is_active', true).order('outlet_code'),
      supabase.from('outlet_riders').select('*').eq('is_active', true).order('name'),
      supabase
        .from('admin_audit_logs')
        .select('*')
        .in('action', [
          'order_shared_to_outlet',
          'rider_dispatched',
          'order_delivered_paid',
          'outlet_order_status_changed',
          'attendant_order_status_changed',
          'attendant_rider_dispatched',
        ])
        .order('created_at', { ascending: false })
        .limit(30),
    ]);

    if (!outletsResult.error && outletsResult.data?.length) {
      setOutlets((outletsResult.data as Outlet[]) ?? []);
    } else {
      setOutlets(OFFICIAL_OUTLETS);
    }
    if (!ridersResult.error) setRiders((ridersResult.data as OutletRider[]) ?? []);
    if (!auditResult.error) setAuditLogs((auditResult.data as AdminAuditLog[]) ?? []);

    setLoadingAdminData(false);
  };

  const loadAdminUsers = async () => {
    if (!isAdmin) {
      setAdminUsers([]);
      return;
    }

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;

    const { response, payload } = await fetchAdminUsersApi({
      headers: token
        ? { Authorization: `Bearer ${token}` }
        : { 'X-SFM-Free-Admin': FREE_ACCESS_HEADER },
    });

    if (response.ok) {
      setAdminUsers(payload.users ?? []);
    }
  };

  const totalRevenue = orders.reduce((s, o) => s + o.subtotal, 0);
  const totalItems = orders.reduce(
    (s, o) => s + o.items.reduce((q, i) => q + i.quantity, 0),
    0,
  );

  const writeAuditLog = async (
    action: string,
    targetId: string,
    metadata: Record<string, unknown> = {},
  ) => {
    await supabase.from('admin_audit_logs').insert({
      actor_user_id: user?.id ?? null,
      action,
      target_type: 'order',
      target_id: targetId,
      metadata,
    });
  };

  const shareOrderToOutlet = async (
    targetOrder = shareOrder,
    targetOutlet = shareOutlet,
    suggestedOutletCode?: string | null,
  ) => {
    if (!targetOrder || !targetOutlet) return;

    setSharingOrderId(targetOrder.id);
    setShareError(null);

    const sharedAt = new Date().toISOString();
    const selectedOutletRecord = outlets.find((outlet) => outlet.outlet_code === targetOutlet);
    const manualOverride = Boolean(suggestedOutletCode && suggestedOutletCode !== targetOutlet);
    const adminName = profile?.full_name || profile?.email || user?.email || 'Admin';
    const adminId = user?.id ?? null;

    if (isDemoOrder(targetOrder)) {
      const routedOrder = normalizeOrder({
        ...targetOrder,
        outlet_code: targetOutlet,
        division: selectedOutletRecord?.division ?? targetOrder.division ?? null,
        is_shared_with_outlet: true,
        shared_at: sharedAt,
        shared_by: adminId,
        shared_by_admin_id: adminId,
        shared_by_admin_name: adminName,
        manual_outlet_override: manualOverride,
        suggested_outlet_code: suggestedOutletCode ?? null,
        order_status: 'Processing',
        status: 'Processing',
      });
      updateDemoOrder(routedOrder);
      setOrders((current) =>
        current.map((order) => (order.id === targetOrder.id ? routedOrder : order)),
      );
      setSharingOrderId(null);
      setShareOrder(null);
      setShareOutlet('');
      showToast({
        tone: 'success',
        message: manualOverride ? 'Demo order shared with manual outlet override.' : 'Demo order shared to outlet.',
      });
      return;
    }

    const { error } = await supabase
      .from('orders')
      .update({
        outlet_code: targetOutlet,
        division: selectedOutletRecord?.division ?? targetOrder.division ?? null,
        is_shared_with_outlet: true,
        shared_at: sharedAt,
        shared_by: adminId,
        shared_by_admin_id: adminId,
        shared_by_admin_name: adminName,
        manual_outlet_override: manualOverride,
        suggested_outlet_code: suggestedOutletCode ?? null,
        order_status: 'Processing',
        status: 'Processing',
      })
      .eq('id', targetOrder.id);

    if (error) {
      setSharingOrderId(null);
      setShareError(error.message || 'Could not share order with outlet.');
      return;
    }

    await writeAuditLog('order_shared_to_outlet', targetOrder.id, {
      outlet_code: targetOutlet,
      selected_outlet_code: targetOutlet,
      suggested_outlet_code: suggestedOutletCode ?? null,
      manual_override: manualOverride,
      shared_by_admin_id: adminId,
      shared_by_admin_name: adminName,
      shared_at: sharedAt,
      contact_name: targetOrder.contact_name,
    });

    setSharingOrderId(null);
    setShareOrder(null);
    setShareOutlet('');
    await loadOrders();
    await loadAdminData();
    showToast({ tone: 'success', message: 'Order shared to outlet.' });
  };

  const changeOutletOrderStatus = async (
    order: Order,
    nextStatus: OrderStatus,
  ) => {
    const patch: Partial<Order> = {
      order_status: nextStatus,
      status: nextStatus,
      handled_by_attendant_id: user?.id ?? null,
      handled_by_attendant_name: profile?.full_name || profile?.email || user?.email || 'Attendant',
    };

    if (nextStatus === 'Delivered') {
      patch.payment_status = 'PAID';
      patch.delivered_at = new Date().toISOString();
    }

    if (isDemoOrder(order)) {
      const updatedOrder = normalizeOrder({ ...order, ...patch });
      updateDemoOrder(updatedOrder);
      setOrders((current) =>
        current.map((item) => (item.id === order.id ? updatedOrder : item)),
      );
      showToast({ tone: 'success', message: `Order marked ${getStatusDisplay(nextStatus).label}.` });
      return;
    }

    const { error } = await supabase.from('orders').update(patch).eq('id', order.id);

    if (error) {
      showToast({ tone: 'error', message: error.message || 'Could not update order.' });
      return;
    }

    await writeAuditLog('outlet_order_status_changed', order.id, {
      from: order.order_status ?? order.status,
      to: nextStatus,
      outlet_code: order.outlet_code,
    });

    await loadOrders();
    showToast({ tone: 'success', message: `Order marked ${nextStatus}.` });
  };

  const dispatchRider = async (order: Order, rider: OutletRider) => {
    const dispatchedAt = new Date().toISOString();
    const patch: Partial<Order> = {
      dispatched_rider_id: rider.id,
      dispatched_rider_name: rider.name,
      dispatched_at: dispatchedAt,
      order_status: 'Transit',
      status: 'Transit',
      handled_by_attendant_id: user?.id ?? null,
      handled_by_attendant_name: profile?.full_name || profile?.email || user?.email || 'Attendant',
    };

    if (isDemoOrder(order)) {
      const updatedOrder = normalizeOrder({ ...order, ...patch });
      updateDemoOrder(updatedOrder);
      setDispatchOrder(null);
      setOrders((current) =>
        current.map((item) => (item.id === order.id ? updatedOrder : item)),
      );
      showToast({ tone: 'success', message: `${rider.name} dispatched.` });
      return;
    }

    const { error } = await supabase
      .from('orders')
      .update(patch)
      .eq('id', order.id);

    if (error) {
      showToast({ tone: 'error', message: error.message || 'Could not dispatch rider.' });
      return;
    }

    await writeAuditLog('rider_dispatched', order.id, {
      rider_id: rider.id,
      rider_name: rider.name,
      outlet_code: rider.outlet_code,
      dispatched_at: dispatchedAt,
    });

    setDispatchOrder(null);
    await loadOrders();
    showToast({ tone: 'success', message: `${rider.name} dispatched.` });
  };

  const markAsPaidAndDelivered = async (order: Order) => {
    const deliveredAt = new Date().toISOString();
    const patch: Partial<Order> = {
      order_status: 'Delivered',
      status: 'Delivered',
      payment_status: 'PAID',
      delivered_at: deliveredAt,
      handled_by_attendant_id: user?.id ?? null,
      handled_by_attendant_name: profile?.full_name || profile?.email || user?.email || 'Attendant',
    };

    if (isDemoOrder(order)) {
      const updatedOrder = normalizeOrder({ ...order, ...patch });
      updateDemoOrder(updatedOrder);
      setOrders((current) =>
        current.map((item) => (item.id === order.id ? updatedOrder : item)),
      );
      showToast({ tone: 'success', message: 'Order marked paid and delivered.' });
      return;
    }

    const { error } = await supabase
      .from('orders')
      .update(patch)
      .eq('id', order.id);

    if (error) {
      showToast({ tone: 'error', message: error.message || 'Could not complete delivery.' });
      return;
    }

    await writeAuditLog('order_delivered_paid', order.id, {
      outlet_code: order.outlet_code,
      delivered_at: deliveredAt,
    });

    await loadOrders();
    showToast({ tone: 'success', message: 'Order marked paid and delivered.' });
  };

  const showToast = (nextToast: { tone: 'success' | 'error'; message: string }) => {
    setToast(nextToast);
    window.setTimeout(() => setToast(null), 3500);
  };

  const handleConfirmDelete = async () => {
    if (!pendingDelete) return;

    setDeleting(true);
    setDeleteError(null);

    const { error } = await supabase.from('products').delete().eq('id', pendingDelete.id);

    setDeleting(false);

    if (error) {
      const message = error.message || 'Could not delete product. Please try again.';
      setDeleteError(message);
      showToast({ tone: 'error', message });
      return;
    }

    const deletedName = pendingDelete.name;
    setPendingDelete(null);
    await onProductsChanged();
    showToast({ tone: 'success', message: `${deletedName} deleted successfully.` });
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
        {isAdmin && (
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 rounded-full bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700"
          >
            <Plus className="h-4 w-4" /> Add Product
          </button>
        )}
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
      <div className="mt-6 flex gap-2 overflow-x-auto border-b border-gray-200">
        {onOpenAttendantWorkspace && (
          <TabButton active={false} onClick={onOpenAttendantWorkspace}>
            <Building2 className="h-4 w-4" /> Attendant Workspace
          </TabButton>
        )}
        {isAdmin && (
          <TabButton active={tab === 'pending'} onClick={() => setTab('pending')}>
            <Share2 className="h-4 w-4" /> Pending Queue
          </TabButton>
        )}
        {isAdmin && (
          <TabButton active={tab === 'orders'} onClick={() => setTab('orders')}>
            <ClipboardList className="h-4 w-4" /> All Orders
          </TabButton>
        )}
        {isAttendant && (
          <TabButton active={tab === 'attendant'} onClick={() => setTab('attendant')}>
            <Building2 className="h-4 w-4" /> Outlet Queue
          </TabButton>
        )}
        {isAdmin && (
          <TabButton active={tab === 'accounts'} onClick={() => setTab('accounts')}>
            <Users className="h-4 w-4" /> Accounts
          </TabButton>
        )}
        {isAdmin && (
          <TabButton active={tab === 'audit'} onClick={() => setTab('audit')}>
            <Activity className="h-4 w-4" /> Audit
          </TabButton>
        )}
        {isAdmin && (
          <TabButton active={tab === 'reports'} onClick={() => setTab('reports')}>
            <BarChart3 className="h-4 w-4" /> Reports
          </TabButton>
        )}
        {canManageSiteSettings && (
          <TabButton active={tab === 'settings'} onClick={() => setTab('settings')}>
            <Palette className="h-4 w-4" /> Site Settings
          </TabButton>
        )}
        {isAdmin && (
          <TabButton active={tab === 'products'} onClick={() => setTab('products')}>
            <Package className="h-4 w-4" /> Products
          </TabButton>
        )}
        {!isAdmin && !isAttendant && (
          <TabButton active={tab === 'orders'} onClick={() => setTab('orders')}>
            <ClipboardList className="h-4 w-4" /> Orders
          </TabButton>
        )}
      </div>

      {tab === 'pending' ? (
        <PendingOrdersTab
          orders={orders.filter((order) => !order.is_shared_with_outlet)}
          outlets={outlets}
          loading={loadingOrders}
          sharingOrderId={sharingOrderId}
          shareError={shareError}
          onShare={(order, outletCode, suggestedOutletCode) => {
            setShareError(null);
            void shareOrderToOutlet(order, outletCode, suggestedOutletCode);
          }}
        />
      ) : tab === 'orders' ? (
        <OrdersTab
          orders={orders}
          loading={loadingOrders}
        />
      ) : tab === 'attendant' ? (
        <AttendantQueueTab
          orders={orders}
          riders={riders.filter((rider) => rider.outlet_code === profile?.assigned_outlet)}
          assignedOutlet={profile?.assigned_outlet ?? ''}
          assignedOutletRecord={findOutletByCode(outlets, profile?.assigned_outlet ?? '')}
          loading={loadingOrders}
          onChangeStatus={changeOutletOrderStatus}
          onOpenDispatch={setDispatchOrder}
          onPaidDelivered={markAsPaidAndDelivered}
        />
      ) : tab === 'accounts' ? (
        <AccountManagementTab
          users={[...localAdminUsers, ...adminUsers]}
          outlets={outlets}
          open={accountPanelOpen}
          onOpenChange={setAccountPanelOpen}
          onReload={loadAdminUsers}
          onLocalUsersChange={setLocalAdminUsers}
          onToast={showToast}
        />
      ) : tab === 'audit' ? (
        <AuditAndOutletPerformanceTab
          orders={orders}
          outlets={outlets}
          logs={auditLogs}
          users={adminUsers}
          loading={loadingAdminData}
        />
      ) : tab === 'reports' ? (
        <ReportsTab orders={orders} outlets={outlets} loading={loadingOrders || loadingAdminData} />
      ) : tab === 'settings' ? (
        <SiteSettingsTab
          settings={siteSettings}
          user={user}
          profile={profile}
          onSettingsChanged={onSiteSettingsChanged}
          onToast={showToast}
          onAuditLogged={loadAdminData}
        />
      ) : tab === 'products' ? (
        <ProductsTab
          products={products}
          onEdit={(p) => setEditing(p)}
          onDelete={(product) => {
            setDeleteError(null);
            setPendingDelete(product);
          }}
        />
      ) : (
        <OrdersTab
          orders={orders}
          loading={loadingOrders}
        />
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

      {dispatchOrder && (
        <RiderDispatchModal
          order={dispatchOrder}
          riders={riders.filter((rider) => rider.outlet_code === dispatchOrder.outlet_code)}
          onClose={() => setDispatchOrder(null)}
          onDispatch={(rider) => void dispatchRider(dispatchOrder, rider)}
        />
      )}

      <ConfirmDeleteModal
        open={!!pendingDelete}
        title="Delete product"
        itemName={pendingDelete?.name ?? 'this product'}
        description={
          pendingDelete
            ? `Are you sure you want to delete ${pendingDelete.name}? This removes it from the storefront and cannot be undone.`
            : undefined
        }
        confirmLabel="Delete Product"
        loading={deleting}
        error={deleteError}
        onCancel={() => {
          if (deleting) return;
          setPendingDelete(null);
          setDeleteError(null);
        }}
        onConfirm={() => void handleConfirmDelete()}
      />

      {toast && <DashboardToast tone={toast.tone} message={toast.message} />}
    </section>
  );
}

function DashboardToast({
  tone,
  message,
}: {
  tone: 'success' | 'error';
  message: string;
}) {
  return (
    <div className="fixed bottom-4 right-4 z-[80] max-w-sm animate-slide-in-right px-4 sm:px-0">
      <div
        className={`rounded-2xl border bg-white px-4 py-3 text-sm font-semibold shadow-xl ${
          tone === 'success'
            ? 'border-brand-100 text-brand-800'
            : 'border-red-100 text-red-700'
        }`}
      >
        {message}
      </div>
    </div>
  );
}

function PendingOrdersTab({
  orders,
  outlets,
  loading,
  sharingOrderId,
  shareError,
  onShare,
}: {
  orders: Order[];
  outlets: Outlet[];
  loading: boolean;
  sharingOrderId: string | null;
  shareError: string | null;
  onShare: (order: Order, outletCode: string, suggestedOutletCode: string | null) => void;
}) {
  const [selectedOutlets, setSelectedOutlets] = useState<Record<string, string>>({});

  if (loading) return <LoadingState label="Loading pending orders..." />;

  if (orders.length === 0) {
    return (
      <EmptyState
        icon={<Share2 className="h-8 w-8" />}
        title="No pending outlet shares"
        text="Orders waiting for an outlet assignment will appear here."
      />
    );
  }

  return (
    <div className="mt-4 space-y-3">
      {orders.map((order) => {
        const suggestedOutlet = suggestOutletForOrder(order, outlets);
        const clientOutlet = findOutletByCode(outlets, order.outlet_code ?? '');
        const selectedOutlet =
          selectedOutlets[order.id] ??
          clientOutlet?.outlet_code ??
          suggestedOutlet?.outlet_code ??
          outlets[0]?.outlet_code ??
          '';
        const manualOverride = Boolean(
          suggestedOutlet?.outlet_code && selectedOutlet && selectedOutlet !== suggestedOutlet.outlet_code,
        );
        const isSharingThisOrder = sharingOrderId === order.id;

        return (
          <OrderShell key={order.id} order={order}>
            <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
              <div className="min-w-[220px] flex-1 sm:max-w-md">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  {suggestedOutlet && (
                    <span className="text-xs font-bold text-gold-700">
                      Suggested: {suggestedOutlet.name}
                    </span>
                  )}
                  {clientOutlet && (
                    <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-bold text-brand-700">
                      Client selected: {clientOutlet.name}
                    </span>
                  )}
                  {manualOverride && (
                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700">
                      Manual override
                    </span>
                  )}
                </div>
                <select
                  value={selectedOutlet}
                  disabled={isSharingThisOrder}
                  onChange={(event) =>
                    setSelectedOutlets((current) => ({
                      ...current,
                      [order.id]: event.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100 disabled:cursor-not-allowed disabled:bg-gray-100"
                >
                  {outlets.map((outlet) => (
                    <option key={outlet.outlet_code} value={outlet.outlet_code}>
                      {formatOutletOption(outlet)}
                    </option>
                  ))}
                </select>
              </div>
              {shareError && isSharingThisOrder && (
                <span className="w-full text-right text-xs font-semibold text-red-600">
                  {shareError}
                </span>
              )}
              <button
                type="button"
                onClick={() => onShare(order, selectedOutlet, suggestedOutlet?.outlet_code ?? null)}
                disabled={!selectedOutlet || isSharingThisOrder}
                className="inline-flex items-center gap-1.5 rounded-full bg-brand-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-gray-300"
              >
                {isSharingThisOrder ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Share2 className="h-3.5 w-3.5" />
                )}
                Share to Outlet
              </button>
            </div>
          </OrderShell>
        );
      })}
    </div>
  );
}

function AttendantQueueTab({
  orders,
  riders,
  assignedOutlet,
  assignedOutletRecord,
  loading,
  onChangeStatus,
  onOpenDispatch,
  onPaidDelivered,
}: {
  orders: Order[];
  riders: OutletRider[];
  assignedOutlet: string;
  assignedOutletRecord: Outlet | null;
  loading: boolean;
  onChangeStatus: (order: Order, nextStatus: OrderStatus) => void;
  onOpenDispatch: (order: Order) => void;
  onPaidDelivered: (order: Order) => void;
}) {
  if (!assignedOutlet) {
    return (
      <EmptyState
        icon={<Building2 className="h-8 w-8" />}
        title="No assigned outlet"
        text="Ask an admin to assign your attendant account to an outlet."
      />
    );
  }

  if (!assignedOutletRecord) {
    return (
      <EmptyState
        icon={<Building2 className="h-8 w-8" />}
        title="Invalid assigned outlet"
        text={`${assignedOutlet} is not one of the five active SFM outlet codes. Ask an admin to update this account.`}
      />
    );
  }

  if (loading) return <LoadingState label="Loading outlet queue..." />;

  if (orders.length === 0) {
    return (
      <EmptyState
        icon={<ClipboardList className="h-8 w-8" />}
        title="Outlet queue is clear"
        text="Shared orders for your assigned outlet will appear here in real time."
      />
    );
  }

  return (
    <div className="mt-4 space-y-3">
      <div className="rounded-2xl border border-brand-100 bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-800">
        Assigned outlet: {formatOutletOption(assignedOutletRecord)}
        <span className="mt-1 block text-xs font-medium text-brand-700">
          Covers: {formatDistributionAreas(assignedOutletRecord)}
        </span>
      </div>
      {orders.map((order) => {
        const nextStatus = getNextOrderStatus(order);
        const statusDisplay = getStatusDisplay(order.order_status ?? order.status);

        return (
        <OrderShell key={order.id} order={order}>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${statusDisplay.badgeClass}`}
            >
              <CheckCircle2 className="h-3.5 w-3.5" /> {statusDisplay.label}
            </span>
            {nextStatus && nextStatus !== 'Delivered' && (
              <button
                type="button"
                onClick={() => onChangeStatus(order, nextStatus)}
                className="rounded-full bg-brand-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-brand-700"
              >
                {nextStatus === 'Processing' ? 'Start Processing' : 'Mark In Transit'}
              </button>
            )}
            {statusDisplay.status === 'Processing' && (
              <button
                type="button"
                onClick={() => onOpenDispatch(order)}
                disabled={riders.length === 0}
                className="inline-flex items-center gap-1.5 rounded-full bg-gold-500 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-gold-400 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400"
              >
                <Bike className="h-3.5 w-3.5" />
                Dispatch Rider
              </button>
            )}
            {nextStatus === 'Delivered' && (
              <button
                type="button"
                onClick={() => onPaidDelivered(order)}
                className="inline-flex items-center gap-1.5 rounded-full bg-brand-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-brand-700"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Confirm Delivered &amp; Paid
              </button>
            )}
          </div>
        </OrderShell>
        );
      })}
    </div>
  );
}

function AccountManagementTab({
  users,
  outlets,
  open,
  onOpenChange,
  onReload,
  onLocalUsersChange,
  onToast,
}: {
  users: UserRoleProfile[];
  outlets: Outlet[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReload: () => void;
  onLocalUsersChange: (users: UserRoleProfile[]) => void;
  onToast: (toast: { tone: 'success' | 'error'; message: string }) => void;
}) {
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState('');
  const [role, setRole] = useState<'admin' | 'attendant'>('attendant');
  const [assignedOutlet, setAssignedOutlet] = useState('');
  const [editingUser, setEditingUser] = useState<UserRoleProfile | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const selectedAssignedOutlet = findOutletByCode(outlets, assignedOutlet);

  const resetForm = () => {
    if (avatarPreviewUrl.startsWith('blob:')) URL.revokeObjectURL(avatarPreviewUrl);
    setEmail('');
    setFullName('');
    setPassword('');
    setAssignedOutlet('');
    setAvatarFile(null);
    setAvatarPreviewUrl('');
  };

  const callAccountAction = async (body: Record<string, unknown>, successMessage: string) => {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;

    const { response, payload } = await fetchAdminUsersApi({
      method: 'PATCH',
      headers: {
        ...(token
          ? { Authorization: `Bearer ${token}` }
          : { 'X-SFM-Free-Admin': FREE_ACCESS_HEADER }),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      onToast({ tone: 'error', message: payload.message || 'Account action failed.' });
      return;
    }

    onReload();
    onToast({ tone: 'success', message: successMessage });
  };

  const deactivateAccount = (adminUser: UserRoleProfile) => {
    const confirmed = window.confirm(`Deactivate ${adminUser.email || adminUser.user_id}? They will lose dashboard access.`);
    if (!confirmed) return;
    void callAccountAction({ userId: adminUser.user_id }, 'Account deactivated.');
  };

  const resetPassword = (adminUser: UserRoleProfile) => {
    const nextPassword = window.prompt(`Enter a new temporary password for ${adminUser.email || adminUser.user_id}.`);
    if (!nextPassword) return;
    void callAccountAction(
      { action: 'reset_password', userId: adminUser.user_id, password: nextPassword },
      'Password reset successfully.',
    );
  };

  const createLocalFallbackAccount = async () => {
    if (!email.trim().includes('@')) {
      setError('Enter a valid email address.');
      return false;
    }

    if (!password || password.length < 8) {
      setError('Temporary password must be at least 8 characters.');
      return false;
    }

    if (role === 'attendant' && !assignedOutlet) {
      setError('Select an assigned outlet for this attendant.');
      return false;
    }

    const avatarUrl = avatarFile ? await fileToDataUrl(avatarFile) : null;
    const localUser: UserRoleProfile = {
      user_id: crypto.randomUUID(),
      email: email.trim().toLowerCase(),
      full_name: fullName.trim() || null,
      avatar_url: avatarUrl,
      role,
      assigned_outlet: role === 'attendant' ? assignedOutlet : null,
      is_approved: true,
      is_active: true,
      invited_by: 'local-free-access',
      created_at: new Date().toISOString(),
      last_login_at: null,
    };

    onLocalUsersChange(writeLocalAdminUser(localUser));
    onToast({
      tone: 'success',
      message: 'Access saved locally for free-access mode. No email was sent.',
    });
    return true;
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setSaving(true);

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;

    const { response, payload } = await fetchAdminUsersApi({
      method: 'POST',
      headers: {
        ...(token
          ? { Authorization: `Bearer ${token}` }
          : { 'X-SFM-Free-Admin': FREE_ACCESS_HEADER }),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        fullName,
        password,
        role,
        assignedOutlet,
      }),
    });

    if (!response.ok) {
      setSaving(false);
      const serviceUnavailable =
        response.status === 404 ||
        payload.message?.includes('Account service is not available') ||
        payload.message?.includes('Could not reach the account service');
      if (serviceUnavailable) {
        setSaving(true);
        const fallbackCreated = await createLocalFallbackAccount();
        setSaving(false);
        if (fallbackCreated) {
          resetForm();
          onOpenChange(false);
        }
        return;
      }

      setError(payload.message || `Could not create account. Server returned ${response.status || 'an error'}.`);
      return;
    }

    let avatarUploaded = true;
    if (avatarFile && payload.userId) {
      try {
        await uploadAvatarForUser(payload.userId, avatarFile);
      } catch (avatarError) {
        avatarUploaded = false;
        console.error('Avatar upload failed', avatarError);
      }
    }

    setSaving(false);
    resetForm();
    onOpenChange(false);
    onReload();
    onToast({
      tone: avatarUploaded ? 'success' : 'error',
      message: avatarUploaded
        ? 'Account created successfully.'
        : 'Account created, but avatar upload failed. You can retry the photo later.',
    });
  };

  return (
    <div className="mt-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-gray-800">Admin &amp; Attendant Accounts</h3>
          <p className="text-xs text-gray-500">
            Create outlet attendants or additional admins. Auth admin calls run through a Netlify function.
          </p>
        </div>
        <button
          type="button"
          onClick={() => onOpenChange(!open)}
          className="inline-flex items-center gap-2 rounded-full bg-brand-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-brand-700"
        >
          <Users className="h-4 w-4" />
          {open ? 'Close Form' : 'Create Account'}
        </button>
      </div>

      {open && (
        <form onSubmit={submit} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <div className="grid gap-3 md:grid-cols-2">
            <AvatarUploader
              fullName={fullName}
              email={email}
              file={avatarFile}
              previewUrl={avatarPreviewUrl}
              onFileChange={(file, previewUrl) => {
                setAvatarFile(file);
                setAvatarPreviewUrl(previewUrl);
              }}
            />
            <FormField label="Email" value={email} onChange={setEmail} placeholder="attendant@shopforme.ug" />
            <FormField label="Full Name" value={fullName} onChange={setFullName} placeholder="Jane Admin" />
            <FormField label="Temporary Password" value={password} onChange={setPassword} type="password" placeholder="Minimum 8 characters" />
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-gray-600">Role</span>
              <select
                value={role}
                onChange={(event) => {
                  const nextRole = event.target.value as 'admin' | 'attendant';
                  setRole(nextRole);
                  if (nextRole === 'admin') setAssignedOutlet('');
                }}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none transition focus:border-brand-400 focus:bg-white focus:ring-2 focus:ring-brand-100"
              >
                <option value="attendant">Market Attendant</option>
                <option value="admin">Admin</option>
              </select>
            </label>
            {role === 'attendant' && (
              <label className="block md:col-span-2">
                <span className="mb-1 block text-xs font-semibold text-gray-600">Assigned Outlet</span>
                <select
                  value={assignedOutlet}
                  onChange={(event) => setAssignedOutlet(event.target.value)}
                  required
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none transition focus:border-brand-400 focus:bg-white focus:ring-2 focus:ring-brand-100"
                >
                  <option value="">Select outlet</option>
                  {outlets.map((outlet) => (
                    <option key={outlet.outlet_code} value={outlet.outlet_code}>
                      {formatOutletOption(outlet)}
                    </option>
                  ))}
                </select>
                {selectedAssignedOutlet && (
                  <p className="mt-1 text-xs font-medium text-gray-500">
                    Covers: {formatDistributionAreas(selectedAssignedOutlet)}
                  </p>
                )}
              </label>
            )}
          </div>
          {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={saving}
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-brand-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-brand-700 disabled:bg-gray-300"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            Create Access
          </button>
        </form>
      )}

      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Outlet</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Last Login</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map((adminUser) => (
                <tr key={adminUser.user_id}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <UserAvatar user={adminUser} size="sm" />
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-800">{adminUser.full_name || 'Unnamed'}</p>
                        <p className="truncate text-xs text-gray-500">{adminUser.email || adminUser.user_id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 capitalize">{adminUser.role}</td>
                  <td className="px-4 py-3">
                    {adminUser.assigned_outlet
                      ? formatOutletOption(findOutletByCode(outlets, adminUser.assigned_outlet) ?? {
                          outlet_code: adminUser.assigned_outlet,
                          name: adminUser.assigned_outlet,
                          division: 'Unknown outlet',
                          distribution_areas: [],
                          is_active: false,
                        })
                      : '-'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${adminUser.is_active === false ? 'bg-red-50 text-red-600' : 'bg-brand-50 text-brand-700'}`}>
                      {adminUser.is_active === false ? 'Suspended' : 'Active'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{adminUser.last_login_at ? new Date(adminUser.last_login_at).toLocaleString() : 'Never'}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingUser(adminUser)}
                        className="inline-flex items-center gap-1 rounded-full border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 transition hover:border-brand-300 hover:bg-brand-50"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => resetPassword(adminUser)}
                        className="rounded-full border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 transition hover:border-brand-300 hover:bg-brand-50"
                      >
                        Reset
                      </button>
                      <button
                        type="button"
                        onClick={() => deactivateAccount(adminUser)}
                        disabled={adminUser.is_active === false}
                        className="rounded-full border border-red-100 px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:border-red-200 hover:bg-red-50 disabled:cursor-not-allowed disabled:text-gray-300"
                      >
                        Deactivate
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {editingUser && (
        <EditAccountModal
          user={editingUser}
          outlets={outlets}
          onClose={() => setEditingUser(null)}
          onReload={onReload}
          onLocalUsersChange={onLocalUsersChange}
          onToast={onToast}
        />
      )}
    </div>
  );
}

function EditAccountModal({
  user,
  outlets,
  onClose,
  onReload,
  onLocalUsersChange,
  onToast,
}: {
  user: UserRoleProfile;
  outlets: Outlet[];
  onClose: () => void;
  onReload: () => void;
  onLocalUsersChange: (users: UserRoleProfile[]) => void;
  onToast: (toast: { tone: 'success' | 'error'; message: string }) => void;
}) {
  const [fullName, setFullName] = useState(user.full_name ?? '');
  const [role, setRole] = useState<'admin' | 'attendant'>(
    user.role === 'attendant' ? 'attendant' : 'admin',
  );
  const [assignedOutlet, setAssignedOutlet] = useState(user.assigned_outlet ?? '');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState(user.avatar_url ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const selectedAssignedOutlet = findOutletByCode(outlets, assignedOutlet);
  const isLocalFreeUser = user.invited_by === 'local-free-access';

  const save = async (event: FormEvent) => {
    event.preventDefault();
    setError('');

    if (!fullName.trim()) {
      setError('Full name is required.');
      return;
    }

    if (role === 'attendant' && !assignedOutlet) {
      setError('Select an assigned outlet for this attendant.');
      return;
    }

    setSaving(true);

    try {
      const avatarChanged = avatarPreviewUrl !== (user.avatar_url ?? '') || Boolean(avatarFile);
      let avatarUrl: string | null | undefined;

      if (avatarChanged) {
        if (avatarFile) {
          avatarUrl = isLocalFreeUser
            ? await fileToDataUrl(avatarFile)
            : await uploadAvatarForUser(user.user_id, avatarFile, Boolean(user.avatar_url));
        } else {
          avatarUrl = null;
          if (!isLocalFreeUser && user.avatar_url) {
            await deleteUserAvatarFiles(user.user_id);
          }
        }
      }

      const patch: Partial<UserRoleProfile> = {
        full_name: fullName.trim(),
        role,
        assigned_outlet: role === 'attendant' ? assignedOutlet : null,
      };

      if (avatarChanged) {
        patch.avatar_url = avatarUrl ?? null;
      }

      if (isLocalFreeUser) {
        onLocalUsersChange(updateLocalAdminUser(user.user_id, patch));
        setSaving(false);
        onClose();
        onToast({ tone: 'success', message: 'Account updated successfully.' });
        return;
      }

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      const { response, payload } = await fetchAdminUsersApi({
        method: 'PATCH',
        headers: {
          ...(token
            ? { Authorization: `Bearer ${token}` }
            : { 'X-SFM-Free-Admin': FREE_ACCESS_HEADER }),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'update_account',
          userId: user.user_id,
          fullName: fullName.trim(),
          role,
          assignedOutlet: role === 'attendant' ? assignedOutlet : null,
          avatarUrl,
        }),
      });

      setSaving(false);

      if (!response.ok) {
        setError(payload.message || 'Could not update account.');
        return;
      }

      onReload();
      onClose();
      onToast({ tone: 'success', message: 'Account updated successfully.' });
    } catch (saveError) {
      setSaving(false);
      setError(saveError instanceof Error ? saveError.message : 'Could not update account.');
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={saving ? undefined : onClose} />
      <div className="relative w-full max-w-2xl rounded-t-3xl bg-white p-5 shadow-2xl animate-slide-up sm:rounded-3xl">
        <div className="flex items-start justify-between gap-3 border-b border-gray-100 pb-4">
          <div>
            <h2 className="text-base font-bold text-gray-800">Edit Account</h2>
            <p className="text-xs text-gray-500">Update access details, outlet assignment, and profile photo.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="grid h-9 w-9 place-items-center rounded-full text-gray-500 transition hover:bg-gray-100 disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={save} className="mt-4 grid gap-3 md:grid-cols-2">
          <AvatarUploader
            fullName={fullName}
            email={user.email ?? ''}
            file={avatarFile}
            previewUrl={avatarPreviewUrl}
            onFileChange={(file, previewUrl) => {
              setAvatarFile(file);
              setAvatarPreviewUrl(previewUrl);
            }}
          />
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-gray-600">Email</span>
            <input
              value={user.email || user.user_id}
              readOnly
              className="w-full cursor-not-allowed rounded-xl border border-gray-200 bg-gray-100 px-3 py-2.5 text-sm text-gray-500 outline-none"
            />
            <span className="mt-1 block text-[11px] font-medium text-gray-400">
              Email cannot be changed here.
            </span>
          </label>
          <FormField label="Full Name" value={fullName} onChange={setFullName} placeholder="Jane Admin" />
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-gray-600">Role</span>
            <select
              value={role}
              onChange={(event) => {
                const nextRole = event.target.value as 'admin' | 'attendant';
                setRole(nextRole);
                if (nextRole === 'admin') setAssignedOutlet('');
              }}
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none transition focus:border-brand-400 focus:bg-white focus:ring-2 focus:ring-brand-100"
            >
              <option value="attendant">Market Attendant</option>
              <option value="admin">Admin</option>
            </select>
          </label>
          {role === 'attendant' && (
            <label className="block md:col-span-2">
              <span className="mb-1 block text-xs font-semibold text-gray-600">Assigned Outlet</span>
              <select
                value={assignedOutlet}
                onChange={(event) => setAssignedOutlet(event.target.value)}
                required
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none transition focus:border-brand-400 focus:bg-white focus:ring-2 focus:ring-brand-100"
              >
                <option value="">Select outlet</option>
                {outlets.map((outlet) => (
                  <option key={outlet.outlet_code} value={outlet.outlet_code}>
                    {formatOutletOption(outlet)}
                  </option>
                ))}
              </select>
              {selectedAssignedOutlet && (
                <p className="mt-1 text-xs font-medium text-gray-500">
                  Covers: {formatDistributionAreas(selectedAssignedOutlet)}
                </p>
              )}
            </label>
          )}

          {error && (
            <p className="md:col-span-2 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-600">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2 md:col-span-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-full border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-full bg-brand-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-brand-700 disabled:bg-gray-300"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

type ReportPreset = 'today' | 'week' | 'month' | 'custom';

function ReportsTab({
  orders,
  outlets,
  loading,
}: {
  orders: Order[];
  outlets: Outlet[];
  loading: boolean;
}) {
  const [preset, setPreset] = useState<ReportPreset>('today');
  const [customStart, setCustomStart] = useState(formatDateInput(new Date()));
  const [customEnd, setCustomEnd] = useState(formatDateInput(new Date()));
  const [selectedOutlet, setSelectedOutlet] = useState('all');
  const range = getReportDateRange(preset, customStart, customEnd);

  const completedSales = useMemo(() => {
    return orders
      .filter((order) => order.order_status === 'Delivered' && order.payment_status === 'PAID')
      .filter((order) => {
        const createdAt = new Date(order.created_at);
        return createdAt >= range.start && createdAt <= range.end;
      })
      .filter((order) => selectedOutlet === 'all' || order.outlet_code === selectedOutlet)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [orders, range.end, range.start, selectedOutlet]);

  const totalSales = completedSales.reduce((sum, order) => sum + getOrderTotal(order), 0);
  const orderCount = completedSales.length;
  const itemsSold = completedSales.reduce(
    (sum, order) => sum + order.items.reduce((itemSum, item) => itemSum + item.quantity, 0),
    0,
  );
  const averageOrderValue = orderCount ? Math.round(totalSales / orderCount) : 0;
  const trend = buildSalesTrend(completedSales, range.start, range.end, preset);

  const exportCsv = () => {
    const rows = [
      ['Order ID', 'Date/Time', 'Client Name', 'Outlet', 'Items', 'Total Amount', 'Payment Method'],
      ...completedSales.map((order) => [
        order.id,
        new Date(order.created_at).toLocaleString(),
        order.contact_name,
        formatOutletName(order.outlet_code, outlets),
        formatItemsSummary(order),
        String(getOrderTotal(order)),
        getPaymentMethod(order),
      ]),
    ];
    const csv = rows.map((row) => row.map(escapeCsvCell).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `sfm-sales-report-${formatDateInput(range.start)}-to-${formatDateInput(range.end)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <LoadingState label="Loading sales reports..." />;

  return (
    <div className="mt-4 space-y-4">
      <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="font-bold text-gray-800">Sales Reports</h3>
            <p className="text-xs text-gray-500">
              Delivered and paid orders only.
            </p>
          </div>
          <button
            type="button"
            onClick={exportCsv}
            disabled={completedSales.length === 0}
            className="inline-flex items-center gap-2 rounded-full border border-gray-200 px-4 py-2 text-sm font-bold text-gray-700 transition hover:border-brand-300 hover:bg-brand-50 disabled:cursor-not-allowed disabled:text-gray-300"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {([
            ['today', 'Today'],
            ['week', 'This Week'],
            ['month', 'This Month'],
            ['custom', 'Custom Range'],
          ] as Array<[ReportPreset, string]>).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setPreset(value)}
              className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
                preset === value
                  ? 'bg-brand-600 text-white'
                  : 'border border-gray-200 bg-white text-gray-600 hover:border-brand-300 hover:bg-brand-50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_1.2fr]">
          {preset === 'custom' ? (
            <>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-gray-600">Start Date</span>
                <input
                  type="date"
                  value={customStart}
                  onChange={(event) => setCustomStart(event.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none transition focus:border-brand-400 focus:bg-white focus:ring-2 focus:ring-brand-100"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-gray-600">End Date</span>
                <input
                  type="date"
                  value={customEnd}
                  onChange={(event) => setCustomEnd(event.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none transition focus:border-brand-400 focus:bg-white focus:ring-2 focus:ring-brand-100"
                />
              </label>
            </>
          ) : (
            <div className="flex items-center gap-2 rounded-xl bg-gray-50 px-3 py-2.5 text-sm font-semibold text-gray-600 md:col-span-2">
              <CalendarDays className="h-4 w-4 text-brand-600" />
              {range.start.toLocaleDateString()} - {range.end.toLocaleDateString()}
            </div>
          )}
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-gray-600">Filter by Outlet</span>
            <select
              value={selectedOutlet}
              onChange={(event) => setSelectedOutlet(event.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none transition focus:border-brand-400 focus:bg-white focus:ring-2 focus:ring-brand-100"
            >
              <option value="all">All Outlets</option>
              {outlets.map((outlet) => (
                <option key={outlet.outlet_code} value={outlet.outlet_code}>
                  {outlet.hub_market || outlet.name} ({outlet.outlet_code})
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={<TrendingUp className="h-5 w-5" />} label="Total Sales" value={formatUGX(totalSales)} tone="gold" />
        <StatCard icon={<ClipboardList className="h-5 w-5" />} label="Number of Orders" value={String(orderCount)} tone="brand" />
        <StatCard icon={<BarChart3 className="h-5 w-5" />} label="Average Order Value" value={formatUGX(averageOrderValue)} tone="gold" />
        <StatCard icon={<Boxes className="h-5 w-5" />} label="Items Sold" value={String(itemsSold)} tone="brand" />
      </div>

      {completedSales.length === 0 ? (
        <EmptyState
          icon={<BarChart3 className="h-9 w-9" />}
          title="No paid deliveries in this period"
          text="Completed paid sales will appear here once orders are delivered."
        />
      ) : (
        <>
          <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-bold text-gray-800">Sales Trend</h3>
              <span className="text-xs font-semibold text-gray-400">Daily totals</span>
            </div>
            <div className="mt-4 flex h-56 items-end gap-2 overflow-x-auto border-b border-gray-100 pb-3">
              {trend.map((point) => (
                <div key={point.key} className="flex min-w-12 flex-1 flex-col items-center gap-2">
                  <div className="flex h-40 w-full items-end justify-center rounded-t-xl bg-gray-50 px-2">
                    <div
                      className="w-full rounded-t-lg bg-brand-600 transition"
                      style={{ height: `${point.percent}%`, minHeight: point.total > 0 ? 8 : 0 }}
                      title={`${point.label}: ${formatUGX(point.total)}`}
                    />
                  </div>
                  <span className="text-[11px] font-semibold text-gray-500">{point.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-4 py-3">Order ID</th>
                    <th className="px-4 py-3">Date/Time</th>
                    <th className="px-4 py-3">Client</th>
                    <th className="px-4 py-3">Outlet</th>
                    <th className="px-4 py-3">Items</th>
                    <th className="px-4 py-3">Total Amount</th>
                    <th className="px-4 py-3">Payment Method</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {completedSales.map((order) => (
                    <tr key={order.id}>
                      <td className="px-4 py-3 font-semibold text-gray-800">#{order.id.slice(0, 8).toUpperCase()}</td>
                      <td className="px-4 py-3 text-gray-500">{new Date(order.created_at).toLocaleString()}</td>
                      <td className="px-4 py-3">{order.contact_name}</td>
                      <td className="px-4 py-3 text-gray-500">{formatOutletName(order.outlet_code, outlets)}</td>
                      <td className="px-4 py-3 text-gray-500">{formatItemsSummary(order)}</td>
                      <td className="px-4 py-3 font-bold text-brand-700">{formatUGX(getOrderTotal(order))}</td>
                      <td className="px-4 py-3 text-gray-500">{getPaymentMethod(order)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function AuditAndOutletPerformanceTab({
  orders,
  outlets,
  logs,
  users,
  loading,
}: {
  orders: Order[];
  outlets: Outlet[];
  logs: AdminAuditLog[];
  users: UserRoleProfile[];
  loading: boolean;
}) {
  const performance = outlets.map((outlet) => {
    const outletOrders = orders.filter((order) => order.outlet_code === outlet.outlet_code);
    return {
      outlet,
      total: outletOrders.length,
      processing: outletOrders.filter((order) => order.order_status === 'Processing').length,
      transit: outletOrders.filter((order) => order.order_status === 'Transit').length,
      delivered: outletOrders.filter((order) => order.order_status === 'Delivered').length,
    };
  });

  if (loading) return <LoadingState label="Loading outlet performance..." />;

  return (
    <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1.1fr]">
      <div className="space-y-3">
        {performance.map((item) => (
          <div key={item.outlet.outlet_code} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-bold text-gray-800">{item.outlet.name}</p>
                <p className="text-xs text-gray-500">
                  {item.outlet.outlet_code} - {item.outlet.division}
                </p>
              </div>
              <span className="rounded-full bg-brand-50 px-3 py-1 text-sm font-bold text-brand-700">{item.total}</span>
            </div>
            <p className="mt-2 text-xs text-gray-500">
              Covers: {formatDistributionAreas(item.outlet)}
            </p>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
              <Metric label="Processing" value={item.processing} />
              <Metric label="Transit" value={item.transit} />
              <Metric label="Delivered" value={item.delivered} />
            </div>
          </div>
        ))}
      </div>
      <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
        <h3 className="font-bold text-gray-800">Share Audit Log</h3>
        <div className="mt-3 space-y-3">
          {logs.length === 0 ? (
            <p className="text-sm text-gray-500">No audit logs yet.</p>
          ) : (
            logs.map((log) => {
              const actor = getAuditActorProfile(log, users);
              return (
                <div key={log.id} className="flex gap-3 rounded-xl bg-gray-50 p-3 text-sm">
                  <UserAvatar user={actor} size="sm" />
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-800">{log.action.replace(/_/g, ' ')}</p>
                    <p className="text-xs text-gray-500">
                      Order #{log.target_id.slice(0, 8).toUpperCase()} - {new Date(String(log.metadata.shared_at ?? log.created_at)).toLocaleString()}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      Actor: {formatAuditActor(log.actor_user_id, users, log)}
                      {typeof log.metadata.outlet_code === 'string' ? ` - Outlet: ${log.metadata.outlet_code}` : ''}
                    </p>
                    {log.metadata.manual_override === true && (
                      <span className="mt-2 inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700">
                        Manual override
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

function RiderDispatchModal({
  order,
  riders,
  onClose,
  onDispatch,
}: {
  order: Order;
  riders: OutletRider[];
  onClose: () => void;
  onDispatch: (rider: OutletRider) => void;
}) {
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-t-3xl bg-white p-5 shadow-2xl animate-slide-up sm:rounded-3xl">
        <h2 className="text-base font-bold text-gray-800">Dispatch Rider</h2>
        <p className="mt-1 text-sm text-gray-500">
          Select a Boda-boda rider for #{order.id.slice(0, 8).toUpperCase()}.
        </p>
        <div className="mt-4 space-y-2">
          {riders.map((rider) => (
            <div key={rider.id} className="flex items-center justify-between gap-3 rounded-2xl border border-gray-100 p-3">
              <div>
                <p className="font-semibold text-gray-800">{rider.name}</p>
                <a href={`tel:${rider.phone}`} className="text-sm font-medium text-brand-700">
                  {rider.phone}
                </a>
              </div>
              <button type="button" onClick={() => onDispatch(rider)} className="rounded-full bg-gold-500 px-3 py-1.5 text-xs font-bold text-white">
                Dispatch
              </button>
            </div>
          ))}
          {riders.length === 0 && <p className="text-sm text-gray-500">No riders configured for this outlet.</p>}
        </div>
      </div>
    </div>
  );
}

function OrderShell({ order, children }: { order: Order; children: React.ReactNode }) {
  const statusDisplay = getStatusDisplay(order.order_status ?? order.status);

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-gray-800">#{order.id.slice(0, 8).toUpperCase()}</p>
          <p className="text-xs text-gray-400">{new Date(order.created_at).toLocaleString()}</p>
        </div>
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${statusDisplay.badgeClass}`}
        >
          {statusDisplay.label}
        </span>
      </div>
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
        <InfoLine icon={<User className="h-3.5 w-3.5" />} text={order.contact_name} />
        <InfoLine icon={<Phone className="h-3.5 w-3.5" />} text={order.phone} />
        <InfoLine icon={<MapPin className="h-3.5 w-3.5" />} text={order.delivery_address} />
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-gray-50 p-3">
        <div className="text-xs text-gray-500">
          <p>{order.items.length} item(s)</p>
          <p className="font-bold text-brand-700">{formatUGX((order.subtotal ?? 0) + (order.delivery_fee ?? 0))}</p>
        </div>
        {children}
      </div>
    </div>
  );
}

function LoadingState({ label }: { label: string }) {
  return (
    <div className="py-10 text-center text-sm text-gray-400">
      <Loader2 className="mx-auto h-6 w-6 animate-spin" />
      <p className="mt-2">{label}</p>
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
    <div className="mt-4 rounded-2xl border border-dashed border-gray-200 bg-white py-12 text-center">
      <div className="mx-auto grid h-12 w-12 place-items-center text-gray-300">{icon}</div>
      <p className="mt-2 text-sm font-semibold text-gray-600">{title}</p>
      <p className="text-xs text-gray-400">{text}</p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-gray-50 px-2 py-3">
      <p className="text-lg font-extrabold text-gray-800">{value}</p>
      <p className="text-[11px] font-semibold text-gray-500">{label}</p>
    </div>
  );
}

function normalizeOrder(order: Order): Order {
  const normalizedStatus = normalizeOrderStatus(order.order_status ?? order.status);

  return {
    ...order,
    order_status: normalizedStatus,
    payment_status: order.payment_status ?? 'PENDING',
    is_shared_with_outlet: order.is_shared_with_outlet ?? false,
  };
}

function isDemoOrder(order: Order) {
  return order.id.startsWith(DEMO_ORDER_PREFIX);
}

function getDemoOrdersForDashboard(isAttendant: boolean, assignedOutlet?: string | null) {
  const demoOrders = readDemoOrders().map(normalizeOrder);
  if (!isAttendant) return demoOrders;

  return demoOrders.filter(
    (order) =>
      order.is_shared_with_outlet &&
      Boolean(assignedOutlet) &&
      order.outlet_code === assignedOutlet,
  );
}

function suggestOutletForOrder(order: Order, outlets: Outlet[]) {
  return suggestOutletFromText(
    outlets,
    order.division,
    order.market_location,
    order.delivery_address,
    order.suggested_outlet_code,
    order.outlet_code,
  );
}

function formatAuditActor(actorUserId: string | null | undefined, users: UserRoleProfile[], log?: AdminAuditLog) {
  if (typeof log?.metadata.attendant_name === 'string') return log.metadata.attendant_name;
  if (!actorUserId) return 'System';
  const actor = users.find((user) => user.user_id === actorUserId);
  return actor?.full_name || actor?.email || actorUserId.slice(0, 8);
}

function getAuditActorProfile(log: AdminAuditLog, users: UserRoleProfile[]): UserRoleProfile {
  const actor = users.find((user) => user.user_id === log.actor_user_id);
  if (actor) return actor;

  const attendantName =
    typeof log.metadata.attendant_name === 'string' ? log.metadata.attendant_name : null;

  return {
    user_id: log.actor_user_id || log.id,
    full_name: attendantName || 'System',
    email: null,
    avatar_url: null,
    role: 'admin',
  };
}

function getReportDateRange(preset: ReportPreset, customStart: string, customEnd: string) {
  const now = new Date();
  const start = new Date(now);
  const end = new Date(now);

  if (preset === 'today') {
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  if (preset === 'week') {
    const day = now.getDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    start.setDate(now.getDate() + mondayOffset);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  if (preset === 'month') {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  const customRangeStart = parseDateInput(customStart);
  const customRangeEnd = parseDateInput(customEnd);
  customRangeStart.setHours(0, 0, 0, 0);
  customRangeEnd.setHours(23, 59, 59, 999);

  if (customRangeStart > customRangeEnd) {
    return { start: customRangeEnd, end: customRangeStart };
  }

  return { start: customRangeStart, end: customRangeEnd };
}

function parseDateInput(value: string) {
  if (!value) return new Date();
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
}

function formatDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getOrderTotal(order: Order) {
  return Number(order.total_amount ?? (order.subtotal ?? 0) + (order.delivery_fee ?? 0));
}

function getPaymentMethod(order: Order) {
  return order.payment_method || 'Pay on Delivery';
}

function formatItemsSummary(order: Order) {
  if (!order.items.length) return 'No item details';
  return order.items
    .slice(0, 3)
    .map((item) => `${item.quantity}x ${item.name}`)
    .join(', ')
    .concat(order.items.length > 3 ? ` +${order.items.length - 3} more` : '');
}

function formatOutletName(outletCode: string | null | undefined, outlets: Outlet[]) {
  if (!outletCode) return '-';
  const outlet = findOutletByCode(outlets, outletCode);
  return outlet ? `${outlet.hub_market || outlet.name} (${outlet.outlet_code})` : outletCode;
}

function buildSalesTrend(orders: Order[], start: Date, end: Date, preset: ReportPreset) {
  const points: Array<{ key: string; label: string; total: number; percent: number }> = [];
  const cursor = new Date(start);
  const maxPoints = preset === 'custom' ? 31 : 31;

  cursor.setHours(0, 0, 0, 0);

  while (cursor <= end && points.length < maxPoints) {
    const key = formatDateInput(cursor);
    points.push({
      key,
      label: cursor.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      total: 0,
      percent: 0,
    });
    cursor.setDate(cursor.getDate() + 1);
  }

  orders.forEach((order) => {
    const key = formatDateInput(new Date(order.created_at));
    const point = points.find((item) => item.key === key);
    if (point) point.total += getOrderTotal(order);
  });

  const maxTotal = Math.max(...points.map((point) => point.total), 0);
  return points.map((point) => ({
    ...point,
    percent: maxTotal ? Math.max(6, Math.round((point.total / maxTotal) * 100)) : 0,
  }));
}

function escapeCsvCell(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
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

function SiteSettingsTab({
  settings,
  user,
  profile,
  onSettingsChanged,
  onToast,
  onAuditLogged,
}: {
  settings: SiteSettings;
  user: SupabaseUser | null;
  profile: UserRoleProfile | null;
  onSettingsChanged: (settings: SiteSettings) => void;
  onToast: (toast: { tone: 'success' | 'error'; message: string }) => void;
  onAuditLogged: () => void;
}) {
  const [draft, setDraft] = useState<SiteSettings>(normalizeSiteSettings(settings));
  const [records, setRecords] = useState<SiteSettingRecord[]>([]);
  const [versions, setVersions] = useState<SiteContentVersion[]>([]);
  const [settingsTab, setSettingsTab] = useState<'pages' | 'images' | 'style' | 'versions' | 'locked'>('pages');
  const [saving, setSaving] = useState(false);
  const [previewed, setPreviewed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDraft(normalizeSiteSettings(settings));
    setPreviewed(false);
  }, [settings]);

  useEffect(() => {
    void Promise.all([
      fetchSiteSettingRecords(),
      fetchSiteContentDraft(),
      fetchSiteContentVersions(),
    ]).then(([nextRecords, savedDraft, nextVersions]) => {
      setRecords(nextRecords);
      setVersions(nextVersions);
      if (savedDraft) setDraft(savedDraft);
    });
  }, []);

  const actorName = profile?.full_name || profile?.email || user?.email || 'Admin';

  const updateDraft = <K extends keyof SiteSettings>(key: K, value: SiteSettings[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setPreviewed(false);
    setError(null);
  };

  const updateCategory = (key: string, patch: Partial<CategoryContent>) => {
    updateDraft(
      'categories',
      draft.categories.map((category) =>
        category.key === key ? { ...category, ...patch } : category,
      ),
    );
  };

  const updateTrustBadge = (key: string, patch: Partial<TrustBadgeContent>) => {
    updateDraft(
      'trustBadges',
      draft.trustBadges.map((badge) => (badge.key === key ? { ...badge, ...patch } : badge)),
    );
  };

  const resetSection = (section: 'pages' | 'images' | 'style' | 'hover') => {
    setDraft((current) => resetSettingsSection(current, section));
    setPreviewed(false);
    setError(null);
  };

  const saveDraft = async () => {
    const validationError = validateSiteSettings(draft);
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const savedDraft = await saveSiteContentDraft(draft, user?.id ?? null, actorName);
      setDraft(savedDraft);
      onToast({ tone: 'success', message: 'Draft saved. Preview before publishing.' });
    } catch (draftError) {
      const message = draftError instanceof Error ? draftError.message : 'Could not save draft.';
      setError(message);
      onToast({ tone: 'error', message });
    } finally {
      setSaving(false);
    }
  };

  const previewChanges = () => {
    const validationError = validateSiteSettings(draft);
    if (validationError) {
      setError(validationError);
      return;
    }
    applySiteSettings(draft);
    onSettingsChanged(draft);
    setPreviewed(true);
    setError(null);
  };

  const publishChanges = async () => {
    const validationError = validateSiteSettings(draft);
    if (validationError) {
      setError(validationError);
      return;
    }

    if (!previewed) {
      setError('Preview changes before publishing them live.');
      return;
    }

    if (!window.confirm('Publish this CMS draft to the live site?')) return;

    setSaving(true);
    setError(null);

    const changes = Object.entries(draft)
      .filter(([key, value]) => settings[key as keyof SiteSettings] !== value)
      .map(([key, value]) => ({
        setting_key: key,
        old_value: settings[key as keyof SiteSettings],
        new_value: value,
      }));

    try {
      const published = await publishSiteSettings(draft, user?.id ?? null, actorName, changes);

      await supabase.from('admin_audit_logs').insert({
        actor_user_id: user?.id ?? null,
        action: 'site_content_published',
        target_type: 'site_content',
        target_id: 'theme_content',
        metadata: { changes, updated_by_name: actorName },
      });

      onSettingsChanged(published);
      setRecords(await fetchSiteSettingRecords());
      setVersions(await fetchSiteContentVersions());
      onAuditLogged();
      onToast({ tone: 'success', message: 'Site content published.' });
    } catch (publishError) {
      const message =
        publishError instanceof Error ? publishError.message : 'Could not publish site content.';
      setError(message);
      onToast({ tone: 'error', message });
    } finally {
      setSaving(false);
    }
  };

  const rollbackVersion = async (version: SiteContentVersion) => {
    if (!window.confirm(`Rollback live site content to version ${version.version_number}?`)) return;

    setSaving(true);
    setError(null);

    try {
      const published = await rollbackSiteSettings(version, user?.id ?? null, actorName);
      await supabase.from('admin_audit_logs').insert({
        actor_user_id: user?.id ?? null,
        action: 'site_content_rollback',
        target_type: 'site_content',
        target_id: 'theme_content',
        metadata: { rollback_to_version: version.version_number, updated_by_name: actorName },
      });
      setDraft(published);
      onSettingsChanged(published);
      setVersions(await fetchSiteContentVersions());
      onAuditLogged();
      onToast({ tone: 'success', message: `Rolled back to version ${version.version_number}.` });
    } catch (rollbackError) {
      const message =
        rollbackError instanceof Error ? rollbackError.message : 'Could not rollback site content.';
      setError(message);
      onToast({ tone: 'error', message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-4 space-y-4">
      <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-extrabold text-gray-900">Site Settings</h2>
            <p className="text-sm text-gray-500">
              Edit safe branding, copy, and hover behavior without changing the site layout.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={saveDraft}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-bold text-gray-700 transition hover:bg-gray-50 disabled:bg-gray-100"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save Draft
            </button>
            <button
              type="button"
              onClick={previewChanges}
              className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-4 py-2 text-sm font-bold text-brand-700 transition hover:bg-brand-100"
            >
              <Eye className="h-4 w-4" /> Preview Changes
            </button>
            <button
              type="button"
              onClick={publishChanges}
              disabled={saving || !previewed}
              className="inline-flex items-center gap-2 rounded-full bg-brand-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-brand-700 disabled:bg-gray-300"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Publish Changes
            </button>
          </div>
        </div>
        {error && (
          <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-600">
            {error}
          </p>
        )}
      </div>

      <div className="no-scrollbar flex gap-2 overflow-x-auto border-b border-gray-200">
        <SettingsTabButton active={settingsTab === 'pages'} onClick={() => setSettingsTab('pages')}>
          <Pencil className="h-4 w-4" /> Pages
        </SettingsTabButton>
        <SettingsTabButton active={settingsTab === 'images'} onClick={() => setSettingsTab('images')}>
          <ImagePlus className="h-4 w-4" /> Images
        </SettingsTabButton>
        <SettingsTabButton active={settingsTab === 'style'} onClick={() => setSettingsTab('style')}>
          <Type className="h-4 w-4" /> Colors & Style
        </SettingsTabButton>
        <SettingsTabButton active={settingsTab === 'versions'} onClick={() => setSettingsTab('versions')}>
          <History className="h-4 w-4" /> Versions
        </SettingsTabButton>
        <SettingsTabButton active={settingsTab === 'locked'} onClick={() => setSettingsTab('locked')}>
          <Lock className="h-4 w-4" /> Locked
        </SettingsTabButton>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.8fr)]">
        <div className="space-y-4">
          {settingsTab === 'pages' && (
            <>
              <SettingsSection
                title="Homepage Hero"
                note={formatSectionUpdated(records, ['global' as keyof SiteSettings])}
                onReset={() => resetSection('pages')}
              >
                <div className="grid gap-3">
                  <TextAreaField label="Top announcement" value={draft.announcementText} maxLength={180} onChange={(value) => updateDraft('announcementText', value)} />
                  <div className="grid gap-3 sm:grid-cols-3">
                    <TextField label="Hero eyebrow" value={draft.heroEyebrow} maxLength={60} onChange={(value) => updateDraft('heroEyebrow', value)} />
                    <TextField label="Hero title" value={draft.heroTitle} maxLength={45} onChange={(value) => updateDraft('heroTitle', value)} />
                    <TextField label="Hero highlight" value={draft.heroHighlight} maxLength={24} onChange={(value) => updateDraft('heroHighlight', value)} />
                  </div>
                  <TextAreaField label="Hero subtext" value={draft.heroBody} maxLength={220} onChange={(value) => updateDraft('heroBody', value)} />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <TextField label="Primary button" value={draft.shopNowLabel} maxLength={24} onChange={(value) => updateDraft('shopNowLabel', value)} />
                    <TextField label="Secondary button" value={draft.browseCategoriesLabel} maxLength={32} onChange={(value) => updateDraft('browseCategoriesLabel', value)} />
                  </div>
                </div>
              </SettingsSection>

              <SettingsSection title="Category Tiles" note="Edit labels, blurbs, and tile media." onReset={() => resetSection('pages')}>
                <div className="grid gap-3">
                  <TextField label="All category label" value={draft.allCategoryLabel} maxLength={20} onChange={(value) => updateDraft('allCategoryLabel', value)} />
                  {draft.categories.map((category) => (
                    <div key={category.key} className="rounded-2xl border border-gray-100 bg-gray-50 p-3">
                      <p className="mb-3 text-xs font-extrabold uppercase tracking-wide text-gray-500">{category.key}</p>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <TextField label="Display label" value={category.label} maxLength={32} onChange={(value) => updateCategory(category.key, { label: value })} />
                        <TextField label="Short description" value={category.blurb} maxLength={80} onChange={(value) => updateCategory(category.key, { blurb: value })} />
                      </div>
                    </div>
                  ))}
                </div>
              </SettingsSection>

              <SettingsSection title="Trust Badges" note="Edit the footer trust strip." onReset={() => resetSection('pages')}>
                <div className="grid gap-3">
                  {draft.trustBadges.map((badge) => (
                    <div key={badge.key} className="rounded-2xl border border-gray-100 bg-gray-50 p-3">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <TextField label="Title" value={badge.title} maxLength={50} onChange={(value) => updateTrustBadge(badge.key, { title: value })} />
                        <SelectField
                          label="Fallback icon"
                          value={badge.icon}
                          options={[
                            { value: 'truck', label: 'Truck' },
                            { value: 'shield', label: 'Shield' },
                            { value: 'clock', label: 'Clock' },
                          ]}
                          onChange={(value) => updateTrustBadge(badge.key, { icon: value as TrustBadgeContent['icon'] })}
                        />
                      </div>
                      <TextAreaField label="Description" value={badge.description} maxLength={100} onChange={(value) => updateTrustBadge(badge.key, { description: value })} />
                    </div>
                  ))}
                </div>
              </SettingsSection>

              <SettingsSection title="Footer" note="Edit footer copy, category list, contact details, and merchant block." onReset={() => resetSection('pages')}>
                <div className="grid gap-3">
                  <TextAreaField label="About text" value={draft.footerTagline} maxLength={220} onChange={(value) => updateDraft('footerTagline', value)} />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <TextField label="Categories heading" value={draft.footerCategoriesTitle} maxLength={40} onChange={(value) => updateDraft('footerCategoriesTitle', value)} />
                    <TextField label="Contact heading" value={draft.footerContactTitle} maxLength={40} onChange={(value) => updateDraft('footerContactTitle', value)} />
                  </div>
                  <TextAreaField label="Categories list" value={draft.footerCategories.join('\n')} maxLength={180} onChange={(value) => updateDraft('footerCategories', value.split('\n').map((item) => item.trim()).filter(Boolean))} />
                  <div className="grid gap-3 sm:grid-cols-3">
                    <TextField label="Phone" value={draft.footerPhone} maxLength={40} onChange={(value) => updateDraft('footerPhone', value)} />
                    <TextField label="Email" value={draft.footerEmail} maxLength={80} onChange={(value) => updateDraft('footerEmail', value)} />
                    <TextField label="Address" value={draft.footerAddress} maxLength={100} onChange={(value) => updateDraft('footerAddress', value)} />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <TextField label="Shop keepers title" value={draft.footerShopkeepersTitle} maxLength={50} onChange={(value) => updateDraft('footerShopkeepersTitle', value)} />
                    <TextField label="Payment line" value={draft.footerPaymentText} maxLength={80} onChange={(value) => updateDraft('footerPaymentText', value)} />
                  </div>
                  <TextAreaField label="Shop keepers text" value={draft.footerShopkeepersText} maxLength={180} onChange={(value) => updateDraft('footerShopkeepersText', value)} />
                </div>
              </SettingsSection>
            </>
          )}

          {settingsTab === 'images' && (
            <>
              <SettingsSection title="Hero & Decorative Media" note="Upload JPG, PNG, or WebP assets. Replacing an image removes the previous site asset file." onReset={() => resetSection('images')}>
                <div className="grid gap-4 sm:grid-cols-2">
                  <SiteAssetUploader label="Hero background image" value={draft.heroBackgroundImageUrl} assetKey="hero-background" onChange={(value) => updateDraft('heroBackgroundImageUrl', value)} />
                  <SiteAssetUploader label="Decorative product-adjacent image" value={draft.decorativeImageUrl} assetKey="decorative-product" onChange={(value) => updateDraft('decorativeImageUrl', value)} />
                </div>
              </SettingsSection>

              <SettingsSection title="Category Tile Media" note="Default image is always used; hover image appears only when hover swap is enabled." onReset={() => resetSection('images')}>
                <div className="grid gap-4">
                  {draft.categories.map((category) => (
                    <div key={category.key} className="rounded-2xl border border-gray-100 bg-gray-50 p-3">
                      <p className="mb-3 text-sm font-extrabold text-gray-800">{category.label}</p>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <SiteAssetUploader label="Default tile image" value={category.imageUrl} assetKey={`category-${category.key}-default`} onChange={(value) => updateCategory(category.key, { imageUrl: value })} />
                        <SiteAssetUploader label="Hover tile image" value={category.hoverImageUrl} assetKey={`category-${category.key}-hover`} onChange={(value) => updateCategory(category.key, { hoverImageUrl: value })} />
                      </div>
                      <div className="mt-3">
                        <ToggleField label="Enable hover image swap" checked={category.hoverSwapEnabled} onChange={(checked) => updateCategory(category.key, { hoverSwapEnabled: checked })} />
                      </div>
                    </div>
                  ))}
                </div>
              </SettingsSection>

              <SettingsSection title="Trust Badge Images" note="Optional custom images override the selected fallback icons." onReset={() => resetSection('images')}>
                <div className="grid gap-4 sm:grid-cols-3">
                  {draft.trustBadges.map((badge) => (
                    <SiteAssetUploader key={badge.key} label={badge.title} value={badge.imageUrl} assetKey={`trust-${badge.key}`} onChange={(value) => updateTrustBadge(badge.key, { imageUrl: value })} />
                  ))}
                </div>
              </SettingsSection>
            </>
          )}

          {settingsTab === 'style' && (
            <>
              <SettingsSection title="Colors & Branding" note={formatSectionUpdated(records, ['global' as keyof SiteSettings])} onReset={() => resetSection('style')}>
                <div className="grid gap-3 sm:grid-cols-2">
                  <ColorField label="Primary brand color" value={draft.primaryColor} onChange={(value) => updateDraft('primaryColor', value)} />
                  <ColorField label="Navigation bar color" value={draft.navigationBarColor} onChange={(value) => updateDraft('navigationBarColor', value)} />
                  <ColorField label="Accent / secondary color" value={draft.accentColor} onChange={(value) => updateDraft('accentColor', value)} />
                  <ColorField label="Button hover color" value={draft.buttonHoverColor} onChange={(value) => updateDraft('buttonHoverColor', value)} />
                  <ColorField label="Nav link hover color" value={draft.navLinkHoverColor} onChange={(value) => updateDraft('navLinkHoverColor', value)} />
                  <ColorField label="Page background" value={draft.pageBackgroundColor} onChange={(value) => updateDraft('pageBackgroundColor', value)} />
                  <ColorField label="Surface / card background" value={draft.surfaceBackgroundColor} onChange={(value) => updateDraft('surfaceBackgroundColor', value)} />
                </div>
              </SettingsSection>

              <SettingsSection title="Typography & Interaction States" note="Presets keep the live layout stable." onReset={() => resetSection('hover')}>
                <div className="grid gap-3 sm:grid-cols-2">
                  <SelectField
                    label="Heading font scale"
                    value={draft.headingScale}
                    options={[
                      { value: 'small', label: 'Small' },
                      { value: 'medium', label: 'Medium' },
                      { value: 'large', label: 'Large' },
                    ]}
                    onChange={(value) => updateDraft('headingScale', value as SiteSettings['headingScale'])}
                  />
                  <ToggleField label="Button scale on hover" checked={draft.buttonScaleHoverEnabled} onChange={(checked) => updateDraft('buttonScaleHoverEnabled', checked)} />
                  <ToggleField label="Button shadow on hover" checked={draft.buttonShadowHoverEnabled} onChange={(checked) => updateDraft('buttonShadowHoverEnabled', checked)} />
                  <ToggleField label="Card lift on hover" checked={draft.hoverLiftEnabled} onChange={(checked) => updateDraft('hoverLiftEnabled', checked)} />
                  <ToggleField label="Card shadow on hover" checked={draft.cardShadowHoverEnabled} onChange={(checked) => updateDraft('cardShadowHoverEnabled', checked)} />
                  <ToggleField label="Navigation hover state" checked={draft.navLinkHoverEnabled} onChange={(checked) => updateDraft('navLinkHoverEnabled', checked)} />
                </div>
              </SettingsSection>
            </>
          )}

          {settingsTab === 'versions' && (
            <SettingsSection title="Published Version History" note="The most recent 5-10 published versions are available for rollback." onReset={() => setVersions([])}>
              <div className="space-y-3">
                {versions.length === 0 ? (
                  <p className="rounded-xl bg-gray-50 px-3 py-3 text-sm text-gray-500">No published versions yet.</p>
                ) : (
                  versions.map((version) => (
                    <div key={version.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-100 bg-gray-50 p-3">
                      <div>
                        <p className="text-sm font-extrabold text-gray-800">Version {version.version_number}</p>
                        <p className="text-xs text-gray-500">
                          Published by {version.published_by_name || 'Admin'} on {new Date(version.published_at || '').toLocaleString()}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void rollbackVersion(version)}
                        className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-white px-3 py-1.5 text-xs font-bold text-brand-700 transition hover:bg-brand-50"
                      >
                        <History className="h-3.5 w-3.5" />
                        Roll Back
                      </button>
                    </div>
                  ))
                )}
              </div>
            </SettingsSection>
          )}

          {settingsTab === 'locked' && (
            <SettingsSection title="Requires Developer Support" note="These areas stay code-only to protect checkout, routing, and database integrity." onReset={() => undefined}>
              <div className="grid gap-3">
                {[
                  ['Page layout and section order', 'Changing layout can break responsive composition and merchant workflows.'],
                  ['Navigation menu structure and routes', 'Routes control storefront, merchant dashboard, attendant workspace, cart, and checkout state.'],
                  ['Checkout and cart logic', 'Payment, order creation, status flow, and Supabase writes must remain tested code.'],
                  ['Database category values', 'Product filtering depends on stable category keys; display labels are editable instead.'],
                  ['Role permissions and RLS policies', 'Access rules are security-critical and must be changed through migrations.'],
                  ['Product data schema', 'Product fields affect catalog, order items, reports, and admin forms.'],
                ].map(([title, reason]) => (
                  <div key={title} className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3">
                    <p className="text-sm font-extrabold text-amber-900">{title}</p>
                    <p className="mt-1 text-xs text-amber-700">{reason}</p>
                  </div>
                ))}
              </div>
            </SettingsSection>
          )}
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm lg:sticky lg:top-24 lg:self-start">
          <p className="text-sm font-extrabold text-gray-900">Live Preview</p>
          <p className="text-xs text-gray-500">Use Preview Changes to apply this draft across the current page.</p>
          <div
            className="mt-4 rounded-2xl border p-4"
            style={{ backgroundColor: draft.pageBackgroundColor }}
          >
            <div
              className="mb-3 flex items-center justify-between rounded-xl px-4 py-3 text-white"
              style={{ backgroundColor: draft.navigationBarColor }}
            >
              <span className="text-sm font-extrabold">Shop For Me</span>
              <span className="rounded-full px-3 py-1 text-xs font-bold" style={{ backgroundColor: draft.primaryColor }}>
                Cart
              </span>
            </div>
            <div className="rounded-2xl p-4 shadow-sm" style={{ backgroundColor: draft.surfaceBackgroundColor }}>
              <span className="inline-flex rounded-full px-3 py-1 text-xs font-bold text-white" style={{ backgroundColor: draft.accentColor }}>
                {draft.heroEyebrow}
              </span>
              <h3 className="mt-3 text-2xl font-extrabold text-gray-900">
                {draft.heroTitle} <span style={{ color: draft.primaryColor }}>{draft.heroHighlight}</span>
              </h3>
              <p className="mt-2 text-sm text-gray-600">{draft.heroBody}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded-full px-4 py-2 text-sm font-bold text-white"
                  style={{ backgroundColor: draft.primaryColor }}
                >
                  {draft.shopNowLabel}
                </button>
                <button
                  type="button"
                  className="rounded-full border px-4 py-2 text-sm font-bold"
                  style={{ borderColor: draft.primaryColor, color: draft.primaryColor }}
                >
                  {draft.browseCategoriesLabel}
                </button>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {draft.categories.slice(0, 3).map((category) => {
                const content = getCategoryContent(draft, category.key);
                return (
                  <div key={category.key} className="rounded-xl bg-white p-2 text-center text-[11px] font-bold text-gray-700 shadow-sm">
                    {content?.imageUrl ? <img src={content.imageUrl} alt="" className="mx-auto mb-1 h-8 w-8 rounded-lg object-cover" /> : null}
                    {category.label}
                  </div>
                );
              })}
            </div>
          </div>
          <p className="mt-4 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-700">
            Drafts are private until Preview Changes and Publish Changes. Layout, routes, checkout, and database category keys remain developer-only.
          </p>
        </div>
      </div>
    </div>
  );
}

function SettingsSection({
  title,
  note,
  onReset,
  children,
}: {
  title: string;
  note: string;
  onReset: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-extrabold text-gray-900">{title}</h3>
          <p className="text-xs text-gray-500">{note}</p>
        </div>
        <button
          type="button"
          onClick={onReset}
          className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 px-3 py-1.5 text-xs font-bold text-gray-600 transition hover:bg-gray-50"
        >
          <RotateCcw className="h-3.5 w-3.5" /> Reset to Default
        </button>
      </div>
      {children}
    </section>
  );
}

function SettingsTabButton({
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
      type="button"
      onClick={onClick}
      className={`flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-sm font-bold transition ${
        active
          ? 'border-brand-600 text-brand-700'
          : 'border-transparent text-gray-500 hover:border-gray-200 hover:text-gray-800'
      }`}
    >
      {children}
    </button>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-gray-600">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm font-semibold text-gray-800 outline-none transition focus:border-brand-400 focus:bg-white focus:ring-2 focus:ring-brand-100"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

const SITE_ASSET_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const SITE_ASSET_MAX_SIZE = 5 * 1024 * 1024;

function SiteAssetUploader({
  label,
  value,
  assetKey,
  onChange,
}: {
  label: string;
  value: string;
  assetKey: string;
  onChange: (value: string) => void;
}) {
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const uploadFile = async (file?: File) => {
    if (!file) return;

    if (!SITE_ASSET_TYPES.includes(file.type)) {
      setError('Upload a JPG, PNG, or WebP image.');
      return;
    }

    if (file.size > SITE_ASSET_MAX_SIZE) {
      setError('Image must be 5MB or smaller.');
      return;
    }

    setUploading(true);
    setError('');

    const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const safeKey = assetKey
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    const path = `${safeKey || 'site-asset'}.${extension}`;
    const previousPath = getSiteAssetPath(value);

    const { error: uploadError } = await supabase.storage
      .from('site-assets')
      .upload(path, file, { upsert: true, contentType: file.type });

    if (uploadError) {
      setUploading(false);
      setError(
        uploadError.message.includes('Bucket not found')
          ? 'Site asset storage is not set up yet. Apply the site-assets migration.'
          : uploadError.message || 'Could not upload image.',
      );
      return;
    }

    if (previousPath && previousPath !== path) {
      await supabase.storage.from('site-assets').remove([previousPath]);
    }

    const { data } = supabase.storage.from('site-assets').getPublicUrl(path);
    onChange(`${data.publicUrl}?v=${Date.now()}`);
    setUploading(false);
  };

  const clearImage = async () => {
    const previousPath = getSiteAssetPath(value);
    if (previousPath) {
      await supabase.storage.from('site-assets').remove([previousPath]);
    }
    onChange('');
    setError('');
  };

  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-3">
        <span className="text-xs font-semibold text-gray-600">{label}</span>
        <span className="text-[11px] text-gray-400">JPG, PNG, WebP up to 5MB</span>
      </div>
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragActive(false);
          void uploadFile(event.dataTransfer.files[0]);
        }}
        className={`rounded-2xl border border-dashed bg-white p-3 transition ${
          dragActive ? 'border-brand-500 bg-brand-50' : 'border-gray-200'
        }`}
      >
        {value ? (
          <div className="overflow-hidden rounded-xl bg-gray-100">
            <img src={value} alt="" className="h-36 w-full object-cover" />
          </div>
        ) : (
          <div className="grid h-36 place-items-center rounded-xl bg-gray-50 text-center">
            <div>
              <ImagePlus className="mx-auto h-6 w-6 text-brand-600" />
              <p className="mt-2 text-xs font-bold text-gray-600">Drop image here</p>
            </div>
          </div>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-bold text-gray-700 transition hover:bg-brand-50">
            {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            {value ? 'Replace' : 'Upload'}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={(event) => void uploadFile(event.target.files?.[0])}
            />
          </label>
          {value && (
            <button
              type="button"
              onClick={() => void clearImage()}
              className="inline-flex items-center gap-1.5 rounded-full border border-red-100 bg-white px-3 py-1.5 text-xs font-bold text-red-600 transition hover:bg-red-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Remove
            </button>
          )}
        </div>
        <label className="mt-3 block">
          <span className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-gray-600">
            <Link className="h-3.5 w-3.5" />
            Or paste image URL
          </span>
          <input
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder="https://..."
            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs outline-none transition focus:border-brand-400 focus:bg-white focus:ring-2 focus:ring-brand-100"
          />
        </label>
        {error && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-600">{error}</p>}
      </div>
    </div>
  );
}

function getSiteAssetPath(publicUrl: string) {
  const marker = '/storage/v1/object/public/site-assets/';
  const [urlWithoutQuery] = publicUrl.split('?');
  const markerIndex = urlWithoutQuery.indexOf(marker);
  if (markerIndex === -1) return '';
  return decodeURIComponent(urlWithoutQuery.slice(markerIndex + marker.length));
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-gray-600">{label}</span>
      <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-2 py-2 focus-within:border-brand-400 focus-within:ring-2 focus-within:ring-brand-100">
        <input
          type="color"
          value={value}
          onChange={(event) => onChange(event.target.value.toUpperCase())}
          className="h-9 w-11 shrink-0 cursor-pointer rounded-lg border-0 bg-transparent p-0"
        />
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-gray-800 outline-none"
        />
      </div>
    </label>
  );
}

function TextField({
  label,
  value,
  maxLength,
  onChange,
}: {
  label: string;
  value: string;
  maxLength: number;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 flex items-center justify-between gap-2 text-xs font-semibold text-gray-600">
        {label}
        <span className="font-medium text-gray-400">{value.length}/{maxLength}</span>
      </span>
      <input
        value={value}
        maxLength={maxLength}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none transition focus:border-brand-400 focus:bg-white focus:ring-2 focus:ring-brand-100"
      />
    </label>
  );
}

function TextAreaField({
  label,
  value,
  maxLength,
  onChange,
}: {
  label: string;
  value: string;
  maxLength: number;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 flex items-center justify-between gap-2 text-xs font-semibold text-gray-600">
        {label}
        <span className="font-medium text-gray-400">{value.length}/{maxLength}</span>
      </span>
      <textarea
        value={value}
        maxLength={maxLength}
        rows={3}
        onChange={(event) => onChange(event.target.value)}
        className="w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none transition focus:border-brand-400 focus:bg-white focus:ring-2 focus:ring-brand-100"
      />
    </label>
  );
}

function ToggleField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3">
      <span className="text-sm font-semibold text-gray-700">{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-5 w-5 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
      />
    </label>
  );
}

function formatSectionUpdated(records: SiteSettingRecord[], keys: Array<keyof SiteSettings>) {
  const newest = records
    .filter((record) => keys.includes(record.setting_key))
    .filter((record) => record.updated_at)
    .sort((a, b) => new Date(b.updated_at || '').getTime() - new Date(a.updated_at || '').getTime())[0];

  if (!newest) return 'Last updated: not published yet.';

  return `Last updated by ${newest.updated_by_name || 'Admin'} on ${new Date(
    newest.updated_at || '',
  ).toLocaleString()}.`;
}

function OrdersTab({
  orders,
  loading,
}: {
  orders: Order[];
  loading: boolean;
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
      {orders.map((o) => {
        const statusDisplay = getStatusDisplay(o.order_status ?? o.status);
        return (
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
            <div className="flex flex-wrap items-center justify-end gap-2">
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${statusDisplay.badgeClass}`}
              >
                <CheckCircle2 className="h-3.5 w-3.5" /> {statusDisplay.label}
              </span>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
            <InfoLine icon={<User className="h-3.5 w-3.5" />} text={o.contact_name} />
            <InfoLine icon={<Phone className="h-3.5 w-3.5" />} text={o.phone} />
            <InfoLine icon={<MapPin className="h-3.5 w-3.5" />} text={o.delivery_address} />
          </div>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <InfoLine
              icon={<Building2 className="h-3.5 w-3.5" />}
              text={`Outlet: ${o.outlet_code || 'Awaiting share'}`}
            />
            <InfoLine
              icon={<Users className="h-3.5 w-3.5" />}
              text={`Handled by: ${o.handled_by_attendant_name || 'Not assigned yet'}`}
            />
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
              <span className="text-sm font-extrabold text-brand-700">{formatUGX(getOrderTotal(o))}</span>
            </div>
          </div>
        </div>
        );
      })}
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
  onDelete,
}: {
  products: Product[];
  onEdit: (p: Product) => void;
  onDelete: (p: Product) => void;
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
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => onEdit(p)}
                      className="inline-flex items-center gap-1 rounded-full border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 transition hover:border-brand-300 hover:bg-brand-50"
                    >
                      <Pencil className="h-3.5 w-3.5" /> Edit
                    </button>
                    <button
                      onClick={() => onDelete(p)}
                      className="inline-flex items-center gap-1 rounded-full border border-red-100 px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:border-red-200 hover:bg-red-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Delete
                    </button>
                  </div>
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
            <ImageUploader value={imageUrl} onChange={setImageUrl} productName={name} />
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
