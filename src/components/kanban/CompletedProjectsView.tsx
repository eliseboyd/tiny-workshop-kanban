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
import { format, parseISO, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';

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
        if (p.parentProjectId !== selectedProjectGroup) return false;
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
  }, [projects, searchQuery, selectedTags, selectedProjectGroup, dateFilter]);

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
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex-none p-6 pb-4 border-b">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-6 w-6 text-green-600" />
            <h2 className="text-2xl font-bold">Completed Projects</h2>
            <Badge variant="secondary" className="ml-2">
              {sortedProjects.length}
            </Badge>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-3">
          {/* Search and Sort Row */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search completed projects..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
              <SelectTrigger className="w-[180px]">
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
          <div className="flex gap-2 items-center">
            <Filter className="h-4 w-4 text-muted-foreground" />
            
            {/* Date Filter */}
            <Select value={dateFilter} onValueChange={(v: any) => setDateFilter(v)}>
              <SelectTrigger className="w-[160px]">
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
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All Projects" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Projects</SelectItem>
                {projectGroups.map(group => (
                  <SelectItem key={group.id} value={group.id}>
                    <div className="flex items-center gap-2">
                      {group.emoji && <span>{group.emoji}</span>}
                      <span>{group.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="h-4 w-4 mr-1" /> Clear
              </Button>
            )}
          </div>

          {/* Tag Filters */}
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {tags.map(tag => (
                <Badge
                  key={tag.name}
                  variant={selectedTags.includes(tag.name) ? "default" : "outline"}
                  className={cn(
                    "cursor-pointer transition-all hover:scale-105",
                    selectedTags.includes(tag.name) && "ring-2 ring-offset-1 ring-offset-background"
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

      {/* Grid Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {sortedProjects.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <CheckCircle2 className="h-16 w-16 text-muted-foreground/20 mb-4" />
            <h3 className="text-lg font-semibold text-muted-foreground mb-2">
              {hasActiveFilters ? 'No projects match your filters' : 'No completed projects yet'}
            </h3>
            <p className="text-sm text-muted-foreground max-w-md">
              {hasActiveFilters
                ? 'Try adjusting your filters to see more results.'
                : 'Projects marked as complete will appear here.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {sortedProjects.map(project => (
              <Card
                key={project.id}
                className="cursor-pointer hover:shadow-lg transition-all hover:scale-[1.02] group overflow-hidden"
                onClick={() => onProjectClick(project)}
              >
                {project.imageUrl && (
                  <div className="relative w-full h-40 overflow-hidden bg-muted">
                    <Image
                      src={project.imageUrl}
                      alt={project.title}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform"
                    />
                  </div>
                )}
                <CardContent className={cn("p-4", !project.imageUrl && "pt-6")}>
                  <h3 className="font-semibold mb-2 line-clamp-2">
                    {project.title}
                  </h3>
                  {project.description && (
                    <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                      {project.description}
                    </p>
                  )}
                  {project.tags && project.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {project.tags.slice(0, 3).map(tagName => {
                        const tag = tags.find(t => t.name === tagName);
                        return (
                          <Badge
                            key={tagName}
                            variant="secondary"
                            className="text-xs"
                            style={tag ? { backgroundColor: tag.color + '20', color: tag.color } : {}}
                          >
                            {tag?.emoji && <span className="mr-1">{tag.emoji}</span>}
                            {tagName}
                          </Badge>
                        );
                      })}
                      {project.tags.length > 3 && (
                        <Badge variant="secondary" className="text-xs">
                          +{project.tags.length - 3}
                        </Badge>
                      )}
                    </div>
                  )}
                  {project.updatedAt && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      <span>
                        Completed {format(parseISO(project.updatedAt.toString()), 'MMM d, yyyy')}
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

