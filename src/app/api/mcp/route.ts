import { timingSafeEqual } from 'crypto';

import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';

import { createKanbanMcpServer } from '@/lib/kanban-mcp/server-factory';
import { createServiceRoleClient } from '@/utils/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function safeCompare(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a, 'utf8');
    const bb = Buffer.from(b, 'utf8');
    if (ba.length !== bb.length) return false;
    return timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

function getRemoteMcpToken(): string | undefined {
  const t = process.env.REMOTE_MCP_TOKEN ?? process.env.QUICK_CAPTURE_TOKEN;
  return t?.trim() || undefined;
}

function corsHeaders(): HeadersInit {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers':
      'Content-Type, Authorization, mcp-session-id, Last-Event-ID, mcp-protocol-version',
    'Access-Control-Expose-Headers': 'mcp-session-id, mcp-protocol-version',
  };
}

function withCors(res: Response): Response {
  const headers = new Headers(res.headers);
  for (const [k, v] of Object.entries(corsHeaders())) {
    headers.set(k, v);
  }
  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers,
  });
}

async function handleMcp(req: Request): Promise<Response> {
  const token = getRemoteMcpToken();
  if (!token) {
    return withCors(
      new Response(
        'Remote MCP is not configured. Set REMOTE_MCP_TOKEN (recommended) or QUICK_CAPTURE_TOKEN.',
        { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } }
      )
    );
  }

  const auth = req.headers.get('authorization');
  const bearer = auth?.startsWith('Bearer ') ? auth.slice(7).trim() : null;
  if (!bearer || !safeCompare(bearer, token)) {
    return withCors(
      new Response('Unauthorized', {
        status: 401,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      })
    );
  }

  const supabase = createServiceRoleClient();
  // JSON responses instead of SSE for the POST body — helps some clients (e.g. Claude Desktop
  // custom connectors) that mishandle Streamable HTTP + event-stream on remote URLs.
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  const server = createKanbanMcpServer(supabase);
  await server.connect(transport);
  const res = await transport.handleRequest(req);
  return withCors(res);
}

export async function GET(req: Request) {
  return handleMcp(req);
}

export async function POST(req: Request) {
  return handleMcp(req);
}

export async function DELETE(req: Request) {
  return handleMcp(req);
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}
