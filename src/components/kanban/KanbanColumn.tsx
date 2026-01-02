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
import { Trash2, Plus } from 'lucide-react';

type KanbanColumnProps = {
  id: string;
  title: string;
  items: Project[];
  onCardClick?: (project: Project) => void;
  onTitleChange?: (id: string, newTitle: string) => void;
  onDeleteColumn?: (id: string) => void;
  onDeleteProject?: (id: string) => void;
  onAddProject?: (columnId: string) => void;
  cardSize?: string;
  isCreating?: boolean;
  onConfirmCreate?: (columnId: string, title: string) => void;
  onCancelCreate?: () => void;
};

export function KanbanColumn({ id, title, items, onCardClick, onTitleChange, onDeleteColumn, onDeleteProject, onAddProject, cardSize, isCreating, onConfirmCreate, onCancelCreate }: KanbanColumnProps) {
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
    if (e.key === 'Enter') {
      inputRef.current?.blur();
    }
  };

  return (
    <div ref={setNodeRef} style={style} className="flex w-[85vw] md:w-60 md:min-w-[240px] shrink-0 snap-center md:snap-align-none flex-col rounded-lg bg-neutral-100 p-3 dark:bg-neutral-900 relative group">
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
        
        {items.length === 0 && onDeleteColumn && (
            <Button 
                variant="ghost" 
                size="icon" 
                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-neutral-400 hover:text-destructive"
                onClick={() => onDeleteColumn(id)}
                title="Delete empty column"
            >
                <Trash2 className="h-3 w-3" />
            </Button>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 min-h-0 overflow-y-visible">
        {/* Add Project Button - Dotted Line Card - Now at Top */}
        {onAddProject && !isCreating && (
            <button
                onClick={() => onAddProject(id)}
                className="flex items-center justify-center w-full h-12 rounded-lg border-2 border-dashed border-neutral-300 dark:border-neutral-700 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 hover:border-neutral-400 dark:hover:border-neutral-500 hover:bg-neutral-200/50 dark:hover:bg-neutral-800/50 transition-all group/add flex-shrink-0"
            >
                <span className="flex items-center gap-2 text-sm font-medium">
                    <Plus className="h-4 w-4 group-hover/add:scale-110 transition-transform" />
                    Add Project
                </span>
            </button>
        )}

        {/* Inline Create Input - Now at Top */}
        {isCreating && (
            <div className="touch-none flex-shrink-0">
               <Card className="p-0 gap-0 overflow-hidden border-2 border-primary/20 shadow-sm">
                  <CardHeader className="p-4 pb-2 space-y-0">
                     <Input
                        autoFocus
                        placeholder="Enter title..."
                        className="text-base font-medium leading-tight border-none shadow-none p-0 h-auto focus-visible:ring-0 bg-transparent resize-none"
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                onConfirmCreate?.(id, e.currentTarget.value);
                            } else if (e.key === 'Escape') {
                                onCancelCreate?.();
                            }
                        }}
                        onBlur={(e) => {
                            if (!e.currentTarget.value.trim()) {
                                onCancelCreate?.();
                            } else {
                                onConfirmCreate?.(id, e.currentTarget.value);
                            }
                        }}
                     />
                  </CardHeader>
                  <CardContent className="p-4 pt-2">
                      <span className="text-xs text-muted-foreground">Press Enter to save</span>
                  </CardContent>
               </Card>
            </div>
        )}
        
        <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
          {items.map((project) => (
            <KanbanCard 
                key={project.id} 
                project={project} 
                onClick={() => onCardClick?.(project)} 
                onDelete={() => onDeleteProject?.(project.id)}
                size={cardSize || "small"}
                columnTitle={title}
            />
          ))}
        </SortableContext>
      </div>
    </div>
  );
}
