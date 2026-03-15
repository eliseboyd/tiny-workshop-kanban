import { KanbanBoardClient } from '@/components/kanban/KanbanBoardClient';
import { getProjects, getSettings, getColumns, getIdeas, getAllTags, getAllProjectGroups, getAllWidgets, getAllMaterials, getAllPlans } from '@/app/actions';

// Ensure dynamic rendering so we get fresh data from Supabase on every load
export const dynamic = 'force-dynamic';

export default async function Home() {
  const [projects, settings, columns, ideas, tags, projectGroups, widgets, materials, plans] = await Promise.all([
    getProjects(),
    getSettings(),
    getColumns(),
    getIdeas(),
    getAllTags(),
    getAllProjectGroups(),
    getAllWidgets(),
    getAllMaterials(),
    getAllPlans(),
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
        initialWidgets={widgets}
        initialMaterials={materials}
        initialPlans={plans}
      />
    </main>
  );
}
