'use client';

import { useState, useEffect, useCallback, useId, useMemo } from 'react';
import { Project, Column } from './KanbanBoard';
import { KanbanCard } from './KanbanCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Lightbulb, Plus, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  DndContext,
  DragOverlay,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
  MouseSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  pointerWithin,
  closestCorners,
  type CollisionDetection,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { updateProjectStatus } from '@/app/actions';

type Tag = {
  name: string;
  color: string;
  emoji?: string;
  icon?: string;
};

type IdeasViewProps = {
  ideas: Project[];
  tags: Tag[];
  columns: Column[];
  onIdeaClick: (idea: Project) => void;
  onMoveToKanban: (ideaId: string, columnId: string) => void;
  onDeleteIdea: (ideaId: string) => void;
  onCreateIdea?: () => void;
};

export function IdeasView({
  ideas: propIdeas,
  tags,
  columns,
  onIdeaClick,
  onMoveToKanban,
  onDeleteIdea,
  onCreateIdea,
}: IdeasViewProps) {
  const [localIdeas, setLocalIdeas] = useState<Project[]>(propIdeas);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const dndContextId = useId();

  // Keep local copy in sync when parent refreshes
  useEffect(() => {
    setLocalIdeas(propIdeas);
  }, [propIdeas]);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const customCollisionDetection = useCallback<CollisionDetection>((args) => {
    const pointerCollisions = pointerWithin(args);
    if (pointerCollisions.length > 0) return pointerCollisions;
    return closestCorners(args);
  }, []);

  function findContainer(id: string) {
    if (columns.find(c => c.id === id)) return id;
    return localIdeas.find(i => i.id === id)?.status ?? null;
  }

  function handleDragStart(e: DragStartEvent) {
    setActiveId(e.active.id as string);
  }

  function handleDragOver(e: DragOverEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = findContainer(active.id as string);
    const to = findContainer(over.id as string);
    if (!from || !to || from === to) return;
    setLocalIdeas(prev =>
      prev.map(idea => idea.id === active.id ? { ...idea, status: to } : idea)
    );
  }

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    setActiveId(null);
    if (!over) return;
    const activeIdea = localIdeas.find(i => i.id === active.id);
    if (!activeIdea) return;
    const to = findContainer(over.id as string);
    if (!to || to === activeIdea.status) return;
    const destCount = localIdeas.filter(i => i.status === to && i.id !== active.id).length;
    updateProjectStatus(active.id as string, to, destCount);
  }

  // Ideas grouped by column, with unmatched ideas falling into the first column
  const ideaColumns = useMemo(() => {
    const firstColId = columns[0]?.id;
    return columns.map(col => {
      const colIdeas = localIdeas.filter(idea => {
        const inThisCol =
          idea.status === col.id ||
          (!columns.find(c => c.id === idea.status) && col.id === firstColId);
        if (!inThisCol) return false;

        if (searchQuery) {
          const q = searchQuery.toLowerCase();
          if (
            !idea.title.toLowerCase().includes(q) &&
            !idea.description?.toLowerCase().includes(q)
          ) return false;
        }
        if (selectedTags.length > 0) {
          if (!selectedTags.some(t => idea.tags?.includes(t))) return false;
        }
        return true;
      }).sort((a, b) => a.position - b.position);

      return { col, ideas: colIdeas };
    });
  }, [localIdeas, columns, searchQuery, selectedTags]);

  const totalVisible = ideaColumns.reduce((sum, { ideas }) => sum + ideas.length, 0);
  const hasActiveFilters = searchQuery || selectedTags.length > 0;
  const activeIdea = localIdeas.find(i => i.id === activeId);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Toolbar — mirrors the kanban toolbar style */}
      <div className="flex items-center justify-end gap-2 px-4 py-2 border-b bg-muted/20 flex-wrap">
        <div className="flex items-center gap-2 flex-1 min-w-0 overflow-hidden">
          <div className="relative w-48 shrink-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search ideas..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-8 text-sm"
            />
          </div>
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setSearchQuery(''); setSelectedTags([]); }}
            >
              <X className="h-4 w-4 mr-1" /> Clear
            </Button>
          )}
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 min-w-0 overflow-hidden">
              {tags.map(tag => (
                <Badge
                  key={tag.name}
                  variant={selectedTags.includes(tag.name) ? 'default' : 'outline'}
                  className={cn('cursor-pointer text-xs transition-all hover:scale-105', selectedTags.includes(tag.name) && 'ring-2 ring-offset-1 ring-offset-background')}
                  style={selectedTags.includes(tag.name) ? { backgroundColor: tag.color, borderColor: tag.color } : {}}
                  onClick={() =>
                    setSelectedTags(prev =>
                      prev.includes(tag.name) ? prev.filter(t => t !== tag.name) : [...prev, tag.name]
                    )
                  }
                >
                  {tag.emoji && <span className="mr-0.5">{tag.emoji}</span>}
                  {tag.name}
                  {selectedTags.includes(tag.name) && <X className="ml-1 h-3 w-3" />}
                </Badge>
              ))}
            </div>
          )}
        </div>
        {onCreateIdea && (
          <Button size="sm" onClick={onCreateIdea}>
            <Plus className="mr-2 h-4 w-4" /> New Idea
          </Button>
        )}
      </div>

      {/* Kanban-style column layout */}
      {columns.length === 0 ? (
        <div className="flex flex-1 items-center justify-center flex-col gap-3 text-muted-foreground">
          <Lightbulb className="h-12 w-12 opacity-20" />
          <p className="text-sm">Add columns in the Kanban view first.</p>
        </div>
      ) : (
        <DndContext
          id={dndContextId}
          sensors={sensors}
          collisionDetection={customCollisionDetection}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="flex flex-1 w-full gap-4 p-4 overflow-x-auto snap-x snap-mandatory md:snap-none select-none min-h-0">
            {ideaColumns.map(({ col, ideas }) => (
              <div
                key={col.id}
                className="flex w-[85vw] md:w-60 md:min-w-[240px] shrink-0 snap-center md:snap-align-none flex-col rounded-lg bg-neutral-100 p-3 dark:bg-neutral-900"
                data-column-id={col.id}
              >
                {/* Column header */}
                <div className="mb-3 h-6 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-neutral-500 dark:text-neutral-400">
                    {col.title}
                  </h3>
                  <Badge variant="secondary" className="text-xs h-5">
                    {ideas.length}
                  </Badge>
                </div>

                {/* Cards */}
                <SortableContext items={ideas.map(i => i.id)} strategy={verticalListSortingStrategy}>
                  <div className="flex flex-1 flex-col gap-2 min-h-0 overflow-y-auto" data-column-scroll>
                    {ideas.map(idea => (
                      <KanbanCard
                        key={idea.id}
                        project={idea}
                        onClick={() => onIdeaClick(idea)}
                        onDelete={() => onDeleteIdea(idea.id)}
                        onMoveToColumn={(columnId) => onMoveToKanban(idea.id, columnId)}
                        columns={columns}
                        currentColumnId={col.id}
                        size="small"
                        columnTitle={col.title}
                      />
                    ))}
                    {ideas.length === 0 && (
                      <div className="flex-1 min-h-[60px] rounded-lg border-2 border-dashed border-neutral-200 dark:border-neutral-800 flex items-center justify-center">
                        <p className="text-xs text-muted-foreground">No ideas</p>
                      </div>
                    )}
                  </div>
                </SortableContext>
              </div>
            ))}
          </div>

          <DragOverlay>
            {activeIdea ? <KanbanCard project={activeIdea} size="small" /> : null}
          </DragOverlay>
        </DndContext>
      )}

      {/* Empty state when filters return nothing */}
      {columns.length > 0 && totalVisible === 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <Lightbulb className="h-16 w-16 text-muted-foreground/20 mb-4" />
          <p className="text-sm text-muted-foreground">
            {hasActiveFilters ? 'No ideas match your filters.' : 'No ideas yet. Create one to get started.'}
          </p>
        </div>
      )}
    </div>
  );
}
