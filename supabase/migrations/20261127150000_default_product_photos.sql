-- Default product photos served from the site's /products/ folder
-- (public/products, see public/products/CREDITS.md). Only fills products that
-- have no photo yet, so photos uploaded from the dashboard are never replaced.
-- Branded packaged goods are intentionally left out: a stock photo of another
-- brand would mislead buyers. Photograph the real stock instead.
WITH m(name, unit, url) AS (VALUES
  ('Rice', NULL, '/products/rice.jpg'),
  ('Charcoal', NULL, '/products/charcoal.jpg'),
  ('Charcoal (Full sack)', NULL, '/products/charcoal.jpg'),
  ('Charcoal (Small Basin)', NULL, '/products/charcoal.jpg'),
  ('Firewood (Small bundle)', NULL, '/products/firewood.jpg'),
  ('LPG Cooking Gas Refill (13kg)', NULL, '/products/lpg-gas.jpg'),
  ('LPG Cooking Gas Refill (6kg)', NULL, '/products/lpg-gas.jpg'),
  ('Onions', NULL, '/products/onions.jpg'),
  ('Tomatoes', 'Per basket', '/products/tomatoes-basket.jpg'),
  ('Avocado', NULL, '/products/avocado.jpg'),
  ('Mango (Local/Exotic)', NULL, '/products/mango.jpg'),
  ('Matooke', NULL, '/products/matooke.jpg'),
  ('Matooke (Green Bananas)', NULL, '/products/matooke.jpg'),
  ('Oranges (Local)', NULL, '/products/oranges.jpg'),
  ('Passion Fruit (Local Purple)', NULL, '/products/passion-fruit.jpg'),
  ('Pawpaw (Papaya)', NULL, '/products/papaya.jpg'),
  ('Pineapple', NULL, '/products/pineapple.jpg'),
  ('Sweet Bananas (Kabalagala)', NULL, '/products/sweet-bananas.jpg'),
  ('Watermelon', NULL, '/products/watermelon.jpg'),
  ('Blender (Electric)', NULL, '/products/blender.jpg'),
  ('Cooking Pots (Sufuria) - Set', NULL, '/products/cooking-pots.jpg'),
  ('Gas Burner (Single)', NULL, '/products/gas-burner.jpg'),
  ('Kitchen Knives Set', NULL, '/products/knives-set.jpg'),
  ('Non-Stick Frying Pan', NULL, '/products/frying-pan.jpg'),
  ('Plastic/Stainless Steel Bowl', NULL, '/products/bowl.jpg'),
  ('Wooden Cooking Spoon (Mwiko)', NULL, '/products/wooden-spoon.jpg'),
  ('Black Pepper (Ground)', NULL, '/products/black-pepper.jpg'),
  ('Carrots', NULL, '/products/carrots.jpg'),
  ('Cinnamon (Sticks/Powder)', NULL, '/products/cinnamon.jpg'),
  ('Garlic (Local/Imported)', NULL, '/products/garlic.jpg'),
  ('Ginger (Tangawizi)', NULL, '/products/ginger.jpg'),
  ('Pilau Masala', NULL, '/products/pilau-masala.jpg'),
  ('Turmeric Powder', NULL, '/products/turmeric.jpg')
)
UPDATE public.products p
SET image_url = m.url
FROM m
WHERE p.name = m.name
  AND (m.unit IS NULL OR p.unit = m.unit)
  AND COALESCE(p.image_url, '') = '';
