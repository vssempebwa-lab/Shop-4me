CREATE TABLE IF NOT EXISTS public.payment_settings (
  id text PRIMARY KEY DEFAULT 'default',
  mtn_till_number text NOT NULL DEFAULT '700000',
  mtn_dial_code text NOT NULL DEFAULT '1653#',
  mtn_label text NOT NULL DEFAULT 'MoMo from MTN',
  airtel_till_number text NOT NULL DEFAULT '700001',
  airtel_label text NOT NULL DEFAULT 'Airtel Money Merchant',
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payment_settings_singleton CHECK (id = 'default'),
  CONSTRAINT payment_settings_mtn_till_digits CHECK (mtn_till_number ~ '^[0-9]{6}$'),
  CONSTRAINT payment_settings_airtel_till_digits CHECK (airtel_till_number ~ '^[0-9]{6}$')
);

ALTER TABLE public.payment_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payment_settings_admin_select" ON public.payment_settings;
CREATE POLICY "payment_settings_admin_select"
ON public.payment_settings
FOR SELECT
TO authenticated
USING (public.current_user_role() = 'admin');

DROP POLICY IF EXISTS "payment_settings_admin_insert" ON public.payment_settings;
CREATE POLICY "payment_settings_admin_insert"
ON public.payment_settings
FOR INSERT
TO authenticated
WITH CHECK (public.current_user_role() = 'admin');

DROP POLICY IF EXISTS "payment_settings_admin_update" ON public.payment_settings;
CREATE POLICY "payment_settings_admin_update"
ON public.payment_settings
FOR UPDATE
TO authenticated
USING (public.current_user_role() = 'admin')
WITH CHECK (public.current_user_role() = 'admin');

CREATE OR REPLACE FUNCTION public.get_payment_settings()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'mtn_till_number', COALESCE(mtn_till_number, '700000'),
    'mtn_dial_code', COALESCE(mtn_dial_code, '1653#'),
    'mtn_label', COALESCE(mtn_label, 'MoMo from MTN'),
    'airtel_till_number', COALESCE(airtel_till_number, '700001'),
    'airtel_label', COALESCE(airtel_label, 'Airtel Money Merchant'),
    'updated_by', updated_by,
    'updated_at', updated_at
  )
  FROM public.payment_settings
  WHERE id = 'default'
  LIMIT 1
$$;

GRANT EXECUTE ON FUNCTION public.get_payment_settings() TO anon, authenticated;

INSERT INTO public.payment_settings (
  id,
  mtn_till_number,
  mtn_dial_code,
  mtn_label,
  airtel_till_number,
  airtel_label
)
VALUES (
  'default',
  '700000',
  '1653#',
  'MoMo from MTN',
  '700001',
  'Airtel Money Merchant'
)
ON CONFLICT (id) DO NOTHING;
