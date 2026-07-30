import { useEffect, useMemo, useState } from 'react';
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
import { getLatestLocalAttendant } from './lib/localAdminUsers';
import type { Category, Order, Product } from './types';

function App() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<Category | 'All'>('All');
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [placedOrder, setPlacedOrder] = useState<Order | null>(null);
  const [merchantMode, setMerchantMode] = useState(false);
  const [attendantMode, setAttendantMode] = useState(false);
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

  const freeMerchantAccess = true;
  const localAttendant = freeMerchantAccess ? getLatestLocalAttendant() : null;
  const merchantRole =
    freeMerchantAccess ||
    (profile?.is_active !== false &&
      profile?.is_approved !== false &&
      (role === 'admin' || role === 'attendant' || role === 'merchant'));

  const navigateToMerchantDashboard = () => {
    window.history.pushState({}, '', '/merchant/dashboard');
    setAttendantMode(false);
    setMerchantMode(true);
  };

  const navigateToAttendantWorkspace = () => {
    window.history.pushState({}, '', '/attendant/workspace');
    setMerchantMode(false);
    setAttendantMode(true);
  };

  const navigateToStorefront = () => {
    window.history.pushState({}, '', '/');
    setMerchantMode(false);
    setAttendantMode(false);
  };

  useEffect(() => {
    if (!merchantRole) {
      setMerchantMode(false);
    }
  }, [merchantRole]);

  useEffect(() => {
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
  }, [authLoading, merchantRole]);

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
  }, []);

  const counts = useMemo(() => {
    const c: Record<string, number> = { All: products.length };
    for (const p of products) c[p.category] = (c[p.category] ?? 0) + 1;
    return c;
  }, [products]);

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
          merchantRole={merchantRole}
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
                role === 'attendant'
                  ? profile
                  : localAttendant
                    ? {
                        ...localAttendant,
                        assigned_outlet: localAttendant.assigned_outlet || 'DEPOT-KAW-01',
                      }
                  : {
                      user_id: '00000000-0000-4000-8000-000000000001',
                      email: 'attendant@shop4me.local',
                      full_name: 'Local Market Attendant',
                      role: 'attendant',
                      assigned_outlet: 'DEPOT-KAW-01',
                      is_active: true,
                      is_approved: true,
                    }
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
          merchantMode={merchantMode}
          merchantRole={merchantRole}
          onMerchantSignIn={() => setMerchantLoginOpen(true)}
          onToggleMerchant={() => {
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
          siteSettings={siteSettings}
        />

        {/* Floating merchant toggle (mobile-friendly, always reachable) */}
        {merchantRole && (
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
          userId={user?.id}
        />
        {placedOrder && (
          <OrderConfirmation order={placedOrder} onClose={() => setPlacedOrder(null)} />
        )}
        <MerchantSignInModal
          open={merchantLoginOpen}
          onClose={() => setMerchantLoginOpen(false)}
          onSignIn={signInWithMerchant}
          onSuccess={() => {
            setMerchantLoginOpen(false);
            navigateToMerchantDashboard();
          }}
        />
      </div>
    </CartProvider>
  );
}

export default App;
