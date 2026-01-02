'use client';

import { X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type Tag = {
  name: string;
  color: string;
  emoji?: string;
  icon?: string;
};

type ProjectGroup = {
  id: string;
  name: string;
  color: string;
  emoji?: string;
  icon?: string;
};

type FilterSectionProps = {
  tags: Tag[];
  projectGroups: ProjectGroup[];
  activeTags: string[];
  activeGroups: string[];
  hiddenTags: string[];
  hiddenGroups: string[];
  showUntagged: boolean;
  showUngrouped: boolean;
  onTagToggle: (tag: string) => void;
  onGroupToggle: (groupId: string) => void;
  onClearFilters: () => void;
  onToggleTagVisibility: (tag: string) => void;
  onToggleGroupVisibility: (groupId: string) => void;
  onToggleUntagged: () => void;
  onToggleUngrouped: () => void;
};

export function FilterSection({
  tags,
  projectGroups,
  activeTags,
  activeGroups,
  hiddenTags,
  hiddenGroups,
  showUntagged,
  showUngrouped,
  onTagToggle,
  onGroupToggle,
  onClearFilters,
}: FilterSectionProps) {
  const visibleTags = tags.filter(tag => !hiddenTags.includes(tag.name));
  const visibleGroups = projectGroups.filter(group => !hiddenGroups.includes(group.id));
  const hasActiveFilters = activeTags.length > 0 || activeGroups.length > 0 || showUntagged || showUngrouped;

  if (tags.length === 0 && projectGroups.length === 0) {
    return null;
  }

  return (
    <div className="border-t bg-muted/20">
      <div className="px-4 py-2">
        <div className="flex flex-wrap items-center gap-2">
          {/* Project Groups */}
          {visibleGroups.map(group => (
            <Badge
              key={group.id}
              variant={activeGroups.includes(group.id) ? "default" : "outline"}
              className={cn(
                "cursor-pointer transition-all hover:scale-105",
                activeGroups.includes(group.id) && "ring-2 ring-offset-1 ring-offset-background"
              )}
              style={{
                backgroundColor: activeGroups.includes(group.id) ? group.color : undefined,
                borderColor: group.color,
                color: activeGroups.includes(group.id) ? 'white' : group.color,
              }}
              onClick={() => onGroupToggle(group.id)}
            >
              {group.emoji && <span className="mr-1">{group.emoji}</span>}
              {group.name}
              {activeGroups.includes(group.id) && (
                <X className="ml-1 h-3 w-3" />
              )}
            </Badge>
          ))}

          {/* Separator if both groups and tags exist */}
          {visibleGroups.length > 0 && visibleTags.length > 0 && (
            <span className="text-muted-foreground/30">|</span>
          )}

          {/* Tags */}
          {visibleTags.map(tag => (
            <Badge
              key={tag.name}
              variant={activeTags.includes(tag.name) ? "default" : "outline"}
              className={cn(
                "cursor-pointer transition-all hover:scale-105",
                activeTags.includes(tag.name) && "ring-2 ring-offset-1 ring-offset-background"
              )}
              style={{
                backgroundColor: activeTags.includes(tag.name) ? tag.color : undefined,
                borderColor: tag.color,
                color: activeTags.includes(tag.name) ? 'white' : tag.color,
              }}
              onClick={() => onTagToggle(tag.name)}
            >
              {tag.emoji && <span className="mr-1">{tag.emoji}</span>}
              {tag.name}
              {activeTags.includes(tag.name) && (
                <X className="ml-1 h-3 w-3" />
              )}
            </Badge>
          ))}

          {/* Clear button */}
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs ml-auto"
              onClick={onClearFilters}
            >
              Clear
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
