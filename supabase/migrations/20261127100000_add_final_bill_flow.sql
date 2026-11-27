-- Final bill flow
--
-- Catalogue prices are only estimates: market prices move daily. After buying,
-- the outlet attendant records what each line actually cost (or that it was
-- substituted / unavailable). That becomes the final bill the customer pays.
--
--   not_started        -> attendant has not submitted a bill yet
--   awaiting_approval  -> bill submitted, customer must approve
--   approved           -> customer approved (in app or by phone), or the bill
--                         was auto-approved because it is within the estimate
--                         and has no substitutions
--   queried            -> customer disputed the bill; attendant must revise
--
-- Totals are always computed here, server-side, from final_items. The client
-- never decides the amount to collect.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS final_items jsonb,
  ADD COLUMN IF NOT EXISTS final_subtotal integer,
  ADD COLUMN IF NOT EXISTS final_total integer,
  ADD COLUMN IF NOT EXISTS bill_status text NOT NULL DEFAULT 'not_started',
  ADD COLUMN IF NOT EXISTS bill_submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS bill_submitted_by_name text,
  ADD COLUMN IF NOT EXISTS bill_responded_at timestamptz,
  ADD COLUMN IF NOT EXISTS bill_approval_method text,
  ADD COLUMN IF NOT EXISTS bill_customer_note text;

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_bill_status_check;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_bill_status_check
  CHECK (bill_status IN ('not_started', 'awaiting_approval', 'approved', 'queried'));

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_bill_approval_method_check;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_bill_approval_method_check
  CHECK (
    bill_approval_method IS NULL
    OR bill_approval_method IN ('customer_app', 'phone_call', 'auto_within_estimate')
  );

-- ---------------------------------------------------------------------------
-- Trigger: compute totals, auto-approve, and stop customers forging a bill
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.orders_compute_final_bill()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  item jsonb;
  line_total integer;
  computed_subtotal integer := 0;
  has_substitution boolean := false;
  has_purchased_line boolean := false;
  estimated_total integer;
BEGIN
  -- Orders are created by customers/guests. They must never arrive with a
  -- pre-filled or pre-approved bill.
  IF TG_OP = 'INSERT' THEN
    NEW.final_items := NULL;
    NEW.final_subtotal := NULL;
    NEW.final_total := NULL;
    NEW.bill_status := 'not_started';
    NEW.bill_submitted_at := NULL;
    NEW.bill_submitted_by_name := NULL;
    NEW.bill_responded_at := NULL;
    NEW.bill_approval_method := NULL;
    NEW.bill_customer_note := NULL;
    RETURN NEW;
  END IF;

  IF NEW.final_items IS NOT NULL AND jsonb_typeof(NEW.final_items) <> 'array' THEN
    NEW.final_items := NULL;
  END IF;

  -- jsonb_array_length(NULL) is NULL (not an error), so this is safe.
  IF NEW.final_items IS NULL OR jsonb_array_length(NEW.final_items) = 0 THEN
    NEW.final_items := NULL;
    NEW.final_subtotal := NULL;
    NEW.final_total := NULL;
    IF NEW.bill_status <> 'not_started' THEN
      RAISE EXCEPTION 'A final bill needs at least one line item.';
    END IF;
    RETURN NEW;
  END IF;

  FOR item IN SELECT value FROM jsonb_array_elements(NEW.final_items) LOOP
    IF COALESCE(item->>'status', '') NOT IN ('bought', 'substituted', 'unavailable') THEN
      RAISE EXCEPTION 'Invalid final bill line status: %', item->>'status';
    END IF;

    IF item->>'status' = 'unavailable' THEN
      CONTINUE;
    END IF;

    line_total := COALESCE(NULLIF(item->>'actual_line_total', '')::numeric, 0)::integer;
    IF line_total < 0 THEN
      RAISE EXCEPTION 'Final bill line totals cannot be negative.';
    END IF;

    computed_subtotal := computed_subtotal + line_total;
    has_purchased_line := true;
    IF item->>'status' = 'substituted' THEN
      has_substitution := true;
    END IF;
  END LOOP;

  NEW.final_subtotal := computed_subtotal;
  NEW.final_total := computed_subtotal + COALESCE(NEW.delivery_fee, 0);

  -- Auto-approve a freshly submitted (or re-submitted) bill when the customer
  -- already agreed to pay at least this much and nothing was swapped.
  IF NEW.bill_status = 'awaiting_approval'
     AND (
       OLD.bill_status IS DISTINCT FROM NEW.bill_status
       OR OLD.final_items IS DISTINCT FROM NEW.final_items
     )
  THEN
    estimated_total := COALESCE(NEW.total_amount, NEW.subtotal + COALESCE(NEW.delivery_fee, 0));
    IF has_purchased_line AND NOT has_substitution AND NEW.final_total <= estimated_total THEN
      NEW.bill_status := 'approved';
      NEW.bill_approval_method := 'auto_within_estimate';
      NEW.bill_responded_at := now();
    ELSE
      NEW.bill_approval_method := NULL;
      NEW.bill_responded_at := NULL;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_compute_final_bill ON public.orders;
CREATE TRIGGER orders_compute_final_bill
  BEFORE INSERT OR UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.orders_compute_final_bill();

-- ---------------------------------------------------------------------------
-- RPC: signed-in customer approves or queries their own bill
-- (customers have no UPDATE policy on orders, so this is the only path)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.respond_to_final_bill(
  p_order_id uuid,
  p_approve boolean,
  p_note text DEFAULT NULL
)
RETURNS public.orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target public.orders;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in to respond to your bill.';
  END IF;

  SELECT * INTO target
  FROM public.orders
  WHERE id = p_order_id AND user_id = auth.uid()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found.';
  END IF;

  IF target.bill_status <> 'awaiting_approval' THEN
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
  WHERE id = p_order_id
  RETURNING * INTO target;

  RETURN target;
END;
$$;

REVOKE ALL ON FUNCTION public.respond_to_final_bill(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.respond_to_final_bill(uuid, boolean, text) TO authenticated;
