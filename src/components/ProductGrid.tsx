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
import { Check } from 'lucide-react';
import outletHeroImage from '../../Admin-Pics/outlet-hero.jpg';
import outletHeroImageMobile from '../../Admin-Pics/outlet-hero-mobile.jpg';

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
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="h-72 animate-pulse rounded-2xl bg-gray-100"
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
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">
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
  const customHero = siteSettings.heroBackgroundImageUrl;

  return (
    <section className="border-b border-gray-100 bg-white">
      <div className="mx-auto grid max-w-7xl items-center gap-6 px-4 py-6 sm:py-10 md:grid-cols-2 md:gap-10">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
            <span data-site-text="heroEyebrow">{siteSettings.heroEyebrow}</span>
          </span>
          <h1 className="mt-3 text-3xl font-extrabold leading-tight tracking-tight text-gray-900 sm:text-5xl">
            <span data-site-text="heroTitle">{siteSettings.heroTitle}</span>{' '}
            <span className="text-brand-600" data-site-text="heroHighlight">
              {siteSettings.heroHighlight}
            </span>
          </h1>
          <p className="mt-3 max-w-lg text-sm leading-relaxed text-gray-600 sm:text-base" data-site-text="heroBody">
            {siteSettings.heroBody}
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <a
              href="#catalog"
              className="sfm-button inline-flex min-h-11 items-center rounded-full bg-brand-600 px-6 text-sm font-bold text-white transition hover:bg-brand-700"
            >
              <span data-site-text="shopNowLabel">{siteSettings.shopNowLabel}</span>
            </a>
            <a
              href="#categories"
              className="inline-flex min-h-11 items-center px-2 text-sm font-semibold text-brand-700 hover:underline"
            >
              <span data-site-text="browseCategoriesLabel">{siteSettings.browseCategoriesLabel}</span>
            </a>
          </div>
          <ul className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-xs font-medium text-gray-600">
            {HERO_PROMISES.map((promise) => (
              <li key={promise} className="flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 text-brand-600" />
                {promise}
              </li>
            ))}
          </ul>
        </div>

        <div className="overflow-hidden rounded-3xl bg-gray-100">
          {customHero ? (
            <img
              src={customHero}
              alt="Shop For Me outlet at the market"
              className="aspect-[16/6] w-full object-cover sm:aspect-[16/8] md:aspect-[4/3]"
              data-site-image="heroBackgroundImageUrl"
            />
          ) : (
            <picture>
              <source media="(min-width: 768px)" srcSet={outletHeroImage} />
              <img
                src={outletHeroImageMobile}
                alt="Shop For Me outlet at Kalerwe Market"
                width={800}
                height={450}
                className="aspect-[16/6] w-full object-cover sm:aspect-[16/8] md:aspect-[4/3]"
                data-site-image="heroBackgroundImageUrl"
              />
            </picture>
          )}
        </div>
      </div>
    </section>
  );
}

const HERO_PROMISES = ['Real market prices', 'You approve the final bill', 'Pay on delivery'];

export function CategoryHighlights({
  siteSettings = DEFAULT_SITE_SETTINGS,
  onSelectCategory,
}: {
  siteSettings?: SiteSettings;
  onSelectCategory?: (category: Category) => void;
}) {
  return (
    <section id="categories" aria-label="Shop by category" className="scroll-mt-24">
      <div className="no-scrollbar -mx-4 flex gap-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-6 sm:overflow-visible sm:px-0">
        {CATEGORIES.map(({ name, icon: Icon }) => {
          const content = getCategoryContent(siteSettings, name);
          const imageUrl = content?.imageUrl;
          const label = getCategoryDisplayLabel(siteSettings, name);

          return (
            <button
              key={name}
              type="button"
              onClick={() => onSelectCategory?.(name)}
              aria-label={`Browse ${label}`}
              className="group flex w-20 shrink-0 flex-col items-center gap-2 rounded-2xl p-1 text-center focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 sm:w-auto"
            >
              <span className="grid h-16 w-16 place-items-center overflow-hidden rounded-full bg-brand-50 text-brand-600 ring-1 ring-brand-100 transition group-hover:ring-2 group-hover:ring-brand-400 sm:h-20 sm:w-20">
                {imageUrl ? (
                  <img src={imageUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
                ) : (
                  <Icon className="h-7 w-7" />
                )}
              </span>
              <span className="text-xs font-semibold leading-tight text-gray-700 group-hover:text-brand-700">
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
