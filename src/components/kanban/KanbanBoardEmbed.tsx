'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  DragStartEvent,
  DragOverEvent,
  DragEndEvent,
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { ProjectModal } from './ProjectModal';
import { updateProjectStatus, updateColumnOrder, toggleProjectPinned } from '@/app/actions';
import { ClientDndWrapper } from './ClientDndWrapper';
import { Project, Column, SettingsData } from './KanbanBoard';
import { v4 as uuidv4 } from 'uuid';

type KanbanBoardEmbedProps = {
  initialProjects: any[];
  initialSettings: SettingsData;
  initialColumns: Column[];
};

export function KanbanBoardEmbed({ initialProjects, initialSettings, initialColumns }: KanbanBoardEmbedProps) {
  const router = useRouter();
  
  // Map snake_case to camelCase
  const mapProjects = (projs: any[]): Project[] => {
    return projs.map(p => ({
      ...p,
      richContent: p.rich_content || p.richContent,
      imageUrl: p.image_url || p.imageUrl,
      materialsList: p.materials_list || p.materialsList,
      parentProjectId: p.parent_project_id || p.parentProjectId,
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

  // Sync items when props change
  useEffect(() => {
    setItems(mapProjects(initialProjects));
  }, [initialProjects]);
  
  useEffect(() => {
    setSettingsState(initialSettings);
  }, [initialSettings]);

  useEffect(() => {
    setCols(initialColumns);
  }, [initialColumns]);

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
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;
    const activeContainer = findContainer(activeId);
    const overContainer = findContainer(overId);
    if (!activeContainer || !overContainer || activeContainer === overContainer) return;

    setItems((prevItems) => {
      const activeIndex = prevItems.findIndex((i) => i.id === activeId);
      const overIndex = prevItems.findIndex((i) => i.id === overId);
      const activeItem = prevItems[activeIndex];
      if (activeItem) {
        return arrayMove(prevItems, activeIndex, overIndex !== -1 ? overIndex : prevItems.length - 1).map((item, idx) =>
          item.id === activeId ? { ...item, status: overContainer, position: idx } : item
        );
      }
      return prevItems;
    });
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const activeContainer = findContainer(activeId);
    const overContainer = findContainer(overId);

    if (!activeContainer || !overContainer) return;

    const activeIndex = items.findIndex((i) => i.id === activeId);
    const overIndex = items.findIndex((i) => i.id === overId);

    if (activeIndex !== overIndex || activeContainer !== overContainer) {
      const newItems = arrayMove(items, activeIndex, overIndex !== -1 ? overIndex : items.length - 1);
      const itemsInColumn = newItems.filter((i) => i.status === overContainer);
      const reorderedItems = newItems.map((item) => {
        if (item.id === activeId) {
          return { ...item, status: overContainer, position: itemsInColumn.findIndex((i) => i.id === item.id) };
        }
        return item;
      });
      setItems(reorderedItems);

      const targetItem = reorderedItems.find((i) => i.id === activeId);
      if (targetItem) {
        await updateProjectStatus(activeId, overContainer, targetItem.position);
      }
      const columnProjectIds = reorderedItems.filter((i) => i.status === overContainer).map((i) => i.id);
      await updateColumnOrder(overContainer, columnProjectIds);

      router.refresh();
    }
  }

  const handleEditProject = (project: Project) => {
    setEditingProject(project);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingProject(null);
    router.refresh();
  };

  const handleTogglePin = async (id: string, pinned: boolean) => {
    await toggleProjectPinned(id, pinned);
    setItems(prevItems =>
      prevItems.map(item =>
        item.id === id ? { ...item, pinned } : item
      )
    );
    router.refresh();
  };

  return (
    <>
      <div className="flex flex-col h-screen w-full overflow-hidden">
        {/* Header */}
        <div className="flex-shrink-0 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex items-center justify-between p-4">
            <h1 className="text-2xl font-bold tracking-tight">
              {settingsState.boardTitle || 'Kanban Board'}
            </h1>
            <div className="text-xs text-muted-foreground">
              Embed View
            </div>
          </div>
        </div>

        {/* Kanban Board */}
        <div className="flex-1 overflow-hidden">
          <ClientDndWrapper
            items={items}
            cols={cols}
            filteredItems={items}
            activeId={activeId}
            settingsState={settingsState}
            hiddenColumns={[]}
            onToggleColumnVisibility={() => {}}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
            handleEditProject={handleEditProject}
            handleColumnTitleChange={async () => {}}
            handleDeleteColumn={async () => {}}
            handleDeleteProject={async () => {}}
            handleTogglePin={handleTogglePin}
            handleAddProjectToColumn={() => {}}
            isCreatingInColumn={null}
            onConfirmCreate={async () => {}}
            onCancelCreate={() => {}}
          />
        </div>
      </div>

      {/* Project Modal */}
      {editingProject && (
        <ProjectModal
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          project={editingProject}
        />
      )}
    </>
  );
}

