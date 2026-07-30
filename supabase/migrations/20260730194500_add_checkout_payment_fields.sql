ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS total_amount integer,
  ADD COLUMN IF NOT EXISTS payment_method text;

UPDATE public.orders
SET total_amount = COALESCE(total_amount, subtotal + COALESCE(delivery_fee, 0))
WHERE total_amount IS NULL;
