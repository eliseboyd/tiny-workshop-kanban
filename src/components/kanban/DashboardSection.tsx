'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, Package, Tag as TagIcon, Hash } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import Image from 'next/image';

type Tag = {
  name: string;
  color: string;
  emoji?: string;
  icon?: string;
  count: number;
};

type ProjectGroup = {
  id: string;
  name: string;
  color: string;
  emoji?: string;
  icon?: string;
  count: number;
};

type DashboardSectionProps = {
  tags: Tag[];
  projectGroups: ProjectGroup[];
  onTagClick: (tag: string) => void;
  onProjectClick: (projectId: string) => void;
};

export function DashboardSection({
  tags,
  projectGroups,
  onTagClick,
  onProjectClick,
}: DashboardSectionProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  if (tags.length === 0 && projectGroups.length === 0) {
    return null;
  }

  return (
    <div className="border-b bg-gradient-to-br from-background via-background to-muted/20">
      <div className="px-4 py-3">
        <div 
          className="flex items-center justify-between cursor-pointer hover:bg-muted/30 rounded-lg px-3 py-2 -mx-3 transition-colors group"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-bold">Overview</h2>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>{projectGroups.length} projects</span>
              <span>•</span>
              <span>{tags.length} tags</span>
            </div>
          </div>
          {isExpanded ? (
            <ChevronUp className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
          ) : (
            <ChevronDown className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
          )}
        </div>

        {isExpanded && (
          <div className="mt-4 space-y-6">
            {/* Project Groups Masonry Grid */}
            {projectGroups.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    Project Groups
                  </h3>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                  {projectGroups.map(group => (
                    <button
                      key={group.id}
                      onClick={() => onProjectClick(group.id)}
                      className="group relative overflow-hidden rounded-xl border-2 transition-all hover:scale-105 hover:shadow-lg active:scale-95"
                      style={{
                        borderColor: group.color,
                        backgroundColor: `${group.color}08`,
                      }}
                    >
                      <div className="p-4 flex flex-col items-start gap-2">
                        <div className="flex items-center justify-between w-full">
                          {group.icon ? (
                            <div className="relative w-10 h-10 flex-shrink-0">
                              <Image
                                src={group.icon}
                                alt={group.name}
                                width={40}
                                height={40}
                                className="rounded-lg object-cover"
                                unoptimized
                              />
                            </div>
                          ) : group.emoji ? (
                            <span className="text-3xl">{group.emoji}</span>
                          ) : (
                            <div 
                              className="w-10 h-10 rounded-lg"
                              style={{ backgroundColor: group.color }}
                            />
                          )}
                          <Badge 
                            variant="secondary" 
                            className="h-6 text-xs font-semibold"
                            style={{
                              backgroundColor: `${group.color}20`,
                              color: group.color,
                              borderColor: group.color,
                            }}
                          >
                            {group.count}
                          </Badge>
                        </div>
                        <div className="w-full text-left">
                          <p 
                            className="font-semibold text-sm line-clamp-2 group-hover:underline"
                            style={{ color: group.color }}
                          >
                            {group.name}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {group.count} {group.count === 1 ? 'card' : 'cards'}
                          </p>
                        </div>
                      </div>
                      {/* Hover gradient overlay */}
                      <div 
                        className="absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity pointer-events-none"
                        style={{ backgroundColor: group.color }}
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Tags Masonry Grid */}
            {tags.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Hash className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    Tags
                  </h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  {tags.map(tag => (
                    <button
                      key={tag.name}
                      onClick={() => onTagClick(tag.name)}
                      className="group relative px-4 py-2 rounded-full border-2 transition-all hover:scale-105 hover:shadow-md active:scale-95"
                      style={{
                        borderColor: tag.color,
                        backgroundColor: `${tag.color}10`,
                      }}
                    >
                      <div className="flex items-center gap-2">
                        {tag.icon ? (
                          <div className="relative w-5 h-5 flex-shrink-0">
                            <Image
                              src={tag.icon}
                              alt={tag.name}
                              width={20}
                              height={20}
                              className="rounded object-cover"
                              unoptimized
                            />
                          </div>
                        ) : tag.emoji ? (
                          <span className="text-base">{tag.emoji}</span>
                        ) : null}
                        <span 
                          className="font-medium text-sm"
                          style={{ color: tag.color }}
                        >
                          #{tag.name}
                        </span>
                        <Badge 
                          variant="secondary" 
                          className="h-5 text-xs font-semibold ml-1"
                          style={{
                            backgroundColor: tag.color,
                            color: 'white',
                          }}
                        >
                          {tag.count}
                        </Badge>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Quick Stats */}
            <div className="flex items-center gap-4 pt-2 border-t text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Package className="h-3 w-3" />
                {projectGroups.reduce((acc, g) => acc + g.count, 0)} total cards in projects
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Hash className="h-3 w-3" />
                {tags.reduce((acc, t) => acc + t.count, 0)} total tag uses
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

