/*
# Create products and orders tables for Shop For Me Uganda

1. New Tables
- `products`: catalog of grocery, kitchenware, and fuel items sold by the store.
  - `id` (uuid, primary key)
  - `name` (text, not null) — product display name
  - `category` (text, not null) — one of: Food Sauce, Fruits, Spices, Kitchen Ware, Cooking Fuels, And More
  - `price` (integer, not null) — price in UGX
  - `unit` (text, not null) — portion/size description, e.g. "7 pieces", "1 piece"
  - `image_url` (text) — image URL
  - `description` (text) — short product description
  - `in_stock` (boolean, default true)
  - `created_at` (timestamptz)
- `orders`: customer delivery orders.
  - `id` (uuid, primary key)
  - `contact_name` (text, not null)
  - `phone` (text, not null) — MTN/Airtel mobile money contact
  - `delivery_address` (text, not null)
  - `items` (jsonb, not null) — array of {product_id, name, price, unit, quantity}
  - `subtotal` (integer, not null) — total in UGX
  - `status` (text, default 'Dispatched to Doorstep')
  - `created_at` (timestamptz)

2. Security
- Enable RLS on both tables.
- Single-tenant (no auth): allow anon + authenticated CRUD on both tables so the
  anon-key frontend can read products and create/view orders.
*/

CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL,
  price integer NOT NULL,
  unit text NOT NULL,
  image_url text,
  description text,
  in_stock boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_products" ON products;
CREATE POLICY "anon_select_products" ON products FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_products" ON products;
CREATE POLICY "anon_insert_products" ON products FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_products" ON products;
CREATE POLICY "anon_update_products" ON products FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_products" ON products;
CREATE POLICY "anon_delete_products" ON products FOR DELETE
  TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_name text NOT NULL,
  phone text NOT NULL,
  delivery_address text NOT NULL,
  items jsonb NOT NULL,
  subtotal integer NOT NULL,
  status text NOT NULL DEFAULT 'Dispatched to Doorstep',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_orders" ON orders;
CREATE POLICY "anon_select_orders" ON orders FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_orders" ON orders;
CREATE POLICY "anon_insert_orders" ON orders FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_orders" ON orders;
CREATE POLICY "anon_update_orders" ON orders FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_orders" ON orders;
CREATE POLICY "anon_delete_orders" ON orders FOR DELETE
  TO anon, authenticated USING (true);

-- Seed common product catalog entries (fruits, spices, kitchenware, fuels, sauces)
-- Inserts are guarded to avoid duplicates when re-running migrations.
-- Fruits
INSERT INTO products (name, category, price, unit, description)
SELECT 'Matooke (Green Bananas)', 'Fruits', 20000, 'Per bunch', 'Green cooking bananas (matooke) - sold per bunch'
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Matooke (Green Bananas)');

INSERT INTO products (name, category, price, unit, description)
SELECT 'Sweet Bananas (Kabalagala)', 'Fruits', 1500, 'Cluster of 6–10 fingers', 'Sweet dessert bananas, commonly sold in clusters'
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Sweet Bananas (Kabalagala)');

INSERT INTO products (name, category, price, unit, description)
SELECT 'Watermelon', 'Fruits', 6000, 'Per piece', 'Medium to large watermelon'
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Watermelon');

INSERT INTO products (name, category, price, unit, description)
SELECT 'Pineapple', 'Fruits', 3000, 'Per piece', 'Fresh pineapple (depending on size)'
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Pineapple');

INSERT INTO products (name, category, price, unit, description)
SELECT 'Mango (Local/Exotic)', 'Fruits', 1500, 'Per piece', 'Local or exotic mango varieties'
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Mango (Local/Exotic)');

INSERT INTO products (name, category, price, unit, description)
SELECT 'Passion Fruit (Local Purple)', 'Fruits', 4000, 'Per kilogram', 'Local purple passion fruits, sold by kg'
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Passion Fruit (Local Purple)');

INSERT INTO products (name, category, price, unit, description)
SELECT 'Pawpaw (Papaya)', 'Fruits', 3500, 'Per piece', 'Ripe pawpaw (papaya)'
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Pawpaw (Papaya)');

INSERT INTO products (name, category, price, unit, description)
SELECT 'Oranges (Local)', 'Fruits', 2500, 'Heap of 5–8 pieces', 'Local oranges sold as a small heap'
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Oranges (Local)');

INSERT INTO products (name, category, price, unit, description)
SELECT 'Avocado', 'Fruits', 1000, 'Per piece', 'Fresh avocado'
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Avocado');

-- Spices
INSERT INTO products (name, category, price, unit, description)
SELECT 'Ginger (Tangawizi)', 'Spices', 5000, 'Per kilogram', 'Fresh ginger root (tangawizi) sold per kg'
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Ginger (Tangawizi)');

INSERT INTO products (name, category, price, unit, description)
SELECT 'Garlic (Local/Imported)', 'Spices', 10000, 'Per kilogram', 'Garlic bulbs (local or imported) sold per kg'
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Garlic (Local/Imported)');

INSERT INTO products (name, category, price, unit, description)
SELECT 'Pilau Masala', 'Spices', 2250, '50g sachet', 'Pilau masala spice blend in small sachet or container'
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Pilau Masala');

INSERT INTO products (name, category, price, unit, description)
SELECT 'Royco Mchuzi Mix', 'Spices', 3250, '200g container', 'Royco mchuzi mix (cooking spice)'
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Royco Mchuzi Mix');

