import { getProjects, getSettings, getColumns } from '@/app/actions';
import { KanbanBoardEmbedClient } from '@/components/kanban/KanbanBoardEmbedClient';

export const dynamic = 'force-dynamic';

export default async function EmbedPage() {
  let projects: Awaited<ReturnType<typeof getProjects>>;
  let settings: Awaited<ReturnType<typeof getSettings>>;
  let columns: Awaited<ReturnType<typeof getColumns>>;

  try {
    [projects, settings, columns] = await Promise.all([
      getProjects(),
      getSettings(),
      getColumns(),
    ]);
  } catch (err) {
    console.error('[Embed] initial data load failed:', err);
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-background overflow-hidden p-6">
        <div className="max-w-md space-y-3 text-center">
          <h1 className="text-xl font-semibold tracking-tight">Unable to load embed</h1>
          <p className="text-sm text-muted-foreground">
            Check deployment logs. Ensure Supabase URL, anon key, and service role key are set on the host.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col bg-background overflow-hidden">
      <KanbanBoardEmbedClient initialProjects={projects} initialSettings={settings} initialColumns={columns} />
    </main>
  );
}

