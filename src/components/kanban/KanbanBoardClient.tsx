'use client';

import dynamic from 'next/dynamic';
import type { Project, SettingsData, Column } from './KanbanBoard';

// Import KanbanBoard dynamically with no SSR to avoid hydration issues with localStorage
const KanbanBoard = dynamic(
  () => import('./KanbanBoard').then(mod => ({ default: mod.KanbanBoard })),
  { ssr: false }
);

type KanbanBoardClientProps = {
  initialProjects: any[];
  initialSettings: SettingsData;
  initialColumns: Column[];
};

export function KanbanBoardClient(props: KanbanBoardClientProps) {
  return <KanbanBoard {...props} />;
}

