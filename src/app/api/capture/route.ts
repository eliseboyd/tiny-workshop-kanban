import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { quickCapture } from '@/app/actions';

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

export async function POST(req: NextRequest) {
  // QUICK_ADD_TOKEN is the name this is deployed under; QUICK_CAPTURE_TOKEN
  // is what the code has always read. Accept both so the endpoint works in
  // either environment rather than 503-ing on a name mismatch.
  // `||` not `??`: an env var set to an empty string means unset here, and
  // `??` would treat '' as a real value and fall through to the 503 below.
  const token = process.env.QUICK_CAPTURE_TOKEN || process.env.QUICK_ADD_TOKEN;
  if (!token) {
    return NextResponse.json({ error: 'Quick capture is not configured' }, { status: 503 });
  }

  const auth = req.headers.get('authorization');
  const bearer = auth?.startsWith('Bearer ') ? auth.slice(7).trim() : null;
  if (!bearer || !safeCompare(bearer, token)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { text?: unknown; url?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const text = typeof body.text === 'string' ? body.text : '';
  const url = typeof body.url === 'string' ? body.url : undefined;

  if (!text.trim() && !url?.trim()) {
    return NextResponse.json({ error: 'text or url is required' }, { status: 400 });
  }

  try {
    const result = await quickCapture(text, url);
    return NextResponse.json({
      id: result.id,
      ...(result.notice ? { notice: result.notice } : {}),
    });
  } catch (e) {
    console.error('[api/capture]', e);
    return NextResponse.json({ error: 'Capture failed' }, { status: 500 });
  }
}
