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

