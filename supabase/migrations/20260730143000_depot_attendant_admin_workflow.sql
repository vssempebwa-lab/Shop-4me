ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS order_status text,
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS is_shared_with_depot boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS depot_code text,
  ADD COLUMN IF NOT EXISTS division text,
  ADD COLUMN IF NOT EXISTS shared_at timestamptz,
  ADD COLUMN IF NOT EXISTS shared_by uuid,
  ADD COLUMN IF NOT EXISTS dispatched_rider_id uuid,
  ADD COLUMN IF NOT EXISTS dispatched_rider_name text,
  ADD COLUMN IF NOT EXISTS dispatched_at timestamptz,
  ADD COLUMN IF NOT EXISTS handled_by_attendant_id uuid,
  ADD COLUMN IF NOT EXISTS handled_by_attendant_name text,
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz;

UPDATE public.orders
SET order_status = COALESCE(order_status, status, 'Pending')
WHERE order_status IS NULL;

ALTER TABLE public.orders
  ALTER COLUMN order_status SET NOT NULL;

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_order_status_check;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_order_status_check
  CHECK (order_status IN ('Pending', 'Processing', 'Transit', 'Delivered', 'Cancelled'));

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_payment_status_check;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_payment_status_check
  CHECK (payment_status IN ('PENDING', 'PAID', 'FAILED', 'REFUNDED'));

CREATE INDEX IF NOT EXISTS idx_orders_depot_shared
  ON public.orders (depot_code, is_shared_with_depot, order_status);

CREATE INDEX IF NOT EXISTS idx_orders_pending_depot_share
  ON public.orders (is_shared_with_depot, created_at);

ALTER TABLE public.user_roles
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS full_name text,
  ADD COLUMN IF NOT EXISTS assigned_depot text,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS invited_by uuid,
  ADD COLUMN IF NOT EXISTS last_login_at timestamptz,
  ADD COLUMN IF NOT EXISTS deactivated_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS user_roles_user_id_unique
  ON public.user_roles (user_id);

CREATE TABLE IF NOT EXISTS public.depots (
  depot_code text PRIMARY KEY,
  name text NOT NULL,
  division text NOT NULL,
  hub_market text,
  distribution_areas text[] NOT NULL DEFAULT '{}',
  phone text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.depots
  ADD COLUMN IF NOT EXISTS hub_market text,
  ADD COLUMN IF NOT EXISTS distribution_areas text[] NOT NULL DEFAULT '{}';

INSERT INTO public.depots (depot_code, name, division, hub_market, distribution_areas, phone)
VALUES
  ('DEPOT-KAW-01', 'Kalerwe Market', 'Kawempe Division', 'Kalerwe Market', ARRAY['Kawempe', 'Mpererwe', 'Komamboga', 'Kisaasi'], '+256700000101'),
  ('DEPOT-NAK-02', 'Nakawa Market', 'Nakawa Division', 'Nakawa Market', ARRAY['Nakawa', 'Bugolobi', 'Luzira', 'Ntinda', 'Naguru'], '+256700000102'),
  ('DEPOT-CEN-03', 'Nakasero Market', 'Kampala Central', 'Nakasero Market', ARRAY['Kololo', 'Nakasero', 'Kamwokya', 'Old Kampala'], '+256700000103'),
  ('DEPOT-MAK-04', 'Kibuye Market', 'Makindye Division', 'Kibuye Market', ARRAY['Kibuye', 'Katwe', 'Kansanga', 'Kabalagala', 'Ggaba'], '+256700000104'),
  ('DEPOT-RUB-05', 'Mengo Market', 'Rubaga Division', 'Mengo Market', ARRAY['Mengo', 'Lungujja', 'Rubaga', 'Kasubi', 'Ndeeba'], '+256700000105')
ON CONFLICT (depot_code) DO UPDATE
SET
  name = EXCLUDED.name,
  division = EXCLUDED.division,
  hub_market = EXCLUDED.hub_market,
  distribution_areas = EXCLUDED.distribution_areas,
  phone = EXCLUDED.phone,
  is_active = true;

UPDATE public.depots
SET is_active = false
WHERE depot_code NOT IN (
  'DEPOT-KAW-01',
  'DEPOT-NAK-02',
  'DEPOT-CEN-03',
  'DEPOT-MAK-04',
  'DEPOT-RUB-05'
);

CREATE TABLE IF NOT EXISTS public.depot_riders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  depot_code text NOT NULL REFERENCES public.depots(depot_code),
  name text NOT NULL,
  phone text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_depot_riders_depot_code
  ON public.depot_riders (depot_code, is_active);

CREATE UNIQUE INDEX IF NOT EXISTS depot_riders_depot_phone_unique
  ON public.depot_riders (depot_code, phone);

INSERT INTO public.depot_riders (depot_code, name, phone)
VALUES
  ('DEPOT-KAW-01', 'Kalerwe Rider 1', '+256700100001'),
  ('DEPOT-NAK-02', 'Nakawa Rider 1', '+256700100002'),
  ('DEPOT-CEN-03', 'Nakasero Rider 1', '+256700100003'),
  ('DEPOT-MAK-04', 'Kibuye Rider 1', '+256700100004'),
  ('DEPOT-RUB-05', 'Mengo Rider 1', '+256700100005')
ON CONFLICT (depot_code, phone) DO UPDATE
SET
  name = EXCLUDED.name,
  is_active = true;

UPDATE public.depot_riders
SET is_active = false
WHERE depot_code NOT IN (
  'DEPOT-KAW-01',
  'DEPOT-NAK-02',
  'DEPOT-CEN-03',
  'DEPOT-MAK-04',
  'DEPOT-RUB-05'
);

CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid,
  action text NOT NULL,
  target_type text NOT NULL,
  target_id text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created_at
  ON public.admin_audit_logs (created_at DESC);

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.user_roles
  WHERE user_id = auth.uid()
    AND is_active = true
    AND is_approved = true
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.current_user_depot()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT assigned_depot
  FROM public.user_roles
  WHERE user_id = auth.uid()
    AND is_active = true
    AND is_approved = true
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(public.current_user_role() IN ('admin', 'merchant'), false)
$$;

CREATE OR REPLACE FUNCTION public.is_attendant()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(public.current_user_role() = 'attendant', false)
$$;

CREATE OR REPLACE FUNCTION public.touch_last_login()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.user_roles
  SET
    last_login_at = now(),
    updated_at = now()
  WHERE user_id = auth.uid();
END;
$$;

GRANT EXECUTE ON FUNCTION public.touch_last_login() TO authenticated;

DROP POLICY IF EXISTS "anon_select_orders" ON public.orders;
DROP POLICY IF EXISTS "anon_insert_orders" ON public.orders;
DROP POLICY IF EXISTS "anon_update_orders" ON public.orders;
DROP POLICY IF EXISTS "anon_delete_orders" ON public.orders;

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
      AND is_shared_with_depot = true
      AND depot_code = public.current_user_depot()
    )
  );

