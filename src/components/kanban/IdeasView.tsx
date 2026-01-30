'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import { Project, Column } from './KanbanBoard';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Lightbulb, Link2, Search, X } from 'lucide-react';
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
};

const extractFirstUrl = (html?: string | null) => {
  if (!html) return null;
  const match = html.match(/href=["']([^"']+)["']/i);
  return match?.[1] || null;
};

export function IdeasView({
  ideas,
  tags,
  columns,
  onIdeaClick,
  onMoveToKanban,
  onDeleteIdea,
}: IdeasViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [moveTargets, setMoveTargets] = useState<Record<string, string>>({});

  const filteredIdeas = useMemo(() => {
    return ideas.filter(idea => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = idea.title.toLowerCase().includes(query);
        const matchesDescription = idea.description?.toLowerCase().includes(query);
        if (!matchesTitle && !matchesDescription) return false;
      }

      if (selectedTags.length > 0) {
        const ideaTags = idea.tags || [];
        const hasSelectedTag = selectedTags.some(tag => ideaTags.includes(tag));
        if (!hasSelectedTag) return false;
      }

      return true;
    });
  }, [ideas, searchQuery, selectedTags]);

  const toggleTag = (tagName: string) => {
    setSelectedTags(prev =>
      prev.includes(tagName)
        ? prev.filter(t => t !== tagName)
        : [...prev, tagName]
    );
  };

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedTags([]);
  };

  const hasActiveFilters = searchQuery || selectedTags.length > 0;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-none p-6 pb-4 border-b">
        <div className="flex items-center gap-2 mb-4">
          <Lightbulb className="h-6 w-6 text-amber-500" />
          <h2 className="text-2xl font-bold">Ideas</h2>
          <Badge variant="secondary" className="ml-2">
            {filteredIdeas.length}
          </Badge>
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search ideas..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="h-4 w-4 mr-1" /> Clear
              </Button>
            )}
          </div>

          {tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {tags.map(tag => (
                <Badge
                  key={tag.name}
                  variant={selectedTags.includes(tag.name) ? 'default' : 'outline'}
                  className={cn(
                    'cursor-pointer transition-all hover:scale-105',
                    selectedTags.includes(tag.name) && 'ring-2 ring-offset-1 ring-offset-background'
                  )}
                  style={selectedTags.includes(tag.name) ? { backgroundColor: tag.color, borderColor: tag.color } : {}}
                  onClick={() => toggleTag(tag.name)}
                >
                  {tag.emoji && <span className="mr-1">{tag.emoji}</span>}
                  {tag.name}
                  {selectedTags.includes(tag.name) && (
                    <X className="ml-1 h-3 w-3" />
                  )}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {filteredIdeas.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Lightbulb className="h-16 w-16 text-muted-foreground/20 mb-4" />
            <h3 className="text-lg font-semibold text-muted-foreground mb-2">
              {hasActiveFilters ? 'No ideas match your filters' : 'No ideas yet'}
            </h3>
            <p className="text-sm text-muted-foreground max-w-md">
              {hasActiveFilters
                ? 'Try adjusting your filters to see more results.'
                : 'Capture inspiration here before moving projects to the Kanban board.'}
            </p>
          </div>
        ) : (
          <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-4 space-y-4">
            {filteredIdeas.map(idea => {
              const link = extractFirstUrl(idea.richContent);
              const selectedColumn = moveTargets[idea.id] || columns[0]?.id;

              return (
                <Card
                  key={idea.id}
                  className="break-inside-avoid cursor-pointer hover:shadow-lg transition-all group overflow-hidden"
                  onClick={() => onIdeaClick(idea)}
                >
                  {idea.imageUrl && (
                    <div className="relative w-full h-40 overflow-hidden bg-muted">
                      <Image
                        src={idea.imageUrl}
                        alt={idea.title}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform"
                      />
                    </div>
                  )}
                  <CardContent className={cn('p-4', !idea.imageUrl && 'pt-4')}>
                    <h3 className="font-semibold text-sm mb-1.5 line-clamp-2">
                      {idea.title}
                    </h3>
                    {idea.description && (
                      <p className="text-xs text-muted-foreground mb-2 line-clamp-3">
                        {idea.description}
                      </p>
                    )}
                    {link && (
                      <div className="flex items-center gap-1 text-[11px] text-muted-foreground mb-2">
                        <Link2 className="h-3 w-3" />
                        <a
                          href={link}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(event) => event.stopPropagation()}
                          className="truncate hover:underline"
                        >
                          {link}
                        </a>
                      </div>
                    )}
                    {idea.tags && idea.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-3">
                        {idea.tags.slice(0, 3).map(tagName => {
                          const tag = tags.find(t => t.name === tagName);
                          return (
                            <Badge
                              key={tagName}
                              variant="secondary"
                              className="text-[10px] px-1.5 py-0"
                              style={tag ? { backgroundColor: tag.color + '20', color: tag.color } : {}}
                            >
                              {tag?.emoji && <span className="mr-0.5">{tag.emoji}</span>}
                              {tagName}
                            </Badge>
                          );
                        })}
                        {idea.tags.length > 3 && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                            +{idea.tags.length - 3}
                          </Badge>
                        )}
                      </div>
                    )}
                    <div className="flex flex-col gap-2">
                      <Select
                        value={selectedColumn}
                        onValueChange={(value) =>
                          setMoveTargets(prev => ({ ...prev, [idea.id]: value }))
                        }
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Choose column" />
                        </SelectTrigger>
                        <SelectContent>
                          {columns.map(col => (
                            <SelectItem key={col.id} value={col.id}>
                              {col.title}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="flex-1 h-8 text-xs"
                          disabled={!selectedColumn}
                          onClick={(event) => {
                            event.stopPropagation();
                            if (selectedColumn) {
                              onMoveToKanban(idea.id, selectedColumn);
                            }
                          }}
                        >
                          Move to Kanban
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs"
                          onClick={(event) => {
                            event.stopPropagation();
                            onDeleteIdea(idea.id);
                          }}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
