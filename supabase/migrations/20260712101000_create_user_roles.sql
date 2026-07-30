-- Create user_roles table to map Supabase Auth users to application roles (admin, attendant, customer)
CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Allow basic RLS operations for anon + authenticated to read roles (you may want to restrict this later)
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_user_roles" ON public.user_roles;
CREATE POLICY "anon_select_user_roles" ON public.user_roles FOR SELECT
  TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "anon_insert_user_roles" ON public.user_roles;
CREATE POLICY "anon_insert_user_roles" ON public.user_roles FOR INSERT
  TO authenticated WITH CHECK (user_id = auth.uid() AND role = 'customer');

DROP POLICY IF EXISTS "anon_update_user_roles" ON public.user_roles;
CREATE POLICY "anon_update_user_roles" ON public.user_roles FOR UPDATE
  TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid() AND role = 'customer');

DROP POLICY IF EXISTS "anon_delete_user_roles" ON public.user_roles;
CREATE POLICY "anon_delete_user_roles" ON public.user_roles FOR DELETE
  TO authenticated USING (user_id = auth.uid());
