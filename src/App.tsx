import { useCallback, useEffect, useMemo, useState } from 'react';
import Header, { MerchantToggle } from './components/Header';
import Footer from './components/Footer';
import CategoryBar from './components/CategoryBar';
import ProductGrid, { HeroSection, CategoryHighlights } from './components/ProductGrid';
import CartDrawer from './components/CartDrawer';
import CheckoutModal, { OrderConfirmation } from './components/CheckoutModal';
import MerchantDashboard from './components/MerchantDashboard';
import MerchantSignInModal from './components/MerchantSignInModal';
import AttendantWorkspace from './components/AttendantWorkspace';
import { CartProvider } from './context/CartContext';
import { hasSupabaseConfig, supabase } from './lib/supabase';
import {
  DEFAULT_SITE_SETTINGS,
  fetchSiteSettings,
  type SiteSettings,
} from './lib/siteSettings';
import { useAuth } from './hooks/useAuth';
import { getLatestLocalAttendant, readSharedLocalAdminUsers } from './lib/localAdminUsers';
import type { Category, Order, Outlet, Product, UserRoleProfile } from './types';

type LocalWorkspace = 'client' | 'admin' | 'attendant';
type LocalWorkspaceRole = 'admin' | 'attendant';

const ATTENDANT_LOCAL_PORT = '5174';
const ADMIN_LOCAL_PORT = '5176';
const LOCAL_WORKSPACE_SESSION_KEY = 'sfm-local-workspace-session';
const LOCAL_WORKSPACE_CREDENTIALS: Record<
  LocalWorkspaceRole,
  { label: string; login: string; password: string }
> = {
  admin: {
    label: 'Super Admin & Management',
    login: 'admin@shop4me.local',
    password: 'admin12345',
  },
  attendant: {
    label: 'Local Market Attendant',
    login: 'attendant@shop4me.local',
    password: 'attendant12345',
  },
};

function getLocalWorkspace(): LocalWorkspace {
  if (typeof window === 'undefined') return 'client';
  if (
    window.location.port === ADMIN_LOCAL_PORT ||
    window.location.pathname.startsWith('/merchant') ||
    window.location.pathname.startsWith('/admin')
  ) {
    return 'admin';
  }
  if (
    window.location.port === ATTENDANT_LOCAL_PORT ||
    window.location.pathname.startsWith('/attendant')
  ) {
    return 'attendant';
  }
  return 'client';
}

function readLocalWorkspaceSession(workspace: LocalWorkspace) {
  if (typeof window === 'undefined' || workspace === 'client') return null;
  return window.sessionStorage.getItem(LOCAL_WORKSPACE_SESSION_KEY) === workspace
    ? workspace
    : null;
}

function defaultLocalAttendantProfile(localAttendant: UserRoleProfile | null): UserRoleProfile {
  return localAttendant
    ? {
        ...localAttendant,
        assigned_outlet: localAttendant.assigned_outlet || 'DEPOT-KAW-01',
      }
    : {
        user_id: '00000000-0000-4000-8000-000000000001',
        email: LOCAL_WORKSPACE_CREDENTIALS.attendant.login,
        full_name: 'Local Market Attendant',
        role: 'attendant',
        assigned_outlet: 'DEPOT-KAW-01',
        is_active: true,
        is_approved: true,
      };
}

