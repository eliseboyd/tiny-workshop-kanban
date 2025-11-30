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

## Database

The application uses `better-sqlite3` for a robust, lightweight, local database solution. The database file `kanban.db` will be created in the project root automatically.

## Note on DuckDB

Originally intended to use DuckDB, but due to compatibility issues with the current Node.js environment (Node 23), `better-sqlite3` was chosen as a reliable alternative for local persistence in this context.
