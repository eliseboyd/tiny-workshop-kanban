'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  DragStartEvent,
  DragOverEvent,
  DragEndEvent,
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { ProjectModal } from './ProjectModal';
import { SettingsModal } from './SettingsModal';
import { ModeToggle } from '@/components/mode-toggle';
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Settings, KanbanSquareDashed, Filter, X } from 'lucide-react';
import { updateProjectStatus, updateSettings, updateColumn, createColumn, deleteColumn, deleteProject, updateColumnsOrder, updateColumnOrder } from '@/app/actions';
import { Badge } from '@/components/ui/badge';

import { ClientDndWrapper } from './ClientDndWrapper';

export type Project = {
    id: string;
    title: string;
    description: string | null;
    richContent: string | null;
    materialsList: string | null;
    plans: string | null;
    inspiration: string | null;
    imageUrl: string | null;
    tags: string[] | null;
    attachments: any | null;
    status: string;
    position: number;
    createdAt: Date | null;
    updatedAt: Date | null;
    // Mapped from snake_case in Supabase
    rich_content?: string;
    image_url?: string;
    materials_list?: string;
};

export type SettingsData = {
    id: string;
    aiPromptTemplate: string;
    boardTitle: string;
    cardSize: string;
};

export type Column = {
    id: string;
    title: string;
    order: number;
};

type KanbanBoardProps = {
  initialProjects: any[]; // Loosely typed as we map them
  initialSettings: SettingsData;
  initialColumns: Column[];
};

import { v4 as uuidv4 } from 'uuid';

