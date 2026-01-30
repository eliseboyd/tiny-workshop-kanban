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

## iOS Share Sheet Quick Add

You can add links directly to Ideas from iOS using a Shortcuts share sheet action.
First, generate a Quick Add token in **Settings → Quick Add**, then click **Install iOS Shortcut**.

1. Open the Shortcuts app on iOS.
2. Create a new shortcut named "Add to Project Board".
3. Add these actions (manual setup only if you prefer not to use the install button):
   - Get URLs from Shortcut Input
   - Get Contents of URL
     - Method: POST
     - URL: `https://your-netlify-url.netlify.app/api/quick-add`
      - Headers: `Content-Type: application/json`
     - Request Body: JSON
       - `{ "url": [URL] }`
4. Enable "Show in Share Sheet".
5. Share any page from Safari and choose the shortcut.

Include a header:
- `Authorization: Bearer your_quick_add_token` (or `x-quick-add-token`)

If you want to include a note, add a "Text" action and send `{ "url": [URL], "note": [Text] }`.

## Database

The application uses `better-sqlite3` for a robust, lightweight, local database solution. The database file `kanban.db` will be created in the project root automatically.

## Note on DuckDB

Originally intended to use DuckDB, but due to compatibility issues with the current Node.js environment (Node 23), `better-sqlite3` was chosen as a reliable alternative for local persistence in this context.
