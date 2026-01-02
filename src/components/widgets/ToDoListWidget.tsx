'use client';

import { useState } from 'react';
import { CheckCircle2, Circle, Settings2, ExternalLink, FolderKanban } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toggleProjectCompletion } from '@/app/actions';
import { useRouter } from 'next/navigation';
import type { Project } from '@/components/kanban/KanbanBoard';
import { ScrollFade } from './ScrollFade';
import { useDragHandle } from './WidgetsSection';

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
  const router = useRouter();
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
      return project.parentProjectId === widget.config.filterId;
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
    router.refresh();
    onRefresh?.();
  };

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden group flex flex-col h-full">
      {/* Header - draggable */}
      <div 
        className="px-4 py-3 border-b bg-muted/30 flex-shrink-0 cursor-grab active:cursor-grabbing"
        {...dragListeners}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {filterMeta && (
              <>
                {('emoji' in filterMeta && filterMeta.emoji) ? (
                  <span className="text-lg">{filterMeta.emoji}</span>
                ) : (
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: filterMeta.color }}
                  />
                )}
              </>
            )}
            <h3 className="font-semibold text-sm">{widget.title}</h3>
          </div>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={onEdit}
              title="Widget settings"
            >
              <Settings2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
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
          <div className="p-4 text-center text-muted-foreground text-sm">
            No tasks found
          </div>
        ) : (
          <ul className="divide-y">
            {displayProjects.map(project => (
              <li 
                key={project.id} 
                className={cn(
                  "flex items-center gap-3 px-4 py-2.5 hover:bg-muted/30 transition-colors cursor-pointer group/item",
                  isProjectDone(project) && "bg-muted/20"
                )}
                onClick={() => handleProjectClick(project)}
              >
                <button
                  className="flex-shrink-0 focus:outline-none"
                  onClick={(e) => handleToggleComplete(project, e)}
                >
                  {isProjectDone(project) ? (
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                  ) : (
                    <Circle className="h-5 w-5 text-muted-foreground hover:text-primary transition-colors" />
                  )}
                </button>
                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                  <FolderKanban className="h-3 w-3 text-muted-foreground/50 flex-shrink-0" />
                  <span className={cn(
                    "text-sm truncate",
                    isProjectDone(project) && "line-through text-muted-foreground"
                  )}>
                    {project.title}
                  </span>
                </div>
                <ExternalLink className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover/item:opacity-100 transition-opacity flex-shrink-0" />
              </li>
            ))}
          </ul>
        )}
      </ScrollFade>
    </div>
  );
}

