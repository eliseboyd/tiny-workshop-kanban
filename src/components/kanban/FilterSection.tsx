'use client';

import { ReactNode } from 'react';
import { X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import styles from './FilterSection.module.css';

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
  actions?: ReactNode;
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
  onToggleUntagged,
  actions,
}: FilterSectionProps) {
  const visibleTags = tags.filter(tag => !hiddenTags.includes(tag.name));
  const visibleGroups = projectGroups.filter(group => !hiddenGroups.includes(group.id));
  const hasActiveFilters = activeTags.length > 0 || activeGroups.length > 0 || showUntagged || showUngrouped;
  const hasFilters = tags.length > 0 || projectGroups.length > 0;

  if (!hasFilters && !actions) {
    return null;
  }

  return (
    <div className={styles.Root}>
      <div className={styles.Inner}>
        <div className={styles.Row}>
          {/* Project Groups */}
          {visibleGroups.map(group => (
            <Badge
              key={group.id}
              variant={activeGroups.includes(group.id) ? "default" : "outline"}
              className={cn(styles.Chip, activeGroups.includes(group.id) && styles.ChipActive)}
              style={{
                backgroundColor: activeGroups.includes(group.id) ? group.color : undefined,
                borderColor: group.color,
                color: activeGroups.includes(group.id) ? 'white' : group.color,
              }}
              onClick={() => onGroupToggle(group.id)}
            >
              {group.emoji && <span className={styles.ChipEmoji}>{group.emoji}</span>}
              {group.name}
              {activeGroups.includes(group.id) && (
                <X className={styles.ChipClearIcon} />
              )}
            </Badge>
          ))}

          {/* Separator if both groups and tags exist */}
          {visibleGroups.length > 0 && visibleTags.length > 0 && (
            <span className={styles.Separator}>|</span>
          )}

          {/* Tags */}
          {visibleTags.map(tag => (
            <Badge
              key={tag.name}
              variant={activeTags.includes(tag.name) ? "default" : "outline"}
              className={cn(styles.Chip, activeTags.includes(tag.name) && styles.ChipActive)}
              style={{
                backgroundColor: activeTags.includes(tag.name) ? tag.color : undefined,
                borderColor: tag.color,
                color: activeTags.includes(tag.name) ? 'white' : tag.color,
              }}
              onClick={() => onTagToggle(tag.name)}
            >
              {tag.emoji && <span className={styles.ChipEmoji}>{tag.emoji}</span>}
              {tag.name}
              {activeTags.includes(tag.name) && (
                <X className={styles.ChipClearIcon} />
              )}
            </Badge>
          ))}

          {/* Untagged filter */}
          {tags.length > 0 && (
            <Badge
              variant={showUntagged ? "default" : "outline"}
              className={cn(styles.Chip, showUntagged && styles.ChipActive)}
              onClick={() => onToggleUntagged()}
            >
              Untagged
              {showUntagged && (
                <X className={styles.ChipClearIcon} />
              )}
            </Badge>
          )}

          {/* Clear button */}
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              className={styles.ClearButton}
              onClick={onClearFilters}
            >
              Clear
            </Button>
          )}

          {/* Injected actions (e.g. Add Column / New Project) */}
          {actions && (
            <div className={styles.Actions}>
              {actions}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
