// The offline quick-capture queue (client side).
//
// An idea typed into the capture button with no connection is kept here —
// localStorage on this origin, oldest first — and sent by the board when the
// connection returns (useCaptureQueueFlush in src/hooks/use-offline.ts). Each
// entry carries the project id it will be created under, so a retry whose
// first attempt did reach the server collides on the primary key and creates
// nothing twice (quickCapture in src/app/actions.ts treats that as done).

export interface QueuedCapture {
  /** The project id the idea will be created with. */
  id: string;
  text: string;
  /** ISO timestamp of when it was typed. */
  at: string;
  /** Sends that reached a server and were refused. Network failures don't count. */
  attempts: number;
}

export const QUEUE_KEY = 'kanban.capture-queue';
export const QUEUE_EVENT = 'kanban:capture-queue';

/** A server that answers with an error this many times gets to keep the idea. */
export const MAX_ATTEMPTS = 5;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Tolerant parse: anything that isn't a well-formed entry is dropped. */
export function parseQueue(raw: string | null | undefined): QueuedCapture[] {
  if (!raw) return [];
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(data)) return [];
  const out: QueuedCapture[] = [];
  const seen = new Set<string>();
  for (const entry of data) {
    if (!entry || typeof entry !== 'object') continue;
    const { id, text, at, attempts } = entry as Record<string, unknown>;
    if (typeof id !== 'string' || !UUID_RE.test(id) || seen.has(id)) continue;
    if (typeof text !== 'string' || !text.trim()) continue;
    seen.add(id);
    out.push({
      id,
      text,
      at: typeof at === 'string' ? at : new Date(0).toISOString(),
      attempts: typeof attempts === 'number' && Number.isFinite(attempts) ? attempts : 0,
    });
  }
  return out;
}

export function withCapture(queue: QueuedCapture[], text: string, id: string, at: Date = new Date()): QueuedCapture[] {
  const trimmed = text.trim();
  if (!trimmed || !UUID_RE.test(id) || queue.some((q) => q.id === id)) return queue;
  return [...queue, { id, text: trimmed, at: at.toISOString(), attempts: 0 }];
}

export function withoutCapture(queue: QueuedCapture[], id: string): QueuedCapture[] {
  return queue.filter((q) => q.id !== id);
}

/** One more refused send; dropped once the server has said no MAX_ATTEMPTS times. */
export function withAttempt(queue: QueuedCapture[], id: string): QueuedCapture[] {
  return queue.flatMap((q) => {
    if (q.id !== id) return [q];
    const attempts = q.attempts + 1;
    return attempts >= MAX_ATTEMPTS ? [] : [{ ...q, attempts }];
  });
}

export function describeQueue(n: number, online: boolean): string {
  if (n <= 0) return '';
  const what = n === 1 ? '1 idea' : `${n} ideas`;
  return online ? `Saving ${what}…` : `${what} waiting to save.`;
}

// A server action called with no connection rejects with the browser's fetch
// error — a TypeError ("Failed to fetch", "Load failed"). Anything else came
// from a server that answered, and is counted as an attempt rather than kept
// forever.
export function isNetworkError(e: unknown): boolean {
  return e instanceof TypeError;
}

// ---------------------------------------------------------------- storage

function store(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

export function readQueue(): QueuedCapture[] {
  return parseQueue(store()?.getItem(QUEUE_KEY));
}

function writeQueue(queue: QueuedCapture[]): void {
  const s = store();
  if (!s) return;
  try {
    if (queue.length === 0) s.removeItem(QUEUE_KEY);
    else s.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch {
    // Quota or private mode: nothing more to do without storage.
  }
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(QUEUE_EVENT));
}

export function holdCapture(text: string, id: string): void {
  writeQueue(withCapture(readQueue(), text, id));
}

export function releaseCapture(id: string): void {
  writeQueue(withoutCapture(readQueue(), id));
}

export function countAttempt(id: string): void {
  writeQueue(withAttempt(readQueue(), id));
}

/** Fires on every change from this tab, and from other tabs via `storage`. */
export function subscribeQueue(cb: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const onStorage = (e: StorageEvent) => {
    if (e.key === null || e.key === QUEUE_KEY) cb();
  };
  window.addEventListener(QUEUE_EVENT, cb);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(QUEUE_EVENT, cb);
    window.removeEventListener('storage', onStorage);
  };
}
