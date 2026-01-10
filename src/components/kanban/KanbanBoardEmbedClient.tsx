'use client';

import dynamic from 'next/dynamic';
import type { Project, SettingsData, Column } from './KanbanBoard';

const KanbanBoardEmbed = dynamic(
  () => import('./KanbanBoardEmbed').then(mod => ({ default: mod.KanbanBoardEmbed })),
  { ssr: false }
);

type KanbanBoardEmbedClientProps = {
  initialProjects: Project[];
  initialSettings: SettingsData;
  initialColumns: Column[];
};

export function KanbanBoardEmbedClient({ initialProjects, initialSettings, initialColumns }: KanbanBoardEmbedClientProps) {
  return (
    <KanbanBoardEmbed initialProjects={initialProjects} initialSettings={initialSettings} initialColumns={initialColumns} />
  );
}

