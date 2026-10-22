'use client';

import { useState } from 'react';
import { CheckCircle2, Circle, Settings2, ExternalLink, FolderKanban } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toggleProjectCompletion } from '@/app/actions';
import type { Project } from '@/components/kanban/KanbanBoard';
import { ScrollFade } from './ScrollFade';
import { useDragHandle } from './WidgetsSection';
import { isInProjectGroup } from '@/lib/project-groups';
import styles from './ToDoListWidget.module.css';

type Tag = {
  name: string;
  color: string;
  emoji?: string;
};

type ProjectGroup = {
  id: string;
  name: string;
  color: string;
  emoji?: string;
  tags?: string[];
  matchMode?: 'any' | 'all';
};

type Column = {
  id: string;
  title: string;
  order: number;
};

type ToDoListWidgetProps = {
  widget: {
    id: string;
    title: string;
    config: {
      filterType: 'all' | 'tag' | 'project-group';
      filterId?: string;
      showCompleted: boolean;
    };
  };
  projects: Project[];
  columns: Column[];
  tags: Tag[];
  projectGroups: ProjectGroup[];
  onEdit: () => void;
  onProjectClick: (project: Project) => void;
  onRefresh?: () => void;
};

export function ToDoListWidget({
  widget,
  projects,
  columns,
  tags,
  projectGroups,
  onEdit,
  onProjectClick,
  onRefresh,
}: ToDoListWidgetProps) {
  const dragListeners = useDragHandle();

  // Find the Done column
  const doneColumn = columns.find(c => 
    c.title.toLowerCase() === 'done' || 
    c.title.toLowerCase() === 'completed'
  );

  // Helper to check if a project is completed
  const isProjectDone = (project: Project) => {
    return doneColumn ? project.status === doneColumn.id : false;
  };

  // Filter projects based on widget config
  const filteredProjects = projects.filter(project => {
    if (widget.config.filterType === 'all') {
      return true; // Show all projects
    } else if (widget.config.filterType === 'tag') {
      return project.tags?.includes(widget.config.filterId || '');
    } else {
      const group = projectGroups.find(g => g.id === widget.config.filterId);
      return group ? isInProjectGroup(project.tags, group) : false;
    }
  });

  // Separate completed (done) and incomplete projects
  const incompleteProjects = filteredProjects.filter(p => !isProjectDone(p));
  const completedProjects = filteredProjects.filter(p => isProjectDone(p));

  const displayProjects = widget.config.showCompleted 
    ? [...incompleteProjects, ...completedProjects]
    : incompleteProjects;

  // Get the filter metadata for display
  const filterMeta = widget.config.filterType === 'all'
    ? null
    : widget.config.filterType === 'tag'
    ? tags.find(t => t.name === widget.config.filterId)
    : projectGroups.find(g => g.id === widget.config.filterId);

  // Track project as recently opened
  const trackRecentProject = (projectId: string) => {
    try {
      const recent = localStorage.getItem('recentProjects');
      const recentIds = recent ? JSON.parse(recent) : [];
      const updated = [projectId, ...recentIds.filter((id: string) => id !== projectId)].slice(0, 10);
      localStorage.setItem('recentProjects', JSON.stringify(updated));
    } catch (error) {
      console.error('Failed to track recent project:', error);
    }
  };

  const handleProjectClick = (project: Project) => {
    trackRecentProject(project.id);
    onProjectClick(project);
  };

  const handleToggleComplete = async (project: Project, e: React.MouseEvent) => {
    e.stopPropagation();
    await toggleProjectCompletion(project.id, project.status);
    onRefresh?.();
  };

  return (
    <div className={styles.Root}>
      {/* Header - draggable */}
      <div 
        className={styles.Header}
        {...dragListeners}
      >
        <div className={styles.HeaderRow}>
          <div className={styles.TitleGroup}>
            {filterMeta && (
              <>
                {('emoji' in filterMeta && filterMeta.emoji) ? (
                  <span className={styles.Emoji}>{filterMeta.emoji}</span>
                ) : (
                  <div 
                    className={styles.Swatch} 
                    style={{ backgroundColor: filterMeta.color }}
                  />
                )}
              </>
            )}
            <h3 className={styles.Title}>{widget.title}</h3>
          </div>
          <div className={styles.HeaderActions}>
            <Button
              variant="ghost"
              size="sm"
              className={styles.IconButton}
              onClick={onEdit}
              title="Widget settings"
            >
              <Settings2 className={styles.ButtonIcon} />
            </Button>
          </div>
        </div>
        <p className={styles.Subtitle}>
          {widget.config.filterType === 'all' 
            ? 'All projects' 
            : filterMeta
            ? (widget.config.filterType === 'tag' 
              ? `Projects tagged "${filterMeta.name}"` 
              : `Projects in "${filterMeta.name}"`)
            : 'No filter selected'
          }
        </p>
      </div>

      {/* Items */}
      <ScrollFade>
        {displayProjects.length === 0 ? (
          <div className={styles.Empty}>
            No tasks found
          </div>
        ) : (
          <ul className={styles.List}>
            {displayProjects.map(project => (
              <li 
                key={project.id} 
                className={cn(styles.Item, isProjectDone(project) && styles.ItemDone)}
                onClick={() => handleProjectClick(project)}
              >
                <button
                  className={styles.Toggle}
                  onClick={(e) => handleToggleComplete(project, e)}
                >
                  {isProjectDone(project) ? (
                    <CheckCircle2 className={styles.DoneIcon} />
                  ) : (
                    <Circle className={styles.CircleIcon} />
                  )}
                </button>
                <div className={styles.Label}>
                  <FolderKanban className={styles.FolderIcon} />
                  <span className={cn(styles.ItemTitle, isProjectDone(project) && styles.ItemTitleDone)}>
                    {project.title}
                  </span>
                </div>
                <ExternalLink className={styles.OpenIcon} />
              </li>
            ))}
          </ul>
        )}
      </ScrollFade>
    </div>
  );
}

