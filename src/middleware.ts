/*
 * Lives in src/, and must. This project has a src directory, and with
 * Turbopack `next dev` silently ignores a root middleware.ts — no warning, no
 * log line, the session gate just never runs and the board serves to anyone
 * locally. `next build` does pick the root file up, so production was never
 * affected and nothing looked wrong. Moving it here makes dev match prod.
 *
 * Next 16 deprecates this file convention in favour of proxy.ts. That rename
 * is deliberately not done yet: proxy always runs on the Node runtime, which
 * empties middleware-manifest.json and writes /_middleware to
 * functions-config-manifest.json instead. @netlify/plugin-nextjs builds its
 * Edge Function from the former, so the rename risks a green deploy with no
 * gate running at all. Do it on a day a deploy can be tested signed-out.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/utils/supabase/middleware';

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  // Bearer-authenticated API routes must not go through the Supabase session gate,
  // or external clients (Claude remote MCP, Shortcuts → /api/capture) get a login redirect.
  if (
    pathname.startsWith('/shortcuts/') ||
    pathname.startsWith('/api/shortcuts') ||
    pathname.startsWith('/api/capture') ||
    pathname.startsWith('/api/mcp') ||
    pathname.endsWith('.shortcut')
  ) {
    return NextResponse.next();
  }
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - uploads/ (user uploaded content - public)
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico|uploads/|shortcuts/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|shortcut)$).*)',
  ],
};

