import { createBrowserClient } from '@supabase/ssr';
import { getSupabaseAnonKey, getSupabaseUrl } from './env';

export function createClient() {
  const supabaseUrl = getSupabaseUrl();
  const supabaseAnonKey = getSupabaseAnonKey();
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Supabase env is missing. Set NEXT_PUBLIC_SUPABASE_URL/SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY/SUPABASE_ANON_KEY.'
    );
  }
  return createBrowserClient(
    supabaseUrl,
    supabaseAnonKey
  );
}

