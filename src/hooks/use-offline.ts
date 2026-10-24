'use client';

import { useEffect, useSyncExternalStore } from 'react';
import {
  countAttempt,
  isNetworkError,
  readQueue,
  releaseCapture,
  subscribeQueue,
  type QueuedCapture,
} from '@/lib/capture-queue';

// `navigator.onLine` is the browser's word, and it is optimistic (a captive
// portal counts as online). It drives the banner and gates the queue flush;
// what actually puts an idea in the queue is a send that fails.
function subscribeOnline(cb: () => void): () => void {
  window.addEventListener('online', cb);
  window.addEventListener('offline', cb);
  return () => {
    window.removeEventListener('online', cb);
    window.removeEventListener('offline', cb);
  };
}

// The server snapshot is "online": there is no navigator on the server, and
// the first client render has to agree with it before the real value lands.
export function useOnline(): boolean {
  return useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);
}

export function useQueueSize(): number {
  return useSyncExternalStore(subscribeQueue, () => readQueue().length, () => 0);
}

// Sends the queue whenever the connection comes back, the tab becomes
// visible, or the page loads with something waiting. Sequential, oldest
// first; a network failure stops the pass and keeps the rest, a server
// refusal counts an attempt. `send` is the board's own save; `onSent` runs
// once per pass that saved anything, so the board can refresh its ideas.
export function useCaptureQueueFlush(
  send: (entry: QueuedCapture) => Promise<void>,
  onSent?: () => void | Promise<void>,
): void {
  const online = useOnline();
  useEffect(() => {
    if (!online) return;
    let running = false;
    const flush = async () => {
      if (running || !navigator.onLine) return;
      running = true;
      let sent = 0;
      try {
        for (const entry of readQueue()) {
          try {
            await send(entry);
            releaseCapture(entry.id);
            sent++;
          } catch (e) {
            if (isNetworkError(e)) return; // still offline: keep everything, try later
            countAttempt(entry.id);
          }
        }
      } finally {
        running = false;
        if (sent > 0) void onSent?.();
      }
    };
    void flush();
    const onVisible = () => {
      if (document.visibilityState === 'visible') void flush();
    };
    document.addEventListener('visibilitychange', onVisible);
    const unsubscribe = subscribeQueue(() => void flush());
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      unsubscribe();
    };
    // send/onSent are inline closures on the board; re-subscribing per render
    // would re-flush on every state change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online]);
}
