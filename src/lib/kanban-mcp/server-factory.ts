import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';

import { getSupabaseUrl } from '../../utils/supabase/env';
import { DEFAULT_TAG_COLOR } from '../constants';

export function createServiceClientFromEnv(): SupabaseClient {
  const url = getSupabaseUrl();
  if (!url) {
    throw new Error(
      'Set SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL for the MCP server (same as the Next.js app).'
    );
  }
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error(
      'Set SUPABASE_SERVICE_ROLE_KEY (service role, not anon) for the MCP server.'
    );
  }
  return createClient(url, key);
}

async function getFirstColumnId(supabase: SupabaseClient): Promise<string> {
  const { data } = await supabase
    .from('columns')
    .select('id')
    .order('order', { ascending: true })
    .limit(1);
  return data?.[0]?.id ?? 'todo';
}

async function ensureTagExists(
  supabase: SupabaseClient,
  tagName: string
): Promise<void> {
  const { data: existing } = await supabase
    .from('tags')
    .select('name')
    .eq('name', tagName)
    .maybeSingle();
  if (!existing) {
    await supabase.from('tags').insert({
      name: tagName,
      color: DEFAULT_TAG_COLOR,
      emoji: null,
      icon: null,
    });
  }
}

async function moveIdeaToKanbanImpl(
  supabase: SupabaseClient,
  ideaId: string,
  columnId: string
): Promise<{ error?: string }> {
  const { data: columnProjects } = await supabase
    .from('projects')
    .select('position')
    .eq('status', columnId)
    .or('is_idea.is.null,is_idea.eq.false');

  const maxPosition = columnProjects?.length ?? 0;

  const { error } = await supabase
    .from('projects')
    .update({
      is_idea: false,
      status: columnId,
      position: maxPosition,
    })
    .eq('id', ideaId);

  if (error) return { error: error.message };
  return {};
}

function jsonResult(obj: unknown) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(obj, null, 2) }],
  };
}

const MCP_INSTRUCTIONS = `Workflow for new items (follow unless the user already specified everything):

1) **Placement** — Before calling create_idea, ask: keep it in the **Ideas bin** only, or put it **on the Kanban board** in a specific column? If they want a column, call list_columns first; let them pick a column by name or id.

2) **Missing fields** — If title, tags, description, link, or parent project are unclear, ask **one concise follow-up** (bullet list is fine). Offer optional extras: "Anything else—tags, link, nest under another card?"

3) **Tools** — create_idea always creates an **idea** (Ideas bin). To land **directly in a column**, still create_idea then move_idea_to_kanban with the chosen column_id. Use update_project to add tags, description, or parent_project_id after the fact.

4) **Linking** — Use search_projects when the user might want to attach to an existing card or match tags to existing names.`;

