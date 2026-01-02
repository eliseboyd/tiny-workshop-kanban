'use client';

import { useState, useEffect, createContext, useContext, useRef, useCallback } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ToDoListWidget } from './ToDoListWidget';
import { MaterialsShoppingWidget } from './MaterialsShoppingWidget';
import { ProjectTodosWidget } from './ProjectTodosWidget';
import { DayPlanWidget } from './DayPlanWidget';
import { AddWidgetDialog } from './AddWidgetDialog';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, rectSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/lib/utils';
import { updateWidget, reorderWidgets } from '@/app/actions';
import { useRouter } from 'next/navigation';
import type { Project } from '@/components/kanban/KanbanBoard';

// Context for passing drag listeners to widget headers
type DragListeners = {
  onMouseDown?: (e: React.MouseEvent) => void;
  onTouchStart?: (e: React.TouchEvent) => void;
  onPointerDown?: (e: React.PointerEvent) => void;
} | undefined;

export const DragHandleContext = createContext<DragListeners>(undefined);

export function useDragHandle() {
  return useContext(DragHandleContext);
}

const MIN_HEIGHT = 120;
const DEFAULT_HEIGHT = 250;

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

type Widget = {
  id: string;
  type: 'todo-list' | 'materials-shopping' | 'project-todos';
  title: string;
  config: Record<string, any>;
  position: number;
};

// Resize handle component
function ResizeHandle({ 
  onResizeStart 
}: { 
  onResizeStart: (e: React.PointerEvent) => void;
}) {
  return (
    <div
      className="absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize group/resize flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"
      onPointerDown={onResizeStart}
    >
      <div className="h-1 w-10 rounded-full bg-muted-foreground/40 group-hover/resize:bg-primary/60 transition-colors" />
    </div>
  );
}

// Sortable widget wrapper component
function SortableWidget({ 
  id, 
  children, 
  height = DEFAULT_HEIGHT,
  onHeightChange,
}: { 
  id: string; 
  children: React.ReactNode;
  height?: number;
  onHeightChange?: (newHeight: number) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const [isResizing, setIsResizing] = useState(false);
  const [currentHeight, setCurrentHeight] = useState(height);
  const resizeStartY = useRef(0);
  const resizeStartHeight = useRef(height);
  const latestHeight = useRef(height);

  // Reset height when prop changes
  useEffect(() => {
    if (!isResizing) {
      setCurrentHeight(height);
      latestHeight.current = height;
    }
  }, [height, isResizing]);

  const handleResizeStart = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    resizeStartY.current = e.clientY;
    resizeStartHeight.current = latestHeight.current;
    
    const handleResizeMove = (moveEvent: PointerEvent) => {
      const deltaY = moveEvent.clientY - resizeStartY.current;
      const newHeight = Math.max(MIN_HEIGHT, resizeStartHeight.current + deltaY);
      latestHeight.current = newHeight;
      setCurrentHeight(newHeight);
    };
    
    const handleResizeEnd = () => {
      setIsResizing(false);
      document.removeEventListener('pointermove', handleResizeMove);
      document.removeEventListener('pointerup', handleResizeEnd);
      
      // Get final height from ref (not stale closure)
      if (onHeightChange) {
        onHeightChange(latestHeight.current);
      }
    };
    
    document.addEventListener('pointermove', handleResizeMove);
    document.addEventListener('pointerup', handleResizeEnd);
  }, [onHeightChange]);

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition: isResizing ? 'none' : transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging || isResizing ? 50 : 'auto',
    height: `${currentHeight}px`,
  };

  return (
    <DragHandleContext.Provider value={listeners}>
      <div
        ref={setNodeRef}
        style={style}
        className={cn(
          "relative group/widget break-inside-avoid mb-4",
          "[&>*:first-child]:h-full [&>*:first-child]:overflow-auto",
          isResizing && "ring-2 ring-primary/30 rounded-xl"
        )}
        {...attributes}
      >
        {children}
        <ResizeHandle onResizeStart={handleResizeStart} />
      </div>
    </DragHandleContext.Provider>
  );
}

type MaterialItem = {
  id: string;
  text: string;
  toBuy: boolean;
  toBuild: boolean;
  projectId: string;
  projectTitle: string;
  projectTags: string[];
  parentProjectId: string | null;
};

type Column = {
  id: string;
  title: string;
  order: number;
};

type WidgetsSectionProps = {
  widgets: Widget[];
  projects: Project[];
  columns: Column[];
  materials: MaterialItem[];
  tags: Tag[];
  projectGroups: ProjectGroup[];
  onProjectClick: (project: Project) => void;
  onRefresh?: () => void;
  isLoading?: boolean;
};

