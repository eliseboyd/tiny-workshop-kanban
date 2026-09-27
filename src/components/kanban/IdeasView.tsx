'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Project, Column } from './KanbanBoard';
import { KanbanCard } from './KanbanCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Archive, Lightbulb, Plus, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import styles from './IdeasView.module.css';

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
  archived?: Project[];
  onArchivedClick?: (project: Project) => void;
  onMoveToKanban: (ideaId: string, columnId: string) => void;
  onDeleteIdea: (ideaId: string) => void;
  onCreateIdea?: () => void;
};

export function IdeasView({
  ideas: propIdeas,
  tags,
  columns,
  onIdeaClick,
  archived = [],
  onArchivedClick,
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

  // Search and tag filters apply to the Archived section too.
  const matchesFilters = useCallback((idea: Project) => {
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
  }, [searchQuery, selectedTags]);

  const filteredIdeas = useMemo(
    () => localIdeas.filter(matchesFilters).sort((a, b) => a.position - b.position),
    [localIdeas, matchesFilters]
  );

  const filteredArchived = useMemo(
    () => archived.filter(matchesFilters),
    [archived, matchesFilters]
  );

  const hasActiveFilters = searchQuery || selectedTags.length > 0;

  return (
    <div className={styles.Root}>
      {/* Toolbar */}
      <div className={styles.Toolbar}>
        <div className={styles.Filters}>
          <div className={styles.SearchWrap}>
            <Search className={styles.SearchIcon} />
            <Input
              placeholder="Search ideas..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={styles.SearchInput}
            />
          </div>
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setSearchQuery(''); setSelectedTags([]); }}
            >
              <X className={styles.ClearIcon} /> Clear
            </Button>
          )}
          {tags.length > 0 && (
            <div className={styles.Tags}>
              {tags.map(tag => (
                <Badge
                  key={tag.name}
                  variant={selectedTags.includes(tag.name) ? 'default' : 'outline'}
                  className={cn(
                    styles.Tag,
                    selectedTags.includes(tag.name) && styles.TagSelected
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
                  {tag.emoji && <span className={styles.TagEmoji}>{tag.emoji}</span>}
                  {tag.name}
                  {selectedTags.includes(tag.name) && <X className={styles.TagRemove} />}
                </Badge>
              ))}
            </div>
          )}
        </div>
        {onCreateIdea && (
          <Button size="sm" onClick={onCreateIdea}>
            <Plus className={styles.NewIcon} /> New Idea
          </Button>
        )}
      </div>

      <div className={styles.Scroll}>
        {/* Card grid */}
        {filteredIdeas.length === 0 ? (
          <div className={styles.Empty}>
            <Lightbulb className={styles.EmptyIcon} />
            <p className={styles.EmptyText}>
              {hasActiveFilters
                ? 'No ideas match your filters.'
                : 'No ideas yet. Create one to get started.'}
            </p>
          </div>
        ) : (
          <div className={styles.Grid}>
            {filteredIdeas.map(idea => (
              <div key={idea.id} className={styles.Cell}>
                <KanbanCard
                  project={idea}
                  onClick={() => onIdeaClick(idea)}
                  onDelete={() => onDeleteIdea(idea.id)}
                  onMoveToColumn={(columnId) => onMoveToKanban(idea.id, columnId)}
                  columns={columns}
                  size="small"
                  className={styles.Card}
                />
              </div>
            ))}
          </div>
        )}

        {/* Archived — ideas and board projects archived from the project modal */}
        {filteredArchived.length > 0 && (
          <section className={styles.Archived}>
            <h2 className={styles.ArchivedTitle}>
              <Archive className={styles.ArchivedIcon} /> Archived
              <span className={styles.ArchivedCount}>{filteredArchived.length}</span>
            </h2>
            <div className={styles.ArchivedGrid}>
              {filteredArchived.map(project => (
                <div key={project.id} className={styles.Cell}>
                  <KanbanCard
                    project={project}
                    onClick={() => onArchivedClick?.(project)}
                    size="small"
                    className={styles.Card}
                  />
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
