-- Goods are bought during Processing; the customer must agree to what they
-- will pay before the rider leaves. Attendants (and any non-admin API caller)
-- cannot move an order to Transit or Delivered until its final bill is
-- approved. Admins may override; the dashboard asks them to confirm and
-- writes an audit log entry.
CREATE OR REPLACE FUNCTION public.orders_require_bill_approval()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF COALESCE(auth.role(), '') IN ('anon', 'authenticated')
     AND NOT public.is_admin()
     AND NEW.order_status IN ('Transit', 'Delivered')
     AND OLD.order_status IS DISTINCT FROM NEW.order_status
     AND COALESCE(OLD.order_status, '') NOT IN ('Transit', 'Delivered')
     AND NEW.bill_status IS DISTINCT FROM 'approved'
  THEN
    RAISE EXCEPTION 'The final bill must be approved before the order is dispatched.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_require_bill_approval ON public.orders;
CREATE TRIGGER orders_require_bill_approval
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.orders_require_bill_approval();
