'use client';

import dynamic from 'next/dynamic';
import type { Project, SettingsData, Column } from './KanbanBoard';

function KanbanSkeleton() {
  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b">
        <div className="h-6 w-40 bg-muted animate-pulse rounded" />
        <div className="ml-auto flex gap-2">
          <div className="h-8 w-8 bg-muted animate-pulse rounded" />
          <div className="h-8 w-8 bg-muted animate-pulse rounded" />
        </div>
      </div>
      {/* Tabs */}
      <div className="px-4 py-2 border-b flex gap-2">
        {[120, 100, 80, 70, 90, 100].map((w, i) => (
          <div key={i} className={`h-8 w-[${w}px] bg-muted animate-pulse rounded`} style={{ width: w }} />
        ))}
      </div>
      {/* Toolbar */}
      <div className="flex items-center justify-end gap-2 px-4 py-2 border-b">
        <div className="h-8 w-28 bg-muted animate-pulse rounded" />
        <div className="h-8 w-28 bg-muted animate-pulse rounded" />
      </div>
      {/* Columns */}
      <div className="flex gap-4 p-4 flex-1 overflow-hidden">
        {[3, 2, 4, 1].map((cardCount, i) => (
          <div key={i} className="flex flex-col w-60 shrink-0 gap-3 rounded-lg bg-neutral-100 dark:bg-neutral-900 p-3">
            <div className="h-5 w-24 bg-muted animate-pulse rounded" />
            {Array.from({ length: cardCount }).map((_, j) => (
              <div key={j} className="h-16 w-full bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// Import KanbanBoard dynamically with no SSR to avoid hydration issues with localStorage
const KanbanBoard = dynamic(
  () => import('./KanbanBoard').then(mod => ({ default: mod.KanbanBoard })),
  { ssr: false, loading: () => <KanbanSkeleton /> }
);

type KanbanBoardClientProps = {
  initialProjects: Record<string, unknown>[];
  initialSettings: SettingsData;
  initialColumns: Column[];
  initialIdeas: Record<string, unknown>[];
};

export function KanbanBoardClient(props: KanbanBoardClientProps) {
  return <KanbanBoard {...props} />;
}
