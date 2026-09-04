# To-dos on a project — Merlin tasks shown in the project modal

Status: **plan, not built.** The database contract and Merlin's side are in
`merlin/docs/project-todos.md`; read that first. This file is what changes in
this repo.

## What it is

A project on the board can carry to-dos that Merlin reminds you about day to
day, before the project itself is anywhere near In Progress. "Mirror for
Arthur" sits in Todo; "check what acrylic colours I have" is a to-do on it,
and it turns up in tomorrow's Merlin digest and `/today` because Merlin
scores it like any other task. Tick it off on the board, in Telegram, or on
the Merlin web app — same row.

This is **not** the checklist inside a project's notes (TipTap task items in
`rich_content`, surfaced by `ProjectTodosWidget`). That stays as it is: a
checklist is part of the write-up, Merlin never sees it. And it is not a
task card (`is_task=true`), which is a card on the board in its own right.
Three things, deliberately: notes checklist = thinking, task card = board
work, to-do = something Merlin nags about.

## Where the data lives

Nowhere new. A to-do is a row in Merlin's `public.items` with
`kanban_card_id` = this card and `status = 'open'` (or `'done'`). Every data
path in this app already runs as service_role, so reading `public` is one
`.schema('public')` away — no RLS to add, no new table, no policies.

The board **reads** Merlin's rows and makes exactly two kinds of write:
create (through Merlin's ingest endpoint, never a direct insert) and
complete/reopen (through the `complete_item()` function Merlin ships, and a
mirror update for reopen). No deletes, no title edits, no touching
`captures`. Merlin, for its part, never moves, edits or deletes cards.

## Changes

### `src/app/merlin-actions.ts` (new)

Everything that crosses into Merlin's schema, in one file named for the
boundary. A `merlinClient()` helper: the service-role client with
`db: { schema: 'public' }` (the existing `createServiceRoleClient()` pins
`kanban`).

- `getCardTodos(cardId)` → `{ open: Todo[], done: Todo[], filing:
  { captureId, text }[] }`. Open from `items` ordered by `score desc`; done
  = last 7 days by `completed_at`; filing = `captures` rows with `status in
  ('pending','enriching')` and `metadata->>'kanban_card_id' = cardId`, so a
  freshly typed to-do shows up honestly as "Merlin is filing…" until
  enrichment lands (usually seconds, worst case a minute).
- `addCardTodo(cardId, cardTitle, text)` → `POST ${MERLIN_INGEST_URL}` with
  bearer `MERLIN_INGEST_TOKEN`, body `{ text, channel: 'kanban', source_id:
  \`${cardId}:${uuid}\`, metadata: { kanban_card_id: cardId,
  kanban_card_title: cardTitle } }`. Use `safeFetch` from
  `src/utils/safe-fetch.ts`; a non-202 returns `{ error }` to the UI, it
  never throws into the modal. Returns the `capture_id`.
- `completeCardTodo(itemId)` → `rpc('complete_item', { p_item_id, p_source:
  'kanban' })`.
- `reopenCardTodo(itemId)` → update `status='open', completed_at=null` where
  `status='done'`, then insert `signals { item_id, kind: 'reopened',
  payload: { source: 'kanban' } }`.
- `isMerlinConfigured()` → both env vars present. The section renders a
  one-line "Merlin isn't connected (set MERLIN_INGEST_URL and
  MERLIN_INGEST_TOKEN)" instead of a form when false. Fail visibly, not
  silently.

### `src/components/kanban/ProjectTodos.tsx` (new, client)

Props: `cardId`, `cardTitle`. On mount calls `getCardTodos`; renders open
to-dos as checkbox rows (title, then the small grey Merlin metadata: contexts
like `@workshop`, `~10m`, `due Tue`), filing rows greyed with a spinner,
done rows collapsed under "Done recently (n)". Input at the bottom: Enter
submits `addCardTodo`, clears, refetches; while any filing row exists,
refetch every 3 s, stop when none remain. Checking a box calls
`completeCardTodo` optimistically and refetches. Follow the look of the
Materials List rows in `ProjectEditor.tsx` (`section-materials`, ~line
2096): same border/hover, same input-at-bottom pattern.

### `src/components/kanban/ProjectEditor.tsx`

- Sidebar (line ~1401): add **To-dos** between Project Overview and
  Materials List, scrolling to `section-todos`.
- Content: `<div id="section-todos" className="space-y-4 pt-8 border-t">`
  with the `<h2>` and `<ProjectTodos cardId={project.id}
  cardTitle={project.title} />`, placed before the Materials List section.
- Only for board projects: hide the section when `project.isIdea` or
  `project.isTask` (an idea has no to-dos yet; a task card *is* the to-do).
  Mirrors Merlin's picker, which only offers non-idea, non-task cards.
- The section-observer that drives `activeSection` needs the new id in its
  list, wherever the existing four are enumerated.

### Card face (optional, second pass)

A small `n to-dos` count on `KanbanCard` for cards that have open to-dos.
Needs one extra query in `getProjectsCached` (`select kanban_card_id,
count(*) from public.items where status='open' and kanban_card_id is not
null group by 1`) merged into the card rows. Leave it out of the first PR;
the modal is the feature.

### MCP (`src/lib/kanban-mcp/server-factory.ts`)

Not needed for v1 — Merlin's own MCP is where "add a to-do to the mirror
project" belongs, and it is a follow-up ticket there. If it turns out
useful, `list_card_todos(card_id)` is a thin wrapper over `getCardTodos`.

### Config

`env.example` and Netlify: `MERLIN_INGEST_URL=https://merlin.tinywork.shop/api/ingest`
and `MERLIN_INGEST_TOKEN=` (the value of Merlin's `INGEST_TOKEN`). Server-side
only, not `NEXT_PUBLIC_`. Add both to the CLAUDE.md "Environment variables
required" line.

### Types

`Todo = { id: string; title: string; status: 'open' | 'done'; dueAt: string
| null; estimatedMinutes: number | null; contexts: string[]; score: number |
null; completedAt: string | null }` in `src/types/todos.ts`. Map from the
snake_case row in `merlin-actions.ts`, nowhere else.

## Order of work

1. Merlin ships its migrations (enum value + `complete_item()`) and the
   ingest change — the board can't create anything until `channel:
   'kanban'` is accepted.
2. `merlin-actions.ts` + `ProjectTodos.tsx` + the editor section, behind
   `isMerlinConfigured()`.
3. Env vars on Netlify, then smoke test below.
4. Card-face count, if wanted.

## Smoke test

1. Open "Mirror for Arthur" (a Todo-column project). To-dos section shows
   empty state and an input.
2. Type "check what acrylic colours I have", Enter. Row appears greyed as
   filing; within a minute it becomes a real row with `@workshop` and an
   estimate.
3. Merlin `/today` (Telegram or web) lists it as `↗ Mirror for Arthur ·
   Todo`.
4. Tick it on the board → disappears from Merlin's open list; shows under
   Done recently here. Reopen → back in both.
5. Unset `MERLIN_INGEST_TOKEN` locally → section shows the not-connected
   line, nothing else breaks.
6. `npx tsc --noEmit` and `npm run lint` clean.
