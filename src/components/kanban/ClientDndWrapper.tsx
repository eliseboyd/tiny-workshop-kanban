'use client';

import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  MouseSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragOverEvent,
  DragEndEvent,
  rectIntersection,
  pointerWithin,
  getFirstCollision,
} from '@dnd-kit/core';
import { SortableContext, horizontalListSortingStrategy, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { KanbanColumn } from './KanbanColumn';
import { KanbanCard } from './KanbanCard';
import { Project, Column, SettingsData } from './KanbanBoard';
import { useCallback, useId } from 'react';

type ClientDndWrapperProps = {
  items: Project[];
  cols: Column[];
  filteredItems: Project[];
  activeId: string | null;
  settingsState: SettingsData;
  hiddenColumns: string[];
  onToggleColumnVisibility: (columnId: string) => void;
  onDragStart: (event: DragStartEvent) => void;
  onDragOver: (event: DragOverEvent) => void;
  onDragEnd: (event: DragEndEvent) => void;
  handleEditProject: (project: Project) => void;
  handleColumnTitleChange: (colId: string, newTitle: string) => void;
  handleDeleteColumn: (id: string) => void;
  handleDeleteProject: (id: string) => void;
  handleTogglePin: (id: string, pinned: boolean) => void;
  handleAddProjectToColumn: (columnId: string, isTask?: boolean) => void;
  isCreatingInColumn: string | null;
  onConfirmCreate: (columnId: string, title: string, isTask?: boolean) => void;
  onCancelCreate: () => void;
};

export function ClientDndWrapper({
  items,
  cols,
  filteredItems,
  activeId,
  settingsState,
  hiddenColumns,
  onToggleColumnVisibility,
  onDragStart,
  onDragOver,
  onDragEnd,
  handleEditProject,
  handleColumnTitleChange,
  handleDeleteColumn,
  handleDeleteProject,
  handleTogglePin,
  handleAddProjectToColumn,
  isCreatingInColumn,
  onConfirmCreate,
  onCancelCreate,
}: ClientDndWrapperProps) {
  const sensors = useSensors(
    // Mouse sensor - instant drag for desktop (no delay)
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    // Touch sensor - require press-and-hold for mobile to prevent accidental drags
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 200, // 200ms press-and-hold required (slightly shorter)
        tolerance: 10, // Allow 10px movement during hold (more forgiving for scrolling)
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Custom collision detection strategy
  const customCollisionDetection = useCallback((args: any) => {
    // First, try pointer detection (precise for mouse/touch over an element)
    const pointerCollisions = pointerWithin(args);
    
    if (pointerCollisions.length > 0) {
        return pointerCollisions;
    }

    // If no direct pointer overlap, use closest corners to find the nearest container
    return closestCorners(args);
  }, []);

  const dndContextId = useId();

  return (
    <DndContext
      id={dndContextId}
      sensors={sensors}
      collisionDetection={customCollisionDetection}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
    >
      <div className="flex flex-1 w-full gap-4 p-4 overflow-x-auto snap-x snap-mandatory md:snap-none">
        <SortableContext items={cols.map(c => c.id)} strategy={horizontalListSortingStrategy}>
          {cols.map((col) => {
            const isHidden = hiddenColumns.includes(col.id);
            
            // Render slim column indicator when hidden
            if (isHidden) {
              const itemCount = filteredItems.filter((i) => i.status === col.id).length;
              return (
                <button
                  key={col.id}
                  onClick={() => onToggleColumnVisibility(col.id)}
                  className="flex-shrink-0 w-12 h-32 bg-muted/30 hover:bg-muted/50 border-2 border-dashed border-muted-foreground/20 hover:border-muted-foreground/40 rounded-lg transition-all cursor-pointer group relative"
                  title={`Show ${col.title} (${itemCount} items)`}
                >
                  <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground/60 group-hover:text-muted-foreground/80 px-1">
                    <span className="text-xs font-medium tracking-wider rotate-0 text-center break-words w-full leading-tight">
                      {col.title}
                    </span>
                    {itemCount > 0 && (
                      <span className="text-xs font-bold bg-muted px-1.5 py-0.5 rounded">
                        {itemCount}
                      </span>
                    )}
                  </div>
                </button>
              );
            }
            
            // Render normal column when visible
            return (
              <KanbanColumn
                key={col.id}
                id={col.id}
                title={col.title}
                isHidden={false}
                onToggleVisibility={() => onToggleColumnVisibility(col.id)}
                items={filteredItems
                  .filter((i) => i.status === col.id)
                  .sort((a, b) => {
                    // Pinned items always come first
                    if (a.pinned && !b.pinned) return -1;
                    if (!a.pinned && b.pinned) return 1;
                    
                    // For completed/done columns, sort by updatedAt descending (newest first)
                    const isDoneColumn = col.title.toLowerCase() === 'done' || 
                                        col.title.toLowerCase() === 'completed';
                    if (isDoneColumn && a.updatedAt && b.updatedAt) {
                      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
                    }
                    
                    // Within pinned or unpinned, sort by position
                    return a.position - b.position;
                  })
                }
                onCardClick={handleEditProject}
                onTitleChange={handleColumnTitleChange}
                onDeleteColumn={handleDeleteColumn}
                onDeleteProject={handleDeleteProject}
                onTogglePin={handleTogglePin}
                onAddProject={handleAddProjectToColumn}
                cardSize={settingsState.cardSize}
                isCreating={isCreatingInColumn === col.id}
                onConfirmCreate={onConfirmCreate}
                onCancelCreate={onCancelCreate}
              />
            );
          })}
        </SortableContext>
      </div>
      <DragOverlay>
        {activeId ? (
          <KanbanCard
            project={items.find((i) => i.id === activeId)!}
            size={settingsState.cardSize}
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
