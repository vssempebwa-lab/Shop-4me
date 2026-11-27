import { useState } from 'react';
import { Plus, Minus, PackageSearch } from 'lucide-react';
import type { Product } from '../types';
import { useCart } from '../context/CartContext';
import { formatUGX } from '../lib/format';
import type { SiteSettings } from '../lib/siteSettings';

interface ProductCardProps {
  product: Product;
  siteSettings?: SiteSettings;
}

/**
 * Grocery product card. Most grocery shoppers add straight from the list, so
 * the card has to work on its own (Baymard grocery research):
 * - the add button becomes a quantity stepper in place,
 * - cards already in the cart are highlighted, not just labelled,
 * - touch targets are at least 44px tall.
 */
export default function ProductCard({ product }: ProductCardProps) {
  const { quantityOf, add, increment, decrement } = useCart();
  const [imgError, setImgError] = useState(false);
  const qty = quantityOf(product.id);
  const inCart = qty > 0;

  return (
    <article
      className={`flex flex-col overflow-hidden rounded-2xl bg-white transition ${
        inCart ? 'ring-2 ring-brand-500' : 'ring-1 ring-gray-100 hover:ring-gray-200'
      }`}
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-gray-50 sm:aspect-square">
        {imgError || !product.image_url ? (
          <div className="grid h-full w-full place-items-center bg-brand-50">
            <PackageSearch className="h-9 w-9 text-brand-300" />
          </div>
        ) : (
          <img
            src={product.image_url}
            alt={product.name}
            loading="lazy"
            decoding="async"
            onError={() => setImgError(true)}
            className="h-full w-full object-cover"
          />
        )}
        {!product.in_stock && (
          <div className="absolute inset-0 grid place-items-center bg-white/75">
            <span className="rounded-full bg-gray-900 px-3 py-1 text-xs font-semibold text-white">Out of stock</span>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col p-3 sm:p-4">
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-gray-900">{product.name}</h3>
        <p className="mt-0.5 text-xs text-gray-500">{product.unit}</p>
        {product.description && (
          <p className="mt-1 line-clamp-1 hidden text-xs text-gray-400 sm:block">{product.description}</p>
        )}

        <p className="mt-auto pt-2 text-base font-bold text-gray-900">
          {formatUGX(product.price)}
          <span className="ml-1 text-[11px] font-medium text-gray-400">est.</span>
        </p>

        <div className="mt-2">
          {!inCart ? (
            <button
              type="button"
              disabled={!product.in_stock}
              onClick={() => add(product)}
              aria-label={`Add ${product.name} to cart`}
              className="flex h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-brand-600 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400"
            >
              <Plus className="h-4 w-4" />
              Add
            </button>
          ) : (
            <div className="flex h-11 items-center justify-between rounded-xl bg-brand-50">
              <button
                type="button"
                onClick={() => decrement(product.id)}
                aria-label={`Remove one ${product.name}`}
                className="grid h-11 w-11 place-items-center rounded-xl text-brand-700 transition hover:bg-brand-100"
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="text-sm font-bold text-brand-800" aria-live="polite">
                {qty} in cart
              </span>
              <button
                type="button"
                onClick={() => increment(product.id)}
                aria-label={`Add one more ${product.name}`}
                className="grid h-11 w-11 place-items-center rounded-xl text-brand-700 transition hover:bg-brand-100"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
