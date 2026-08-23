# Audit Fix Plan

Tracking list from the `/audit` run (score 11/20). Working in priority order.

## P1 — Major

- [x] **A11y: aria-labels on icon-only buttons**
  - `KanbanBoard.tsx:811` mobile menu trigger
  - `KanbanBoard.tsx:836` settings button
  - `KanbanColumn.tsx:136-147` hide column
  - `KanbanColumn.tsx:151-161` delete column
  - Any other `size="icon"` buttons without text

- [x] **A11y: replace native `confirm/prompt/alert`**
  - [x] Built `ConfirmProvider` + `useConfirm` in `src/components/ui/confirm-dialog.tsx`
  - [x] Wired provider into `app/layout.tsx`
  - [x] `KanbanBoard.tsx`: createColumn prompt, deleteColumn/Project/Idea confirms
  - [x] `ProjectEditor.tsx` delete confirm + OG image error surfacing
  - [x] `SettingsModal.tsx` confirms + inline error banner
  - [x] `PlansView.tsx` delete confirm
  - [x] `DayPlanWidget.tsx` clear confirm
  - [ ] `rich-text-editor.tsx` URL prompt — deferred (text-input, not yes/no; not destructive)

- [x] **A11y: keyboard-operable titles & cards**
  - [x] Board title h1 → role=button + Enter/Space + focus-visible ring
  - [x] Column title h3 → same treatment
  - [x] KanbanCard wrapper → role=button, tabIndex=0, Enter/Space opens

- [x] **Perf: drop redundant `router.refresh()` after optimistic updates**
  - [x] pin handler
  - [x] move handler
  - [x] `ProjectModal.onClose` — removed full refetch; only reload dashboard data when in dashboard view

- [x] **Responsive: touch targets ≥ 36px on column controls**
  - [x] `KanbanColumn.tsx` hide + delete buttons → `h-9 w-9`
  - [x] `KanbanCard.tsx` Move button → `h-9 px-3`, `group-focus-within` reveal

## P2 — Minor

- [x] **Theming: tokenize `KanbanColumn`**
  - [x] Container → `bg-muted`
  - [x] Header title → `text-muted-foreground` / `hover:text-foreground`
  - [x] Button neutrals replaced

- [x] **Theming: centralize `DEFAULT_TAG_COLOR`**
  - [x] `src/lib/constants.ts` created
  - [x] `actions.ts`, `SettingsModal.tsx`, `server-factory.ts` use the import
  - [x] `db/schema.ts` left as literal (migration default — can't use TS import)

- [ ] **Perf: stream `page.tsx` with Suspense**
  - Remove `force-dynamic` if possible; split initial queries into suspense boundaries

- [ ] **Perf: dynamic-import `ProjectEditor`**
  - Wrap inside `ProjectModal` with `next/dynamic`

- [x] **Perf: memoize `getPatternImage`** via `useMemo` keyed by `project.id`

- [x] **A11y: `group-focus-within` reveal on hover-revealed actions** (KanbanColumn hide/delete, KanbanCard Move)

- [ ] **Theming: widget color data should be semantic**
  - `AddWidgetDialog.tsx:57, 71` — replace raw Tailwind strings with semantic keys

## P3 — Polish

- [x] Added `color-scheme: light dark` to `:root` in `globals.css`
- [x] Removed redundant `setIsTouchDevice` write in `KanbanCard.tsx`
- [ ] Map status icon colors (`text-blue-500`, `text-amber-500`, `text-green-600`) to tokens
