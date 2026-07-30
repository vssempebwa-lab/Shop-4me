CREATE TABLE IF NOT EXISTS public.site_content (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_key text NOT NULL,
  content jsonb NOT NULL,
  version integer NOT NULL DEFAULT 0,
  is_published boolean NOT NULL DEFAULT false,
  updated_by uuid,
  updated_by_name text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT site_content_section_publish_unique UNIQUE (section_key, is_published)
);

CREATE TABLE IF NOT EXISTS public.site_content_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_key text NOT NULL,
  version_number integer NOT NULL,
  content jsonb NOT NULL,
  published_by uuid,
  published_by_name text,
  published_at timestamptz NOT NULL DEFAULT now(),
  change_summary jsonb,
  CONSTRAINT site_content_versions_unique UNIQUE (section_key, version_number)
);

ALTER TABLE public.site_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_content_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "site_content_public_read_published" ON public.site_content;
CREATE POLICY "site_content_public_read_published"
ON public.site_content
FOR SELECT
TO anon, authenticated
USING (is_published = true OR public.is_admin());

DROP POLICY IF EXISTS "site_content_admin_insert" ON public.site_content;
CREATE POLICY "site_content_admin_insert"
ON public.site_content
FOR INSERT
TO authenticated
WITH CHECK (public.current_user_role() = 'admin');

DROP POLICY IF EXISTS "site_content_admin_update" ON public.site_content;
CREATE POLICY "site_content_admin_update"
ON public.site_content
FOR UPDATE
TO authenticated
USING (public.current_user_role() = 'admin')
WITH CHECK (public.current_user_role() = 'admin');

DROP POLICY IF EXISTS "site_content_versions_admin_select" ON public.site_content_versions;
CREATE POLICY "site_content_versions_admin_select"
ON public.site_content_versions
FOR SELECT
TO authenticated
USING (public.current_user_role() = 'admin');

DROP POLICY IF EXISTS "site_content_versions_admin_insert" ON public.site_content_versions;
CREATE POLICY "site_content_versions_admin_insert"
ON public.site_content_versions
FOR INSERT
TO authenticated
WITH CHECK (public.current_user_role() = 'admin');

DROP POLICY IF EXISTS "site_content_versions_admin_delete" ON public.site_content_versions;
CREATE POLICY "site_content_versions_admin_delete"
ON public.site_content_versions
FOR DELETE
TO authenticated
USING (public.current_user_role() = 'admin');

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'site-assets',
  'site-assets',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "public_read_site_assets" ON storage.objects;
CREATE POLICY "public_read_site_assets"
ON storage.objects
FOR SELECT
TO anon, authenticated
USING (bucket_id = 'site-assets');

DROP POLICY IF EXISTS "admin_insert_site_assets" ON storage.objects;
CREATE POLICY "admin_insert_site_assets"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'site-assets' AND public.current_user_role() = 'admin');

DROP POLICY IF EXISTS "admin_update_site_assets" ON storage.objects;
CREATE POLICY "admin_update_site_assets"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'site-assets' AND public.current_user_role() = 'admin')
WITH CHECK (bucket_id = 'site-assets' AND public.current_user_role() = 'admin');

DROP POLICY IF EXISTS "admin_delete_site_assets" ON storage.objects;
CREATE POLICY "admin_delete_site_assets"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'site-assets' AND public.current_user_role() = 'admin');

