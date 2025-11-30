'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Project } from './KanbanBoard';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import { Trash2 } from 'lucide-react';

type KanbanCardProps = {
  project: Project;
  onClick?: () => void;
  onDelete?: () => void;
  size?: string; // compact, small, medium
};

export function KanbanCard({ project, onClick, onDelete, size = 'medium' }: KanbanCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ 
    id: project?.id || 'temp-id',
    data: {
        type: 'Project',
        project,
    }
  });

  if (!project) return null;

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  // Size variants
  const isCompact = size === 'compact';
  const isSmall = size === 'small';
  const isMedium = size === 'medium';

  const imageHeight = isCompact ? 'h-0 hidden' : isSmall ? 'h-32' : 'h-40';
  const contentPadding = isCompact ? 'p-2' : 'p-4';
  const titleSize = isCompact ? 'text-sm' : 'text-base';
  const showDescription = false;

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="touch-none">
      <ContextMenu>
      <ContextMenuTrigger>
      <Card 
        className="cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow p-0 gap-0 overflow-hidden"
        onClick={(e) => {
            // Prevent click when dragging (optional, but good UX)
            if (!isDragging) {
                onClick?.();
            }
        }}
      >
        {project.imageUrl && !isCompact && (
          <div className={cn("relative w-full bg-muted/20", imageHeight)}>
              <Image
                src={project.imageUrl}
                alt={project.title}
                fill
                className="object-cover"
              />
            </div>
          )}
        <CardHeader className={cn(contentPadding, "pb-2 space-y-0")}>
          <CardTitle className={cn(titleSize, "font-medium leading-tight")}>
            {project.title}
          </CardTitle>
          {/* Tags */}
          {project.tags && project.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
                {project.tags.map(tag => (
                    <Badge key={tag} variant="secondary" className="text-[10px] h-5 px-1.5 rounded-sm">
                        {tag}
                    </Badge>
                ))}
            </div>
          )}
        </CardHeader>
        {showDescription && (
          <CardContent className={cn(contentPadding, "pt-2")}>
          <p className="text-xs text-muted-foreground line-clamp-3">
            {project.description}
          </p>
        </CardContent>
        )}
        {isCompact && (
             <div className="pb-2"></div>
        )}
      </Card>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem className="text-destructive focus:text-destructive" onClick={(e) => {
            e.stopPropagation();
            onDelete?.();
        }}>
          <Trash2 className="mr-2 h-4 w-4" />
          Delete
        </ContextMenuItem>
      </ContextMenuContent>
      </ContextMenu>
    </div>
  );
}
