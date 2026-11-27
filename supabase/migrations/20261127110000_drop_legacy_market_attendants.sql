-- Legacy username/password table for market attendants, created by hand
-- before the app moved to Supabase Auth + user_roles. Nothing reads it, and
-- its policy let any signed-in user read and change every row (including the
-- password hash). Attendants now sign in through Supabase Auth.
DROP TABLE IF EXISTS public.market_attendants;
