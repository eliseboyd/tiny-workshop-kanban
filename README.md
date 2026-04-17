# Project Board

A simple Kanban board application built with Next.js, Shadcn UI, and SQLite.

## Features

- Create projects with title, description, and status.
- Drag and drop projects between columns (Todo, In Progress, Done).
- Reorder projects within columns.
- Persistent data using a local SQLite database.

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Run the development server:
   ```bash
   npm run dev
   ```

3. Open [http://localhost:3000](http://localhost:3000) with your browser.

## Quick capture (web and HTTP)

The **Quick capture** field saves your text as an idea: **first line = title**, remaining lines = **description** (no server-side LLM). If you paste a URL, the card gets a link and a **preview image** from Open Graph when possible.

## Claude / MCP (tagging and linking)

For **searching the board**, **adding tags**, and **linking to parent projects**, use the **Kanban MCP server** from Claude or Cursor. It talks to the same Supabase data as the app.

See **[mcp/kanban/README.md](mcp/kanban/README.md)** for install, env vars (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`), and Cursor / Claude Desktop config.

## POST /api/capture (iOS, scripts)

Set `QUICK_CAPTURE_TOKEN` in `.env.local` (and in Netlify) to a long random string. Same capture behavior as the web field (plain text + optional URL).

**Headers:** `Authorization: Bearer <QUICK_CAPTURE_TOKEN>` and `Content-Type: application/json`.

**Body (JSON):** at least one of `text` or `url` is required.

```json
{ "text": "Optional note or pasted content", "url": "https://example.com/page" }
```

**iOS Shortcut (Share Sheet):**

1. Open the Shortcuts app and create a shortcut (for example **Add to Kanban**).
2. Use **Get URLs from Input** (or **Get Clipboard**) when sharing from Safari.
3. Add **Get Contents of URL** with:
   - Method: **POST**
   - URL: `https://your-deployment.netlify.app/api/capture` (your real site URL)
   - Headers: `Content-Type` = `application/json`, `Authorization` = `Bearer YOUR_TOKEN_HERE`
   - Request Body: JSON with the shared URL in the `url` field (Shortcuts: build a dictionary with keys `text` and `url`, and set `url` to the shortcut input). Add a **Text** or **Ask for Input** action if you want to populate `text` with a note.
4. Turn on **Show in Share Sheet** for Safari and other apps.

If `QUICK_CAPTURE_TOKEN` is unset, the route responds with `503` and the feature is off.

## Database

The application uses `better-sqlite3` for a robust, lightweight, local database solution. The database file `kanban.db` will be created in the project root automatically.

## Note on DuckDB

Originally intended to use DuckDB, but due to compatibility issues with the current Node.js environment (Node 23), `better-sqlite3` was chosen as a reliable alternative for local persistence in this context.
