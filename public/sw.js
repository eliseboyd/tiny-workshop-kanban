/* The board's service worker: the offline half of the installed app.
 *
 * The board is pinned to the phone's home screen for the workshop, where the
 * connection is poor. Without this, opening it there gives the browser's own
 * "no internet" page. With it:
 *
 *   - Navigations are network-first. Every page that renders signed in is
 *     copied into a cache on the way past, and when the network fails the
 *     copy is served instead: the board as you last saw it, read-only.
 *     Nothing cached → public/offline.html.
 *   - Client-side navigations (Next's RSC payloads) fall back the same way.
 *   - /_next/static is content-hashed, so it is cache-first forever; images,
 *     fonts and the icons are stale-while-revalidate.
 *   - Writes are not touched here. A server action that fails is a failed
 *     action; the quick-capture queue (src/lib/capture-queue.ts) is the
 *     page's job and the banner says the rest won't save.
 *
 * Registered by src/components/offline-mode.tsx on signed-in pages, in
 * production only — in dev, chunk URLs are not hashed and a cache-first
 * /_next/static would serve stale code. The app is served at
 * tinywork.shop/kanban (basePath), so the worker is /kanban/sw.js with scope
 * /kanban/ and leaves the rest of the origin alone. Bump VERSION to drop
 * every cache on the next visit; otherwise the caches are capped and trimmed
 * oldest-first.
 *
 * Plain JS, on purpose: served as-is from public/, outside the Next build.
 * Kept in step with merlin/public/sw.js — same file, different constants.
 */

const VERSION = "v2";
const BASE = "/kanban"; // Next basePath — the worker only sees this subtree (scope /kanban/)
const OFFLINE_URL = `${BASE}/offline.html`;

const SHELL = `kanban-shell-${VERSION}`;
const PAGES = `kanban-pages-${VERSION}`;
const RSC = `kanban-rsc-${VERSION}`;
const ASSETS = `kanban-assets-${VERSION}`;

const MAX_PAGES = 40;
const MAX_RSC = 40;
const MAX_ASSETS = 200;

// Paths that are never served from here: the APIs carry their own tokens
// and return JSON a stale copy of would be wrong; auth and login must always
// reach the server.
const BYPASS = [/^\/api\//, /^\/auth\//, /^\/login(\/|$)/];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      await ensureShell();
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([SHELL, PAGES, RSC, ASSETS]);
      for (const name of await caches.keys()) {
        if (!keep.has(name)) await caches.delete(name);
      }
      await self.clients.claim();
    })(),
  );
});

// The page asks for its sections to be cached ahead of a visit
// ({ type: "warm", urls: [...] }), so offline mode covers more than the one
// page that happened to be open when the connection went.
self.addEventListener("message", (event) => {
  const data = event.data;
  if (!data || data.type !== "warm" || !Array.isArray(data.urls)) return;
  event.waitUntil(warm(data.urls));
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET" || req.headers.has("range")) return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname !== BASE && !url.pathname.startsWith(`${BASE}/`)) return;
  const path = url.pathname.slice(BASE.length) || "/";
  if (BYPASS.some((re) => re.test(path))) return;

  if (req.mode === "navigate") {
    event.respondWith(page(event, req));
    return;
  }

  // Next's client router: an RSC payload for a soft navigation. Prefetches
  // are partial and speculative, so they are left to the network alone.
  if (req.headers.get("RSC") === "1") {
    if (req.headers.has("Next-Router-Prefetch")) return;
    event.respondWith(rsc(event, req, url));
    return;
  }

  if (path.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(event, req));
    return;
  }

  const dest = req.destination;
  if (
    dest === "image" ||
    dest === "font" ||
    dest === "style" ||
    dest === "script" ||
    path.startsWith("/_next/image")
  ) {
    event.respondWith(staleWhileRevalidate(event, req));
  }
});

// ---------------------------------------------------------------- strategies
//
// Every strategy returns the network response the moment it arrives and
// stores the copy via event.waitUntil. Never `await cache.put(res.clone())`
// before returning: a clone is a tee of the body stream, and WebKit (iOS
// Safari, the installed app) applies backpressure to the copy nobody is
// reading yet — with a large body (the /today RSC payload) the put waits for
// the page to read the original, the page waits for the put, and the
// request hangs for good. That was the bug behind "pull to refresh gets
// stuck" on the first release; Chromium buffers the tee and never showed it.

