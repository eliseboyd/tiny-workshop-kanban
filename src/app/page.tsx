import { KanbanBoardClient } from '@/components/kanban/KanbanBoardClient';
import { getProjects, getSettings, getColumns, getIdeas, getAllTags, getAllProjectGroups } from '@/app/actions';

// Ensure dynamic rendering so we get fresh data from Supabase on every load
export const dynamic = 'force-dynamic';

export default async function Home() {
  // Only fetch data needed for the initial board render. Dashboard widgets,
  // materials, and plans are loaded on the client when their view activates
  // (see loadDashboardData in KanbanBoard.tsx) — keeping them out of the
  // eager Promise.all avoids blocking first paint on the slowest query.
  const [projects, settings, columns, ideas, tags, projectGroups] = await Promise.all([
    getProjects(),
    getSettings(),
    getColumns(),
    getIdeas(),
    getAllTags(),
    getAllProjectGroups(),
  ]);

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
