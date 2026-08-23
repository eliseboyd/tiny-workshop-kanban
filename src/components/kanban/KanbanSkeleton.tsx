// Pure-markup skeleton shared by app/loading.tsx (streamed while server data
// loads) and KanbanBoardClient (shown while the board chunk loads).
// No 'use client' — usable from both server and client components.
export function KanbanSkeleton() {
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
          <div key={i} className="h-8 bg-muted animate-pulse rounded" style={{ width: w }} />
        ))}
      </div>
      {/* Toolbar */}
      <div className="flex items-center justify-end gap-2 px-4 py-2 border-b">
        <div className="h-8 w-28 bg-muted animate-pulse rounded" />
        <div className="h-8 w-28 bg-muted animate-pulse rounded" />
      </div>
      {/* Columns — widths mirror KanbanColumn (w-[85vw] on mobile, w-60 on
          desktop) so the real board lands without layout shift. */}
      <div className="flex gap-4 p-4 flex-1 overflow-hidden">
        {[3, 2, 4, 1].map((cardCount, i) => (
          <div key={i} className="flex flex-col w-[85vw] md:w-60 md:min-w-[240px] shrink-0 gap-3 rounded-lg bg-muted p-3">
            <div className="h-5 w-24 bg-muted-foreground/10 animate-pulse rounded" />
            {Array.from({ length: cardCount }).map((_, j) => (
              <div key={j} className="h-16 w-full bg-muted-foreground/10 animate-pulse rounded-lg" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
