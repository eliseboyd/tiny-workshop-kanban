import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getCookieOptions } from '@/utils/supabase/env';

// POST target for the master nav's sign-out form (/kanban/auth/signout with
// the basePath). A route handler rather than the existing logout() server
// action because the nav is shipped as a stateless server component: a string
// action survives serialization, a callback cannot.
//
// src/middleware.ts exempts this path from the session gate — updateSession
// bounces signed-in /auth* requests to '/', which would eat the POST.
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
  } catch {
    // Revocation is best-effort; the explicit cookie expiry below is what
    // actually signs the browser out.
  }
  // Redirects are not basePath-prefixed automatically; spell it out.
  // 303 so the browser follows with GET, not another POST.
  const res = NextResponse.redirect(new URL('/kanban/login', request.url), 303);
  // Belt and braces: expire every Supabase auth cookie on the response, with
  // the same domain they were set with, so sign-out cannot silently fail.
  const domain = getCookieOptions();
  for (const { name } of (await cookies()).getAll()) {
    if (!name.startsWith('sb-')) continue;
    res.cookies.set(name, '', { path: '/', maxAge: 0, ...(domain ?? {}) });
  }
  return res;
}
