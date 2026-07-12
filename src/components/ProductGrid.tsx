import { useMemo } from 'react';
import type { Category, Product } from '../types';
import ProductCard from './ProductCard';
import { CATEGORIES } from './CategoryBar';

interface ProductGridProps {
  products: Product[];
  activeCategory: Category | 'All';
  search: string;
  loading: boolean;
}

export default function ProductGrid({
  products,
  activeCategory,
  search,
  loading,
}: ProductGridProps) {
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      const matchCat = activeCategory === 'All' || p.category === activeCategory;
      const matchSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        (p.description ?? '').toLowerCase().includes(q);
      return matchCat && matchSearch;
    });
  }, [products, activeCategory, search]);

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="h-72 animate-pulse rounded-2xl border border-gray-100 bg-gray-50"
          />
        ))}
      </div>
    );
  }

  if (filtered.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-200 bg-white py-16 text-center">
        <p className="text-sm font-semibold text-gray-500">No products found.</p>
        <p className="mt-1 text-xs text-gray-400">
          Try a different category or search term.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {filtered.map((p) => (
        <ProductCard key={p.id} product={p} />
      ))}
    </div>
  );
}

export function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-brand-700 via-brand-600 to-brand-800 text-white">
      <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-gold-400/20 blur-3xl" />
      <div className="absolute -bottom-24 -left-10 h-72 w-72 rounded-full bg-brand-400/20 blur-3xl" />
      <div className="relative mx-auto max-w-7xl px-4 py-12 sm:py-16">
        <div className="max-w-2xl">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-gold-200 ring-1 ring-white/20">
            <span className="h-1.5 w-1.5 rounded-full bg-gold-300" />
            Fresh deliveries across Uganda
          </span>
          <h1 className="mt-4 text-3xl font-extrabold leading-tight sm:text-5xl">
            List, Order &amp; <span className="text-gold-300">Delivered</span>
          </h1>
          <p className="mt-3 text-sm text-brand-50/90 sm:text-base">
            Fresh groceries, kitchenware and cooking fuels — a reliable, affordable
            and convenient way to get everything you need at your doorsteps.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <a
              href="#catalog"
              className="rounded-full bg-gold-400 px-5 py-2.5 text-sm font-bold text-brand-900 shadow-lg transition hover:bg-gold-300"
            >
              Shop Now
            </a>
            <a
              href="#categories"
              className="rounded-full bg-white/10 px-5 py-2.5 text-sm font-semibold text-white ring-1 ring-white/30 transition hover:bg-white/20"
            >
              Browse Categories
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

export function CategoryHighlights() {
  return (
    <section id="categories" className="mx-auto max-w-7xl px-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {CATEGORIES.map(({ name, icon: Icon, blurb }) => (
          <div
            key={name}
            className="group rounded-2xl border border-gray-100 bg-white p-4 text-center shadow-sm transition hover:-translate-y-1 hover:border-brand-200 hover:shadow-md"
          >
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-brand-50 text-brand-600 transition group-hover:bg-brand-600 group-hover:text-white">
              <Icon className="h-6 w-6" />
            </div>
            <p className="mt-3 text-sm font-bold text-gray-800">{name}</p>
            <p className="mt-0.5 text-[11px] text-gray-500">{blurb}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
