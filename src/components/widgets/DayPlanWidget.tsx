'use client';

import { useState, useContext } from 'react';
import { Calendar, Settings2, X, GripVertical, Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Autocomplete,
  AutocompleteContent,
  AutocompleteEmpty,
  AutocompleteInput,
  AutocompleteItem,
  AutocompleteList,
} from '@/components/ui/autocomplete';
import { cn } from '@/lib/utils';
import { updateWidget } from '@/app/actions';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { DragHandleContext } from './WidgetsSection';
import { ScrollFade } from './ScrollFade';
import styles from "./DayPlanWidget.module.css";
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
  const confirmDialog = useConfirm();
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
  const suggestedProjects = filteredProjects.slice(0, 5);
  
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
    } catch (error) {
      console.error('Failed to remove project from day plan:', error);
    }
  };

  // Clear all
  const handleClearAll = async () => {
    const ok = await confirmDialog({
      title: 'Clear day plan?',
      description: 'All items will be removed from the day plan.',
      confirmLabel: 'Clear',
      destructive: true,
    });
    if (!ok) return;
    try {
      await updateWidget(widget.id, {
        config: { ...widget.config, projectIds: [] }
      });
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
      className={cn(styles.Root, isDragOver && styles.RootDragOver)}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{ minHeight: '200px' }}
    >
      {/* Header */}
      <div 
        className={styles.Header}
        {...dragListeners}
      >
        <div className={styles.HeaderTitleGroup}>
          <Calendar className={styles.HeaderIcon} />
          <h3 className={styles.Title}>{widget.title}</h3>
          <Badge variant="secondary" className={styles.CountBadge}>
            {dayProjects.length}
          </Badge>
        </div>
        <div className={styles.HeaderActions}>
          {dayProjects.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className={cn(styles.HeaderButton, styles.ClearButton)}
              onClick={handleClearAll}
              title="Clear all"
            >
              <X className={styles.HeaderButtonIcon} />
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className={styles.HeaderButton}
            onClick={onEdit}
            title="Widget settings"
          >
            <Settings2 className={styles.HeaderButtonIcon} />
          </Button>
        </div>
      </div>

      {/* Subtitle */}
      <div className={styles.Subtitle}>
        <p className={styles.Date}>{todayFormatted}</p>
      </div>

      {/* Items */}
      <ScrollFade>
        {dayProjects.length === 0 ? (
          <div className={styles.Empty}>
            <div className={styles.EmptyIconWrap}>
              <Calendar className={styles.EmptyIcon} />
            </div>
            <p className={styles.EmptyText}>
              {isDragOver 
                ? "Drop here to add to plan" 
                : availableProjects.length > 0
                  ? "Add projects below or drag cards here"
                  : "All projects are in your plan!"
              }
            </p>
          </div>
        ) : (
          <ul className={styles.List}>
            {dayProjects.map((project, index) => (
              <li
                key={project.id}
                className={styles.Item}
                onClick={() => handleProjectClick(project)}
              >
                <div className={styles.ItemMain}>
                  <span className={styles.ItemIndex}>
                    {index + 1}
                  </span>
                  <span className={cn(
                    styles.ItemTitle,
                    isProjectDone(project) && styles.ItemTitleDone
                  )}>
                    {project.title}
                  </span>
                </div>
                {project.tags && project.tags.length > 0 && (
                  <div className={styles.Tags}>
                    {project.tags.slice(0, 2).map(tag => (
                      <Badge key={tag} variant="secondary" className={styles.TagBadge}>
                        {tag}
                      </Badge>
                    ))}
                    {project.tags.length > 2 && (
                      <Badge variant="secondary" className={styles.TagBadge}>
                        +{project.tags.length - 2}
                      </Badge>
                    )}
                  </div>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className={styles.RemoveButton}
                  onClick={(e) => handleRemoveProject(project.id, e)}
                  title="Remove from plan"
                >
                  <X className={styles.RemoveIcon} />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </ScrollFade>

      {/* Add Project Footer with Search */}
      {availableProjects.length > 0 && (
        <div className={styles.Footer}>
          <Autocomplete
            mode="none"
            items={suggestedProjects}
            itemToStringValue={(project: Project) => project.title}
            value={searchQuery}
            onValueChange={(value, details) => {
              // Picking an item would fill the input with its title; the pick
              // itself is handled in the item's onClick.
              if (details.reason === 'item-press') return;
              setSearchQuery(value);
              setShowSuggestions(true);
            }}
            open={showSuggestions && (suggestedProjects.length > 0 || !!searchQuery)}
            onOpenChange={setShowSuggestions}
          >
            <div className={styles.SearchField}>
              <Search className={styles.SearchIcon} />
              <AutocompleteInput
                placeholder="Search projects..."
                onFocus={() => setShowSuggestions(true)}
                render={<Input className={styles.SearchInput} />}
              />
            </div>

            <AutocompleteContent side="top" className={styles.Suggestions}>
              {!searchQuery && suggestedProjects.length > 0 && getRecentProjects().length > 0 && (
                <div className={styles.SuggestionsHeading}>
                  Recent
                </div>
              )}
              <AutocompleteList>
                {(project: Project) => (
                  <AutocompleteItem
                    key={project.id}
                    value={project}
                    onClick={() => handleAddProject(project.id)}
                    className={styles.Suggestion}
                  >
                    <div className={styles.SuggestionRow}>
                      <span className={styles.SuggestionTitle}>{project.title}</span>
                      {project.tags && project.tags.length > 0 && (
                        <div className={styles.Tags}>
                          {project.tags.slice(0, 2).map((tag: string) => (
                            <Badge key={tag} variant="secondary" className={styles.TagBadge}>
                              {tag}
                            </Badge>
                          ))}
                          {project.tags.length > 2 && (
                            <Badge variant="secondary" className={styles.TagBadge}>
                              +{project.tags.length - 2}
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                  </AutocompleteItem>
                )}
              </AutocompleteList>
              {filteredProjects.length > 5 && (
                <div className={styles.More}>
                  +{filteredProjects.length - 5} more...
                </div>
              )}
              <AutocompleteEmpty>
                {searchQuery ? (
                  <p className={styles.NoResults}>
                    No projects found
                  </p>
                ) : null}
              </AutocompleteEmpty>
            </AutocompleteContent>
          </Autocomplete>
        </div>
      )}
    </div>
  );
}

