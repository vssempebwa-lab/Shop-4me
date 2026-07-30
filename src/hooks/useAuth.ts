import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { User } from '@supabase/supabase-js';
import type { UserRoleProfile } from '../types';

export type AppRole = 'admin' | 'attendant' | 'merchant' | 'customer' | null;
export type MerchantSignInResult =
  | { ok: true }
  | { ok: false; reason: 'invalid_credentials' | 'not_authorized' | 'not_approved' };

const MERCHANT_ROLES: AppRole[] = ['admin', 'attendant', 'merchant'];

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<AppRole>(null);
  const [profile, setProfile] = useState<UserRoleProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchRole = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('id,user_id,email,full_name,avatar_url,role,assigned_outlet,is_approved,is_active,invited_by,last_login_at,created_at,deactivated_at')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        console.error('Failed to load user role', error);
        return 'customer' as AppRole;
      }

      if (data?.role) {
        setProfile(data as UserRoleProfile);
        void supabase.rpc('touch_last_login');
        return data.role as AppRole;
      }

      const { error: insertError } = await supabase.from('user_roles').insert({
        user_id: userId,
        role: 'customer',
      });

      if (insertError) {
        console.error('Failed to create default user role', insertError);
      }

      setProfile({
        user_id: userId,
        role: 'customer',
        is_active: true,
        is_approved: false,
      });
      return 'customer' as AppRole;
    } catch (err) {
      console.error('Role lookup failed', err);
      return 'customer' as AppRole;
    }
  };

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
      if (session?.user?.id) {
        setRole(await fetchRole(session.user.id));
      } else {
        setRole(null);
        setProfile(null);
      }
      setLoading(false);
    };

    init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user?.id) {
        setRole(await fetchRole(session.user.id));
      } else {
        setRole(null);
        setProfile(null);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
      },
    });
  };

  const signInWithEmail = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    return error;
  };

  const signInAsMerchant = async (
    emailOrPhone: string,
    password: string,
  ): Promise<MerchantSignInResult> => {
    const normalizedLogin = emailOrPhone.trim();
    const credentials = normalizedLogin.includes('@')
      ? { email: normalizedLogin, password }
      : { phone: normalizedLogin, password };

    const { data, error } = await supabase.auth.signInWithPassword(credentials);

    if (error || !data.user) {
      return { ok: false, reason: 'invalid_credentials' };
    }

    const { data: roleData, error: roleError } = await supabase
      .from('user_roles')
      .select('id,user_id,email,full_name,avatar_url,role,assigned_outlet,is_approved,is_active,invited_by,last_login_at,created_at,deactivated_at')
      .eq('user_id', data.user.id)
      .maybeSingle();

    if (
      roleError ||
      !roleData ||
      roleData.is_active === false ||
      !MERCHANT_ROLES.includes(roleData.role as AppRole)
    ) {
      await supabase.auth.signOut();
      setUser(null);
      setRole(null);
      setProfile(null);
      return { ok: false, reason: 'not_authorized' };
    }

    if (!roleData.is_approved) {
      await supabase.auth.signOut();
      setUser(null);
      setRole(null);
      setProfile(null);
      return { ok: false, reason: 'not_approved' };
    }

    setUser(data.user);
    setRole(roleData.role as AppRole);
    setProfile(roleData as UserRoleProfile);
    return { ok: true };
  };

  const signUpWithEmail = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
    });

    return error;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setRole(null);
    setProfile(null);
  };

  return {
    user,
    role,
    profile,
    loading,
    signInWithGoogle,
    signInWithEmail,
    signInWithMerchant: signInAsMerchant,
    signUpWithEmail,
    signOut,
  };
}
