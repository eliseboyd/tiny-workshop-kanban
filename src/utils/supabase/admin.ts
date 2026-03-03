import { createClient } from '@supabase/supabase-js';
import { getSupabaseUrl } from './env';

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
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is missing. Set it in your environment variables.'
    );
  }

  return createClient(supabaseUrl, supabaseServiceKey);
}

