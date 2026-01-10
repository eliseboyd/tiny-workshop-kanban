'use client';

import { useState, useRef } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { KanbanCard } from './KanbanCard';
import { Project } from './KanbanBoard';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Trash2, Plus, Eye } from 'lucide-react';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

type KanbanColumnProps = {
  id: string;
  title: string;
  items: Project[];
  isHidden?: boolean;
  onToggleVisibility?: () => void;
  onCardClick?: (project: Project) => void;
  onTitleChange?: (id: string, newTitle: string) => void;
  onDeleteColumn?: (id: string) => void;
  onDeleteProject?: (id: string) => void;
  onTogglePin?: (id: string, pinned: boolean) => void;
  onAddProject?: (columnId: string, isTask?: boolean) => void;
  cardSize?: string;
  isCreating?: boolean;
  onConfirmCreate?: (columnId: string, title: string, isTask?: boolean) => void;
  onCancelCreate?: () => void;
};

export function KanbanColumn({ id, title, items, isHidden, onToggleVisibility, onCardClick, onTitleChange, onDeleteColumn, onDeleteProject, onTogglePin, onAddProject, cardSize, isCreating, onConfirmCreate, onCancelCreate }: KanbanColumnProps) {
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
    <div ref={setNodeRef} style={style} className="flex w-[85vw] md:w-60 md:min-w-[240px] shrink-0 snap-center md:snap-align-none flex-col rounded-lg bg-neutral-100 p-3 dark:bg-neutral-900 relative group" data-column-id={id}>
      <div 
        className="mb-3 h-6 flex items-center justify-between cursor-grab active:cursor-grabbing" 
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
                className="h-6 py-0 px-1 text-sm font-semibold bg-transparent border-none focus-visible:ring-1"
                onClick={(e) => e.stopPropagation()}
             />
        ) : (
            <h3 
                className="text-sm font-semibold text-neutral-500 dark:text-neutral-400 cursor-text hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors w-full"
                onClick={handleTitleClick}
            >
                {internalTitle}
            </h3>
        )}
        
        <div className="flex items-center gap-1">
          {/* Hide column button */}
          {onToggleVisibility && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 opacity-0 group-hover:opacity-100 md:transition-opacity text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 touch:opacity-100"
              onClick={(e) => {
                e.stopPropagation();
                onToggleVisibility();
              }}
              title="Hide column"
            >
              <Eye className="h-3 w-3" />
            </Button>
          )}
          
          {/* Delete column button */}
          {items.length === 0 && onDeleteColumn && (
              <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-6 w-6 opacity-0 group-hover:opacity-100 md:transition-opacity text-neutral-400 hover:text-destructive touch:opacity-100"
                  onClick={() => onDeleteColumn(id)}
                  title="Delete empty column"
              >
                  <Trash2 className="h-3 w-3" />
              </Button>
          )}
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-2 min-h-0 overflow-y-auto" data-column-scroll>
        {/* Add Project Button - At Top for easy access */}
        {onAddProject && !isCreating && (
          <ContextMenu>
            <ContextMenuTrigger asChild>
              <button
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
                  className="flex items-center justify-center w-full h-12 rounded-lg border-2 border-dashed border-neutral-300 dark:border-neutral-700 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 hover:border-neutral-400 dark:hover:border-neutral-500 hover:bg-neutral-200/50 dark:hover:bg-neutral-800/50 transition-all group/add flex-shrink-0"
              >
                  <span className="flex items-center gap-2 text-sm font-medium">
                      <Plus className="h-4 w-4 group-hover/add:scale-110 transition-transform" />
                      Add Project
                  </span>
              </button>
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
          {items.map((project) => (
            <KanbanCard 
                key={project.id} 
                project={project} 
                onClick={() => onCardClick?.(project)} 
                onDelete={() => onDeleteProject?.(project.id)}
                onTogglePin={(pinned) => onTogglePin?.(project.id, pinned)}
                size={cardSize || "small"}
                columnTitle={title}
            />
          ))}
        </SortableContext>
        
        {/* Inline Create Input - At Bottom */}
        {isCreating && (
            <div className="touch-none flex-shrink-0">
               <Card className="p-0 gap-0 overflow-hidden border-2 border-primary/20 shadow-sm">
                  <CardHeader className="p-4 pb-2 space-y-0">
                     <Input
                        autoFocus
                        placeholder={creatingAsTask ? "Enter task title..." : "Enter project title..."}
                        className="text-base font-medium leading-tight border-none shadow-none px-4 py-3 h-auto focus-visible:ring-0 bg-transparent resize-none"
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
                  <CardContent className="p-4 pt-2">
                      <span className="text-xs text-muted-foreground">
                        {creatingAsTask ? "Creating Task - " : "Creating Project - "}
                        Press Enter to save
                      </span>
                  </CardContent>
               </Card>
            </div>
        )}
      </div>
    </div>
  );
}
