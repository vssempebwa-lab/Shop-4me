-- Security hardening: remove anonymous / public write access left over from
-- early prototyping.
--
-- 1. products: anyone (even anon) could INSERT/UPDATE/DELETE. Now: public read,
--    admin-only writes.
-- 2. product-images bucket: anon could upload/replace/delete. Now admin-only.
-- 3. avatars bucket: any signed-in user (customers included) could overwrite or
--    delete anyone's avatar. Now: admins, or the user in their own folder.
-- 4. Legacy admin_credentials / customer_credentials tables were world-readable
--    and world-insertable and are unused (Supabase Auth + user_roles replaced
--    them). Dropped.

-- ---------------------------------------------------------------------------
-- products
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "anon_select_products" ON public.products;
DROP POLICY IF EXISTS "anon_insert_products" ON public.products;
DROP POLICY IF EXISTS "anon_update_products" ON public.products;
DROP POLICY IF EXISTS "anon_delete_products" ON public.products;

DROP POLICY IF EXISTS "products_public_select" ON public.products;
CREATE POLICY "products_public_select"
  ON public.products
  FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "products_admin_insert" ON public.products;
CREATE POLICY "products_admin_insert"
  ON public.products
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "products_admin_update" ON public.products;
CREATE POLICY "products_admin_update"
  ON public.products
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "products_admin_delete" ON public.products;
CREATE POLICY "products_admin_delete"
  ON public.products
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ---------------------------------------------------------------------------
-- storage: product-images
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "merchant_insert_product_images" ON storage.objects;
CREATE POLICY "merchant_insert_product_images"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'product-images' AND public.is_admin());

DROP POLICY IF EXISTS "merchant_update_product_images" ON storage.objects;
CREATE POLICY "merchant_update_product_images"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'product-images' AND public.is_admin())
  WITH CHECK (bucket_id = 'product-images' AND public.is_admin());

DROP POLICY IF EXISTS "merchant_delete_product_images" ON storage.objects;
CREATE POLICY "merchant_delete_product_images"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'product-images' AND public.is_admin());

-- ---------------------------------------------------------------------------
-- storage: avatars (objects are stored under "<user_id>/<file>")
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "authenticated_insert_avatars" ON storage.objects;
CREATE POLICY "authenticated_insert_avatars"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (public.is_admin() OR (storage.foldername(name))[1] = auth.uid()::text)
  );

DROP POLICY IF EXISTS "authenticated_update_avatars" ON storage.objects;
CREATE POLICY "authenticated_update_avatars"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (public.is_admin() OR (storage.foldername(name))[1] = auth.uid()::text)
  )
  WITH CHECK (
    bucket_id = 'avatars'
    AND (public.is_admin() OR (storage.foldername(name))[1] = auth.uid()::text)
  );

DROP POLICY IF EXISTS "authenticated_delete_avatars" ON storage.objects;
CREATE POLICY "authenticated_delete_avatars"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (public.is_admin() OR (storage.foldername(name))[1] = auth.uid()::text)
  );

-- ---------------------------------------------------------------------------
-- legacy credential tables
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS public.admin_credentials;
DROP TABLE IF EXISTS public.customer_credentials;
