# Kanban MCP server

stdio MCP server for [tiny-workshop-kanban](https://github.com/) so Claude (Cursor, Claude Desktop, etc.) can **search**, **tag**, **create ideas**, and **move ideas** to the board using the same Supabase data as the web app.

## Prerequisites

- `SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (service role — same as the Next.js server; keep this secret)

Optional: copy these from the project root `.env.local`.

## Install

```bash
cd mcp/kanban
npm install
npm run build
```

## Follow-up questions (Claude behavior)

The server sends **MCP `instructions`** to the client: Claude is nudged to ask **(1)** Ideas only vs **which Kanban column**, **(2)** a short pass for missing tags / description / link / parent, and **(3)** to use `list_columns` before `move_idea_to_kanban` when placing on the board.

Rebuild after pulling changes: `npm run build`. Restart Claude Desktop.

**Stronger control:** create a Claude **Project** and add **Custom instructions**, e.g.:

> When I use the kanban board: always ask if the item stays in **Ideas** or goes to a **column** (list columns if needed). If anything important is missing, ask once in bullets before calling tools. After `create_idea`, offer to set tags or parent with `update_project` or move with `move_idea_to_kanban`.

You can tune tone (strict vs. minimal questions) there without changing code.

## Tools

| Tool | Purpose |
|------|---------|
| `search_projects` | Find cards by title/description; optional `is_idea` filter |
| `list_tags` | All tag names (table + in-use on projects) |
| `list_columns` | Kanban column `id` + title (for `move_idea_to_kanban`) |
| `create_idea` | New idea with optional `tags`, `parent_project_id`, `rich_content` |
| `update_project` | Patch title, description, tags, `parent_project_id` |
| `move_idea_to_kanban` | Promote idea to a column (`is_idea` → false) |

## Cursor

Add to **Cursor Settings → MCP** (or `.cursor/mcp.json`), adjusting the path:

```json
{
  "mcpServers": {
    "kanban": {
      "command": "node",
      "args": ["/absolute/path/to/tiny-workshop-kanban/mcp/kanban/dist/index.js"],
      "env": {
        "SUPABASE_URL": "https://YOUR_PROJECT.supabase.co",
        "SUPABASE_SERVICE_ROLE_KEY": "your-service-role-key"
      }
    }
  }
}
```

## Claude Desktop

`~/Library/Application Support/Claude/claude_desktop_config.json` (macOS):

```json
{
  "mcpServers": {
    "kanban": {
      "command": "node",
      "args": ["/absolute/path/to/tiny-workshop-kanban/mcp/kanban/dist/index.js"],
      "env": {
        "SUPABASE_URL": "https://YOUR_PROJECT.supabase.co",
        "SUPABASE_SERVICE_ROLE_KEY": "your-service-role-key"
      }
    }
  }
}
```

Restart Claude after editing.

## Claude mobile / remote MCP (Streamable HTTP)

Claude **mobile** cannot run a local stdio MCP. Use the deployed app’s **remote MCP** endpoint instead (same tools as stdio, backed by Supabase).

1. Deploy the Next app (e.g. Netlify) with `SUPABASE_SERVICE_ROLE_KEY` and Supabase URL set in the site env (same as the web app).
2. Set a long random **`REMOTE_MCP_TOKEN`** (or reuse **`QUICK_CAPTURE_TOKEN`** if you accept one secret for capture + MCP).
3. In Claude’s **connector / remote MCP** settings (wording varies by client), add a connector whose URL is:

   `https://YOUR_DEPLOYED_HOST/api/mcp`

   Use your real production host (custom domain or `*.netlify.app`) with **no space** before `/api/mcp`.

4. Configure the connector to send **`Authorization: Bearer <your token>`** on each request (some UIs call this an API key or auth header).

The server uses the MCP **Streamable HTTP** transport (GET / POST / DELETE). CORS is open (`*`) so browser-based clients can reach the endpoint; protection is the Bearer token—**keep it secret** and rotate if leaked.

Rebuild the stdio binary after pulling: `cd mcp/kanban && npm install && npm run build`.

## Example prompts

- “Search my board for ‘desk lamp’ and list matching idea titles.”
- “Create an idea titled ‘Cable tray’ tagged `lighting` and `office`.”
- “Move idea `<uuid>` to the Todo column” (use `list_columns` first to get the column id).
