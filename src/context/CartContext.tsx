import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import type { CartItem, Product } from '../types';

interface CartContextValue {
  items: CartItem[];
  count: number;
  subtotal: number;
  add: (product: Product) => void;
  increment: (productId: string) => void;
  decrement: (productId: string) => void;
  remove: (productId: string) => void;
  clear: () => void;
  quantityOf: (productId: string) => number;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  const value = useMemo<CartContextValue>(() => {
    const add = (product: Product) =>
      setItems((prev) => {
        const existing = prev.find((i) => i.product.id === product.id);
        if (existing) {
          return prev.map((i) =>
            i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i,
          );
        }
        return [...prev, { product, quantity: 1 }];
      });

    const increment = (productId: string) =>
      setItems((prev) =>
        prev.map((i) =>
          i.product.id === productId ? { ...i, quantity: i.quantity + 1 } : i,
        ),
      );

    const decrement = (productId: string) =>
      setItems((prev) =>
        prev
          .map((i) =>
            i.product.id === productId ? { ...i, quantity: i.quantity - 1 } : i,
          )
          .filter((i) => i.quantity > 0),
      );

    const remove = (productId: string) =>
      setItems((prev) => prev.filter((i) => i.product.id !== productId));

    const clear = () => setItems([]);

    const quantityOf = (productId: string) =>
      items.find((i) => i.product.id === productId)?.quantity ?? 0;

    const count = items.reduce((sum, i) => sum + i.quantity, 0);
    const subtotal = items.reduce((sum, i) => sum + i.quantity * i.product.price, 0);

    return { items, count, subtotal, add, increment, decrement, remove, clear, quantityOf };
  }, [items]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
