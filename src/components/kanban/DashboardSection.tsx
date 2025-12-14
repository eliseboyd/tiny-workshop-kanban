'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, Package, GripVertical } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, rectSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

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

type DashboardSectionProps = {
  tags: Tag[];
  projectGroups: ProjectGroup[];
  onTagClick: (tag: string) => void;
  onProjectClick: (projectId: string) => void;
  onReorder?: (items: DashboardItem[]) => void;
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
            <div className="flex items-center justify-between w-full">
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
              <Badge 
                variant="secondary" 
                className="h-6 text-xs font-semibold"
                style={{
                  backgroundColor: `${item.color}20`,
                  color: item.color,
                  borderColor: item.color,
                }}
              >
                {item.count}
              </Badge>
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
  onTagClick,
  onProjectClick,
  onReorder,
}: DashboardSectionProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  // Combine tags and projects into a single array
  const [items, setItems] = useState<DashboardItem[]>(() => {
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
    return combined;
  });

  // Update items when props change
  useState(() => {
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
    setItems(combined);
  });

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setItems((items) => {
        const oldIndex = items.findIndex(item => item.id === active.id);
        const newIndex = items.findIndex(item => item.id === over.id);
        const newItems = arrayMove(items, oldIndex, newIndex);
        onReorder?.(newItems);
        return newItems;
      });
    }
  };

  if (items.length === 0) {
    return null;
  }

  const projectCount = items.filter(i => i.type === 'project').length;
  const tagCount = items.filter(i => i.type === 'tag').length;

  return (
    <div className="border-b bg-gradient-to-br from-background via-background to-muted/20">
      <div className="px-4 py-3">
        <div 
          className="flex items-center justify-between cursor-pointer hover:bg-muted/30 rounded-lg px-3 py-2 -mx-3 transition-colors group"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-bold">Overview</h2>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>{projectCount} projects</span>
              <span>•</span>
              <span>{tagCount} tags</span>
            </div>
          </div>
          {isExpanded ? (
            <ChevronUp className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
          ) : (
            <ChevronDown className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
          )}
        </div>

        {isExpanded && (
          <div className="mt-4 space-y-4">
            <p className="text-xs text-muted-foreground">
              💡 Drag cards to reorder • Mixed projects and tags
            </p>

            {/* Unified Draggable Grid */}
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext items={items.map(i => i.id)} strategy={rectSortingStrategy}>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                  {items.map(item => (
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

            {/* Quick Stats */}
            <div className="flex items-center gap-4 pt-2 border-t text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Package className="h-3 w-3" />
                {items.filter(i => i.type === 'project').reduce((acc, i) => acc + i.count, 0)} cards in projects
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Package className="h-3 w-3" />
                {items.filter(i => i.type === 'tag').reduce((acc, i) => acc + i.count, 0)} tag uses
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

