-- Demo orders for Merchant Dashboard routing tests.
-- These are intentionally Pending/PENDING/unshared so Admin can submit them to attendants.

INSERT INTO public.products (id, name, category, price, unit, description, in_stock)
VALUES
  ('10000000-0000-4000-8000-000000000001', 'Tomatoes', 'Food Sauce', 8000, 'Per basket', 'Fresh red tomatoes for sauce.', true),
  ('10000000-0000-4000-8000-000000000002', 'Matooke', 'Fruits', 20000, 'Per bunch', 'Green cooking bananas.', true),
  ('10000000-0000-4000-8000-000000000003', 'Onions', 'Food Sauce', 6000, 'Per kg', 'Fresh onions.', true),
  ('10000000-0000-4000-8000-000000000004', 'Rice', 'And More', 12000, 'Per kg', 'Premium local rice.', true),
  ('10000000-0000-4000-8000-000000000005', 'Charcoal', 'Cooking Fuels', 15000, 'Per sack', 'Cooking charcoal.', true)
ON CONFLICT (id) DO UPDATE
SET
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  price = EXCLUDED.price,
  unit = EXCLUDED.unit,
  description = EXCLUDED.description,
  in_stock = EXCLUDED.in_stock;

INSERT INTO public.orders (
  id,
  contact_name,
  phone,
  delivery_address,
  market_location,
  items,
  subtotal,
  delivery_fee,
  status,
  order_status,
  payment_status,
  is_shared_with_depot,
  depot_code,
  division,
  created_at
)
VALUES
  (
    '20000000-0000-4000-8000-000000000001',
    'Nabweteme Sarah',
    '+256701234567',
    'Kawempe, near Kalerwe stage',
    'Kawempe',
    '[]'::jsonb,
    42000,
    5000,
    'Pending',
    'Pending',
    'PENDING',
    false,
    null,
    'Kawempe Division',
    now() - interval '30 minutes'
  ),
  (
    '20000000-0000-4000-8000-000000000002',
    'Mugisha Daniel',
    '+256772345678',
    'Ntinda, opposite Capital Shoppers',
    'Ntinda',
    '[]'::jsonb,
    68000,
    5000,
    'Pending',
    'Pending',
    'PENDING',
    false,
    null,
    'Nakawa Division',
    now() - interval '1 hour'
  ),
  (
    '20000000-0000-4000-8000-000000000003',
    'Achieng Grace',
    '+256753456789',
    'Nakasero, Parliamentary Avenue',
    'Nakasero',
    '[]'::jsonb,
    95000,
    5000,
    'Pending',
    'Pending',
    'PENDING',
    false,
    null,
    'Kampala Central',
    now() - interval '2 hours'
  ),
  (
    '20000000-0000-4000-8000-000000000004',
    'Kato Brian',
    '+256784567890',
    'Kabalagala, Muyenga Road',
    'Kabalagala',
    '[]'::jsonb,
    56000,
    5000,
    'Pending',
    'Pending',
    'PENDING',
    false,
    null,
    'Makindye Division',
    now() - interval '3 hours'
  ),
  (
    '20000000-0000-4000-8000-000000000005',
    'Namirembe Joan',
    '+256705678901',
    'Rubaga, near Mengo Hospital',
    'Rubaga',
    '[]'::jsonb,
    81000,
    5000,
    'Pending',
    'Pending',
    'PENDING',
    false,
    null,
    'Rubaga Division',
    now() - interval '4 hours'
  )
ON CONFLICT (id) DO UPDATE
SET
  contact_name = EXCLUDED.contact_name,
  phone = EXCLUDED.phone,
  delivery_address = EXCLUDED.delivery_address,
  market_location = EXCLUDED.market_location,
  subtotal = EXCLUDED.subtotal,
  delivery_fee = EXCLUDED.delivery_fee,
  status = EXCLUDED.status,
  order_status = EXCLUDED.order_status,
  payment_status = EXCLUDED.payment_status,
  is_shared_with_depot = EXCLUDED.is_shared_with_depot,
  depot_code = EXCLUDED.depot_code,
  division = EXCLUDED.division,
  created_at = EXCLUDED.created_at;

INSERT INTO public.order_items (order_id, product_id, name, price, unit, quantity)
VALUES
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Tomatoes', 8000, 'Per basket', 3),
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000003', 'Onions', 6000, 'Per kg', 3),
  ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002', 'Matooke', 20000, 'Per bunch', 2),
  ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000004', 'Rice', 12000, 'Per kg', 2),
  ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000003', 'Onions', 4000, 'Small bundle', 1),
  ('20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000004', 'Rice', 12000, 'Per kg', 5),
  ('20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000005', 'Charcoal', 15000, 'Per sack', 2),
  ('20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', 'Tomatoes', 5000, 'Small basket', 1),
  ('20000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000001', 'Tomatoes', 8000, 'Per basket', 2),
  ('20000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000002', 'Matooke', 20000, 'Per bunch', 2),
  ('20000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000005', 'Charcoal', 15000, 'Per sack', 3),
  ('20000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000004', 'Rice', 12000, 'Per kg', 3)
ON CONFLICT DO NOTHING;
