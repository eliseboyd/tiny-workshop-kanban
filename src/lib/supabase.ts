import { createClient } from '@supabase/supabase-js';
import { getSupabaseAnonKey, getSupabaseUrl } from '@/utils/supabase/env';

const supabaseUrl = getSupabaseUrl();
const supabaseAnonKey = getSupabaseAnonKey();

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Supabase env is missing. Set NEXT_PUBLIC_SUPABASE_URL/SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY/SUPABASE_ANON_KEY.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

