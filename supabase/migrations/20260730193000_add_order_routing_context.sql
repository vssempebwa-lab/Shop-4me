ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS shared_by_admin_id uuid,
  ADD COLUMN IF NOT EXISTS shared_by_admin_name text,
  ADD COLUMN IF NOT EXISTS manual_depot_override boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS suggested_depot_code text;

UPDATE public.orders
SET shared_by_admin_id = COALESCE(shared_by_admin_id, shared_by)
WHERE shared_by_admin_id IS NULL
  AND shared_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_attendant_realtime
  ON public.orders (depot_code, is_shared_with_depot, shared_at DESC);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'orders_shared_by_admin_id_fkey'
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_shared_by_admin_id_fkey
      FOREIGN KEY (shared_by_admin_id)
      REFERENCES auth.users(id)
      ON DELETE SET NULL;
  END IF;
END $$;