function App() {
  const localWorkspace = getLocalWorkspace();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<Category | 'All'>('All');
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [selectedOutletCode, setSelectedOutletCode] = useState(() => {
    if (typeof window === 'undefined') return 'DEPOT-KAW-01';
    return window.localStorage.getItem('sfm-selected-outlet-code') || 'DEPOT-KAW-01';
  });
  const [selectedOutletContext, setSelectedOutletContext] = useState<Outlet | null>(null);
  const [selectedAttendantContext, setSelectedAttendantContext] = useState<UserRoleProfile | null>(null);
  const [placedOrder, setPlacedOrder] = useState<Order | null>(null);
  const [merchantMode, setMerchantMode] = useState(localWorkspace === 'admin');
  const [attendantMode, setAttendantMode] = useState(localWorkspace === 'attendant');
  const [localWorkspaceSession, setLocalWorkspaceSession] = useState<LocalWorkspace | null>(() =>
    readLocalWorkspaceSession(localWorkspace),
  );
  const [merchantLoginOpen, setMerchantLoginOpen] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);
  const [siteSettings, setSiteSettings] = useState<SiteSettings>(DEFAULT_SITE_SETTINGS);

  const {
    user,
    role,
    profile,
    loading: authLoading,
    signInWithGoogle,
    signInWithEmail,
    signInWithMerchant,
    signUpWithEmail,
    signOut,
  } = useAuth();

  const freeMerchantAccess = localWorkspace === 'admin' && localWorkspaceSession === 'admin';
  const attendantLocalAccess =
    localWorkspace === 'attendant' && localWorkspaceSession === 'attendant';
  const localAttendant = attendantLocalAccess ? getLatestLocalAttendant() ?? null : null;
  const merchantRole =
    freeMerchantAccess ||
    (profile?.is_active !== false &&
      profile?.is_approved !== false &&
      (role === 'admin' || role === 'attendant' || role === 'merchant'));

  const navigateToMerchantDashboard = () => {
    if (localWorkspace !== 'admin') window.history.pushState({}, '', '/merchant/dashboard');
    setAttendantMode(false);
    setMerchantMode(true);
  };

  const navigateToAttendantWorkspace = () => {
    if (localWorkspace !== 'attendant') window.history.pushState({}, '', '/attendant/workspace');
    setMerchantMode(false);
    setAttendantMode(true);
  };

  const navigateToStorefront = () => {
    window.history.pushState({}, '', '/');
    setMerchantMode(false);
    setAttendantMode(false);
  };

  useEffect(() => {
    if (localWorkspace === 'client') return;
    setMerchantMode(localWorkspace === 'admin');
    setAttendantMode(localWorkspace === 'attendant');
  }, [localWorkspace]);

  useEffect(() => {
    if (localWorkspace !== 'client') return;
    if (!merchantRole) {
      setMerchantMode(false);
    }
  }, [localWorkspace, merchantRole]);

  useEffect(() => {
    if (localWorkspace !== 'client') return;

    const syncRoute = () => {
      const merchantPath = window.location.pathname.startsWith('/merchant');
      const attendantPath = window.location.pathname.startsWith('/attendant');
      if (!merchantPath && !attendantPath) return;

      if (attendantPath) {
        if (freeMerchantAccess || role === 'attendant') {
          setAttendantMode(true);
          setMerchantMode(false);
          setMerchantLoginOpen(false);
          return;
        }

        if (!authLoading) {
          if (role === 'admin' || role === 'merchant') {
            navigateToMerchantDashboard();
          } else {
            navigateToStorefront();
          }
        }
        return;
      }

      if (merchantRole) {
        setMerchantMode(true);
        setAttendantMode(false);
        setMerchantLoginOpen(false);
        return;
      }

      if (!authLoading) {
        setMerchantMode(false);
        setAttendantMode(false);
        setMerchantLoginOpen(true);
        window.history.replaceState({}, '', '/');
      }
    };

    syncRoute();
    window.addEventListener('popstate', syncRoute);
    return () => window.removeEventListener('popstate', syncRoute);
  }, [authLoading, localWorkspace, merchantRole]);

  const loadProducts = async () => {
    setLoading(true);
    setDbError(null);

    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      setProducts([]);
      setDbError(error.message || 'Unable to load products right now.');
    } else {
      setProducts((data as Product[]) ?? []);
    }

    setLoading(false);
  };

  useEffect(() => {
    void loadProducts();
  }, []);

  useEffect(() => {
    void fetchSiteSettings().then(setSiteSettings);
    void readSharedLocalAdminUsers();
  }, []);

  useEffect(() => {
    window.localStorage.setItem('sfm-selected-outlet-code', selectedOutletCode);
  }, [selectedOutletCode]);

  const handleOutletContextChange = useCallback(
    (outlet: Outlet | null, attendant: UserRoleProfile | null) => {
      setSelectedOutletContext(outlet);
      setSelectedAttendantContext(attendant);
    },
    [],
  );

  const counts = useMemo(() => {
    const c: Record<string, number> = { All: products.length };
    for (const p of products) c[p.category] = (c[p.category] ?? 0) + 1;
    return c;
  }, [products]);

  const signInToLocalWorkspace = (emailOrPhone: string, password: string) => {
    if (localWorkspace !== 'admin' && localWorkspace !== 'attendant') {
      return false;
    }

    const credentials = LOCAL_WORKSPACE_CREDENTIALS[localWorkspace];
    const normalizedLogin = emailOrPhone.trim().toLowerCase();
    const valid =
      normalizedLogin === credentials.login ||
      (localWorkspace === 'admin' && normalizedLogin === 'superadmin') ||
      (localWorkspace === 'attendant' && normalizedLogin === 'attendant');

    if (!valid || password !== credentials.password) {
      return false;
    }

    window.sessionStorage.setItem(LOCAL_WORKSPACE_SESSION_KEY, localWorkspace);
    setLocalWorkspaceSession(localWorkspace);
    setMerchantMode(localWorkspace === 'admin');
    setAttendantMode(localWorkspace === 'attendant');
    return true;
  };

  const signOutOfLocalWorkspace = async () => {
    window.sessionStorage.removeItem(LOCAL_WORKSPACE_SESSION_KEY);
    setLocalWorkspaceSession(null);
    await signOut();
  };

  if (localWorkspace === 'admin' && localWorkspaceSession !== 'admin') {
    return (
      <LocalWorkspaceSignIn
        role="admin"
        onSignIn={signInToLocalWorkspace}
      />
    );
  }

  if (localWorkspace === 'attendant' && localWorkspaceSession !== 'attendant') {
    return (
      <LocalWorkspaceSignIn
        role="attendant"
        onSignIn={signInToLocalWorkspace}
      />
    );
  }

  if (localWorkspace === 'admin') {
    return (
      <CartProvider>
        <div className="min-h-screen bg-gray-50">
          <MerchantDashboard
            products={products}
            user={user}
            role="admin"
            profile={
              profile ?? {
                user_id: '00000000-0000-4000-8000-000000000002',
                email: LOCAL_WORKSPACE_CREDENTIALS.admin.login,
                full_name: 'Super Admin',
                role: 'admin',
                is_active: true,
                is_approved: true,
              }
            }
            onOpenAttendantWorkspace={navigateToAttendantWorkspace}
            onProductsChanged={loadProducts}
            siteSettings={siteSettings}
            onSiteSettingsChanged={setSiteSettings}
          />
          <button
            type="button"
            onClick={() => void signOutOfLocalWorkspace()}
            className="fixed bottom-4 right-4 z-40 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-bold text-gray-700 shadow-lg transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
          >
            Sign Out
          </button>
        </div>
      </CartProvider>
    );
  }

  if (localWorkspace === 'attendant') {
    const localAttendantProfile = defaultLocalAttendantProfile(localAttendant);

    return (
      <CartProvider>
        <div className="min-h-screen bg-gray-50">
          <AttendantWorkspace
            profile={role === 'attendant' && profile ? profile : localAttendantProfile}
            sessionStartedAt={
              role === 'attendant'
                ? profile?.last_login_at
                : localAttendantProfile.last_login_at ??
                  localAttendantProfile.created_at ??
                  new Date().toISOString()
            }
            onLogout={signOutOfLocalWorkspace}
            onRedirectToAdmin={navigateToMerchantDashboard}
            onRedirectToStorefront={navigateToStorefront}
          />
        </div>
      </CartProvider>
    );
  }

  return (
    <CartProvider>
      <div className="flex min-h-screen flex-col bg-gray-50">
        <Header
          search={search}
          onSearchChange={setSearch}
          onOpenCart={() => setCartOpen(true)}
          onNavigateHelp={() => setCartOpen(false)}
          user={user}
          role={role}
          merchantRole={false}
          onToggleMerchant={() => setMerchantMode((value) => !value)}
          onCustomerLogin={signInWithGoogle}
          onCustomerSignIn={signInWithEmail}
          onCustomerSignUp={signUpWithEmail}
          onCustomerLogout={signOut}
          siteSettings={siteSettings}
        />

        {attendantMode ? (
          <main className="flex-1">
            <AttendantWorkspace
              profile={
                role === 'attendant' && profile
                  ? profile
                  : defaultLocalAttendantProfile(localAttendant)
              }
              sessionStartedAt={
                role === 'attendant'
                  ? profile?.last_login_at
                  : localAttendant?.last_login_at ?? localAttendant?.created_at ?? new Date().toISOString()
              }
              onLogout={signOut}
              onRedirectToAdmin={navigateToMerchantDashboard}
              onRedirectToStorefront={navigateToStorefront}
            />
          </main>
        ) : merchantMode && merchantRole ? (
          <main className="flex-1">
            <MerchantDashboard
              products={products}
              user={user}
              role={freeMerchantAccess ? 'admin' : role}
              profile={
                profile ?? {
                  user_id: '00000000-0000-4000-8000-000000000002',
                  role: 'admin',
                  is_active: true,
                  is_approved: true,
                }
              }
              onOpenAttendantWorkspace={navigateToAttendantWorkspace}
              onProductsChanged={loadProducts}
              siteSettings={siteSettings}
              onSiteSettingsChanged={setSiteSettings}
            />
          </main>
        ) : (
          <main className="flex-1">
            <HeroSection siteSettings={siteSettings} />
            <div className="mx-auto max-w-7xl space-y-8 px-4 py-8">
              <CategoryHighlights siteSettings={siteSettings} />
              <div id="catalog" className="space-y-4">
                <div className="flex flex-wrap items-end justify-between gap-2">
                  <div>
                    <h2 className="text-2xl font-extrabold text-brand-800">
                      {activeCategory === 'All' ? 'All Products' : activeCategory}
                    </h2>
                    <p className="text-sm text-gray-500">
                      Fresh items priced in Ugandan Shilling, delivered to your door.
                    </p>
                  </div>
                </div>
                <CategoryBar
                  active={activeCategory}
                  onSelect={setActiveCategory}
                  counts={counts}
                  siteSettings={siteSettings}
                />
                {dbError && (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                    {hasSupabaseConfig
                      ? `Products are temporarily unavailable: ${dbError}`
                      : 'Supabase is not configured yet. Please add your project URL and anon key to the environment file.'}
                  </div>
                )}
                <ProductGrid
                  products={products}
                  activeCategory={activeCategory}
                  search={search}
                  loading={loading}
                  siteSettings={siteSettings}
                />
              </div>
            </div>
          </main>
        )}

        <Footer
          siteSettings={siteSettings}
        />

        {/* Floating merchant toggle (mobile-friendly, always reachable) */}
        {false && (
          <div className="fixed bottom-4 right-4 z-30 sm:hidden">
            <MerchantToggle
              merchantMode={merchantMode}
              onToggle={() => {
                if (!merchantRole) {
                  setMerchantMode(false);
                  return;
                }
                if (merchantMode) {
                  navigateToStorefront();
                } else {
                  navigateToMerchantDashboard();
                }
              }}
            />
          </div>
        )}

        <CartDrawer
          open={cartOpen}
          onClose={() => setCartOpen(false)}
          onCheckout={() => {
            setCartOpen(false);
            setCheckoutOpen(true);
          }}
          selectedOutletCode={selectedOutletCode}
          onSelectedOutletCodeChange={setSelectedOutletCode}
          onOutletContextChange={handleOutletContextChange}
          user={user}
          siteSettings={siteSettings}
        />
        <CheckoutModal
          open={checkoutOpen}
          onClose={() => setCheckoutOpen(false)}
          onOrderPlaced={(o) => {
            setCheckoutOpen(false);
            setPlacedOrder(o);
          }}
          initialSelectedOutletCode={selectedOutletCode}
          initialOutlet={selectedOutletContext}
          initialAttendant={selectedAttendantContext}
          onSelectedOutletCodeChange={setSelectedOutletCode}
          userId={user?.id}
        />
        {placedOrder && (
          <OrderConfirmation order={placedOrder} onClose={() => setPlacedOrder(null)} />
        )}
        <MerchantSignInModal
          open={merchantLoginOpen}
          onClose={() => setMerchantLoginOpen(false)}
          onSignIn={signInWithMerchant}
          onGoogleSignIn={() =>
            signInWithGoogle(`${window.location.origin}/merchant/dashboard`)
          }
          onSuccess={() => {
            setMerchantLoginOpen(false);
            navigateToMerchantDashboard();
          }}
        />
      </div>
    </CartProvider>
  );
}

