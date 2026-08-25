import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import {
  KANBAN_SCHEMA,
  getAllowedUserIds,
  getCookieOptions,
  getSupabaseAnonKey,
  getSupabaseUrl,
} from './env';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabaseUrl = getSupabaseUrl();
  const supabaseAnonKey = getSupabaseAnonKey();
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Supabase env is missing. Set NEXT_PUBLIC_SUPABASE_URL/SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY/SUPABASE_ANON_KEY.'
    );
  }

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      db: { schema: KANBAN_SCHEMA },
      cookieOptions: getCookieOptions(),
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Auth check on every request. getClaims() verifies the JWT locally (via
  // cached JWKS) when the project uses asymmetric signing keys — no network
  // round trip — and only falls back to the Auth server for legacy HS256
  // tokens or when the token needs a refresh. This was previously getUser(),
  // which added a Supabase Auth round trip (~100-300ms) to every navigation.
  // Wrapped in try/catch so a Supabase outage doesn't corrupt the response.
  let user: { sub?: string } | null = null;
  try {
    const { data } = await supabase.auth.getClaims();
    user = data?.claims ?? null;
  } catch {
    // Treat as unauthenticated; login page will show a connection error
  }

  // Authentication is not authorization. Signups are open on this Supabase
  // project and every query below runs as service_role, so a session alone
  // would hand a stranger the entire board. Only allowlisted ids get through.
  //
  // Fails closed when ALLOWED_USER_IDS is unset, matching how the bearer-token
  // routes behave, because failing open here is the exact hole being closed.
  // The cost is that the variable must exist wherever this runs — it is not a
  // NEXT_PUBLIC value, so a local .env.local does not cover a deployed build.
  const allowedUserIds = getAllowedUserIds();
  if (!allowedUserIds) {
    return new NextResponse(
      'ALLOWED_USER_IDS is not set, so no session can be authorized.',
      { status: 503 }
    );
  }

  // Signed in but not on the list: treat as signed out rather than 403, so the
  // login page still renders and there is no redirect loop.
  if (user && !allowedUserIds.has(user.sub ?? '')) {
    user = null;
    if (
      !request.nextUrl.pathname.startsWith('/login') &&
      !request.nextUrl.pathname.startsWith('/auth')
    ) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      url.searchParams.set('message', 'That account is not authorized for this board.');
      return NextResponse.redirect(url);
    }
  }

  if (request.nextUrl.pathname.startsWith('/login') || request.nextUrl.pathname.startsWith('/auth')) {
      if (user) {
          return NextResponse.redirect(new URL('/', request.url));
      }
      return supabaseResponse;
  }

  if (
    !user &&
    !request.nextUrl.pathname.startsWith('/login') &&
    !request.nextUrl.pathname.startsWith('/auth')
  ) {
    // no user, potentially respond by redirecting the user to the login page
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

