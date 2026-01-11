'use client';

import { useState, useMemo } from 'react';
import { Settings2, ExternalLink, FolderKanban, ListTodo, ArrowUpDown, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import type { Project } from '@/components/kanban/KanbanBoard';
import { ScrollFade } from './ScrollFade';
import { useDragHandle } from './WidgetsSection';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

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

type ActiveProjectsWidgetProps = {
  widget: {
    id: string;
    title: string;
    config: {
      showType: 'all' | 'projects' | 'tasks';
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

type SortOption = 'title' | 'created' | 'updated' | 'column';
type FilterOption = 'all' | string; // 'all' or tag name or project group id

export function ActiveProjectsWidget({
  widget,
  projects,
  columns,
  tags,
  projectGroups,
  onEdit,
  onProjectClick,
  onRefresh,
}: ActiveProjectsWidgetProps) {
  const router = useRouter();
  const dragListeners = useDragHandle();
  const [sortBy, setSortBy] = useState<SortOption>('updated');
  const [filterBy, setFilterBy] = useState<FilterOption>('all');
  const [filterType, setFilterType] = useState<'all' | 'tag' | 'group'>('all');

  // Find completed column
  const doneColumn = columns.find(c => 
    c.title.toLowerCase() === 'done' || 
    c.title.toLowerCase() === 'completed'
  );

  // Filter and sort projects
  const displayProjects = useMemo(() => {
    let filtered = projects.filter(p => {
      // Filter by completion status
      if (p.isCompleted === true) return false;
      if (doneColumn && p.status === doneColumn.id) return false;

      // Filter by project/task type
      if (widget.config.showType === 'projects' && p.isTask === true) return false;
      if (widget.config.showType === 'tasks' && p.isTask !== true) return false;

      // Filter by tag or project group
      if (filterType === 'tag' && filterBy !== 'all') {
        return p.tags?.includes(filterBy);
      }
      if (filterType === 'group' && filterBy !== 'all') {
        return p.parentProjectId === filterBy;
      }

      return true;
    });

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'title':
          return a.title.localeCompare(b.title);
        case 'created':
          return (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0);
        case 'updated':
          return (b.updatedAt?.getTime() || 0) - (a.updatedAt?.getTime() || 0);
        case 'column':
          const aCol = columns.find(c => c.id === a.status);
          const bCol = columns.find(c => c.id === b.status);
          return (aCol?.order || 0) - (bCol?.order || 0);
        default:
          return 0;
      }
    });

    return filtered;
  }, [projects, widget.config.showType, sortBy, filterBy, filterType, doneColumn, columns]);

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

  const handleFilterTypeChange = (type: 'all' | 'tag' | 'group') => {
    setFilterType(type);
    setFilterBy('all');
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
            <h3 className="font-semibold text-sm">{widget.title}</h3>
            <Badge variant="secondary" className="text-xs">
              {displayProjects.length}
            </Badge>
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
          {widget.config.showType === 'all' && 'All active items'}
          {widget.config.showType === 'projects' && 'Active projects only'}
          {widget.config.showType === 'tasks' && 'Active tasks only'}
        </p>
      </div>

      {/* Filters & Sort */}
      <div className="px-4 py-2 border-b bg-muted/10 flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1 flex-1 min-w-[150px]">
          <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          <Select value={filterType} onValueChange={handleFilterTypeChange}>
            <SelectTrigger className="h-7 text-xs border-none shadow-none">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="tag">By Tag</SelectItem>
              <SelectItem value="group">By Group</SelectItem>
            </SelectContent>
          </Select>
          {filterType === 'tag' && (
            <Select value={filterBy} onValueChange={setFilterBy}>
              <SelectTrigger className="h-7 text-xs">
                <SelectValue placeholder="Select tag" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Tags</SelectItem>
                {tags.map(tag => (
                  <SelectItem key={tag.name} value={tag.name}>
                    <div className="flex items-center gap-2">
                      {tag.emoji && <span>{tag.emoji}</span>}
                      <span>{tag.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {filterType === 'group' && (
            <Select value={filterBy} onValueChange={setFilterBy}>
              <SelectTrigger className="h-7 text-xs">
                <SelectValue placeholder="Select group" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Groups</SelectItem>
                {projectGroups.map(group => (
                  <SelectItem key={group.id} value={group.id}>
                    <div className="flex items-center gap-2">
                      {group.emoji && <span>{group.emoji}</span>}
                      <span>{group.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        <div className="flex items-center gap-1">
          <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
            <SelectTrigger className="h-7 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="updated">Recent</SelectItem>
              <SelectItem value="created">Newest</SelectItem>
              <SelectItem value="title">A-Z</SelectItem>
              <SelectItem value="column">By Column</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Items */}
      <ScrollFade>
        {displayProjects.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground text-sm">
            No active {widget.config.showType === 'all' ? 'items' : widget.config.showType} found
          </div>
        ) : (
          <ul className="divide-y">
            {displayProjects.map(project => {
              const column = columns.find(c => c.id === project.status);
              const projectGroup = project.parentProjectId 
                ? projectGroups.find(g => g.id === project.parentProjectId)
                : null;

              return (
                <li 
                  key={project.id} 
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/30 transition-colors cursor-pointer group/item"
                  onClick={() => handleProjectClick(project)}
                >
                  <div className="flex items-center gap-1.5 flex-1 min-w-0">
                    {project.isTask ? (
                      <ListTodo className="h-3.5 w-3.5 text-blue-600/60 flex-shrink-0" />
                    ) : (
                      <FolderKanban className="h-3.5 w-3.5 text-muted-foreground/50 flex-shrink-0" />
                    )}
                    <span className="text-sm truncate font-medium">
                      {project.title}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {projectGroup && (
                      <Badge variant="outline" className="text-xs h-5 px-1.5">
                        {projectGroup.emoji && <span className="mr-1">{projectGroup.emoji}</span>}
                        {projectGroup.name}
                      </Badge>
                    )}
                    {column && (
                      <Badge variant="secondary" className="text-xs h-5 px-1.5">
                        {column.title}
                      </Badge>
                    )}
                    <ExternalLink className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover/item:opacity-100 transition-opacity" />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </ScrollFade>
    </div>
  );
}

