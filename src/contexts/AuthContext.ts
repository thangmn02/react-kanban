import { createContext } from 'react';
import type { Session } from '@supabase/supabase-js';

import type { AppUser, AuthActionResult, AuthMode } from '../types/auth.type';
import type { ProfileChanges } from '../services/profile.service';

export interface AuthContextValue {
  authMode: AuthMode;
  user: AppUser | null;
  session: Session | null;
  isAuthLoading: boolean;
  signInWithPassword: (email: string, password: string) => Promise<AuthActionResult>;
  signUpWithPassword: (email: string, password: string, fullName?: string) => Promise<AuthActionResult>;
  signOut: () => Promise<void>;
  updateProfile?: (changes:ProfileChanges) => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
