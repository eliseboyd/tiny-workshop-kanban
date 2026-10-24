'use client';

import { useEffect } from 'react';
import { useOnline, useQueueSize } from '@/hooks/use-offline';
import { describeQueue } from '@/lib/capture-queue';
import styles from './offline-mode.module.css';

// Offline mode for the installed board: registers public/sw.js (production
// only — see the note there) and shows the status pill while offline and
// while a quick capture is waiting to save. The queue itself is flushed by
// the board (useCaptureQueueFlush), which owns the save and the refresh.
//
// basePath is /kanban and is not applied to runtime strings, so the worker's
// URL and scope are spelled out, as MasterNav's hrefs are in layout.tsx.
const SW_URL = '/kanban/sw.js';
const SW_SCOPE = '/kanban/';

export function OfflineMode() {
  const online = useOnline();
  const queued = useQueueSize();

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const sw = navigator.serviceWorker;
    if (process.env.NODE_ENV !== 'production') {
      // A worker from a production visit to this origin would serve stale
      // chunks against the dev server; make sure none is left.
      sw.getRegistrations().then((regs) => regs.forEach((r) => r.unregister())).catch(() => {});
      return;
    }
    sw.register(SW_URL, { scope: SW_SCOPE }).catch((e) =>
      console.warn('[offline] service worker registration failed:', e),
    );
  }, []);

  const text = !online
    ? `Offline — showing the board as last seen. Changes won't save. ${describeQueue(queued, false)}`.trim()
    : describeQueue(queued, true);
  if (!text) return null;

  return (
    <div role="status" aria-live="polite" className={styles.Pill}>
      <span aria-hidden className={styles.Dot} data-online={online ? '' : undefined} />
      {text}
    </div>
  );
}
