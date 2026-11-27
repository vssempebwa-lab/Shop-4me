CREATE TABLE IF NOT EXISTS public.site_settings (
  setting_key text PRIMARY KEY,
  setting_value jsonb NOT NULL,
  updated_by uuid,
  updated_by_name text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "site_settings_select_all" ON public.site_settings;
CREATE POLICY "site_settings_select_all"
ON public.site_settings
FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "site_settings_admin_insert" ON public.site_settings;
CREATE POLICY "site_settings_admin_insert"
ON public.site_settings
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "site_settings_admin_update" ON public.site_settings;
CREATE POLICY "site_settings_admin_update"
ON public.site_settings
FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "site_settings_admin_delete" ON public.site_settings;
CREATE POLICY "site_settings_admin_delete"
ON public.site_settings
FOR DELETE
TO authenticated
USING (public.is_admin());

INSERT INTO public.site_settings (setting_key, setting_value, updated_by_name)
VALUES
  ('primaryColor', to_jsonb('#19A4DB'::text), 'System'),
  ('navigationBarColor', to_jsonb('#082F42'::text), 'System'),
  ('accentColor', to_jsonb('#050707'::text), 'System'),
  ('buttonHoverColor', to_jsonb('#0C86B8'::text), 'System'),
  ('pageBackgroundColor', to_jsonb('#F8FAFC'::text), 'System'),
  ('surfaceBackgroundColor', to_jsonb('#FFFFFF'::text), 'System'),
  ('hoverLiftEnabled', to_jsonb(true), 'System'),
  ('cardShadowHoverEnabled', to_jsonb(true), 'System'),
  ('announcementText', to_jsonb('Welcome to Shop for me Uganda - We offer a reliable, affordable, and convenient way to get everything you need delivered straight to your doorsteps.'::text), 'System'),
  ('heroEyebrow', to_jsonb('Fresh deliveries across Uganda'::text), 'System'),
  ('heroTitle', to_jsonb('List, Order &'::text), 'System'),
  ('heroHighlight', to_jsonb('Delivered'::text), 'System'),
  ('heroBody', to_jsonb('Fresh groceries, kitchenware and cooking fuels - a reliable, affordable and convenient way to get everything you need at your doorsteps.'::text), 'System'),
  ('shopNowLabel', to_jsonb('Shop Now'::text), 'System'),
  ('browseCategoriesLabel', to_jsonb('Browse Categories'::text), 'System'),
  ('footerTagline', to_jsonb('A reliable, affordable, and convenient way to get everything you need delivered straight to your doorsteps.'::text), 'System'),
  ('productsEmptyTitle', to_jsonb('No products found.'::text), 'System'),
  ('productsEmptyText', to_jsonb('Try a different category or search term.'::text), 'System'),
  ('cartEmptyTitle', to_jsonb('Your cart is empty'::text), 'System'),
  ('cartEmptyText', to_jsonb('Add fresh groceries and essentials to get started.'::text), 'System'),
  ('continueShoppingLabel', to_jsonb('Continue Shopping'::text), 'System'),
  ('checkoutButtonLabel', to_jsonb('Checkout'::text), 'System'),
  ('allCategoryLabel', to_jsonb('All'::text), 'System'),
  ('categoryFoodSauceLabel', to_jsonb('Food Sauce'::text), 'System'),
  ('categoryFruitsLabel', to_jsonb('Fruits'::text), 'System'),
  ('categorySpicesLabel', to_jsonb('Spices'::text), 'System'),
  ('categoryKitchenWareLabel', to_jsonb('Kitchen Ware'::text), 'System'),
  ('categoryCookingFuelsLabel', to_jsonb('Cooking Fuels'::text), 'System'),
  ('categoryAndMoreLabel', to_jsonb('And More'::text), 'System')
ON CONFLICT (setting_key) DO NOTHING;
