-- Drop the old status rule first: it does not allow 'Order Received', so the
-- renames below would otherwise fail on databases that still have it.
ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_order_status_check;

UPDATE public.orders
SET order_status = 'Order Received'
WHERE order_status IS NULL OR order_status = 'Pending';

UPDATE public.orders
SET order_status = 'Processing'
WHERE order_status IN ('Confirmed', 'Packed', 'Assigned to Depot', 'Assigned to Attendant');

UPDATE public.orders
SET order_status = 'Transit'
WHERE order_status IN ('Out for Delivery', 'Dispatched to Doorstep');

ALTER TABLE public.orders
  ADD CONSTRAINT orders_order_status_check
  CHECK (order_status IN ('Order Received', 'Processing', 'Transit', 'Delivered', 'Cancelled'));
