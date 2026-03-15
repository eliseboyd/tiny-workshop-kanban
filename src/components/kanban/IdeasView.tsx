'use client';

import { useState, useEffect, useMemo } from 'react';
import { Project, Column } from './KanbanBoard';
import { KanbanCard } from './KanbanCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Lightbulb, Plus, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';

type Tag = {
  name: string;
  color: string;
  emoji?: string;
  icon?: string;
};

type IdeasViewProps = {
  ideas: Project[];
  tags: Tag[];
  columns: Column[];
  onIdeaClick: (idea: Project) => void;
  onMoveToKanban: (ideaId: string, columnId: string) => void;
  onDeleteIdea: (ideaId: string) => void;
  onCreateIdea?: () => void;
};

export function IdeasView({
  ideas: propIdeas,
  tags,
  columns,
  onIdeaClick,
  onMoveToKanban,
  onDeleteIdea,
  onCreateIdea,
}: IdeasViewProps) {
  const [localIdeas, setLocalIdeas] = useState<Project[]>(propIdeas);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  // Keep local copy in sync when parent refreshes
  useEffect(() => {
    setLocalIdeas(propIdeas);
  }, [propIdeas]);

  const filteredIdeas = useMemo(() => {
    return localIdeas
      .filter(idea => {
        if (searchQuery) {
          const q = searchQuery.toLowerCase();
          if (
            !idea.title.toLowerCase().includes(q) &&
            !idea.description?.toLowerCase().includes(q)
          )
            return false;
        }
        if (selectedTags.length > 0) {
          if (!selectedTags.some(t => idea.tags?.includes(t))) return false;
        }
        return true;
      })
      .sort((a, b) => a.position - b.position);
  }, [localIdeas, searchQuery, selectedTags]);

  const hasActiveFilters = searchQuery || selectedTags.length > 0;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-end gap-2 px-4 py-2 border-b bg-muted/20 flex-wrap">
        <div className="flex items-center gap-2 flex-1 min-w-0 overflow-hidden">
          <div className="relative w-48 shrink-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search ideas..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-8 text-sm"
            />
          </div>
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setSearchQuery(''); setSelectedTags([]); }}
            >
              <X className="h-4 w-4 mr-1" /> Clear
            </Button>
          )}
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 min-w-0 overflow-hidden">
              {tags.map(tag => (
                <Badge
                  key={tag.name}
                  variant={selectedTags.includes(tag.name) ? 'default' : 'outline'}
                  className={cn(
                    'cursor-pointer text-xs transition-all hover:scale-105',
                    selectedTags.includes(tag.name) && 'ring-2 ring-offset-1 ring-offset-background'
                  )}
                  style={
                    selectedTags.includes(tag.name)
                      ? { backgroundColor: tag.color, borderColor: tag.color }
                      : {}
                  }
                  onClick={() =>
                    setSelectedTags(prev =>
                      prev.includes(tag.name)
                        ? prev.filter(t => t !== tag.name)
                        : [...prev, tag.name]
                    )
                  }
                >
                  {tag.emoji && <span className="mr-0.5">{tag.emoji}</span>}
                  {tag.name}
                  {selectedTags.includes(tag.name) && <X className="ml-1 h-3 w-3" />}
                </Badge>
              ))}
            </div>
          )}
        </div>
        {onCreateIdea && (
          <Button size="sm" onClick={onCreateIdea}>
            <Plus className="mr-2 h-4 w-4" /> New Idea
          </Button>
        )}
      </div>

      {/* Card grid */}
      {filteredIdeas.length === 0 ? (
        <div className="flex flex-1 items-center justify-center flex-col gap-3 text-muted-foreground">
          <Lightbulb className="h-12 w-12 opacity-20" />
          <p className="text-sm">
            {hasActiveFilters
              ? 'No ideas match your filters.'
              : 'No ideas yet. Create one to get started.'}
          </p>
        </div>
      ) : (
        <div className="flex flex-wrap gap-3 p-4 content-start overflow-y-auto flex-1">
          {filteredIdeas.map(idea => (
            <div key={idea.id} className="w-60 shrink-0">
              <KanbanCard
                project={idea}
                onClick={() => onIdeaClick(idea)}
                onDelete={() => onDeleteIdea(idea.id)}
                onMoveToColumn={(columnId) => onMoveToKanban(idea.id, columnId)}
                columns={columns}
                size="small"
                className="h-full"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
