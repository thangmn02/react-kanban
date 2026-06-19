import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '../types/supabase.type';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const authMode = (import.meta.env.VITE_AUTH_MODE === 'supabase' ? 'supabase' : 'mock') as 'mock' | 'supabase';

const hasValidSupabaseCredentials = Boolean(
  supabaseUrl
  && supabaseAnonKey
  && !supabaseUrl.includes('placeholder')
  && !supabaseAnonKey.includes('placeholder')
);

export const isLocalDemoMode = authMode === 'mock';

let supabase: SupabaseClient<Database> | null = null;

if (authMode === 'supabase' && !hasValidSupabaseCredentials) {
  throw new Error(
    'VITE_AUTH_MODE=supabase requires valid VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY values.'
  );
}

if (authMode === 'supabase') {
  try {
    supabase = createClient<Database>(supabaseUrl!, supabaseAnonKey!, {
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    });
  } catch (error) {
    console.error('Failed to initialize Supabase client:', error);
  }
} else {
  console.warn('App is running in Local Demo Mode with full drag & drop support.');
}

export function requireSupabaseClient(): SupabaseClient<Database> {
  if (!supabase) {
    throw new Error('Supabase client is not configured.');
  }

  return supabase;
}

export default supabase;
