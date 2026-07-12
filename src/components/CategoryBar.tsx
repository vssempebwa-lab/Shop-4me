import {
  Carrot,
  Apple,
  FlaskConical,
  UtensilsCrossed,
  Flame,
  LayoutGrid,
} from 'lucide-react';
import type { Category } from '../types';

export const CATEGORIES: { name: Category; icon: typeof Carrot; blurb: string }[] = [
  { name: 'Food Sauce', icon: Carrot, blurb: 'Fresh groceries & vegetables' },
  { name: 'Fruits', icon: Apple, blurb: 'Seasonal fresh fruits' },
  { name: 'Spices', icon: FlaskConical, blurb: 'Aromatic spices & seasonings' },
  { name: 'Kitchen Ware', icon: UtensilsCrossed, blurb: 'Cookware & dinnerware' },
  { name: 'Cooking Fuels', icon: Flame, blurb: 'Gas, charcoal & more' },
  { name: 'And More', icon: LayoutGrid, blurb: 'Everything else we stock' },
];

interface CategoryBarProps {
  active: Category | 'All';
  onSelect: (c: Category | 'All') => void;
  counts: Record<string, number>;
}

export default function CategoryBar({ active, onSelect, counts }: CategoryBarProps) {
  return (
    <section className="mx-auto max-w-7xl px-4">
      <div className="no-scrollbar flex gap-3 overflow-x-auto pb-1">
        <button
          onClick={() => onSelect('All')}
          className={`flex shrink-0 items-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-semibold transition ${
            active === 'All'
              ? 'border-brand-600 bg-brand-600 text-white shadow-md'
              : 'border-gray-200 bg-white text-gray-700 hover:border-brand-300 hover:bg-brand-50'
          }`}
        >
          <LayoutGrid className="h-4 w-4" />
          All
          <span
            className={`rounded-full px-1.5 py-0.5 text-[11px] ${
              active === 'All' ? 'bg-white/20' : 'bg-gray-100 text-gray-500'
            }`}
          >
            {counts['All'] ?? 0}
          </span>
        </button>

        {CATEGORIES.map(({ name, icon: Icon }) => {
          const isActive = active === name;
          return (
            <button
              key={name}
              onClick={() => onSelect(name)}
              className={`flex shrink-0 items-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-semibold transition ${
                isActive
                  ? 'border-brand-600 bg-brand-600 text-white shadow-md'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-brand-300 hover:bg-brand-50'
              }`}
            >
              <Icon className="h-4 w-4" />
              {name}
              <span
                className={`rounded-full px-1.5 py-0.5 text-[11px] ${
                  isActive ? 'bg-white/20' : 'bg-gray-100 text-gray-500'
                }`}
              >
                {counts[name] ?? 0}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
