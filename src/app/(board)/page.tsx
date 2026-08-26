import { KanbanBoardClient } from '@/components/kanban/KanbanBoardClient';
import { getProjects, getSettings, getColumns, getIdeas, getAllTags, getAllProjectGroups } from '@/app/actions';

// Ensure dynamic rendering so we get fresh data from Supabase on every load
export const dynamic = 'force-dynamic';

export default async function Home() {
  // Only fetch data needed for the initial board render. Dashboard widgets,
  // materials, and plans are loaded on the client when their view activates
  // (see loadDashboardData in KanbanBoard.tsx) — keeping them out of the
  // eager Promise.all avoids blocking first paint on the slowest query.
  let projects: Awaited<ReturnType<typeof getProjects>>;
  let settings: Awaited<ReturnType<typeof getSettings>>;
  let columns: Awaited<ReturnType<typeof getColumns>>;
  let ideas: Awaited<ReturnType<typeof getIdeas>>;
  let tags: Awaited<ReturnType<typeof getAllTags>>;
  let projectGroups: Awaited<ReturnType<typeof getAllProjectGroups>>;

  try {
    [projects, settings, columns, ideas, tags, projectGroups] = await Promise.all([
      getProjects(),
      getSettings(),
      getColumns(),
      getIdeas(),
      getAllTags(),
      getAllProjectGroups(),
    ]);
  } catch (err) {
    console.error('[Home] initial data load failed:', err);
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-background overflow-auto p-6">
        <div className="max-w-md space-y-3 text-center">
          <h1 className="text-xl font-semibold tracking-tight">Unable to load the board</h1>
          <p className="text-sm text-muted-foreground">
            The server could not finish loading data. Check your deployment logs for the full error.
            Common causes: missing{' '}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">SUPABASE_SERVICE_ROLE_KEY</code>{' '}
            or other Supabase env vars on the host.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col bg-background overflow-auto">
      <KanbanBoardClient
        initialProjects={projects}
        initialSettings={settings}
        initialColumns={columns}
        initialIdeas={ideas}
        initialTags={tags}
        initialProjectGroups={projectGroups}
        initialWidgets={[]}
        initialMaterials={[]}
        initialPlans={[]}
      />
    </main>
  );
}
