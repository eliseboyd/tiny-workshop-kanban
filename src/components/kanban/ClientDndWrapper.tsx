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
  onDragStart: (event: DragStartEvent) => void;
  onDragOver: (event: DragOverEvent) => void;
  onDragEnd: (event: DragEndEvent) => void;
  handleEditProject: (project: Project) => void;
  handleColumnTitleChange: (colId: string, newTitle: string) => void;
  handleDeleteColumn: (id: string) => void;
  handleDeleteProject: (id: string) => void;
  handleAddProjectToColumn: (columnId: string) => void;
  isCreatingInColumn: string | null;
  onConfirmCreate: (columnId: string, title: string) => void;
  onCancelCreate: () => void;
};

export function ClientDndWrapper({
  items,
  cols,
  filteredItems,
  activeId,
  settingsState,
  onDragStart,
  onDragOver,
  onDragEnd,
  handleEditProject,
  handleColumnTitleChange,
  handleDeleteColumn,
  handleDeleteProject,
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
      <div className="flex flex-1 w-full gap-4 p-4 overflow-x-auto h-full snap-x snap-mandatory">
        <SortableContext items={cols.map(c => c.id)} strategy={horizontalListSortingStrategy}>
          {cols.map((col) => (
            <KanbanColumn
              key={col.id}
              id={col.id}
              title={col.title}
              items={filteredItems.filter((i) => i.status === col.id).sort((a, b) => a.position - b.position)}
              onCardClick={handleEditProject}
              onTitleChange={handleColumnTitleChange}
              onDeleteColumn={handleDeleteColumn}
              onDeleteProject={handleDeleteProject}
              onAddProject={handleAddProjectToColumn}
              cardSize={settingsState.cardSize}
              isCreating={isCreatingInColumn === col.id}
              onConfirmCreate={onConfirmCreate}
              onCancelCreate={onCancelCreate}
            />
          ))}
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
