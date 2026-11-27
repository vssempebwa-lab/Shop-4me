-- orders.user_id links an order to the signed-in customer who placed it
-- (NULL for guest checkout). Later migrations' RLS policies depend on it, but
-- it was previously only ever added by hand, so fresh databases failed at
-- 20260730143000. Safe to re-run.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_orders_user_id ON public.orders (user_id);
