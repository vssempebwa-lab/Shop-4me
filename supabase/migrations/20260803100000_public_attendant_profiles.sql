CREATE OR REPLACE FUNCTION public.get_public_attendant_for_outlet(p_outlet_code text)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  full_name text,
  phone_number text,
  avatar_url text,
  role text,
  assigned_outlet text,
  is_active boolean,
  is_approved boolean
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    ur.id,
    ur.user_id,
    ur.full_name,
    ur.phone_number,
    ur.avatar_url,
    ur.role,
    ur.assigned_outlet,
    ur.is_active,
    ur.is_approved
  FROM public.user_roles ur
  WHERE ur.role = 'attendant'
    AND ur.assigned_outlet = p_outlet_code
    AND COALESCE(ur.is_active, true) = true
    AND COALESCE(ur.is_approved, false) = true
  ORDER BY ur.created_at ASC
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_public_attendant_for_outlet(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_attendant_for_outlet(text) TO anon, authenticated;