function LocalWorkspaceSignIn({
  role,
  onSignIn,
}: {
  role: LocalWorkspaceRole;
  onSignIn: (emailOrPhone: string, password: string) => boolean;
}) {
  const credentials = LOCAL_WORKSPACE_CREDENTIALS[role];
  const [emailOrPhone, setEmailOrPhone] = useState(credentials.login);
  const [password, setPassword] = useState(credentials.password);
  const [error, setError] = useState('');

  return (
    <main className="grid min-h-screen place-items-center bg-gray-50 px-4 py-10">
      <section className="w-full max-w-md rounded-2xl border border-gray-100 bg-white p-5 shadow-xl">
        <div className="mb-5">
          <p className="text-xs font-bold uppercase tracking-wide text-brand-600">
            {credentials.label}
          </p>
          <h1 className="mt-2 text-2xl font-extrabold text-brand-900">Sign in to workspace</h1>
          <p className="mt-1 text-sm text-gray-500">
            Temporary free-access credentials are filled in for local testing.
          </p>
        </div>

        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            setError('');
            if (!onSignIn(emailOrPhone, password)) {
              setError('Invalid local workspace credentials.');
            }
          }}
        >
          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-gray-700">
              Email or username
            </span>
            <input
              value={emailOrPhone}
              onChange={(event) => setEmailOrPhone(event.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 text-sm outline-none transition focus:border-brand-400 focus:bg-white focus:ring-2 focus:ring-brand-100"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-gray-700">Password</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 text-sm outline-none transition focus:border-brand-400 focus:bg-white focus:ring-2 focus:ring-brand-100"
            />
          </label>

          {error && (
            <p className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
              {error}
            </p>
          )}

          <button
            type="submit"
            className="w-full rounded-full bg-brand-600 px-4 py-3 text-sm font-extrabold text-white shadow-sm transition hover:bg-brand-700"
          >
            Sign In
          </button>
        </form>

        <div className="mt-5 rounded-xl bg-brand-50 px-3 py-3 text-xs font-semibold text-brand-800">
          Login: {credentials.login}
          <br />
          Password: {credentials.password}
        </div>
      </section>
    </main>
  );
}

export default App;
