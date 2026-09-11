'use client';

import { KanbanBoard } from './KanbanBoard';
import type { SettingsData, Column } from './KanbanBoard';
import type { StandalonePlan } from '@/app/actions';

// A plain import, deliberately. This used to be next/dynamic with a loading
// skeleton so the board was code-split; but on the server dynamic() renders
// its Lazy child beside a PreloadChunks sibling that the client never renders,
// which shifts React's useId tree for everything inside the board. Every
// Radix id (the Sheet trigger, the tabs) then hydrated with a mismatch warning
// on each load. The board is this page's whole content, so there is nothing
// to gain from splitting it off; its heavy views are still lazy-loaded
// individually inside KanbanBoard. The localStorage-backed settings (active
// tab, hidden columns) still defer their real value to a post-mount read in
// useLocalStorage, so the server and first client render agree.

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
