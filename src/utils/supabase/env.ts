// Kanban's tables live in the `kanban` schema of the merlin project, not in
// `public` (which holds merlin's own tables, including a different `projects`).
// Every client below sets this so callers keep using plain .from('projects').
export const KANBAN_SCHEMA = 'kanban';

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

// The session is shared with the other tinywork.shop apps, which needs an
// explicit parent domain (`.tinywork.shop`) — without one the cookie is
// host-only and each app has its own login.
//
// Left unset in local dev on purpose: a browser drops a cookie whose Domain
// doesn't match the current host, so a hardcoded value would break login on
// localhost. `secure` rides the same switch, since the only time the domain is
// set is in production over HTTPS.
//
// Must stay in sync with the other apps sharing the session — a cookie written
// under one domain is invisible to an app reading under another.
export function getCookieOptions() {
  const domain = process.env.NEXT_PUBLIC_COOKIE_DOMAIN;
  if (!domain) return undefined;
  return { domain, secure: true };
}
