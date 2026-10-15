import { createClient } from '@supabase/supabase-js';

export function createPasswordRecoveryClient() {
  // Recovery authorizes a password change, not a persistent website login.
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_KEY!,
    {
      auth: {
        storageKey: 'animalclick-password-recovery',
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: true,
      },
    }
  );
}
