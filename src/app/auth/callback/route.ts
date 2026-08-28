import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

// Route Handlers build their own redirect URLs, and Next does not apply
// basePath to those the way it does to next/link or to redirect() in a Server
// Action. Without this the callback lands on the apex, which the hub site owns.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  // `next` is app-relative (no basePath), matching what Supabase is handed.
  const next = `${basePath}${searchParams.get('next') ?? '/'}`;

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const forwardedHost = request.headers.get('x-forwarded-host'); // original origin before load balancer
      const isLocalEnv = process.env.NODE_ENV === 'development';
      if (isLocalEnv) {
        // we can be sure that there is no load balancer in between, so no need to watch for X-Forwarded-Host
        return NextResponse.redirect(`${origin}${next}`);
      } else if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${next}`);
      } else {
        return NextResponse.redirect(`${origin}${next}`);
      }
    }
  }

  // return the user to an error page with instructions
  return NextResponse.redirect(`${origin}${basePath}/auth/auth-code-error`);
}

