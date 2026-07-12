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
