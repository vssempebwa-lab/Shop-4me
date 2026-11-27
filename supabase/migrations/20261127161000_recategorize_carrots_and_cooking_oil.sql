-- Carrots were filed under Spices and Buto cooking oil under Cooking Fuels.
-- Both belong with the other fresh groceries and cooking oil in Food Sauce.
UPDATE public.products
SET category = 'Food Sauce'
WHERE (name = 'Carrots' AND category = 'Spices')
   OR (name = 'Vegetable Cooking Oil (Buto) - 1L' AND category = 'Cooking Fuels');
