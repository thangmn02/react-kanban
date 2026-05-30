import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '../types/supabase.type';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const authMode = (import.meta.env.VITE_AUTH_MODE === 'supabase' ? 'supabase' : 'mock') as 'mock' | 'supabase';

// Check if credentials are valid and present
export const isLocalDemoMode = authMode === 'mock'
  || !supabaseUrl
  || !supabaseAnonKey
  || supabaseUrl.includes('placeholder')
  || supabaseAnonKey.includes('placeholder');

let supabase: SupabaseClient<Database> | null = null;

if (!isLocalDemoMode) {
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
  console.warn('Supabase credentials missing or invalid. App is running in Local Demo Mode with full drag & drop support.');
}

export function requireSupabaseClient(): SupabaseClient<Database> {
  if (!supabase) {
    throw new Error('Supabase client is not configured.');
  }

  return supabase;
}

export default supabase;
