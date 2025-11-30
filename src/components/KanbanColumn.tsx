'use client';

import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { Project, ProjectStatus } from '@/types';
import { ProjectCard } from './ProjectCard';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface KanbanColumnProps {
  id: ProjectStatus;
  title: string;
  projects: Project[];
}

export function KanbanColumn({ id, title, projects }: KanbanColumnProps) {
  const { setNodeRef } = useDroppable({
    id: id,
    data: {
      type: 'Column',
      status: id,
    },
  });

  return (
    <div className="flex flex-col h-full gap-4 min-w-[300px] bg-muted/50 p-4 rounded-lg">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-lg">{title}</h3>
        <span className="text-sm text-muted-foreground bg-muted px-2 py-0.5 rounded-md border">
          {projects.length}
        </span>
      </div>
      
      <ScrollArea className="h-full">
        <div ref={setNodeRef} className={cn("flex flex-col gap-3 min-h-[150px]", projects.length === 0 && "justify-center items-center border-2 border-dashed border-muted-foreground/20 rounded-lg")}>
          <SortableContext items={projects.map(p => p.id)} strategy={verticalListSortingStrategy}>
            {projects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </SortableContext>
          {projects.length === 0 && (
            <span className="text-sm text-muted-foreground">No projects</span>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}



