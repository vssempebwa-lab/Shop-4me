import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { User } from '@supabase/supabase-js';

export type AppRole = 'admin' | 'attendant' | 'customer' | null;

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<AppRole>(null);
  const [loading, setLoading] = useState(true);

  const fetchRole = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        console.error('Failed to load user role', error);
        return 'customer' as AppRole;
      }

      if (data?.role) {
        return data.role as AppRole;
      }

      const { error: insertError } = await supabase.from('user_roles').insert({
        user_id: userId,
        role: 'customer',
      });

      if (insertError) {
        console.error('Failed to create default user role', insertError);
      }

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
  };

  return { user, role, loading, signInWithGoogle, signInWithEmail, signUpWithEmail, signOut };
}