export function KanbanBoard({ initialProjects, initialSettings, initialColumns }: KanbanBoardProps) {
  const router = useRouter();
  
  // Map snake_case to camelCase for frontend state
  const mapProjects = (projs: any[]): Project[] => {
      return projs.map(p => ({
          ...p,
          richContent: p.rich_content || p.richContent,
          imageUrl: p.image_url || p.imageUrl,
          materialsList: p.materials_list || p.materialsList,
          plans: p.plans,
          inspiration: p.inspiration,
      }));
  };

  const [items, setItems] = useState<Project[]>(mapProjects(initialProjects));
  const [settingsState, setSettingsState] = useState<SettingsData>(initialSettings);
  const [cols, setCols] = useState<Column[]>(initialColumns);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [newProjectColumnId, setNewProjectColumnId] = useState<string | undefined>(undefined);
  
  const [isCreatingInColumn, setIsCreatingInColumn] = useState<string | null>(null);

  // Filter state
  const [activeTagFilter, setActiveTagFilter] = useState<string | null>(null);

  // Board title editing state
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState(initialSettings.boardTitle);
  const titleInputRef = useRef<HTMLInputElement>(null);

  // Sync items when props change
  useEffect(() => {
    setItems(mapProjects(initialProjects));
  }, [initialProjects]);
  
  useEffect(() => {
    setSettingsState(initialSettings);
    setTitleInput(initialSettings.boardTitle);
  }, [initialSettings]);

  useEffect(() => {
    setCols(initialColumns);
  }, [initialColumns]);

  // Collect all unique tags from all items
  const allTags = useMemo(() => {
      const tags = new Set<string>();
      items.forEach(item => {
          item.tags?.forEach(tag => tags.add(tag));
      });
      return Array.from(tags).sort();
  }, [items]);

  // Filter items based on active tag
  const filteredItems = useMemo(() => {
      if (!activeTagFilter) return items;
      return items.filter(item => item.tags?.includes(activeTagFilter));
  }, [items, activeTagFilter]);

  function findContainer(id: string) {
    if (cols.find(c => c.id === id)) return id;
    const item = items.find((i) => i.id === id);
    return item ? item.status : null;
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string);
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    const overId = over?.id;

    if (!overId || active.id === overId) return;

    const activeContainer = findContainer(active.id as string);
    const overContainer = findContainer(overId as string);

    if (!activeContainer || !overContainer || activeContainer === overContainer) {
      return;
    }

    // For DIFFERENT containers, we update state during drag over to show preview
    setItems((prev) => {
      const activeItems = prev.filter((i) => i.status === activeContainer);
      const overItems = prev.filter((i) => i.status === overContainer);
      
      const activeIndex = activeItems.findIndex((i) => i.id === active.id);
      const overIndex = overItems.findIndex((i) => i.id === overId);

      let newIndex;
      if (cols.find(c => c.id === overId)) {
        newIndex = overItems.length + 1;
      } else {
        const isBelowOverItem =
          over &&
          active.rect.current.translated &&
          active.rect.current.translated.top > over.rect.top + over.rect.height;

        const modifier = isBelowOverItem ? 1 : 0;
        newIndex = overIndex >= 0 ? overIndex + modifier : overItems.length + 1;
      }

      return prev.map((item) => {
        if (item.id === active.id) {
          return { ...item, status: overContainer, position: newIndex };
        }
        return item;
      });
    });
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    const activeId = active.id as string;
    const overId = over?.id as string;

    if (!overId) {
      setActiveId(null);
      return;
    }

    // Handle Column Sorting
    if (cols.find(c => c.id === activeId) && cols.find(c => c.id === overId)) {
        // ... existing column sort code ...
        const oldIndex = cols.findIndex(c => c.id === activeId);
        const newIndex = cols.findIndex(c => c.id === overId);

        if (oldIndex !== newIndex) {
            const newCols = arrayMove(cols, oldIndex, newIndex);
            setCols(newCols);
            updateColumnsOrder(newCols.map((col, index) => ({ id: col.id, order: index })));
        }
        setActiveId(null);
        return;
    }

    // Handle Item Sorting
    const activeContainer = findContainer(activeId);
    const overContainer = findContainer(overId);

    if (activeContainer && overContainer) {
       const activeIndex = items.findIndex((i) => i.id === activeId);
       const overIndex = items.findIndex((i) => i.id === overId);
       
       // Calculate final index
       let newIndex;
       if (cols.find(c => c.id === overId)) {
         // Dropped on a column header/empty space
         newIndex = items.filter(i => i.status === overContainer).length; 
       } else {
         // Dropped on another item
         // Find index of overId within its column
         const overColItems = items.filter(i => i.status === overContainer);
         const overIndexInCol = overColItems.findIndex(i => i.id === overId);

         const isBelowOverItem =
           over &&
           active.rect.current.translated &&
           active.rect.current.translated.top > over.rect.top + over.rect.height;

         const modifier = isBelowOverItem ? 1 : 0;
         // newIndex is within the column
         newIndex = overIndexInCol >= 0 ? overIndexInCol + modifier : overColItems.length;
       }

       // Optimistic update
       let newItems = [...items];
       const movedItem = { ...newItems[activeIndex], status: overContainer };
       
       // Remove from old position
       newItems.splice(activeIndex, 1);

       if (activeContainer === overContainer) {
           // Same column reorder logic - use arrayMove on original items for simplicity as activeIndex/overIndex are flat list indices
           // But we already spliced. Let's reload newItems from items and use arrayMove
           newItems = arrayMove(items, activeIndex, overIndex);
           setItems(newItems);
           
           // Persist reorder
           const columnItems = newItems.filter(i => i.status === activeContainer);
           const projectIds = columnItems.map(i => i.id);
           updateColumnOrder(activeContainer, projectIds);
       } else {
           // Cross-column logic
           
           // 1. Construct the correct ID order for the backend
           const destItems = items.filter(i => i.status === overContainer && i.id !== activeId);
           const destItemIds = destItems.map(i => i.id);
           const safeIndex = Math.min(Math.max(0, newIndex), destItemIds.length);
           destItemIds.splice(safeIndex, 0, activeId);
           
           // 2. Update Backend
           updateColumnOrder(overContainer, destItemIds);
           
           // 3. Update UI (Insert into correct position in flat list)
           const nextItemId = destItemIds[safeIndex + 1];
           // Find index of next item in our `newItems` (which already has movedItem removed)
           const nextItemIndex = nextItemId ? newItems.findIndex(i => i.id === nextItemId) : -1;
           
           if (nextItemIndex !== -1) {
               newItems.splice(nextItemIndex, 0, movedItem);
           } else {
               newItems.push(movedItem);
           }
           
           setItems(newItems);
       }
    }
    
    setActiveId(null);
  }

  const handleEditProject = (project: Project) => {
    setEditingProject(project);
    setNewProjectColumnId(undefined);
    setIsModalOpen(true);
  };

  const handleCreateProject = () => {
    // Default to first column for "New Project" button
    if (cols.length > 0) {
        setIsCreatingInColumn(cols[0].id);
        // Optional: scroll to column or focus
    }
  };

  const handleAddProjectToColumn = (columnId: string) => {
      setIsCreatingInColumn(columnId);
  };

  const handleConfirmCreate = async (columnId: string, title: string) => {
      setIsCreatingInColumn(null);
      if (title.trim()) {
          // Optimistic Update
          const tempId = uuidv4();
          const optimisticProject: Project = {
              id: tempId,
              title: title,
              status: columnId,
              position: items.filter(i => i.status === columnId).length,
              description: '',
              richContent: null,
              materialsList: null,
              plans: null,
              inspiration: null,
              imageUrl: null,
              tags: [],
              attachments: null,
              createdAt: new Date(),
              updatedAt: new Date(),
          };
          
          setItems(prev => [...prev, optimisticProject]);

          // Actually create
          await import('@/app/actions').then(mod => mod.createProject({ 
              title, 
              status: columnId 
          }));
      }
  };

  const handleCancelCreate = () => {
      setIsCreatingInColumn(null);
  };

  const handleCreateColumn = async () => {
      const title = prompt("Enter column title:");
      if (title) {
          await createColumn(title);
      }
  };

  const handleDeleteColumn = async (id: string) => {
      if (confirm("Are you sure you want to delete this column?")) {
          // Optimistic update
          setCols(prev => prev.filter(c => c.id !== id));
          await deleteColumn(id);
      }
  };

  const handleDeleteProject = async (id: string) => {
      if (confirm("Are you sure you want to delete this project?")) {
          setItems(prev => prev.filter(item => item.id !== id));
          await deleteProject(id);
      }
  };

  const handleBoardTitleClick = () => {
      setIsEditingTitle(true);
      setTimeout(() => titleInputRef.current?.focus(), 0);
  };

  const handleBoardTitleBlur = async () => {
      setIsEditingTitle(false);
      if (titleInput !== settingsState.boardTitle) {
          const newSettings = { ...settingsState, boardTitle: titleInput };
          setSettingsState(newSettings);
          await updateSettings({ boardTitle: titleInput });
      }
  };

  const handleColumnTitleChange = async (colId: string, newTitle: string) => {
      // Optimistic update
      setCols(prev => prev.map(c => c.id === colId ? { ...c, title: newTitle } : c));
      await updateColumn(colId, newTitle);
  };

  return (
    <>
      <div className="flex flex-col min-h-full">
        <div className="flex flex-col border-b">
            <div className="flex items-center justify-between p-4 pb-2">
            <div className="h-9 flex items-center">
                {isEditingTitle ? (
                    <Input
                        ref={titleInputRef}
                        value={titleInput}
                        onChange={(e) => setTitleInput(e.target.value)}
                        onBlur={handleBoardTitleBlur}
                        onKeyDown={(e) => e.key === 'Enter' && titleInputRef.current?.blur()}
                        className="text-2xl font-bold h-9 py-0 px-1 w-fit min-w-[200px] bg-transparent border-none focus-visible:ring-1"
                    />
                ) : (
                    <h1 
                        className="text-2xl font-bold cursor-text hover:bg-accent/50 rounded px-1 -ml-1 transition-colors"
                        onClick={handleBoardTitleClick}
                    >
                        {settingsState.boardTitle}
                    </h1>
                )}
            </div>
            <div className="flex md:hidden">
                <Sheet>
                    <SheetTrigger asChild>
                        <Button variant="ghost" size="icon" className="mr-2">
                            <Menu className="h-5 w-5" />
                        </Button>
                    </SheetTrigger>
                    <SheetContent side="left" className="w-[250px] sm:w-[300px]">
                        <SheetHeader className="mb-4">
                            <SheetTitle>Menu</SheetTitle>
                            <SheetDescription>
                                Manage your board settings and projects.
                            </SheetDescription>
                        </SheetHeader>
                        <div className="flex flex-col gap-4">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-medium">Theme</span>
                                <ModeToggle />
                            </div>
                            <Button variant="outline" className="justify-start" onClick={() => setIsSettingsOpen(true)}>
                                <Settings className="mr-2 h-4 w-4" /> Settings
                            </Button>
                            <Button variant="outline" className="justify-start" onClick={handleCreateColumn}>
                                <KanbanSquareDashed className="mr-2 h-4 w-4" /> Add Column
                            </Button>
                            <Button className="justify-start" onClick={handleCreateProject}>
                                <Plus className="mr-2 h-4 w-4" /> New Project
                            </Button>
                        </div>
                    </SheetContent>
                </Sheet>
            </div>
            <div className="hidden md:flex gap-2">
                <ModeToggle />
                <Button variant="outline" size="icon" onClick={() => setIsSettingsOpen(true)}>
                <Settings className="h-4 w-4" />
                </Button>
                <Button variant="outline" onClick={handleCreateColumn}>
                    <KanbanSquareDashed className="mr-2 h-4 w-4" /> Add Column
                </Button>
                <Button onClick={handleCreateProject}>
                <Plus className="mr-2 h-4 w-4" /> New Project
                </Button>
            </div>
            </div>

            {/* Filter Bar */}
            {allTags.length > 0 && (
                <div className="flex items-center gap-2 px-4 pb-2 overflow-x-auto">
                    <div className="flex items-center text-xs text-muted-foreground mr-2">
                        <Filter className="h-3 w-3 mr-1" />
                        Filters:
                    </div>
                    <div className="flex gap-2">
                        {allTags.map(tag => (
                            <Badge 
                                key={tag} 
                                variant={activeTagFilter === tag ? "default" : "outline"}
                                className="cursor-pointer hover:bg-primary/90 transition-colors"
                                onClick={() => setActiveTagFilter(activeTagFilter === tag ? null : tag)}
                            >
                                {tag}
                                {activeTagFilter === tag && <X className="ml-1 h-3 w-3" />}
                            </Badge>
                        ))}
                    </div>
                    {activeTagFilter && (
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-5 text-xs text-muted-foreground hover:text-foreground"
                            onClick={() => setActiveTagFilter(null)}
                        >
                            Clear
                        </Button>
                    )}
                </div>
            )}
        </div>

        <ClientDndWrapper 
            items={items}
            cols={cols}
            filteredItems={filteredItems}
            activeId={activeId}
            settingsState={settingsState}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
            handleEditProject={handleEditProject}
            handleColumnTitleChange={handleColumnTitleChange}
            handleDeleteColumn={handleDeleteColumn}
            handleDeleteProject={handleDeleteProject}
            handleAddProjectToColumn={handleAddProjectToColumn}
            isCreatingInColumn={isCreatingInColumn}
            onConfirmCreate={handleConfirmCreate}
            onCancelCreate={handleCancelCreate}
        />
      </div>
      {editingProject && (
        <ProjectModal
          project={editingProject}
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          existingTags={allTags}
        />
      )}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </>
  );
}
