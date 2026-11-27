import { useState } from 'react';
import { Plus, Minus, Check, PackageSearch } from 'lucide-react';
import type { Product } from '../types';
import { useCart } from '../context/CartContext';
import { formatUGX } from '../lib/format';
import {
  DEFAULT_SITE_SETTINGS,
  getCategoryDisplayLabel,
  type SiteSettings,
} from '../lib/siteSettings';

interface ProductCardProps {
  product: Product;
  siteSettings?: SiteSettings;
}

export default function ProductCard({
  product,
  siteSettings = DEFAULT_SITE_SETTINGS,
}: ProductCardProps) {
  const { quantityOf, add, increment, decrement } = useCart();
  const [imgError, setImgError] = useState(false);
  const qty = quantityOf(product.id);

  return (
    <div className="group flex flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:border-brand-200 hover:shadow-xl">
      {/* Image */}
      <div className="relative aspect-square overflow-hidden bg-gray-50">
        {imgError || !product.image_url ? (
          <div className="grid h-full w-full place-items-center bg-gradient-to-br from-brand-50 to-brand-100">
            <PackageSearch className="h-10 w-10 text-brand-300" />
          </div>
        ) : (
          <img
            src={product.image_url}
            alt={product.name}
            loading="lazy"
            onError={() => setImgError(true)}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
          />
        )}
        <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-brand-700 shadow-sm backdrop-blur">
          {getCategoryDisplayLabel(siteSettings, product.category)}
        </span>
        {!product.in_stock && (
          <div className="absolute inset-0 grid place-items-center bg-white/70 backdrop-blur-sm">
            <span className="rounded-full bg-gray-800 px-3 py-1 text-xs font-semibold text-white">
              Out of stock
            </span>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col p-4">
        <h3 className="text-sm font-bold text-gray-800 leading-snug">{product.name}</h3>
        <p className="mt-0.5 text-xs text-gray-500">{product.unit}</p>
        {product.description && (
          <p className="mt-1.5 line-clamp-2 text-xs text-gray-500">{product.description}</p>
        )}

        <div className="mt-auto flex items-end justify-between pt-3">
          <div>
            <p className="text-lg font-extrabold text-brand-700">{formatUGX(product.price)}</p>
          </div>

          {qty === 0 ? (
            <button
              disabled={!product.in_stock}
              onClick={() => add(product)}
              className="flex items-center gap-1.5 rounded-full bg-brand-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400"
            >
              <Plus className="h-4 w-4" />
              Add
            </button>
          ) : (
            <div className="flex items-center gap-1 rounded-full bg-brand-50 p-1 ring-1 ring-brand-200">
              <button
                onClick={() => decrement(product.id)}
                className="grid h-7 w-7 place-items-center rounded-full bg-white text-brand-700 shadow-sm transition hover:bg-brand-100"
                aria-label="Decrease quantity"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <span className="min-w-[24px] text-center text-sm font-bold text-brand-800">
                {qty}
              </span>
              <button
                onClick={() => increment(product.id)}
                className="grid h-7 w-7 place-items-center rounded-full bg-brand-600 text-white shadow-sm transition hover:bg-brand-700"
                aria-label="Increase quantity"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
        {qty > 0 && (
          <p className="mt-2 flex items-center gap-1 text-[11px] font-medium text-brand-600">
            <Check className="h-3 w-3" /> In your cart
          </p>
        )}
      </div>
    </div>
  );
}
