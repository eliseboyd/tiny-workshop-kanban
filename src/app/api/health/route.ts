import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/utils/supabase/admin';

// Uptime-monitor target (MER-20). Public and unauthenticated — a monitor can't
// hold a secret — so it returns only ok/fail: no row contents, no counts, no
// Postgres error text (that goes to the logs).
//
// It must actually read from the database. The board page renders through a
// database outage (Oct 2026: PostgREST's pool wedged for a day and the board
// was simply blank), so polling `/` would have stayed green the whole time.
export const dynamic = 'force-dynamic';

const TIMEOUT_MS = 5000;

export async function GET() {
  try {
    const { error } = await createServiceRoleClient()
      .from('columns')
      .select('id')
      .limit(1)
      .abortSignal(AbortSignal.timeout(TIMEOUT_MS));
    if (error) throw error;
    return NextResponse.json({ ok: true, db: 'ok' }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error('[health] database check failed:', err);
    return NextResponse.json(
      { ok: false, db: 'fail' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
