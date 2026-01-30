import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/utils/supabase/admin';
import { createHash } from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const headerToken = request.headers.get('x-quick-add-token');
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    const providedToken = bearerToken || headerToken;

    if (!providedToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tokenHash = createHash('sha256').update(providedToken).digest('hex');
    const supabase = createServiceRoleClient();
    const { data: tokenRow, error: tokenError } = await supabase
      .from('quick_add_tokens')
      .select('user_id')
      .eq('token_hash', tokenHash)
      .single();

    if (tokenError || !tokenRow) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { url, title, note } = await request.json();

    if (!url && !title) {
      return NextResponse.json({ error: 'URL or title required' }, { status: 400 });
    }

    const { createIdea, processLinkWithAI } = await import('@/app/actions');

    let metadata: any = {};
    if (url) {
      metadata = await processLinkWithAI(url);
    }

    const idea = await createIdea({
      title: title || metadata.title || 'Untitled Idea',
      description: note || metadata.description,
      url,
      tags: metadata.suggestedTags || [],
    });

    if (!idea) {
      return NextResponse.json({ error: 'Failed to create idea' }, { status: 500 });
    }

    return NextResponse.json({ success: true, idea });
  } catch (error) {
    console.error('Quick add error:', error);
    return NextResponse.json({ error: 'Failed to create idea' }, { status: 500 });
  }
}
