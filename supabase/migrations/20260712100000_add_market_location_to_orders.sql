-- Add market_location column to orders so customers can indicate pickup/delivery location
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS market_location text;

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
