import { KanbanBoard } from '@/components/kanban/KanbanBoard';
import { getProjects, getSettings, getColumns } from '@/app/actions';

// Ensure dynamic rendering so we get fresh data from Supabase on every load
export const dynamic = 'force-dynamic';

export default async function Home() {
  const projects = await getProjects();
  const settings = await getSettings();
  const columns = await getColumns();

  return (
    <main className="flex h-screen md:min-h-screen md:h-auto flex-col bg-background overflow-auto">
      <KanbanBoard initialProjects={projects} initialSettings={settings} initialColumns={columns} />
    </main>
  );
}
