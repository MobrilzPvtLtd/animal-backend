import { createClient } from '@supabase/supabase-js';

// Simulated Supabase client for development
const supabaseUrl:any = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey:any = process.env.NEXT_PUBLIC_SUPABASE_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    // Recovery links belong to the reset page's temporary auth client.
    detectSessionInUrl: typeof window === 'undefined' || window.location.pathname !== '/reset-password',
  },
});
