import { createClient } from '@supabase/supabase-js';

const url = (import.meta.env.VITE_SUPABASE_URL ?? '').trim();
const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').trim();

export const hasSupabaseConfig = Boolean(url && anonKey);

export const supabase = createClient(
  url || 'https://example.supabase.co',
  anonKey || 'placeholder-anon-key',
);
