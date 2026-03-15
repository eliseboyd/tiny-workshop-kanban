import { KanbanBoardClient } from '@/components/kanban/KanbanBoardClient';
import { getProjects, getSettings, getColumns, getIdeas } from '@/app/actions';

// Ensure dynamic rendering so we get fresh data from Supabase on every load
export const dynamic = 'force-dynamic';

export default async function Home() {
  const [projects, settings, columns, ideas] = await Promise.all([
    getProjects(),
    getSettings(),
    getColumns(),
    getIdeas(),
  ]);

  return (
    <main className="flex min-h-screen flex-col bg-background overflow-auto">
      <KanbanBoardClient
        initialProjects={projects}
        initialSettings={settings}
        initialColumns={columns}
        initialIdeas={ideas}
      />
    </main>
  );
}
