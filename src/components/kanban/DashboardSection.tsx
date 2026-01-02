'use client';

import { useState, useMemo } from 'react';
import { ChevronDown, ChevronUp, Package, GripVertical } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import { useLocalStorage } from '@/hooks/use-local-storage';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, rectSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { WidgetsSection } from '@/components/widgets';
import type { Project } from './KanbanBoard';

type Tag = {
  name: string;
  color: string;
  emoji?: string;
  icon?: string;
  count: number;
};

type ProjectGroup = {
  id: string;
  name: string;
  color: string;
  emoji?: string;
  icon?: string;
  count: number;
};

type DashboardItem = {
  id: string;
  type: 'tag' | 'project';
  name: string;
  color: string;
  emoji?: string;
  icon?: string;
  count: number;
};

type Widget = {
  id: string;
  type: 'todo-list' | 'materials-shopping' | 'project-todos';
  title: string;
  config: Record<string, any>;
  position: number;
};

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

type DashboardSectionProps = {
  tags: Tag[];
  projectGroups: ProjectGroup[];
  columns?: Column[];
  onTagClick: (tag: string) => void;
  onProjectClick: (projectId: string) => void;
  onReorder?: (items: DashboardItem[]) => void;
  widgets?: Widget[];
  materials?: MaterialItem[];
  projects?: Project[];
  onProjectCardClick?: (project: Project) => void;
  onRefreshWidgets?: () => void;
  isLoading?: boolean;
  isDashboardOnly?: boolean;
};

// Sortable item component
function SortableDashboardItem({ 
  item, 
  onClick 
}: { 
  item: DashboardItem; 
  onClick: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group relative overflow-hidden rounded-xl border-2 transition-all",
        !isDragging && "hover:scale-105 hover:shadow-lg active:scale-95"
      )}
      {...attributes}
    >
      {/* Drag handle */}
      <div 
        {...listeners}
        className="absolute top-2 right-2 z-10 p-1 rounded bg-background/80 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </div>

      {item.type === 'project' ? (
        <button
          onClick={onClick}
          className="w-full text-left"
          style={{
            borderColor: item.color,
            backgroundColor: `${item.color}08`,
          }}
        >
          <div className="p-4 flex flex-col items-start gap-2">
            <div className="w-full">
              {item.icon ? (
                <div className="relative w-10 h-10 flex-shrink-0">
                  <Image
                    src={item.icon}
                    alt={item.name}
                    width={40}
                    height={40}
                    className="rounded-lg object-cover"
                    unoptimized
                  />
                </div>
              ) : item.emoji ? (
                <span className="text-3xl">{item.emoji}</span>
              ) : (
                <div 
                  className="w-10 h-10 rounded-lg"
                  style={{ backgroundColor: item.color }}
                />
              )}
            </div>
            <div className="w-full text-left">
              <p 
                className="font-semibold text-sm line-clamp-2 group-hover:underline"
                style={{ color: item.color }}
              >
                {item.name}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {item.count} {item.count === 1 ? 'card' : 'cards'}
              </p>
            </div>
          </div>
          <div 
            className="absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity pointer-events-none"
            style={{ backgroundColor: item.color }}
          />
        </button>
      ) : (
        <button
          onClick={onClick}
          className="w-full px-4 py-3 text-left"
          style={{
            borderColor: item.color,
            backgroundColor: `${item.color}10`,
          }}
        >
          <div className="flex items-center gap-2">
            {item.icon ? (
              <div className="relative w-6 h-6 flex-shrink-0">
                <Image
                  src={item.icon}
                  alt={item.name}
                  width={24}
                  height={24}
                  className="rounded object-cover"
                  unoptimized
                />
              </div>
            ) : item.emoji ? (
              <span className="text-xl">{item.emoji}</span>
            ) : null}
            <span 
              className="font-medium text-sm flex-1"
              style={{ color: item.color }}
            >
              #{item.name}
            </span>
            <Badge 
              variant="secondary" 
              className="h-5 text-xs font-semibold"
              style={{
                backgroundColor: item.color,
                color: 'white',
              }}
            >
              {item.count}
            </Badge>
          </div>
        </button>
      )}
    </div>
  );
}

