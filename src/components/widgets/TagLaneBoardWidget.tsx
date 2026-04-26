'use client';

import { useMemo } from 'react';
import Image from 'next/image';
import { Settings2, LayoutGrid, Columns2, FolderKanban, ListTodo } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { Project } from '@/components/kanban/KanbanBoard';
import { ScrollFade } from './ScrollFade';
import { useDragHandle } from './WidgetsSection';
import { resolveWorkflowLanes, findDoneColumn } from '@/lib/board-columns';
import { renderTagLaneAccentIcon } from '@/lib/tag-lane-accent-icons';

type Tag = { name: string; color: string; emoji?: string };
type ProjectGroup = { id: string; name: string; color: string; emoji?: string };
type Column = { id: string; title: string; order: number };

export type TagLaneBoardConfig = {
  filterType: 'tag' | 'project-group';
  filterId: string;
  viewMode: 'cards' | 'mini-kanban';
  accentHeadline?: string;
  accentColor?: string;
  accentEmoji?: string;
  accentLucide?: string;
};

type TagLaneBoardWidgetProps = {
  widget: {
    id: string;
    title: string;
    config: TagLaneBoardConfig & Record<string, unknown>;
  };
  projects: Project[];
  columns: Column[];
  tags: Tag[];
  projectGroups: ProjectGroup[];
  onEdit: () => void;
  onProjectClick: (project: Project) => void;
  onRefresh?: () => void;
};

function useFilteredLaneProjects(
  projects: Project[],
  columns: Column[],
  config: TagLaneBoardConfig
) {
  return useMemo(() => {
    const lanes = resolveWorkflowLanes(columns);
    if (!lanes) return { lanes: null as null, items: [] as Project[] };

    const doneCol = findDoneColumn(columns);

    const filtered = projects.filter((p) => {
      if (p.isIdea) return false;
      if (p.isCompleted === true) return false;
      if (doneCol && p.status === doneCol.id) return false;
      const inLane =
        p.status === lanes.todoColumn.id || p.status === lanes.inProgressColumn.id;
      if (!inLane) return false;
      if (config.filterType === 'tag') {
        return p.tags?.includes(config.filterId) ?? false;
      }
      return p.parentProjectId === config.filterId;
    });

    const sorted = [...filtered].sort((a, b) => {
      const aTodo = a.status === lanes.todoColumn.id ? 0 : 1;
      const bTodo = b.status === lanes.todoColumn.id ? 0 : 1;
      if (aTodo !== bTodo) return aTodo - bTodo;
      return (a.position ?? 0) - (b.position ?? 0);
    });

    return { lanes, items: sorted };
  }, [projects, columns, config.filterType, config.filterId]);
}

function columnBadgeLabel(
  project: Project,
  lanes: NonNullable<ReturnType<typeof resolveWorkflowLanes>>
) {
  if (project.status === lanes.todoColumn.id) return lanes.todoColumn.title;
  if (project.status === lanes.inProgressColumn.id) return lanes.inProgressColumn.title;
  return '';
}

function ProjectThumbCard({
  project,
  lanes,
  compact,
  onClick,
}: {
  project: Project;
  lanes: NonNullable<ReturnType<typeof resolveWorkflowLanes>>;
  compact?: boolean;
  onClick: () => void;
}) {
  const label = columnBadgeLabel(project, lanes);
  const img = project.imageUrl ?? (project as { image_url?: string }).image_url;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group text-left rounded-lg border bg-card overflow-hidden shadow-sm transition-all',
        'hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        compact ? 'w-full' : 'w-full'
      )}
    >
      <div
        className={cn(
          'relative w-full bg-muted/40 overflow-hidden',
          compact ? 'aspect-[2/1]' : 'aspect-video'
        )}
      >
        {img ? (
          <Image
            src={img}
            alt=""
            fill
            className="object-cover"
            sizes={compact ? '120px' : '(max-width:768px) 50vw, 200px'}
          />
        ) : (
          <div
            className="absolute inset-0 opacity-[0.12] bg-[length:12px_12px] bg-[linear-gradient(45deg,transparent_45%,currentColor_45%,currentColor_55%,transparent_55%),linear-gradient(-45deg,transparent_45%,currentColor_45%,currentColor_55%,transparent_55%)]"
            aria-hidden
          />
        )}
      </div>
      <div className={cn('p-2 space-y-1', compact && 'p-1.5')}>
        <div className="flex items-start gap-1.5 justify-between gap-2">
          <span
            className={cn(
              'font-medium text-foreground line-clamp-2 leading-tight',
              compact ? 'text-[11px]' : 'text-xs'
            )}
          >
            {project.title}
          </span>
          {project.isTask ? (
            <ListTodo className="h-3 w-3 text-muted-foreground shrink-0 mt-0.5" />
          ) : (
            <FolderKanban className="h-3 w-3 text-muted-foreground shrink-0 mt-0.5" />
          )}
        </div>
        <Badge variant="secondary" className={cn('text-[10px] h-5 px-1.5 font-normal', compact && 'h-4 text-[9px]')}>
          {label}
        </Badge>
      </div>
    </button>
  );
}

