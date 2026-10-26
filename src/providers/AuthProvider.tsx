import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';

import { AuthContext, type AuthContextValue } from '../contexts/AuthContext';
import { clearProfileImageCache, DEFAULT_IDENTITY_IMAGE, loadUserProfile, readLocalIdentity, saveUserProfile, type ProfileChanges } from '../services/profile.service';
import { CURRENT_USER } from '../data/currentUser';
import supabase, { authMode } from '../lib/supabase';
import { clearUserData } from '../shared/storage/storageAdapter';
import type { AppUser } from '../types/auth.type';

const mockUser: AppUser = {
  id: 'mock-user',
  email: 'bonnie@example.com',
  name: CURRENT_USER.name,
  avatarUrl: DEFAULT_IDENTITY_IMAGE,
  legacyName: CURRENT_USER.name,
  isMock: true,
};

function mapSupabaseUserToAppUser(user: User): AppUser {
  const fullName = typeof user.user_metadata?.full_name === 'string'
    ? user.user_metadata.full_name
    : null;
  const avatarUrl = typeof user.user_metadata?.avatar_url === 'string'
    ? user.user_metadata.avatar_url
    : DEFAULT_IDENTITY_IMAGE;

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
  const [user, setUser] = useState<AppUser | null>(() => (authMode === 'mock' ? readLocalIdentity(mockUser) : null));
  const identityRef = useRef(user);
  const profileEdit = useRef(0);
  const hydration = useRef(0);
  const savingProfile = useRef(false);
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
    let authEventSeen = false;

    const handleNextUser = async (identity: AppUser | null) => {
      const request = ++hydration.current;
      const revision = profileEdit.current;
      if (identityRef.current?.id !== identity?.id) { clearProfileImageCache(); profileEdit.current += 1; identityRef.current = identity; setUser(null); }
      let nextUser = identity;
      try { if (identity) nextUser = await loadUserProfile(identity); } catch {
        // Token refresh must not replace an already loaded profile with stale
        // provider metadata when the profile read is temporarily unavailable.
        if(identity&&identityRef.current?.id===identity.id)nextUser={...identityRef.current,email:identity.email};
      }
      if (!isMounted || request !== hydration.current || (revision !== profileEdit.current && identityRef.current?.id !== identity?.id)) return;
      identityRef.current = nextUser;
      setUser((currentUser) => {
        if (!currentUser && !nextUser) return null;
        if (
          currentUser &&
          nextUser &&
          currentUser.id === nextUser.id &&
          currentUser.email === nextUser.email &&
          currentUser.name === nextUser.name &&
          currentUser.avatarUrl === nextUser.avatarUrl &&
          currentUser.profileUpdatedAt === nextUser.profileUpdatedAt
        ) {
          return currentUser;
        }
        return nextUser;
      });
    };

    void supabase.auth.getSession().then(({ data }) => {
      if (!isMounted || authEventSeen) {
        return;
      }

      setSession(data.session);
      void handleNextUser(data.session?.user ? mapSupabaseUserToAppUser(data.session.user) : null).finally(() => { if (isMounted) setIsAuthLoading(false); });
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      authEventSeen = true;
      setSession(nextSession);
      void handleNextUser(nextSession?.user ? mapSupabaseUserToAppUser(nextSession.user) : null).finally(() => { if (isMounted) setIsAuthLoading(false); });
    });

    return () => {
      isMounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);
  useEffect(()=>{
    const refresh=()=>{
      const current=identityRef.current;if(!current)return;
      const request=++hydration.current;
      void loadUserProfile(current).then(next=>{if(identityRef.current?.id===current.id&&request===hydration.current){identityRef.current=next;setUser(next);}}).catch(()=>{});
    };
    window.addEventListener('focus',refresh);window.addEventListener('storage',refresh);
    return()=>{window.removeEventListener('focus',refresh);window.removeEventListener('storage',refresh);};
  },[]);

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

    return {
      requiresEmailConfirmation: false,
    };
  }, []);

  const signUpWithPassword = useCallback(async (email: string, password: string, fullName?: string) => {
    if (!supabase) {
      throw new Error('Supabase auth is not configured.');
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        // Email links must also work when signup starts inside the desktop app.
        emailRedirectTo: 'https://koraspace.online/home',
        data: {
          full_name: fullName || email,
        },
      },
    });

    if (error) {
      throw error;
    }

    return {
      requiresEmailConfirmation: !data.session,
    };
  }, []);

  const signOut = useCallback(async () => {
    if (authMode === 'mock') {
      return;
    }

    if (!supabase) {
      throw new Error('Supabase auth is not configured.');
    }

    const currentUserId = user?.id;

    const { error } = await supabase.auth.signOut();

    if (error) {
      throw error;
    }

    // Clear user caches to prevent cross-account leakage. Only opaque
    // object-retirement retry metadata survives; reads/deletes still need RLS.
    if (currentUserId) {
      clearUserData(currentUserId);
    }
  }, [user?.id]);

  const updateProfile = useCallback(async (changes: ProfileChanges) => {
    if (savingProfile.current) throw new Error('A profile save is already in progress. Wait for it to finish.');
    const current = identityRef.current;
    if (!current) throw new Error('Sign in before editing your profile.');
    savingProfile.current = true;
    const revision = ++profileEdit.current;
    hydration.current += 1;
    try {
      const next = await saveUserProfile(current, changes, () => identityRef.current?.id === current.id && profileEdit.current === revision);
      if (identityRef.current?.id !== current.id || profileEdit.current !== revision) throw new Error('The account changed while saving.');
      hydration.current += 1;
      identityRef.current = next;
      setUser(next);
    } finally { savingProfile.current = false; }
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    authMode,
    user,
    session,
    isAuthLoading,
    signInWithPassword,
    signUpWithPassword,
    signOut,
    updateProfile,
  }), [isAuthLoading, session, signInWithPassword, signOut, signUpWithPassword, updateProfile, user]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
