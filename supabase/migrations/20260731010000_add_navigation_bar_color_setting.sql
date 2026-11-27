INSERT INTO public.site_settings (setting_key, setting_value, updated_by_name)
VALUES ('navigationBarColor', to_jsonb('#082F42'::text), 'System')
ON CONFLICT (setting_key) DO NOTHING;
