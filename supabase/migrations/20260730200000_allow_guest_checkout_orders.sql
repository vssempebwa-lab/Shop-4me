DROP POLICY IF EXISTS "orders_insert_by_customer_or_admin" ON public.orders;
CREATE POLICY "orders_insert_by_guest_customer_or_admin"
  ON public.orders
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    public.is_admin()
    OR user_id = auth.uid()
    OR user_id IS NULL
  );

DROP POLICY IF EXISTS "order_items_insert_by_order_owner_or_admin" ON public.order_items;
CREATE POLICY "order_items_insert_by_guest_customer_or_admin"
  ON public.order_items
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.orders
      WHERE orders.id = order_items.order_id
        AND (
          orders.user_id = auth.uid()
          OR orders.user_id IS NULL
        )
    )
  );
