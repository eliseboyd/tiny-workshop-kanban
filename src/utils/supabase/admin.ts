import { createClient } from '@supabase/supabase-js';
import { getSupabaseAnonKey, getSupabaseUrl } from './env';

export function createServiceRoleClient() {
  const supabaseUrl = getSupabaseUrl();
  if (!supabaseUrl) {
    throw new Error(
      'SUPABASE_URL is missing. Set NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL.'
    );
  }
  // NOTE: This requires a SERVICE_ROLE_KEY in your .env file, not the ANON key.
  // If you don't have one set up locally, this will fail securely.
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseServiceKey) {
    console.warn('SUPABASE_SERVICE_ROLE_KEY is missing. Admin operations will fail.');
    // Fallback to anon key, though it won't bypass RLS
    const supabaseAnonKey = getSupabaseAnonKey();
    if (!supabaseAnonKey) {
      throw new Error(
        'SUPABASE_ANON_KEY is missing. Set NEXT_PUBLIC_SUPABASE_ANON_KEY or SUPABASE_ANON_KEY.'
      );
    }
    return createClient(supabaseUrl, supabaseAnonKey);
  }

  return createClient(supabaseUrl, supabaseServiceKey);
}