export function WidgetsSection({
  widgets,
  projects,
  columns,
  materials,
  tags,
  projectGroups,
  onProjectClick,
  onRefresh,
  isLoading = false,
}: WidgetsSectionProps) {
  const router = useRouter();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingWidget, setEditingWidget] = useState<Widget | null>(null);
  const [localWidgets, setLocalWidgets] = useState<Widget[]>(widgets);

  // Keep local state in sync with props
  useEffect(() => {
    setLocalWidgets(widgets);
  }, [widgets]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleEdit = (widget: Widget) => {
    setEditingWidget(widget);
    setIsAddDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsAddDialogOpen(false);
    setEditingWidget(null);
    // Refresh data after dialog closes (widget may have been added/edited)
    onRefresh?.();
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = localWidgets.findIndex(w => w.id === active.id);
      const newIndex = localWidgets.findIndex(w => w.id === over.id);
      
      const newWidgets = arrayMove(localWidgets, oldIndex, newIndex);
      setLocalWidgets(newWidgets);
      
      // Persist the new order
      await reorderWidgets(newWidgets.map(w => w.id));
      router.refresh();
      onRefresh?.();
    }
  };

  const handleHeightChange = async (widgetId: string, newHeight: number) => {
    const widget = localWidgets.find(w => w.id === widgetId);
    if (!widget) return;

    // Update locally first for responsiveness
    setLocalWidgets(prev => prev.map(w => 
      w.id === widgetId 
        ? { ...w, config: { ...w.config, height: newHeight } }
        : w
    ));

    // Persist to database
    await updateWidget(widgetId, {
      config: { ...widget.config, height: newHeight },
    });
    router.refresh();
  };

  const getHeight = (widget: Widget) => widget.config?.height || DEFAULT_HEIGHT;

  if (widgets.length === 0) {
    return (
      <>
        <div className="flex items-center justify-center py-6">
          <Button
            variant="outline"
            size="sm"
            className="gap-2 text-muted-foreground hover:text-foreground"
            onClick={() => setIsAddDialogOpen(true)}
          >
            <Plus className="h-4 w-4" />
            Add your first widget
          </Button>
        </div>
        
        <AddWidgetDialog
          isOpen={isAddDialogOpen}
          onClose={handleCloseDialog}
          tags={tags}
          projectGroups={projectGroups}
          projects={projects.map(p => ({ id: p.id, title: p.title }))}
          editingWidget={editingWidget}
        />
      </>
    );
  }

  const renderWidget = (widget: Widget) => {
    if (widget.type === 'todo-list') {
      return (
        <ToDoListWidget
          widget={widget as any}
          projects={projects}
          columns={columns}
          tags={tags}
          projectGroups={projectGroups}
          onEdit={() => handleEdit(widget)}
          onProjectClick={onProjectClick}
          onRefresh={onRefresh}
        />
      );
    }
    
    if (widget.type === 'materials-shopping') {
      return (
        <MaterialsShoppingWidget
          widget={widget as any}
          materials={materials}
          projects={projects}
          tags={tags}
          projectGroups={projectGroups}
          onEdit={() => handleEdit(widget)}
          onRefresh={onRefresh}
          onProjectClick={onProjectClick}
        />
      );
    }

    if (widget.type === 'project-todos') {
      return (
        <ProjectTodosWidget
          widget={widget as any}
          projects={projects}
          onEdit={() => handleEdit(widget)}
          onProjectClick={onProjectClick}
          onRefresh={onRefresh}
        />
      );
    }

    if (widget.type === 'day-plan') {
      return (
        <DayPlanWidget
          widget={widget as any}
          projects={projects}
          columns={columns}
          onEdit={() => handleEdit(widget)}
          onProjectClick={onProjectClick}
          onRefresh={onRefresh}
        />
      );
    }

    return null;
  };

  return (
    <>
      <div className="space-y-4">
        {isLoading ? (
          // Loading skeletons
          <div className="columns-1 md:columns-2 lg:columns-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="rounded-xl border bg-card shadow-sm overflow-hidden break-inside-avoid mb-4 animate-pulse"
                style={{ height: `${200 + (i * 50)}px` }}
              >
                <div className="px-4 py-3 border-b bg-muted/30">
                  <div className="h-5 bg-muted rounded w-2/3"></div>
                  <div className="h-3 bg-muted rounded w-1/2 mt-2"></div>
                </div>
                <div className="p-4 space-y-3">
                  <div className="h-4 bg-muted rounded"></div>
                  <div className="h-4 bg-muted rounded"></div>
                  <div className="h-4 bg-muted rounded w-5/6"></div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          // Widgets Grid with Drag & Drop
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext 
              items={localWidgets.map(w => w.id)} 
              strategy={rectSortingStrategy}
            >
              <div 
                className="columns-1 md:columns-2 lg:columns-3 gap-4"
              >
                {localWidgets.map((widget) => (
                  <SortableWidget
                    key={widget.id}
                    id={widget.id}
                    height={getHeight(widget)}
                    onHeightChange={(newHeight) => handleHeightChange(widget.id, newHeight)}
                  >
                    {renderWidget(widget)}
                  </SortableWidget>
                ))}
                {/* Add Widget Button */}
                <button
                  onClick={() => setIsAddDialogOpen(true)}
                  className="flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-muted-foreground/30 text-muted-foreground hover:border-primary/50 hover:text-primary hover:bg-primary/5 transition-colors min-h-[120px] w-full break-inside-avoid mb-4"
                >
                  <Plus className="h-4 w-4" />
                  <span className="text-sm font-medium">Add Widget</span>
                </button>
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>

      <AddWidgetDialog
        isOpen={isAddDialogOpen}
        onClose={handleCloseDialog}
        tags={tags}
        projectGroups={projectGroups}
        projects={projects.map(p => ({ id: p.id, title: p.title }))}
        editingWidget={editingWidget}
      />
    </>
  );
}
