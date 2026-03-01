export function getSupabaseUrl() {
  const direct =
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  if (direct) return direct;

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) return undefined;

  try {
    const parsed = new URL(databaseUrl);
    const username = parsed.username || '';
    const prefix = 'postgres.';
    if (username.startsWith(prefix)) {
      const projectRef = username.slice(prefix.length);
      if (projectRef) {
        return `https://${projectRef}.supabase.co`;
      }
    }
  } catch (error) {
    // Ignore parse errors; caller will handle missing URL.
  }

  return undefined;
}

export function getSupabaseAnonKey() {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY
  );
}