INSERT INTO public.site_content (
  section_key,
  content,
  version,
  is_published,
  updated_by_name
)
VALUES (
  'global',
  jsonb_build_object(
    'primaryColor', '#19A4DB',
    'navigationBarColor', '#082F42',
    'accentColor', '#050707',
    'buttonHoverColor', '#0C86B8',
    'navLinkHoverColor', '#19A4DB',
    'pageBackgroundColor', '#F8FAFC',
    'surfaceBackgroundColor', '#FFFFFF',
    'headingScale', 'medium',
    'hoverLiftEnabled', true,
    'cardShadowHoverEnabled', true,
    'buttonScaleHoverEnabled', false,
    'buttonShadowHoverEnabled', true,
    'navLinkHoverEnabled', true,
    'announcementText', 'Welcome to Shop for me Uganda - We offer a reliable, affordable, and convenient way to get everything you need delivered straight to your doorsteps.',
    'heroEyebrow', 'Fresh deliveries across Uganda',
    'heroTitle', 'List, Order &',
    'heroHighlight', 'Delivered',
    'heroBody', 'Fresh groceries, kitchenware and cooking fuels - a reliable, affordable and convenient way to get everything you need at your doorsteps.',
    'heroBackgroundImageUrl', '',
    'shopNowLabel', 'Shop Now',
    'browseCategoriesLabel', 'Browse Categories',
    'footerTagline', 'A reliable, affordable, and convenient way to get everything you need delivered straight to your doorsteps.',
    'footerCategoriesTitle', 'Categories',
    'footerCategories', jsonb_build_array('Food Sauce', 'Fruits', 'Spices', 'Kitchen Ware', 'Cooking Fuels'),
    'footerContactTitle', 'Contact',
    'footerPhone', '+256 700 000 000',
    'footerEmail', 'hello@shopforme.ug',
    'footerAddress', 'Kampala, Uganda',
    'footerShopkeepersTitle', 'For Shop Keepers',
    'footerShopkeepersText', 'Switch to the merchant view to manage products, prices and orders.',
    'footerPaymentText', 'Pay with MTN / Airtel Mobile Money',
    'productsEmptyTitle', 'No products found.',
    'productsEmptyText', 'Try a different category or search term.',
    'cartEmptyTitle', 'Your cart is empty',
    'cartEmptyText', 'Add fresh groceries and essentials to get started.',
    'continueShoppingLabel', 'Continue Shopping',
    'checkoutButtonLabel', 'Checkout',
    'allCategoryLabel', 'All',
    'categoryFoodSauceLabel', 'Food Sauce',
    'categoryFruitsLabel', 'Fruits',
    'categorySpicesLabel', 'Spices',
    'categoryKitchenWareLabel', 'Kitchen Ware',
    'categoryCookingFuelsLabel', 'Cooking Fuels',
    'categoryAndMoreLabel', 'And More',
    'decorativeImageUrl', '',
    'categories', jsonb_build_array(
      jsonb_build_object('key', 'Food Sauce', 'label', 'Food Sauce', 'blurb', 'Fresh groceries & vegetables', 'imageUrl', '', 'hoverImageUrl', '', 'hoverSwapEnabled', false),
      jsonb_build_object('key', 'Fruits', 'label', 'Fruits', 'blurb', 'Seasonal fresh fruits', 'imageUrl', '', 'hoverImageUrl', '', 'hoverSwapEnabled', false),
      jsonb_build_object('key', 'Spices', 'label', 'Spices', 'blurb', 'Aromatic spices & seasonings', 'imageUrl', '', 'hoverImageUrl', '', 'hoverSwapEnabled', false),
      jsonb_build_object('key', 'Kitchen Ware', 'label', 'Kitchen Ware', 'blurb', 'Cookware & dinnerware', 'imageUrl', '', 'hoverImageUrl', '', 'hoverSwapEnabled', false),
      jsonb_build_object('key', 'Cooking Fuels', 'label', 'Cooking Fuels', 'blurb', 'Gas, charcoal & more', 'imageUrl', '', 'hoverImageUrl', '', 'hoverSwapEnabled', false),
      jsonb_build_object('key', 'And More', 'label', 'And More', 'blurb', 'Everything else we stock', 'imageUrl', '', 'hoverImageUrl', '', 'hoverSwapEnabled', false)
    ),
    'trustBadges', jsonb_build_array(
      jsonb_build_object('key', 'delivery', 'icon', 'truck', 'title', 'Doorstep Delivery', 'description', 'Across Uganda, fast & reliable', 'imageUrl', ''),
      jsonb_build_object('key', 'quality', 'icon', 'shield', 'title', 'Quality Promise', 'description', 'Fresh produce or refunded', 'imageUrl', ''),
      jsonb_build_object('key', 'hours', 'icon', 'clock', 'title', 'Convenient Hours', 'description', 'Order anytime, we deliver', 'imageUrl', '')
    )
  ),
  1,
  true,
  'System'
)
ON CONFLICT (section_key, is_published) DO NOTHING;
