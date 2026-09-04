'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Plus, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { addCardTodo, completeCardTodo, getCardTodos, reopenCardTodo } from '@/app/merlin-actions';
import type { CardTodos, Todo } from '@/types/todos';

// To-dos on a board project: Merlin tasks linked to this card. They show up in
// Merlin's daily list and digest, so this is where "check what acrylic colours
// I have" lives while the mirror itself is still in To Do. Ticking one off
// here, in Telegram, or on the Merlin web app is the same row.
//
// Not the checklist in the notes (that is part of the write-up, Merlin never
// sees it) and not a task card (that is a card on the board in its own right).

const FILING_POLL_MS = 3000;

function metaLine(t: Todo): string {
  const parts: string[] = [];
  if (t.contexts.length) parts.push(t.contexts.join(' '));
  if (t.estimatedMinutes) parts.push(`~${t.estimatedMinutes}m`);
  if (t.dueAt) {
    parts.push(
      `due ${new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Berlin', day: 'numeric', month: 'short' }).format(new Date(t.dueAt))}`
    );
  }
  return parts.join(' · ');
}

export function ProjectTodos({ cardId, cardTitle }: { cardId: string; cardTitle: string }) {
  const [data, setData] = useState<CardTodos | null>(null);
  const [input, setInput] = useState('');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [showDone, setShowDone] = useState(false);
  const mounted = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const next = await getCardTodos(cardId);
      if (mounted.current) setData(next);
    } catch (e) {
      console.error('[ProjectTodos] refresh', e);
      if (mounted.current) setError('Could not load to-dos from Merlin.');
    }
  }, [cardId]);

  useEffect(() => {
    mounted.current = true;
    refresh();
    return () => {
      mounted.current = false;
    };
  }, [refresh]);

  // While Merlin is still filing something typed here, poll until it lands.
  useEffect(() => {
    if (!data || data.filing.length === 0) return;
    const t = setTimeout(refresh, FILING_POLL_MS);
    return () => clearTimeout(t);
  }, [data, refresh]);

  const withBusy = async (id: string, fn: () => Promise<unknown>) => {
    setBusy((s) => new Set(s).add(id));
    try {
      await fn();
    } finally {
      setBusy((s) => {
        const n = new Set(s);
        n.delete(id);
        return n;
      });
    }
    await refresh();
  };

  const handleAdd = async () => {
    const text = input.trim();
    if (!text || adding) return;
    setAdding(true);
    setError(null);
    const result = await addCardTodo(cardId, cardTitle, text);
    setAdding(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setInput('');
    await refresh();
  };

  if (!data && !error) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading to-dos…
      </div>
    );
  }

  const open = data?.open ?? [];
  const done = data?.done ?? [];
  const filing = data?.filing ?? [];

  return (
    <div className="space-y-2">
      {open.length === 0 && filing.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Nothing to do yet. Add a step below and Merlin will remind you about it day to day.
        </p>
      )}

      {open.map((t) => {
        const meta = metaLine(t);
        const isBusy = busy.has(t.id);
        return (
          <div
            key={t.id}
            className={cn(
              'flex items-center gap-3 p-3 rounded-lg border bg-muted/20 hover:bg-muted/30 transition-colors',
              isBusy && 'opacity-60'
            )}
          >
            <Checkbox
              checked={false}
              disabled={isBusy}
              onCheckedChange={() => withBusy(t.id, () => completeCardTodo(t.id))}
              aria-label={`Mark "${t.title}" done`}
              className="data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600"
            />
            <div className="flex-1 min-w-0">
              <div className="truncate">{t.title}</div>
              {meta && <div className="text-xs text-muted-foreground">{meta}</div>}
            </div>
          </div>
        );
      })}

      {filing.map((f) => (
        <div
          key={f.captureId}
          className="flex items-center gap-3 p-3 rounded-lg border border-dashed bg-muted/10 text-muted-foreground"
        >
          <Loader2 className="h-4 w-4 animate-spin shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="truncate">{f.text}</div>
            <div className="text-xs">Merlin is filing it…</div>
          </div>
        </div>
      ))}

      {/* Reading works off the shared database alone; only ADDING needs
          Merlin's ingest endpoint. Unconfigured: say so, don't hide it. */}
      {data && !data.configured ? (
        <p className="text-sm text-muted-foreground">
          Merlin isn&apos;t connected. Set <code>MERLIN_INGEST_URL</code> and <code>MERLIN_INGEST_TOKEN</code> to add to-dos from here.
        </p>
      ) : (
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleAdd();
            }
          }}
          disabled={adding}
          className="flex-1 px-3 py-2 rounded-md border bg-background text-sm"
          placeholder="Add a to-do… (Merlin will remind you)"
        />
        <Button onClick={handleAdd} size="sm" disabled={adding || !input.trim()}>
          {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        </Button>
      </div>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}

      {done.length > 0 && (
        <div className="pt-2">
          <button
            type="button"
            onClick={() => setShowDone((v) => !v)}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            {showDone ? 'Hide' : 'Show'} done recently ({done.length})
          </button>
          {showDone && (
            <div className="mt-2 space-y-1">
              {done.map((t) => (
                <div key={t.id} className="flex items-center gap-3 px-3 py-1 text-sm text-muted-foreground">
                  <span className="flex-1 min-w-0 truncate line-through">{t.title}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs"
                    disabled={busy.has(t.id)}
                    onClick={() => withBusy(t.id, () => reopenCardTodo(t.id))}
                    title="Reopen"
                  >
                    <RotateCcw className="h-3 w-3 mr-1" /> reopen
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
