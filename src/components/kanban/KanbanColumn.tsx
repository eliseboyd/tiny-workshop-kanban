'use client';

import { useState, useRef } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { KanbanCard } from './KanbanCard';
import { Project, Column } from './KanbanBoard';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Trash2, Plus, Eye, ListTodo, FolderKanban, Lightbulb } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { cn } from '@/lib/utils';
import styles from './KanbanColumn.module.css';

type KanbanColumnProps = {
  id: string;
  title: string;
  items: Project[];
  columns?: Column[];
  isHidden?: boolean;
  onToggleVisibility?: () => void;
  onCardClick?: (project: Project) => void;
  onTitleChange?: (id: string, newTitle: string) => void;
  onDeleteColumn?: (id: string) => void;
  onDeleteProject?: (id: string) => void;
  onTogglePin?: (id: string, pinned: boolean) => void;
  onMoveCard?: (projectId: string, newColumnId: string) => void;
  onAddProject?: (columnId: string, isTask?: boolean) => void;
  cardSize?: string;
  isCreating?: boolean;
  onConfirmCreate?: (columnId: string, title: string, isTask?: boolean) => void;
  onCancelCreate?: () => void;
  ideasCount?: number;
  onSwitchToIdeas?: () => void;
};

export function KanbanColumn({ id, title, items, columns, isHidden, onToggleVisibility, onCardClick, onTitleChange, onDeleteColumn, onDeleteProject, onTogglePin, onMoveCard, onAddProject, cardSize, isCreating, onConfirmCreate, onCancelCreate, ideasCount, onSwitchToIdeas }: KanbanColumnProps) {
  const {
    setNodeRef,
    attributes,
    listeners,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: id,
    data: {
        type: 'Column',
        column: { id, title },
    }
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  
  const [isEditing, setIsEditing] = useState(false);
  const [internalTitle, setInternalTitle] = useState(title);
  const [creatingAsTask, setCreatingAsTask] = useState(false);
  
  // This pattern allows the prop to override state during render if it changed, 
  // but only if we aren't editing.
  const [prevTitle, setPrevTitle] = useState(title);
  if (title !== prevTitle) {
      setPrevTitle(title);
      if (!isEditing) {
          setInternalTitle(title);
      }
  }

  const inputRef = useRef<HTMLInputElement>(null);

  const handleTitleClick = () => {
    setIsEditing(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const handleTitleBlur = () => {
    setIsEditing(false);
    if (internalTitle !== title) {
        onTitleChange?.(id, internalTitle);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Prevent drag-and-drop keyboard events from interfering
    e.stopPropagation();
    
    if (e.key === 'Enter') {
      inputRef.current?.blur();
    }
  };

  return (
    <div ref={setNodeRef} style={style} className={cn(styles.Column, "group")} data-column-id={id}>
      <div 
        className={styles.Header}
        {...attributes} 
        {...listeners}
      >
        {isEditing ? (
             <Input
                ref={inputRef}
                value={internalTitle}
                onChange={(e) => setInternalTitle(e.target.value)}
                onBlur={handleTitleBlur}
                onKeyDown={handleKeyDown}
                onPointerDown={(e) => e.stopPropagation()}
                className={styles.TitleInput}
                onClick={(e) => e.stopPropagation()}
             />
        ) : (
            <h3
                role="button"
                tabIndex={0}
                aria-label={`Rename column: ${internalTitle}`}
                className={styles.Title}
                onClick={handleTitleClick}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleTitleClick();
                  }
                }}
            >
                {internalTitle}
            </h3>
        )}
        
        <div className={styles.Actions}>
          {/* Idea count badge */}
          {ideasCount !== undefined && (
            <Badge variant="secondary" className={styles.CountBadge}>{ideasCount}</Badge>
          )}
          {/* Hide column button */}
          {onToggleVisibility && (
            <Button
              variant="ghost"
              size="icon"
              className={cn(styles.ColumnAction, styles.HideAction)}
              onClick={(e) => {
                e.stopPropagation();
                onToggleVisibility();
              }}
              title="Hide column"
              aria-label="Hide column"
            >
              <Eye className={styles.ActionIcon} />
            </Button>
          )}
          
          {/* Delete column button */}
          {items.length === 0 && onDeleteColumn && (
              <Button
                  variant="ghost"
                  size="icon"
                  className={cn(styles.ColumnAction, styles.DeleteAction)}
                  onClick={() => onDeleteColumn(id)}
                  title="Delete empty column"
                  aria-label="Delete empty column"
              >
                  <Trash2 className={styles.ActionIcon} />
              </Button>
          )}
        </div>
      </div>
      {/* Idea column — static, no drop target */}
      {ideasCount !== undefined ? (
        <button
          onClick={onSwitchToIdeas}
          className={styles.IdeasLink}
        >
          <Lightbulb className={styles.IdeasIcon} />
          <span className={styles.IdeasText}>
            {ideasCount > 0
              ? `${ideasCount} idea${ideasCount !== 1 ? 's' : ''} in the Ideas tab`
              : 'Ideas are in the Ideas tab'}
          </span>
          <span className={styles.IdeasHint}>Click to open →</span>
        </button>
      ) : (
      <div className={styles.Scroll} data-column-scroll>
        {/* Add Project Button - At Top for easy access */}
        {onAddProject && !isCreating && (
          <ContextMenu>
            <ContextMenuTrigger
              render={<button
                  onClick={() => {
                    setCreatingAsTask(false);
                    onAddProject(id, false);
                    // Scroll to bottom where the create input will appear
                    setTimeout(() => {
                      const columnElement = document.querySelector(`[data-column-id="${id}"]`);
                      if (columnElement) {
                        const scrollContainer = columnElement.querySelector('[data-column-scroll]');
                        if (scrollContainer) {
                          scrollContainer.scrollTo({
                            top: scrollContainer.scrollHeight,
                            behavior: 'smooth'
                          });
                        }
                      }
                    }, 50);
                  }}
                  className={styles.AddButton}
              />}
              >
                  <span className={styles.AddLabel}>
                      <Plus className={styles.AddIcon} />
                      Add Project
                  </span>
            </ContextMenuTrigger>
            <ContextMenuContent>
              <ContextMenuItem 
                onClick={() => {
                  setCreatingAsTask(false);
                  onAddProject(id, false);
                  // Scroll to bottom
                  setTimeout(() => {
                    const columnElement = document.querySelector(`[data-column-id="${id}"]`);
                    if (columnElement) {
                      const scrollContainer = columnElement.querySelector('[data-column-scroll]');
                      if (scrollContainer) {
                        scrollContainer.scrollTo({
                          top: scrollContainer.scrollHeight,
                          behavior: 'smooth'
                        });
                      }
                    }
                  }, 50);
                }}
              >
                Add Project
              </ContextMenuItem>
              <ContextMenuItem 
                onClick={() => {
                  setCreatingAsTask(true);
                  onAddProject(id, true);
                  // Scroll to bottom
                  setTimeout(() => {
                    const columnElement = document.querySelector(`[data-column-id="${id}"]`);
                    if (columnElement) {
                      const scrollContainer = columnElement.querySelector('[data-column-scroll]');
                      if (scrollContainer) {
                        scrollContainer.scrollTo({
                          top: scrollContainer.scrollHeight,
                          behavior: 'smooth'
                        });
                      }
                    }
                  }, 50);
                }}
              >
                Add Task
              </ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
        )}
        
        <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
          {items.map((project, cardIndex) => (
            <KanbanCard
                key={project.id}
                project={project}
                onClick={() => onCardClick?.(project)}
                onDelete={() => onDeleteProject?.(project.id)}
                onTogglePin={(pinned) => onTogglePin?.(project.id, pinned)}
                onMoveToColumn={(columnId) => onMoveCard?.(project.id, columnId)}
                columns={columns}
                currentColumnId={id}
                imagePriority={cardIndex < 2}
                size={cardSize || "small"}
                columnTitle={title}
            />
          ))}
        </SortableContext>
        
        {/* Inline Create Input - At Bottom */}
        {isCreating && (
            <div className={styles.CreateWrap}>
               <Card className={styles.CreateCard}>
                  <CardHeader className={styles.CreateHeader}>
                     <Input
                        autoFocus
                        placeholder={creatingAsTask ? "Enter task title..." : "Enter project title..."}
                        className={styles.CreateInput}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                onConfirmCreate?.(id, e.currentTarget.value, creatingAsTask);
                            } else if (e.key === 'Escape') {
                                onCancelCreate?.();
                            }
                        }}
                        onBlur={(e) => {
                            if (!e.currentTarget.value.trim()) {
                                onCancelCreate?.();
                            } else {
                                onConfirmCreate?.(id, e.currentTarget.value, creatingAsTask);
                            }
                        }}
                     />
                  </CardHeader>
                  <CardContent className={styles.CreateContent}>
                      <span className={styles.CreateHint}>
                        {creatingAsTask ? "Creating Task - " : "Creating Project - "}
                        Press Enter to save
                      </span>
                  </CardContent>
               </Card>
            </div>
        )}
      </div>
      )}
    </div>
  );
}
