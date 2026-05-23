import { createClient } from '@supabase/supabase-js';

import type { Database } from '../types/supabase.type';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Check if credentials are valid and present
export const isLocalDemoMode = !supabaseUrl || !supabaseAnonKey || supabaseUrl.includes('placeholder') || supabaseAnonKey.includes('placeholder');

let supabase: any = null;

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

export default supabase;
