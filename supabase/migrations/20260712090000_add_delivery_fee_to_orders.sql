-- Add delivery_fee column to orders to record standard delivery charge
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivery_fee integer NOT NULL DEFAULT 5000;

-- Ensure RLS policies still allow insert/select for anon/authenticated
DROP POLICY IF EXISTS "anon_select_orders" ON public.orders;
CREATE POLICY "anon_select_orders" ON public.orders FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_orders" ON public.orders;
CREATE POLICY "anon_insert_orders" ON public.orders FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_orders" ON public.orders;
CREATE POLICY "anon_update_orders" ON public.orders FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_orders" ON public.orders;
CREATE POLICY "anon_delete_orders" ON public.orders FOR DELETE
  TO anon, authenticated USING (true);