DROP POLICY IF EXISTS "orders_insert_by_customer_or_admin" ON public.orders;
CREATE POLICY "orders_insert_by_customer_or_admin"
  ON public.orders
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin() OR user_id = auth.uid());

DROP POLICY IF EXISTS "orders_update_by_admin_or_attendant" ON public.orders;
CREATE POLICY "orders_update_by_admin_or_attendant"
  ON public.orders
  FOR UPDATE
  TO authenticated
  USING (
    public.is_admin()
    OR (
      public.is_attendant()
      AND is_shared_with_depot = true
      AND depot_code = public.current_user_depot()
    )
  )
  WITH CHECK (
    public.is_admin()
    OR (
      public.is_attendant()
      AND is_shared_with_depot = true
      AND depot_code = public.current_user_depot()
    )
  );

DROP POLICY IF EXISTS "orders_delete_admin_only" ON public.orders;
CREATE POLICY "orders_delete_admin_only"
  ON public.orders
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "anon_select_order_items" ON public.order_items;
DROP POLICY IF EXISTS "anon_insert_order_items" ON public.order_items;
DROP POLICY IF EXISTS "anon_update_order_items" ON public.order_items;
DROP POLICY IF EXISTS "anon_delete_order_items" ON public.order_items;

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
            AND orders.is_shared_with_depot = true
            AND orders.depot_code = public.current_user_depot()
          )
        )
    )
  );

DROP POLICY IF EXISTS "order_items_insert_by_order_owner_or_admin" ON public.order_items;
CREATE POLICY "order_items_insert_by_order_owner_or_admin"
  ON public.order_items
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.orders
      WHERE orders.id = order_items.order_id
        AND orders.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "order_items_update_admin_only" ON public.order_items;
CREATE POLICY "order_items_update_admin_only"
  ON public.order_items
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "order_items_delete_admin_only" ON public.order_items;
CREATE POLICY "order_items_delete_admin_only"
  ON public.order_items
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

ALTER TABLE public.depots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.depot_riders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "depots_select_admin_attendant" ON public.depots;
CREATE POLICY "depots_select_admin_attendant"
  ON public.depots
  FOR SELECT
  TO anon, authenticated
  USING (is_active = true OR public.is_admin());

DROP POLICY IF EXISTS "depots_admin_write" ON public.depots;
CREATE POLICY "depots_admin_write"
  ON public.depots
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "riders_select_by_role" ON public.depot_riders;
CREATE POLICY "riders_select_by_role"
  ON public.depot_riders
  FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR (public.is_attendant() AND depot_code = public.current_user_depot())
  );

DROP POLICY IF EXISTS "riders_admin_write" ON public.depot_riders;
CREATE POLICY "riders_admin_write"
  ON public.depot_riders
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "audit_logs_select_admin_only" ON public.admin_audit_logs;
CREATE POLICY "audit_logs_select_admin_only"
  ON public.admin_audit_logs
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "audit_logs_insert_admin_attendant" ON public.admin_audit_logs;
CREATE POLICY "audit_logs_insert_admin_attendant"
  ON public.admin_audit_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin() OR public.is_attendant());

DROP POLICY IF EXISTS "authenticated_select_own_user_role" ON public.user_roles;
CREATE POLICY "authenticated_select_own_user_role"
  ON public.user_roles
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "authenticated_insert_customer_role" ON public.user_roles;
CREATE POLICY "authenticated_insert_customer_role"
  ON public.user_roles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (user_id = auth.uid() AND role = 'customer' AND is_approved = false)
    OR (public.is_admin() AND role IN ('admin', 'attendant', 'merchant'))
  );

DROP POLICY IF EXISTS "authenticated_update_customer_role" ON public.user_roles;
CREATE POLICY "authenticated_update_customer_role"
  ON public.user_roles
  FOR UPDATE
  TO authenticated
  USING (
    (user_id = auth.uid() AND role = 'customer')
    OR public.is_admin()
  )
  WITH CHECK (
    (user_id = auth.uid() AND role = 'customer' AND is_approved = false)
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "user_roles_admin_delete" ON public.user_roles;
CREATE POLICY "user_roles_admin_delete"
  ON public.user_roles
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'orders'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
  END IF;
END $$;
