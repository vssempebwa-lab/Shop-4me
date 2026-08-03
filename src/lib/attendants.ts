import { supabase } from './supabase';
import type { UserRoleProfile } from '../types';
import { readLocalAdminUsers } from './localAdminUsers';

export async function fetchPublicAttendantForOutlet(outletCode: string) {
  const localAttendant = readLocalAttendantForOutlet(outletCode);

  const { data, error } = await supabase.rpc('get_public_attendant_for_outlet', {
    p_outlet_code: outletCode,
  });

  if (error) {
    console.error('Unable to load public attendant profile.', error);
    return {
      attendant: localAttendant,
      error: localAttendant ? null : error.message,
    };
  }

  const profile = Array.isArray(data) ? data[0] : data;

  return {
    attendant: (profile as UserRoleProfile | null) ?? localAttendant,
    error: null,
  };
}

function readLocalAttendantForOutlet(outletCode: string) {
  return (
    readLocalAdminUsers().find(
      (localUser) =>
        localUser.role === 'attendant' &&
        localUser.assigned_outlet === outletCode &&
        localUser.is_active !== false,
    ) ?? null
  );
}
