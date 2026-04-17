'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Trash2, Pin, ListTodo, MoveRight, ArrowRightLeft } from 'lucide-react';

// Tiny neutral-gray placeholder (1x1 PNG) shown while the real cover image
// loads. Keeps cards from flashing a blank rectangle when images come from
// slow external origins (pollinations.ai) or the Supabase CDN cold path.
const CARD_BLUR_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkaAAAAIUAhMvrAjgAAAAASUVORK5CYII=';

function getPatternImage(id: string): string {
  const hash = id.split('').reduce((acc, c, i) => acc + c.charCodeAt(0) * (i + 1), 0);

  // Use rgb() to avoid needing to URL-encode '#' in hex values
  const colors = [
    'rgb(148,163,184)', // slate
    'rgb(167,139,250)', // violet
    'rgb(96,165,250)',  // blue
    'rgb(52,211,153)',  // emerald
    'rgb(251,146,60)',  // orange
    'rgb(244,114,182)', // pink
    'rgb(45,212,191)',  // teal
    'rgb(250,204,21)',  // amber
  ];

  const c = colors[hash % colors.length];

  const svgs = [
    // Diagonal hatching
    `<svg xmlns='http://www.w3.org/2000/svg' width='8' height='8'><path d='M-1,1 l2,-2 M0,8 l8,-8 M7,9 l2,-2' stroke='${c}' stroke-width='0.8' opacity='0.4'/></svg>`,
    // Dots
    `<svg xmlns='http://www.w3.org/2000/svg' width='10' height='10'><circle cx='5' cy='5' r='1.5' fill='${c}' opacity='0.4'/></svg>`,
    // Grid
    `<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12'><path d='M 12 0 L 0 0 0 12' fill='none' stroke='${c}' stroke-width='0.6' opacity='0.4'/></svg>`,
    // Diamonds
    `<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12'><polygon points='6,0 12,6 6,12 0,6' fill='none' stroke='${c}' stroke-width='0.7' opacity='0.4'/></svg>`,
    // Dotted grid
    `<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12'><circle cx='6' cy='6' r='0.9' fill='${c}' opacity='0.5'/><path d='M6,0 V12 M0,6 H12' stroke='${c}' stroke-width='0.4' opacity='0.2'/></svg>`,
    // Chevrons
    `<svg xmlns='http://www.w3.org/2000/svg' width='10' height='10'><path d='M0,5 L5,0 L10,5 M0,10 L5,5 L10,10' fill='none' stroke='${c}' stroke-width='0.7' opacity='0.4'/></svg>`,
  ];

  return `url("data:image/svg+xml,${encodeURIComponent(svgs[(hash >> 4) % svgs.length])}")`;
}

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
  className?: string;
};

export function KanbanCard({ project, onClick, onDelete, onTogglePin, onMoveToColumn, columns = [], currentColumnId, size = 'medium', columnTitle, className }: KanbanCardProps) {
  // Touch handling to distinguish between scroll and tap
  const touchStartPos = useRef<{ x: number; y: number; time: number } | null>(null);
  // Start as false so server and first client render match; detect after mount.
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const touch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time post-mount touch detection to avoid SSR hydration mismatch
    if (touch) setIsTouchDevice(true);
  }, []);
  const [longPressTriggered, setLongPressTriggered] = useState(false);
  const [contextMenuOpen, setContextMenuOpen] = useState(false);
  const [moveSheetOpen, setMoveSheetOpen] = useState(false);
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
  /** Ideas (and other small cards) show AI summary; compact strip stays title-only. */
  const showDescription = !isCompact && isSmall && !!project.description?.trim();

  const handleTouchStart = (e: React.TouchEvent) => {
    setIsTouchDevice(true);
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
    if (!isTouchDevice && !isDragging) {
      onClick?.();
    }
  };

  // Disable drag on mobile devices - use context menu instead (best practice)
  // Only enable drag listeners on desktop (non-touch devices)
  const cardListeners = (isTouchDevice || contextMenuOpen) ? {} : listeners;

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...cardListeners} className={className}>
      <ContextMenu onOpenChange={setContextMenuOpen}>
      <ContextMenuTrigger asChild>
      <Card 
        className={cn(
          "hover:shadow-md transition-all p-0 gap-0 overflow-hidden select-none relative group",
          !isTouchDevice && "cursor-grab active:cursor-grabbing",
          !contextMenuOpen && !isTouchDevice && "active:scale-[0.98] active:shadow-lg",
          project.pinned && "border-l-2 border-l-primary/30",
          className
        )}
        onClick={handleClick}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onContextMenu={(e) => {
          // Prevent text selection on long press (mobile only)
          // On desktop, letting Radix handle this is required for the context menu to open
          if (isTouchDevice) {
            e.preventDefault();
          }
        }}
      >
        {!isCompact && (
          <div className={cn("relative w-full overflow-hidden", imageHeight)}>
            {project.imageUrl ? (
              <Image
                src={project.imageUrl}
                alt={project.title}
                fill
                sizes="240px"
                style={{ objectFit: 'cover' }}
                placeholder="blur"
                blurDataURL={CARD_BLUR_DATA_URL}
              />
            ) : (
              <div
                className="w-full h-full bg-muted/40"
                style={{ backgroundImage: getPatternImage(project.id) }}
              />
            )}
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
        
        {/* Mobile Move Button - Only show on touch devices when columns available */}
        {isTouchDevice && columns && columns.length > 1 && onMoveToColumn && (
          <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity md:hidden">
            <Sheet open={moveSheetOpen} onOpenChange={setMoveSheetOpen}>
              <SheetTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-7 px-2 shadow-md"
                >
                  <ArrowRightLeft className="h-3 w-3 mr-1" />
                  Move
                </Button>
              </SheetTrigger>
              <SheetContent side="bottom" className="h-auto">
                <SheetHeader>
                  <SheetTitle>Move to Column</SheetTitle>
                </SheetHeader>
                <div className="grid gap-2 py-4">
                  {columns
                    .filter(col => col.id !== currentColumnId)
                    .map(col => (
                      <Button
                        key={col.id}
                        variant="outline"
                        className="w-full justify-start"
                        onClick={(e) => {
                          e.stopPropagation();
                          onMoveToColumn(col.id);
                          setMoveSheetOpen(false);
                        }}
                      >
                        <MoveRight className="mr-2 h-4 w-4" />
                        {col.title}
                      </Button>
                    ))}
                </div>
              </SheetContent>
            </Sheet>
          </div>
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
