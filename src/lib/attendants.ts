import { supabase } from './supabase';
import type { UserRoleProfile } from '../types';
import { readLocalAdminUsers, readSharedLocalAdminUsers } from './localAdminUsers';

export async function fetchPublicAttendantForOutlet(outletCode: string) {
  const normalizedOutlet = outletCode.trim();
  if (!normalizedOutlet) {
    return { attendant: null, error: 'No outlet selected.' };
  }

  const localAttendant = await readSharedLocalAttendantForOutlet(normalizedOutlet);

  const { data, error } = await supabase.rpc('get_public_attendant_for_outlet', {
    p_outlet_code: normalizedOutlet,
  });

  if (!error) {
    const profile = Array.isArray(data) ? data[0] : data;
    return {
      attendant: (profile as UserRoleProfile | null) ?? localAttendant,
      error: null,
    };
  }

  console.error('Unable to load public attendant profile.', error);

  // Fallback when the public RPC is missing/unavailable in this Supabase project.
  const directAttendant = await fetchAttendantFromUserRoles(normalizedOutlet);
  if (directAttendant) {
    return { attendant: directAttendant, error: null };
  }

  if (localAttendant) {
    return { attendant: localAttendant, error: null };
  }

  const missingRpc =
    error.code === 'PGRST202' ||
    /could not find the function/i.test(error.message || '') ||
    /schema cache/i.test(error.message || '');

  if (missingRpc) {
    return {
      attendant: buildCheckoutFallbackAttendant(normalizedOutlet),
      error: null,
    };
  }

  return {
    attendant: null,
    error: error.message || 'Unable to load attendant profile.',
  };
}

async function readSharedLocalAttendantForOutlet(outletCode: string) {
  try {
    const users = await readSharedLocalAdminUsers();
    return (
      users.find(
        (user) =>
          user.role === 'attendant' &&
          user.assigned_outlet === outletCode &&
          user.is_active !== false &&
          user.is_approved !== false,
      ) ?? null
    );
  } catch {
    return (
      readLocalAdminUsers().find(
        (user) =>
          user.role === 'attendant' &&
          user.assigned_outlet === outletCode &&
          user.is_active !== false,
      ) ?? null
    );
  }
}

async function fetchAttendantFromUserRoles(outletCode: string) {
  try {
    const { data, error } = await supabase
      .from('user_roles')
      .select(
        'id,user_id,email,full_name,phone_number,avatar_url,role,assigned_outlet,is_approved,is_active',
      )
      .eq('role', 'attendant')
      .eq('assigned_outlet', outletCode)
      .eq('is_active', true)
      .eq('is_approved', true)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error || !data) return null;
    return data as UserRoleProfile;
  } catch {
    return null;
  }
}

function buildCheckoutFallbackAttendant(outletCode: string): UserRoleProfile {
  return {
    user_id: `local-fallback-${outletCode}`,
    full_name: 'Shop For Me Attendant',
    email: null,
    phone_number: null,
    avatar_url: null,
    role: 'attendant',
    assigned_outlet: outletCode,
    invited_by: 'local-free-access',
    is_active: true,
    is_approved: true,
  };
}
