import { useEffect, useMemo, useState } from 'react';
import Header, { MerchantToggle } from './components/Header';
import Footer from './components/Footer';
import CategoryBar from './components/CategoryBar';
import ProductGrid, { HeroSection, CategoryHighlights } from './components/ProductGrid';
import CartDrawer from './components/CartDrawer';
import CheckoutModal, { OrderConfirmation } from './components/CheckoutModal';
import MerchantDashboard from './components/MerchantDashboard';
import { CartProvider } from './context/CartContext';
import { hasSupabaseConfig, supabase } from './lib/supabase';
import { useAuth } from './hooks/useAuth';
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
  const [dbError, setDbError] = useState<string | null>(null);
  const [attendantLoggedIn, setAttendantLoggedIn] = useState(false);

  const { user, signInWithGoogle, signOut } = useAuth();

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
          attendantLoggedIn={attendantLoggedIn}
          onAttendantLogin={() => {
            setAttendantLoggedIn(true);
            setMerchantMode(true);
          }}
          onAttendantLogout={() => {
            setAttendantLoggedIn(false);
            setMerchantMode(false);
          }}
          customerLoggedIn={!!user}
          customerEmail={user?.email ?? ''}
          onCustomerLogin={() => signInWithGoogle()}
          onCustomerLogout={signOut}
        />

        {merchantMode && attendantLoggedIn ? (
          <main className="flex-1">
            <MerchantDashboard products={products} onProductsChanged={loadProducts} />
          </main>
        ) : (
          <main className="flex-1">
            <HeroSection />
            <div className="mx-auto max-w-7xl space-y-8 px-4 py-8">
              <CategoryHighlights />
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
                />
              </div>
            </div>
          </main>
        )}

        <Footer
          merchantMode={merchantMode}
          onToggleMerchant={() => {
            if (!attendantLoggedIn) {
              setMerchantMode(false);
              return;
            }
            setMerchantMode((v) => !v);
          }}
        />

        {/* Floating merchant toggle (mobile-friendly, always reachable) */}
        <div className="fixed bottom-4 right-4 z-30 sm:hidden">
          <MerchantToggle
            merchantMode={merchantMode}
            onToggle={() => {
              if (!attendantLoggedIn) {
                setMerchantMode(false);
                return;
              }
              setMerchantMode((v) => !v);
            }}
          />
        </div>

        <CartDrawer
          open={cartOpen}
          onClose={() => setCartOpen(false)}
          onCheckout={() => {
            setCartOpen(false);
            setCheckoutOpen(true);
          }}
        />
        <CheckoutModal
          open={checkoutOpen}
          onClose={() => setCheckoutOpen(false)}
          onOrderPlaced={(o) => {
            setCheckoutOpen(false);
            setPlacedOrder(o);
          }}
        />
        {placedOrder && (
          <OrderConfirmation order={placedOrder} onClose={() => setPlacedOrder(null)} />
        )}
      </div>
    </CartProvider>
  );
}

export default App;
