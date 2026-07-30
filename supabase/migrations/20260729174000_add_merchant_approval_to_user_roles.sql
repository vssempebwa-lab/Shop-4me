ALTER TABLE public.user_roles
  ADD COLUMN IF NOT EXISTS is_approved boolean NOT NULL DEFAULT false;

UPDATE public.user_roles
SET is_approved = true
WHERE role IN ('admin', 'attendant')
  AND is_approved = false;

ALTER TABLE public.user_roles
  DROP CONSTRAINT IF EXISTS user_roles_role_check;

ALTER TABLE public.user_roles
  ADD CONSTRAINT user_roles_role_check
  CHECK (role IN ('admin', 'attendant', 'merchant', 'customer'));

DROP POLICY IF EXISTS "anon_select_user_roles" ON public.user_roles;
CREATE POLICY "authenticated_select_own_user_role"
  ON public.user_roles
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "anon_insert_user_roles" ON public.user_roles;
CREATE POLICY "authenticated_insert_customer_role"
  ON public.user_roles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND role = 'customer'
    AND is_approved = false
  );

DROP POLICY IF EXISTS "anon_update_user_roles" ON public.user_roles;
CREATE POLICY "authenticated_update_customer_role"
  ON public.user_roles
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() AND role = 'customer')
  WITH CHECK (
    user_id = auth.uid()
    AND role = 'customer'
    AND is_approved = false
  );

DROP POLICY IF EXISTS "anon_delete_user_roles" ON public.user_roles;
