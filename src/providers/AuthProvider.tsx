import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';

import { AuthContext, type AuthContextValue } from '../contexts/AuthContext';
import { CURRENT_USER } from '../data/currentUser';
import supabase, { authMode } from '../lib/supabase';
import type { AppUser } from '../types/auth.type';

const mockUser: AppUser = {
  id: 'mock-user',
  email: 'bonnie@example.com',
  name: CURRENT_USER.name,
  avatarUrl: CURRENT_USER.avatar,
  isMock: true,
};

function mapSupabaseUserToAppUser(user: User): AppUser {
  const fullName = typeof user.user_metadata?.full_name === 'string'
    ? user.user_metadata.full_name
    : null;
  const avatarUrl = typeof user.user_metadata?.avatar_url === 'string'
    ? user.user_metadata.avatar_url
    : CURRENT_USER.avatar;

  return {
    id: user.id,
    email: user.email ?? null,
    name: fullName || user.email || 'Workspace member',
    avatarUrl,
    isMock: false,
  };
}

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<AppUser | null>(() => (authMode === 'mock' ? mockUser : null));
  const [isAuthLoading, setIsAuthLoading] = useState(authMode === 'supabase');

  useEffect(() => {
    if (authMode === 'mock') {
      return;
    }

    if (!supabase) {
      queueMicrotask(() => {
        setUser(null);
        setSession(null);
        setIsAuthLoading(false);
      });
      return;
    }

    let isMounted = true;

    void supabase.auth.getSession().then(({ data }) => {
      if (!isMounted) {
        return;
      }

      setSession(data.session);
      setUser(data.session?.user ? mapSupabaseUserToAppUser(data.session.user) : null);
      setIsAuthLoading(false);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setUser(nextSession?.user ? mapSupabaseUserToAppUser(nextSession.user) : null);
      setIsAuthLoading(false);
    });

    return () => {
      isMounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  const signInWithPassword = useCallback(async (email: string, password: string) => {
    if (!supabase) {
      throw new Error('Supabase auth is not configured.');
    }

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw error;
    }
  }, []);

  const signUpWithPassword = useCallback(async (email: string, password: string, fullName?: string) => {
    if (!supabase) {
      throw new Error('Supabase auth is not configured.');
    }

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName || email,
        },
      },
    });

    if (error) {
      throw error;
    }
  }, []);

  const signOut = useCallback(async () => {
    if (authMode === 'mock') {
      return;
    }

    if (!supabase) {
      throw new Error('Supabase auth is not configured.');
    }

    const { error } = await supabase.auth.signOut();

    if (error) {
      throw error;
    }
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    authMode,
    user,
    session,
    isAuthLoading,
    signInWithPassword,
    signUpWithPassword,
    signOut,
  }), [isAuthLoading, session, signInWithPassword, signOut, signUpWithPassword, user]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
