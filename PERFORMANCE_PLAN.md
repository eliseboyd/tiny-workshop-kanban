# Performance Plan — actual & perceived load time (mobile-first)

Status: **implemented 2026-07-23** (except items marked ⏳ deferred / ⚠️ decision). Ordered by impact-per-effort within each phase.

Already in place before this work: kanban skeleton, lazy tab views, trimmed `PROJECT_CARD_COLUMNS`, dashboard data deferred to client, `next/image` with `sizes="240px"` + blur placeholder on cards, optimistic drag-drop/pin/capture.

---

## Phase 0 — Measure

- [ ] ⏳ Run Lighthouse (mobile preset, throttled) against the deployed site after deploying these changes; record LCP, TTFB, TBT, CLS. (Needs the deployed URL — not runnable from the sandbox.)
- [ ] ⏳ `ANALYZE=true next build` with `@next/bundle-analyzer` to confirm chunk-size wins.
- [ ] ⏳ Check Netlify function logs for `/` render duration before/after.

## Phase 1 — TTFB

1. [x] **Stream the shell** — added `src/app/loading.tsx` reusing the skeleton (extracted to `src/components/kanban/KanbanSkeleton.tsx`). The skeleton now streams immediately while the 6 Supabase queries run; no more blank screen during TTFB.
2. [x] **Middleware auth without a network round trip** — `updateSession` now uses `supabase.auth.getClaims()` (local JWT verification) instead of `getUser()`, removing ~100–300ms from every navigation. Note: full benefit requires the Supabase project to use **asymmetric JWT signing keys** (Dashboard → Auth → Signing keys); on legacy HS256 it transparently falls back to a server check.
3. [x] **Cache board reads server-side** — the 6 initial queries (`getProjects`, `getIdeas`, `getColumns`, `getSettings`, `getAllTags`, `getAllProjectGroups`) are wrapped in `unstable_cache` with tag `board-data` + 5-min TTL. All 36 mutation sites now call `revalidateBoard()` (revalidatePath + revalidateTag). External writers: `/api/capture` goes through `quickCapture` (covered); `/api/mcp` POST revalidates the tag in the route handler; the Netlify `linear-webhook` function can't revalidate — the 5-min TTL bounds its staleness.
4. [ ] ⏳ **Combine the 6 queries into one RPC** — deferred: needs a DB migration, and caching (1.3) already removes the round trips on warm loads. Revisit only if cold-load TTFB is still slow after measuring.

## Phase 2 — Bundle size

1. [x] **`ProjectModal` (→ ProjectEditor, 2.7k lines) split** out of the board chunk via `next/dynamic` in `KanbanBoard.tsx` and `KanbanBoardEmbed.tsx`.
2. [x] **`SettingsModal` split + conditionally mounted**; **`AddWidgetDialog` split + gated on open** in `WidgetsSection.tsx`; **`ImageCropModal` split** in `ProjectEditor.tsx` (pulls react-image-crop out of the editor chunk).
3. [x] **Idle prefetch** — `KanbanBoard` warms ProjectModal, SettingsModal, and all three tab-view chunks via `requestIdleCallback` after first paint, so first open/tab-switch has no loading flash.
4. [ ] ⏳ Confirm `pdfjs-dist` stays out of shared chunks via bundle analyzer (see Phase 0).

## Phase 3 — Images

1. [x] **Modern formats** — `images.formats: ['image/avif', 'image/webp']` in `next.config.ts`.
2. [x] **Upload compression upgraded** — `compressImage()` now outputs WebP at q0.82 with a 1600px cap (was: kept original type, meaning PNGs passed through uncompressed because canvas PNG re-encode is bigger). All ProjectEditor upload paths run through it; the crop modal already exports JPEG q0.92.
3. [x] ~~Recompress `public/uploads`~~ — **not needed**: verified against the DB that zero rows reference `/uploads/`; all 39 card images live on Supabase storage. ⚠️ `public/uploads` (16 MB) is unreferenced dead weight shipped with every deploy — safe to delete, left in place for you to confirm.
4. [x] **`priority` on above-fold card images** — first 2 cards per column preload; blur placeholders were already present.
5. [x] **Removed the `hostname: '**'` catch-all** remote pattern (optimizer cost/abuse surface) plus the unused OG-domain list — verified via DB that every optimized image is on the project's Supabase storage (OG/AI images are re-hosted there; remote inspiration images render `unoptimized`, which bypasses the allowlist). If a legacy cover ever 404s, re-add its host.

## Phase 4 — Perceived speed / mobile UX

1. [x] **Optimistic updates audit** — drag-drop, move-card, pin, modal edit/delete, quick-capture already optimistic. Only `handleCreateColumn` awaits + refreshes (rare interaction, left as is).
2. [x] **Skeleton fidelity** — skeleton columns now use the real board's `w-[85vw] md:w-60` + `bg-muted`, so the board lands without layout shift on phones.
3. [ ] ⚠️ **Service worker / PWA precache** — deferred deliberately: high stale-cache-bug risk for modest gain now that the shell streams instantly and chunks are split. Say the word if you want it.
4. [x] **Preconnect to Supabase** in `layout.tsx` (auth + storage image TLS handshake starts during HTML parse).
5. [x] **RSC payload trimmed** — card descriptions truncated to 300 chars server-side (cards line-clamp anyway; the modal re-fetches the full row via `getProject()` before editing).

## Phase 5 — Verify

- [x] `npx tsc --noEmit` — clean (0 errors).
- [x] `npx eslint` on all modified files — 0 errors (24 pre-existing warnings; the repo has ~618 pre-existing errors in untouched files).
- [ ] ⏳ Manual smoke test on a real phone over throttled 4G after deploy: cold load, tab switch, card open, drag-drop, image upload (now saves as WebP), MCP capture appearing on the board.

---

## Changed files

`src/app/loading.tsx` (new), `src/components/kanban/KanbanSkeleton.tsx` (new), `src/utils/supabase/middleware.ts`, `src/app/actions.ts`, `src/app/api/mcp/route.ts`, `src/app/layout.tsx`, `src/components/kanban/{KanbanBoard,KanbanBoardClient,KanbanBoardEmbed,KanbanCard,KanbanColumn,ProjectEditor}.tsx`, `src/components/widgets/WidgetsSection.tsx`, `src/utils/image-compression.ts`, `next.config.ts`.

## Notes / rollback levers

- Board staleness: worst case 5 min (only for writes from the Netlify linear-webhook); everything else invalidates instantly. Tune via `BOARD_CACHE_OPTS.revalidate` in `actions.ts`.
- If any legacy card image 404s after deploy, re-add its hostname to `images.remotePatterns`.
- A stale `.git/index.lock` exists in the repo (from an earlier crashed git process, unrelated to these changes) — delete it if git commands complain.
