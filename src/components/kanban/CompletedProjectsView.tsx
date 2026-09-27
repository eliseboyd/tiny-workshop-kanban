'use client';

import { useState, useMemo } from 'react';
import { Project } from './KanbanBoard';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Filter, Search, X, Calendar, CheckCircle2 } from 'lucide-react';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import styles from './CompletedProjectsView.module.css';
import { format, parseISO, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { isInProjectGroup } from '@/lib/project-groups';

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
  tags?: string[];
  matchMode?: 'any' | 'all';
};

type CompletedProjectsViewProps = {
  projects: Project[];
  tags: Tag[];
  projectGroups: ProjectGroup[];
  onProjectClick: (project: Project) => void;
};

export function CompletedProjectsView({
  projects,
  tags,
  projectGroups,
  onProjectClick,
}: CompletedProjectsViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedProjectGroup, setSelectedProjectGroup] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState<'all' | 'this-month' | 'last-month' | 'last-3-months'>('all');
  const [sortBy, setSortBy] = useState<'date-desc' | 'date-asc' | 'title'>('date-desc');

  // Filter completed projects (not tasks, and marked as completed)
  const completedProjects = useMemo(() => {
    return projects.filter(p => {
      // Must be a project (not a task)
      if (p.isTask) return false;
      
      // Must be marked as completed
      if (!p.isCompleted) return false;

      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = p.title.toLowerCase().includes(query);
        const matchesDescription = p.description?.toLowerCase().includes(query);
        if (!matchesTitle && !matchesDescription) return false;
      }

      // Tag filter
      if (selectedTags.length > 0) {
        const projectTags = p.tags || [];
        const hasSelectedTag = selectedTags.some(tag => projectTags.includes(tag));
        if (!hasSelectedTag) return false;
      }

      // Project group filter
      if (selectedProjectGroup) {
        const group = projectGroups.find(g => g.id === selectedProjectGroup);
        if (!group || !isInProjectGroup(p.tags, group)) return false;
      }

      // Date filter
      if (dateFilter !== 'all' && p.updatedAt) {
        const updatedDate = parseISO(p.updatedAt.toString());
        const now = new Date();
        
        switch (dateFilter) {
          case 'this-month':
            if (!isWithinInterval(updatedDate, { start: startOfMonth(now), end: endOfMonth(now) })) {
              return false;
            }
            break;
          case 'last-month':
            const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1);
            if (!isWithinInterval(updatedDate, { start: startOfMonth(lastMonth), end: endOfMonth(lastMonth) })) {
              return false;
            }
            break;
          case 'last-3-months':
            const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3);
            if (updatedDate < threeMonthsAgo) {
              return false;
            }
            break;
        }
      }

      return true;
    });
  }, [projects, projectGroups, searchQuery, selectedTags, selectedProjectGroup, dateFilter]);

  // Sort projects
  const sortedProjects = useMemo(() => {
    const sorted = [...completedProjects];
    
    switch (sortBy) {
      case 'date-desc':
        sorted.sort((a, b) => {
          if (!a.updatedAt || !b.updatedAt) return 0;
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        });
        break;
      case 'date-asc':
        sorted.sort((a, b) => {
          if (!a.updatedAt || !b.updatedAt) return 0;
          return new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
        });
        break;
      case 'title':
        sorted.sort((a, b) => a.title.localeCompare(b.title));
        break;
    }
    
    return sorted;
  }, [completedProjects, sortBy]);

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
    setSelectedProjectGroup(null);
    setDateFilter('all');
  };

  const hasActiveFilters = searchQuery || selectedTags.length > 0 || selectedProjectGroup || dateFilter !== 'all';

  return (
    <div className={styles.Root}>
      {/* Header */}
      <div className={styles.Header}>
        <div className={styles.TitleRow}>
          <div className={styles.TitleGroup}>
            <CheckCircle2 className={styles.TitleIcon} />
            <h2 className={styles.Title}>Completed Projects</h2>
            <Badge variant="secondary" className={styles.Count}>
              {sortedProjects.length}
            </Badge>
          </div>
        </div>

        {/* Filters */}
        <div className={styles.Filters}>
          {/* Search and Sort Row */}
          <div className={styles.SearchRow}>
            <div className={styles.SearchField}>
              <Search className={styles.SearchIcon} />
              <Input
                placeholder="Search completed projects..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={styles.SearchInput}
              />
            </div>
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
              <SelectTrigger className={styles.SortTrigger}>
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date-desc">Newest First</SelectItem>
                <SelectItem value="date-asc">Oldest First</SelectItem>
                <SelectItem value="title">Title A-Z</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Filter Row */}
          <div className={styles.FilterRow}>
            <Filter className={styles.FilterIcon} />
            
            {/* Date Filter */}
            <Select value={dateFilter} onValueChange={(v) => setDateFilter(v as typeof dateFilter)}>
              <SelectTrigger className={styles.DateTrigger}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Time</SelectItem>
                <SelectItem value="this-month">This Month</SelectItem>
                <SelectItem value="last-month">Last Month</SelectItem>
                <SelectItem value="last-3-months">Last 3 Months</SelectItem>
              </SelectContent>
            </Select>

            {/* Project Group Filter */}
            <Select 
              value={selectedProjectGroup || 'all'} 
              onValueChange={(v) => setSelectedProjectGroup(v === 'all' ? null : v)}
            >
              <SelectTrigger className={styles.GroupTrigger}>
                <SelectValue placeholder="All Projects" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Projects</SelectItem>
                {projectGroups.map(group => (
                  <SelectItem key={group.id} value={group.id}>
                    <div className={styles.GroupOption}>
                      {group.emoji && <span>{group.emoji}</span>}
                      <span>{group.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className={styles.ClearIcon} /> Clear
              </Button>
            )}
          </div>

          {/* Tag Filters */}
          {tags.length > 0 && (
            <div className={styles.TagFilters}>
              {tags.map(tag => (
                <Badge
                  key={tag.name}
                  variant={selectedTags.includes(tag.name) ? "default" : "outline"}
                  className={cn(styles.Chip, selectedTags.includes(tag.name) && styles.ChipActive)}
                  style={selectedTags.includes(tag.name) ? { backgroundColor: tag.color, borderColor: tag.color } : {}}
                  onClick={() => toggleTag(tag.name)}
                >
                  {tag.emoji && <span className={styles.ChipEmoji}>{tag.emoji}</span>}
                  {tag.name}
                  {selectedTags.includes(tag.name) && (
                    <X className={styles.ChipClearIcon} />
                  )}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Grid Content */}
      <div className={styles.Content}>
        {sortedProjects.length === 0 ? (
          <div className={styles.Empty}>
            <CheckCircle2 className={styles.EmptyIcon} />
            <h3 className={styles.EmptyTitle}>
              {hasActiveFilters ? 'No projects match your filters' : 'No completed projects yet'}
            </h3>
            <p className={styles.EmptyText}>
              {hasActiveFilters
                ? 'Try adjusting your filters to see more results.'
                : 'Projects marked as complete will appear here.'}
            </p>
          </div>
        ) : (
          <div className={styles.Grid}>
            {sortedProjects.map(project => (
              <Card
                key={project.id}
                className={styles.Card}
                onClick={() => onProjectClick(project)}
              >
                {project.imageUrl && (
                  <div className={styles.ImageWrap}>
                    <Image
                      src={project.imageUrl}
                      alt={project.title}
                      fill
                      className={styles.Image}
                    />
                  </div>
                )}
                <CardContent className={cn(styles.CardBody, !project.imageUrl && styles.CardBodyNoImage)}>
                  <h3 className={styles.CardTitle}>
                    {project.title}
                  </h3>
                  {project.description && (
                    <p className={styles.CardDescription}>
                      {project.description}
                    </p>
                  )}
                  {project.tags && project.tags.length > 0 && (
                    <div className={styles.CardTags}>
                      {project.tags.slice(0, 2).map(tagName => {
                        const tag = tags.find(t => t.name === tagName);
                        return (
                          <Badge
                            key={tagName}
                            variant="secondary"
                            className={styles.CardTag}
                            style={tag ? { backgroundColor: tag.color + '20', color: tag.color } : {}}
                          >
                            {tag?.emoji && <span className={styles.CardTagEmoji}>{tag.emoji}</span>}
                            {tagName}
                          </Badge>
                        );
                      })}
                      {project.tags.length > 2 && (
                        <Badge variant="secondary" className={styles.CardTag}>
                          +{project.tags.length - 2}
                        </Badge>
                      )}
                    </div>
                  )}
                  {project.updatedAt && (
                    <div className={styles.CardDate}>
                      <Calendar className={styles.CardDateIcon} />
                      <span>
                        {format(parseISO(project.updatedAt.toString()), 'MMM d, yyyy')}
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

