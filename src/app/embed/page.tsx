import { getProjects, getSettings, getColumns } from '@/app/actions';
import { KanbanBoardEmbedClient } from '@/components/kanban/KanbanBoardEmbedClient';
import { cn } from '@/lib/utils';
import styles from './page.module.css';

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
      <main className={cn(styles.Main, styles.ErrorMain)}>
        <div className={styles.ErrorBox}>
          <h1 className={styles.Title}>Unable to load embed</h1>
          <p className={styles.Message}>
            Check deployment logs. Ensure Supabase URL, anon key, and service role key are set on the host.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.Main}>
      <KanbanBoardEmbedClient initialProjects={projects} initialSettings={settings} initialColumns={columns} />
    </main>
  );
}

