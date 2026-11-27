-- Order integrity for customer / guest checkout.
--
-- Until now the browser decided item prices, subtotal and total, and could
-- also set workflow fields (status, payment, outlet sharing) on insert. A
-- guest could therefore place an order at any price, or one already marked
-- PAID / Delivered. These triggers make the database the source of truth.
--
-- Admins (is_admin()) and server-side roles (service_role, postgres) are not
-- affected, so admin tooling and migrations keep working.

-- Delivery fee charged on new customer orders. Keep in sync with
-- DELIVERY_FEE in CheckoutModal.tsx / CartDrawer.tsx until it moves to
-- settings.
CREATE OR REPLACE FUNCTION public.standard_delivery_fee()
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$ SELECT 5000 $$;

-- Uses the API request's role, not current_user: inside the SECURITY DEFINER
-- triggers below current_user is the function owner. 'anon'/'authenticated'
-- are browser clients; migrations and direct sessions have no role, and
-- server code uses 'service_role'.
CREATE OR REPLACE FUNCTION public.is_customer_request()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(auth.role(), '') IN ('anon', 'authenticated') AND NOT public.is_admin()
$$;

-- ---------------------------------------------------------------------------
-- orders: reprice from the catalogue and reset workflow fields on insert
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.orders_enforce_customer_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item jsonb;
  product record;
  qty integer;
  repriced jsonb := '[]'::jsonb;
  computed_subtotal integer := 0;
BEGIN
  IF NOT public.is_customer_request() THEN
    RETURN NEW;
  END IF;

  IF NEW.items IS NULL OR jsonb_typeof(NEW.items) <> 'array' OR jsonb_array_length(NEW.items) = 0 THEN
    RAISE EXCEPTION 'Your order has no items.';
  END IF;

  IF jsonb_array_length(NEW.items) > 100 THEN
    RAISE EXCEPTION 'Too many different items in one order.';
  END IF;

  FOR item IN SELECT value FROM jsonb_array_elements(NEW.items) LOOP
    qty := COALESCE(NULLIF(item->>'quantity', '')::numeric, 0)::integer;
    IF qty < 1 OR qty > 999 THEN
      RAISE EXCEPTION 'Invalid quantity for %.', COALESCE(item->>'name', 'an item');
    END IF;

    SELECT id, name, price, unit, in_stock INTO product
    FROM public.products
    WHERE id::text = item->>'product_id';

    IF NOT FOUND THEN
      RAISE EXCEPTION '% is no longer available. Please refresh your cart.', COALESCE(item->>'name', 'An item');
    END IF;

    IF product.in_stock IS FALSE THEN
      RAISE EXCEPTION '% is out of stock. Please remove it from your cart.', product.name;
    END IF;

    repriced := repriced || jsonb_build_object(
      'product_id', product.id,
      'name', product.name,
      'price', product.price,
      'unit', product.unit,
      'quantity', qty
    );
    computed_subtotal := computed_subtotal + product.price * qty;
  END LOOP;

  NEW.items := repriced;
  NEW.subtotal := computed_subtotal;
  NEW.delivery_fee := public.standard_delivery_fee();
  NEW.total_amount := computed_subtotal + NEW.delivery_fee;

  -- Workflow fields are staff-controlled.
  NEW.status := 'Order Received';
  NEW.order_status := 'Order Received';
  NEW.payment_status := 'PENDING';
  NEW.is_shared_with_outlet := false;
  NEW.shared_at := NULL;
  NEW.shared_by := NULL;
  NEW.shared_by_admin_id := NULL;
  NEW.shared_by_admin_name := NULL;
  NEW.manual_outlet_override := false;
  NEW.dispatched_rider_id := NULL;
  NEW.dispatched_rider_name := NULL;
  NEW.dispatched_at := NULL;
  NEW.handled_by_attendant_id := NULL;
  NEW.handled_by_attendant_name := NULL;
  NEW.delivered_at := NULL;
  NEW.created_at := now();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_enforce_customer_insert ON public.orders;
CREATE TRIGGER orders_enforce_customer_insert
  BEFORE INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.orders_enforce_customer_insert();

-- ---------------------------------------------------------------------------
-- order_items: copy price/name/unit from the catalogue
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.order_items_enforce_customer_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  product record;
BEGIN
  IF NOT public.is_customer_request() THEN
    RETURN NEW;
  END IF;

  SELECT id, name, price, unit INTO product
  FROM public.products
  WHERE id = NEW.product_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unknown product in order.';
  END IF;

  IF NEW.quantity IS NULL OR NEW.quantity < 1 OR NEW.quantity > 999 THEN
    RAISE EXCEPTION 'Invalid quantity for %.', product.name;
  END IF;

  NEW.name := product.name;
  NEW.price := product.price;
  NEW.unit := product.unit;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS order_items_enforce_customer_insert ON public.order_items;
CREATE TRIGGER order_items_enforce_customer_insert
  BEFORE INSERT ON public.order_items
  FOR EACH ROW
  EXECUTE FUNCTION public.order_items_enforce_customer_insert();

-- ---------------------------------------------------------------------------
-- order_items policy: customers may only add items to their own (or a guest)
-- order that was just created and has not been picked up by staff yet.
--
-- The lookup runs as SECURITY DEFINER because guests cannot SELECT orders;
-- the previous inline EXISTS therefore always failed for guest checkout.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_add_items_to_order(p_order_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.orders
    WHERE id = p_order_id
      AND order_status = 'Order Received'
      AND is_shared_with_outlet = false
      AND created_at > now() - interval '15 minutes'
      AND (user_id = auth.uid() OR user_id IS NULL)
  )
$$;

REVOKE ALL ON FUNCTION public.can_add_items_to_order(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_add_items_to_order(uuid) TO anon, authenticated;

DROP POLICY IF EXISTS "order_items_insert_by_guest_customer_or_admin" ON public.order_items;
CREATE POLICY "order_items_insert_by_guest_customer_or_admin"
  ON public.order_items
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (public.is_admin() OR public.can_add_items_to_order(order_id));
