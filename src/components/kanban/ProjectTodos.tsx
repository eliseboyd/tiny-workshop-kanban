'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Plus, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import styles from './ProjectTodos.module.css';
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
      <div className={styles.Loading}>
        <Loader2 className={styles.Spinner} /> Loading to-dos…
      </div>
    );
  }

  const open = data?.open ?? [];
  const done = data?.done ?? [];
  const filing = data?.filing ?? [];

  return (
    <div className={styles.Root}>
      {open.length === 0 && filing.length === 0 && (
        <p className={styles.Note}>
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
              styles.Row,
              isBusy && styles.RowBusy
            )}
          >
            <Checkbox
              checked={false}
              disabled={isBusy}
              onCheckedChange={() => withBusy(t.id, () => completeCardTodo(t.id))}
              aria-label={`Mark "${t.title}" done`}
              className={styles.Check}
            />
            <div className={styles.Text}>
              <div className={styles.Title}>{t.title}</div>
              {meta && <div className={styles.Meta}>{meta}</div>}
            </div>
          </div>
        );
      })}

      {filing.map((f) => (
        <div
          key={f.captureId}
          className={styles.FilingRow}
        >
          <Loader2 className={cn(styles.Spinner, styles.SpinnerFixed)} />
          <div className={styles.Text}>
            <div className={styles.Title}>{f.text}</div>
            <div className={styles.FilingMeta}>Merlin is filing it…</div>
          </div>
        </div>
      ))}

      {/* Reading works off the shared database alone; only ADDING needs
          Merlin's ingest endpoint. Unconfigured: say so, don't hide it. */}
      {data && !data.configured ? (
        <p className={styles.Note}>
          Merlin isn&apos;t connected. Set <code>MERLIN_INGEST_URL</code> and <code>MERLIN_INGEST_TOKEN</code> to add to-dos from here.
        </p>
      ) : (
      <div className={styles.AddRow}>
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
          className={styles.AddInput}
          placeholder="Add a to-do… (Merlin will remind you)"
        />
        <Button onClick={handleAdd} size="sm" disabled={adding || !input.trim()}>
          {adding ? <Loader2 className={styles.Spinner} /> : <Plus className={styles.AddIcon} />}
        </Button>
      </div>
      )}
      {error && <p className={styles.Error}>{error}</p>}

      {done.length > 0 && (
        <div className={styles.Done}>
          <button
            type="button"
            onClick={() => setShowDone((v) => !v)}
            className={styles.DoneToggle}
          >
            {showDone ? 'Hide' : 'Show'} done recently ({done.length})
          </button>
          {showDone && (
            <div className={styles.DoneList}>
              {done.map((t) => (
                <div key={t.id} className={styles.DoneRow}>
                  <span className={styles.DoneTitle}>{t.title}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className={styles.Reopen}
                    disabled={busy.has(t.id)}
                    onClick={() => withBusy(t.id, () => reopenCardTodo(t.id))}
                    title="Reopen"
                  >
                    <RotateCcw className={styles.ReopenIcon} /> reopen
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
