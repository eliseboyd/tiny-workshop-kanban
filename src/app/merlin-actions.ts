'use server';

// Everything that crosses into Merlin's side of the shared Supabase project,
// in one file named for the boundary. See docs/merlin-todos.md and, for the
// contract, merlin/docs/project-todos.md.
//
// A to-do is a row in Merlin's `public.items` with `kanban_card_id` = this
// card. The board READS those rows and makes exactly two kinds of write:
// create, through Merlin's ingest endpoint (never a direct insert — Merlin's
// captures table is its audit trail and /api/ingest is its one front door),
// and complete/reopen, through the complete_item() function Merlin ships plus
// a mirror update for reopen. No deletes, no title edits, no touching
// captures. Merlin never moves, edits or deletes cards.

import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import { getSupabaseUrl } from '@/utils/supabase/env';
import type { CardTodos, FilingTodo, Todo } from '@/types/todos';

const DONE_WINDOW_DAYS = 7;

// Service-role client pinned to `public` — createServiceRoleClient() pins
// `kanban`, and a to-do lives on the other side.
function merlinClient() {
  const url = getSupabaseUrl();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase service-role env is missing.');
  return createClient(url, key, { db: { schema: 'public' } });
}

function ingestConfig(): { url: string; token: string } | null {
  const url = process.env.MERLIN_INGEST_URL;
  const token = process.env.MERLIN_INGEST_TOKEN;
  return url && token ? { url, token } : null;
}

export async function isMerlinConfigured(): Promise<boolean> {
  return ingestConfig() !== null;
}

type ItemRow = {
  id: string;
  title: string;
  status: string;
  due_at: string | null;
  estimated_minutes: number | null;
  contexts: string[] | null;
  score: number | string | null;
  completed_at: string | null;
  created_at: string;
};

function toTodo(row: ItemRow): Todo {
  return {
    id: row.id,
    title: row.title,
    status: row.status === 'done' ? 'done' : 'open',
    dueAt: row.due_at,
    estimatedMinutes: row.estimated_minutes,
    contexts: row.contexts ?? [],
    score: row.score === null ? null : Number(row.score),
    completedAt: row.completed_at,
    createdAt: row.created_at,
  };
}

const ITEM_COLS = 'id, title, status, due_at, estimated_minutes, contexts, score, completed_at, created_at';

export async function getCardTodos(cardId: string): Promise<CardTodos> {
  const configured = ingestConfig() !== null;
  const db = merlinClient();
  const since = new Date(Date.now() - DONE_WINDOW_DAYS * 24 * 3600 * 1000).toISOString();

  const [openRes, doneRes, filingRes] = await Promise.all([
    db
      .from('items')
      .select(ITEM_COLS)
      .eq('kanban_card_id', cardId)
      .eq('status', 'open')
      .order('score', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false }),
    db
      .from('items')
      .select(ITEM_COLS)
      .eq('kanban_card_id', cardId)
      .eq('status', 'done')
      .gte('completed_at', since)
      .order('completed_at', { ascending: false }),
    // Typed here, not filed yet. Merlin's worker runs every minute and is
    // usually kicked immediately by ingest, so this is seconds, not minutes.
    db
      .from('captures')
      .select('id, raw_text, transcript')
      .eq('channel', 'kanban')
      .in('status', ['pending', 'enriching'])
      .eq('metadata->>kanban_card_id', cardId)
      .order('created_at', { ascending: true }),
  ]);

  if (openRes.error) console.error('[merlin-actions] open todos:', openRes.error.message);
  if (doneRes.error) console.error('[merlin-actions] done todos:', doneRes.error.message);
  if (filingRes.error) console.error('[merlin-actions] filing todos:', filingRes.error.message);

  const filing: FilingTodo[] = ((filingRes.data ?? []) as Array<{ id: string; raw_text: string | null; transcript: string | null }>)
    .map((c) => ({ captureId: c.id, text: c.transcript ?? c.raw_text ?? '' }))
    .filter((c) => c.text);

  return {
    configured,
    open: ((openRes.data ?? []) as ItemRow[]).map(toTodo),
    done: ((doneRes.data ?? []) as ItemRow[]).map(toTodo),
    filing,
  };
}

export type AddTodoResult = { ok: true; captureId: string } | { ok: false; error: string };

// One to-do, typed into this project. Goes to Merlin's ingest as a capture on
// the 'kanban' channel carrying the card, so enrichment links the item and
// the project's title reaches the model as context. source_id makes a
// retried submit idempotent on Merlin's side (unique on channel + source_id).
export async function addCardTodo(cardId: string, cardTitle: string, text: string): Promise<AddTodoResult> {
  const clean = text.trim();
  if (!clean) return { ok: false, error: 'Nothing to add.' };
  const cfg = ingestConfig();
  if (!cfg) return { ok: false, error: 'Merlin is not connected (set MERLIN_INGEST_URL and MERLIN_INGEST_TOKEN).' };

  try {
    const res = await fetch(cfg.url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${cfg.token}`,
      },
      body: JSON.stringify({
        text: clean,
        channel: 'kanban',
        source_id: `${cardId}:${uuidv4()}`,
        metadata: { kanban_card_id: cardId, kanban_card_title: cardTitle },
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      console.error('[merlin-actions] ingest', res.status);
      return { ok: false, error: `Merlin refused the to-do (${res.status}).` };
    }
    const body = (await res.json()) as { capture_id?: string };
    return body.capture_id ? { ok: true, captureId: body.capture_id } : { ok: false, error: 'Merlin returned no capture id.' };
  } catch (e) {
    console.error('[merlin-actions] ingest', e);
    return { ok: false, error: 'Could not reach Merlin.' };
  }
}

// Tick one off. complete_item() is Merlin's own "done" in one place: status
// flip, the completed signal, and a rescore. False means it was not open
// (already done, or gone) — refetch and move on.
export async function completeCardTodo(itemId: string): Promise<boolean> {
  const db = merlinClient();
  const { data, error } = await db.rpc('complete_item', { p_item_id: itemId, p_source: 'kanban' });
  if (error) {
    console.error('[merlin-actions] complete_item:', error.message);
    return false;
  }
  return Boolean(data);
}

// Mirror of Merlin's own reopen (app/actions.ts reopenItem): status back to
// open, completed_at cleared, a 'reopened' signal so the learning corpus sees
// the flip-flop. Small enough not to warrant a function on Merlin's side.
export async function reopenCardTodo(itemId: string): Promise<boolean> {
  const db = merlinClient();
  const { data, error } = await db
    .from('items')
    .update({ status: 'open', completed_at: null })
    .eq('id', itemId)
    .eq('status', 'done')
    .select('id');
  if (error) {
    console.error('[merlin-actions] reopen:', error.message);
    return false;
  }
  if (!data || data.length === 0) return false;
  await db.from('signals').insert({ item_id: itemId, kind: 'reopened', payload: { source: 'kanban' } });
  return true;
}