export function TagLaneBoardWidget({
  widget,
  projects,
  columns,
  tags,
  projectGroups,
  onEdit,
  onProjectClick,
}: TagLaneBoardWidgetProps) {
  const dragListeners = useDragHandle();
  const config = widget.config as TagLaneBoardConfig;
  const viewMode = config.viewMode ?? 'cards';

  const { lanes, items } = useFilteredLaneProjects(projects, columns, config);

  const filterMeta =
    config.filterType === 'tag'
      ? tags.find((t) => t.name === config.filterId)
      : projectGroups.find((g) => g.id === config.filterId);

  const accentColor = config.accentColor?.trim() || undefined;
  const accentEmoji = config.accentEmoji?.trim();
  const accentLucide = config.accentLucide?.trim();

  const todoList = useMemo(
    () => (lanes ? items.filter((p) => p.status === lanes.todoColumn.id) : []),
    [items, lanes]
  );
  const inProgressList = useMemo(
    () => (lanes ? items.filter((p) => p.status === lanes.inProgressColumn.id) : []),
    [items, lanes]
  );

  return (
    <div className="flex rounded-xl border bg-card shadow-sm overflow-hidden group h-full">
      {accentColor ? (
        <div
          className="w-[3px] shrink-0 self-stretch"
          style={{ backgroundColor: accentColor }}
          aria-hidden
        />
      ) : null}
      <div className="flex flex-col flex-1 min-w-0 min-h-0">
      <div
        className="px-4 py-3 border-b bg-muted/30 flex-shrink-0 cursor-grab active:cursor-grabbing"
        {...dragListeners}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2 min-w-0">
            {accentEmoji ? (
              <span className="text-lg leading-none shrink-0" aria-hidden>
                {accentEmoji}
              </span>
            ) : (
              renderTagLaneAccentIcon(accentLucide, 'h-5 w-5 shrink-0 text-muted-foreground mt-0.5')
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-sm truncate">{widget.title}</h3>
                <Badge variant="secondary" className="text-xs shrink-0">
                  {items.length}
                </Badge>
              </div>
              {config.accentHeadline ? (
                <p className="text-xs text-muted-foreground mt-0.5 truncate">{config.accentHeadline}</p>
              ) : filterMeta ? (
                <p className="text-xs text-muted-foreground mt-0.5 truncate">
                  {config.filterType === 'tag' ? `#${config.filterId}` : filterMeta.name}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {viewMode === 'mini-kanban' ? 'Mini board' : 'Card view'}
                </p>
              )}
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={onEdit}
            title="Widget settings"
          >
            <Settings2 className="h-3.5 w-3.5" />
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground mt-2 flex items-center gap-1.5">
          {viewMode === 'mini-kanban' ? (
            <Columns2 className="h-3 w-3 shrink-0" />
          ) : (
            <LayoutGrid className="h-3 w-3 shrink-0" />
          )}
          To do and in progress only. Column titles like "To do" and "In progress" improve detection.
        </p>
      </div>

      <div className="flex-1 min-h-0 min-w-0 flex flex-col">
      {!lanes ? (
        <div className="p-4 text-center text-sm text-muted-foreground">
          Add board columns to use this widget.
        </div>
      ) : viewMode === 'mini-kanban' ? (
        <div className="flex flex-1 min-h-0 divide-x min-w-0">
          <div className="flex-1 flex flex-col min-w-0 min-h-0">
            <div className="px-2 py-1.5 text-[11px] font-medium text-muted-foreground border-b bg-muted/20 truncate">
              {lanes.todoColumn.title}
            </div>
            <ScrollFade className="flex-1 min-h-0">
              <div className="p-2 space-y-2">
                {todoList.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">Empty</p>
                ) : (
                  todoList.map((p) => (
                    <ProjectThumbCard
                      key={p.id}
                      project={p}
                      lanes={lanes}
                      compact
                      onClick={() => onProjectClick(p)}
                    />
                  ))
                )}
              </div>
            </ScrollFade>
          </div>
          <div className="flex-1 flex flex-col min-w-0 min-h-0">
            <div className="px-2 py-1.5 text-[11px] font-medium text-muted-foreground border-b bg-muted/20 truncate">
              {lanes.inProgressColumn.title}
            </div>
            <ScrollFade className="flex-1 min-h-0">
              <div className="p-2 space-y-2">
                {inProgressList.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">Empty</p>
                ) : (
                  inProgressList.map((p) => (
                    <ProjectThumbCard
                      key={p.id}
                      project={p}
                      lanes={lanes}
                      compact
                      onClick={() => onProjectClick(p)}
                    />
                  ))
                )}
              </div>
            </ScrollFade>
          </div>
        </div>
      ) : (
        <ScrollFade>
          {items.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              No projects in To do or In progress for this filter.
            </div>
          ) : (
            <div className="p-3 grid grid-cols-2 gap-2 sm:gap-3">
              {items.map((p) => (
                <ProjectThumbCard
                  key={p.id}
                  project={p}
                  lanes={lanes}
                  onClick={() => onProjectClick(p)}
                />
              ))}
            </div>
          )}
        </ScrollFade>
      )}
      </div>
      </div>
    </div>
  );
}