async function page(event, req) {
  const key = stripHash(req.url);
  try {
    const res = await fetch(req);
    if (cacheable(res)) {
      event.waitUntil(store(PAGES, key, res.clone(), MAX_PAGES));
      event.waitUntil(ensureShell());
    }
    return res;
  } catch {
    const cache = await caches.open(PAGES);
    const cached = await cache.match(key, { ignoreVary: true });
    if (cached) return cached;
    return offlinePage();
  }
}

async function rsc(event, req, url) {
  const key = rscKey(url);
  try {
    const res = await fetch(req);
    if (cacheable(res)) event.waitUntil(store(RSC, key, res.clone(), MAX_RSC));
    return res;
  } catch (e) {
    const cache = await caches.open(RSC);
    const cached = await cache.match(key, { ignoreVary: true });
    if (cached) return cached;
    // Let the router see the failure: it hard-navigates, which lands in
    // page() above and gets the cached HTML or the offline page.
    throw e;
  }
}

async function cacheFirst(event, req) {
  const cache = await caches.open(ASSETS);
  const cached = await cache.match(req, { ignoreVary: true });
  if (cached) return cached;
  const res = await fetch(req);
  if (cacheable(res)) event.waitUntil(store(ASSETS, req, res.clone(), MAX_ASSETS));
  return res;
}

async function staleWhileRevalidate(event, req) {
  const cache = await caches.open(ASSETS);
  const cached = await cache.match(req, { ignoreVary: true });
  const refresh = fetch(req)
    .then((res) => {
      if (cacheable(res)) event.waitUntil(store(ASSETS, req, res.clone(), MAX_ASSETS));
      return res;
    })
    .catch(() => null);
  if (cached) {
    // Keep the worker alive long enough for the background refresh to land.
    event.waitUntil(refresh);
    return cached;
  }
  const fresh = await refresh;
  if (fresh) return fresh;
  return new Response("", { status: 504, statusText: "Offline" });
}

// ---------------------------------------------------------------- helpers

// Put one entry and keep the cache under its cap. Always run under
// event.waitUntil, never awaited on the response path (see above).
async function store(name, key, res, max) {
  try {
    const cache = await caches.open(name);
    await cache.put(key, res);
    await trim(name, max);
  } catch {
    // Quota, or a response the Cache API refuses: the page already has its
    // copy, only the offline copy is missing.
  }
}

// Only a real, same-origin, non-redirected success goes in: the login
// redirect is a 3xx, and following it would cache the login page under the
// URL of the page that was asked for.
function cacheable(res) {
  return res && res.ok && !res.redirected && res.type === "basic";
}

function stripHash(href) {
  const u = new URL(href);
  u.hash = "";
  return u.href;
}

// One entry per page, however the router salts the request.
function rscKey(url) {
  const u = new URL(url.href);
  u.searchParams.delete("_rsc");
  u.hash = "";
  return u.href;
}

async function ensureShell() {
  const cache = await caches.open(SHELL);
  if (await cache.match(OFFLINE_URL)) return;
  try {
    const res = await fetch(OFFLINE_URL, { credentials: "same-origin" });
    if (cacheable(res)) await cache.put(OFFLINE_URL, res);
  } catch {
    // Precaching is best-effort; page() retries it on the next success.
  }
}

async function offlinePage() {
  const cache = await caches.open(SHELL);
  const cached = await cache.match(OFFLINE_URL);
  if (cached) return cached;
  return new Response(
    "<!doctype html><meta charset=utf-8><meta name=viewport content='width=device-width'>" +
      "<title>Tiny Workshop Kanban</title><body style='font:16px system-ui;padding:3rem 1.5rem'>" +
      "<p>You're offline and the board hasn't been cached yet.</p>",
    { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

async function warm(urls) {
  const cache = await caches.open(PAGES);
  for (const href of urls) {
    try {
      const url = new URL(href, self.location.origin);
      if (url.origin !== self.location.origin) continue;
      const res = await fetch(url.href, { credentials: "same-origin" });
      if (cacheable(res)) await cache.put(stripHash(url.href), res);
    } catch {
      // Offline already, or the page errored: nothing to keep.
    }
  }
  await trim(PAGES, MAX_PAGES);
}

// Cache.keys() comes back in insertion order, so dropping from the front is
// dropping the oldest. Re-putting a URL moves it to the back.
async function trim(name, max) {
  const cache = await caches.open(name);
  const keys = await cache.keys();
  const excess = keys.length - max;
  for (let i = 0; i < excess; i++) await cache.delete(keys[i]);
}
