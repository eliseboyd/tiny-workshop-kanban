'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Project, Column } from './KanbanBoard';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { useRef, useState, useEffect } from 'react';

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
} from "@/components/ui/context-menu"
import { Trash2, Pin, ListTodo, MoveRight } from 'lucide-react';

type KanbanCardProps = {
  project: Project;
  onClick?: () => void;
  onDelete?: () => void;
  onTogglePin?: (pinned: boolean) => void;
  onMoveToColumn?: (columnId: string) => void;
  columns?: Column[];
  currentColumnId?: string;
  size?: string; // compact, small, medium
  columnTitle?: string;
};

export function KanbanCard({ project, onClick, onDelete, onTogglePin, onMoveToColumn, columns = [], currentColumnId, size = 'medium', columnTitle }: KanbanCardProps) {
  // Touch handling to distinguish between scroll and tap
  const touchStartPos = useRef<{ x: number; y: number; time: number } | null>(null);
  const isTouchDevice = useRef(false);
  const [longPressTriggered, setLongPressTriggered] = useState(false);
  const [contextMenuOpen, setContextMenuOpen] = useState(false);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  
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
    },
    disabled: longPressTriggered, // Disable drag when long press menu is open
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

  const handleTouchStart = (e: React.TouchEvent) => {
    isTouchDevice.current = true;
    touchStartPos.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
      time: Date.now(),
    };
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartPos.current) return;

    // Don't open modal if context menu is/was open
    if (contextMenuOpen) {
      touchStartPos.current = null;
      return;
    }

    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;
    const timeDiff = Date.now() - touchStartPos.current.time;
    
    // Calculate movement distance
    const deltaX = Math.abs(touchEndX - touchStartPos.current.x);
    const deltaY = Math.abs(touchEndY - touchStartPos.current.y);
    
    // Threshold: if moved less than 10px and touch was less than 300ms, it's a tap
    const MOVEMENT_THRESHOLD = 10;
    const TIME_THRESHOLD = 300;
    
    if (deltaX < MOVEMENT_THRESHOLD && deltaY < MOVEMENT_THRESHOLD && timeDiff < TIME_THRESHOLD) {
      // This is an intentional tap, not a scroll
      if (!isDragging) {
        onClick?.();
      }
    }
    
    touchStartPos.current = null;
  };

  const handleClick = (e: React.MouseEvent) => {
    // Don't open modal if context menu is open
    if (contextMenuOpen) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    
    // Only handle mouse clicks (desktop), not touch events
    if (!isTouchDevice.current && !isDragging) {
      onClick?.();
    }
  };

  // Detect if device supports touch
  useEffect(() => {
    if (typeof window !== 'undefined') {
      isTouchDevice.current = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    }
  }, []);

  // Re-enable drag on all devices - the sensors handle mobile properly now
  // Only disable when context menu is actually open
  const cardListeners = contextMenuOpen ? {} : listeners;

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...cardListeners}>
      <ContextMenu onOpenChange={setContextMenuOpen}>
      <ContextMenuTrigger asChild>
      <Card 
        className={cn(
          "cursor-grab active:cursor-grabbing hover:shadow-md transition-all p-0 gap-0 overflow-hidden select-none",
          !contextMenuOpen && "active:scale-[0.98] active:shadow-lg",
          project.pinned && "border-l-2 border-l-primary/30"
        )}
        onClick={handleClick}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onContextMenu={(e) => {
          // Prevent text selection on long press
          e.preventDefault();
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
        <CardHeader className={cn(contentPadding, "pb-2 space-y-0 relative")}>
          {project.pinned && (
            <Pin className="absolute top-2 right-2 h-3 w-3 text-muted-foreground/40 fill-current" />
          )}
          {project.isTask && (
            <ListTodo className={cn(
              "absolute top-2 h-3 w-3 text-blue-500/60",
              project.pinned ? "right-6" : "right-2"
            )} />
          )}
          <CardTitle className={cn(
            titleSize, 
            "font-medium leading-tight",
            (project.pinned || project.isTask) && "pr-6",
            (project.pinned && project.isTask) && "pr-10",
            columnTitle?.toLowerCase() === 'done' && "line-through text-muted-foreground"
          )}>
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
        <ContextMenuItem onClick={(e) => {
            e.stopPropagation();
            onTogglePin?.(!project.pinned);
        }}>
          <Pin className="mr-2 h-4 w-4" />
          {project.pinned ? 'Unpin' : 'Pin to Top'}
        </ContextMenuItem>
        
        {/* Move to Column submenu */}
        {columns && columns.length > 0 && onMoveToColumn && (
          <ContextMenuSub>
            <ContextMenuSubTrigger>
              <MoveRight className="mr-2 h-4 w-4" />
              Move to...
            </ContextMenuSubTrigger>
            <ContextMenuSubContent>
              {columns
                .filter(col => col.id !== currentColumnId)
                .map(col => (
                  <ContextMenuItem
                    key={col.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onMoveToColumn(col.id);
                    }}
                  >
                    {col.title}
                  </ContextMenuItem>
                ))}
            </ContextMenuSubContent>
          </ContextMenuSub>
        )}
        
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
