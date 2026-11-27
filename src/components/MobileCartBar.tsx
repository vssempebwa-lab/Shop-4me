import { ShoppingCart } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { formatUGX } from '../lib/format';

/** Phone-only bar that keeps the cart one tap away once something is in it. */
export default function MobileCartBar({ onOpen }: { onOpen: () => void }) {
  const { count, subtotal } = useCart();
  if (count === 0) return null;

  return (
    <>
      {/* Spacer so the bar never covers the last row of products or the footer. */}
      <div className="h-20 sm:hidden" aria-hidden="true" />
      <div className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:hidden">
        <button
          type="button"
          onClick={onOpen}
          className="flex h-14 w-full items-center justify-between rounded-2xl bg-brand-600 px-4 text-white shadow-lg shadow-brand-900/20 transition active:scale-[0.99]"
        >
          <span className="flex items-center gap-2 text-sm font-semibold">
            <span className="relative">
              <ShoppingCart className="h-5 w-5" />
              <span className="absolute -right-2 -top-2 grid h-4 min-w-4 place-items-center rounded-full bg-white px-1 text-[10px] font-bold text-brand-700">
                {count}
              </span>
            </span>
            <span className="ml-1">View cart</span>
          </span>
          <span className="text-sm font-bold">
            {formatUGX(subtotal)} <span className="text-xs font-medium text-white/70">est.</span>
          </span>
        </button>
      </div>
    </>
  );
}
