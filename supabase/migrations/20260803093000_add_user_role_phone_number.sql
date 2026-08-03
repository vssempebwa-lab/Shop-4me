ALTER TABLE public.user_roles
  ADD COLUMN IF NOT EXISTS phone_number text;

ALTER TABLE public.user_roles
  DROP CONSTRAINT IF EXISTS user_roles_phone_number_uganda_format;

ALTER TABLE public.user_roles
  ADD CONSTRAINT user_roles_phone_number_uganda_format
  CHECK (
    phone_number IS NULL
    OR phone_number ~ '^(\+256(7[0-9]{8}|20[0-9]{7}|39[0-9]{7})|0(7[0-9]{8}|20[0-9]{7}|39[0-9]{7}))$'
  );
