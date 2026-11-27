-- Products entered directly in the database used "Food Sauces" and
-- "Kitchenware", which the app doesn't recognise, so those products never
-- appeared under their category tiles. Normalise them, then only allow the
-- six categories the app knows (src/types.ts Category / CategoryBar.tsx).
UPDATE public.products SET category = 'Food Sauce' WHERE category = 'Food Sauces';
UPDATE public.products SET category = 'Kitchen Ware' WHERE category = 'Kitchenware';

ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_category_check;
ALTER TABLE public.products
  ADD CONSTRAINT products_category_check
  CHECK (category IN ('Food Sauce', 'Fruits', 'Spices', 'Kitchen Ware', 'Cooking Fuels', 'And More'));
