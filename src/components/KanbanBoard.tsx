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

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsMounted(true);
    fetchProjects();
  }, []);

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



