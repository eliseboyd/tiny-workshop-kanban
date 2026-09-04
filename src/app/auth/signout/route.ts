import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

// POST target for the master nav's sign-out form (/kanban/auth/signout with
// the basePath). A route handler rather than the existing logout() server
// action because the nav is shipped as a stateless server component: a string
// action survives serialization, a callback cannot.
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
  } catch {
    // Cookie already gone or Supabase unreachable — landing on the login
    // page is still the right outcome.
  }
  // Redirects are not basePath-prefixed automatically; spell it out.
  // 303 so the browser follows with GET, not another POST.
  return NextResponse.redirect(new URL('/kanban/login', request.url), 303);
}
