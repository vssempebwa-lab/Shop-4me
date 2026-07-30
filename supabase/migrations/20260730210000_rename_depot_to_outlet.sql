-- Rename Depot terminology to Outlet without dropping data.
-- Stored code values such as DEPOT-KAW-01 are intentionally preserved.

DO $$
BEGIN
  IF to_regclass('public.depots') IS NOT NULL
     AND to_regclass('public.outlets') IS NULL THEN
    ALTER TABLE public.depots RENAME TO outlets;
  END IF;

  IF to_regclass('public.depot_riders') IS NOT NULL
     AND to_regclass('public.outlet_riders') IS NULL THEN
    ALTER TABLE public.depot_riders RENAME TO outlet_riders;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'is_shared_with_depot'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'is_shared_with_outlet'
  ) THEN
    ALTER TABLE public.orders RENAME COLUMN is_shared_with_depot TO is_shared_with_outlet;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'depot_code'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'outlet_code'
  ) THEN
    ALTER TABLE public.orders RENAME COLUMN depot_code TO outlet_code;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'manual_depot_override'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'manual_outlet_override'
  ) THEN
    ALTER TABLE public.orders RENAME COLUMN manual_depot_override TO manual_outlet_override;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'suggested_depot_code'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'suggested_outlet_code'
  ) THEN
    ALTER TABLE public.orders RENAME COLUMN suggested_depot_code TO suggested_outlet_code;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'user_roles' AND column_name = 'assigned_depot'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'user_roles' AND column_name = 'assigned_outlet'
  ) THEN
    ALTER TABLE public.user_roles RENAME COLUMN assigned_depot TO assigned_outlet;
  END IF;

  IF to_regclass('public.outlets') IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'outlets' AND column_name = 'depot_code'
     )
     AND NOT EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'outlets' AND column_name = 'outlet_code'
     ) THEN
    ALTER TABLE public.outlets RENAME COLUMN depot_code TO outlet_code;
  END IF;

  IF to_regclass('public.outlet_riders') IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'outlet_riders' AND column_name = 'depot_code'
     )
     AND NOT EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'outlet_riders' AND column_name = 'outlet_code'
     ) THEN
    ALTER TABLE public.outlet_riders RENAME COLUMN depot_code TO outlet_code;
  END IF;
END $$;

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_order_status_check;

UPDATE public.orders
SET order_status = 'Processing'
WHERE order_status IN ('Assigned to Depot', 'Assigned to Attendant', 'Packed');

ALTER TABLE public.orders
  ADD CONSTRAINT orders_order_status_check
  CHECK (order_status IN ('Order Received', 'Pending', 'Processing', 'Transit', 'Delivered', 'Cancelled'));

DO $$
BEGIN
  ALTER INDEX IF EXISTS idx_orders_depot_shared RENAME TO idx_orders_outlet_shared;
  ALTER INDEX IF EXISTS idx_orders_pending_depot_share RENAME TO idx_orders_pending_outlet_share;
  ALTER INDEX IF EXISTS idx_orders_routing_context RENAME TO idx_orders_outlet_routing_context;
  ALTER INDEX IF EXISTS idx_depot_riders_depot_code RENAME TO idx_outlet_riders_outlet_code;
  ALTER INDEX IF EXISTS depot_riders_depot_phone_unique RENAME TO outlet_riders_outlet_phone_unique;
EXCEPTION
  WHEN duplicate_table THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_orders_outlet_shared
  ON public.orders (outlet_code, is_shared_with_outlet, order_status);

CREATE INDEX IF NOT EXISTS idx_orders_pending_outlet_share
  ON public.orders (is_shared_with_outlet, created_at);

CREATE INDEX IF NOT EXISTS idx_orders_outlet_routing_context
  ON public.orders (outlet_code, is_shared_with_outlet, shared_at DESC);

CREATE INDEX IF NOT EXISTS idx_outlet_riders_outlet_code
  ON public.outlet_riders (outlet_code, is_active);

CREATE UNIQUE INDEX IF NOT EXISTS outlet_riders_outlet_phone_unique
  ON public.outlet_riders (outlet_code, phone);

CREATE OR REPLACE FUNCTION public.current_user_outlet()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT assigned_outlet
  FROM public.user_roles
  WHERE user_id = auth.uid()
    AND is_active = true
    AND is_approved = true
  LIMIT 1
$$;

DROP POLICY IF EXISTS "orders_select_by_role" ON public.orders;
CREATE POLICY "orders_select_by_role"
  ON public.orders
  FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR user_id = auth.uid()
    OR (
      public.is_attendant()
      AND is_shared_with_outlet = true
      AND outlet_code = public.current_user_outlet()
    )
  );

DROP POLICY IF EXISTS "orders_update_by_admin_or_attendant" ON public.orders;
CREATE POLICY "orders_update_by_admin_or_attendant"
  ON public.orders
  FOR UPDATE
  TO authenticated
  USING (
    public.is_admin()
    OR (
      public.is_attendant()
      AND is_shared_with_outlet = true
      AND outlet_code = public.current_user_outlet()
    )
  )
  WITH CHECK (
    public.is_admin()
    OR (
      public.is_attendant()
      AND is_shared_with_outlet = true
      AND outlet_code = public.current_user_outlet()
    )
  );

DROP POLICY IF EXISTS "order_items_select_by_order_access" ON public.order_items;
CREATE POLICY "order_items_select_by_order_access"
  ON public.order_items
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.orders
      WHERE orders.id = order_items.order_id
        AND (
          public.is_admin()
          OR orders.user_id = auth.uid()
          OR (
            public.is_attendant()
            AND orders.is_shared_with_outlet = true
            AND orders.outlet_code = public.current_user_outlet()
          )
        )
    )
  );

ALTER TABLE public.outlets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outlet_riders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "depots_select_admin_attendant" ON public.outlets;
DROP POLICY IF EXISTS "outlets_select_admin_attendant" ON public.outlets;
CREATE POLICY "outlets_select_admin_attendant"
  ON public.outlets
  FOR SELECT
  TO anon, authenticated
  USING (is_active = true OR public.is_admin());

DROP POLICY IF EXISTS "depots_admin_write" ON public.outlets;
DROP POLICY IF EXISTS "outlets_admin_write" ON public.outlets;
CREATE POLICY "outlets_admin_write"
  ON public.outlets
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "riders_select_by_role" ON public.outlet_riders;
CREATE POLICY "riders_select_by_role"
  ON public.outlet_riders
  FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR (public.is_attendant() AND outlet_code = public.current_user_outlet())
  );

DROP POLICY IF EXISTS "riders_admin_write" ON public.outlet_riders;
CREATE POLICY "riders_admin_write"
  ON public.outlet_riders
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP FUNCTION IF EXISTS public.current_user_depot();