export function DashboardSection({
  tags,
  projectGroups,
  columns = [],
  onTagClick,
  onProjectClick,
  onReorder,
  widgets = [],
  materials = [],
  projects = [],
  onProjectCardClick,
  onRefreshWidgets,
  isLoading = false,
  isDashboardOnly = false,
}: DashboardSectionProps) {
  const [isExpanded, setIsExpanded] = useLocalStorage('dashboard-expanded', true);
  const [items, setItems] = useState<DashboardItem[]>([]);

  // Combine tags and projects into a single array with useMemo to avoid cascading renders
  const combinedItems = useMemo(() => {
    const combined: DashboardItem[] = [
      ...projectGroups.map(g => ({
        id: `project-${g.id}`,
        type: 'project' as const,
        name: g.name,
        color: g.color,
        emoji: g.emoji,
        icon: g.icon,
        count: g.count,
      })),
      ...tags.map(t => ({
        id: `tag-${t.name}`,
        type: 'tag' as const,
        name: t.name,
        color: t.color,
        emoji: t.emoji,
        icon: t.icon,
        count: t.count,
      })),
    ];
    return items.length > 0 ? items : combined;
  }, [projectGroups, tags, items]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setItems((currentItems) => {
        const oldIndex = currentItems.findIndex(item => item.id === active.id);
        const newIndex = currentItems.findIndex(item => item.id === over.id);
        const newItems = arrayMove(currentItems, oldIndex, newIndex);
        onReorder?.(newItems);
        return newItems;
      });
    }
  };

  const displayItems = items.length > 0 ? items : combinedItems;

  // Always render the container to prevent layout shift
  return (
    <div className="border-b bg-gradient-to-br from-background via-background to-muted/20">
      <div className="px-4 py-3">
        {/* Only show header in overview mode */}
        {!isDashboardOnly && (
          <div 
            className="flex items-center justify-between cursor-pointer hover:bg-muted/30 rounded-lg px-3 py-2 -mx-3 transition-colors group"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Package className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-bold">Dashboard</h2>
              </div>
            </div>
            {isExpanded ? (
              <ChevronUp className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
            ) : (
              <ChevronDown className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
            )}
          </div>
        )}

        {(isDashboardOnly || isExpanded) && (
          <div className={cn("space-y-4", !isDashboardOnly && "mt-4")}>

            {/* Tags/Projects Grid - Hidden for now */}
            {/* {isLoading ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {[...Array(5)].map((_, i) => (
                  <div 
                    key={i}
                    className="rounded-xl border-2 border-muted bg-muted/20 animate-pulse"
                  >
                    <div className="p-4 flex flex-col items-start gap-2">
                      <div className="w-10 h-10 rounded-lg bg-muted" />
                      <div className="w-full space-y-2">
                        <div className="h-4 w-3/4 rounded bg-muted" />
                        <div className="h-3 w-1/2 rounded bg-muted" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : displayItems.length > 0 ? (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext items={displayItems.map(i => i.id)} strategy={rectSortingStrategy}>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                    {displayItems.map(item => (
                      <SortableDashboardItem
                        key={item.id}
                        item={item}
                        onClick={() => {
                          if (item.type === 'project') {
                            onProjectClick(item.id.replace('project-', ''));
                          } else {
                            onTagClick(item.name);
                          }
                        }}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            ) : null} */}

            {/* Widgets Section */}
            <div className={cn(!isDashboardOnly && displayItems.length > 0 && "pt-4 border-t mt-4")}>
              <WidgetsSection
                widgets={widgets}
                projects={projects}
                columns={columns}
                materials={materials}
                tags={tags.map(t => ({ name: t.name, color: t.color, emoji: t.emoji }))}
                projectGroups={projectGroups.map(g => ({ id: g.id, name: g.name, color: g.color, emoji: g.emoji }))}
                onProjectClick={onProjectCardClick || (() => {})}
                onRefresh={onRefreshWidgets}
                isLoading={isLoading}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

