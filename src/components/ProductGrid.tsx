import { useMemo } from 'react';
import type { Category, Product } from '../types';
import ProductCard from './ProductCard';
import { CATEGORIES } from './CategoryBar';
import {
  DEFAULT_SITE_SETTINGS,
  getCategoryContent,
  getCategoryDisplayLabel,
  type SiteSettings,
} from '../lib/siteSettings';
import outletHeroImage from '../../Admin-Pics/Outlet.png';

interface ProductGridProps {
  products: Product[];
  activeCategory: Category | 'All';
  search: string;
  loading: boolean;
  siteSettings?: SiteSettings;
}

export default function ProductGrid({
  products,
  activeCategory,
  search,
  loading,
  siteSettings = DEFAULT_SITE_SETTINGS,
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
        <p className="text-sm font-semibold text-gray-500" data-site-text="productsEmptyTitle">
          {siteSettings.productsEmptyTitle}
        </p>
        <p className="mt-1 text-xs text-gray-400" data-site-text="productsEmptyText">
          {siteSettings.productsEmptyText}
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {filtered.map((p) => (
        <ProductCard key={p.id} product={p} siteSettings={siteSettings} />
      ))}
    </div>
  );
}

export function HeroSection({
  siteSettings = DEFAULT_SITE_SETTINGS,
}: {
  siteSettings?: SiteSettings;
}) {
  const heroImage = siteSettings.heroBackgroundImageUrl || outletHeroImage;

  return (
    <section className="relative overflow-hidden bg-gray-950 text-white">
      <img
        src={heroImage}
        alt="Shop For Me outlet at Kalerwe Market"
        className="absolute inset-0 h-full w-full object-cover"
        data-site-image="heroBackgroundImageUrl"
      />
      <div className="absolute inset-0 bg-gradient-to-l from-black/85 via-black/55 to-black/10" />
      <div className="relative mx-auto max-w-7xl px-4 py-12 sm:py-16">
        <div className="ml-auto flex max-w-2xl flex-col items-end text-right">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-brand-200 ring-1 ring-white/20">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-300" />
            <span data-site-text="heroEyebrow">{siteSettings.heroEyebrow}</span>
          </span>
          <h1 className="mt-4 text-3xl font-extrabold leading-tight sm:text-5xl">
            <span data-site-text="heroTitle">{siteSettings.heroTitle}</span>{' '}
            <span className="text-brand-300" data-site-text="heroHighlight">
              {siteSettings.heroHighlight}
            </span>
          </h1>
          <p className="mt-3 text-sm text-brand-50/90 sm:text-base" data-site-text="heroBody">
            {siteSettings.heroBody}
          </p>
          <div className="mt-6 flex flex-wrap justify-end gap-3">
            <a
              href="#catalog"
              className="sfm-button rounded-full bg-brand-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg transition hover:bg-brand-400"
            >
              <span data-site-text="shopNowLabel">{siteSettings.shopNowLabel}</span>
            </a>
            <a
              href="#categories"
              className="sfm-button rounded-full bg-white/10 px-5 py-2.5 text-sm font-semibold text-white ring-1 ring-white/30 transition hover:bg-white/20"
            >
              <span data-site-text="browseCategoriesLabel">
                {siteSettings.browseCategoriesLabel}
              </span>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

export function CategoryHighlights({
  siteSettings = DEFAULT_SITE_SETTINGS,
  onSelectCategory,
}: {
  siteSettings?: SiteSettings;
  onSelectCategory?: (category: Category) => void;
}) {
  return (
    <section id="categories" className="mx-auto max-w-7xl px-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {CATEGORIES.map(({ name, icon: Icon, blurb }) => {
          const content = getCategoryContent(siteSettings, name);
          const imageUrl = content?.imageUrl;
          const hoverImageUrl = content?.hoverSwapEnabled ? content.hoverImageUrl : '';
          const label = getCategoryDisplayLabel(siteSettings, name);

          return (
            <button
              key={name}
              type="button"
              onClick={() => onSelectCategory?.(name)}
              aria-label={`Browse ${label}`}
              className="group rounded-2xl border border-gray-100 bg-white p-4 text-center shadow-sm transition hover:-translate-y-1 hover:border-brand-200 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-brand-300 focus:ring-offset-2"
            >
              <div className="relative mx-auto grid h-12 w-12 place-items-center overflow-hidden rounded-2xl bg-brand-50 text-brand-600 transition group-hover:bg-brand-600 group-hover:text-white">
                {imageUrl ? (
                  <>
                    <img
                      src={imageUrl}
                      alt=""
                      className={`h-full w-full object-cover transition ${hoverImageUrl ? 'group-hover:opacity-0' : ''}`}
                    />
                    {hoverImageUrl && (
                      <img
                        src={hoverImageUrl}
                        alt=""
                        className="absolute inset-0 h-full w-full object-cover opacity-0 transition group-hover:opacity-100"
                      />
                    )}
                  </>
                ) : (
                  <Icon className="h-6 w-6" />
                )}
              </div>
              <p className="mt-3 text-sm font-bold text-gray-800">{label}</p>
              <p className="mt-0.5 text-[11px] text-gray-500">{content?.blurb || blurb}</p>
            </button>
          );
        })}
      </div>
    </section>
  );
}