INSERT INTO products (name, category, price, unit, description)
SELECT 'Turmeric Powder', 'Spices', 3000, '100g pack', 'Ground turmeric powder'
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Turmeric Powder');

INSERT INTO products (name, category, price, unit, description)
SELECT 'Black Pepper (Ground)', 'Spices', 4250, '100g pack', 'Ground black pepper'
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Black Pepper (Ground)');

INSERT INTO products (name, category, price, unit, description)
SELECT 'Cinnamon (Sticks/Powder)', 'Spices', 3000, 'Small bundle / 50g', 'Cinnamon sticks or powder, small pack'
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Cinnamon (Sticks/Powder)');

-- Kitchenware
INSERT INTO products (name, category, price, unit, description)
SELECT 'Cooking Pots (Sufuria) - Set', 'Kitchenware', 30000, 'Set (3–5 pieces)', 'Local aluminum cooking pot set (sufuria)'
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Cooking Pots (Sufuria) - Set');

INSERT INTO products (name, category, price, unit, description)
SELECT 'Non-Stick Frying Pan', 'Kitchenware', 42500, 'Medium size', 'Non-stick frying pan (imported/supermarket quality)'
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Non-Stick Frying Pan');

INSERT INTO products (name, category, price, unit, description)
SELECT 'Blender (Electric)', 'Kitchenware', 130000, '1.5L basic', 'Electric blender, basic 1.5L model'
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Blender (Electric)');

INSERT INTO products (name, category, price, unit, description)
SELECT 'Kitchen Knives Set', 'Kitchenware', 20000, 'Pack', 'Set of 3–5 basic kitchen knives'
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Kitchen Knives Set');

INSERT INTO products (name, category, price, unit, description)
SELECT 'Wooden Cooking Spoon (Mwiko)', 'Kitchenware', 2250, 'Per piece', 'Traditional wooden cooking spoon (mwiko)'
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Wooden Cooking Spoon (Mwiko)');

INSERT INTO products (name, category, price, unit, description)
SELECT 'Plastic/Stainless Steel Bowl', 'Kitchenware', 7500, 'Per piece', 'Mix of plastic and stainless steel bowls available'
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Plastic/Stainless Steel Bowl');

INSERT INTO products (name, category, price, unit, description)
SELECT 'Gas Burner (Single)', 'Kitchenware', 62500, 'Single burner', 'Tabletop gas burner with manual ignition'
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Gas Burner (Single)');

-- Cooking Fuels
INSERT INTO products (name, category, price, unit, description)
SELECT 'Charcoal (Full sack)', 'Cooking Fuels', 77500, 'Per full sack', 'Full sack of charcoal for household cooking'
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Charcoal (Full sack)');

INSERT INTO products (name, category, price, unit, description)
SELECT 'Charcoal (Small Basin)', 'Cooking Fuels', 6500, 'Small retail measure', 'Small basin of charcoal for quick use'
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Charcoal (Small Basin)');

INSERT INTO products (name, category, price, unit, description)
SELECT 'LPG Cooking Gas Refill (6kg)', 'Cooking Fuels', 50000, '6 kg refill', 'LPG cylinder refill, 6 kg'
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'LPG Cooking Gas Refill (6kg)');

INSERT INTO products (name, category, price, unit, description)
SELECT 'LPG Cooking Gas Refill (13kg)', 'Cooking Fuels', 100000, '13 kg refill', 'LPG cylinder refill, 13 kg'
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'LPG Cooking Gas Refill (13kg)');

INSERT INTO products (name, category, price, unit, description)
SELECT 'Kerosene (Paraffin)', 'Cooking Fuels', 4850, 'Per liter', 'Kerosene / paraffin sold per litre'
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Kerosene (Paraffin)');

INSERT INTO products (name, category, price, unit, description)
SELECT 'Firewood (Small bundle)', 'Cooking Fuels', 10000, 'Small split bundle', 'Locally sourced firewood, small bundle'
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Firewood (Small bundle)');

INSERT INTO products (name, category, price, unit, description)
SELECT 'Vegetable Cooking Oil (Buto) - 1L', 'Cooking Fuels', 8500, '1 Liter', 'Vegetable cooking oil (Buto) 1L bottle or sachet'
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Vegetable Cooking Oil (Buto) - 1L');

-- Food Sauces
INSERT INTO products (name, category, price, unit, description)
SELECT 'Tomato Sauce (Macdo/Zesta)', 'Food Sauces', 7500, '700g bottle', 'Popular tomato sauce brands (Macdo/Zesta)'
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Tomato Sauce (Macdo/Zesta)');

INSERT INTO products (name, category, price, unit, description)
SELECT 'Chilli Sauce (Kakira/Supa)', 'Food Sauces', 4000, '300ml bottle', 'Spicy chilli sauce (Kakira or Supa)'
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Chilli Sauce (Kakira/Supa)');

INSERT INTO products (name, category, price, unit, description)
SELECT 'Mayonnaise', 'Food Sauces', 12000, '400g jar', 'Mayonnaise jar for sandwiches and salads'
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Mayonnaise');

INSERT INTO products (name, category, price, unit, description)
SELECT 'Soy Sauce', 'Food Sauces', 7000, '500ml bottle', 'Soy sauce for cooking'
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Soy Sauce');

INSERT INTO products (name, category, price, unit, description)
SELECT 'Tomato Paste', 'Food Sauces', 2250, '70g tin', 'Small tin of concentrated tomato paste'
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Tomato Paste');
