'use client';

import { useEffect, useState, useMemo } from 'react';
import {
  DndContext,
  DragOverlay,
  useSensors,
  useSensor,
  PointerSensor,
  KeyboardSensor,
  DragStartEvent,
  DragOverEvent,
  DragEndEvent,
  defaultDropAnimationSideEffects,
  DropAnimation,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates, arrayMove } from '@dnd-kit/sortable';
import { Project, ProjectStatus, COLUMNS } from '@/types';
import { KanbanColumn } from './KanbanColumn';
import { ProjectCard } from './ProjectCard';
import { createPortal } from 'react-dom';
import { AddProjectDialog } from './AddProjectDialog';

export function KanbanBoard() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // Minimum distance to start dragging
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    setIsMounted(true);
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      const res = await fetch('/api/projects');
      if (res.ok) {
        const data = await res.json();
        setProjects(data);
      }
    } catch (error) {
      console.error('Failed to fetch projects:', error);
    }
  };

  const handleAddProject = async (newProjectData: { title: string; description: string; status: ProjectStatus }) => {
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newProjectData),
      });
      
      if (res.ok) {
        const savedProject = await res.json();
        setProjects([...projects, savedProject]);
      }
    } catch (error) {
      console.error('Failed to add project:', error);
    }
  };

  const updateProjectsOrder = async (updatedProjects: Project[]) => {
    try {
      await fetch('/api/projects/batch', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projects: updatedProjects }),
      });
    } catch (error) {
      console.error('Failed to update projects order:', error);
      // Optionally revert state here
    }
  };

  const columns = useMemo(() => {
    const cols: Record<ProjectStatus, Project[]> = {
      'todo': [],
      'in-progress': [],
      'done': [],
    };
    
    // Sort by order field
    const sorted = [...projects].sort((a, b) => a.order - b.order);
    
    sorted.forEach((project) => {
      if (cols[project.status]) {
        cols[project.status].push(project);
      }
    });
    return cols;
  }, [projects]);

  function onDragStart(event: DragStartEvent) {
    if (event.active.data.current?.type === 'Project') {
      setActiveProject(event.active.data.current.project);
    }
  }

  function onDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id;
    const overId = over.id;

    if (activeId === overId) return;

    const isActiveProject = active.data.current?.type === 'Project';
    const isOverProject = over.data.current?.type === 'Project';
    const isOverColumn = over.data.current?.type === 'Column';

    if (!isActiveProject) return;

    // Dragging project over another project
    if (isActiveProject && isOverProject) {
      setProjects((projects) => {
        const activeIndex = projects.findIndex((p) => p.id === activeId);
        const overIndex = projects.findIndex((p) => p.id === overId);

        if (projects[activeIndex].status !== projects[overIndex].status) {
          const newProjects = [...projects];
          newProjects[activeIndex] = {
            ...newProjects[activeIndex],
            status: projects[overIndex].status,
          };
          return arrayMove(newProjects, activeIndex, overIndex);
        }

        return arrayMove(projects, activeIndex, overIndex);
      });
    }

    // Dragging project over a column (empty or not, but targeting column container)
    if (isActiveProject && isOverColumn) {
        const overColumnStatus = over.id as ProjectStatus;
        
        setProjects((projects) => {
          const activeIndex = projects.findIndex((p) => p.id === activeId);
          if (projects[activeIndex].status !== overColumnStatus) {
             const newProjects = [...projects];
             newProjects[activeIndex] = {
                ...newProjects[activeIndex],
                status: overColumnStatus,
             };
             return arrayMove(newProjects, activeIndex, activeIndex); // Just update status, let sortable handle position? No, reorder happens in DragEnd mostly, but DragOver needs visual update.
             // Actually, if moving to empty column, we just change status.
          }
          return projects;
        });
    }
  }

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    
    // Reset active project
    setActiveProject(null);

    if (!over) return;

    const activeId = active.id;
    const overId = over.id;

    // Calculate new order for all projects and save
    // We need to re-calculate orders based on the current state array which has been modified by DragOver/DragEnd
    // Wait, DragOver modifies state optimistically?
    // Yes, useSortable expects the array to be updated.

    // Final reorder check
    if (activeId !== overId) {
        setProjects((items) => {
            const oldIndex = items.findIndex((item) => item.id === activeId);
            const newIndex = items.findIndex((item) => item.id === overId);
            const newItems = arrayMove(items, oldIndex, newIndex);
            
            // We need to update 'order' field for persistence
            // We can just re-index everything or just the affected ones. 
            // Simplest is to re-index all, or at least the ones in the affected columns.
            
            // However, the state update in DragEnd might overlap with DragOver. 
            // DragOver handles cross-column movement visually. 
            // DragEnd handles sorting within the same column or final drop.
            
            return newItems;
        });
    }
    
    // Trigger backend update after state settles
    // Using a timeout to let state update first, or just pass the new state if we computed it.
    // Better to do it in a useEffect or just compute it here.
    
    // Let's re-read the projects state? No, closure.
    // We should compute the new state and pass it to update function.
  }
  
  // We need to sync the 'order' property of the projects with their index in the array
  // whenever the array changes due to drag operations, so persistence works.
  // But doing it on every DragOver is expensive API wise.
  // We should do it on DragEnd.
  
  // Improved onDragEnd:
  const handleDragEnd = (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveProject(null);

      if (!over) return;

      const activeId = active.id;
      const overId = over.id;

      // If dropped on a column container directly (empty column), we handled status in DragOver.
      // Just need to ensure order is correct.
      
      setProjects((currentProjects) => {
          let newProjects = [...currentProjects];
          const activeIndex = newProjects.findIndex(p => p.id === activeId);
          const overIndex = newProjects.findIndex(p => p.id === overId);

          if (activeIndex !== -1 && overIndex !== -1 && activeIndex !== overIndex) {
              newProjects = arrayMove(newProjects, activeIndex, overIndex);
          }

          // Now update 'order' fields based on the new array order
          // We only really care about relative order within a status, but global order is fine too if we filter by status.
          // Actually, our API sorts by 'order' global field? 
          // In the GET route: SELECT * FROM projects ORDER BY "order" ASC
          // So the array index in 'projects' (which is sorted by order initially) should map to 'order'.
          
          // Let's reassign 'order' based on the current array index
          const reorderedProjects = newProjects.map((p, index) => ({
              ...p,
              order: index
          }));
          
          // Send to backend
          updateProjectsOrder(reorderedProjects);
          
          return reorderedProjects;
      });
  };


  const dropAnimation: DropAnimation = {
    sideEffects: defaultDropAnimationSideEffects({
      styles: {
        active: {
          opacity: '0.5',
        },
      },
    }),
  };

  if (!isMounted) return null;

  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Project Board</h1>
        <AddProjectDialog onAdd={handleAddProject} />
      </div>
      
      <DndContext
        sensors={sensors}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="flex h-full gap-6 overflow-x-auto pb-4">
          {COLUMNS.map((col) => (
            <KanbanColumn
              key={col.id}
              id={col.id}
              title={col.title}
              projects={columns[col.id]}
            />
          ))}
        </div>

        {createPortal(
          <DragOverlay dropAnimation={dropAnimation}>
            {activeProject && <ProjectCard project={activeProject} />}
          </DragOverlay>,
          document.body
        )}
      </DndContext>
    </div>
  );
}



