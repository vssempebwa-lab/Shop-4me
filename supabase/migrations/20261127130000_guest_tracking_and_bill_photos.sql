-- Guest order tracking, guest bill approval, and photo proof on final bills.
--
-- Guests cannot read the orders table, so until now they could not see their
-- order or approve a final bill once the confirmation screen was closed.
-- They can now look an order up with its 8-character order code (the "#ABCD1234"
-- shown after checkout) plus the phone number used at checkout.

-- ---------------------------------------------------------------------------
-- Photo proof: attendants attach photos of the goods / market receipt
-- ---------------------------------------------------------------------------
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS bill_photos text[] NOT NULL DEFAULT '{}';

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_bill_photos_limit;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_bill_photos_limit CHECK (cardinality(bill_photos) <= 6);

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('bill-photos', 'bill-photos', true, 3145728, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Objects are stored as "<order_id>/<random>.jpg". Staff may only write photos
-- for orders they can work on.
CREATE OR REPLACE FUNCTION public.can_manage_bill_photos(p_object_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_admin()
    OR (
      public.is_attendant()
      AND EXISTS (
        SELECT 1
        FROM public.orders
        WHERE id::text = split_part(p_object_name, '/', 1)
          AND is_shared_with_outlet = true
          AND outlet_code = public.current_user_outlet()
      )
    )
$$;

REVOKE ALL ON FUNCTION public.can_manage_bill_photos(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_manage_bill_photos(text) TO authenticated;

DROP POLICY IF EXISTS "public_read_bill_photos" ON storage.objects;
CREATE POLICY "public_read_bill_photos"
  ON storage.objects
  FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'bill-photos');

DROP POLICY IF EXISTS "staff_insert_bill_photos" ON storage.objects;
CREATE POLICY "staff_insert_bill_photos"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'bill-photos' AND public.can_manage_bill_photos(name));

DROP POLICY IF EXISTS "staff_delete_bill_photos" ON storage.objects;
CREATE POLICY "staff_delete_bill_photos"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'bill-photos' AND public.can_manage_bill_photos(name));

-- ---------------------------------------------------------------------------
-- Guest lookup helpers
-- ---------------------------------------------------------------------------

-- Last 9 digits, so 0772 123 456, +256 772 123 456 and 256772123456 all match.
CREATE OR REPLACE FUNCTION public.phone_match_key(p_phone text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT right(regexp_replace(COALESCE(p_phone, ''), '\D', '', 'g'), 9)
$$;

CREATE OR REPLACE FUNCTION public.find_order_by_code_and_phone(p_code text, p_phone text)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  code text := lower(regexp_replace(COALESCE(p_code, ''), '[^0-9A-Fa-f]', '', 'g'));
  phone_key text := public.phone_match_key(p_phone);
  found_id uuid;
BEGIN
  -- Exactly the 8 hex characters shown to the customer, and a full phone
  -- number: 16^8 codes per phone keeps guessing impractical.
  IF length(code) <> 8 OR length(phone_key) <> 9 THEN
    RETURN NULL;
  END IF;

  SELECT id INTO found_id
  FROM public.orders
  WHERE left(id::text, 8) = code
    AND public.phone_match_key(phone) = phone_key
  ORDER BY created_at DESC
  LIMIT 1;

  RETURN found_id;
END;
$$;

REVOKE ALL ON FUNCTION public.find_order_by_code_and_phone(text, text) FROM PUBLIC, anon, authenticated;

-- Only the fields a customer needs; no staff ids or audit data.
CREATE OR REPLACE FUNCTION public.customer_order_view(p_order_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'id', o.id,
    'contact_name', o.contact_name,
    'phone', o.phone,
    'delivery_address', o.delivery_address,
    'market_location', o.market_location,
    'outlet_code', o.outlet_code,
    'division', o.division,
    'items', o.items,
    'subtotal', o.subtotal,
    'delivery_fee', o.delivery_fee,
    'total_amount', o.total_amount,
    'payment_method', o.payment_method,
    'payment_status', o.payment_status,
    'status', o.status,
    'order_status', o.order_status,
    'dispatched_rider_name', o.dispatched_rider_name,
    'dispatched_at', o.dispatched_at,
    'delivered_at', o.delivered_at,
    'final_items', o.final_items,
    'final_subtotal', o.final_subtotal,
    'final_total', o.final_total,
    'bill_status', o.bill_status,
    'bill_submitted_at', o.bill_submitted_at,
    'bill_responded_at', o.bill_responded_at,
    'bill_approval_method', o.bill_approval_method,
    'bill_customer_note', o.bill_customer_note,
    'bill_photos', o.bill_photos,
    'user_id', o.user_id,
    'created_at', o.created_at
  )
  FROM public.orders o
  WHERE o.id = p_order_id
$$;

REVOKE ALL ON FUNCTION public.customer_order_view(uuid) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Public RPCs
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.track_order(p_code text, p_phone text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  order_id uuid := public.find_order_by_code_and_phone(p_code, p_phone);
BEGIN
  IF order_id IS NULL THEN
    RAISE EXCEPTION 'No order matches that code and phone number.' USING ERRCODE = 'P0002';
  END IF;
  RETURN public.customer_order_view(order_id);
END;
$$;

REVOKE ALL ON FUNCTION public.track_order(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.track_order(text, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.respond_to_final_bill_with_code(
  p_code text,
  p_phone text,
  p_approve boolean,
  p_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  order_id uuid := public.find_order_by_code_and_phone(p_code, p_phone);
  current_status text;
BEGIN
  IF order_id IS NULL THEN
    RAISE EXCEPTION 'No order matches that code and phone number.' USING ERRCODE = 'P0002';
  END IF;

  SELECT bill_status INTO current_status FROM public.orders WHERE id = order_id FOR UPDATE;

  IF current_status <> 'awaiting_approval' THEN
    RAISE EXCEPTION 'This bill is not waiting for your approval.';
  END IF;

  IF NOT p_approve AND COALESCE(btrim(p_note), '') = '' THEN
    RAISE EXCEPTION 'Tell the attendant what is wrong with the bill.';
  END IF;

  UPDATE public.orders
  SET
    bill_status = CASE WHEN p_approve THEN 'approved' ELSE 'queried' END,
    bill_approval_method = CASE WHEN p_approve THEN 'customer_app' ELSE NULL END,
    bill_responded_at = now(),
    bill_customer_note = NULLIF(left(btrim(COALESCE(p_note, '')), 500), '')
  WHERE id = order_id;

  RETURN public.customer_order_view(order_id);
END;
$$;

REVOKE ALL ON FUNCTION public.respond_to_final_bill_with_code(text, text, boolean, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.respond_to_final_bill_with_code(text, text, boolean, text) TO anon, authenticated;
