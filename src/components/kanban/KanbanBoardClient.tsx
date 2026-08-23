'use client';

import dynamic from 'next/dynamic';
import type { SettingsData, Column } from './KanbanBoard';
import type { StandalonePlan } from '@/app/actions';
import { KanbanSkeleton } from './KanbanSkeleton';

// Render KanbanBoard on the server so first paint shows real content. The
// localStorage-backed settings (active tab, hidden columns) defer their real
// value to a post-mount read in useLocalStorage to avoid hydration mismatches.
const KanbanBoard = dynamic(
  () => import('./KanbanBoard').then(mod => ({ default: mod.KanbanBoard })),
  { loading: () => <KanbanSkeleton /> }
);

type KanbanBoardClientProps = {
  initialProjects: Record<string, unknown>[];
  initialSettings: SettingsData;
  initialColumns: Column[];
  initialIdeas: Record<string, unknown>[];
  initialTags: unknown[];
  initialProjectGroups: unknown[];
  initialWidgets: unknown[];
  initialMaterials: unknown[];
  initialPlans: Array<StandalonePlan & { source: 'standalone' | 'project' }>;
};

export function KanbanBoardClient(props: KanbanBoardClientProps) {
  return <KanbanBoard {...props} />;
}
