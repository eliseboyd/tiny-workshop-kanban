'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, X } from 'lucide-react';
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
  onToggleTagVisibility,
  onToggleGroupVisibility,
  onToggleUntagged,
  onToggleUngrouped,
}: FilterSectionProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const visibleTags = tags.filter(tag => !hiddenTags.includes(tag.name));
  const visibleGroups = projectGroups.filter(group => !hiddenGroups.includes(group.id));
  const hasActiveFilters = activeTags.length > 0 || activeGroups.length > 0 || showUntagged || showUngrouped;

  if (tags.length === 0 && projectGroups.length === 0) {
    return null;
  }

  return (
    <div className="border-t bg-muted/20">
      <div className="px-4 py-2">
        <div 
          className="flex items-center justify-between cursor-pointer hover:bg-muted/50 rounded px-2 py-1 -mx-2 transition-colors"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold">Filters</h3>
            {hasActiveFilters && (
              <Badge variant="secondary" className="h-5 text-xs">
                {activeTags.length + activeGroups.length}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  onClearFilters();
                }}
              >
                Clear all
              </Button>
            )}
            {isExpanded ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        </div>

        {isExpanded && (
          <div className="mt-3 space-y-4">
            {/* Special Filters */}
            <div className="flex flex-wrap gap-2 pb-2 border-b">
              <Badge
                variant={showUngrouped ? "default" : "outline"}
                className={cn(
                  "cursor-pointer transition-all hover:scale-105",
                  showUngrouped && "ring-2 ring-offset-1 ring-offset-background ring-primary"
                )}
                onClick={onToggleUngrouped}
              >
                <span className="mr-1">📋</span>
                Ungrouped
                {showUngrouped && <X className="ml-1 h-3 w-3" />}
              </Badge>
              <Badge
                variant={showUntagged ? "default" : "outline"}
                className={cn(
                  "cursor-pointer transition-all hover:scale-105",
                  showUntagged && "ring-2 ring-offset-1 ring-offset-background ring-primary"
                )}
                onClick={onToggleUntagged}
              >
                <span className="mr-1">🏷️</span>
                Untagged
                {showUntagged && <X className="ml-1 h-3 w-3" />}
              </Badge>
            </div>

            {/* Project Groups */}
            {projectGroups.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">Projects</span>
                  <span className="text-xs text-muted-foreground">
                    {visibleGroups.length}/{projectGroups.length} visible
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {visibleGroups.map(group => (
                    <Badge
                      key={group.id}
                      variant={activeGroups.includes(group.id) ? "default" : "outline"}
                      className={cn(
                        "cursor-pointer transition-all hover:scale-105 group relative",
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
                  {hiddenGroups.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs text-muted-foreground"
                      onClick={() => {
                        // Show first hidden group
                        const firstHidden = projectGroups.find(g => hiddenGroups.includes(g.id));
                        if (firstHidden) onToggleGroupVisibility(firstHidden.id);
                      }}
                    >
                      +{hiddenGroups.length} hidden
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* Tags */}
            {tags.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">Tags</span>
                  <span className="text-xs text-muted-foreground">
                    {visibleTags.length}/{tags.length} visible
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {visibleTags.map(tag => (
                    <Badge
                      key={tag.name}
                      variant={activeTags.includes(tag.name) ? "default" : "outline"}
                      className={cn(
                        "cursor-pointer transition-all hover:scale-105 group relative",
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
                  {hiddenTags.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs text-muted-foreground"
                      onClick={() => {
                        // Show first hidden tag
                        const firstHidden = tags.find(t => hiddenTags.includes(t.name));
                        if (firstHidden) onToggleTagVisibility(firstHidden.name);
                      }}
                    >
                      +{hiddenTags.length} hidden
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