export function createKanbanMcpServer(supabase: SupabaseClient): McpServer {
  const server = new McpServer(
    {
      name: 'tiny-workshop-kanban',
      version: '1.0.0',
    },
    {
      instructions: MCP_INSTRUCTIONS,
    }
  );

  server.registerTool(
    'search_projects',
    {
      description:
        'Search projects and ideas by title/description substring. Use to find existing work to link or tag.',
      inputSchema: {
        query: z.string().describe('Substring to match (case-insensitive)'),
        is_idea: z
          .boolean()
          .optional()
          .describe(
            'If true, only ideas; if false, only board projects; omit for both'
          ),
      },
    },
    async ({ query, is_idea: isIdea }) => {
      let req = supabase
        .from('projects')
        .select(
          'id, title, description, tags, parent_project_id, status, is_idea, created_at'
        )
        .order('created_at', { ascending: false })
        .limit(200);

      if (isIdea === true) req = req.eq('is_idea', true);
      else if (isIdea === false) req = req.eq('is_idea', false);

      const { data: rows, error } = await req;
      if (error) return jsonResult({ error: error.message });

      const q = query.trim().toLowerCase();
      const filtered = q.length
        ? (rows ?? []).filter(
            (p) =>
              (p.title && p.title.toLowerCase().includes(q)) ||
              (p.description && p.description.toLowerCase().includes(q))
          )
        : (rows ?? []);

      return jsonResult({ projects: filtered.slice(0, 50) });
    }
  );

  server.registerTool(
    'list_tags',
    {
      description:
        'List all tag names (from tags table and tags used on projects).',
      inputSchema: {},
    },
    async () => {
      const { data: tagRows, error: e1 } = await supabase
        .from('tags')
        .select('name, color');
      if (e1) return jsonResult({ error: e1.message });

      const { data: projects, error: e2 } = await supabase
        .from('projects')
        .select('tags');
      if (e2) return jsonResult({ error: e2.message });

      const map = new Map<string, { name: string; color?: string }>();
      tagRows?.forEach((t) =>
        map.set(t.name, { name: t.name, color: t.color ?? undefined })
      );
      projects?.forEach((p) => {
        p.tags?.forEach((name: string) => {
          if (!map.has(name)) map.set(name, { name, color: DEFAULT_TAG_COLOR });
        });
      });

      const tags = Array.from(map.values()).sort((a, b) =>
        a.name.localeCompare(b.name)
      );
      return jsonResult({ tags });
    }
  );

  server.registerTool(
    'list_columns',
    {
      description:
        'List Kanban columns (id and title). Use column id with move_idea_to_kanban.',
      inputSchema: {},
    },
    async () => {
      const { data, error } = await supabase
        .from('columns')
        .select('id, title, order')
        .order('order', { ascending: true });
      if (error) return jsonResult({ error: error.message });
      return jsonResult({ columns: data ?? [] });
    }
  );

  server.registerTool(
    'create_idea',
    {
      description:
        'Create a new idea in the Ideas bin (is_idea=true). Optionally set tags and parent project.',
      inputSchema: {
        title: z.string().describe('Card title'),
        description: z.string().optional().describe('Optional short description'),
        rich_content: z
          .string()
          .optional()
          .describe('Optional HTML body (e.g. link paragraph)'),
        tags: z.array(z.string()).optional().describe('Tag names to attach'),
        parent_project_id: z
          .string()
          .optional()
          .nullable()
          .describe('UUID of parent project to nest under'),
      },
    },
    async ({
      title,
      description,
      rich_content: richContent,
      tags,
      parent_project_id: parentProjectId,
    }) => {
      const id = uuidv4();
      const status = await getFirstColumnId(supabase);
      const tagList = tags ?? [];
      for (const t of tagList) {
        await ensureTagExists(supabase, t.trim()).catch(() => undefined);
      }
      const cleanedTags = tagList.map((t) => t.trim()).filter(Boolean);

      const { error } = await supabase.from('projects').insert({
        id,
        title: title.slice(0, 500),
        description: description?.slice(0, 2000) ?? null,
        rich_content: richContent ?? null,
        tags: cleanedTags.length > 0 ? cleanedTags : null,
        parent_project_id: parentProjectId ?? null,
        status,
        position: 0,
        is_idea: true,
        is_task: false,
      });

      if (error) return jsonResult({ error: error.message });
      return jsonResult({ id, title, status: 'created' });
    }
  );

  server.registerTool(
    'update_project',
    {
      description:
        'Update an existing project or idea: title, description, tags, parent_project_id.',
      inputSchema: {
        id: z.string().describe('Project UUID'),
        title: z.string().optional(),
        description: z.string().nullable().optional(),
        tags: z.array(z.string()).optional(),
        parent_project_id: z.string().nullable().optional(),
      },
    },
    async ({
      id,
      title,
      description,
      tags,
      parent_project_id: parentProjectId,
    }) => {
      const db: Record<string, unknown> = {};
      if (title !== undefined) db.title = title;
      if (description !== undefined) db.description = description;
      if (tags !== undefined) {
        for (const t of tags) {
          await ensureTagExists(supabase, t.trim()).catch(() => undefined);
        }
        db.tags = tags.map((t) => t.trim()).filter(Boolean);
      }
      if (parentProjectId !== undefined) {
        db.parent_project_id = parentProjectId;
      }

      const { error } = await supabase.from('projects').update(db).eq('id', id);
      if (error) return jsonResult({ error: error.message });
      return jsonResult({ id, status: 'updated' });
    }
  );

  server.registerTool(
    'move_idea_to_kanban',
    {
      description:
        'Move an idea onto the Kanban board into a column (clears is_idea). Use list_columns for ids.',
      inputSchema: {
        idea_id: z.string().describe('UUID of the idea'),
        column_id: z.string().describe('UUID of the target column'),
      },
    },
    async ({ idea_id: ideaId, column_id: columnId }) => {
      const result = await moveIdeaToKanbanImpl(supabase, ideaId, columnId);
      if (result.error) return jsonResult({ error: result.error });
      return jsonResult({
        idea_id: ideaId,
        column_id: columnId,
        status: 'moved',
      });
    }
  );

  return server;
}
