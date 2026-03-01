# CLAUDE.md — Project conventions for Claude Code

This file is read by Claude Code before implementing any issue.
Keep it up to date so automated PRs stay consistent with the codebase.

---

## Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5 — strict mode enabled |
| Styling | Tailwind CSS v4 |
| UI primitives | Shadcn UI (Radix-based) |
| Database | Supabase (Postgres) via Drizzle ORM |
| Auth | Supabase Auth (`@supabase/ssr`) |
| Deployment | Netlify (`@netlify/plugin-nextjs`) |
| Package manager | npm |

---

## Running the project locally

```bash
# Install dependencies
npm install

# Start the dev server (http://localhost:3000)
npm run dev
```

Copy `env.example` to `.env.local` and fill in your Supabase credentials before running.

---

## Checks that must pass before opening a PR

```bash
# Type-check (must report zero errors)
npx tsc --noEmit

# Lint (must report zero errors)
npm run lint
```

CI runs both on every push to `main` and on every PR (see `.github/workflows/ci.yml`).
There is currently **no automated test suite** — rely on type safety and manual smoke testing.

---

## Project structure

```
src/
  app/           # Next.js App Router pages and layouts
    api/         # Route handlers (Next.js API routes)
    actions.ts   # Server Actions
  components/    # Shared React components
  db/            # Drizzle schema and client
  hooks/         # Custom React hooks
  lib/           # Shared utilities (e.g. cn())
  types/         # TypeScript type definitions
  utils/         # Supabase client helpers (browser / server / admin)
netlify/
  functions/     # Netlify serverless functions (CommonJS)
migrations/      # Drizzle migration files
```

---

## Conventions

### TypeScript
- `strict: true` is set — do not use `any` without a comment explaining why.
- Prefer type inference over explicit annotations where the type is obvious.
- New files in `src/` must be `.ts` or `.tsx`.

### React / Next.js
- Use Server Components by default; add `'use client'` only when browser APIs or interactivity require it.
- Server Actions go in `src/app/actions.ts` (or co-located `actions.ts` files for large features).
- API route handlers live under `src/app/api/<resource>/route.ts`.
- All new pages go under `src/app/`.

### Styling
- Use Tailwind utility classes. Do not write custom CSS except in `globals.css`.
- Use `cn()` from `@/lib/utils` to merge conditional classes.
- Shadcn components are pre-installed — check `src/components/ui/` before building something from scratch.

### Database
- Schema lives in `src/db/`. Run migrations with `drizzle-kit`.
- Use the Drizzle client, not raw SQL, for application queries.
- Supabase Row Level Security (RLS) is enabled — every new table needs policies.

### Netlify Functions
- Plain JavaScript (CommonJS `exports.handler`), not TypeScript.
- Keep functions small and focused on a single responsibility.
- Validate and sanitise all inputs; verify signatures for incoming webhooks.

### Git
- Branch names follow `linear/<issue-id>` for automated branches.
- Commit message format: `type(ISSUE-ID): short description`
  - Types: `feat`, `fix`, `chore`, `docs`, `refactor`
- PRs target `main`.

---

## Patterns to follow

- Use `createServiceRoleClient()` from `@/utils/supabase/admin` for server-side admin operations (bypass RLS).
- Use `createClient()` from `@/utils/supabase/server` for authenticated server-side reads.
- Validate request authenticity (tokens, HMAC signatures) before acting on external webhooks.
- Return `NextResponse.json({ error: '...' }, { status: 4xx })` from API routes on failure.

---

## Patterns to avoid

- Do not use `process.env` values client-side unless they are prefixed with `NEXT_PUBLIC_`.
- Do not commit `.env*` files (they are git-ignored).
- Do not use `fetch` without error handling in server-side code.
- Do not use `@ts-ignore` — fix the underlying type issue instead.
- Do not add Drizzle migrations by hand — use `drizzle-kit generate` then review before applying.

---

## PR requirements

1. TypeScript and lint checks must pass (CI enforces this).
2. Include the Linear issue URL in the PR description.
3. Keep PRs focused — one issue per PR.
4. Add a brief summary of what changed and why.

---

## TODO: fill these in for your project

- [ ] **Testing approach**: <!-- e.g. "Run `npm test` for unit tests; Playwright for e2e" -->
- [ ] **Environment variables required**: <!-- list any new env vars your change needs -->
- [ ] **Feature flags / config**: <!-- document any feature flags in use -->
- [ ] **Third-party service dependencies**: <!-- e.g. Stripe, SendGrid — note test/prod keys -->
