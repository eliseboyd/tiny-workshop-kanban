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
import { isInProjectGroup } from '@/lib/project-groups';
import styles from './TagLaneBoardWidget.module.css';

type Tag = { name: string; color: string; emoji?: string };
type ProjectGroup = { id: string; name: string; color: string; emoji?: string; tags?: string[]; matchMode?: 'any' | 'all' };
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
  projectGroups: ProjectGroup[],
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
      const group = projectGroups.find((g) => g.id === config.filterId);
      return group ? isInProjectGroup(p.tags, group) : false;
    });

    const sorted = [...filtered].sort((a, b) => {
      const aTodo = a.status === lanes.todoColumn.id ? 0 : 1;
      const bTodo = b.status === lanes.todoColumn.id ? 0 : 1;
      if (aTodo !== bTodo) return aTodo - bTodo;
      return (a.position ?? 0) - (b.position ?? 0);
    });

    return { lanes, items: sorted };
  }, [projects, columns, projectGroups, config.filterType, config.filterId]);
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
      className={styles.Card}
    >
      <div
        className={cn(styles.Media, compact && styles.MediaCompact)}
      >
        {img ? (
          <Image
            src={img}
            alt=""
            fill
            className={styles.Image}
            sizes={compact ? '120px' : '(max-width:768px) 50vw, 200px'}
          />
        ) : (
          <div
            className={styles.Pattern}
            aria-hidden
          />
        )}
      </div>
      <div className={cn(styles.Body, compact && styles.BodyCompact)}>
        <div className={styles.TitleRow}>
          <span
            className={cn(styles.ThumbTitle, compact && styles.ThumbTitleCompact)}
          >
            {project.title}
          </span>
          {project.isTask ? (
            <ListTodo className={styles.KindIcon} />
          ) : (
            <FolderKanban className={styles.KindIcon} />
          )}
        </div>
        <Badge variant="secondary" className={cn(styles.LaneBadge, compact && styles.LaneBadgeCompact)}>
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

  const { lanes, items } = useFilteredLaneProjects(projects, columns, projectGroups, config);

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
    <div className={styles.Root}>
      {accentColor ? (
        <div
          className={styles.AccentBar}
          style={{ backgroundColor: accentColor }}
          aria-hidden
        />
      ) : null}
      <div className={styles.Main}>
      <div
        className={styles.Header}
        {...dragListeners}
      >
        <div className={styles.HeaderRow}>
          <div className={styles.HeaderLead}>
            {accentEmoji ? (
              <span className={styles.Emoji} aria-hidden>
                {accentEmoji}
              </span>
            ) : (
              renderTagLaneAccentIcon(accentLucide, styles.AccentIcon)
            )}
            <div className={styles.HeaderText}>
              <div className={styles.TitleLine}>
                <h3 className={styles.Title}>{widget.title}</h3>
                <Badge variant="secondary" className={styles.CountBadge}>
                  {items.length}
                </Badge>
              </div>
              {config.accentHeadline ? (
                <p className={cn(styles.Subtitle, styles.SubtitleTruncate)}>{config.accentHeadline}</p>
              ) : filterMeta ? (
                <p className={cn(styles.Subtitle, styles.SubtitleTruncate)}>
                  {config.filterType === 'tag' ? `#${config.filterId}` : filterMeta.name}
                </p>
              ) : (
                <p className={styles.Subtitle}>
                  {viewMode === 'mini-kanban' ? 'Mini board' : 'Card view'}
                </p>
              )}
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className={styles.SettingsButton}
            onClick={onEdit}
            title="Widget settings"
          >
            <Settings2 className={styles.SettingsIcon} />
          </Button>
        </div>
        <p className={styles.Note}>
          {viewMode === 'mini-kanban' ? (
            <Columns2 className={styles.NoteIcon} />
          ) : (
            <LayoutGrid className={styles.NoteIcon} />
          )}
          To do and in progress only. Column titles like &ldquo;To do&rdquo; and &ldquo;In progress&rdquo; improve detection.
        </p>
      </div>

      <div className={styles.Content}>
      {!lanes ? (
        <div className={styles.NoLanes}>
          Add board columns to use this widget.
        </div>
      ) : viewMode === 'mini-kanban' ? (
        <div className={styles.Lanes}>
          <div className={styles.Lane}>
            <div className={styles.LaneHeader}>
              {lanes.todoColumn.title}
            </div>
            <ScrollFade className={styles.LaneScroll}>
              <div className={styles.LaneList}>
                {todoList.length === 0 ? (
                  <p className={styles.LaneEmpty}>Empty</p>
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
          <div className={styles.Lane}>
            <div className={styles.LaneHeader}>
              {lanes.inProgressColumn.title}
            </div>
            <ScrollFade className={styles.LaneScroll}>
              <div className={styles.LaneList}>
                {inProgressList.length === 0 ? (
                  <p className={styles.LaneEmpty}>Empty</p>
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
            <div className={styles.NoItems}>
              No projects in To do or In progress for this filter.
            </div>
          ) : (
            <div className={styles.Grid}>
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
