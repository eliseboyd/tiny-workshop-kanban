'use client';

import { useState, useContext, useRef, useEffect } from 'react';
import { Calendar, Settings2, X, GripVertical, Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { updateWidget } from '@/app/actions';
import { useRouter } from 'next/navigation';
import { DragHandleContext } from './WidgetsSection';
import { ScrollFade } from './ScrollFade';
import type { Project } from '@/components/kanban/KanbanBoard';

type Column = {
  id: string;
  title: string;
};

type DayPlanWidgetProps = {
  widget: {
    id: string;
    title: string;
    config: {
      projectIds?: string[];
    };
  };
  projects: Project[];
  columns?: Column[];
  onEdit: () => void;
  onProjectClick: (project: Project) => void;
  onRefresh?: () => void;
};

export function DayPlanWidget({ widget, projects, columns = [], onEdit, onProjectClick, onRefresh }: DayPlanWidgetProps) {
  const router = useRouter();
  const dragListeners = useContext(DragHandleContext);
  
  const projectIds = widget.config.projectIds || [];
  const dayProjects = projectIds
    .map(id => projects.find(p => p.id === id))
    .filter((p): p is Project => p !== undefined);

  // Check if a project is in the Done column
  const isProjectDone = (project: Project) => {
    const doneColumn = columns.find(c => 
      c.title.toLowerCase() === 'done' || 
      c.title.toLowerCase() === 'completed'
    );
    return doneColumn ? project.status === doneColumn.id : false;
  };

  const [isDragOver, setIsDragOver] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  
  // Get projects not already in the day plan and not completed
  const availableProjects = projects.filter(p => 
    !projectIds.includes(p.id) && !isProjectDone(p)
  );
  
  // Get recently opened projects from localStorage
  const getRecentProjects = () => {
    try {
      const recent = localStorage.getItem('recentProjects');
      return recent ? JSON.parse(recent) : [];
    } catch {
      return [];
    }
  };
  
  // Sort available projects: recently opened first, then by recent updates
  const getSuggestedProjects = () => {
    if (searchQuery) {
      // Filter by search query
      return availableProjects.filter(p =>
        p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.tags?.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    } else {
      // Show recently opened projects first
      const recentIds = getRecentProjects();
      const recentProjects = recentIds
        .map((id: string) => availableProjects.find(p => p.id === id))
        .filter((p: Project | undefined): p is Project => p !== undefined);
      
      const remainingProjects = availableProjects.filter(
        p => !recentIds.includes(p.id)
      );
      
      // Sort remaining by updatedAt if available
      const sortedRemaining = [...remainingProjects].sort((a, b) => {
        if (!a.updatedAt || !b.updatedAt) return 0;
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      });
      
      return [...recentProjects, ...sortedRemaining];
    }
  };
  
  const filteredProjects = getSuggestedProjects();
  
  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  // Track project as recently opened
  const trackRecentProject = (projectId: string) => {
    try {
      const recent = getRecentProjects();
      const updated = [projectId, ...recent.filter((id: string) => id !== projectId)].slice(0, 10);
      localStorage.setItem('recentProjects', JSON.stringify(updated));
    } catch (error) {
      console.error('Failed to track recent project:', error);
    }
  };

  // Handle project click with tracking
  const handleProjectClick = (project: Project) => {
    trackRecentProject(project.id);
    onProjectClick(project);
  };

  // Add project from search
  const handleAddProject = async (projectId: string) => {
    if (!projectId || projectIds.includes(projectId)) return;
    
    try {
      const newProjectIds = [...projectIds, projectId];
      await updateWidget(widget.id, {
        config: { ...widget.config, projectIds: newProjectIds }
      });
      setSearchQuery('');
      setShowSuggestions(false);
      router.refresh();
      onRefresh?.();
    } catch (error) {
      console.error('Failed to add project to day plan:', error);
    }
  };

  // Handle drag over
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Check if this is a project card being dragged
    const dragData = e.dataTransfer.types;
    if (dragData.includes('application/project-card')) {
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  // Handle drop
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    try {
      const projectId = e.dataTransfer.getData('application/project-card');
      if (projectId && !projectIds.includes(projectId)) {
        const newProjectIds = [...projectIds, projectId];
        await updateWidget(widget.id, {
          config: { ...widget.config, projectIds: newProjectIds }
        });
        router.refresh();
      }
    } catch (error) {
      console.error('Failed to add project to day plan:', error);
    }
  };

  // Remove project from day plan
  const handleRemoveProject = async (projectId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const newProjectIds = projectIds.filter(id => id !== projectId);
      await updateWidget(widget.id, {
        config: { ...widget.config, projectIds: newProjectIds }
      });
      router.refresh();
    } catch (error) {
      console.error('Failed to remove project from day plan:', error);
    }
  };

  // Clear all
  const handleClearAll = async () => {
    if (!confirm('Clear all items from day plan?')) return;
    try {
      await updateWidget(widget.id, {
        config: { ...widget.config, projectIds: [] }
      });
      router.refresh();
    } catch (error) {
      console.error('Failed to clear day plan:', error);
    }
  };

  // Format date
  const todayFormatted = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric'
  }).format(new Date());

  return (
    <div 
      className={cn(
        "flex flex-col bg-card rounded-lg border shadow-sm transition-all",
        isDragOver && "ring-2 ring-primary/50 bg-primary/5"
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{ minHeight: '200px' }}
    >
      {/* Header */}
      <div 
        className="flex items-center justify-between px-4 py-3 border-b cursor-move group"
        {...dragListeners}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Calendar className="h-4 w-4 text-primary flex-shrink-0" />
          <h3 className="font-semibold text-sm truncate">{widget.title}</h3>
          <Badge variant="secondary" className="text-xs flex-shrink-0">
            {dayProjects.length}
          </Badge>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {dayProjects.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
              onClick={handleClearAll}
              title="Clear all"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
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

      {/* Subtitle */}
      <div className="px-4 pt-2">
        <p className="text-xs text-muted-foreground">{todayFormatted}</p>
      </div>

      {/* Items */}
      <ScrollFade>
        {dayProjects.length === 0 ? (
          <div className="p-8 text-center">
            <div className="text-muted-foreground/50 mb-2">
              <Calendar className="h-12 w-12 mx-auto mb-3 opacity-30" />
            </div>
            <p className="text-sm text-muted-foreground">
              {isDragOver 
                ? "Drop here to add to plan" 
                : availableProjects.length > 0
                  ? "Add projects below or drag cards here"
                  : "All projects are in your plan!"
              }
            </p>
          </div>
        ) : (
          <ul className="divide-y">
            {dayProjects.map((project, index) => (
              <li
                key={project.id}
                className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/30 transition-colors cursor-pointer group/item"
                onClick={() => handleProjectClick(project)}
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="text-xs text-muted-foreground w-4 flex-shrink-0">
                    {index + 1}
                  </span>
                  <span className={cn(
                    "text-sm truncate",
                    isProjectDone(project) && "line-through text-muted-foreground"
                  )}>
                    {project.title}
                  </span>
                </div>
                {project.tags && project.tags.length > 0 && (
                  <div className="flex gap-1 flex-shrink-0">
                    {project.tags.slice(0, 2).map(tag => (
                      <Badge key={tag} variant="secondary" className="text-[9px] h-4 px-1 rounded-sm">
                        {tag}
                      </Badge>
                    ))}
                    {project.tags.length > 2 && (
                      <Badge variant="secondary" className="text-[9px] h-4 px-1 rounded-sm">
                        +{project.tags.length - 2}
                      </Badge>
                    )}
                  </div>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 opacity-0 group-hover/item:opacity-100 transition-opacity flex-shrink-0"
                  onClick={(e) => handleRemoveProject(project.id, e)}
                  title="Remove from plan"
                >
                  <X className="h-3 w-3" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </ScrollFade>

      {/* Add Project Footer with Search */}
      {availableProjects.length > 0 && (
        <div className="border-t bg-muted/10 px-3 py-2 flex-shrink-0" ref={searchRef}>
          <div className="relative">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <Input
                type="text"
                placeholder="Search projects..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
                className="h-9 text-sm pl-9 pr-3"
              />
            </div>
            
            {/* Autocomplete Suggestions */}
            {showSuggestions && filteredProjects.length > 0 && (
              <div className="absolute bottom-full left-0 right-0 mb-1 bg-popover border rounded-md shadow-lg max-h-[200px] overflow-auto z-50">
                {!searchQuery && getRecentProjects().length > 0 && (
                  <div className="px-3 py-1.5 text-[10px] text-muted-foreground uppercase tracking-wider font-semibold border-b bg-muted/30">
                    Recent
                  </div>
                )}
                {filteredProjects.slice(0, 5).map(project => (
                  <button
                    key={project.id}
                    onClick={() => handleAddProject(project.id)}
                    className="w-full text-left px-3 py-2 hover:bg-muted/50 transition-colors text-sm border-b last:border-b-0"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium truncate">{project.title}</span>
                      {project.tags && project.tags.length > 0 && (
                        <div className="flex gap-1 flex-shrink-0">
                          {project.tags.slice(0, 2).map((tag: string) => (
                            <Badge key={tag} variant="secondary" className="text-[9px] h-4 px-1 rounded-sm">
                              {tag}
                            </Badge>
                          ))}
                          {project.tags.length > 2 && (
                            <Badge variant="secondary" className="text-[9px] h-4 px-1 rounded-sm">
                              +{project.tags.length - 2}
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                  </button>
                ))}
                {filteredProjects.length > 5 && (
                  <div className="px-3 py-2 text-xs text-muted-foreground text-center border-t">
                    +{filteredProjects.length - 5} more...
                  </div>
                )}
              </div>
            )}
            
            {/* No results message */}
            {showSuggestions && searchQuery && filteredProjects.length === 0 && (
              <div className="absolute bottom-full left-0 right-0 mb-1 bg-popover border rounded-md shadow-lg p-3 z-50">
                <p className="text-sm text-muted-foreground text-center">
                  No projects found
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

