import { getProjects, getSettings, getColumns } from '@/app/actions';
import { KanbanBoardEmbedClient } from '@/components/kanban/KanbanBoardEmbedClient';

export const dynamic = 'force-dynamic';

export default async function EmbedPage() {
  const projects = await getProjects();
  const settings = await getSettings();
  const columns = await getColumns();

  return (
    <main className="flex min-h-screen flex-col bg-background overflow-hidden">
      <KanbanBoardEmbedClient initialProjects={projects} initialSettings={settings} initialColumns={columns} />
    </main>
  );
}

